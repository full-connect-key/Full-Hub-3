-- ===========================================================================
-- 0002 - Estrutura base do Full Hub
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema.
--
-- O QUE ELE FAZ
--   Substitui a tabela `perfis` da migration 0001 pela estrutura definitiva
--   do produto: quatro perfis de acesso, empresas cliente, o vinculo entre
--   elas e os usuarios, e os dados de RH da equipe interna.
--
--   Os registros que ja existirem em `perfis` sao migrados para `profiles`
--   antes de a tabela antiga ser removida.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Perfis de acesso
--
--   cliente       - cliente da agencia, enxerga so o Portal e as proprias empresas
--   colaborador   - equipe interna, acesso operacional ao Painel
--   desenvolvedor - equipe interna com poder de gestao
--   socio         - acesso total, unico que muda o perfil de outra pessoa
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.user_role as enum ('cliente', 'colaborador', 'desenvolvedor', 'socio');
exception
  when duplicate_object then null;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Tabelas
-- ---------------------------------------------------------------------------

-- Espelha auth.users. O Supabase cuida de e-mail e senha em auth.users, que e
-- tabela dele; tudo que e nosso sobre a pessoa mora aqui.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  nome       text not null,
  role       public.user_role not null default 'colaborador',
  avatar_url text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table  public.profiles      is 'Uma linha por usuario, de qualquer perfil.';
comment on column public.profiles.role is 'Define o que a pessoa acessa. So socio altera o de outra pessoa.';
comment on column public.profiles.ativo is 'Desligar em vez de apagar preserva o historico de quem fez o que.';

-- Empresas atendidas pela agencia.
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  nome_empresa    text not null,
  nome_contato    text,
  email_contato   text,
  telefone        text,
  drive_folder_id text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.clients is 'Empresas clientes da agencia.';

-- Quem, do lado do cliente, enxerga qual empresa. E N:N porque uma pessoa pode
-- responder por mais de uma empresa do mesmo grupo, e uma empresa costuma ter
-- mais de um contato com acesso.
create table if not exists public.client_users (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

comment on table public.client_users is 'Vinculo entre usuarios cliente e as empresas que eles enxergam.';

create index if not exists client_users_user_id_idx on public.client_users (user_id);
create index if not exists client_users_client_id_idx on public.client_users (client_id);

-- Dados de RH da equipe interna. Separado de profiles porque só diz respeito a
-- quem é da agência, e porque a leitura é mais restrita.
create table if not exists public.team_members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.profiles (id) on delete cascade,
  cargo         text,
  area          text,
  funcao        text,
  data_admissao date,
  created_at    timestamptz not null default now()
);

comment on table  public.team_members        is 'Dados de RH da equipe interna.';
comment on column public.team_members.funcao is 'Atendimento, Social Media, Redator, Design, Dev. Atendimento pode criar tasks mesmo sendo colaborador.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Funcoes de seguranca
--
-- Sao a base de todo o RLS do projeto: as policies daqui em diante chamam
-- estas funcoes em vez de repetir a consulta.
--
-- Todas sao `security definer` por necessidade: elas consultam profiles, e o
-- RLS de profiles chama estas funcoes. Sem isso, uma coisa chamaria a outra em
-- loop infinito.
--
-- Todas sao plpgsql porque o Postgres so verifica o corpo de uma funcao
-- plpgsql na primeira execucao -- isso deixa a migration imune a problemas de
-- ordem e a execucoes parciais.
-- ---------------------------------------------------------------------------

-- Perfil de quem esta logado. Devolve null para visitante ou conta desativada.
create or replace function public.auth_role()
returns public.user_role
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  resposta public.user_role;
begin
  select p.role into resposta
  from public.profiles p
  where p.id = (select auth.uid()) and p.ativo;

  return resposta;
end;
$$;

-- E da equipe interna?
create or replace function public.is_staff()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return coalesce(public.auth_role() in ('colaborador', 'desenvolvedor', 'socio'), false);
end;
$$;

-- E socio?
create or replace function public.is_socio()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return coalesce(public.auth_role() = 'socio', false);
end;
$$;

-- Tem poder de gestao? (desenvolvedor ou socio)
create or replace function public.is_gestor()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return coalesce(public.auth_role() in ('desenvolvedor', 'socio'), false);
end;
$$;

-- Empresas que o usuario cliente logado enxerga.
create or replace function public.my_client_ids()
returns setof uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select cu.client_id
    from public.client_users cu
    where cu.user_id = (select auth.uid());
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Criacao automatica do profile
--
-- Quando o Supabase cria alguem em auth.users, a linha correspondente em
-- profiles nasce junto.
--
-- ATENCAO DE SEGURANCA: raw_user_meta_data e preenchido por quem se cadastra.
-- Se o cadastro aberto for ligado em Authentication > Providers, qualquer
-- pessoa poderia pedir role 'socio' no proprio cadastro. Por isso:
--   1. raw_app_meta_data (que so o admin escreve) tem prioridade;
--   2. o cadastro aberto deve permanecer DESLIGADO -- usuarios sao criados
--      pela equipe, em Authentication > Users.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_pedido text;
begin
  role_pedido := coalesce(
    new.raw_app_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'role'
  );

  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'pessoa'), '@', 1)
    ),
    case
      when role_pedido in ('cliente', 'colaborador', 'desenvolvedor', 'socio')
        then role_pedido::public.user_role
      else 'colaborador'::public.user_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ninguem se promove sozinho.
--
-- A policy de update deixa a pessoa editar o proprio registro, e isso inclui
-- as colunas role e ativo. Este trigger devolve essas duas ao valor anterior
-- quando quem edita nao e socio.
--
-- Com auth.uid() nulo, o pedido nao veio de um usuario logado: veio do SQL
-- Editor, da chave de servico ou do proprio trigger de cadastro. Nesses casos
-- a mudanca passa -- e assim que a equipe promove alguem.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null or public.is_socio() then
    return new;
  end if;

  new.role := old.role;
  new.ativo := old.ativo;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();


-- ---------------------------------------------------------------------------
-- PASSO 5 - Row Level Security
--
-- RLS ligado e nenhuma policy significa que ninguem le nada. Cada policy abre
-- uma excecao especifica. Esta e a protecao que vale de verdade: funciona
-- mesmo que alguem chame a API do Supabase direto, sem passar pelo site.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.clients      enable row level security;
alter table public.client_users enable row level security;
alter table public.team_members enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select_own    on public.profiles;
drop policy if exists profiles_select_gestor on public.profiles;
drop policy if exists profiles_update        on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_gestor on public.profiles
  for select to authenticated
  using (public.is_gestor());

-- O proprio registro, ou qualquer um se for socio. As colunas role e ativo
-- ficam protegidas pelo trigger profiles_protect_role.
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_socio())
  with check ((select auth.uid()) = id or public.is_socio());

-- Sem policy de insert ou delete: o profile nasce pelo trigger e morre junto
-- com o usuario em auth.users, pelo on delete cascade.

-- clients -------------------------------------------------------------------
drop policy if exists clients_select on public.clients;
drop policy if exists clients_write  on public.clients;

create policy clients_select on public.clients
  for select to authenticated
  using (
    public.is_staff()
    or id in (select public.my_client_ids())
  );

create policy clients_write on public.clients
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- client_users --------------------------------------------------------------
drop policy if exists client_users_select on public.client_users;
drop policy if exists client_users_write  on public.client_users;

create policy client_users_select on public.client_users
  for select to authenticated
  using (
    public.is_gestor()
    or user_id = (select auth.uid())
  );

create policy client_users_write on public.client_users
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- team_members --------------------------------------------------------------
drop policy if exists team_members_select on public.team_members;
drop policy if exists team_members_write  on public.team_members;

create policy team_members_select on public.team_members
  for select to authenticated
  using (public.is_staff());

create policy team_members_write on public.team_members
  for all to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 6 - Migracao do que existia na 0001
--
-- Leva os registros de `perfis` para `profiles` e remove a estrutura antiga.
-- Quem nunca aplicou a 0001 pode ignorar: este bloco nao faz nada nesse caso.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.perfis') is not null then
    insert into public.profiles (id, email, nome, role, avatar_url, ativo, created_at)
    select
      p.id,
      coalesce(p.email, u.email, p.id::text),
      coalesce(nullif(trim(p.nome_completo), ''), split_part(coalesce(p.email, u.email, 'pessoa'), '@', 1)),
      case when p.papel = 'admin' then 'socio' else 'colaborador' end::public.user_role,
      p.avatar_url,
      p.ativo,
      p.criado_em
    from public.perfis p
    left join auth.users u on u.id = p.id
    on conflict (id) do nothing;
  end if;
end
$$;

drop trigger if exists ao_criar_usuario on auth.users;
drop table if exists public.perfis cascade;
drop function if exists public.lidar_com_novo_usuario() cascade;
drop function if exists public.proteger_papel_do_perfil() cascade;
drop function if exists public.tocar_atualizado_em() cascade;
drop function if exists public.e_admin() cascade;

-- Usuarios que ja existiam em auth.users mas nunca ganharam profile.
insert into public.profiles (id, email, nome, role)
select
  u.id,
  coalesce(u.email, u.id::text),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'nome'), ''),
    split_part(coalesce(u.email, 'pessoa'), '@', 1)
  ),
  'colaborador'::public.user_role
from auth.users u
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- PASSO 7 - Conferencia
-- ---------------------------------------------------------------------------
select
  'tudo pronto'                                        as situacao,
  (select count(*) from public.profiles)               as profiles,
  (select count(*) from public.clients)                as clients,
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'clients', 'client_users', 'team_members')) as policies,
  (select count(*) from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('profiles', 'clients', 'client_users', 'team_members')) as tabelas_com_rls;
