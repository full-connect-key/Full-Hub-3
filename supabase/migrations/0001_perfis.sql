-- ===========================================================================
-- 0001 - Perfis de usuario
--
-- O Supabase ja guarda e-mail e senha na tabela auth.users, que e dele e nao
-- deve ser alterada. Tudo que for "nosso" sobre a pessoa (nome, cargo, papel)
-- fica em public.perfis, ligada 1-para-1 com auth.users.
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- (ou, com a CLI:  npx supabase db push)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome_completo text,
  email         text,
  cargo         text,
  avatar_url    text,
  papel         text        not null default 'membro' check (papel in ('admin', 'membro')),
  ativo         boolean     not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table  public.perfis        is 'Dados da equipe da agencia, 1-para-1 com auth.users.';
comment on column public.perfis.papel  is 'admin ve e edita tudo; membro ve apenas o proprio perfil.';
comment on column public.perfis.ativo  is 'Desligar em vez de apagar preserva o historico de quem fez o que.';

-- ---------------------------------------------------------------------------
-- atualizado_em automatico
-- ---------------------------------------------------------------------------
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------------
-- Cria o perfil sozinho quando um usuario novo aparece em auth.users
--
-- security definer: a funcao roda com os privilegios de quem a criou, porque
-- o cadastro acontece antes de existir qualquer sessao para o RLS avaliar.
-- ---------------------------------------------------------------------------
create or replace function public.lidar_com_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome_completo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome_completo', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.lidar_com_novo_usuario();

-- ---------------------------------------------------------------------------
-- e_admin(): usada pelas policies.
--
-- Precisa ser security definer para NAO reavaliar o RLS de perfis ao
-- consultar perfis -- senao a policy chamaria a si mesma em loop infinito.
-- ---------------------------------------------------------------------------
create or replace function public.e_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin' and ativo
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Com RLS ligado e sem policy, ninguem le nada. Cada policy abaixo abre uma
-- excecao especifica. Esta e a protecao que vale de verdade: mesmo que alguem
-- pegue a chave anon (que e publica por natureza), so enxerga o que as regras
-- daqui permitem.
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;

drop policy if exists "perfis: ler o proprio"        on public.perfis;
drop policy if exists "perfis: admin le todos"       on public.perfis;
drop policy if exists "perfis: editar o proprio"     on public.perfis;
drop policy if exists "perfis: admin edita todos"    on public.perfis;

create policy "perfis: ler o proprio"
  on public.perfis for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "perfis: admin le todos"
  on public.perfis for select
  to authenticated
  using (public.e_admin());

create policy "perfis: editar o proprio"
  on public.perfis for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "perfis: admin edita todos"
  on public.perfis for update
  to authenticated
  using (public.e_admin())
  with check (public.e_admin());

-- ---------------------------------------------------------------------------
-- Ninguem se promove sozinho.
--
-- A policy acima deixa a pessoa editar o proprio perfil -- inclusive as
-- colunas papel e ativo. Este trigger desfaz qualquer mudanca nessas duas
-- colunas quando quem edita nao e admin: em vez de recusar o update inteiro,
-- ele simplesmente mantem os valores antigos.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_papel_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.e_admin() then
    new.papel := old.papel;
    new.ativo := old.ativo;
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_proteger_papel on public.perfis;
create trigger perfis_proteger_papel
  before update on public.perfis
  for each row execute function public.proteger_papel_do_perfil();

-- Nenhuma policy de insert/delete de proposito: perfil nasce pelo trigger e
-- morre junto com o usuario em auth.users (on delete cascade).

-- ---------------------------------------------------------------------------
-- Para quem ja tinha usuarios antes desta migration
-- ---------------------------------------------------------------------------
insert into public.perfis (id, email, nome_completo)
select u.id, u.email, u.raw_user_meta_data ->> 'nome_completo'
from auth.users u
on conflict (id) do nothing;
