-- ===========================================================================
-- Seed de desenvolvimento
--
-- Deixa o ambiente testavel de verdade: seis pessoas na equipe com funcoes
-- diferentes, tres empresas cliente (uma delas desativada, para conferir que
-- some das listas) e tres acessos ao portal.
--
-- SENHA DE TODOS:  FullHub@2026
--
--   EQUIPE INTERNA                            perfil          funcao
--   socia@fullconnectkey.com.br               socio           Gestao
--   dev@fullconnectkey.com.br                 desenvolvedor   Desenvolvimento
--   colab@fullconnectkey.com.br               colaborador     Atendimento
--   design@fullconnectkey.com.br              colaborador     Design
--   social@fullconnectkey.com.br              colaborador     Social Media
--   trafego@fullconnectkey.com.br             colaborador     Trafego
--
--   PORTAL DO CLIENTE                         empresa
--   contato@mundoverde.com.br                 Mundo Verde
--   marketing@mundoverde.com.br               Mundo Verde
--   contato@opticavisao.com.br                Optica Visao
--
--   Academia Corpo Livre entra DESATIVADA, sem ninguem com acesso.
--
-- ---------------------------------------------------------------------------
-- COMO USAR
--
-- Ambiente local (Supabase CLI) -- e onde este arquivo roda sozinho:
--     npx supabase start
--     npx supabase db reset        # aplica migrations e depois este seed
--
-- Projeto hospedado em supabase.com:
--     NAO rode o primeiro bloco la. Escrever direto em auth.users num projeto
--     de producao e fragil: o formato dessa tabela e do Supabase e pode mudar.
--     Crie as pessoas em Authentication > Users > Add user, marcando
--     "Auto Confirm User", e em "User Metadata" coloque:
--         { "nome": "Ana Souza", "role": "socio" }
--     Depois rode a partir de "PARTE 2".
--
-- Rodar de novo nao duplica nada.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PARTE 1 - Usuarios (somente ambiente local)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', v.id,
  'authenticated', 'authenticated', v.email,
  crypt('FullHub@2026', gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', v.perfil),
  jsonb_build_object('nome', v.nome, 'role', v.perfil),
  now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'socia@fullconnectkey.com.br',   'Ana Souza',      'socio'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'dev@fullconnectkey.com.br',     'Diego Reis',     'desenvolvedor'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'colab@fullconnectkey.com.br',   'Carla Nunes',    'colaborador'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'design@fullconnectkey.com.br',  'Bruno Lima',     'colaborador'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'social@fullconnectkey.com.br',  'Marina Costa',   'colaborador'),
  ('a0000000-0000-0000-0000-000000000007'::uuid, 'trafego@fullconnectkey.com.br', 'Rafael Dias',    'colaborador'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'contato@mundoverde.com.br',     'Caio Alves',     'cliente'),
  ('a0000000-0000-0000-0000-000000000008'::uuid, 'marketing@mundoverde.com.br',   'Juliana Prado',  'cliente'),
  ('a0000000-0000-0000-0000-000000000009'::uuid, 'contato@opticavisao.com.br',    'Marcos Vieira',  'cliente')
) as v(id, email, nome, perfil)
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
where u.email like '%@fullconnectkey.com.br'
   or u.email in (
     'contato@mundoverde.com.br',
     'marketing@mundoverde.com.br',
     'contato@opticavisao.com.br'
   )
and not exists (
  select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
);


-- ---------------------------------------------------------------------------
-- PARTE 2 - Perfis, empresas, acessos e RH
--
-- Este bloco funciona em qualquer ambiente, inclusive no projeto hospedado --
-- desde que os usuarios ja existam em auth.users.
-- ---------------------------------------------------------------------------

-- Garante nome e perfil mesmo se o profile tiver nascido antes deste seed.
update public.profiles p
set role = v.perfil, nome = v.nome
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Ana Souza',     'socio'::public.user_role),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Diego Reis',    'desenvolvedor'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Carla Nunes',   'colaborador'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'Bruno Lima',    'colaborador'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'Marina Costa',  'colaborador'),
  ('a0000000-0000-0000-0000-000000000007'::uuid, 'Rafael Dias',   'colaborador'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'Caio Alves',    'cliente'),
  ('a0000000-0000-0000-0000-000000000008'::uuid, 'Juliana Prado', 'cliente'),
  ('a0000000-0000-0000-0000-000000000009'::uuid, 'Marcos Vieira', 'cliente')
) as v(id, nome, perfil)
where p.id = v.id;

-- Empresas. A Academia Corpo Livre nasce desativada de proposito: e o caso de
-- teste de "some das listas e dos seletores sem perder nada".
insert into public.clients (id, nome_empresa, nome_contato, email_contato, telefone)
values
  ('c0000000-0000-0000-0000-00000000000a', 'Mundo Verde', 'Caio Alves',
   'contato@mundoverde.com.br', '(11) 98888-0001'),
  ('c0000000-0000-0000-0000-00000000000b', 'Óptica Visão', 'Marcos Vieira',
   'contato@opticavisao.com.br', '(11) 98888-0002'),
  ('c0000000-0000-0000-0000-00000000000c', 'Academia Corpo Livre', 'Renata Bastos',
   'contato@corpolivre.com.br', '(11) 98888-0003')
on conflict (id) do nothing;

update public.clients
set segmento = v.segmento,
    responsavel_atendimento_id = v.responsavel,
    ativo = v.ativo
from (values
  ('c0000000-0000-0000-0000-00000000000a'::uuid, 'Alimentação saudável',
   'a0000000-0000-0000-0000-000000000003'::uuid, true),
  ('c0000000-0000-0000-0000-00000000000b'::uuid, 'Varejo óptico',
   'a0000000-0000-0000-0000-000000000003'::uuid, true),
  ('c0000000-0000-0000-0000-00000000000c'::uuid, 'Academia',
   null, false)
) as v(id, segmento, responsavel, ativo)
where clients.id = v.id;

-- Quem enxerga o que no portal. A Mundo Verde tem dois acessos; a Academia
-- Corpo Livre nao tem nenhum, para dar para testar a exclusao de uma empresa
-- vazia e a leitura restrita de quem nao e dela.
insert into public.client_users (client_id, user_id)
select v.client_id, v.user_id
from (values
  ('c0000000-0000-0000-0000-00000000000a'::uuid, 'a0000000-0000-0000-0000-000000000004'::uuid),
  ('c0000000-0000-0000-0000-00000000000a'::uuid, 'a0000000-0000-0000-0000-000000000008'::uuid),
  ('c0000000-0000-0000-0000-00000000000b'::uuid, 'a0000000-0000-0000-0000-000000000009'::uuid)
) as v(client_id, user_id)
where exists (select 1 from public.profiles p where p.id = v.user_id)
on conflict (client_id, user_id) do nothing;

-- Um insert por pessoa, e nao um VALUES com varias linhas: no formato
-- "insert ... select * from (values ...)" o Postgres nao consegue inferir que
-- 'Atendimento' e do tipo team_funcao, e o insert falha assim que a migration
-- 0003 transforma a coluna em enum. Assim o literal e convertido direto para o
-- tipo da coluna, seja ele texto (antes da 0003) ou enum (depois).
insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000001'::uuid, 'Sócia-diretora', 'Direção', 'Gestao', date '2021-03-01'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000002'::uuid, 'Desenvolvedor', 'Tecnologia', 'Desenvolvimento', date '2023-08-14'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000002')
on conflict (user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000003'::uuid, 'Analista de contas', 'Atendimento', 'Atendimento', date '2024-02-05'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000003')
on conflict (user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000005'::uuid, 'Designer', 'Criação', 'Design', date '2024-06-10'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000005')
on conflict (user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000006'::uuid, 'Social media', 'Criação', 'Social Media', date '2025-01-20'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000006')
on conflict (user_id) do nothing;

insert into public.team_members (user_id, cargo, area, funcao, data_admissao)
select 'a0000000-0000-0000-0000-000000000007'::uuid, 'Analista de tráfego', 'Mídia', 'Trafego', date '2025-04-02'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000007')
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- Conferencia
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.profiles where role <> 'cliente')      as equipe,
  (select count(*) from public.profiles where role = 'cliente')       as usuarios_cliente,
  (select count(*) from public.clients)                               as empresas,
  (select count(*) from public.clients where not ativo)               as empresas_desativadas,
  (select count(*) from public.client_users)                          as acessos_ao_portal,
  (select count(*) from public.team_members where funcao = 'Atendimento') as no_atendimento;
