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

grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter table auth.users add column if not exists raw_app_meta_data jsonb default '{}'::jsonb;
