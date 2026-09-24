-- 0040 — Demandas recorrentes (Sprint 3D)
--
-- Stories diarios, relatorio semanal, fechamento mensal: demanda que se repete
-- nao se digita toda vez. A pessoa configura uma vez, e a rotina gera.
--
-- TRES COISAS DO PEDIDO NAO BATEM COM O PROJETO, e ficam registradas aqui
-- porque quem ler o schema vai procurar por elas:
--
--   1. O pedido diz `tasks.status = 'rascunho'`. NAO EXISTE esse valor no
--      enum, e a ausencia e decisao da 0028, com tres motivos escritos la:
--      um valor de enum nao pode ser USADO na mesma transacao em que nasce
--      (a migration falharia no SQL Editor); `rascunho` e estado do ciclo de
--      vida e nao do trabalho, entao entraria no seletor dos sete status e
--      viraria coluna no board; e `publicada_em` ja responde as duas
--      perguntas. Aqui `gerar_como_rascunho` grava `publicada_em = null`.
--
--   2. O pedido cita `activity_log`. A tabela de log deste projeto e
--      `task_history` (migration 0007) -- e e por task, que e o que esta
--      geracao produz.
--
--   3. O pedido chama a outra aba de "tipos de tarefa". Na interface isso se
--      chama WORKFLOW desde o Sprint 9, e `npm run check:cores` varre `src/`
--      atras do nome antigo. As TABELAS continuam `task_types` e
--      `workflow_templates`, que e a camada em ingles.
--
-- A PROTECAO MAIS IMPORTANTE DA MIGRATION e o `unique (recurrence_id,
-- chave_ocorrencia)`. Rodar a rotina duas vezes no mesmo dia nao pode criar
-- task duplicada -- e a trava nao e uma consulta antes de inserir, e sim o
-- indice: duas execucoes simultaneas passariam pelas duas consultas antes de
-- qualquer uma gravar. Por isso `gerar_ocorrencia()` grava a linha do run
-- ANTES da task, com `on conflict do nothing`, e desiste quando nao volta
-- linha. Quem perde a corrida descobre pelo indice, nao pelo relogio.

-- ---------------------------------------------------------------------------
-- PASSO 1 - Os dois modos, e a frequencia
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recorrencia_modo') then
    create type public.recorrencia_modo as enum
      ('mensal_agrupada', 'task_por_ocorrencia');
  end if;
  if not exists (select 1 from pg_type where typname = 'recorrencia_frequencia') then
    create type public.recorrencia_frequencia as enum
      ('diaria', 'semanal', 'quinzenal', 'mensal');
  end if;
end $$;

comment on type public.recorrencia_modo is
  'mensal_agrupada: uma task por mes, uma subtarefa por ocorrencia. task_por_ocorrencia: uma task inteira a cada repeticao.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.task_recurrences (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete cascade,
  nome               text not null,
  modo               public.recorrencia_modo not null default 'mensal_agrupada',
  frequencia         public.recorrencia_frequencia not null default 'diaria',

  -- 1=seg … 7=dom, como o ISO. Nulo = todos os dias que a frequencia permitir.
  dias_semana        smallint[],
  dia_mes            smallint,
  pular_feriados     boolean not null default true,

  data_inicio        date not null,
  data_fim           date,
  antecedencia_dias  integer not null default 5,

  gerar_como_rascunho boolean not null default false,
  modelo             jsonb not null,
  task_type_id       uuid references public.task_types (id) on delete set null,

  ativo              boolean not null default true,
  ultima_geracao_em  timestamptz,
  proxima_geracao_em date,
  criado_por         uuid not null references public.profiles (id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint task_recurrences_periodo check (data_fim is null or data_fim >= data_inicio),
  constraint task_recurrences_antecedencia check (antecedencia_dias between 0 and 90),
  constraint task_recurrences_dia_mes check (dia_mes is null or dia_mes between 1 and 31)
);

comment on column public.task_recurrences.antecedencia_dias is
  'Quantos dias antes do inicio do periodo a task e criada. Padrao 5: a de novembro aparece no fim de outubro, e ninguem e pego de surpresa.';
comment on column public.task_recurrences.dias_semana is
  '1=segunda … 7=domingo (ISO). Nulo = todos os dias uteis da frequencia.';

create table if not exists public.recurrence_runs (
  id            uuid primary key default gen_random_uuid(),
  recurrence_id uuid not null references public.task_recurrences (id) on delete cascade,
  chave_ocorrencia text not null,
  task_id       uuid references public.tasks (id) on delete set null,
  status        text not null check (status in ('gerada', 'pulada', 'erro')),
  detalhes      jsonb,
  created_at    timestamptz not null default now(),
  unique (recurrence_id, chave_ocorrencia)
);

comment on table public.recurrence_runs is
  'Uma linha por ocorrencia tentada. O unique (recurrence_id, chave_ocorrencia) e a idempotencia: rodar a rotina duas vezes nao duplica task.';
comment on column public.recurrence_runs.task_id is
  'on delete set null: apagar a task gerada nao apaga o registro de que ela foi gerada -- senao a chave sairia junto e a rotina criaria de novo.';

alter table public.tasks
  add column if not exists recurrence_id uuid references public.task_recurrences (id) on delete set null;

comment on column public.tasks.recurrence_id is
  'De qual regra esta task saiu. `on delete set null` porque apagar a regra NAO apaga as tasks ja geradas: elas sao trabalho de verdade, com comentario e tempo lancado.';

-- A subtarefa gerada pode nascer com um aviso -- responsavel de recesso na
-- data, responsavel desligado. O aviso mora NA SUBTAREFA e nao so no run
-- porque quem precisa ve-lo e quem abrir a etapa, e ninguem abre a tela de
-- historico de geracao antes de comecar a trabalhar.
alter table public.subtasks
  add column if not exists aviso_geracao text;

comment on column public.subtasks.aviso_geracao is
  'Aviso escrito pela geracao automatica (responsavel fora na data, responsavel desligado). So a geracao escreve; a tela mostra e a pessoa resolve.';

create index if not exists task_recurrences_proxima_idx
  on public.task_recurrences (ativo, proxima_geracao_em);
create index if not exists recurrence_runs_regra_idx
  on public.recurrence_runs (recurrence_id, created_at desc);
create index if not exists tasks_recurrence_idx
  on public.tasks (recurrence_id) where recurrence_id is not null;


-- ---------------------------------------------------------------------------
-- PASSO 3 - RLS
-- ---------------------------------------------------------------------------

alter table public.task_recurrences enable row level security;
alter table public.recurrence_runs  enable row level security;

-- QUEM CRIA DEMANDA CRIA RECORRENCIA, e e a mesma pergunta que `tasks_insert`
-- faz desde a 0006: `is_atendimento()`, que e verdadeira para quem esta no
-- Atendimento OU para a gestao. Uma recorrencia e uma demanda que ainda nao
-- aconteceu; se o Atendimento pode abrir a de hoje, pode configurar a de todo
-- mes. Repetir a regra com outro criterio criaria duas respostas para a mesma
-- pergunta.
drop policy if exists task_recurrences_select on public.task_recurrences;
create policy task_recurrences_select on public.task_recurrences
  for select to authenticated using (public.is_staff());

drop policy if exists task_recurrences_insert on public.task_recurrences;
create policy task_recurrences_insert on public.task_recurrences
  for insert to authenticated with check (public.is_atendimento());

drop policy if exists task_recurrences_update on public.task_recurrences;
create policy task_recurrences_update on public.task_recurrences
  for update to authenticated
  using (public.is_atendimento()) with check (public.is_atendimento());

drop policy if exists task_recurrences_delete on public.task_recurrences;
create policy task_recurrences_delete on public.task_recurrences
  for delete to authenticated using (public.is_atendimento());

-- O HISTORICO DE EXECUCAO NAO TEM POLICY DE ESCRITA, como `notifications`: a
-- unica porta e `gerar_ocorrencia()`, que e `security definer`. Sem isso
-- daria para forjar uma chave de ocorrencia e, com ela, impedir para sempre
-- que aquele mes fosse gerado.
drop policy if exists recurrence_runs_select on public.recurrence_runs;
create policy recurrence_runs_select on public.recurrence_runs
  for select to authenticated using (public.is_staff());


-- ---------------------------------------------------------------------------
-- PASSO 4 - As variaveis do titulo
-- ---------------------------------------------------------------------------

/**
 * Resolve {CLIENTE}, {MES}, {DATA} e as outras no titulo.
 *
 * TEM UM PAR EM TYPESCRIPT (`resolverVariaveis()` em `lib/dominio/
 * recorrencias.ts`), e as duas existem de proposito -- como
 * `situacaoDoLancamento()` no Financeiro. A pre-visualizacao muda a cada
 * tecla digitada no campo do titulo, e uma chamada ao banco por tecla nao e
 * pre-visualizacao, e latencia. Esta e a que grava; aquela e a que a pessoa
 * le antes de salvar.
 */
create or replace function public.resolver_variaveis(
  p_texto     text,
  p_cliente   text,
  p_sigla     text,
  p_data      date,
  p_sequencia integer default 1
)
returns text
language plpgsql
immutable
as $$
declare
  meses text[] := array['janeiro','fevereiro','marco','abril','maio','junho',
                        'julho','agosto','setembro','outubro','novembro','dezembro'];
  semana text[] := array['segunda','terca','quarta','quinta','sexta','sabado','domingo'];
  saida text := coalesce(p_texto, '');
begin
  saida := replace(saida, '{CLIENTE}',    coalesce(p_cliente, ''));
  saida := replace(saida, '{SIGLA}',      coalesce(p_sigla, ''));
  saida := replace(saida, '{MES}',        initcap(meses[extract(month from p_data)::integer]));
  saida := replace(saida, '{MES_NUM}',    to_char(p_data, 'MM'));
  saida := replace(saida, '{ANO}',        to_char(p_data, 'YYYY'));
  saida := replace(saida, '{DATA}',       to_char(p_data, 'DD/MM'));
  saida := replace(saida, '{DIA_SEMANA}', initcap(semana[extract(isodow from p_data)::integer]));
  saida := replace(saida, '{SEMANA}',     to_char(p_data, 'IW'));
  saida := replace(saida, '{SEQ}',        p_sequencia::text);
  return saida;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 5 - As datas de uma ocorrencia
-- ---------------------------------------------------------------------------

/**
 * Os dias que a regra produz dentro de um intervalo.
 *
 * Aplica dias da semana, pula feriado quando configurado, respeita
 * `data_inicio` e `data_fim` da regra. E onde vive a diferenca entre as
 * quatro frequencias.
 *
 * `quinzenal` conta a partir da `data_inicio` DA REGRA, e nao do calendario:
 * uma regra que comeca numa terca cai de terca em terca sim, terca nao. Com o
 * calendario, "quinzenal" precisaria de um marco arbitrario -- e o marco
 * natural e o dia em que a pessoa disse que aquilo comeca.
 *
 * `mensal` com `dia_mes = 31` cai no ULTIMO DIA do mes curto, nunca pula para
 * o mes seguinte: um fechamento marcado "no fim do mes" acontece em fevereiro
 * tambem.
 */
create or replace function public.datas_da_recorrencia(
  p_recurrence_id uuid,
  p_de            date,
  p_ate           date
)
returns setof date
language plpgsql
stable
as $$
declare
  r        public.task_recurrences%rowtype;
  cursor_d date;
  limite   date;
  alvo     date;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id;
  if not found then
    return;
  end if;

  cursor_d := greatest(p_de, r.data_inicio);
  limite   := least(p_ate, coalesce(r.data_fim, p_ate));

  if r.frequencia = 'mensal' then
    -- Anda de mes em mes, e nao de dia em dia: o dia do mes e dado.
    alvo := date_trunc('month', cursor_d)::date;
    while alvo <= limite loop
      -- `least` prende o dia 31 no ultimo dia do mes curto.
      declare
        ultimo integer := extract(day from (date_trunc('month', alvo) + interval '1 month - 1 day'))::integer;
        dia    integer := least(coalesce(r.dia_mes, 1), ultimo);
        candidato date  := (date_trunc('month', alvo) + make_interval(days => dia - 1))::date;
      begin
        if candidato between cursor_d and limite
           and (not r.pular_feriados or not exists (
                 select 1 from public.holidays h where h.data = candidato)) then
          return next candidato;
        end if;
      end;
      alvo := (alvo + interval '1 month')::date;
    end loop;
    return;
  end if;

  while cursor_d <= limite loop
    if (r.dias_semana is null
        or extract(isodow from cursor_d)::smallint = any (r.dias_semana))
       and (not r.pular_feriados
            or not exists (select 1 from public.holidays h where h.data = cursor_d))
       and (r.frequencia <> 'quinzenal'
            or ((cursor_d - r.data_inicio) % 14) = 0)
       and (r.frequencia <> 'semanal'
            or ((cursor_d - r.data_inicio) % 7) = 0
            or r.dias_semana is not null)
    then
      return next cursor_d;
    end if;
    cursor_d := cursor_d + 1;
  end loop;
end;
$$;

/**
 * O inicio do proximo PERIODO que a regra ainda vai gerar.
 *
 * NUNCA RETROATIVO, e esta e a regra que o pedido pede em voz alta: ativar uma
 * regra antiga nao cria os meses que passaram. Uma regra criada hoje com
 * `data_inicio` em janeiro comeca a gerar do periodo corrente para a frente --
 * os meses de janeiro a hoje simplesmente nao existiram para ela.
 *
 * No modo mensal agrupada o periodo e o MES; no modo task por ocorrencia, a
 * propria data da ocorrencia.
 */
create or replace function public.proximo_periodo_da_recorrencia(p_recurrence_id uuid)
returns date
language plpgsql
stable
as $$
declare
  r     public.task_recurrences%rowtype;
  chave text;
  mes   date;
  d     date;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id;
  if not found then return null; end if;

  if r.modo = 'mensal_agrupada' then
    mes := greatest(date_trunc('month', current_date)::date,
                    date_trunc('month', r.data_inicio)::date);
    -- Ate 24 meses a frente: uma regra cujo proximo mes livre esta alem disso
    -- e uma regra que ja gerou dois anos, e o passo seguinte e outra regra.
    for i in 0..24 loop
      chave := to_char(mes, 'YYYY-MM');
      if not exists (select 1 from public.recurrence_runs
                      where recurrence_id = r.id and chave_ocorrencia = chave)
         and (r.data_fim is null or mes <= date_trunc('month', r.data_fim)::date)
         and exists (select 1 from public.datas_da_recorrencia(
                       r.id, mes, (mes + interval '1 month - 1 day')::date))
      then
        return mes;
      end if;
      mes := (mes + interval '1 month')::date;
    end loop;
    return null;
  end if;

  -- task_por_ocorrencia: a proxima data ainda nao gerada, daqui para a frente.
  for d in
    select * from public.datas_da_recorrencia(
      r.id, current_date, (current_date + interval '18 months')::date)
  loop
    if not exists (select 1 from public.recurrence_runs
                    where recurrence_id = r.id
                      and chave_ocorrencia = to_char(d, 'YYYY-MM-DD'))
    then
      return d;
    end if;
  end loop;
  return null;
end;
$$;

/** Recalcula `proxima_geracao_em` = inicio do proximo periodo menos a antecedencia. */
create or replace function public.recalcular_proxima_geracao(p_recurrence_id uuid)
returns void
language plpgsql
as $$
declare
  r      public.task_recurrences%rowtype;
  inicio date;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id;
  if not found then return; end if;

  -- REGRA PAUSADA NAO TEM PROXIMA GERACAO, e a data precisa ir a null de
  -- verdade: a rotina ja filtra por `ativo`, mas a LISTA mostra a coluna
  -- "proxima geracao". Uma regra pausada exibindo uma data futura promete uma
  -- geracao que nunca vai acontecer -- e quem olhar a lista em dezembro vai
  -- esperar a demanda de janeiro que ninguem vai gerar.
  if not r.ativo then
    update public.task_recurrences
       set proxima_geracao_em = null, updated_at = now()
     where id = p_recurrence_id;
    return;
  end if;

  inicio := public.proximo_periodo_da_recorrencia(p_recurrence_id);

  update public.task_recurrences
     set proxima_geracao_em =
           case when inicio is null then null
                else greatest(current_date, inicio - r.antecedencia_dias) end,
         updated_at = now()
   where id = p_recurrence_id;
end;
$$;

-- Toda mexida na regra que muda QUANDO ela gera refaz a proxima data. Sem
-- isto, mudar a frequencia de diaria para mensal deixaria a data antiga de pe
-- e a rotina geraria no dia errado -- calada.
create or replace function public.recorrencia_recalcula()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_proxima_geracao(new.id);
  return null;
end;
$$;

drop trigger if exists task_recurrences_recalcula on public.task_recurrences;
create trigger task_recurrences_recalcula
  after insert or update of
    frequencia, modo, dias_semana, dia_mes, pular_feriados,
    data_inicio, data_fim, antecedencia_dias, ativo
  on public.task_recurrences
  for each row
  execute function public.recorrencia_recalcula();


-- ---------------------------------------------------------------------------
-- PASSO 6 - Gerar UMA ocorrencia
-- ---------------------------------------------------------------------------

-- Os limites por execucao. Uma configuracao errada nao pode criar dez mil
-- registros: uma regra diaria com `dias_semana` nulo e `pular_feriados` falso
-- num intervalo de dez anos e um erro de digitacao, nao um pedido.
create or replace function public.limite_subtarefas_por_task() returns integer
  language sql immutable as $fn$ select 60 $fn$;
create or replace function public.limite_tasks_por_rodada() returns integer
  language sql immutable as $fn$ select 20 $fn$;

/**
 * A pessoa saiu da equipe?
 *
 * Responsavel desligado NAO QUEBRA A REGRA: a etapa nasce sem dono e o
 * Atendimento recebe o aviso. Parar a geracao inteira por causa de um nome
 * numa ficha antiga deixaria o mes sem nenhuma demanda -- e quem sai da
 * agencia costuma sair no meio do mes, com a regra ja configurada ha um ano.
 */
create or replace function public.pessoa_desligada(p_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  viva boolean;
begin
  if p_user_id is null then return false; end if;
  select p.ativo into viva from public.profiles p where p.id = p_user_id;
  return coalesce(viva, false) = false;
end;
$$;

/**
 * O aviso que a subtarefa gerada carrega, ou null.
 *
 * DUAS SITUACOES, e nenhuma delas reatribui ninguem:
 *
 *   - responsavel desligado: a etapa nasce sem dono;
 *   - responsavel fora na data (`team_presence`): a etapa nasce com ele mesmo,
 *     e com o aviso.
 *
 * **Nao reatribuir e decisao, nao limitacao.** Trocar o dono sozinho porque a
 * pessoa esta de recesso parece prestativo e e o contrario: quem sabe quem
 * cobre quem e o Atendimento, e uma troca automatica acontece calada, aparece
 * na fila de outra pessoa sem explicacao, e desfaz o combinado que existia
 * fora do sistema.
 */
create or replace function public.aviso_do_responsavel(p_user_id uuid, p_data date)
returns text
language plpgsql
stable
as $$
declare
  nome  text;
  fora  public.presenca_status;
begin
  if p_user_id is null then return null; end if;

  select p.nome into nome from public.profiles p where p.id = p_user_id;

  if public.pessoa_desligada(p_user_id) then
    return format('%s nao esta mais na equipe: a etapa de %s nasceu sem responsavel.',
                  coalesce(nome, 'A pessoa'), to_char(p_data, 'DD/MM'));
  end if;

  select tp.status into fora
    from public.team_presence tp
   where tp.user_id = p_user_id and tp.data = p_data
     and tp.status in ('ferias', 'licenca', 'ausente');

  if fora is not null then
    return format('%s esta fora em %s. A etapa ficou com ela mesma -- quem decide a troca e o Atendimento.',
                  coalesce(nome, 'A pessoa'), to_char(p_data, 'DD/MM'));
  end if;

  return null;
end;
$$;

/**
 * Gera a ocorrencia de uma regra e devolve o id da task, ou null.
 *
 * **A LINHA DO RUN E GRAVADA ANTES DA TASK, e e isso que faz a idempotencia
 * valer.** Consultar `recurrence_runs` e so depois inserir deixaria duas
 * execucoes simultaneas passarem pelas duas consultas antes de qualquer uma
 * gravar -- que e exatamente o caso que a rotina noturna e o botao "Gerar
 * agora" criam quando alguem clica na hora em que o cron roda. Com o insert
 * primeiro, quem perde a corrida leva o conflito e desiste.
 *
 * `security definer` porque ela escreve em `recurrence_runs`, que nao tem
 * policy de escrita nenhuma, e porque a rotina noturna roda sem sessao.
 */
create or replace function public.gerar_ocorrencia(
  p_recurrence_id uuid,
  p_periodo       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r            public.task_recurrences%rowtype;
  cliente      public.clients%rowtype;
  chave        text;
  run_id       uuid;
  nova_task    uuid;
  titulo       text;
  datas        date[];
  d            date;
  item         jsonb;
  modelo_sub   jsonb;
  nova_sub     uuid;
  ordem_i      integer := 0;
  quantas      integer := 0;
  responsavel  uuid;
  aviso        text;
  avisos       text[] := '{}';
  ids_por_ordem uuid[] := '{}';
  dep_ordem    integer;
  fim_periodo  date;
  pasta        text;
begin
  select * into r from public.task_recurrences where id = p_recurrence_id for update;
  if not found then
    raise exception 'Recorrencia nao encontrada.';
  end if;

  select * into cliente from public.clients where id = r.client_id;

  chave := case when r.modo = 'mensal_agrupada'
                then to_char(p_periodo, 'YYYY-MM')
                else to_char(p_periodo, 'YYYY-MM-DD') end;

  -- A TRAVA. `on conflict do nothing` sem linha de volta = outra execucao
  -- chegou primeiro, e esta desiste sem tocar em nada.
  insert into public.recurrence_runs (recurrence_id, chave_ocorrencia, status)
  values (r.id, chave, 'gerada')
  on conflict (recurrence_id, chave_ocorrencia) do nothing
  returning id into run_id;

  if run_id is null then
    return null;
  end if;

  -- As datas do periodo.
  if r.modo = 'mensal_agrupada' then
    fim_periodo := (date_trunc('month', p_periodo) + interval '1 month - 1 day')::date;
    select array_agg(x order by x) into datas
      from public.datas_da_recorrencia(r.id, date_trunc('month', p_periodo)::date, fim_periodo) x;
  else
    fim_periodo := p_periodo;
    datas := array[p_periodo];
  end if;

  if datas is null or cardinality(datas) = 0 then
    update public.recurrence_runs
       set status = 'pulada',
           detalhes = jsonb_build_object('motivo', 'Nenhuma data no periodo.')
     where id = run_id;
    return null;
  end if;

  -- O LIMITE CORTA, E NAO RECUSA: um mes com mais de 60 ocorrencias gera as 60
  -- primeiras e diz no historico que cortou. Recusar a ocorrencia inteira
  -- deixaria o mes sem nada, que e pior que um mes incompleto e anotado.
  if cardinality(datas) > public.limite_subtarefas_por_task() then
    avisos := avisos || format('O periodo tinha %s datas e o limite por task e %s: as demais nao foram criadas.',
                               cardinality(datas), public.limite_subtarefas_por_task());
    datas := datas[1:public.limite_subtarefas_por_task()];
  end if;

  titulo := public.resolver_variaveis(
    coalesce(r.modelo->>'titulo', r.nome),
    cliente.nome_empresa, coalesce(cliente.slug, ''), datas[1], 1);

  -- A PASTA DE ENTREGA E OBRIGATORIA desde a 0015, e o trigger recusa a task
  -- sem ela. Uma regra sem pasta no modelo faria toda geracao morrer com uma
  -- mensagem sobre `link_entrega` que ninguem ligaria a recorrencia -- entao a
  -- recusa acontece aqui, com o nome da regra dentro.
  pasta := nullif(trim(coalesce(r.modelo->>'pasta_entrega', '')), '');
  if pasta is null then
    update public.recurrence_runs
       set status = 'erro',
           detalhes = jsonb_build_object(
             'motivo', format('A regra "%s" nao tem pasta de entrega no modelo, e toda demanda precisa de uma.', r.nome))
     where id = run_id;
    return null;
  end if;

  insert into public.tasks (
    client_id, titulo, briefing_rico, prioridade, link_entrega,
    data_inicio, data_fim, criado_por, recurrence_id, task_type_id,
    publicada_em
  ) values (
    r.client_id, titulo,
    r.modelo->'briefing_rico',
    coalesce((r.modelo->>'prioridade')::public.task_prioridade, 'normal'),
    pasta,
    datas[1], datas[cardinality(datas)],
    r.criado_por, r.id, r.task_type_id,
    case when r.gerar_como_rascunho then null else now() end
  )
  returning id into nova_task;

  -- ---- as subtarefas ----

  if r.modo = 'mensal_agrupada' then
    modelo_sub := coalesce(r.modelo->'subtarefa_diaria', '{}'::jsonb);

    foreach d in array datas loop
      ordem_i := ordem_i + 1;
      responsavel := nullif(modelo_sub->>'responsavel_id', '')::uuid;
      aviso := public.aviso_do_responsavel(responsavel, d);
      if aviso is not null then avisos := avisos || aviso; end if;
      if public.pessoa_desligada(responsavel) then responsavel := null; end if;

      insert into public.subtasks (
        task_id, titulo, responsavel_id, prazo, prioridade,
        estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
      ) values (
        nova_task,
        public.resolver_variaveis(coalesce(modelo_sub->>'titulo', 'Entrega {DATA}'),
                                  cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
        responsavel, d,
        coalesce((modelo_sub->>'prioridade')::public.task_prioridade, 'normal'),
        nullif(modelo_sub->>'estimativa_minutos', '')::integer,
        coalesce((modelo_sub->>'requer_aprovacao')::boolean, false),
        nullif(modelo_sub->>'tipo_aprovacao', '')::public.tipo_aprovacao,
        ordem_i, aviso
      );
      quantas := quantas + 1;
    end loop;

  else
    for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
    loop
      exit when ordem_i >= public.limite_subtarefas_por_task();
      ordem_i := ordem_i + 1;
      d := p_periodo + coalesce((item->>'prazo_offset_dias')::integer, 0);
      responsavel := nullif(item->>'responsavel_id', '')::uuid;
      aviso := public.aviso_do_responsavel(responsavel, d);
      if aviso is not null then avisos := avisos || aviso; end if;
      if public.pessoa_desligada(responsavel) then responsavel := null; end if;

      insert into public.subtasks (
        task_id, titulo, responsavel_id, prazo, prioridade,
        estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem, aviso_geracao
      ) values (
        nova_task,
        public.resolver_variaveis(coalesce(item->>'titulo', 'Etapa'),
                                  cliente.nome_empresa, coalesce(cliente.slug, ''), d, ordem_i),
        responsavel, d,
        coalesce((item->>'prioridade')::public.task_prioridade, 'normal'),
        nullif(item->>'estimativa_minutos', '')::integer,
        coalesce((item->>'requer_aprovacao')::boolean, false),
        nullif(item->>'tipo_aprovacao', '')::public.tipo_aprovacao,
        ordem_i, aviso
      )
      returning id into nova_sub;

      ids_por_ordem := ids_por_ordem || nova_sub;
      quantas := quantas + 1;
    end loop;

    -- AS DEPENDENCIAS SAO RECRIADAS DEPOIS, num segundo passe: `depende_de_ordem`
    -- pode apontar para uma etapa que ainda nao existia na hora de inserir a
    -- que depende dela. Num passe so, uma dependencia para tras funcionaria e
    -- uma para a frente sumiria -- calada.
    ordem_i := 0;
    for item in select * from jsonb_array_elements(coalesce(r.modelo->'subtarefas', '[]'::jsonb))
    loop
      ordem_i := ordem_i + 1;
      exit when ordem_i > cardinality(ids_por_ordem);
      dep_ordem := nullif(item->>'depende_de_ordem', '')::integer;
      if dep_ordem is not null
         and dep_ordem between 1 and cardinality(ids_por_ordem)
         and dep_ordem <> ordem_i
      then
        insert into public.subtask_dependencies (subtask_id, depende_de_id)
        values (ids_por_ordem[ordem_i], ids_por_ordem[dep_ordem])
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- ---- referencias ----
  for item in select * from jsonb_array_elements(coalesce(r.modelo->'referencias', '[]'::jsonb))
  loop
    continue when nullif(item->>'url', '') is null;
    insert into public.task_referencias (task_id, tipo, url, titulo, adicionado_por)
    values (nova_task, coalesce(item->>'tipo', 'link'), item->>'url',
            item->>'titulo', r.criado_por);
  end loop;

  -- ---- registro e aviso ----
  insert into public.task_history (task_id, acao, autor_id, detalhes)
  values (nova_task, 'gerada_por_recorrencia', r.criado_por,
          jsonb_build_object('recurrence_id', r.id, 'regra', r.nome,
                             'chave', chave, 'subtarefas', quantas));

  update public.recurrence_runs
     set task_id = nova_task,
         detalhes = jsonb_build_object('subtarefas', quantas, 'titulo', titulo,
                                       'avisos', to_jsonb(avisos))
   where id = run_id;

  -- RASCUNHO NAO NOTIFICA NINGUEM. Ele e invisivel para os outros -- avisar
  -- sobre uma task que a pessoa nao consegue abrir e o pior tipo de aviso.
  if not r.gerar_como_rascunho then
    -- UMA NOTIFICACAO POR PESSOA, com a contagem -- nunca uma por etapa. No
    -- modo mensal agrupada uma pessoa costuma ficar com as vinte e duas
    -- etapas do mes: vinte e dois avisos identicos transformariam o sino em
    -- ruido, que e justamente o que a 0028 evitou ao nao notificar rascunho.
    perform public.notificar(
      x.responsavel_id, 'task',
      format('Nova demanda recorrente: %s', titulo),
      format('Regra "%s": %s etapa(s) para voce.', r.nome, x.quantas),
      format('/painel/gestao-tasks/%s', nova_task))
    from (
      select s.responsavel_id, count(*) as quantas
        from public.subtasks s
       where s.task_id = nova_task and s.responsavel_id is not null
       group by s.responsavel_id
    ) x;
  end if;

  -- O AVISO VAI PARA O ATENDIMENTO, e nao para quem estiver de recesso: quem
  -- decide o que fazer com uma etapa sem dono e uma pessoa, e a pessoa e a
  -- que distribui trabalho. "Nao reatribua sozinho" e o pedido em voz alta.
  if cardinality(avisos) > 0 then
    perform public.notificar(
      p.id, 'task',
      format('Recorrente "%s" gerada com aviso', r.nome),
      array_to_string(avisos, ' '),
      format('/painel/gestao-tasks/%s', nova_task))
    from public.profiles p
    where p.ativo
      and (p.role in ('desenvolvedor', 'socio')
           or exists (select 1 from public.team_members t
                       where t.user_id = p.id and t.funcao = 'Atendimento' and t.ativo));
  end if;

  update public.task_recurrences
     set ultima_geracao_em = now(), updated_at = now()
   where id = r.id;

  perform public.recalcular_proxima_geracao(r.id);

  return nova_task;
end;
$$;

revoke all on function public.gerar_ocorrencia(uuid, date) from public;
grant execute on function public.gerar_ocorrencia(uuid, date) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 7 - A rotina
-- ---------------------------------------------------------------------------

/**
 * A rotina diaria. Passa por cada regra ativa cuja data de geracao chegou.
 *
 * **ERRO NUMA REGRA NAO PARA AS OUTRAS**, e e o bloco `exception` dentro do
 * laco que garante isso. Sem ele, uma regra com modelo malformado derrubaria
 * a transacao inteira e a agencia acordaria sem nenhuma demanda gerada --
 * descobrindo o problema pela ausencia, que e a pior forma de descobrir.
 *
 * O erro vira linha em `recurrence_runs` com `status = 'erro'`, e a tela da
 * regra mostra. Tres erros seguidos e o que a lista destaca.
 *
 * **NAO RODA SOZINHA.** O agendamento e do Sprint 16, como a limpeza de
 * rascunhos: ate la, chamar esta funcao e ato de alguem -- o botao "Gerar
 * agora" de uma regra, ou um `select` no SQL Editor.
 */
create or replace function public.gerar_recorrencias()
returns table (
  recurrence_id uuid,
  regra         text,
  geradas       integer,
  erro          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.task_recurrences%rowtype;
  periodo  date;
  criadas  integer;
  nova     uuid;
begin
  for r in
    select * from public.task_recurrences
     where ativo
       and proxima_geracao_em is not null
       and proxima_geracao_em <= current_date
     order by proxima_geracao_em
  loop
    criadas := 0;
    begin
      -- ATE `limite_tasks_por_rodada()` POR REGRA. Uma regra parada ha um ano
      -- que alguem reativa nao pode despejar cinquenta tasks de uma vez --
      -- e como `proximo_periodo_da_recorrencia()` nunca olha para tras, as
      -- que ela geraria sao as futuras, nao as perdidas.
      for i in 1..public.limite_tasks_por_rodada() loop
        select * into r from public.task_recurrences where id = r.id;
        exit when not r.ativo
               or r.proxima_geracao_em is null
               or r.proxima_geracao_em > current_date;

        periodo := public.proximo_periodo_da_recorrencia(r.id);
        exit when periodo is null;

        nova := public.gerar_ocorrencia(r.id, periodo);
        exit when nova is null;   -- conflito, ou periodo vazio: a regra ja andou
        criadas := criadas + 1;
      end loop;

      recurrence_id := r.id; regra := r.nome; geradas := criadas; erro := null;
      return next;

    exception when others then
      -- A linha do run pode nao existir (o erro pode ter vindo antes dela),
      -- entao o registro do erro vai com uma chave propria, marcada pela data:
      -- sem chave, um erro repetido todo dia viraria uma unica linha e o
      -- historico esconderia a frequencia do problema.
      insert into public.recurrence_runs (recurrence_id, chave_ocorrencia, status, detalhes)
      values (r.id, format('erro-%s', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')),
              'erro', jsonb_build_object('motivo', sqlerrm))
      on conflict do nothing;

      recurrence_id := r.id; regra := r.nome; geradas := criadas; erro := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

revoke all on function public.gerar_recorrencias() from public;
grant execute on function public.gerar_recorrencias() to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 8 - Cliente desativado pausa as recorrencias dele
-- ---------------------------------------------------------------------------

/**
 * Desativar um cliente pausa as regras dele.
 *
 * E trigger, e nao uma checagem dentro da rotina, porque a pausa precisa
 * aparecer NA LISTA: uma regra que continua marcada como ativa e nunca gera
 * e uma regra que alguem vai passar meses achando quebrada. Aqui ela fica
 * apagada na tela, com o motivo.
 *
 * **Reativar o cliente NAO reativa as regras**, e e deliberado: um cliente
 * volta depois de meses parado, e retomar sozinho geraria demanda para uma
 * conta cujo escopo mudou. Quem retoma e uma pessoa, uma regra de cada vez.
 */
create or replace function public.clientes_pausam_recorrencias()
returns trigger
language plpgsql
as $$
begin
  if old.ativo and not new.ativo then
    update public.task_recurrences
       set ativo = false, proxima_geracao_em = null, updated_at = now()
     where client_id = new.id and ativo;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_pausa_recorrencias on public.clients;
create trigger clients_pausa_recorrencias
  after update of ativo on public.clients
  for each row
  execute function public.clientes_pausam_recorrencias();
