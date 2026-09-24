-- 0039 — O descanso passa a contar por CICLO DE 12 MESES, e nao por ano civil
--
-- Decisao do usuario: "ao inves de calcular o descanso por ano, calcule por
-- dias disponiveis a cada 12 meses -- entao a cada 12 meses soma 15 dias
-- disponiveis, e mais duas vezes que a pessoa pode usar".
--
-- O QUE MUDA, em uma frase: o saldo deixa de zerar em 1 de janeiro e passa a
-- ser um numero corrido, ancorado na entrada da pessoa na equipe.
--
--   ano civil (ate aqui)   15 dias por ano, e o que sobrou de 2025 some
--                          quando o calendario vira.
--   ciclo de 12 meses      cada ciclo completado SOMA 15 dias e 2 parcelas.
--                          Quem entrou ha tres anos e nunca parou tem 45.
--
-- POR QUE ISSO E MAIS QUE TROCAR UMA DATA. O modelo de ano tinha uma conta
-- por ano, e por isso precisava dizer a QUE ano cada periodo pertencia -- e
-- por isso a 0037 criou `ano_referencia`, e por isso um descanso de 28/12 a
-- 03/01 era um caso especial. No modelo de ciclo nao ha atribuicao nenhuma a
-- fazer: concedido e a soma dos ciclos, usado e a soma de tudo o que a pessoa
-- ja tirou, e o saldo e a diferenca. A coluna perde o emprego, e some -- e
-- apagar em vez de aposentar e a mesma decisao da 0023 com
-- `tasks.exigencia_aprovacao`: campo que nao decide mais nada e o pior tipo
-- de campo, porque quem o preenche acha que garantiu alguma coisa.
--
-- O QUE FICA REGISTRADO, e nao e detalhe: ciclo de 12 meses contado da
-- entrada da pessoa e, ESTRUTURALMENTE, o desenho do periodo aquisitivo da
-- CLT -- mais parecido com ele do que o ano civil, nao menos. O CLAUDE.md ja
-- dizia que o vocabulario reduz o risco e a estrutura e o que uma pericia
-- olha. Isto foi dito a quem decidiu, e a decisao foi seguir. Quem for mexer
-- nisto de novo, mexa sabendo disso.
--
-- UMA TRAVA SAIU JUNTO, e nao e efeito colateral: ate aqui um descanso que
-- atravessava 31 de dezembro era recusado, e a mensagem mandava combinar dois
-- -- um em cada ano. Aquilo existia porque a conta era anual: o mesmo pedido
-- viraria duas contas de saldo diferentes. Com o saldo corrido nao ha duas
-- contas. Sao cinco dias, e o ano em que caem nao muda nada. O cenario da
-- bateria que provava a recusa ficou, virado do avesso.
--
-- O PRIMEIRO CICLO COMECA NA ENTRADA, e nao no fim dos primeiros 12 meses.
-- Sao duas leituras possiveis de "a cada 12 meses soma 15": os 15 chegam no
-- comeco do ciclo, ou so depois de ele se completar. A segunda e exatamente a
-- regra do periodo aquisitivo -- quem entrou ontem nao descansa por um ano --,
-- e este produto vem andando na direcao contraria. Para inverter, e uma linha:
-- o `+ 1` em `ciclos_de_descanso()`, comentado la.

-- ---------------------------------------------------------------------------
-- PASSO 1 - A ancora do ciclo
-- ---------------------------------------------------------------------------

/**
 * Quando comecou o ciclo de 12 meses em que a pessoa esta hoje.
 *
 * A ancora e `data_admissao`. Ela e OPCIONAL na ficha desde a 0002, e uma
 * ficha sem ela nao pode deixar a pessoa sem saldo nenhum: cai em
 * `created_at`, que e quando a ficha nasceu. Nao e a mesma coisa, e a tela diz
 * de quando esta contando -- um numero que a pessoa nao sabe de onde veio e um
 * numero em que ela nao confia.
 */
create or replace function public.inicio_do_ciclo(p_user_id uuid)
returns date
language plpgsql
stable
as $$
declare
  ancora  date;
  ciclos  integer;
begin
  select coalesce(data_admissao, created_at::date) into ancora
    from public.team_members where user_id = p_user_id;

  if ancora is null then
    return null;
  end if;

  -- Quantos aniversarios da ancora ja passaram. O ciclo atual comecou no
  -- ultimo deles.
  --
  -- `age()` E NAO UMA DIVISAO DE DIAS. Dividir a diferenca por 365 erra em
  -- todo ano bissexto e em toda ancora de 29 de fevereiro: a pessoa que
  -- entrou em 01/03/2024 completaria o ciclo um dia antes em 2028. `age()`
  -- conta calendario de verdade, que e o que "doze meses" quer dizer.
  ciclos := extract(year from age(current_date, ancora))::integer;

  return (ancora + make_interval(years => ciclos))::date;
end;
$$;

/**
 * Quantos ciclos de 12 meses a pessoa ja alcancou, contando o atual.
 *
 * Quem entrou hoje esta no ciclo 1. Quem entrou ha treze meses esta no 2.
 *
 * O `+ 1` E A DECISAO: ele e o que da os 15 dias no COMECO do ciclo, e nao no
 * fim. Sem ele, quem entrou ontem fica doze meses sem poder descansar, que e a
 * regra do periodo aquisitivo da CLT. Para inverter a decisao, tire o `+ 1` --
 * e so isto, aqui, uma vez.
 */
create or replace function public.ciclos_de_descanso(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  ancora date;
begin
  select coalesce(data_admissao, created_at::date) into ancora
    from public.team_members where user_id = p_user_id;

  if ancora is null then
    return 1;
  end if;

  -- Entrada com data futura (cadastro feito antes de a pessoa comecar) conta
  -- como o primeiro ciclo, e nao como zero: a ficha existe, a pessoa ja tem
  -- periodo combinavel, e um saldo negativo na tela de quem acabou de chegar
  -- e um erro que ninguem sabe explicar.
  if ancora > current_date then
    return 1;
  end if;

  return extract(year from age(current_date, ancora))::integer + 1;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O saldo deixa de ter ano
-- ---------------------------------------------------------------------------

-- As duas funcoes antigas recebiam o ano. Nao da para so trocar o corpo: a
-- aridade muda, e `create or replace` nao troca assinatura -- cria uma segunda
-- funcao com o mesmo nome. Duas `saldo_de_ferias` no banco e a garantia de que
-- alguma consulta vai chamar a errada.
drop function if exists public.saldo_de_ferias(uuid, integer);
drop function if exists public.parcelas_de_ferias(uuid, integer);

/**
 * Saldo de descanso: tudo o que os ciclos ja concederam, menos tudo o que a
 * pessoa ja tirou.
 *
 * O NOME CONTINUA `saldo_de_ferias`, e e a mesma decisao da 0016: nome de
 * funcao e de coluna ficaram no vocabulario antigo de proposito, porque
 * renomear objeto em uso e migration arriscada e ninguem que usa o sistema ve
 * esses nomes. Quem le o schema ve o vocabulario antigo; quem le a tela, nao.
 *
 * Pendente conta como usado. Sem isso a pessoa proporia 15 dias duas vezes
 * enquanto o primeiro espera retorno, e o socio concordaria com os dois sem
 * ver o problema.
 */
create or replace function public.saldo_de_ferias(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  por_ciclo integer;
  ciclos    integer;
  usado     integer;
begin
  select coalesce(dias_ferias_ano, 15) into por_ciclo
    from public.team_members where user_id = p_user_id;

  if por_ciclo is null then
    por_ciclo := 15;
  end if;

  ciclos := public.ciclos_de_descanso(p_user_id);

  -- SEM FILTRO DE ANO, e e a mudanca inteira: o que a pessoa tirou em 2025
  -- continua contando em 2027, porque os dias de 2025 tambem continuam
  -- somados do outro lado da conta.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada');

  return (por_ciclo * ciclos) - usado;
end;
$$;

/**
 * Quantas parcelas de descanso a pessoa ja usou, na vida.
 *
 * O limite acompanha: cada ciclo soma `max_parcelas_ferias`. Quem esta no
 * terceiro ciclo com duas por ciclo pode ter partido o descanso seis vezes.
 */
create or replace function public.parcelas_de_ferias(p_user_id uuid)
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
     and status in ('pendente', 'aprovada');

  return coalesce(quantas, 0);
end;
$$;

/** Quantas parcelas os ciclos ja concederam. */
create or replace function public.parcelas_concedidas(p_user_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  por_ciclo integer;
begin
  select coalesce(max_parcelas_ferias, 2) into por_ciclo
    from public.team_members where user_id = p_user_id;

  if por_ciclo is null then
    por_ciclo := 2;
  end if;

  return por_ciclo * public.ciclos_de_descanso(p_user_id);
end;
$$;

/**
 * Tudo o que a tela do saldo precisa, numa chamada so.
 *
 * A tela mostrava o saldo somando no navegador a partir da lista de pedidos, e
 * o banco calculava a mesma coisa por outro caminho para validar. Duas contas
 * com regras parecidas e o comeco de duas verdades -- e no modelo de ciclo a
 * conta depende da data de entrada, que a lista de pedidos nem carrega. Agora
 * a tela pergunta, e e a mesma resposta que a trava usa.
 */
create or replace function public.descanso_do_ciclo(p_user_id uuid)
returns table (
  inicio_do_ciclo       date,
  ciclos                integer,
  dias_concedidos       integer,
  dias_usados           integer,
  saldo                 integer,
  parcelas_concedidas   integer,
  parcelas_usadas       integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  por_ciclo integer;
begin
  -- `security definer` e `is_staff()` na porta: a tela de uma pessoa mostra o
  -- saldo dela, e a fila do socio mostra o de quem propos. Sem definer, a
  -- funcao dependeria de `team_members` ser legivel por quem pergunta.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Saldo de descanso e da equipe.';
  end if;

  select coalesce(dias_ferias_ano, 15) into por_ciclo
    from public.team_members where user_id = p_user_id;

  return query
  select
    public.inicio_do_ciclo(p_user_id),
    public.ciclos_de_descanso(p_user_id),
    coalesce(por_ciclo, 15) * public.ciclos_de_descanso(p_user_id),
    (coalesce(por_ciclo, 15) * public.ciclos_de_descanso(p_user_id))
      - public.saldo_de_ferias(p_user_id),
    public.saldo_de_ferias(p_user_id),
    public.parcelas_concedidas(p_user_id),
    public.parcelas_de_ferias(p_user_id);
end;
$$;

revoke all on function public.descanso_do_ciclo(uuid) from public;
grant execute on function public.descanso_do_ciclo(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 3 - A validacao acompanha
-- ---------------------------------------------------------------------------

-- DE NOVO A PARTIR DA VERSAO MAIS RECENTE, que e a da 0037. A funcao ja foi
-- reescrita cinco vezes (0011, 0016, 0018, 0024, 0037), e escrever esta a
-- partir de uma versao antiga ja ressuscitou o vocabulario da CLT uma vez --
-- a bateria pegou, e foi o unico jeito de descobrir. O que muda aqui e a
-- conta do saldo e a saida do `ano_referencia`; as frases sao as que ja
-- valiam.
create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  contratado integer;
  parcelas   integer;
  usado      integer;
  sobrepoe   integer;
  admissao   date;
begin
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

    -- Saldo negativo NAO trava o lancamento, e continua sendo escolha: o
    -- periodo aconteceu de verdade, e recusar o registro nao o desfaz. Quem
    -- lanca ve o saldo resultante na tela antes de confirmar.
    return new;
  end if;

  -- PEDIDO. O caminho de sempre, e as travas de sempre -- agora contra o
  -- saldo do ciclo em vez do saldo do ano.
  if new.tipo <> 'ferias' then
    return new;
  end if;

  -- A trava do periodo entre dois anos saiu daqui. O porque esta no cabecalho
  -- desta migration -- e ele mora LA e nao aqui de proposito: a bateria varre
  -- o corpo das funcoes atras das frases que sairam do produto, e `prosrc`
  -- inclui os comentarios. Uma explicacao que cite a frase morta faz a
  -- varredura acusar o texto que a justifica. E a mesma razao pela qual a
  -- explicacao do vocabulario do Full Days mora no CLAUDE.md, fora de `src/`.

  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15) * public.ciclos_de_descanso(new.user_id);
  parcelas   := public.parcelas_concedidas(new.user_id);

  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and id is distinct from new.id;

  -- A FRASE DIZ A CONTA INTEIRA, como a da 0024 dizia: quantos o contrato da,
  -- quantos ja estao comprometidos e quantos sobram. Quem leva um "nao" sem os
  -- tres numeros vai conferir por fora e achar que o sistema errou. O que
  -- mudou foi "por ano" -> "a cada 12 meses", e o "em %s" que nomeava o ano
  -- saiu junto com o ano.
  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de descanso a cada 12 meses em contrato, contados corridos. Voce ja tem %s comprometidos, entao sobram %s.',
        coalesce((select dias_ferias_ano from public.team_members where user_id = new.user_id), 15),
        usado, contratado - usado
      );
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and id is distinct from new.id) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'O descanso pode ser partido em ate %s vezes a cada 12 meses, e voce ja usou as %s que tem.',
        coalesce((select max_parcelas_ferias from public.team_members where user_id = new.user_id), 2),
        parcelas
      );
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - `ano_referencia` perde o emprego, e some
-- ---------------------------------------------------------------------------

-- Ela existia para dizer a QUE ano um periodo pertencia, porque havia uma
-- conta por ano. Com o saldo corrido nao ha atribuicao a fazer: os dias
-- contam, e o ciclo em que caem nao muda nada.
--
-- As tres funcoes que a recebiam perdem o parametro. Como no PASSO 2, e
-- `drop` e nao `replace`: aridade diferente cria uma segunda funcao com o
-- mesmo nome, e a chamada antiga continuaria resolvendo para ela.
drop function if exists public.lancar_periodo(uuid, public.hr_tipo, date, date, integer, text, public.hr_origem);
drop function if exists public.corrigir_lancamento(uuid, date, date, integer, text);

-- O TRIGGER PRECISA SAIR DA FRENTE PRIMEIRO, e e uma dependencia que nao
-- aparece lendo o codigo: `hr_requests_validar` e `before update OF <colunas>`,
-- e `ano_referencia` esta na lista. O Postgres recusa apagar coluna que uma
-- lista dessas cita -- "cannot drop column because other objects depend on
-- it", apontando o trigger. O corpo da funcao nao entra nisso: plpgsql nao e
-- analisado para dependencia. E a lista do `create trigger`.
drop trigger if exists hr_requests_validar on public.hr_requests;
create trigger hr_requests_validar
  before insert or update of
    data_inicio, data_fim, dias_uteis, tipo, status, origem
  on public.hr_requests
  for each row
  when (new.status in ('pendente', 'aprovada'))
  execute function public.validar_solicitacao();

drop index if exists public.hr_requests_saldo_idx;
alter table public.hr_requests drop column if exists ano_referencia;

create index if not exists hr_requests_saldo_idx
  on public.hr_requests (user_id, tipo, status);

create or replace function public.lancar_periodo(
  p_user_id        uuid,
  p_tipo           public.hr_tipo,
  p_data_inicio    date,
  p_data_fim       date,
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
    status, origem, aprovado_por, decidido_em, lancado_por, lancado_em
  ) values (
    p_user_id, p_tipo, p_data_inicio, p_data_fim, dias, p_observacao,
    'aprovada', p_origem, quem, now(), quem, now()
  )
  returning id into novo;

  perform public.pintar_presenca_do_pedido(novo, quem);

  return novo;
end;
$$;

revoke all on function public.lancar_periodo(uuid, public.hr_tipo, date, date, text, public.hr_origem) from public;
grant execute on function public.lancar_periodo(uuid, public.hr_tipo, date, date, text, public.hr_origem) to authenticated;

create or replace function public.corrigir_lancamento(
  p_request_id     uuid,
  p_data_inicio    date,
  p_data_fim       date,
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
     set data_inicio = p_data_inicio,
         data_fim    = p_data_fim,
         dias_uteis  = public.dias_do_pedido(pedido.tipo, p_data_inicio, p_data_fim),
         motivo      = coalesce(p_observacao, motivo)
   where id = p_request_id;

  perform public.pintar_presenca_do_pedido(p_request_id, quem);
end;
$$;

revoke all on function public.corrigir_lancamento(uuid, date, date, text) from public;
grant execute on function public.corrigir_lancamento(uuid, date, date, text) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 5 - Os comentarios das colunas dizem a verdade nova
-- ---------------------------------------------------------------------------

-- Os NOMES continuam `dias_ferias_ano` e `max_parcelas_ferias`, pela mesma
-- razao de sempre: renomear coluna em uso e migration arriscada e ninguem que
-- usa o sistema ve esses nomes. O que nao pode ficar velho e o comentario --
-- e ele agora diz "ano" para uma coisa que nao e mais por ano, que e pior que
-- nao ter comentario nenhum.
comment on column public.team_members.dias_ferias_ano is
  'Dias de descanso concedidos A CADA CICLO DE 12 MESES contado da entrada da pessoa (padrao 15). O nome ficou de quando a conta era por ano civil.';

comment on column public.team_members.max_parcelas_ferias is
  'Em quantas vezes o descanso de cada ciclo de 12 meses pode ser partido (padrao 2). O nome ficou de quando a conta era por ano civil.';

comment on column public.team_members.data_admissao is
  'Entrada da pessoa na equipe. E a ANCORA do ciclo de descanso: sem ela o ciclo conta de created_at.';
