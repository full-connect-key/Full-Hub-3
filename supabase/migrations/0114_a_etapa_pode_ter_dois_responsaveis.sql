-- ============================================================================
-- 0114 — A ETAPA PODE TER DOIS RESPONSAVEIS
--
-- Decisao do usuario: *"Preciso que seja possivel colocar dois responsaveis na
-- sub tarefa, se necessario"*.
--
-- ----------------------------------------------------------------------------
-- `subtasks.responsavel_id` CONTINUA, E ISSO NAO E MEIA MUDANCA.
--
-- Ela e lida por 524 linhas: 27 arquivos de `src/`, 16 migrations e a bateria
-- inteira. Trocar a coluna por um array seria a 0082 (`posts.plataforma` ->
-- `plataformas`) multiplicada por dez — e aquela migration, que o CLAUDE.md
-- descreve como mexendo na "coluna mais lida do modulo", teve um decimo deste
-- alcance.
--
-- A forma e a que a 0113 acabou de provar: **a coluna passa a ser a PRIMEIRA
-- pessoa, e a tabela de vinculo e quem manda.** Tudo o que le `responsavel_id`
-- continua certo — ele aponta para alguem que de fato faz a etapa —, e quem
-- precisa das DUAS le a tabela.
--
-- E a assimetria e declarada, nao escondida. O que passou a enxergar as duas:
--
--   * a CARGA (`disponibilidade_bruta`, 0081) — PASSO 4;
--   * "Minhas Tasks" — a etapa aparece para as duas pessoas.
--
-- O que continua olhando so a primeira, e o motivo de cada um:
--
--   * o AVATAR do board e do calendario: a celula tem ~90px e dois circulos
--     empurram o titulo para fora. A pilha de avatares ja existe e e de quem
--     esta na DEMANDA;
--   * o aviso de recesso (`aviso_do_responsavel`) e o descarte de pessoa
--     desligada (`pessoa_desligada`) na geracao da recorrencia: eles decidem
--     o que GRAVAR em `responsavel_id`, e a segunda pessoa entra depois, pela
--     tela;
--   * o espelho da campanha (0080) e a corrente do social (0088): os dois
--     copiam `responsavel_id` de um lado para o outro, e um par de listas
--     espelhadas e onde as duas verdades comecam a divergir.
--
-- Nenhum deles e um furo: sao decisoes de onde a segunda pessoa aparece, e
-- cada uma vira uma linha no dia em que alguem pedir.
-- ----------------------------------------------------------------------------

-- MEDIDO COM SEIS MUTACOES, sobre 2307 cenarios:
--
--   a etapa que ganha dono nao ganha a linha ............ derruba 27
--   a coluna deixa de acompanhar a tabela ............... derruba  5
--   trocar o responsavel ACRESCENTA em vez de trocar .... derruba  3
--   a carga volta a ler a coluna ........................ derruba  2
--   a conversao do PASSO 2 nao roda ..................... derruba  0
--   o gatilho do PASSO 3 morde o proprio cascade ........ derruba  0
--
-- OS DOIS ZEROS SAO DIFERENTES, e os dois ficam ditos:
--
-- O PRIMEIRO e falta de ponto de medicao, como o `where` da capacidade na
-- 0081. A conversao so alcanca linhas anteriores a migration, e a bateria nao
-- tem esse ponto -- `01_permissoes_e_fluxo.sql` apaga `subtasks` na linha 12,
-- e toda etapa que os cenarios veem nasce depois, pelo gatilho. Quem confere a
-- conversao e o `select` no fim deste arquivo, rodado no banco de verdade.
--
-- O SEGUNDO e porque aquela guarda NAO E UMA TRAVA, e e economia: sem ela, o
-- `update` roda uma vez por linha em todo apagamento de etapa -- e apagar uma
-- demanda com sessenta etapas sao sessenta updates que nao mudam nada. Ela nao
-- recusa, ao contrario da guarda equivalente na 0113, porque aqui nao ha
-- `raise`: a etapa ja se foi, e o `update` simplesmente nao acha linha.
--
-- ----------------------------------------------------------------------------
-- PASSO 1 — a tabela
-- ----------------------------------------------------------------------------

create table if not exists public.subtask_responsaveis (
  subtask_id uuid not null references public.subtasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subtask_id, user_id)
);

comment on table public.subtask_responsaveis is
  'Quem faz esta etapa. `subtasks.responsavel_id` e a PRIMEIRA pessoa, mantida em dia por gatilho; esta tabela e quem manda. A chave composta impede a mesma pessoa duas vezes -- sem ela a carga dela contaria a etapa em dobro.';

create index if not exists subtask_responsaveis_pessoa_idx
  on public.subtask_responsaveis (user_id);

alter table public.subtask_responsaveis enable row level security;

-- QUEM LE E QUEM ESCREVE SAO OS MESMOS DE `subtasks`, e tem de ser: uma
-- policy mais larga aqui daria a quem nao pode editar a etapa o poder de se
-- pôr nela -- e com isso a etapa apareceria no "Minhas Tasks" de quem a
-- agencia nao distribuiu. Uma mais estreita esconderia da pessoa que faz a
-- etapa quem mais esta nela.
drop policy if exists subtask_responsaveis_select on public.subtask_responsaveis;
create policy subtask_responsaveis_select on public.subtask_responsaveis
  for select using (
    exists (select 1 from public.subtasks s where s.id = subtask_id)
  );

drop policy if exists subtask_responsaveis_write on public.subtask_responsaveis;
create policy subtask_responsaveis_write on public.subtask_responsaveis
  for all using (
    exists (
      select 1 from public.subtasks s
       join public.tasks t on t.id = s.task_id
      where s.id = subtask_id and public.pode_editar_task(t.id)
    )
  ) with check (
    exists (
      select 1 from public.subtasks s
       join public.tasks t on t.id = s.task_id
      where s.id = subtask_id and public.pode_editar_task(t.id)
    )
  );

-- ----------------------------------------------------------------------------
-- PASSO 2 — a conversao
--
-- Toda etapa que ja tem dono ganha a linha dela. Sem isto, a carga do PASSO 4
-- devolve ZERO para a agencia inteira na madrugada seguinte -- e zero e uma
-- resposta plausivel, que e o pior jeito de uma migration falhar.
-- ----------------------------------------------------------------------------

insert into public.subtask_responsaveis (subtask_id, user_id)
select id, responsavel_id from public.subtasks where responsavel_id is not null
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- PASSO 3 — os dois lados se mantem em dia
-- ----------------------------------------------------------------------------

-- A ETAPA QUE GANHA DONO GANHA A LINHA. Sem este gatilho, a etapa criada por
-- qualquer caminho que nao conheca a tabela -- a materializacao do workflow, a
-- rotina da recorrencia, o espelho da campanha, o `insert` colado no SQL
-- Editor -- nasceria com `responsavel_id` preenchido e carga ZERO.
create or replace function public.subtarefa_vincula_o_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.responsavel_id is not null then
    insert into public.subtask_responsaveis (subtask_id, user_id)
    values (new.id, new.responsavel_id)
    on conflict do nothing;
  end if;

  -- TROCAR O RESPONSAVEL TIRA O ANTIGO, e e o que faz o seletor de uma pessoa
  -- continuar significando o que ele sempre significou. Sem isto, trocar a
  -- pessoa na tela ACRESCENTARIA uma -- e quem saiu continuaria com a etapa no
  -- "Minhas Tasks" dela, sem nada na tela dizendo por que.
  if tg_op = 'UPDATE'
     and old.responsavel_id is not null
     and old.responsavel_id is distinct from new.responsavel_id then
    delete from public.subtask_responsaveis
     where subtask_id = new.id and user_id = old.responsavel_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists subtasks_vincula_o_responsavel on public.subtasks;
create trigger subtasks_vincula_o_responsavel
  after insert or update of responsavel_id on public.subtasks
  for each row execute function public.subtarefa_vincula_o_responsavel();

-- E `responsavel_id` ACOMPANHA A TABELA.
--
-- Ela e lida por 524 linhas, e precisa continuar apontando para alguem que de
-- fato faz a etapa. Tirando a primeira pessoa pela tabela, a coluna passa a
-- ser a que sobrou; tirando a ultima, ela fica nula -- que e o estado de
-- "etapa sem dono", que o produto ja desenha.
create or replace function public.subtarefa_acompanha_os_responsaveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  alvo uuid;
begin
  -- A ETAPA ESTA INDO EMBORA? Entao nao ha o que acertar. `subtask_id` e
  -- `on delete cascade`, e sem esta linha o gatilho tentaria escrever numa
  -- linha de `subtasks` que o Postgres esta apagando. E a guarda que a 0113
  -- pagou com a bateria morrendo no meio de um `delete`.
  if not exists (select 1 from public.subtasks where id = old.subtask_id) then
    return old;
  end if;

  select r.user_id into alvo
    from public.subtask_responsaveis r
   where r.subtask_id = old.subtask_id
   order by r.created_at, r.user_id
   limit 1;

  update public.subtasks
     set responsavel_id = alvo
   where id = old.subtask_id
     and responsavel_id = old.user_id;

  return old;
end;
$fn$;

drop trigger if exists subtask_responsaveis_acompanha on public.subtask_responsaveis;
create trigger subtask_responsaveis_acompanha
  after delete on public.subtask_responsaveis
  for each row execute function public.subtarefa_acompanha_os_responsaveis();

-- ----------------------------------------------------------------------------
-- PASSO 4 — a carga conta para as DUAS
--
-- E UMA LINHA, e e a unica razao pela qual esta migration cabe num arquivo.
-- `disponibilidade_bruta()` (0081) filtrava `s.responsavel_id = p_user_id`;
-- passa a perguntar a tabela.
--
-- **A ESTIMATIVA CONTA INTEIRA PARA CADA UMA, e nao dividida.** Duas pessoas
-- numa etapa de 8h nao sao duas de 4h: elas estao as duas ocupadas com aquilo
-- naquele periodo, e e isso que a faixa de disponibilidade existe para
-- mostrar a quem vai datar a proxima. Dividir faria as duas parecerem meio
-- livres, que e o jeito mais facil de sobrecarregar alguem sem perceber --
-- e a regra do modulo e "sobrecarga avisa, nunca recusa", entao o lado certo
-- do erro e contar demais.
--
-- *Se um dia a agencia quiser dividir, e uma divisao por
-- `count(*) over (partition by s.id)` aqui, e mais nada.*
--
-- A FUNCAO E COPIADA INTEIRA da 0081, pela razao de sempre: `create or
-- replace` parte do texto que se escreve agora, e a 0030 ja perdeu um bloco
-- inteiro assim.
-- ----------------------------------------------------------------------------

create or replace function public.disponibilidade_bruta(
  p_user_id            uuid,
  p_inicio             date,
  p_fim                date,
  p_modo               text    default 'distribuida',
  p_incluir_concluidas boolean default false,
  p_daqui_pra_frente   boolean default false
)
returns table (
  data                date,
  dia_util            boolean,
  capacidade_minutos  integer,
  indisponivel_motivo text,
  carga_minutos       integer,
  etapas_count        integer,
  etapas_sem_estimativa integer,
  entregas_count      integer,
  entregas_minutos    integer,
  ocupacao_pct        integer,
  evento              text,
  itens               jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $funcao$
declare
  cap integer;
begin
  -- O TETO E DE 120 DIAS, pela razao do teto de 62 de `carga_da_equipe()`: a
  -- tela pede um mes por vez e nunca o ano, e sem o teto um parametro torto
  -- na URL viraria uma varredura de trezentos e sessenta e cinco dias.
  if p_fim - p_inicio > 120 then
    raise exception 'Período longo demais para a disponibilidade: % dias.', p_fim - p_inicio
      using hint = 'O calendário pede um mês por vez.';
  end if;

  -- O 540 AQUI E PARA QUEM NAO TEM FICHA DE EQUIPE, e nao o default da
  -- coluna -- aquele e do PASSO 0. Sao dois casos diferentes com o mesmo
  -- numero, pela razao de `PRAZO_DE_APROVACAO_PADRAO`: um decide o que fica
  -- gravado, o outro decide o que a conta usa para quem nao tem linha.
  select coalesce(tm.capacidade_minutos_dia, 540) into cap
    from public.team_members tm where tm.user_id = p_user_id;
  cap := coalesce(cap, 540);

  return query
  with dias as (
    select g::date as dia from generate_series(p_inicio, p_fim, interval '1 day') g
  ),
  -- AS ETAPAS EM ABERTO, com a janela ja resolvida.
  etapas as (
    select
      s.id,
      s.titulo,
      c.nome_empresa as cliente,
      s.prazo,
      (s.estimativa_minutos is null) as estimada,
      -- TRES HORAS PARA QUEM NAO TEM ESTIMATIVA, e o numero mora so aqui
      -- (PASSO 1). Tres etapas em branco enchem um dia de 540.
      coalesce(s.estimativa_minutos, 180) as minutos,
      greatest(
        -- O CHAO DA JANELA. Sem projetar, ela e o periodo que a etapa
        -- declara: `data_inicio` ate `prazo`, e so o prazo quando nao ha
        -- inicio -- que e o recorte que `carga_do_dia()` sempre teve.
        --
        -- E `t.data_inicio` NAO ENTRA AQUI, e tirar isso foi conserto de bug
        -- e nao ajuste de gosto. A primeira versao caia nele quando a etapa
        -- nao tinha inicio proprio, e `tasks.data_inicio` e DERIVADO das
        -- etapas desde a 0028: ele e o menor prazo da demanda inteira. A
        -- etapa herdava a janela da DEMANDA, entao quatro etapas datadas ao
        -- longo de um mes passavam a cobrir o mes todo cada uma -- a carga de
        -- um dia somava trinta e oito etapas em vez de quatro, e foi assim
        -- que a bateria achou. E a mesma conta dobrada que a 0083 desfez um
        -- nivel acima: o inicio do agrupador nao e o inicio do trabalho.
        coalesce(s.data_inicio, s.prazo),
        -- HOJE, so olhando para a frente. Projetando, uma etapa vencida e
        -- trabalho de HOJE: ela continua pendente, e escondê-la e o jeito
        -- mais facil de sobrecarregar alguem sem perceber.
        case when p_daqui_pra_frente then current_date else '-infinity'::date end,
        -- A DEPENDENCIA EM ABERTO EMPURRA O COMECO, pela mesma razao:
        -- enquanto ela nao fecha a etapa nao sai de `nao_iniciada` (0007), e
        -- contar carga antes do prazo dela e prometer trabalho que o banco
        -- recusa. Olhando para tras isso nao se pergunta -- o que aconteceu
        -- aconteceu.
        case when p_daqui_pra_frente then coalesce((
          select max(dd.prazo)
            from public.subtask_dependencies dep
            join public.subtasks dd on dd.id = dep.depende_de_id
           where dep.subtask_id = s.id and dd.status <> 'concluida'
        ), '-infinity'::date) else '-infinity'::date end
      ) as comeca
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
      left join public.clients c on c.id = t.client_id
     -- A TABELA, E NAO A COLUNA (0114). Ver o cabecalho do PASSO 4.
     where exists (select 1 from public.subtask_responsaveis sr
                    where sr.subtask_id = s.id and sr.user_id = p_user_id)
       -- RASCUNHO FICA FORA DE TODO INDICADOR (0028), e e `publicada_em` e
       -- nao um status: `rascunho` nao e valor do enum.
       and t.publicada_em is not null
       and (p_incluir_concluidas or s.status <> 'concluida')
       and s.prazo is not null
       -- Agrupadora nao e unidade de trabalho: quem mede sao as filhas (0022).
       and not public.subtask_eh_agrupadora(s.id)
  ),
  -- A JANELA DE CADA ETAPA. A VENCIDA CAI EM HOJE: `comeca` ja e no minimo
  -- `current_date`, entao quando o prazo passou os dois se encontram e a
  -- etapa ocupa o dia de hoje inteiro -- que e a verdade, ela continua
  -- pendente. Esconde-la seria o jeito mais facil de sobrecarregar alguem
  -- sem perceber.
  janelas as (
    select e.*, greatest(e.prazo, e.comeca) as termina,
           public.dias_uteis(e.comeca, greatest(e.prazo, e.comeca)) as uteis
      from etapas e
  ),
  fatias as (
    select j.id, j.titulo, j.cliente, j.prazo, j.estimada, j.minutos, f.dia, f.fatia
      from janelas j
      cross join lateral (
        -- O caminho normal: uma fatia por dia util da janela.
        select g::date as dia, (j.minutos::numeric / j.uteis) as fatia
          from generate_series(j.comeca, j.termina, interval '1 day') g
         where j.uteis > 0
           and extract(isodow from g) < 6
           and not exists (select 1 from public.holidays h where h.data = g::date)
        union all
        -- JANELA SEM NENHUM DIA UTIL -- um prazo de sabado com comeco no
        -- mesmo sabado. Sem este ramo a etapa sumiria da conta por divisao
        -- por zero, que e o pior desfecho: ela existe e ninguem a ve.
        select j.termina, j.minutos::numeric where j.uteis = 0
      ) f
  ),
  -- O que vence em cada dia, independente do modo: e a outra pergunta.
  entregas as (
    select j.prazo as dia, count(*)::integer as qtd, sum(j.minutos)::integer as mins
      from janelas j
     group by j.prazo
  ),
  carga as (
    select f.dia,
           sum(f.fatia) as minutos,
           count(*)::integer as qtd,
           count(*) filter (where f.estimada)::integer as sem_estimativa,
           (
             select jsonb_agg(x)
               from (
                 select jsonb_build_object(
                          'id', f2.id, 'titulo', f2.titulo, 'cliente', f2.cliente,
                          'minutos', round(f2.fatia)::integer, 'estimada', f2.estimada,
                          'prazo', f2.prazo
                        ) as x
                   from fatias f2
                  where f2.dia = f.dia
                  order by f2.fatia desc
                  limit 5
               ) t
           ) as top
      from fatias f
     group by f.dia
  ),
  -- O EVENTO REDUZ A CAPACIDADE, e o de dia inteiro zera. Quem participa de
  -- uma convencao de tres dias nao tem oito horas livres nesses dias, e um
  -- calendario que diz que tem manda trabalho para quem nao esta na mesa.
  eventos as (
    select g::date as dia,
           min(ev.nome) as nome,
           bool_or(ev.dia_inteiro) as inteiro,
           coalesce(sum(
             case when ev.dia_inteiro then 0
                  else extract(epoch from (ev.hora_fim - ev.hora_inicio)) / 60
             end
           ), 0)::integer as minutos
      from public.events ev
      join public.event_participants ep on ep.event_id = ev.id and ep.user_id = p_user_id
      cross join generate_series(ev.data_inicio, ev.data_fim, interval '1 day') g
     where g::date between p_inicio and p_fim
     group by g::date
  )
  select
    d.dia,
    uteis.eh,
    capac.minutos,
    motivo.chave,
    round(coalesce(
      case when p_modo = 'entregas' then ent.mins::numeric else cg.minutos end, 0
    ))::integer,
    coalesce(cg.qtd, 0),
    coalesce(cg.sem_estimativa, 0),
    coalesce(ent.qtd, 0),
    coalesce(ent.mins, 0),
    -- SEM CAPACIDADE NAO HA PORCENTAGEM, e `null` e a resposta honesta: um
    -- dia de descanso com carga nao esta "a 300%", ele esta em conflito. Quem
    -- desenha isso le `indisponivel_motivo` primeiro.
    case when capac.minutos > 0
         then round(coalesce(
                case when p_modo = 'entregas' then ent.mins::numeric else cg.minutos end, 0
              ) * 100 / capac.minutos)::integer
    end,
    evt.nome,
    coalesce(cg.top, '[]'::jsonb)
  from dias d
  cross join lateral (
    select (extract(isodow from d.dia) < 6
            and not exists (select 1 from public.holidays h where h.data = d.dia)) as eh
  ) uteis
  left join eventos evt on evt.dia = d.dia
  cross join lateral (
    -- A PRECEDENCIA: o que a pessoa combinou vem antes do calendario. Quem
    -- esta de descanso num feriado le "descanso", que e o fato dela.
    select case
      when pres.status is not null then pres.status::text
      when extract(isodow from d.dia) >= 6 then 'fim_de_semana'
      when exists (select 1 from public.holidays h where h.data = d.dia) then 'feriado'
      when evt.inteiro then 'evento'
    end as chave
    from (
      select tp.status from public.team_presence tp
       where tp.user_id = p_user_id and tp.data = d.dia
         and tp.status in ('ferias', 'licenca', 'ausente', 'folga')
       limit 1
    ) pres
    right join (select 1) um on true
  ) motivo
  cross join lateral (
    select case
      when not uteis.eh then 0
      when motivo.chave is not null and motivo.chave <> 'evento' then 0
      when coalesce(evt.inteiro, false) then 0
      else greatest(cap - coalesce(evt.minutos, 0), 0)
    end as minutos
  ) capac
  left join carga cg on cg.dia = d.dia
  left join entregas ent on ent.dia = d.dia
  order by d.dia;
end
$funcao$;

-- ----------------------------------------------------------------------------
-- PASSO 5 — quem faz a etapa, num lugar so
-- ----------------------------------------------------------------------------

create or replace function public.responsaveis_da_subtarefa(p_subtask_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  return query
    select r.user_id
      from public.subtask_responsaveis r
     where r.subtask_id = p_subtask_id
     order by r.created_at, r.user_id;
end;
$fn$;

comment on function public.responsaveis_da_subtarefa(uuid) is
  'Quem faz a etapa, na ordem em que entrou. Um lugar so, porque a pergunta e feita pela tela e pela carga -- e duas respostas divergiriam no dia em que alguem acrescentasse a segunda pessoa.';

revoke all on function public.responsaveis_da_subtarefa(uuid) from public;
grant execute on function public.responsaveis_da_subtarefa(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- A CONFERENCIA, porque a bateria NAO consegue medir o PASSO 2.
--
-- A conversao so alcanca linhas que existiam ANTES da migration, e na bateria
-- nao existe esse ponto: `01_permissoes_e_fluxo.sql` chama `teste.limpar()` na
-- linha 12, que apaga `subtasks` inteira. Toda etapa que os cenarios veem
-- nasce DEPOIS, pelo gatilho do PASSO 3 -- entao tirar o `insert` do PASSO 2
-- nao derruba cenario nenhum, e o zero esta medido e dito, como o `where` da
-- capacidade na 0081.
--
-- O que resta e conferir aqui, no banco de verdade, antes e depois. Esta
-- consulta tem de devolver ZERO: toda etapa com dono tem a linha dela.
-- ----------------------------------------------------------------------------

select count(*) as etapas_com_dono_e_sem_linha
  from public.subtasks s
 where s.responsavel_id is not null
   and not exists (
     select 1 from public.subtask_responsaveis r
      where r.subtask_id = s.id and r.user_id = s.responsavel_id
   );
