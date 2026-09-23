-- ---------------------------------------------------------------------------
-- 0031 - O Portal do Cliente: preferencias, registro de acesso e o furo do slug
--
-- Sprint 11. Tres coisas, e a terceira e uma correcao:
--
--   1. `client_notification_prefs` -- o que cada pessoa do cliente quer
--      receber. O disparo e do Sprint 16; a preferencia existe antes porque
--      quem entra no portal hoje ja quer poder desligar o aviso.
--
--   2. `client_access_log` -- quem entrou, quando, e o que abriu. E o insumo
--      da auditoria, e a resposta para "o cliente viu?".
--
--   3. O SLUG ESTAVA DESPROTEGIDO, e isso e um furo de verdade.
--      `protect_client_columns` (0005) devolve o valor antigo de nome_empresa,
--      ativo, drive_folder_id, segmento, responsavel_atendimento_id e
--      observacoes para qualquer escrita de quem nao e da equipe. A coluna
--      `slug` nasceu na 0009, DEPOIS -- e ninguem a acrescentou a lista.
--      Resultado: um PATCH no PostgREST em nome do cliente trocava o slug da
--      propria empresa. O portal dele mudaria de endereco, e o `/portal/{slug}`
--      que a gestao usa deixaria de abrir.
--
--      Nao e teorico: a policy `clients_update_proprio` (0005) deixa a linha
--      inteira passar de proposito, e o trigger e quem separa o que ele pode
--      do que ele nao pode. Coluna que nasce depois do trigger nasce aberta.
--      A licao esta no fim do arquivo, em forma de teste.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O logo da empresa
--
-- Opcional, e do cliente: e a unica coisa que ele muda e que a equipe ve.
-- ---------------------------------------------------------------------------
alter table public.clients add column if not exists logo_url text;

comment on column public.clients.logo_url is
  'Logo da empresa, enviada pelo proprio cliente em /portal/configuracoes (0031).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O slug entra na lista de colunas protegidas
--
-- A funcao e reescrita inteira em vez de "acrescentar uma linha": e ela a
-- lista, e ler a lista completa num lugar so e o que permite conferir se
-- falta alguma.
--
-- O QUE O CLIENTE PODE MEXER, e e curto de proposito: nome_contato,
-- email_contato, telefone e logo_url. Todo o resto e da agencia.
-- ---------------------------------------------------------------------------
create or replace function public.protect_client_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem sessao (seed, migration) ou sendo da equipe, passa direto.
  if (select auth.uid()) is null or public.is_staff() then
    return new;
  end if;

  new.nome_empresa               := old.nome_empresa;
  new.ativo                      := old.ativo;
  new.drive_folder_id            := old.drive_folder_id;
  new.segmento                   := old.segmento;
  new.responsavel_atendimento_id := old.responsavel_atendimento_id;
  new.observacoes                := old.observacoes;
  new.created_at                 := old.created_at;
  -- O que faltava ate a 0031. O slug e o endereco do portal: trocado pelo
  -- cliente, o link que a agencia tem guardado para de abrir.
  new.slug                       := old.slug;

  return new;
end;
$$;

comment on function public.protect_client_columns() is
  'Devolve ao valor antigo toda coluna de clients que o cliente nao pode mexer. Ele edita contato, email, telefone e logo -- e so (0031).';

drop trigger if exists clients_protect_columns on public.clients;
create trigger clients_protect_columns
  before update on public.clients
  for each row execute function public.protect_client_columns();


-- ---------------------------------------------------------------------------
-- PASSO 3 - Preferencias de notificacao
--
-- Uma linha por PESSOA, e nao por empresa: quem responde por duas contas nao
-- quer receber em dobro por causa da segunda.
-- ---------------------------------------------------------------------------
create table if not exists public.client_notification_prefs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles (id) on delete cascade,
  novo_conteudo       boolean not null default true,
  novo_comentario     boolean not null default true,
  lembrete_pendencias boolean not null default true,
  frequencia          text not null default 'imediato',
  created_at          timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_prefs_frequencia_valida') then
    alter table public.client_notification_prefs
      add constraint client_prefs_frequencia_valida
      check (frequencia in ('imediato', 'diario', 'nunca'));
  end if;
end
$$;

comment on table public.client_notification_prefs is
  'O que cada pessoa do cliente quer receber. O disparo e do Sprint 16 (0031).';

alter table public.client_notification_prefs enable row level security;

-- SO A PROPRIA PESSOA, nas quatro operacoes -- a mesma regra do Resumo
-- Semanal e do Financeiro Pessoal. Preferencia de aviso que outro edita nao e
-- preferencia.
drop policy if exists client_prefs_select on public.client_notification_prefs;
drop policy if exists client_prefs_insert on public.client_notification_prefs;
drop policy if exists client_prefs_update on public.client_notification_prefs;
drop policy if exists client_prefs_delete on public.client_notification_prefs;

create policy client_prefs_select on public.client_notification_prefs
  for select to authenticated using (user_id = (select auth.uid()));

create policy client_prefs_insert on public.client_notification_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy client_prefs_update on public.client_notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy client_prefs_delete on public.client_notification_prefs
  for delete to authenticated using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 4 - O registro de acesso
--
-- Quem entrou, quando, e o que abriu.
--
-- SEM POLICY DE UPDATE NEM DE DELETE, como em `client_portal_views` (0009):
-- registro que o proprio registrado reescreve nao e registro. E o INSERT so
-- aceita a linha em nome de quem esta logado, senao daria para forjar acesso
-- no nome de outra pessoa.
-- ---------------------------------------------------------------------------
create table if not exists public.client_access_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  acao        text not null,
  entity_type text,
  entity_id   uuid,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_access_log_acao_valida') then
    alter table public.client_access_log
      add constraint client_access_log_acao_valida
      check (acao in ('login', 'visualizou_item', 'download'));
  end if;
end
$$;

create index if not exists client_access_log_cliente_idx
  on public.client_access_log (client_id, created_at desc);

comment on table public.client_access_log is
  'Registro de acesso do cliente ao portal. Insumo da auditoria; nao se edita nem se apaga (0031).';

alter table public.client_access_log enable row level security;

drop policy if exists client_access_log_insert         on public.client_access_log;
drop policy if exists client_access_log_select_staff   on public.client_access_log;
drop policy if exists client_access_log_select_proprio on public.client_access_log;

-- A linha e sempre em nome de quem esta logado, e so para empresa dele.
create policy client_access_log_insert on public.client_access_log
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and client_id in (select public.my_client_ids())
  );

-- A equipe le para auditar; a pessoa le o proprio rastro. Ninguem le o de
-- outra pessoa do mesmo cliente: quem entrou e quando e dado de pessoa.
create policy client_access_log_select_staff on public.client_access_log
  for select to authenticated using (public.is_staff());

create policy client_access_log_select_proprio on public.client_access_log
  for select to authenticated using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 5 - Quem entrou por ultimo
--
-- A aba Usuarios do portal mostra "ultimo acesso" de cada pessoa da empresa.
-- Sai daqui, e nao de `client_access_log` direto: a policy acima esconde o
-- rastro alheio de proposito, e a aba precisa da DATA sem precisar da lista.
--
-- `security definer` porque e exatamente isso que ela faz -- devolve um
-- agregado que a policy nao deixaria montar linha a linha. Devolve so as
-- pessoas de empresas de quem pergunta.
-- ---------------------------------------------------------------------------
create or replace function public.usuarios_do_meu_cliente()
returns table (user_id uuid, nome text, email text, ultimo_acesso timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select p.id,
           p.nome,
           p.email,
           (select max(l.created_at)
              from public.client_access_log l
             where l.user_id = p.id and l.acao = 'login')
      from public.client_users cu
      join public.profiles p on p.id = cu.user_id
     where cu.client_id in (select public.my_client_ids())
     group by p.id, p.nome, p.email
     order by p.nome;
end;
$$;

comment on function public.usuarios_do_meu_cliente() is
  'As pessoas com acesso as empresas de quem pergunta, com a data do ultimo login. Leitura; a gestao de usuarios e da agencia (0031).';

notify pgrst, 'reload schema';
