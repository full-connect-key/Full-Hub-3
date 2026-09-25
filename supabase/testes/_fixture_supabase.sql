-- Simula o que o Supabase ja traz pronto, para as migrations rodarem iguais.
create extension if not exists pgcrypto;

do $$ begin create role anon nologin;              exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin;     exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;

-- As colunas de auth.users que o SEED usa. Nao sao todas as que o Supabase
-- tem -- so as que este projeto toca. Sem elas o seed real nao roda aqui, e
-- entao nao da para conferir se ele funciona antes de mandar para producao.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_super_admin boolean default false,
  last_sign_in_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table auth.users add column if not exists instance_id            uuid;
alter table auth.users add column if not exists aud                    text;
alter table auth.users add column if not exists role                   text;
alter table auth.users add column if not exists encrypted_password     text;
alter table auth.users add column if not exists email_confirmed_at     timestamptz;
alter table auth.users add column if not exists raw_app_meta_data      jsonb default '{}'::jsonb;
alter table auth.users add column if not exists is_super_admin         boolean default false;
alter table auth.users add column if not exists last_sign_in_at        timestamptz;
alter table auth.users add column if not exists confirmation_token     text;
alter table auth.users add column if not exists recovery_token         text;
alter table auth.users add column if not exists email_change_token_new text;
alter table auth.users add column if not exists email_change           text;
alter table auth.users add column if not exists updated_at             timestamptz not null default now();

create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  provider_id     text not null,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (provider_id, provider)
);

-- O Supabase traz a extensao pgcrypto habilitada; o seed usa crypt() para a
-- senha de desenvolvimento.
create extension if not exists pgcrypto;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- ---------------------------------------------------------------------------
-- O `realtime` que a 0057 configura.
--
-- Num projeto Supabase de verdade este schema ja vem pronto: `realtime.messages`
-- e a tabela por onde passa toda mensagem de canal PRIVADO, e a RLS dela e o
-- que decide quem pode ouvir cada canal. `realtime.topic()` devolve o nome do
-- canal da inscricao que esta sendo autorizada.
--
-- O STUB EXISTE PARA A BATERIA PODER TESTAR A POLICY, e nao so para a migration
-- rodar. Sem ele a autorizacao do canal seria a unica regra do produto que
-- ninguem confere -- e a pergunta "o cliente ouve o canal da equipe?" e
-- exatamente do tipo que nao se responde de olho.
--
-- `realtime.topic()` aqui le um GUC, do mesmo jeito que `auth.uid()` acima le
-- o `sub`. No Supabase ele le o topico da requisicao de inscricao; o que
-- importa para a policy e que devolva o nome do canal.
-- ---------------------------------------------------------------------------
create schema if not exists realtime;

create table if not exists realtime.messages (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null,
  extension  text not null,
  payload    jsonb,
  event      text,
  private    boolean default true,
  inserted_at timestamptz not null default now()
);
alter table realtime.messages enable row level security;

create or replace function realtime.topic() returns text
language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')
$$;

grant usage on schema realtime to anon, authenticated, service_role;
grant select, insert on realtime.messages to anon, authenticated, service_role;
grant execute on function realtime.topic() to anon, authenticated, service_role;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter table auth.users add column if not exists raw_app_meta_data jsonb default '{}'::jsonb;
