-- ===========================================================================
-- 0004 - Tasks, subtarefas, referencias e comentarios
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
-- Pode ser executado mais de uma vez sem problema.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.task_prioridade as enum ('baixa', 'normal', 'alta', 'urgente');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_status as enum
    ('aberta', 'em_andamento', 'aguardando_aprovacao', 'concluida', 'cancelada');
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients (id) on delete set null,
  titulo           text not null,
  -- O briefing e guardado duas vezes de proposito: o JSON preserva a
  -- formatacao do editor, e o texto puro e o que a busca consegue varrer.
  briefing_rico    jsonb,
  briefing_texto   text,
  prioridade       public.task_prioridade not null default 'normal',
  status           public.task_status not null default 'aberta',
  prazo            date,
  estimativa_horas numeric(6,2),
  tempo_real_horas numeric(6,2),
  responsavel_id   uuid references public.profiles (id) on delete set null,
  criado_por       uuid not null references public.profiles (id),
  etapa_atual_id   uuid,
  concluida_em     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.tasks.etapa_atual_id is 'Preenchido no Sprint 5, quando o fluxo de etapas entrar.';
comment on column public.tasks.briefing_texto is 'Versao em texto puro do briefing, so para busca.';

create table if not exists public.subtasks (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks (id) on delete cascade,
  titulo           text not null,
  -- Prazo proprio, independente da task-mae: uma etapa de producao pode
  -- vencer bem antes da entrega final, e o calendario mostra os dois.
  prazo            date,
  responsavel_id   uuid references public.profiles (id) on delete set null,
  estimativa_horas numeric(6,2),
  tempo_real_horas numeric(6,2),
  concluida        boolean not null default false,
  concluida_em     timestamptz,
  ordem            integer not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.task_referencias (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks (id) on delete cascade,
  tipo           text not null check (tipo in ('link', 'arquivo')),
  url            text not null,
  titulo         text,
  arquivo_nome   text,
  adicionado_por uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.task_comentarios (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  autor_id   uuid not null references public.profiles (id),
  texto      text not null,
  resposta_a uuid references public.task_comentarios (id) on delete cascade,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- PASSO 3 - Indices
--
-- As quatro consultas que o painel faz o tempo todo: por cliente, por
-- responsavel, por prazo e por status.
-- ---------------------------------------------------------------------------
create index if not exists tasks_client_id_idx      on public.tasks (client_id);
create index if not exists tasks_responsavel_id_idx on public.tasks (responsavel_id);
create index if not exists tasks_prazo_idx          on public.tasks (prazo);
create index if not exists tasks_status_idx         on public.tasks (status);
create index if not exists subtasks_task_id_idx     on public.subtasks (task_id);
create index if not exists subtasks_prazo_idx       on public.subtasks (prazo);
create index if not exists subtasks_responsavel_idx on public.subtasks (responsavel_id);
create index if not exists task_referencias_task_idx on public.task_referencias (task_id);
create index if not exists task_comentarios_task_idx on public.task_comentarios (task_id);


-- ---------------------------------------------------------------------------
-- PASSO 4 - updated_at automatico
-- ---------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.tocar_updated_at();


-- ---------------------------------------------------------------------------
-- PASSO 5 - Quem pode mexer numa task
--
-- Gestao e Atendimento mexem em qualquer task; quem e responsavel mexe na
-- propria. is_atendimento() ja devolve true para gestao, entao nao precisa
-- repetir a checagem.
--
-- As tabelas filhas (subtarefas, referencias, comentarios) reaproveitam esta
-- funcao em vez de repetir a regra -- assim a permissao da task e da subtarefa
-- nunca saem do lugar uma da outra.
-- ---------------------------------------------------------------------------
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
    select 1 from public.tasks t
    where t.id = p_task_id
      and t.responsavel_id = (select auth.uid())
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Row Level Security
--
-- Usuario cliente nao alcanca nenhuma destas tabelas. O que o cliente enxerga
-- e outro conjunto de tabelas, no Sprint 12 -- por isso todas as policies
-- daqui exigem is_staff() ou mais.
-- ---------------------------------------------------------------------------
alter table public.tasks            enable row level security;
alter table public.subtasks         enable row level security;
alter table public.task_referencias enable row level security;
alter table public.task_comentarios enable row level security;

-- tasks ---------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.is_staff());

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_atendimento()
    or responsavel_id = (select auth.uid())
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.is_atendimento()
    or responsavel_id = (select auth.uid())
  )
  with check (
    public.is_atendimento()
    or responsavel_id = (select auth.uid())
  );

-- Apagar task e so para gestao: quem e responsavel edita a sua, mas remover do
-- historico e decisao de quem gerencia.
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_gestor());

-- subtasks ------------------------------------------------------------------
drop policy if exists subtasks_select on public.subtasks;
drop policy if exists subtasks_write  on public.subtasks;

create policy subtasks_select on public.subtasks
  for select to authenticated
  using (public.is_staff());

create policy subtasks_write on public.subtasks
  for all to authenticated
  using (public.pode_editar_task(task_id))
  with check (public.pode_editar_task(task_id));

-- task_referencias ----------------------------------------------------------
drop policy if exists task_referencias_select on public.task_referencias;
drop policy if exists task_referencias_write  on public.task_referencias;

create policy task_referencias_select on public.task_referencias
  for select to authenticated
  using (public.is_staff());

create policy task_referencias_write on public.task_referencias
  for all to authenticated
  using (public.pode_editar_task(task_id))
  with check (public.pode_editar_task(task_id));

-- task_comentarios ----------------------------------------------------------
drop policy if exists task_comentarios_select on public.task_comentarios;
drop policy if exists task_comentarios_insert on public.task_comentarios;
drop policy if exists task_comentarios_update on public.task_comentarios;
drop policy if exists task_comentarios_delete on public.task_comentarios;

create policy task_comentarios_select on public.task_comentarios
  for select to authenticated
  using (public.is_staff());

-- Qualquer pessoa da equipe comenta, em nome dela mesma.
create policy task_comentarios_insert on public.task_comentarios
  for insert to authenticated
  with check (public.is_staff() and autor_id = (select auth.uid()));

-- Editar e apagar so o proprio comentario. Gestao tambem apaga, para moderar.
create policy task_comentarios_update on public.task_comentarios
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy task_comentarios_delete on public.task_comentarios
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 7 - Bucket dos arquivos de referencia
--
-- Privado, diferente do bucket de avatares: material de cliente nao pode
-- ficar acessivel por link solto. A leitura sai por URL assinada, gerada no
-- servidor, e so para quem e da equipe.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('task-arquivos', 'task-arquivos', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "task-arquivos: equipe le" on storage.objects';
  execute 'drop policy if exists "task-arquivos: equipe escreve" on storage.objects';
  execute 'drop policy if exists "task-arquivos: equipe apaga" on storage.objects';

  execute $politica$
    create policy "task-arquivos: equipe le" on storage.objects
      for select to authenticated
      using (bucket_id = 'task-arquivos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "task-arquivos: equipe escreve" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'task-arquivos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "task-arquivos: equipe apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'task-arquivos' and public.is_staff())
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 8 - Conferencia
-- ---------------------------------------------------------------------------
select
  'tudo pronto'                                              as situacao,
  (select count(*) from public.tasks)                        as tasks,
  (select count(*) from pg_tables where schemaname = 'public'
     and rowsecurity
     and tablename in ('tasks','subtasks','task_referencias','task_comentarios')) as tabelas_com_rls,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('tasks','subtasks','task_referencias','task_comentarios')) as policies,
  (select count(*) from pg_indexes where schemaname = 'public'
     and tablename in ('tasks','subtasks','task_referencias','task_comentarios')) as indices;
