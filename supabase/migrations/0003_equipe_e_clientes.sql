-- ===========================================================================
-- 0003 - Cadastro base: equipe e clientes
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
-- Pode ser executado mais de uma vez sem problema.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Funcoes da equipe interna
--
-- A coluna funcao era texto livre. Vira enum para o banco recusar valor
-- inventado -- e porque a regra do Atendimento depende desse valor ser exato.
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.team_funcao as enum (
    'Atendimento', 'Social Media', 'Redator', 'Design',
    'Audiovisual', 'Trafego', 'Desenvolvimento', 'Gestao', 'Outro'
  );
exception
  when duplicate_object then null;
end
$$;

-- Normaliza o que ja existe ANTES do cast. O seed de desenvolvimento gravou
-- 'Dev', que nao esta no enum: sem esta limpeza o alter table falharia e a
-- migration inteira seria desfeita.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members'
      and column_name = 'funcao' and data_type = 'text'
  ) then
    update public.team_members set funcao = 'Desenvolvimento'
      where funcao in ('Dev', 'Desenvolvedor', 'dev');
    update public.team_members set funcao = 'Trafego'
      where funcao in ('Tráfego', 'trafego');
    update public.team_members set funcao = 'Gestao'
      where funcao in ('Gestão', 'gestao');
    update public.team_members set funcao = 'Social Media'
      where lower(funcao) = 'social media';

    -- Qualquer outra coisa vira 'Outro' em vez de derrubar a migration.
    update public.team_members set funcao = 'Outro'
      where funcao is not null
        and funcao not in ('Atendimento', 'Social Media', 'Redator', 'Design',
                           'Audiovisual', 'Trafego', 'Desenvolvimento', 'Gestao', 'Outro');

    alter table public.team_members
      alter column funcao type public.team_funcao using funcao::public.team_funcao;
  end if;
end
$$;

comment on column public.team_members.funcao is
  'O que a pessoa faz na agencia. Diferente de profiles.role, que e o acesso. Atendimento cria tasks mesmo sendo colaborador.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Colunas novas
-- ---------------------------------------------------------------------------
alter table public.team_members
  add column if not exists dias_ferias_ano integer not null default 30,
  add column if not exists ativo           boolean not null default true,
  add column if not exists desligado_em    date;

comment on column public.team_members.ativo is
  'Desligamento e desativacao, nunca exclusao: as tasks e os registros antigos precisam manter a autoria.';

alter table public.clients
  add column if not exists segmento                  text,
  add column if not exists responsavel_atendimento_id uuid references public.profiles (id) on delete set null,
  add column if not exists observacoes               text;

create index if not exists clients_responsavel_idx
  on public.clients (responsavel_atendimento_id);

create index if not exists team_members_funcao_idx
  on public.team_members (funcao);


-- ---------------------------------------------------------------------------
-- PASSO 3 - is_atendimento()
--
-- Quem esta no Atendimento pode criar tasks mesmo sendo 'colaborador'. Gestao
-- tambem pode, por definicao. Esta funcao e a unica fonte dessa regra daqui em
-- diante -- nenhum modulo deve repetir a consulta.
--
-- plpgsql e security definer pelos mesmos motivos das outras: corpo verificado
-- so na execucao, e sem reavaliar o RLS das tabelas que ela consulta.
-- ---------------------------------------------------------------------------
create or replace function public.is_atendimento()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.is_gestor() then
    return true;
  end if;

  return exists (
    select 1
    from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.user_id = (select auth.uid())
      and tm.funcao = 'Atendimento'
      and tm.ativo
      and p.ativo
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Avatares no Storage
--
-- Bucket publico: avatar de equipe nao e dado sensivel, e link publico evita
-- assinar URL a cada renderizacao de lista.
--
-- Cada pessoa so escreve dentro da pasta com o proprio id -- por isso o
-- caminho do arquivo tem que ser "<user_id>/<nome>".
--
-- O bloco checa se o schema storage existe para a migration tambem rodar em
-- um Postgres comum, sem o Supabase por volta.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  execute 'drop policy if exists "avatars: leitura publica" on storage.objects';
  execute 'drop policy if exists "avatars: escrever o proprio" on storage.objects';
  execute 'drop policy if exists "avatars: atualizar o proprio" on storage.objects';
  execute 'drop policy if exists "avatars: apagar o proprio" on storage.objects';

  execute $politica$
    create policy "avatars: leitura publica" on storage.objects
      for select using (bucket_id = 'avatars')
  $politica$;

  execute $politica$
    create policy "avatars: escrever o proprio" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $politica$;

  execute $politica$
    create policy "avatars: atualizar o proprio" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $politica$;

  execute $politica$
    create policy "avatars: apagar o proprio" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 5 - Conferencia
-- ---------------------------------------------------------------------------
select
  'tudo pronto'                                                   as situacao,
  (select count(*) from public.clients)                           as clients,
  (select count(*) from public.team_members)                      as team_members,
  (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'team_funcao')                              as funcoes,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_staff','is_gestor','is_socio','is_atendimento','auth_role','my_client_ids')) as funcoes_de_seguranca;
