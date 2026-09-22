-- ===========================================================================
-- Seed de desenvolvimento
--
-- Quatro usuarios (um de cada perfil), duas empresas cliente e os vinculos,
-- para dar para testar tudo assim que o banco sobe.
--
-- SENHA DE TODOS:  FullHub@2026
--
--   socia@fullconnectkey.com.br   -> socio          -> /painel
--   dev@fullconnectkey.com.br     -> desenvolvedor  -> /painel
--   colab@fullconnectkey.com.br   -> colaborador    -> /painel
--   contato@clientealfa.com.br    -> cliente        -> /portal
--
-- ---------------------------------------------------------------------------
-- COMO USAR
--
-- Ambiente local (Supabase CLI) -- e onde este arquivo roda sozinho:
--     npx supabase start
--     npx supabase db reset        # aplica migrations e depois este seed
--
-- Projeto hospedado em supabase.com:
--     NAO rode este arquivo la. Escrever direto em auth.users num projeto de
--     produção é frágil: o formato dessa tabela é do Supabase e pode mudar.
--     Crie as pessoas em Authentication > Users > Add user, marcando
--     "Auto Confirm User", e em "User Metadata" coloque:
--         { "nome": "Ana Souza", "role": "socio" }
--     Depois rode apenas o bloco final deste arquivo (empresas e vinculos).
--
-- Rodar de novo nao duplica nada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Usuarios (somente ambiente local)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'socia@fullconnectkey.com.br',
   crypt('FullHub@2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"socio"}',
   '{"nome":"Ana Souza","role":"socio"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'dev@fullconnectkey.com.br',
   crypt('FullHub@2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"desenvolvedor"}',
   '{"nome":"Diego Reis","role":"desenvolvedor"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'colab@fullconnectkey.com.br',
   crypt('FullHub@2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"colaborador"}',
   '{"nome":"Carla Nunes","role":"colaborador"}', now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'contato@clientealfa.com.br',
   crypt('FullHub@2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"cliente"}',
   '{"nome":"Caio Alves","role":"cliente"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- O Supabase exige uma identidade por usuario para o login por senha funcionar.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004'
)
and not exists (
  select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
);

-- Garante o role mesmo se o profile ja tiver nascido antes deste seed.
update public.profiles p
set role = v.role, nome = v.nome
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Ana Souza',   'socio'::public.user_role),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Diego Reis',  'desenvolvedor'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Carla Nunes', 'colaborador'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Caio Alves',  'cliente')
) as v(id, nome, role)
where p.id = v.id;


-- ---------------------------------------------------------------------------
-- Empresas, vinculos e RH
--
-- Este bloco funciona em qualquer ambiente, inclusive no projeto hospedado --
-- desde que os usuarios ja existam.
-- ---------------------------------------------------------------------------
insert into public.clients (id, nome_empresa, nome_contato, email_contato, telefone)
values
  ('c0000000-0000-0000-0000-00000000000a', 'Cliente Alfa', 'Caio Alves',
   'contato@clientealfa.com.br', '(11) 98888-0001'),
  ('c0000000-0000-0000-0000-00000000000b', 'Cliente Beta', 'Bianca Prado',
   'contato@clientebeta.com.br', '(11) 98888-0002')
on conflict (id) do nothing;

-- Caio responde pela Alfa. A Beta fica sem contato com acesso de proposito,
-- para dar para testar que um cliente nao enxerga empresa que nao e dele.
insert into public.client_users (client_id, user_id)
select 'c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000004'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000004')
on conflict (client_id, user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select * from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Sócia-diretora',    'Direção',    'Atendimento',  date '2021-03-01'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Desenvolvedor',     'Tecnologia', 'Dev',          date '2023-08-14'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Analista de contas','Atendimento','Atendimento',  date '2024-02-05')
) as v(user_id, cargo, area, funcao, data_admissao)
where exists (select 1 from public.profiles p where p.id = v.user_id)
on conflict (user_id) do nothing;
