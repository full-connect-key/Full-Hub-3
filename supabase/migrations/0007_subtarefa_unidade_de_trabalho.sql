-- ===========================================================================
-- 0007 - A subtarefa vira a unidade de trabalho
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema.
--
-- O QUE MUDA, em uma frase
--   A Task deixa de ter responsavel e prazo proprios. Ela passa a ser o
--   agrupador da demanda; quem tem dono, prazo, tempo e aprovacao e a
--   SUBTAREFA.
--
-- POR QUE
--   Uma demanda da agencia envolve varias pessoas, cada uma com sua entrega e
--   seu prazo, e parte dessas entregas passa por aprovacao antes de seguir.
--   Um responsavel unico por task nao tem como representar isso.
--
-- O QUE ESTE ARQUIVO FAZ, NESTA ORDEM
--   PASSO  1  Enums novos
--   PASSO  2  Colunas novas na subtarefa
--   PASSO  3  Tabelas novas (dependencias, rodadas, entregas, historico,
--             tipos de tarefa e workflows)
--   PASSO  4  Colunas novas na Task
--   PASSO  5  MIGRACAO DOS DADOS - nenhuma atribuicao pode se perder
--   PASSO  6  Remocao do modelo antigo
--   PASSO  7  Status da Task vira calculo
--   PASSO  8  Maquina de estados da subtarefa, no banco
--   PASSO  9  Dependencias sem ciclo
--   PASSO 10  Row Level Security
--   PASSO 11  Indices
--   PASSO 12  Conferencia
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Enums
--
-- `task_status` ja existe com os valores antigos. Trocar os valores de um enum
-- em uso exige renomear o tipo velho, criar o novo e converter a coluna com um
-- `using` -- e por isso que a conversao esta aqui, e nao num `alter type ...
-- add value`: o mapeamento antigo -> novo nao e um simples acrescimo.
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.subtask_status as enum (
    'nao_iniciada', 'em_andamento', 'aguardando_informacoes',
    'enviada_aprovacao', 'em_ajustes', 'concluida'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tipo_aprovacao as enum ('interna', 'cliente');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.escopo_rodada as enum ('interna', 'cliente');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.status_rodada as enum ('pendente', 'aprovada', 'ajustes_solicitados');
exception when duplicate_object then null;
end $$;

-- task_status: dos 5 valores antigos para os 8 novos.
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'task_status' and e.enumlabel = 'aberta'
  ) then
    alter type public.task_status rename to task_status_antigo;

    create type public.task_status as enum (
      'nao_iniciada', 'em_andamento', 'aguardando_informacoes',
      'entregue', 'em_aprovacao', 'em_ajustes', 'concluido', 'cancelada'
    );

    alter table public.tasks alter column status drop default;
    alter table public.tasks
      alter column status type public.task_status
      using (
        case status::text
          when 'aberta'               then 'nao_iniciada'
          when 'em_andamento'         then 'em_andamento'
          when 'aguardando_aprovacao' then 'em_aprovacao'
          when 'concluida'            then 'concluido'
          when 'cancelada'            then 'cancelada'
          else 'nao_iniciada'
        end
      )::public.task_status;
    alter table public.tasks alter column status set default 'nao_iniciada';

    drop type public.task_status_antigo;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Colunas novas na subtarefa
--
-- `responsavel_id`, `ordem` e `concluida_em` ja existiam desde a 0004; por isso
-- todo `add column` aqui e `if not exists`.
--
-- O tempo passa a ser guardado em MINUTOS. Hora decimal ("1,75h") e uma conta
-- que a pessoa tem que fazer de cabeca antes de digitar; minuto inteiro nao
-- tem arredondamento e a tela mostra "1h 45min".
-- ---------------------------------------------------------------------------
alter table public.subtasks add column if not exists responsavel_id     uuid references public.profiles (id) on delete set null;
alter table public.subtasks add column if not exists prioridade         public.task_prioridade not null default 'normal';
alter table public.subtasks add column if not exists status             public.subtask_status not null default 'nao_iniciada';
alter table public.subtasks add column if not exists requer_aprovacao   boolean not null default false;
alter table public.subtasks add column if not exists tipo_aprovacao     public.tipo_aprovacao;
alter table public.subtasks add column if not exists estimativa_minutos integer;
alter table public.subtasks add column if not exists tempo_real_minutos integer;
alter table public.subtasks add column if not exists descricao_rica     jsonb;
alter table public.subtasks add column if not exists descricao_texto    text;
alter table public.subtasks add column if not exists ordem              integer not null default 0;
alter table public.subtasks add column if not exists iniciada_em        timestamptz;
alter table public.subtasks add column if not exists concluida_em       timestamptz;
alter table public.subtasks add column if not exists updated_at         timestamptz not null default now();

comment on column public.subtasks.descricao_texto is 'Versao em texto puro da descricao, so para busca.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Tabelas novas
-- ---------------------------------------------------------------------------

-- Dependencia: "esta subtarefa so comeca quando aquela terminar".
create table if not exists public.subtask_dependencies (
  id            uuid primary key default gen_random_uuid(),
  subtask_id    uuid not null references public.subtasks (id) on delete cascade,
  depende_de_id uuid not null references public.subtasks (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (subtask_id, depende_de_id),
  check (subtask_id <> depende_de_id)
);

-- Rodada de aprovacao. Cada ciclo de correcao e uma linha NOVA: rodada
-- fechada nunca e reescrita, porque o historico do que foi pedido e do que
-- foi respondido e justamente o que ninguem consegue reconstruir depois.
create table if not exists public.approval_rounds (
  id             uuid primary key default gen_random_uuid(),
  subtask_id     uuid not null references public.subtasks (id) on delete cascade,
  numero_rodada  integer not null,
  escopo         public.escopo_rodada not null,
  status         public.status_rodada not null default 'pendente',
  solicitado_por uuid not null references public.profiles (id),
  solicitado_em  timestamptz not null default now(),
  decidido_por   uuid references public.profiles (id),
  decidido_em    timestamptz,
  comentario     text,
  created_at     timestamptz not null default now(),
  unique (subtask_id, numero_rodada, escopo)
);

-- O material que a pessoa produziu: arquivo no bucket privado ou link.
create table if not exists public.subtask_entregas (
  id                uuid primary key default gen_random_uuid(),
  subtask_id        uuid not null references public.subtasks (id) on delete cascade,
  approval_round_id uuid references public.approval_rounds (id) on delete set null,
  tipo              text not null check (tipo in ('arquivo', 'link')),
  url               text not null,
  nome              text,
  enviado_por       uuid not null references public.profiles (id),
  created_at        timestamptz not null default now()
);

-- Historico. Nunca apagado para "limpar" o estado atual.
create table if not exists public.task_history (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks (id) on delete cascade,
  subtask_id        uuid references public.subtasks (id) on delete cascade,
  approval_round_id uuid references public.approval_rounds (id) on delete set null,
  acao              text not null,
  de_valor          text,
  para_valor        text,
  autor_id          uuid references public.profiles (id) on delete set null,
  detalhes          jsonb,
  created_at        timestamptz not null default now()
);

-- Workflow: o fluxo fixo de subtarefas de um tipo de trabalho.
create table if not exists public.workflow_templates (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descricao  text,
  client_id  uuid references public.clients (id) on delete cascade,
  ativo      boolean not null default true,
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.workflow_templates (id) on delete cascade,
  nome                  text not null,
  ordem                 integer not null,
  responsavel_padrao_id uuid references public.profiles (id) on delete set null,
  -- Alem da pessoa, a FUNCAO que costuma fazer aquela etapa ("Design",
  -- "Redator"). E o que deixa um workflow global nascer util sem amarrar o
  -- modelo a um nome: se a pessoa sai da agencia, a etapa continua dizendo de
  -- quem e o trabalho, e a tela sugere quem esta naquela funcao hoje.
  funcao_padrao         public.team_funcao,
  prioridade            public.task_prioridade not null default 'normal',
  prazo_offset_dias     integer,
  requer_aprovacao      boolean not null default false,
  tipo_aprovacao        public.tipo_aprovacao,
  depende_de_ordem      integer,
  created_at            timestamptz not null default now(),
  unique (template_id, ordem)
);

-- `create table if not exists` nao acrescenta coluna a uma tabela que ja
-- existe. Para quem rodou uma versao anterior desta migration, a linha abaixo
-- e o que garante que o modelo fica igual ao deste arquivo.
alter table public.workflow_steps add column if not exists funcao_padrao public.team_funcao;

-- Tipo de tarefa: o atalho que a pessoa escolhe na criacao. client_id nulo
-- significa "vale para todos os clientes".
create table if not exists public.task_types (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,
  descricao            text,
  client_id            uuid references public.clients (id) on delete cascade,
  workflow_template_id uuid references public.workflow_templates (id) on delete set null,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now()
);

-- `unique (nome, client_id)` nao serve: em Postgres, NULL nunca e igual a
-- NULL, entao dois tipos globais com o mesmo nome passariam. O indice parcial
-- resolve os dois casos.
create unique index if not exists task_types_nome_cliente_idx
  on public.task_types (nome, client_id) where client_id is not null;
create unique index if not exists task_types_nome_global_idx
  on public.task_types (nome) where client_id is null;

-- Comentarios passam a poder apontar para a subtarefa e para a rodada.
-- `interno = true` por padrao: comentario da equipe nao vaza para o Portal por
-- esquecimento -- so chega ao cliente o que foi marcado para chegar.
alter table public.task_comentarios add column if not exists subtask_id        uuid references public.subtasks (id) on delete cascade;
alter table public.task_comentarios add column if not exists approval_round_id uuid references public.approval_rounds (id) on delete set null;
alter table public.task_comentarios add column if not exists interno           boolean not null default true;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Colunas novas na Task
--
-- A Task ganha PERIODO (inicio -> fim) no lugar de prazo. "Prazo da task" era
-- uma data de entrega que competia com o prazo de cada subtarefa; periodo e
-- so a janela em que a demanda acontece.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists data_inicio       date;
alter table public.tasks add column if not exists data_fim          date;
alter table public.tasks add column if not exists workflow_snapshot jsonb;
alter table public.tasks add column if not exists status_manual     boolean not null default false;
alter table public.tasks add column if not exists task_type_id      uuid references public.task_types (id) on delete set null;

comment on column public.tasks.workflow_snapshot is
  'Copia congelada do workflow aplicado. Alterar o workflow depois nao mexe nesta task.';
comment on column public.tasks.status_manual is
  'true quando gestao fixou entregue / aguardando_informacoes / cancelada a mao.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - MIGRACAO DOS DADOS
--
-- Esta e a parte que nao pode dar errado: tudo o que ja estava atribuido
-- precisa continuar atribuido do outro lado.
-- ---------------------------------------------------------------------------

-- 5.1 - Periodo da task -------------------------------------------------------
--   data_inicio nao tem como ter `default created_at::date` na definicao da
--   coluna (default nao enxerga outra coluna da mesma linha), entao e preenchida
--   aqui e so depois vira NOT NULL com default current_date.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'prazo'
  ) then
    execute 'update public.tasks set data_fim = prazo where data_fim is null and prazo is not null';
  end if;
end $$;

update public.tasks set data_inicio = created_at::date where data_inicio is null;

alter table public.tasks alter column data_inicio set default current_date;
do $$
begin
  alter table public.tasks alter column data_inicio set not null;
exception when others then
  raise exception 'Ha task sem data_inicio. Rode: update public.tasks set data_inicio = created_at::date where data_inicio is null;';
end $$;

-- 5.2 - O tempo desce da Task para a subtarefa, em minutos --------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subtasks' and column_name = 'estimativa_horas'
  ) then
    execute $sql$
      update public.subtasks
         set estimativa_minutos = round(estimativa_horas * 60)::integer
       where estimativa_minutos is null and estimativa_horas is not null
    $sql$;
    execute $sql$
      update public.subtasks
         set tempo_real_minutos = round(tempo_real_horas * 60)::integer
       where tempo_real_minutos is null and tempo_real_horas is not null
    $sql$;
  end if;
end $$;

-- 5.3 - A coluna booleana `concluida` vira status -----------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subtasks' and column_name = 'concluida'
  ) then
    execute $sql$
      update public.subtasks
         set status = 'concluida'::public.subtask_status
       where concluida = true and status = 'nao_iniciada'
    $sql$;
  end if;
end $$;

-- 5.4 - Cada task com responsavel vira uma subtarefa "Execucao" ---------------
--   Regra: so para task que TEM responsavel e NAO tem nenhuma subtarefa. Task
--   que ja tinha subtarefas ja esta no modelo novo -- criar uma "Execucao"
--   nela inventaria trabalho que ninguem faz.
--
--   Uma task que estava em `aguardando_aprovacao` vira subtarefa
--   `enviada_aprovacao` COM a rodada interna pendente correspondente. Sem a
--   rodada, o status mentiria: a fila do desenvolvedor nao mostraria um item
--   que, no modelo antigo, estava de fato esperando aprovacao.
do $$
declare
  tinha_responsavel boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'responsavel_id'
  ) into tinha_responsavel;

  if not tinha_responsavel then
    return;  -- migracao ja rodou
  end if;

  execute $sql$
    with novas as (
      insert into public.subtasks
        (task_id, titulo, prazo, responsavel_id, ordem, status,
         requer_aprovacao, tipo_aprovacao,
         estimativa_minutos, tempo_real_minutos, concluida_em)
      select
        t.id,
        'Execução',
        t.prazo,
        t.responsavel_id,
        0,
        case t.status::text
          when 'concluido'     then 'concluida'
          when 'em_andamento'  then 'em_andamento'
          when 'em_aprovacao'  then 'enviada_aprovacao'
          else 'nao_iniciada'
        end::public.subtask_status,
        (t.status::text = 'em_aprovacao'),
        case when t.status::text = 'em_aprovacao' then 'interna'::public.tipo_aprovacao end,
        round(t.estimativa_horas * 60)::integer,
        round(t.tempo_real_horas * 60)::integer,
        t.concluida_em
      from public.tasks t
      where t.responsavel_id is not null
        and not exists (select 1 from public.subtasks s where s.task_id = t.id)
      returning id, task_id, status
    )
    insert into public.approval_rounds
      (subtask_id, numero_rodada, escopo, status, solicitado_por)
    select n.id, 1, 'interna', 'pendente', t.criado_por
      from novas n
      join public.tasks t on t.id = n.task_id
     where n.status = 'enviada_aprovacao'
  $sql$;
end $$;

-- 5.5 - Toda Task pertence a um cliente ---------------------------------------
--   Recusar e proposital. Preencher sozinho seria adivinhar de quem e a
--   demanda, e demanda no cliente errado e pior do que migracao que para.
do $$
declare
  orfas integer;
  titulos text;
begin
  select count(*), string_agg(titulo, ' | ')
    into orfas, titulos
  from public.tasks where client_id is null;

  if orfas > 0 then
    raise exception
      'Ha % task(s) sem cliente, e client_id vai virar obrigatorio. Vincule ou apague antes de rodar de novo. Tasks: %',
      orfas, titulos;
  end if;
end $$;

alter table public.tasks alter column client_id set not null;

-- O `on delete set null` do cliente deixou de fazer sentido: a coluna nao
-- aceita mais nulo. Apagar cliente com task agora e recusado pelo banco -- o
-- que ja era a regra do produto, so que antes ela morava so na aplicacao.
do $$
declare
  nome_da_fk text;
begin
  select conname into nome_da_fk
    from pg_constraint
   where conrelid = 'public.tasks'::regclass
     and contype = 'f'
     and conkey = array[(select attnum from pg_attribute
                          where attrelid = 'public.tasks'::regclass and attname = 'client_id')];

  if nome_da_fk is not null then
    execute format('alter table public.tasks drop constraint %I', nome_da_fk);
  end if;

  alter table public.tasks
    add constraint tasks_client_id_fkey
    foreign key (client_id) references public.clients (id) on delete restrict;
end $$;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Remocao do modelo antigo
--
-- Coluna morta vira bug seis sprints a frente: alguem escreve um filtro por
-- `responsavel_id`, ele devolve nulo para tudo e ninguem entende por que a
-- tela veio vazia. Some de vez.
-- ---------------------------------------------------------------------------
-- As policies antigas citam as colunas que vao embora, e o Postgres recusa o
-- drop enquanto elas existirem. Somem aqui e voltam, reescritas, no PASSO 10.
drop policy if exists tasks_insert    on public.tasks;
drop policy if exists tasks_update    on public.tasks;
drop policy if exists subtasks_write  on public.subtasks;
drop policy if exists subtasks_update on public.subtasks;

alter table public.tasks drop column if exists responsavel_id;
alter table public.tasks drop column if exists prazo;
alter table public.tasks drop column if exists etapa_atual_id;
alter table public.tasks drop column if exists estimativa_horas;
alter table public.tasks drop column if exists tempo_real_horas;

alter table public.subtasks drop column if exists concluida;
alter table public.subtasks drop column if exists estimativa_horas;
alter table public.subtasks drop column if exists tempo_real_horas;

-- O modelo de etapas do Sprint 5 original saiu de cena: o fluxo agora vive nas
-- subtarefas e nos workflow_templates.
drop table if exists public.workflow_stages cascade;

-- Coerencia do par (requer_aprovacao, tipo_aprovacao). So entra depois da
-- migracao dos dados, senao a linha de 5.4 nem seria aceita.
do $$
begin
  alter table public.subtasks
    add constraint subtasks_tipo_aprovacao_coerente
    check (
      (requer_aprovacao = true  and tipo_aprovacao is not null) or
      (requer_aprovacao = false and tipo_aprovacao is null)
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.workflow_steps
    add constraint workflow_steps_tipo_aprovacao_coerente
    check (
      (requer_aprovacao = true  and tipo_aprovacao is not null) or
      (requer_aprovacao = false and tipo_aprovacao is null)
    );
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------------
-- PASSO 7 - O status da Task vira calculo
--
-- A Task nao tem status editado livremente: ele e a leitura do que as
-- subtarefas e as rodadas de aprovacao dizem. Isso mora no BANCO, e nao so na
-- Server Action, porque qualquer caminho que mexa numa subtarefa -- tela,
-- action, import, correcao manual pelo SQL Editor -- tem que deixar a task
-- coerente.
--
-- Precedencia, a primeira regra que casar vence:
--   1. em_ajustes            alguma subtarefa em em_ajustes
--   2. em_aprovacao          existe rodada pendente
--   3. concluido             todas concluidas e nenhuma rodada pendente
--   4. aguardando_informacoes  alguma esperando informacao e nenhuma andando
--   5. em_andamento          alguma em andamento, ou alguma ja concluida
--   6. nao_iniciada          todas nao iniciadas, ou task sem subtarefa
--
-- DOIS STATUS SAO MANUAIS e nao saem desta conta:
--   `cancelada` -- demanda que morreu; so sai de la por decisao humana;
--   `entregue`  -- "o material saiu", que nao e a mesma coisa que "foi
--                  aprovado". Vale enquanto nao houver rodada pendente,
--                  ajuste ou conclusao: qualquer um dos tres reassume o
--                  controle e zera status_manual.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_status_task(p_task_id uuid)
returns public.task_status
language plpgsql
security definer
set search_path = public
as $$
declare
  total            integer;
  concluidas       integer;
  em_ajustes       integer;
  aguardando       integer;
  andando          integer;
  rodadas_pendentes integer;
  atual            public.task_status;
  manual           boolean;
  novo             public.task_status;
begin
  select t.status, t.status_manual into atual, manual
    from public.tasks t where t.id = p_task_id;

  if not found then
    return null;
  end if;

  -- Cancelada nunca e desfeita por calculo. Reabrir e um ato humano.
  if atual = 'cancelada' then
    return atual;
  end if;

  select
    count(*),
    count(*) filter (where s.status = 'concluida'),
    count(*) filter (where s.status = 'em_ajustes'),
    count(*) filter (where s.status = 'aguardando_informacoes'),
    count(*) filter (where s.status in ('em_andamento', 'enviada_aprovacao'))
  into total, concluidas, em_ajustes, aguardando, andando
  from public.subtasks s where s.task_id = p_task_id;

  select count(*) into rodadas_pendentes
    from public.approval_rounds r
    join public.subtasks s on s.id = r.subtask_id
   where s.task_id = p_task_id and r.status = 'pendente';

  if em_ajustes > 0 then
    novo := 'em_ajustes';
  elsif rodadas_pendentes > 0 then
    novo := 'em_aprovacao';
  elsif total > 0 and concluidas = total then
    novo := 'concluido';
  elsif aguardando > 0 and andando = 0 then
    novo := 'aguardando_informacoes';
  elsif andando > 0 or concluidas > 0 then
    novo := 'em_andamento';
  else
    novo := 'nao_iniciada';
  end if;

  -- `entregue` marcado a mao resiste ate aparecer ajuste, rodada pendente ou
  -- conclusao. Fora desses tres, o calculo nao tem autoridade para desfazer o
  -- que uma pessoa afirmou.
  if manual and atual in ('entregue', 'aguardando_informacoes') then
    if novo in ('em_ajustes', 'em_aprovacao', 'concluido') then
      update public.tasks
         set status = novo, status_manual = false,
             concluida_em = case when novo = 'concluido' then now() else null end
       where id = p_task_id;
      return novo;
    end if;
    return atual;
  end if;

  if novo is distinct from atual then
    update public.tasks
       set status = novo,
           status_manual = false,
           concluida_em = case when novo = 'concluido' then coalesce(concluida_em, now()) end
     where id = p_task_id;
  end if;

  return novo;
end;
$$;

-- Gatilho unico para subtarefa e rodada: qualquer escrita nas duas recalcula a
-- task-mae.
create or replace function public.tocar_status_da_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if tg_table_name = 'subtasks' then
    alvo := coalesce(new.task_id, old.task_id);
  else
    select s.task_id into alvo
      from public.subtasks s
     where s.id = coalesce(new.subtask_id, old.subtask_id);
  end if;

  if alvo is not null then
    perform public.recalcular_status_task(alvo);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists subtasks_recalcula_task on public.subtasks;
create trigger subtasks_recalcula_task
  after insert or update or delete on public.subtasks
  for each row execute function public.tocar_status_da_task();

drop trigger if exists approval_rounds_recalcula_task on public.approval_rounds;
create trigger approval_rounds_recalcula_task
  after insert or update or delete on public.approval_rounds
  for each row execute function public.tocar_status_da_task();


-- ---------------------------------------------------------------------------
-- PASSO 8 - A maquina de estados da subtarefa, no banco
--
-- As mesmas regras existem em lib/tasks/state-machine.ts, para a tela saber
-- qual botao mostrar. Aqui elas existem de novo porque esconder o botao nao e
-- regra de negocio: um POST montado a mao contra a API do Supabase passa por
-- cima da tela inteira, e para nele.
-- ---------------------------------------------------------------------------

-- Ha rodada aprovada que autoriza a conclusao desta subtarefa?
--   tipo interna -> basta a rodada interna aprovada da rodada corrente;
--   tipo cliente -> e preciso a rodada de escopo cliente aprovada.
create or replace function public.subtask_tem_aval(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tipo    public.tipo_aprovacao;
  ultima  integer;
begin
  select s.tipo_aprovacao into tipo
    from public.subtasks s where s.id = p_subtask_id;

  if tipo is null then
    return true;
  end if;

  select max(numero_rodada) into ultima
    from public.approval_rounds where subtask_id = p_subtask_id;

  if ultima is null then
    return false;
  end if;

  return exists (
    select 1 from public.approval_rounds r
     where r.subtask_id = p_subtask_id
       and r.numero_rodada = ultima
       and r.escopo = tipo::text::public.escopo_rodada
       and r.status = 'aprovada'
  );
end;
$$;

-- Todas as dependencias desta subtarefa estao concluidas?
create or replace function public.subtask_liberada(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return not exists (
    select 1
      from public.subtask_dependencies d
      join public.subtasks dep on dep.id = d.depende_de_id
     where d.subtask_id = p_subtask_id
       and dep.status <> 'concluida'
  );
end;
$$;

-- O que ela esta esperando, em texto, para o tooltip "Aguardando: Criar conceito".
create or replace function public.subtask_pendencias(p_subtask_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  nomes text;
begin
  select string_agg(dep.titulo, ', ' order by dep.ordem)
    into nomes
    from public.subtask_dependencies d
    join public.subtasks dep on dep.id = d.depende_de_id
   where d.subtask_id = p_subtask_id
     and dep.status <> 'concluida';
  return nomes;
end;
$$;

create or replace function public.validar_transicao_de_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- 1. Subtarefa que exige aprovacao nunca e concluida pelo proprio caminho.
  --    A unica porta para `concluida` e uma rodada aprovada.
  if new.status = 'concluida' and new.requer_aprovacao and not public.subtask_tem_aval(new.id) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" exige aprovação %s e não pode ser concluída direto.',
                       new.titulo, new.tipo_aprovacao),
      hint    = 'Use "Enviar para aprovação". A conclusão vem do resultado da aprovação.';
  end if;

  -- 2. So sai de nao_iniciada quem nao esta esperando dependencia.
  if old.status = 'nao_iniciada' and new.status <> 'nao_iniciada'
     and not public.subtask_liberada(new.id) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" está aguardando: %s.',
                       new.titulo, public.subtask_pendencias(new.id));
  end if;

  -- 3. `enviada_aprovacao` sem rodada pendente e status mentindo: a fila do
  --    desenvolvedor nao teria o que mostrar.
  if new.status = 'enviada_aprovacao' and not exists (
       select 1 from public.approval_rounds r
        where r.subtask_id = new.id and r.status = 'pendente'
     ) then
    raise exception using
      errcode = 'check_violation',
      message = format('A subtarefa "%s" não tem rodada de aprovação pendente.', new.titulo),
      hint    = 'A rodada é criada pela ação "Enviar para aprovação".';
  end if;

  -- 4. `em_ajustes` e resultado de alguem ter PEDIDO ajuste. Sem a rodada
  --    correspondente, qualquer pessoa poderia estacionar a subtarefa ali e
  --    arrastar a task inteira para em_ajustes -- que e a regra de maior
  --    precedencia no calculo do status.
  if new.status = 'em_ajustes' and not exists (
       select 1 from public.approval_rounds r
        where r.subtask_id = new.id and r.status = 'ajustes_solicitados'
     ) then
    raise exception using
      errcode = 'check_violation',
      message = format('Nenhuma rodada pediu ajustes na subtarefa "%s".', new.titulo),
      hint    = 'em_ajustes vem de "Solicitar ajustes", interno ou do cliente.';
  end if;

  -- Carimbos de tempo, para o historico nao depender de a action lembrar.
  if new.status = 'em_andamento' and new.iniciada_em is null then
    new.iniciada_em := now();
  end if;
  if new.status = 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());
  else
    new.concluida_em := null;
  end if;

  return new;
end;
$$;

drop trigger if exists subtasks_bloqueia_conclusao_sem_aprovacao on public.subtasks;
create trigger subtasks_bloqueia_conclusao_sem_aprovacao
  before update on public.subtasks
  for each row execute function public.validar_transicao_de_subtarefa();

drop trigger if exists subtasks_updated_at on public.subtasks;
create trigger subtasks_updated_at
  before update on public.subtasks
  for each row execute function public.tocar_updated_at();

-- Rodada fechada nao se reescreve. O acordeao de rodadas so vale alguma coisa
-- se a rodada 1 continuar dizendo o que ela disse.
create or replace function public.proteger_rodada_fechada()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'pendente' and new.status <> old.status then
    raise exception using
      errcode = 'check_violation',
      message = 'Rodada de aprovação já decidida não muda de resultado.',
      hint    = 'Cada ciclo de correção cria uma rodada nova, com número maior.';
  end if;

  if new.status <> 'pendente' and old.status = 'pendente' then
    new.decidido_em := coalesce(new.decidido_em, now());
  end if;

  if new.status = 'ajustes_solicitados'
     and (new.comentario is null or btrim(new.comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Pedir ajustes exige um comentário dizendo o que ajustar.';
  end if;

  return new;
end;
$$;

drop trigger if exists approval_rounds_protege_fechada on public.approval_rounds;
create trigger approval_rounds_protege_fechada
  before update on public.approval_rounds
  for each row execute function public.proteger_rodada_fechada();

-- Ninguem aprova a propria entrega -- nem por SQL direto.
create or replace function public.bloquear_autoaprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.decidido_por is not null and exists (
       select 1 from public.subtasks s
        where s.id = new.subtask_id and s.responsavel_id = new.decidido_por
     ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Ninguém aprova a própria entrega.',
      hint    = 'Outra pessoa da gestão precisa decidir esta rodada.';
  end if;
  return new;
end;
$$;

drop trigger if exists approval_rounds_sem_autoaprovacao on public.approval_rounds;
create trigger approval_rounds_sem_autoaprovacao
  before insert or update on public.approval_rounds
  for each row execute function public.bloquear_autoaprovacao();


-- ---------------------------------------------------------------------------
-- PASSO 9 - Dependencias sem ciclo
--
-- A → B → A trava as duas para sempre: nenhuma das duas consegue sair de
-- nao_iniciada, e a tela so diz "aguardando" de um lado para o outro. Recusar
-- na hora de criar e o unico momento em que da para explicar o problema.
-- ---------------------------------------------------------------------------
create or replace function public.recusar_ciclo_de_dependencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mesma_task boolean;
begin
  select a.task_id = b.task_id into mesma_task
    from public.subtasks a, public.subtasks b
   where a.id = new.subtask_id and b.id = new.depende_de_id;

  if not coalesce(mesma_task, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Uma subtarefa só depende de outra da mesma Task.';
  end if;

  -- Sai de depende_de_id e anda pelo grafo: se chegar em subtask_id, fecha o ciclo.
  if exists (
    with recursive caminho as (
      select new.depende_de_id as id
      union
      select d.depende_de_id
        from public.subtask_dependencies d
        join caminho c on c.id = d.subtask_id
    )
    select 1 from caminho where id = new.subtask_id
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa dependência fecha um ciclo: as duas subtarefas ficariam travadas esperando uma pela outra.';
  end if;

  return new;
end;
$$;

drop trigger if exists subtask_dependencies_sem_ciclo on public.subtask_dependencies;
create trigger subtask_dependencies_sem_ciclo
  before insert or update on public.subtask_dependencies
  for each row execute function public.recusar_ciclo_de_dependencia();


-- ---------------------------------------------------------------------------
-- PASSO 10 - Row Level Security
--
-- Isolamento por cliente: task, subtarefa, comentario, aprovacao, entrega e
-- historico de um cliente nunca aparecem para outro. A ancora e sempre
-- tasks.client_id cruzado com my_client_ids().
--
-- E o cliente nao ve a aprovacao INTERNA: para ele existe apenas a rodada de
-- escopo 'cliente', criada quando o desenvolvedor decide enviar.
-- ---------------------------------------------------------------------------

-- `pode_editar_task` precisa ser reescrita: ela lia tasks.responsavel_id, que
-- nao existe mais. Agora "mexer no conteudo da task" e de quem faz Atendimento
-- ou de quem tem alguma subtarefa ali dentro -- quem trabalha na demanda
-- precisa anexar referencia e comentar.
create or replace function public.pode_editar_task(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.is_atendimento() then
    return true;
  end if;

  return exists (
    select 1 from public.subtasks s
     where s.task_id = p_task_id
       and s.responsavel_id = (select auth.uid())
  );
end;
$$;

-- Esta task e de um cliente meu?
create or replace function public.task_do_meu_cliente(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and t.client_id in (select public.my_client_ids())
  );
end;
$$;

-- O cliente so enxerga a subtarefa depois que ela foi enviada a ele.
create or replace function public.subtask_visivel_ao_cliente(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.id = p_subtask_id
       and t.client_id in (select public.my_client_ids())
       and exists (
         select 1 from public.approval_rounds r
          where r.subtask_id = s.id and r.escopo = 'cliente'
       )
  );
end;
$$;

-- Quem pode decidir uma rodada interna: gestao, e nunca o dono da entrega.
--
-- NOTA DE DECISAO: a regra-mestra diz "quem valida internamente e o
-- Desenvolvedor". Aqui isso e `is_gestor()`, que inclui o socio -- ele tem
-- acesso total ao painel, e travar o socio fora da fila deixaria a agencia
-- parada quando o desenvolvedor esta de folga. Para restringir so ao
-- desenvolvedor, troque `is_gestor()` por `auth_role() = 'desenvolvedor'`
-- aqui e nas actions da Parte 4 -- e o unico ponto a mudar.
create or replace function public.pode_aprovar_subtarefa(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    return false;
  end if;

  return not exists (
    select 1 from public.subtasks s
     where s.id = p_subtask_id
       and s.responsavel_id = (select auth.uid())
  );
end;
$$;

-- Nova rodada: quem pode abrir, e em que ordem.
create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  exige boolean;
begin
  select s.responsavel_id, s.requer_aprovacao into dono, exige
    from public.subtasks s where s.id = new.subtask_id;

  if not exige then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    -- quem produziu pede a validacao; a gestao tambem pode, para destravar
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    -- escopo cliente: ato deliberado da gestao, e so depois do aval interno
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.subtask_id = new.subtask_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists approval_rounds_valida_nova on public.approval_rounds;
create trigger approval_rounds_valida_nova
  before insert on public.approval_rounds
  for each row execute function public.validar_nova_rodada();

-- A decisao do cliente precisa mexer na subtarefa, e o cliente nao tem (nem
-- deve ter) permissao de escrita em subtasks. Por isso a decisao inteira sai
-- por esta funcao: ela confere que a rodada e de um cliente dele, grava a
-- decisao, move a subtarefa e registra o historico -- tudo de uma vez.
create or replace function public.decidir_rodada_do_cliente(
  p_round_id   uuid,
  p_decisao    public.status_rodada,
  p_comentario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.approval_rounds%rowtype;
  id_da_task uuid;
  quem       uuid := (select auth.uid());
begin
  select * into r from public.approval_rounds where id = p_round_id;

  if not found then
    raise exception 'Rodada não encontrada.';
  end if;

  if r.escopo <> 'cliente' then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Esta rodada não é uma aprovação de cliente.';
  end if;

  if r.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta rodada já foi decidida.';
  end if;

  if not public.subtask_visivel_ao_cliente(r.subtask_id) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Sem acesso a esta aprovação.';
  end if;

  if p_decisao = 'ajustes_solicitados' and (p_comentario is null or btrim(p_comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'Diga o que precisa ser ajustado.';
  end if;

  update public.approval_rounds
     set status = p_decisao,
         decidido_por = quem,
         decidido_em = now(),
         comentario = p_comentario
   where id = p_round_id;

  update public.subtasks
     set status = (case when p_decisao = 'aprovada' then 'concluida' else 'em_ajustes' end)::public.subtask_status
   where id = r.subtask_id;

  select task_id into id_da_task from public.subtasks where id = r.subtask_id;

  insert into public.task_history (task_id, subtask_id, approval_round_id, acao, para_valor, autor_id)
  values (id_da_task, r.subtask_id, p_round_id,
          case when p_decisao = 'aprovada' then 'cliente_aprovou' else 'cliente_pediu_ajustes' end,
          p_decisao::text, quem);

  if p_comentario is not null and btrim(p_comentario) <> '' then
    insert into public.task_comentarios (task_id, subtask_id, approval_round_id, autor_id, texto, interno)
    values (id_da_task, r.subtask_id, p_round_id, quem, p_comentario, false);
  end if;
end;
$$;

alter table public.subtask_dependencies enable row level security;
alter table public.approval_rounds       enable row level security;
alter table public.subtask_entregas      enable row level security;
alter table public.task_history          enable row level security;
alter table public.task_types            enable row level security;
alter table public.workflow_templates    enable row level security;
alter table public.workflow_steps        enable row level security;

-- tasks ---------------------------------------------------------------------
drop policy if exists tasks_select         on public.tasks;
drop policy if exists tasks_select_cliente on public.tasks;
drop policy if exists tasks_insert         on public.tasks;
drop policy if exists tasks_update         on public.tasks;
drop policy if exists tasks_delete         on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated using (public.is_staff());

-- O cliente so ve a task quando alguma subtarefa dela foi enviada a ele.
-- Ele nao "ve a Task inteira": e a casca (titulo e periodo) do que esta
-- esperando a decisao dele.
create policy tasks_select_cliente on public.tasks
  for select to authenticated
  using (
    client_id in (select public.my_client_ids())
    and exists (
      select 1 from public.subtasks s
      join public.approval_rounds r on r.subtask_id = s.id and r.escopo = 'cliente'
      where s.task_id = tasks.id
    )
  );

create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.is_atendimento());

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_atendimento()) with check (public.is_atendimento());

create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_gestor());

-- subtasks ------------------------------------------------------------------
drop policy if exists subtasks_select         on public.subtasks;
drop policy if exists subtasks_select_cliente on public.subtasks;
drop policy if exists subtasks_insert         on public.subtasks;
drop policy if exists subtasks_update         on public.subtasks;
drop policy if exists subtasks_delete         on public.subtasks;

create policy subtasks_select on public.subtasks
  for select to authenticated using (public.is_staff());

create policy subtasks_select_cliente on public.subtasks
  for select to authenticated using (public.subtask_visivel_ao_cliente(id));

create policy subtasks_insert on public.subtasks
  for insert to authenticated with check (public.is_atendimento());

-- O responsavel atualiza a dele; gestao e Atendimento atualizam qualquer uma.
-- O que ele NAO consegue fazer e concluir uma que exige aprovacao -- isso e o
-- trigger do PASSO 8, e nao a policy: policy diz de quem e a linha, trigger
-- diz que transicao e legitima.
create policy subtasks_update on public.subtasks
  for update to authenticated
  using (
    public.is_gestor() or public.is_atendimento()
    or responsavel_id = (select auth.uid())
  )
  with check (
    public.is_gestor() or public.is_atendimento()
    or responsavel_id = (select auth.uid())
  );

create policy subtasks_delete on public.subtasks
  for delete to authenticated using (public.is_atendimento());

-- subtask_dependencies ------------------------------------------------------
drop policy if exists subtask_dependencies_select on public.subtask_dependencies;
drop policy if exists subtask_dependencies_write  on public.subtask_dependencies;

create policy subtask_dependencies_select on public.subtask_dependencies
  for select to authenticated using (public.is_staff());

create policy subtask_dependencies_write on public.subtask_dependencies
  for all to authenticated
  using (public.is_atendimento()) with check (public.is_atendimento());

-- approval_rounds -----------------------------------------------------------
drop policy if exists approval_rounds_select         on public.approval_rounds;
drop policy if exists approval_rounds_select_cliente on public.approval_rounds;
drop policy if exists approval_rounds_insert        on public.approval_rounds;
drop policy if exists approval_rounds_decide        on public.approval_rounds;

create policy approval_rounds_select on public.approval_rounds
  for select to authenticated using (public.is_staff());

-- O cliente enxerga SO as rodadas de escopo cliente. A aprovacao interna
-- inteira -- quem pediu, quem aprovou, o que foi comentado -- fica do lado de
-- ca da parede.
create policy approval_rounds_select_cliente on public.approval_rounds
  for select to authenticated
  using (escopo = 'cliente' and public.subtask_visivel_ao_cliente(subtask_id));

create policy approval_rounds_insert on public.approval_rounds
  for insert to authenticated
  with check (public.is_staff() and solicitado_por = (select auth.uid()));

create policy approval_rounds_decide on public.approval_rounds
  for update to authenticated
  using (public.pode_aprovar_subtarefa(subtask_id))
  with check (public.pode_aprovar_subtarefa(subtask_id));
-- Sem policy de DELETE: rodada nao se apaga. A de escopo cliente e decidida
-- pela funcao decidir_rodada_do_cliente, que roda como dona da tabela.

-- subtask_entregas ----------------------------------------------------------
drop policy if exists subtask_entregas_select         on public.subtask_entregas;
drop policy if exists subtask_entregas_select_cliente on public.subtask_entregas;
drop policy if exists subtask_entregas_insert         on public.subtask_entregas;
drop policy if exists subtask_entregas_delete         on public.subtask_entregas;

create policy subtask_entregas_select on public.subtask_entregas
  for select to authenticated using (public.is_staff());

create policy subtask_entregas_select_cliente on public.subtask_entregas
  for select to authenticated using (public.subtask_visivel_ao_cliente(subtask_id));

create policy subtask_entregas_insert on public.subtask_entregas
  for insert to authenticated
  with check (
    enviado_por = (select auth.uid())
    and (
      public.is_atendimento()
      or exists (select 1 from public.subtasks s
                  where s.id = subtask_id and s.responsavel_id = (select auth.uid()))
    )
  );

create policy subtask_entregas_delete on public.subtask_entregas
  for delete to authenticated
  using (enviado_por = (select auth.uid()) or public.is_gestor());

-- task_history --------------------------------------------------------------
-- So leitura e escrita. Sem UPDATE e sem DELETE: historico que da para
-- reescrever nao e historico.
drop policy if exists task_history_select on public.task_history;
drop policy if exists task_history_insert on public.task_history;

create policy task_history_select on public.task_history
  for select to authenticated using (public.is_staff());

create policy task_history_insert on public.task_history
  for insert to authenticated
  with check (public.is_staff() and autor_id = (select auth.uid()));

-- task_comentarios ----------------------------------------------------------
drop policy if exists task_comentarios_select         on public.task_comentarios;
drop policy if exists task_comentarios_select_cliente on public.task_comentarios;
drop policy if exists task_comentarios_insert         on public.task_comentarios;
drop policy if exists task_comentarios_insert_cliente on public.task_comentarios;

create policy task_comentarios_select on public.task_comentarios
  for select to authenticated using (public.is_staff());

-- Ao cliente chega so o que foi marcado para chegar.
create policy task_comentarios_select_cliente on public.task_comentarios
  for select to authenticated
  using (interno = false and public.task_do_meu_cliente(task_id));

create policy task_comentarios_insert on public.task_comentarios
  for insert to authenticated
  with check (public.is_staff() and autor_id = (select auth.uid()));

create policy task_comentarios_insert_cliente on public.task_comentarios
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and interno = false
    and subtask_id is not null
    and public.subtask_visivel_ao_cliente(subtask_id)
  );

-- tipos de tarefa e workflows ------------------------------------------------
drop policy if exists task_types_select on public.task_types;
drop policy if exists task_types_write  on public.task_types;
drop policy if exists workflow_templates_select on public.workflow_templates;
drop policy if exists workflow_templates_write  on public.workflow_templates;
drop policy if exists workflow_steps_select on public.workflow_steps;
drop policy if exists workflow_steps_write  on public.workflow_steps;

create policy task_types_select on public.task_types
  for select to authenticated using (public.is_staff());
create policy task_types_write on public.task_types
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy workflow_templates_select on public.workflow_templates
  for select to authenticated using (public.is_staff());
create policy workflow_templates_write on public.workflow_templates
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy workflow_steps_select on public.workflow_steps
  for select to authenticated using (public.is_staff());
create policy workflow_steps_write on public.workflow_steps
  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- Arquivo de entrega no bucket privado --------------------------------------
-- Convencao de caminho: entregas/<subtask_id>/<arquivo>. E o que deixa a
-- policy do Storage decidir por subtarefa, sem tabela intermediaria.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  execute 'drop policy if exists "task-arquivos: cliente le entrega" on storage.objects';
  execute $politica$
    create policy "task-arquivos: cliente le entrega" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'task-arquivos'
        and (storage.foldername(name))[1] = 'entregas'
        and public.subtask_visivel_ao_cliente(((storage.foldername(name))[2])::uuid)
      )
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 11 - Indices
-- ---------------------------------------------------------------------------
create index if not exists subtasks_task_ordem_idx        on public.subtasks (task_id, ordem);
create index if not exists subtasks_responsavel_status_idx on public.subtasks (responsavel_id, status);
create index if not exists subtasks_prazo_idx2            on public.subtasks (prazo);
create index if not exists approval_rounds_subtask_idx    on public.approval_rounds (subtask_id, numero_rodada);
create index if not exists approval_rounds_fila_idx       on public.approval_rounds (status, escopo);
create index if not exists subtask_entregas_subtask_idx   on public.subtask_entregas (subtask_id);
create index if not exists subtask_dependencies_subtask_idx on public.subtask_dependencies (subtask_id);
create index if not exists subtask_dependencies_depende_idx on public.subtask_dependencies (depende_de_id);
create index if not exists task_history_task_idx          on public.task_history (task_id, created_at desc);
create index if not exists task_comentarios_subtask_idx   on public.task_comentarios (subtask_id);
create index if not exists tasks_periodo_idx              on public.tasks (data_inicio, data_fim);
create index if not exists workflow_steps_template_idx    on public.workflow_steps (template_id, ordem);


-- ---------------------------------------------------------------------------
-- PASSO 12 - Conferencia
--
-- Falha alto se o modelo antigo sobreviveu em algum canto. Migration que
-- "quase" roda e a pior de todas: o proximo ambiente sai diferente deste.
-- ---------------------------------------------------------------------------
do $$
declare
  sobrou text;
begin
  select string_agg(format('%s.%s', table_name, column_name), ', ')
    into sobrou
  from information_schema.columns
  where table_schema = 'public'
    and (
      (table_name = 'tasks'    and column_name in ('responsavel_id','prazo','etapa_atual_id','estimativa_horas','tempo_real_horas'))
      or (table_name = 'subtasks' and column_name in ('concluida','estimativa_horas','tempo_real_horas'))
    );

  if sobrou is not null then
    raise exception 'Coluna do modelo antigo sobreviveu: %', sobrou;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = 'client_id' and is_nullable = 'YES'
  ) then
    raise exception 'tasks.client_id ainda aceita nulo.';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'task_status' and e.enumlabel = 'concluido'
  ) then
    raise exception 'O enum task_status nao foi migrado.';
  end if;

  foreach sobrou in array array['subtasks_recalcula_task','approval_rounds_recalcula_task',
                                'subtasks_bloqueia_conclusao_sem_aprovacao','approval_rounds_sem_autoaprovacao',
                                'subtask_dependencies_sem_ciclo','approval_rounds_valida_nova']
  loop
    if not exists (select 1 from pg_trigger where tgname = sobrou and not tgisinternal) then
      raise exception 'Faltou o trigger %', sobrou;
    end if;
  end loop;
end
$$;

-- O relatorio que o Sprint 3B pede: quantas tasks, quantas subtarefas de
-- migracao nasceram, e se sobrou alguma task sem cliente ou sem subtarefa.
select
  'tudo pronto'                                                       as situacao,
  (select count(*) from public.tasks)                                 as tasks,
  (select count(*) from public.subtasks)                              as subtarefas,
  (select count(*) from public.subtasks where titulo = 'Execução')    as subtarefas_de_migracao,
  (select count(*) from public.tasks where client_id is null)         as tasks_sem_cliente,
  (select count(*) from public.tasks t
    where not exists (select 1 from public.subtasks s where s.task_id = t.id)) as tasks_sem_subtarefa,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('tasks','subtasks','subtask_dependencies','approval_rounds',
                       'subtask_entregas','task_history','task_comentarios',
                       'task_types','workflow_templates','workflow_steps'))    as policies;
