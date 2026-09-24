-- ---------------------------------------------------------------------------
-- 0037 - Lancamento retroativo de descanso e ausencia
--
-- O Full Days entra em operacao com o historico zerado, e a equipe ja descansou
-- este ano. Sem lancar esse historico o saldo de todo mundo nasce errado e o
-- relatorio gerencial nao serve para nada.
--
-- O PRINCIPIO, e ele decide o resto: lancamento retroativo e ATO DA GESTAO,
-- nao pedido do colaborador. Um pedido passa por aprovacao; um lancamento e o
-- registro de um fato consumado -- nao ha o que aprovar. E se a propria pessoa
-- pudesse lancar o proprio passado, ela registraria descanso que nao tirou, ou
-- mexeria no proprio saldo sem ninguem ver.
--
-- QUATRO COISAS ACONTECEM AQUI
--
--   1. `hr_origem` separa o que foi pedido do que foi lancado. Sem a coluna,
--      "esse periodo passou por aprovacao?" nao tem resposta tres meses
--      depois, e o relatorio nao sabe explicar um numero estranho.
--
--   2. `ano_referencia` passa a decidir o saldo, no lugar do ano da data de
--      inicio. Descanso tirado em janeiro pode pertencer ao saldo do ano
--      anterior, e so quem lanca sabe -- por isso o campo e editavel.
--
--   3. A RLS separa os dois caminhos numa policy so: a pessoa cria pedido em
--      nome proprio, a gestao cria lancamento. Um colaborador nao consegue
--      gravar `origem = 'lancamento_retroativo'` nem montando o PATCH a mao.
--
--   4. `lancar_periodo()` faz tudo numa transacao: grava o registro ja
--      aprovado, pinta a presenca e registra quem lancou. Tres chamadas pelo
--      PostgREST seriam tres transacoes, e a segunda falhando deixaria um
--      periodo lancado sem nenhum dia pintado -- que e o estado em que o saldo
--      diz uma coisa e a matriz diz outra.
--
-- O QUE AVISA E O QUE TRAVA, e a lista e curta de proposito. Lancamento
-- descreve o que ja aconteceu, entao quase nada deve bloquear:
--
--   trava  | sobreposicao com outro registro DA MESMA PESSOA (duplicata)
--   trava  | periodo anterior a data de admissao
--   trava  | periodo no futuro (para isso existe a solicitacao normal)
--   avisa  | sobreposicao com colega da mesma area -- ja aconteceu
--   avisa  | saldo do ano ficaria negativo -- tambem ja aconteceu
--
-- Os dois avisos moram na TELA, e e deliberado: uma trava que recusa um fato
-- consumado obriga a pessoa a mentir a data para conseguir registrar.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A origem do registro
-- ---------------------------------------------------------------------------

do $bloco$
begin
  if not exists (select 1 from pg_type where typname = 'hr_origem') then
    create type public.hr_origem as enum (
      'solicitacao',
      'lancamento_retroativo',
      'importacao'
    );
  end if;
end;
$bloco$;

alter table public.hr_requests
  add column if not exists origem         public.hr_origem not null default 'solicitacao',
  add column if not exists ano_referencia integer,
  add column if not exists lancado_por    uuid references public.profiles (id),
  add column if not exists lancado_em     timestamptz;

comment on column public.hr_requests.origem is
  'De onde veio: pedido da pessoa, lancamento da gestao, ou importacao de planilha. Importacao e separada de lancamento para dar para achar a planilha que trouxe um numero errado.';
comment on column public.hr_requests.ano_referencia is
  'O ano a que o periodo se aplica PARA EFEITO DE SALDO. Normalmente o ano de data_inicio, mas descanso tirado em janeiro pode pertencer ao saldo do ano anterior.';

-- O que ja existe e pedido, e o ano dele e o da data de inicio. Preencher
-- antes do `not null`: um `not null` numa coluna nova quebra a migration em
-- qualquer ambiente com linha anterior a esta regra.
update public.hr_requests
   set ano_referencia = extract(year from data_inicio)::integer
 where ano_referencia is null;

alter table public.hr_requests alter column ano_referencia set not null;

create index if not exists hr_requests_saldo_idx
  on public.hr_requests (user_id, ano_referencia, tipo);


-- ---------------------------------------------------------------------------
-- PASSO 2 - RLS: quem cria pedido e quem cria lancamento
-- ---------------------------------------------------------------------------

drop policy if exists hr_requests_insert on public.hr_requests;
drop policy if exists hr_requests_update on public.hr_requests;

-- UMA policy, DOIS caminhos. Separar em duas policies permissivas seria um OR:
-- a de pedido, sozinha, ja deixaria o colaborador gravar qualquer `origem`,
-- porque uma policy permissiva que casa basta. Os dois ramos precisam viver na
-- mesma expressao para a `origem` fazer parte da pergunta.
create policy hr_requests_insert on public.hr_requests
  for insert to authenticated
  with check (
    (origem = 'solicitacao'
      and user_id = (select auth.uid())
      and public.is_staff())
    or (origem in ('lancamento_retroativo', 'importacao')
      and public.is_gestor())
  );

-- Corrigir um lancamento e da gestao; corrigir o proprio pedido continua sendo
-- do dono, e so enquanto pendente. Sem a restricao a `pendente`, qualquer
-- pessoa marcaria o proprio pedido como 'aprovada' com um update.
create policy hr_requests_update on public.hr_requests
  for update to authenticated
  using (public.is_gestor() or (user_id = (select auth.uid()) and status = 'pendente'))
  with check (public.is_gestor() or (user_id = (select auth.uid()) and status = 'pendente'));

-- Apagar um lancamento errado e da gestao. Continua NAO havendo delete de
-- pedido decidido para o dono: pedido e historico de RH, e cancelar e status.
drop policy if exists hr_requests_delete on public.hr_requests;
create policy hr_requests_delete on public.hr_requests
  for delete to authenticated
  using (public.is_gestor() and origem in ('lancamento_retroativo', 'importacao'));


-- ---------------------------------------------------------------------------
-- PASSO 3 - O saldo passa a olhar o ano de REFERENCIA
-- ---------------------------------------------------------------------------

/** Saldo de descanso da pessoa no ano de referencia: contratado menos usado. */
create or replace function public.saldo_de_ferias(p_user_id uuid, p_ano integer)
returns integer
language plpgsql
stable
as $$
declare
  contratado integer;
  usado      integer;
begin
  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = p_user_id;

  if contratado is null then
    contratado := 15;
  end if;

  -- Pendente conta como usado. Nao contar faria a pessoa pedir 15 dias duas
  -- vezes enquanto o primeiro pedido espera decisao, e o socio aprovaria os
  -- dois sem ver o problema.
  --
  -- E o filtro e por `ano_referencia`, e nao mais pelo ano da data de inicio:
  -- e o lancamento retroativo que precisa dizer a que ano o periodo pertence,
  -- e um descanso de janeiro pode ser do saldo do ano anterior.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and ano_referencia = p_ano;

  return contratado - usado;
end;
$$;

/** Quantas parcelas de descanso a pessoa ja tem no ano de referencia. */
create or replace function public.parcelas_de_ferias(p_user_id uuid, p_ano integer)
returns integer
language plpgsql
stable
as $$
declare
  quantas integer;
begin
  select count(*) into quantas
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and ano_referencia = p_ano;

  return coalesce(quantas, 0);
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - A validacao sabe a diferenca entre pedir e lancar
-- ---------------------------------------------------------------------------

-- PARTE DA VERSAO DA 0024, e isto importa: a funcao ja foi reescrita quatro
-- vezes (0011, 0016, 0018, 0024), e cada uma trocou as frases. Escrever esta
-- a partir da 0011 ressuscitou o vocabulario da CLT em tres mensagens, e a
-- bateria pegou -- foi o unico jeito de descobrir. O que muda aqui e o ramo
-- do lancamento e o `ano_referencia`; as frases sao as que ja valiam.
create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  ano        integer;
  contratado integer;
  parcelas   integer;
  usado      integer;
  sobrepoe   integer;
  admissao   date;
begin
  -- O ano de referencia se preenche sozinho quando ninguem informou: o caso
  -- comum e o periodo pertencer ao ano em que comecou.
  if new.ano_referencia is null then
    new.ano_referencia := extract(year from new.data_inicio)::integer;
  end if;
  ano := new.ano_referencia;

  if new.dias_uteis <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = case when new.tipo = 'ferias'
                  then 'O periodo escolhido nao tem nenhum dia.'
                  else 'O periodo escolhido nao tem nenhum dia util.'
                end;
  end if;

  -- Sobreposicao com registro proprio: vale para os tres tipos e para os dois
  -- caminhos. Duas linhas cobrindo o mesmo dia deixariam a matriz sem saber
  -- qual mostrar -- e num lancamento e quase sempre duplicata de digitacao.
  select count(*) into sobrepoe
    from public.hr_requests r
   where r.user_id = new.user_id
     and r.id is distinct from new.id
     and r.status in ('pendente', 'aprovada')
     and r.data_inicio <= new.data_fim
     and r.data_fim    >= new.data_inicio;

  -- A FRASE MUDA COM O CAMINHO, e nao e capricho: no pedido quem le e a
  -- propria pessoa, no lancamento e a gestao olhando a ficha de outra.
  if sobrepoe > 0 then
    raise exception using
      errcode = 'check_violation',
      message = case when new.origem = 'solicitacao'
                  then 'Voce ja tem um periodo combinado cobrindo parte dessas datas.'
                  else 'Esta pessoa ja tem um periodo combinado cobrindo parte dessas datas.'
                end;
  end if;

  -- ---- daqui para baixo, o que muda entre pedir e lancar ----

  if new.origem <> 'solicitacao' then
    -- LANCAMENTO. Registra o que ja aconteceu, entao a lista de travas e curta.

    if new.data_fim >= current_date then
      raise exception using
        errcode = 'check_violation',
        message = 'Lancamento retroativo e para periodo que ja terminou.',
        hint    = 'Para um periodo que ainda vai acontecer, use a aba Solicitar.';
    end if;

    select data_admissao into admissao
      from public.team_members where user_id = new.user_id;

    if admissao is not null and new.data_inicio < admissao then
      raise exception using
        errcode = 'check_violation',
        message = format(
          'O periodo comeca em %s, antes da entrada da pessoa na equipe (%s).',
          to_char(new.data_inicio, 'DD/MM/YYYY'), to_char(admissao, 'DD/MM/YYYY')
        );
    end if;

    -- Saldo negativo e periodo atravessando o ano NAO travam aqui: os dois
    -- acontecem de verdade, e o `ano_referencia` existe justamente para o
    -- segundo. Quem lanca ve o saldo resultante na tela antes de confirmar.
    return new;
  end if;

  if new.tipo <> 'ferias' then
    return new;
  end if;

  -- Ferias atravessando o ano viraria duas contas de saldo diferentes para o
  -- mesmo pedido. Melhor pedir dois.
  if extract(year from new.data_fim) <> extract(year from new.data_inicio) then
    raise exception using
      errcode = 'check_violation',
      message = 'Um descanso que atravessa o ano precisa ser combinado em dois, um em cada ano.';
  end if;

  select coalesce(dias_ferias_ano, 15), coalesce(max_parcelas_ferias, 2)
    into contratado, parcelas
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15);
  parcelas   := coalesce(parcelas, 2);

  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and id is distinct from new.id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and ano_referencia = ano;

  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de descanso por ano em contrato, contados corridos. Voce ja tem %s comprometidos em %s, entao sobram %s.',
        contratado, usado, ano, contratado - usado
      );
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and id is distinct from new.id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and ano_referencia = ano) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O descanso pode ser partido em ate %s vezes por ano, e voce ja usou as %s.',
        parcelas, parcelas
      );
  end if;

  return new;
end;
$$;

-- O gatilho precisa disparar tambem quando a ORIGEM ou o ANO mudam: sem eles
-- na lista, corrigir o ano de referencia de um lancamento passaria sem a
-- checagem de sobreposicao e sem preencher o ano quando ele vier nulo.
drop trigger if exists hr_requests_validar on public.hr_requests;
create trigger hr_requests_validar
  before insert or update of
    data_inicio, data_fim, dias_uteis, tipo, status, origem, ano_referencia
  on public.hr_requests
  for each row
  when (new.status in ('pendente', 'aprovada'))
  execute function public.validar_solicitacao();


-- ---------------------------------------------------------------------------
-- PASSO 5 - Pintar a presenca, num lugar so
-- ---------------------------------------------------------------------------

/**
 * Reescreve `team_presence` para o periodo de um registro aprovado.
 *
 * EXISTE PARA NAO HAVER DUAS REGRAS DE PINTURA. `decidir_solicitacao()` ja
 * pintava, e o lancamento retroativo precisa pintar igual -- copiar o bloco
 * criaria o dia em que o descanso pinta corrido de um lado e util do outro.
 *
 * O descanso pinta TODOS os dias do periodo, fim de semana e feriado
 * inclusive; os outros dois, so os uteis. Desde a 0024 o numero do descanso e
 * corrido, entao pular o sabado do meio faria a matriz mostrar menos dias do
 * que o pedido diz.
 */
create or replace function public.pintar_presenca_do_pedido(p_request_id uuid, p_quem uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido     public.hr_requests%rowtype;
  status_dia public.presenca_status;
  corrido    boolean;
begin
  select * into pedido from public.hr_requests where id = p_request_id;
  if not found then
    return;
  end if;

  delete from public.team_presence where hr_request_id = p_request_id;

  if pedido.status <> 'aprovada' then
    return;
  end if;

  status_dia := case pedido.tipo
                  when 'ferias'   then 'ferias'
                  when 'licenca'  then 'licenca'
                  else 'ausente'
                end::public.presenca_status;
  corrido := pedido.tipo = 'ferias';

  insert into public.team_presence (user_id, data, status, hr_request_id, atualizado_por)
  select pedido.user_id, d.dia::date, status_dia, pedido.id, p_quem
    from generate_series(pedido.data_inicio, pedido.data_fim, interval '1 day') as d(dia)
   where corrido
      or (extract(isodow from d.dia) < 6
          and not exists (select 1 from public.holidays h where h.data = d.dia::date))
  on conflict (user_id, data) do update
    set status         = excluded.status,
        hr_request_id  = excluded.hr_request_id,
        atualizado_por = excluded.atualizado_por;
end;
$$;

revoke all on function public.pintar_presenca_do_pedido(uuid, uuid) from public;
grant execute on function public.pintar_presenca_do_pedido(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Lancar, corrigir e apagar
-- ---------------------------------------------------------------------------

/**
 * Lanca um periodo que ja aconteceu, ja aprovado.
 *
 * NAO PASSA POR APROVACAO, e e a decisao central deste ajuste: nao ha o que
 * aprovar num fato consumado. O registro nasce `aprovada`, com `aprovado_por`
 * e `lancado_por` na mesma pessoa -- quem lancou responde pelo numero.
 *
 * E NAO NOTIFICA NINGUEM. Uma importacao de vinte linhas viraria vinte avisos
 * no sino de gente que ja sabe que tirou aquele descanso. O sino e para o que
 * os outros fizeram e a pessoa ainda nao sabe.
 */
create or replace function public.lancar_periodo(
  p_user_id        uuid,
  p_tipo           public.hr_tipo,
  p_data_inicio    date,
  p_data_fim       date,
  p_ano_referencia integer default null,
  p_observacao     text default null,
  p_origem         public.hr_origem default 'lancamento_retroativo'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem  uuid := (select auth.uid());
  novo  uuid;
  dias  integer;
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Lancar periodo que ja aconteceu e da gestao.',
      hint    = 'Para registrar um periodo seu, use a aba Solicitar.';
  end if;

  if p_origem = 'solicitacao' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta funcao lanca historico. Pedido normal passa pela aba Solicitar.';
  end if;

  -- O numero gravado sai de `dias_do_pedido()`, nao de quem chamou: se viesse
  -- do parametro, bastaria mandar 1 num periodo de quinze dias para o saldo
  -- nao mexer.
  dias := public.dias_do_pedido(p_tipo, p_data_inicio, p_data_fim);

  insert into public.hr_requests (
    user_id, tipo, data_inicio, data_fim, dias_uteis, motivo,
    status, origem, ano_referencia, aprovado_por, decidido_em,
    lancado_por, lancado_em
  ) values (
    p_user_id, p_tipo, p_data_inicio, p_data_fim, dias, p_observacao,
    'aprovada', p_origem,
    coalesce(p_ano_referencia, extract(year from p_data_inicio)::integer),
    quem, now(), quem, now()
  )
  returning id into novo;

  perform public.pintar_presenca_do_pedido(novo, quem);

  return novo;
end;
$$;

revoke all on function public.lancar_periodo(uuid, public.hr_tipo, date, date, integer, text, public.hr_origem) from public;
grant execute on function public.lancar_periodo(uuid, public.hr_tipo, date, date, integer, text, public.hr_origem) to authenticated;

/**
 * Corrige um lancamento e REPINTA a presenca.
 *
 * Sem o repintar, corrigir as datas deixaria os dias antigos pintados na
 * matriz: o saldo diria uma coisa e o mapa da equipe outra, e ninguem saberia
 * qual dos dois acreditar. Numa importacao de vinte linhas, uma data errada e
 * quase certa -- corrigir precisa ser tao barato quanto lancar.
 */
create or replace function public.corrigir_lancamento(
  p_request_id     uuid,
  p_data_inicio    date,
  p_data_fim       date,
  p_ano_referencia integer default null,
  p_observacao     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem   uuid := (select auth.uid());
  pedido public.hr_requests%rowtype;
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Corrigir lancamento e da gestao.';
  end if;

  select * into pedido from public.hr_requests where id = p_request_id for update;
  if not found then
    raise exception 'Lancamento nao encontrado.';
  end if;

  if pedido.origem = 'solicitacao' then
    raise exception using
      errcode = 'check_violation',
      message = 'Este periodo veio de um pedido, e pedido decidido nao se reescreve.',
      hint    = 'O historico de quem pediu e quem decidiu e o que da valor ao registro.';
  end if;

  update public.hr_requests
     set data_inicio    = p_data_inicio,
         data_fim       = p_data_fim,
         dias_uteis     = public.dias_do_pedido(pedido.tipo, p_data_inicio, p_data_fim),
         ano_referencia = coalesce(p_ano_referencia, extract(year from p_data_inicio)::integer),
         motivo         = coalesce(p_observacao, motivo)
   where id = p_request_id;

  perform public.pintar_presenca_do_pedido(p_request_id, quem);
end;
$$;

revoke all on function public.corrigir_lancamento(uuid, date, date, integer, text) from public;
grant execute on function public.corrigir_lancamento(uuid, date, date, integer, text) to authenticated;

/**
 * Apagar um lancamento leva os dias de presenca junto.
 *
 * `team_presence.hr_request_id` nao tem cascade: apagar so a linha do pedido
 * deixaria os dias pintados apontando para um registro que nao existe mais, e
 * a matriz mostraria descanso de alguem que o sistema ja esqueceu.
 */
create or replace function public.apagar_lancamento(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido public.hr_requests%rowtype;
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Apagar lancamento e da gestao.';
  end if;

  select * into pedido from public.hr_requests where id = p_request_id;
  if not found then
    return;
  end if;

  if pedido.origem = 'solicitacao' then
    raise exception using
      errcode = 'check_violation',
      message = 'Este periodo veio de um pedido, e pedido decidido e historico de RH.',
      hint    = 'Para tirar um pedido do caminho, cancele-o em vez de apagar.';
  end if;

  delete from public.team_presence where hr_request_id = p_request_id;
  delete from public.hr_requests where id = p_request_id;
end;
$$;

revoke all on function public.apagar_lancamento(uuid) from public;
grant execute on function public.apagar_lancamento(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 7 - O bloqueio por area nao olha o passado
-- ---------------------------------------------------------------------------

/**
 * Dias em que alguem da area da pessoa esta fora, para o calendario bloquear.
 *
 * PERIODO QUE JA PASSOU NAO BLOQUEIA NADA. O bloqueio existe para evitar que
 * duas pessoas da mesma area marquem o mesmo periodo FUTURO e a producao pare.
 * Com o historico lancado, sem este filtro a agencia inteira ficaria bloqueada
 * nas semanas em que alguem descansou no ano passado -- e o calendario de
 * pedido viraria um campo minado de datas que nao atrapalham ninguem.
 */
create or replace function public.dias_bloqueados_da_area(
  p_user_id uuid,
  p_inicio  date,
  p_fim     date
)
returns table (dia date, nomes text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  minha_area text;
begin
  select area into minha_area from public.team_members where user_id = p_user_id;
  if minha_area is null then
    return;
  end if;

  return query
  select d.dia::date,
         array_agg(distinct p.nome order by p.nome) as nomes
    from public.hr_requests r
    join public.team_members t on t.user_id = r.user_id
    join public.profiles p     on p.id = r.user_id
   cross join lateral generate_series(
      greatest(r.data_inicio, p_inicio),
      least(r.data_fim, p_fim),
      interval '1 day'
   ) as d(dia)
   where t.area = minha_area
     and r.user_id <> p_user_id
     and r.status in ('pendente', 'aprovada')
     and r.data_inicio <= p_fim
     and r.data_fim    >= p_inicio
     and d.dia::date >= current_date
   group by d.dia::date;
end;
$$;

revoke all on function public.dias_bloqueados_da_area(uuid, date, date) from public;
grant execute on function public.dias_bloqueados_da_area(uuid, date, date) to authenticated;


-- ---------------------------------------------------------------------------
-- O QUE FICOU DE FORA, e por que
--
-- `activity_log` nao existe no projeto -- o ajuste pede registro em auditoria,
-- e o que ha e o `task_history`, que e de tasks. O rastro do lancamento mora
-- nas proprias colunas: `lancado_por`, `lancado_em` e `origem` dizem quem
-- lancou, quando e por qual caminho, e a tela de historico le isso. Uma tabela
-- de auditoria propria e decisao maior que este ajuste, e inventa-la aqui
-- criaria um segundo lugar dizendo o que estas tres colunas ja dizem.
-- ---------------------------------------------------------------------------
