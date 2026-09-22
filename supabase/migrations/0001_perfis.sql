-- ===========================================================================
-- 0001 - Perfis de usuario
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--
--   Atencao: se houver qualquer texto selecionado no editor, o Supabase roda
--   so a selecao. Rodar um pedaco do meio da erro
--   "relation public.perfis does not exist", porque a tabela e criada no
--   inicio. Clique no editor e use Ctrl+A antes de colar, para substituir
--   tudo, e nao deixe nada destacado ao clicar em Run.
--
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema: tudo aqui e idempotente.
--
-- O QUE ELE FAZ
--   O Supabase ja guarda e-mail e senha em auth.users, que e uma tabela dele
--   e nao deve ser alterada. Tudo que for "nosso" sobre a pessoa (nome, cargo,
--   papel) fica em public.perfis, ligada 1-para-1 com auth.users.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A tabela
--
-- Vem antes de tudo: as funcoes e as policies mais abaixo dependem dela.
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
-- PASSO 2 - Funcoes auxiliares
--
-- Todas em plpgsql de proposito. O Postgres nao valida o corpo de uma funcao
-- plpgsql na hora de cria-la, so quando ela roda pela primeira vez. Com isso,
-- criar estas funcoes nunca quebra por causa de ordem de execucao -- que foi
-- exatamente o erro que aparecia quando o script rodava pela metade.
-- ---------------------------------------------------------------------------

-- Mantem a coluna atualizado_em sempre correta.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- Quem esta pedindo e administrador?
--
-- security definer e obrigatorio aqui: a funcao consulta perfis, e o RLS de
-- perfis chama esta funcao. Sem security definer, uma coisa chamaria a outra
-- em loop infinito.
create or replace function public.e_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  resposta boolean;
begin
  select exists (
    select 1
    from public.perfis
    where id = (select auth.uid())
      and papel = 'admin'
      and ativo
  ) into resposta;

  return resposta;
end;
$$;

-- Cria o perfil sozinho quando um usuario novo e cadastrado em auth.users.
--
-- security definer porque o cadastro acontece antes de existir qualquer
-- sessao para o RLS avaliar.
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
    coalesce(
      new.raw_user_meta_data ->> 'nome_completo',
      new.raw_user_meta_data ->> 'full_name'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Ninguem se promove sozinho.
--
-- As policies deixam a pessoa criar e editar o proprio perfil -- inclusive as
-- colunas papel e ativo. Este trigger devolve essas duas colunas ao valor
-- anterior quando quem esta mexendo e um usuario comum.
--
-- Quando auth.uid() e nulo, o pedido nao veio de um usuario logado: veio do
-- SQL Editor, da chave de servico ou do proprio trigger de cadastro. Nesses
-- casos a mudanca passa -- e assim que voce promove alguem a admin.
create or replace function public.proteger_papel_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null or public.e_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.papel := 'membro';
    new.ativo := true;
  else
    new.papel := old.papel;
    new.ativo := old.ativo;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists perfis_proteger_papel on public.perfis;
create trigger perfis_proteger_papel
  before insert or update on public.perfis
  for each row execute function public.proteger_papel_do_perfil();

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.lidar_com_novo_usuario();


-- ---------------------------------------------------------------------------
-- PASSO 4 - Row Level Security
--
-- Com RLS ligado e nenhuma policy, ninguem le nada. Cada policy abaixo abre
-- uma excecao especifica. Esta e a protecao que vale de verdade: ela funciona
-- mesmo que alguem chame a API do Supabase direto, sem passar pelo site --
-- e a chave anon, que vai no navegador, e publica por natureza.
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;

drop policy if exists "perfis: ler o proprio"     on public.perfis;
drop policy if exists "perfis: admin le todos"    on public.perfis;
drop policy if exists "perfis: criar o proprio"   on public.perfis;
drop policy if exists "perfis: editar o proprio"  on public.perfis;
drop policy if exists "perfis: admin edita todos" on public.perfis;

create policy "perfis: ler o proprio"
  on public.perfis for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "perfis: admin le todos"
  on public.perfis for select
  to authenticated
  using (public.e_admin());

-- Rede de seguranca: se o trigger ao_criar_usuario nao puder ser criado
-- (alguns projetos restringem o schema auth), o proprio dashboard cria o
-- perfil que falta no primeiro acesso. O trigger acima ja forca papel
-- 'membro' nesse caso, entao a policy nao abre brecha.
create policy "perfis: criar o proprio"
  on public.perfis for insert
  to authenticated
  with check ((select auth.uid()) = id);

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

-- Sem policy de delete de proposito: o perfil morre junto com o usuario em
-- auth.users, pelo on delete cascade.


-- ---------------------------------------------------------------------------
-- PASSO 5 - Usuarios que ja existiam antes desta migration
-- ---------------------------------------------------------------------------
insert into public.perfis (id, email, nome_completo)
select u.id, u.email, u.raw_user_meta_data ->> 'nome_completo'
from auth.users u
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Conferencia
--
-- Se tudo deu certo, o resultado abaixo mostra "tudo pronto" e a contagem de
-- perfis. Se aparecer erro antes daqui, nada foi aplicado: o SQL Editor roda
-- o script inteiro dentro de uma transacao.
-- ---------------------------------------------------------------------------
select
  'tudo pronto'                             as situacao,
  (select count(*) from public.perfis)      as perfis,
  (select count(*) from pg_policies
     where schemaname = 'public'
       and tablename = 'perfis')            as policies;
