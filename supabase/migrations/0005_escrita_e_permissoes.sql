-- ===========================================================================
-- 0005 - Escrita, permissoes granulares e perfil da propria empresa
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema.
--
-- O QUE ELE CORRIGE
--   1. As policies de clients, client_users e team_members eram `for all`.
--      Funcionavam, mas nivelavam INSERT, UPDATE e DELETE na mesma regra: um
--      desenvolvedor conseguia APAGAR empresa e ficha de RH. Agora cada
--      comando tem a sua regra, e DELETE e so de socio.
--   2. Um desenvolvedor nao conseguia salvar o nome de outra pessoa em
--      profiles -- a policy de update so aceitava o proprio registro ou socio.
--      A tela dizia "Dados salvos" e nada mudava.
--   3. O usuario cliente nao tinha nenhuma policy de UPDATE em clients, entao
--      nao conseguia manter os proprios dados de contato. Agora consegue, e um
--      trigger garante que ele mexa apenas em nome_contato, email_contato e
--      telefone.
--   4. O trigger que cria o profile derrubava a criacao do usuario inteiro
--      quando encontrava um e-mail repetido. Agora ele avisa e deixa a
--      aplicacao resolver, em vez de estourar "Database error creating new
--      user" no Supabase Auth.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O trigger de criacao de profile nao derruba mais o cadastro
--
-- Se algo aqui falhar, o usuario em auth.users continua sendo criado e a
-- Server Action cria a linha em profiles no passo seguinte. Preferimos um
-- aviso no log a um cadastro que nao acontece e nao explica o motivo.
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

  begin
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
  exception
    when others then
      raise warning 'handle_new_user nao criou o profile de % (%): %',
        new.email, new.id, sqlerrm;
  end;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Quem muda o que em profiles
--
-- A gestao (desenvolvedor ou socio) edita o cadastro de qualquer pessoa --
-- nome, avatar, e ligar/desligar o acesso. O perfil de acesso (role) continua
-- sendo exclusividade do socio, garantida pelo trigger logo abaixo.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_update        on public.profiles;
drop policy if exists profiles_update_self   on public.profiles;
drop policy if exists profiles_update_gestor on public.profiles;

create policy profiles_update_self on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy profiles_update_gestor on public.profiles
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- Ninguem se promove sozinho, e ninguem alem do socio promove ninguem.
--
-- `ativo` agora e liberado para a gestao: desativar colaborador e operacao de
-- gestao, nao de socio. `role` continua so com o socio.
--
-- Com auth.uid() nulo o pedido nao veio de um usuario logado: veio do SQL
-- Editor, da chave de servico ou do proprio trigger de cadastro.
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

  if not public.is_gestor() then
    new.ativo := old.ativo;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();


-- ---------------------------------------------------------------------------
-- PASSO 3 - clients: uma regra por comando
--
-- Ler: equipe interna ve tudo, cliente ve so as empresas dele.
-- Criar e editar: gestao.
-- Editar os proprios dados de contato: o usuario cliente da empresa.
-- Apagar: so socio -- e mesmo assim a aplicacao bloqueia quando ha vinculo.
-- ---------------------------------------------------------------------------
drop policy if exists clients_write          on public.clients;
drop policy if exists clients_insert         on public.clients;
drop policy if exists clients_update         on public.clients;
drop policy if exists clients_update_gestor  on public.clients;
drop policy if exists clients_update_proprio on public.clients;
drop policy if exists clients_delete         on public.clients;

create policy clients_insert on public.clients
  for insert to authenticated
  with check (public.is_gestor());

create policy clients_update_gestor on public.clients
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

create policy clients_update_proprio on public.clients
  for update to authenticated
  using (id in (select public.my_client_ids()))
  with check (id in (select public.my_client_ids()));

create policy clients_delete on public.clients
  for delete to authenticated
  using (public.is_socio());

-- O cliente edita contato, e so contato.
--
-- A policy acima deixa a linha inteira passar; e este trigger que devolve as
-- demais colunas ao valor anterior. Sem ele, o portal poderia renomear a
-- empresa, se reativar sozinho ou trocar a pasta do Drive.
create or replace function public.protect_client_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  return new;
end;
$$;

drop trigger if exists clients_protect_columns on public.clients;
create trigger clients_protect_columns
  before update on public.clients
  for each row execute function public.protect_client_columns();


-- ---------------------------------------------------------------------------
-- PASSO 4 - client_users e team_members: uma regra por comando
-- ---------------------------------------------------------------------------
drop policy if exists client_users_write  on public.client_users;
drop policy if exists client_users_insert on public.client_users;
drop policy if exists client_users_update on public.client_users;
drop policy if exists client_users_delete on public.client_users;

create policy client_users_insert on public.client_users
  for insert to authenticated
  with check (public.is_gestor());

create policy client_users_update on public.client_users
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

create policy client_users_delete on public.client_users
  for delete to authenticated
  using (public.is_gestor());

drop policy if exists team_members_write  on public.team_members;
drop policy if exists team_members_insert on public.team_members;
drop policy if exists team_members_update on public.team_members;
drop policy if exists team_members_delete on public.team_members;

create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (public.is_gestor());

create policy team_members_update on public.team_members
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

create policy team_members_delete on public.team_members
  for delete to authenticated
  using (public.is_socio());


-- ---------------------------------------------------------------------------
-- PASSO 5 - Conferencia
-- ---------------------------------------------------------------------------
do $$
declare
  faltando text;
begin
  select string_agg(alvo, ', ')
    into faltando
  from (
    select t.tabela || '/' || c.cmd as alvo
    from (values ('clients'), ('client_users'), ('team_members')) as t(tabela)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as c(cmd)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tabela and p.cmd = c.cmd
    )
  ) pendentes;

  if faltando is not null then
    raise exception 'Faltou policy de escrita para: %', faltando;
  end if;
end
$$;

select
  'tudo pronto' as situacao,
  (select count(*) from pg_policies where schemaname = 'public' and cmd = 'INSERT') as policies_insert,
  (select count(*) from pg_policies where schemaname = 'public' and cmd = 'UPDATE') as policies_update,
  (select count(*) from pg_policies where schemaname = 'public' and cmd = 'DELETE') as policies_delete;
