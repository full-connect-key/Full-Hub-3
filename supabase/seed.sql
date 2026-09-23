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
-- OS PARENTESES IMPORTAM. `AND` liga mais forte que `OR`: sem eles, a leitura
-- era "e-mail da agencia OU (e-mail de cliente E sem identidade)", e a guarda
-- so valia para os clientes. Rodar o seed duas vezes duplicava a identidade de
-- toda a equipe e quebrava com violacao de unicidade -- que e como o erro
-- apareceu.
where (
       u.email like '%@fullconnectkey.com.br'
    or u.email in (
         'contato@mundoverde.com.br',
         'marketing@mundoverde.com.br',
         'contato@opticavisao.com.br'
       )
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


-- ---------------------------------------------------------------------------
-- PARTE 3 - Demandas de exemplo (Sprint 3B)
--
-- Tres demandas cobrindo os casos que as telas precisam saber mostrar:
--
--   1. Campanha de Instagram  etapa concluida, etapa esperando aprovacao
--                             interna na SEGUNDA rodada, etapa bloqueada por
--                             dependencia;
--   2. Reels institucional    etapa com aval interno esperando o envio ao
--                             cliente -- a segunda lista da fila do
--                             desenvolvedor;
--   3. Plano de midia         tudo concluido, para a Task aparecer em
--                             "Concluido" sem ninguem ter digitado isso.
--
-- O status de cada Task nao e escrito aqui: o trigger recalcular_status_task
-- resolve sozinho a partir das subtarefas e das rodadas. Se voce mudar uma
-- subtarefa pelo SQL Editor, a Task acompanha na mesma transacao.
--
-- Roda mais de uma vez sem duplicar.
-- ---------------------------------------------------------------------------
do $$
declare
  mundo_verde   uuid;
  optica        uuid;
  carla         uuid := 'a0000000-0000-0000-0000-000000000003';  -- Atendimento
  bruno         uuid := 'a0000000-0000-0000-0000-000000000005';  -- Design
  marina        uuid := 'a0000000-0000-0000-0000-000000000006';  -- Social Media
  diego         uuid := 'a0000000-0000-0000-0000-000000000002';  -- Desenvolvedor
  campanha      uuid;
  reels         uuid;
  midia         uuid;
  conceito      uuid;
  kv            uuid;
  adaptacoes    uuid;
  roteiro       uuid;
  gravacao      uuid;
  levantamento  uuid;
  rodada        uuid;
begin
  select id into mundo_verde from public.clients where nome_empresa = 'Mundo Verde' limit 1;
  select id into optica      from public.clients where nome_empresa = 'Óptica Visão' limit 1;

  if mundo_verde is null or optica is null then
    raise notice 'Rode a PARTE 2 antes: as empresas de exemplo ainda nao existem.';
    return;
  end if;

  -- Ja rodou? Entao nao faz de novo.
  if exists (select 1 from public.tasks where titulo = 'Campanha de Instagram — linha de verão') then
    raise notice 'As demandas de exemplo ja existem.';
    return;
  end if;

  -- 1. Campanha de Instagram -------------------------------------------------
  -- Esta demanda EXIGE aprovacao do cliente para ser dada por entregue, e a
  -- etapa "Criar KV" logo abaixo e quem cumpre essa exigencia. Serve para o
  -- ambiente de desenvolvimento ter um caso onde a trava da 0014 esta em
  -- vigor de verdade -- e nao so tasks que encerram sem passar por ela.
  insert into public.tasks (client_id, titulo, briefing_texto, prioridade, data_inicio, data_fim, criado_por,
                            exigencia_aprovacao, link_entrega)
  values (mundo_verde, 'Campanha de Instagram — linha de verão',
          'Anunciar a nova linha de verão com foco em conversão direta.',
          'alta', current_date - 6, current_date + 8, carla,
          'cliente', 'https://drive.google.com/drive/folders/campanha-verao')
  returning id into campanha;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos, tempo_real_minutos, status)
  values (campanha, 'Criar conceito', 1, current_date - 1, marina, false, null, 120, 150, 'concluida')
  returning id into conceito;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos)
  values (campanha, 'Criar KV', 2, current_date + 1, bruno, true, 'cliente', 240)
  returning id into kv;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos)
  values (campanha, 'Adaptar formatos', 3, current_date + 4, marina, false, null, 90)
  returning id into adaptacoes;

  insert into public.subtask_dependencies (subtask_id, depende_de_id) values
    (kv, conceito),
    (adaptacoes, kv);

  -- Rodada 1: o desenvolvedor pediu ajustes. Ela FICA no historico -- rodada
  -- fechada nunca e reescrita nem apagada, e e disso que o acordeao e feito.
  insert into public.approval_rounds (subtask_id, numero_rodada, escopo, status, solicitado_por)
  values (kv, 1, 'interna', 'pendente', bruno)
  returning id into rodada;

  update public.approval_rounds
     set status = 'ajustes_solicitados', decidido_por = diego,
         decidido_em = now() - interval '2 days',
         comentario = 'Trocar a cor do fundo para o azul da marca.'
   where id = rodada;

  -- Rodada 2: refeita e enviada de novo, esperando decisao.
  insert into public.subtask_entregas (subtask_id, tipo, url, nome, enviado_por)
  values (kv, 'link', 'https://www.figma.com/file/exemplo', 'KV v2', bruno);

  insert into public.approval_rounds (subtask_id, numero_rodada, escopo, status, solicitado_por)
  values (kv, 2, 'interna', 'pendente', bruno);

  update public.subtasks set status = 'enviada_aprovacao' where id = kv;

  -- 2. Reels institucional ---------------------------------------------------
  insert into public.tasks (client_id, titulo, prioridade, data_inicio, data_fim, criado_por,
                            exigencia_aprovacao, link_entrega)
  values (optica, 'Reels institucional', 'urgente', current_date - 10, current_date + 5, carla,
          'interna', 'https://drive.google.com/drive/folders/reels-institucional')
  returning id into reels;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos, tempo_real_minutos)
  values (reels, 'Roteiro do reels', 1, current_date - 2, carla, true, 'cliente', 180, 210)
  returning id into roteiro;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos)
  values (reels, 'Gravação', 2, current_date + 5, bruno, false, null, 300)
  returning id into gravacao;

  insert into public.subtask_dependencies (subtask_id, depende_de_id) values (gravacao, roteiro);

  insert into public.subtask_entregas (subtask_id, tipo, url, nome, enviado_por)
  values (roteiro, 'link', 'https://docs.google.com/document/exemplo', 'Roteiro v1', carla);

  -- A ordem importa, e o banco cobra: a subtarefa so entra em
  -- `enviada_aprovacao` enquanto a rodada esta PENDENTE. Aprovar vem depois --
  -- e nao mexe no status dela, porque o tipo e "cliente": ela fica esperando o
  -- ENVIO, que e um ato deliberado do desenvolvedor.
  insert into public.approval_rounds (subtask_id, numero_rodada, escopo, status, solicitado_por)
  values (roteiro, 1, 'interna', 'pendente', carla)
  returning id into rodada;

  update public.subtasks set status = 'enviada_aprovacao' where id = roteiro;

  update public.approval_rounds
     set status = 'aprovada', decidido_por = diego, decidido_em = now() - interval '4 hours'
   where id = rodada;

  -- 3. Plano de midia --------------------------------------------------------
  insert into public.tasks (client_id, titulo, prioridade, data_inicio, data_fim, criado_por,
                            link_entrega)
  values (optica, 'Plano de mídia do trimestre', 'baixa', current_date - 30, current_date - 8, carla,
          'https://drive.google.com/drive/folders/plano-de-midia')
  returning id into midia;

  insert into public.subtasks (task_id, titulo, ordem, prazo, responsavel_id, requer_aprovacao, tipo_aprovacao, estimativa_minutos, tempo_real_minutos, status)
  values (midia, 'Levantamento de verbas', 1, current_date - 9, diego, false, null, 480, 600, 'concluida')
  returning id into levantamento;

  raise notice 'Demandas de exemplo criadas.';
end
$$;


-- ---------------------------------------------------------------------------
-- Conferencia das demandas
-- ---------------------------------------------------------------------------
select
  t.titulo,
  t.status                                                              as status_calculado,
  count(s.id)                                                           as subtarefas,
  count(*) filter (where s.status = 'concluida')                        as concluidas,
  (select count(*) from public.approval_rounds r
    join public.subtasks s2 on s2.id = r.subtask_id
   where s2.task_id = t.id and r.status = 'pendente')                   as rodadas_pendentes
from public.tasks t
left join public.subtasks s on s.task_id = t.id
group by t.id, t.titulo, t.status
order by t.titulo;


-- ===========================================================================
-- Full Days (Sprint 6)
--
-- O que estes dados fazem aparecer nas telas:
--
--   - a Marina (Criação) com ferias APROVADAS, que pintam a matriz de roxo e
--     BLOQUEIAM aqueles dias no calendario do Rafael, que e da mesma area --
--     e e assim que da para ver a regra funcionando sem esperar alguem pedir;
--   - um pedido PENDENTE, para a fila do socio nao nascer vazia;
--   - um dia de trabalho remoto marcado a mao, que e o outro caminho de
--     escrita da matriz.
--
-- As datas sao relativas a hoje (current_date), e nao fixas: seed com data
-- fixa envelhece e, meses depois, mostra "ferias" num passado que ninguem
-- reconhece.
-- ===========================================================================

-- Marina (Criação) de ferias daqui a duas semanas, ja aprovadas pela socia.
insert into public.hr_requests
  (id, user_id, tipo, data_inicio, data_fim, dias_uteis, motivo, status, aprovado_por, decidido_em)
select 'fd000000-0000-0000-0000-000000000001'::uuid,
       'a0000000-0000-0000-0000-000000000005'::uuid,
       'ferias',
       (current_date + 14)::date,
       (current_date + 20)::date,
       public.dias_uteis((current_date + 14)::date, (current_date + 20)::date),
       'Viagem em familia',
       'aprovada',
       'a0000000-0000-0000-0000-000000000001'::uuid,
       now()
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000005')
on conflict (id) do nothing;

-- Os dias uteis dela viram linha na matriz, com o vinculo ao pedido -- que e o
-- que impede a gestao de apagar isso com um clique.
insert into public.team_presence (user_id, data, status, hr_request_id)
select 'a0000000-0000-0000-0000-000000000005'::uuid,
       d.dia::date,
       'ferias',
       'fd000000-0000-0000-0000-000000000001'::uuid
  from generate_series((current_date + 14)::date, (current_date + 20)::date, interval '1 day') as d(dia)
 where extract(isodow from d.dia) < 6
   and not exists (select 1 from public.holidays h where h.data = d.dia::date)
   and exists (select 1 from public.hr_requests where id = 'fd000000-0000-0000-0000-000000000001')
on conflict (user_id, data) do nothing;

-- Rafael (mesma area da Marina) pediu e ainda espera decisao. Aparece na fila
-- do socio COM o aviso de que a Marina ja esta fora em parte do periodo.
insert into public.hr_requests
  (id, user_id, tipo, data_inicio, data_fim, dias_uteis, motivo, status)
select 'fd000000-0000-0000-0000-000000000002'::uuid,
       'a0000000-0000-0000-0000-000000000006'::uuid,
       'ferias',
       (current_date + 18)::date,
       (current_date + 24)::date,
       public.dias_uteis((current_date + 18)::date, (current_date + 24)::date),
       'Casamento da irma',
       'pendente'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000006')
on conflict (id) do nothing;

-- Carla trabalhou remoto ontem. Marcado a mao, sem pedido por tras.
insert into public.team_presence (user_id, data, status)
select 'a0000000-0000-0000-0000-000000000003'::uuid, (current_date - 1)::date, 'remoto'
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000003')
on conflict (user_id, data) do nothing;


-- ===========================================================================
-- SPRINT 8 -- Financeiro da agencia
--
-- Dados que fazem a tela contar uma historia em vez de so existir: dois
-- contratos mensais vivos, um trimestral, um titulo JA VENCIDO (para o
-- "atrasado" derivado aparecer sem ninguem ter mexido), um recebido, e
-- despesas espalhadas por seis meses para a serie do grafico nao ser uma
-- linha reta.
--
-- So o socio ve qualquer coisa disto. O seed grava como superusuario, o que
-- ignora RLS -- e e por isso que a bateria de testes existe: ela roda como
-- gente de verdade.
-- ===========================================================================

insert into public.contracts
  (id, client_id, nome, valor, recorrencia, dia_vencimento, data_inicio, data_fim, ativo)
values
  ('c7000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000a',
   'Fee mensal — social media', 4800.00, 'mensal', 10, (current_date - interval '8 months')::date, null, true),
  ('c7000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000b',
   'Fee mensal — conteúdo e mídia', 3200.00, 'mensal', 5, (current_date - interval '5 months')::date,
   (current_date + interval '45 days')::date, true),
  ('c7000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000c',
   'Campanha trimestral', 9000.00, 'trimestral', 20, (current_date - interval '6 months')::date, null, true)
on conflict (id) do nothing;

-- Receitas dos ultimos seis meses, vindas dos dois contratos mensais.
insert into public.finance_entries
  (tipo, client_id, contract_id, category_id, descricao, valor, competencia, vencimento, pagamento, status, criado_por)
select 'receita',
       ct.client_id,
       ct.id,
       (select id from public.finance_categories where nome = 'Fee mensal' and tipo = 'receita'),
       ct.nome,
       ct.valor,
       (date_trunc('month', current_date) - (n || ' months')::interval)::date,
       (date_trunc('month', current_date) - (n || ' months')::interval)::date + (ct.dia_vencimento - 1),
       -- O mes corrente fica EM ABERTO; os anteriores ja foram pagos.
       case when n = 0 then null
            else (date_trunc('month', current_date) - (n || ' months')::interval)::date + (ct.dia_vencimento + 1)
       end,
       case when n = 0 then 'previsto' else 'pago' end::public.fin_status,
       'a0000000-0000-0000-0000-000000000001'::uuid
  from public.contracts ct
 cross join generate_series(0, 5) as n
 where ct.id in ('c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002')
   and exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
-- O `where` repete o predicado do indice PARCIAL da 0013. Sem ele o Postgres
-- recusa com "no unique or exclusion constraint matching the ON CONFLICT
-- specification": a inferencia so casa com um indice parcial quando o
-- predicado e informado.
on conflict (contract_id, competencia) where contract_id is not null do nothing;

-- Um titulo VENCIDO e nao pago. E ele que faz o cartao "Em atraso" ter numero
-- e o selo vermelho aparecer na lista, sem ninguem ter gravado "atrasado".
insert into public.finance_entries
  (id, tipo, client_id, category_id, descricao, valor, competencia, vencimento, status, criado_por)
select 'f7000000-0000-0000-0000-000000000001'::uuid,
       'receita',
       'c0000000-0000-0000-0000-00000000000c',
       (select id from public.finance_categories where nome = 'Projeto pontual' and tipo = 'receita'),
       'Produção de vídeo institucional',
       6500.00,
       date_trunc('month', current_date)::date,
       (current_date - 9)::date,
       'faturado',
       'a0000000-0000-0000-0000-000000000001'::uuid
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- Um titulo vencendo nos proximos dias, para a lista de alertas ter as duas
-- caras -- o que ja passou e o que esta por vir.
insert into public.finance_entries
  (id, tipo, client_id, category_id, descricao, valor, competencia, vencimento, status, criado_por)
select 'f7000000-0000-0000-0000-000000000002'::uuid,
       'receita',
       'c0000000-0000-0000-0000-00000000000a',
       (select id from public.finance_categories where nome = 'Verba de mídia' and tipo = 'receita'),
       'Verba de mídia de outubro',
       5200.00,
       date_trunc('month', current_date)::date,
       (current_date + 4)::date,
       'faturado',
       'a0000000-0000-0000-0000-000000000001'::uuid
where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- Despesas dos mesmos seis meses. Valores variados de proposito: despesa
-- constante faria o grafico virar uma reta, e uma reta nao mostra se a
-- ferramenta de visualizacao esta funcionando.
insert into public.finance_entries
  (tipo, category_id, descricao, valor, competencia, vencimento, pagamento, status, fornecedor, criado_por)
select 'despesa',
       (select id from public.finance_categories where nome = d.categoria and tipo = 'despesa'),
       d.descricao,
       d.valor + (n * d.variacao),
       (date_trunc('month', current_date) - (n || ' months')::interval)::date,
       (date_trunc('month', current_date) - (n || ' months')::interval)::date + 14,
       case when n = 0 then null
            else (date_trunc('month', current_date) - (n || ' months')::interval)::date + 15
       end,
       case when n = 0 then 'previsto' else 'pago' end::public.fin_status,
       d.fornecedor,
       'a0000000-0000-0000-0000-000000000001'::uuid
  from (values
        ('Salários e pró-labore', 'Folha da equipe',        14200.00, 180.00, null),
        ('Ferramentas e software','Assinaturas e licenças',   890.00,  25.00, 'Adobe, Meta, Google'),
        ('Estrutura',             'Aluguel e contas',        2400.00,  40.00, null),
        ('Freelancers',           'Freela de edição',        1800.00, 260.00, 'Studio Ponto')
       ) as d(categoria, descricao, valor, variacao, fornecedor)
 cross join generate_series(0, 5) as n
 where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
   and not exists (
     select 1 from public.finance_entries fe
      where fe.descricao = d.descricao
        and fe.competencia = (date_trunc('month', current_date) - (n || ' months')::interval)::date
   );


-- ===========================================================================
-- SPRINT 8 -- Financeiro Pessoal da Carla
--
-- So a Carla enxerga isto. Esta aqui para a tela dela ter historia ao abrir,
-- e para a bateria poder provar que nem a socia alcanca.
-- ===========================================================================

insert into public.personal_finance_entries (user_id, tipo, descricao, categoria, valor, data, recorrente)
select 'a0000000-0000-0000-0000-000000000003'::uuid, p.tipo::public.pf_tipo, p.descricao, p.categoria,
       p.valor, (date_trunc('month', current_date) + (p.dia - 1 || ' days')::interval)::date, p.recorrente
  from (values
        ('entrada', 'Salário',            'Renda',       5800.00,  5, true),
        ('saida',   'Aluguel',            'Moradia',     1650.00, 10, true),
        ('saida',   'Mercado do mês',     'Alimentação',  820.00, 12, true),
        ('saida',   'Plano de saúde',     'Saúde',        410.00,  8, true),
        ('saida',   'Transporte',         'Transporte',   260.00, 15, false),
        ('saida',   'Cinema e jantar',    'Lazer',        180.00, 18, false)
       ) as p(tipo, descricao, categoria, valor, dia, recorrente)
 where exists (select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000003')
   and not exists (
     select 1 from public.personal_finance_entries pf
      where pf.user_id = 'a0000000-0000-0000-0000-000000000003'
        and pf.descricao = p.descricao
        and date_trunc('month', pf.data) = date_trunc('month', current_date)
   );
