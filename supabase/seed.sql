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
  -- A etapa "Criar KV" logo abaixo pede aprovacao do CLIENTE, e e ela que
  -- segura o "entregue" desta demanda (migration 0023: a exigencia e de cada
  -- etapa, nao da task). Serve para o ambiente de desenvolvimento ter um caso
  -- onde a trava esta em vigor de verdade -- e nao so demandas que encerram
  -- sem passar por ela.
  insert into public.tasks (client_id, titulo, briefing_texto, prioridade, data_inicio, data_fim, criado_por,
                            link_entrega)
  values (mundo_verde, 'Campanha de Instagram — linha de verão',
          'Anunciar a nova linha de verão com foco em conversão direta.',
          'alta', current_date - 6, current_date + 8, carla,
          'https://drive.google.com/drive/folders/campanha-verao')
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
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por)
  values ('subtask', kv, 1, 'interna', 'pendente', bruno)
  returning id into rodada;

  update public.approval_rounds
     set status = 'ajustes_solicitados', decidido_por = diego,
         decidido_em = now() - interval '2 days',
         comentario = 'Trocar a cor do fundo para o azul da marca.'
   where id = rodada;

  -- Rodada 2: refeita e enviada de novo, esperando decisao.
  insert into public.subtask_entregas (subtask_id, tipo, url, nome, enviado_por)
  values (kv, 'link', 'https://www.figma.com/file/exemplo', 'KV v2', bruno);

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por)
  values ('subtask', kv, 2, 'interna', 'pendente', bruno);

  update public.subtasks set status = 'enviada_aprovacao' where id = kv;

  -- 2. Reels institucional ---------------------------------------------------
  insert into public.tasks (client_id, titulo, prioridade, data_inicio, data_fim, criado_por,
                            link_entrega)
  values (optica, 'Reels institucional', 'urgente', current_date - 10, current_date + 5, carla,
          'https://drive.google.com/drive/folders/reels-institucional')
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
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por)
  values ('subtask', roteiro, 1, 'interna', 'pendente', carla)
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
    join public.subtasks s2
      on s2.id = r.content_id and r.content_type = 'subtask'
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
-- SPRINT 9 -- Full Academy e Recomendacoes
--
-- Duas trilhas e alguns posts, para as telas terem historia ao abrir. A
-- segunda trilha fica em RASCUNHO de proposito: e o unico jeito de a tela de
-- gestao mostrar a diferenca entre "publicada" e "so a gestao ve".
-- ===========================================================================

do $$
declare
  ana      uuid := 'a0000000-0000-0000-0000-000000000001';
  diego    uuid := 'a0000000-0000-0000-0000-000000000002';
  carla    uuid := 'a0000000-0000-0000-0000-000000000003';
  bruno    uuid := 'a0000000-0000-0000-0000-000000000004';
  marina   uuid := 'a0000000-0000-0000-0000-000000000005';
  onboarding uuid;
  briefing   uuid;
  rascunho   uuid;
  kv         uuid;
  post       uuid;
  skill_copy uuid;
begin
  if not exists (select 1 from public.profiles where id = carla) then
    raise notice 'Sem equipe no seed; a Academy nao foi populada.';
    return;
  end if;

  if exists (select 1 from public.academy_tracks where titulo = 'Onboarding da casa') then
    raise notice 'A Academy de exemplo ja existe.';
    return;
  end if;

  select id into skill_copy from public.skills where nome ilike '%copy%' limit 1;

  -- 1. Trilha obrigatoria, publicada, com tres tipos diferentes de material
  insert into public.academy_tracks (titulo, descricao, area, obrigatoria, publicada, ordem, criado_por)
  values ('Onboarding da casa',
          'Como a agencia trabalha: o fluxo de uma demanda, quem aprova o que, e onde cada coisa mora.',
          'Processos', true, true, 1, diego)
  returning id into onboarding;

  insert into public.academy_materials (track_id, titulo, descricao, tipo, url, duracao_minutos, ordem)
  values
    (onboarding, 'Boas-vindas da Ana', 'O que a Full Connect Key faz e para quem.',
     'video', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 12, 1),
    (onboarding, 'O caminho de uma demanda', 'Da abertura da task a entrega aprovada.',
     'artigo', 'https://exemplo.invalid/fluxo-da-demanda', 20, 2),
    (onboarding, 'Modelo de briefing', 'O que todo briefing precisa responder.',
     'template', null, null, 3);

  -- 2. Trilha ligada a uma skill -- e a ponte com o Sprint 7
  insert into public.academy_tracks (titulo, descricao, area, obrigatoria, publicada, ordem, criado_por)
  values ('Escrita para redes',
          'Copy que funciona em feed, em story e em legenda.',
          'Conteudo', false, true, 2, diego)
  returning id into briefing;

  insert into public.academy_materials (track_id, titulo, descricao, tipo, url, duracao_minutos, ordem, skill_id)
  values
    (briefing, 'Copy que para o dedo', 'Os tres primeiros segundos de uma legenda.',
     'video', 'https://vimeo.com/76979871', 18, 1, skill_copy),
    (briefing, 'Guia de tom de voz', 'Como cada cliente fala, e como nao falar por ele.',
     'pdf', null, 25, 2, skill_copy);

  -- 3. Trilha em RASCUNHO: a equipe nao enxerga, nem por endereco direto
  insert into public.academy_tracks (titulo, descricao, area, obrigatoria, publicada, ordem, criado_por)
  values ('Midia paga do zero',
          'Em producao. So a gestao ve esta enquanto nao for publicada.',
          'Midia', false, false, 3, diego)
  returning id into rascunho;

  insert into public.academy_materials (track_id, titulo, tipo, url, duracao_minutos, ordem)
  values (rascunho, 'Estrutura de campanha', 'artigo', 'https://exemplo.invalid/midia', 30, 1);

  -- Progresso: a Carla comecou o onboarding e anotou algo. A anotacao e dela.
  insert into public.academy_progress (user_id, material_id, concluido, anotacoes)
  select carla, m.id, m.ordem = 1,
         case when m.ordem = 1 then 'Rever a parte de quem aprova o que.' end
    from public.academy_materials m
   where m.track_id = onboarding and m.ordem <= 2;

  -- O Bruno terminou a obrigatoria: e o que da a aba Acompanhamento algo a
  -- mostrar alem de zeros.
  insert into public.academy_progress (user_id, material_id, concluido)
  select bruno, m.id, true from public.academy_materials m where m.track_id = onboarding;

  -- A VITRINE "RECOMENDADAS PARA VOCE" SAIU COM O MODULO (0043). Havia aqui
  -- um `insert` em `user_skills` para a Marina, que fazia "Escrita para redes"
  -- aparecer na vitrine dela. A tabela foi apagada; a etiqueta do material
  -- continua, e e o que o Academy usa hoje.

  -- 4. O feed
  insert into public.recommendations (autor_id, categoria, titulo, descricao, url, tags, created_at)
  values (carla, 'ferramenta', 'Figma Slides',
          'Da para montar apresentacao de campanha sem sair do arquivo do KV.',
          'https://www.figma.com/slides/', array['design','apresentacao'], now() - interval '2 hours')
  returning id into post;

  insert into public.recommendation_likes (recommendation_id, user_id) values (post, bruno), (post, marina);
  insert into public.recommendation_comments (recommendation_id, autor_id, texto)
  values (post, marina, 'Uso desde a semana passada, economizou meu domingo.')
  returning id into kv;
  insert into public.recommendation_comments (recommendation_id, autor_id, texto, resposta_a)
  values (post, bruno, 'Boa, vou testar no proximo job.', kv);

  insert into public.recommendations (autor_id, categoria, titulo, descricao, url, tags, created_at)
  values (bruno, 'filme', 'Abstract: The Art of Design',
          'A temporada sobre design grafico vale por tres cursos.',
          'https://www.netflix.com/title/80057883', array['design','inspiracao'],
          now() - interval '2 days')
  returning id into post;
  insert into public.recommendation_likes (recommendation_id, user_id) values (post, carla);

  insert into public.recommendations (autor_id, categoria, titulo, descricao, tags, created_at)
  values (marina, 'podcast', 'Braincast — episodio sobre marcas',
          'Serve para a conversa de posicionamento com cliente novo.',
          array['estrategia'], now() - interval '6 days');

  insert into public.recommendations (autor_id, categoria, titulo, descricao, url, tags, created_at)
  values (ana, 'livro', 'Obviously Awesome',
          'Posicionamento explicado sem jargao. Curto.',
          'https://www.aprildunford.com/obviously-awesome',
          array['estrategia','posicionamento'], now() - interval '20 days');

  raise notice 'Academy e Recomendacoes de exemplo criadas.';
end
$$;


-- ===========================================================================
-- SPRINT 12 - Um mes de social para o cliente piloto
--
-- Doze posts na Mundo Verde, com as sete redes representadas, os sete status
-- do fluxo de conteudo, versoes e comentarios. Existe para a tela ter o que
-- mostrar antes de a producao interna existir -- ela e de outro sprint.
--
-- ESTE BLOCO FALA COMO ALGUEM, e nao como dono do banco. `validar_nova_rodada`
-- pergunta quem esta pedindo: escopo 'cliente' so passa para `is_gestor()`, e
-- `is_gestor()` responde a partir de `auth.uid()`. Rodando como postgres, sem
-- sessao, `auth.uid()` e nulo e o trigger recusa -- corretamente. Entao o seed
-- assume a identidade do Diego pelo mesmo caminho que o PostgREST usa, e a
-- devolve no fim.
--
-- A alternativa seria desligar o trigger durante o seed. Seria pior: o seed
-- passaria a produzir linhas que o produto nao consegue produzir, e um dia
-- alguem olharia para uma delas tentando entender por que a tela nao faz
-- aquilo.
-- ===========================================================================
do $$
declare
  verde    uuid;
  -- Os MESMOS ids do bloco de demandas, mais acima neste arquivo. Escrevi
  -- outros na primeira versao e a chave estrangeira recusou na hora -- que e
  -- onde se quer descobrir.
  diego    uuid := 'a0000000-0000-0000-0000-000000000002';  -- Desenvolvedor
  bruno    uuid := 'a0000000-0000-0000-0000-000000000005';  -- Design
  marina   uuid := 'a0000000-0000-0000-0000-000000000006';  -- Social Media
  -- A Carla e Atendimento e entra como Redatora da corrente: o mapa diz QUEM
  -- faz a etapa, e a funcao diz o que a etapa e. Numa agencia deste tamanho as
  -- duas coisas nem sempre coincidem, e cobrar que coincidam viraria uma trava
  -- que atrapalha num dia de aperto.
  carla    uuid := 'a0000000-0000-0000-0000-000000000003';  -- Atendimento
  joana    uuid;
  primeiro date := date_trunc('month', current_date)::date;
  p        uuid;
  rodada   uuid;
  i        integer;
begin
  select id into verde from public.clients where slug = 'mundo-verde' limit 1;
  if verde is null then
    select id into verde from public.clients order by created_at limit 1;
  end if;
  if verde is null then
    raise notice 'Sem cliente para semear posts.';
    return;
  end if;

  select cu.user_id into joana
    from public.client_users cu
    join public.profiles pr on pr.id = cu.user_id
   where cu.client_id = verde and pr.role = 'cliente'
   limit 1;

  delete from public.posts where client_id = verde;

  perform set_config('request.jwt.claim.sub', diego::text, true);

  -- --------------------------------------------------------------------- 1 --
  -- Em producao: NAO aparece para o cliente. E o caso mais importante do seed,
  -- porque e o unico que so da para conferir tentando ver e nao vendo.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (verde, 'Bastidores da colheita',
          'A gente acompanha de perto quem planta. (rascunho da legenda)',
          primeiro + 2, '09:00', 'instagram', 'reels',
          '/exemplos/arte-2.svg', '/exemplos/arte-2.svg', bruno);

  insert into public.posts (client_id, tema, data_publicacao, horario,
                            plataforma, formato, criado_por)
  values (verde, 'Teaser da linha de verao', primeiro + 4, '11:30',
          'tiktok', 'video', bruno);

  -- --------------------------------------------------------------------- 2 --
  -- Aguardando informacoes: a agencia esperando material do cliente.
  insert into public.posts (client_id, tema, legenda, data_publicacao,
                            plataforma, formato, criado_por)
  values (verde, 'Depoimento de cliente',
          'Falta o video que a loja ia mandar.', primeiro + 6,
          'youtube', 'video', bruno)
  returning id into p;
  update public.posts set status = 'aguardando_informacoes' where id = p;

  -- --------------------------------------------------------------------- 3 --
  -- Esperando a decisao do cliente. Tres deles, que e o que faz o contador da
  -- tela inicial ter um numero de verdade.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url,
                            prazo_aprovacao, criado_por)
  values (verde, 'Promocao de outubro',
          'Corre que acaba! Toda a linha de granolas com 20% ate domingo. ' ||
          'Aproveite para experimentar os sabores novos — tem castanha, tem cacau, ' ||
          'e tem aquele de coco que sai voando toda semana.',
          primeiro + 9, '12:00', 'instagram', 'carrossel',
          '/exemplos/arte-1.svg', '/exemplos/arte-1.svg', primeiro + 7, bruno)
  returning id into p;

  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-1.svg', '/exemplos/arte-1.svg',
          'Corre que acaba! Toda a linha de granolas com 20% ate domingo.',
          'Primeira arte', bruno);

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '2 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
  values ('post', p, 1, 'cliente', diego);

  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (verde, 'Post institucional do mes',
          'Quinze anos escolhendo fornecedor por fornecedor.',
          primeiro + 12, '18:30', 'linkedin', 'feed',
          '/exemplos/arte-3.svg', '/exemplos/arte-3.svg', bruno)
  returning id into p;

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '1 day');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
  values ('post', p, 1, 'cliente', diego)
  returning id into rodada;

  if joana is not null then
    insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto)
    values ('post', p, rodada, joana, 'Dá para trocar a foto do fundo pela da loja nova?');
    insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto)
    values ('post', p, rodada, marina, 'Dá sim. Já pedimos para o Bruno.');
  end if;

  insert into public.comments (content_type, content_id, autor_id, texto, interno)
  values ('post', p, marina, 'Cliente sempre pede foto da loja. Já deixar na próxima.', true);

  insert into public.posts (client_id, tema, legenda, data_publicacao,
                            plataforma, formato, criado_por)
  values (verde, 'Enquete de sabores', 'Qual entra na linha do ano que vem?',
          primeiro + 14, 'twitter', 'story', bruno)
  returning id into p;

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '6 hours');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
  values ('post', p, 1, 'cliente', diego);

  -- --------------------------------------------------------------------- 4 --
  -- Ajustes pedidos pelo cliente: duas versoes, e a rodada 1 fechada com o
  -- motivo. Rodada fechada nunca e reescrita -- e por isso a proxima e a 2.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (verde, 'Receita da semana',
          'Panqueca de banana com granola. Cinco minutos.',
          primeiro + 16, '08:00', 'instagram', 'feed',
          '/exemplos/arte-3.svg', '/exemplos/arte-3.svg', bruno)
  returning id into p;

  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-1.svg', '/exemplos/arte-1.svg',
          'Panqueca de banana com granola.', 'Primeira arte', bruno);
  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-3.svg', '/exemplos/arte-3.svg',
          'Panqueca de banana com granola. Cinco minutos.',
          'Logo maior e tempo de preparo na legenda', bruno);

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '5 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('post', p, 1, 'cliente', 'ajustes_solicitados', diego, joana,
          now() - interval '4 days', 'O logo ficou pequeno demais.');
  update public.posts set status = 'ajustes' where id = p;

  insert into public.posts (client_id, tema, data_publicacao,
                            plataforma, formato, criado_por)
  values (verde, 'Card de horario de feriado', primeiro + 18,
          'facebook', 'feed', bruno)
  returning id into p;
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '3 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('post', p, 1, 'cliente', 'ajustes_solicitados', diego, joana,
          now() - interval '2 days', 'O horário de sábado está errado.');
  update public.posts set status = 'ajustes' where id = p;

  -- --------------------------------------------------------------------- 5 --
  -- Aprovado, com DUAS rodadas de cliente: ajuste na primeira, aprovacao na
  -- segunda. E o caminho completo do modulo, e o unico jeito de conferir que o
  -- historico nao some quando o ciclo fecha.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (verde, 'Lancamento da granola de cacau',
          'Chegou. E sim, tem pedaco de cacau de verdade.',
          primeiro + 20, '19:00', 'instagram', 'carrossel',
          '/exemplos/arte-2.svg', '/exemplos/arte-2.svg', bruno)
  returning id into p;

  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-1.svg', '/exemplos/arte-1.svg',
          'Chegou a granola de cacau.', 'Primeira arte', bruno);
  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-3.svg', '/exemplos/arte-3.svg',
          'Chegou. E tem cacau de verdade.', 'Fundo mais claro', bruno);
  insert into public.post_versions (post_id, arte_url, thumbnail_url, legenda, notas_mudanca, criado_por)
  values (p, '/exemplos/arte-2.svg', '/exemplos/arte-2.svg',
          'Chegou. E sim, tem pedaco de cacau de verdade.',
          'Legenda mais solta, como o cliente pediu', bruno);

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '9 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('post', p, 1, 'cliente', 'ajustes_solicitados', diego, joana,
          now() - interval '8 days', 'A legenda ficou dura. Solta mais.')
  returning id into rodada;

  if joana is not null then
    insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto)
    values ('post', p, rodada, joana, 'A legenda ficou dura. Solta mais.');
  end if;

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 2, 'interna', 'aprovada', bruno, diego, now() - interval '7 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('post', p, 2, 'cliente', 'aprovada', diego, joana,
          now() - interval '6 days', 'Agora sim. Pode subir.');
  update public.posts set status = 'aprovado' where id = p;

  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, arte_url, thumbnail_url, criado_por)
  values (verde, 'Guia de receitas no Pinterest',
          'Salvou, fez. E simples assim.', primeiro + 22, '15:00',
          'pinterest', 'feed', '/exemplos/arte-1.svg', '/exemplos/arte-1.svg', bruno)
  returning id into p;
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '11 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'cliente', 'aprovada', diego, joana, now() - interval '10 days');
  update public.posts set status = 'aprovado' where id = p;

  -- --------------------------------------------------------------------- 6 --
  -- Recusado: o desfecho que a 0032 acrescentou. Motivo obrigatorio, e ele
  -- fica na rodada.
  insert into public.posts (client_id, tema, legenda, data_publicacao,
                            plataforma, formato, criado_por)
  values (verde, 'Comparativo com concorrente',
          'A gente sabe quem faz melhor.', primeiro + 24,
          'instagram', 'feed', bruno)
  returning id into p;
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('post', p, 1, 'interna', 'aprovada', bruno, diego, now() - interval '13 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('post', p, 1, 'cliente', 'rejeitada', diego, joana, now() - interval '12 days',
          'Não vamos falar de concorrente. Esse não entra.');
  update public.posts set status = 'rejeitado' where id = p;

  -- --------------------------------------------------------------------- 7 --
  -- Stand by. NENHUM CAMINHO DO PRODUTO PRODUZ ESTE STATUS hoje -- ele esta no
  -- enum desde a 0030 e nada o alcanca. Entra aqui por `update` direto, e so
  -- para o selo e o filtro terem o setimo caso para desenhar. Se um dia o
  -- produto souber pausar um post, este update sai.
  insert into public.posts (client_id, tema, legenda, data_publicacao,
                            plataforma, formato, criado_por)
  values (verde, 'Acao de fim de ano',
          'Esperando o calendario comercial fechar.', primeiro + 27,
          'facebook', 'feed', bruno)
  returning id into p;
  update public.posts set status = 'stand_by' where id = p;

  -- --------------------------------------------------------------------- 8 --
  -- A CORRENTE DE ETAPAS (0045), distribuida e em movimento.
  --
  -- Ela ja nasceu com cada post, pelo gatilho `posts_monta_corrente` -- e os
  -- posts que o cliente mandou ajustar ja ganharam a etapa de Ajustes, porque
  -- o gatilho `posts_corrente_do_cliente` pegou os `update ... set status =
  -- 'ajustes'` acima. O que falta e o que nenhum gatilho tem como saber: quem
  -- faz cada parte.
  --
  -- SEM ISSO O SEED MOSTRARIA A CORRENTE INTEIRA SEM DONO, que e justamente o
  -- estado que a tela existe para evitar -- etapa sem dono nao aparece no
  -- "Minhas Tasks" de ninguem.
  update public.post_etapas e
     set responsavel_id = case e.funcao
                            when 'Social Media' then marina
                            when 'Redator'      then carla
                            when 'Design'       then bruno
                            else null
                          end
    from public.posts ps
   where ps.id = e.post_id and ps.client_id = verde
     and e.funcao in ('Social Media', 'Redator', 'Design');

  -- A ETAPA DE AJUSTES HERDA O DONO DO LAYOUT no instante em que o cliente
  -- decide -- e quando ela nasceu, ali em cima, ninguem tinha Layout ainda.
  -- Esta linha e o efeito colateral da ORDEM deste arquivo, nao da regra: o
  -- seed pede ajustes antes de distribuir a corrente, o que nunca acontece na
  -- vida real. Sem ela o pedido do cliente ficaria sem dono, que e o pior
  -- estado possivel para um pedido do cliente.
  --
  -- E OS POSTS DA OUTRA EMPRESA CONTINUAM SEM DONO de proposito: "etapa sem
  -- dono" e um estado que a tela precisa saber desenhar, e um seed em que tudo
  -- tem dono nunca mostra esse desenho a ninguem.
  update public.post_etapas a
     set responsavel_id = (select l.responsavel_id from public.post_etapas l
                            where l.post_id = a.post_id and l.nome = 'Layout')
    from public.posts ps
   where ps.id = a.post_id and ps.client_id = verde
     and a.nome like 'Ajustes%' and a.responsavel_id is null;

  -- E UMA CORRENTE NO MEIO DO CAMINHO, para a tela ter o caso que importa: a
  -- Pauta e o Conteudo fechados, o Layout na mao do Bruno agora. A ordem dos
  -- dois `update` e a propria trava: o segundo so passa porque o primeiro
  -- fechou os anteriores.
  select id into p from public.posts
   where client_id = verde and tema = 'Bastidores da colheita' limit 1;

  if p is not null then
    update public.post_etapas set status = 'concluida'
     where post_id = p and nome in ('Pauta', 'Conteúdo');
    update public.post_etapas set status = 'em_andamento'
     where post_id = p and nome = 'Layout';
  end if;

  -- --------------------------------------------------------------------- 9 --
  -- O MES ABERTO EM BRANCO (0044): seis posts sem data nenhuma.
  --
  -- E `insert` direto e nao `abrir_mes_de_social`: a funcao cobra
  -- `is_gestor()` na primeira linha, e o seed roda sem sessao. O resultado na
  -- tela e o mesmo -- inclusive a corrente, que vem do gatilho.
  --
  -- SEIS E NAO UM, porque o que a faixa "sem data ainda" precisa provar e que
  -- ela aguenta o lote: com um post so, ela pareceria um cartao solto e
  -- ninguem descobriria que a lista rola.
  for i in 1..6 loop
    insert into public.posts (client_id, tema, data_publicacao, plataforma,
                              midia, criado_por, responsavel_id)
    values (verde, format('Instagram %s de 6 · mês que vem', i), null,
            'instagram', 'imagem', diego, marina);
  end loop;

  update public.post_etapas e
     set responsavel_id = case e.funcao
                            when 'Social Media' then marina
                            when 'Redator'      then carla
                            when 'Design'       then bruno
                            else null
                          end
    from public.posts ps
   where ps.id = e.post_id and ps.client_id = verde
     and ps.data_publicacao is null
     and e.funcao in ('Social Media', 'Redator', 'Design');

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 12: 12 posts de exemplo criados para o cliente piloto.';
  raise notice '0044/0045: 6 posts sem data e a corrente de etapas distribuida.';
end
$$;


-- ---------------------------------------------------------------------------
-- SPRINT 13 - A Wave Outubro Rosa do cliente piloto
--
-- Uma campanha inteira, a partir do template da casa, com os status que a
-- agencia realmente ve no meio de uma Wave: o KV ja aprovado, o Enxoval em
-- aprovacao com uma peca recusada, o Feed/Storys pela metade, os videos ainda
-- em producao e o Deskfy sem nada enviado.
--
-- O CASO QUE SO DA PARA CONFERIR TENTANDO VER E NAO VENDO e o Deskfy: os
-- sub-itens dele nascem sem `enviado_em`, e `deliverables_select_cliente`
-- recusa. Se um dia alguem apagar aquela linha da policy, e por este grupo
-- que se percebe -- ele passa a aparecer no portal.
--
-- Roda mais de uma vez: apaga a campanha anterior do cliente antes.
-- ---------------------------------------------------------------------------
do $$
declare
  verde    uuid;
  -- Os MESMOS ids dos blocos acima. Escrever outros faz a chave estrangeira
  -- recusar na hora -- que e onde se quer descobrir.
  diego    uuid := 'a0000000-0000-0000-0000-000000000002';  -- Desenvolvedor
  bruno    uuid := 'a0000000-0000-0000-0000-000000000005';  -- Design
  joana    uuid;
  primeiro date := date_trunc('month', current_date)::date;
  campanha uuid;
  grupo    uuid;
  item     uuid;
  i        integer;
  peca     record;
begin
  select id into verde from public.clients where slug = 'mundo-verde' limit 1;
  if verde is null then
    select id into verde from public.clients order by created_at limit 1;
  end if;
  if verde is null then
    raise notice 'Sem cliente para semear a campanha.';
    return;
  end if;

  select cu.user_id into joana
    from public.client_users cu
    join public.profiles pr on pr.id = cu.user_id
   where cu.client_id = verde and pr.role = 'cliente'
   limit 1;

  delete from public.campaigns where client_id = verde;

  perform set_config('request.jwt.claim.sub', diego::text, true);

  -- A campanha termina em 6 DIAS, e nao e numero solto: e o que faz o alerta
  -- de prazo aparecer na tela do cliente. Com 8 ele nao apareceria, e o
  -- cenario mais interessante do sprint ficaria sem exemplo.
  -- A CAPA E UM CAMINHO QUE NAO PASSA PELO STORAGE, como as artes dos
  -- entregaveis logo abaixo: `assinarArquivos()` deixa passar direto o que ja
  -- comeca com `/` ou `http`, e assinar um endereco que nao e do bucket
  -- devolveria erro e apagaria a imagem da tela. O seed nao sobe arquivo.
  insert into public.campaigns (client_id, nome, descricao, data_inicio, data_fim,
                                status, capa_url, criado_por)
  values (verde, 'Wave Outubro Rosa',
          'A campanha de outubro: KV, enxoval de pecas, feed, videos e os arquivos do Deskfy.',
          primeiro, current_date + 6, 'ativa', '/exemplos/capa-1.svg', diego)
  returning id into campanha;

  -- ------------------------------------------------------------------- KV --
  -- Aprovado: a rodada existe, e e ela que explica o status. Escrever
  -- `status = 'aprovado'` sem rodada daria um item aprovado que a tela de
  -- detalhe nao sabe justificar -- ela procura quem decidiu e quando.
  insert into public.deliverables (campaign_id, nome, descricao, ordem, prazo,
                                   arte_url, thumbnail_url, arquivo_nome,
                                   responsavel_id, enviado_em)
  values (campanha, 'KV', 'A chave visual da campanha.', 0, primeiro + 5,
          '/exemplos/arte-1.svg', '/exemplos/arte-1.svg', 'kv-outubro-rosa.pdf',
          bruno, now() - interval '20 days')
  returning id into item;

  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('deliverable', item, 1, 'interna', 'aprovada', bruno, diego, now() - interval '21 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
  values ('deliverable', item, 1, 'cliente', 'aprovada', diego, joana, now() - interval '19 days',
          'Ficou ótimo. Pode seguir.');
  update public.deliverables set status = 'aprovado' where id = item;

  -- -------------------------------------------------------------- Enxoval --
  -- O GRUPO NAO RECEBE STATUS NEM RODADA, e nao e esquecimento: quem tem
  -- filho para de ser unidade de trabalho, e `status_do_entregavel()` calcula
  -- o dele pelas filhas. Gravar um valor aqui seria gravar a segunda verdade
  -- que o produto inteiro evita.
  insert into public.deliverables (campaign_id, nome, ordem, prazo, enviado_em)
  values (campanha, 'Enxoval', 1, primeiro + 12, now() - interval '10 days')
  returning id into grupo;

  -- Tres pecas aprovadas, uma recusada com motivo, uma esperando decisao e o
  -- resto em producao. E o retrato de um enxoval no meio do caminho.
  i := 0;
  for peca in
    select *
      from (values
        ('Lâmina customizável A5', 0),
        ('Precificador editável', 1),
        ('Precificador não editável', 2),
        ('Banner A5 editável', 3),
        ('Banner A5 não editável', 4),
        ('Display produto A3', 5),
        ('Banner portal do franqueado', 6),
        ('Capa YouTube', 7),
        ('Capa Facebook', 8),
        ('Avatar perfil', 9),
        ('Feed/story site', 10),
        ('Feed/story iFood', 11),
        ('Capa iFood', 12),
        ('Banner blog', 13),
        ('Adesivo KV A0', 14),
        ('Adesivo KV A1', 15),
        ('Adesivo vitrine', 16)
      ) as t(nome, ordem)
  loop
    i := i + 1;

    -- ENVIADO SO O QUE FOI MESMO ENVIADO. As cinco primeiras pecas passaram
    -- pelo cliente; as doze restantes estao em producao e NAO tem
    -- `enviado_em` -- que e o que as esconde dele. Na primeira versao deste
    -- seed todas levavam o carimbo, e o resultado era o cliente vendo doze
    -- itens marcados "Em produção": uma promessa de material que ninguem
    -- mandou. Foi rodando o seed e olhando o que o cliente enxerga que
    -- apareceu.
    insert into public.deliverables (campaign_id, parent_id, nome, ordem, prazo,
                                     arte_url, thumbnail_url, enviado_em)
    values (campanha, grupo, peca.nome, peca.ordem, primeiro + 12,
            '/exemplos/arte-1.svg', '/exemplos/arte-1.svg',
            case when i <= 5 then now() - interval '10 days' end)
    returning id into item;

    -- TODA rodada de cliente exige uma interna APROVADA antes -- e nao e
    -- detalhe do seed: `validar_nova_rodada` recusa, e foi rodando este
    -- arquivo contra o Postgres que a recusa apareceu. O tipo diz o destino
    -- final, nao o caminho.
    if i <= 5 then
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
      values ('deliverable', item, 1, 'interna', 'aprovada', bruno, diego, now() - interval '9 days');
    end if;

    if i <= 3 then
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
      values ('deliverable', item, 1, 'cliente', 'aprovada', diego, joana, now() - interval '8 days');
      update public.deliverables set status = 'aprovado' where id = item;

    elsif i = 4 then
      -- RECUSADO COM MOTIVO. O motivo mora na rodada e a arvore o mostra na
      -- propria lista: "Rejeitado" sozinho manda a pessoa abrir o item para
      -- descobrir por que.
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em, comentario)
      values ('deliverable', item, 1, 'cliente', 'rejeitada', diego, joana, now() - interval '7 days',
              'O logo ficou pequeno demais no rodapé. Não dá para usar assim.');
      update public.deliverables set status = 'rejeitado' where id = item;

    elsif i = 5 then
      -- Esperando decisao do cliente: a rodada fica PENDENTE, e e ela que faz
      -- o item entrar nas pendencias do portal e no destaque do cartao.
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, solicitado_em)
      values ('deliverable', item, 1, 'cliente', 'pendente', diego, now() - interval '3 days');

    else
      update public.deliverables set status = 'em_producao' where id = item;
    end if;
  end loop;

  -- --------------------------------------------------------- Feed/Storys --
  -- O grupo de quantidade variavel: o numero muda a cada mes, e e por isso
  -- que o template o deixa em aberto em vez de trazer quinze linhas fixas.
  insert into public.deliverables (campaign_id, nome, ordem, prazo, enviado_em)
  values (campanha, 'Feed/Storys', 2, primeiro + 20, now() - interval '9 days')
  returning id into grupo;

  for i in 1..15 loop
    -- Mesma regra do Enxoval: so as seis primeiras foram enviadas.
    insert into public.deliverables (campaign_id, parent_id, nome, ordem,
                                     prazo, arte_url, thumbnail_url, enviado_em)
    values (campanha, grupo, 'Feed/Story ' || i, i - 1, primeiro + 20,
            '/exemplos/arte-3.svg', '/exemplos/arte-3.svg',
            case when i <= 6 then now() - interval '9 days' end)
    returning id into item;

    if i <= 6 then
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
      values ('deliverable', item, 1, 'interna', 'aprovada', bruno, diego, now() - interval '7 days');
    end if;

    if i <= 4 then
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
      values ('deliverable', item, 1, 'cliente', 'aprovada', diego, joana, now() - interval '6 days');
      update public.deliverables set status = 'aprovado' where id = item;
    elsif i <= 6 then
      insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, solicitado_em)
      values ('deliverable', item, 1, 'cliente', 'pendente', diego, now() - interval '2 days');
    else
      update public.deliverables set status = 'em_producao' where id = item;
    end if;
  end loop;

  -- ------------------------------------------------------------ Videos TV --
  -- O GRUPO TAMBEM NAO VAI: com os tres filhos em producao, um grupo
  -- carimbado apareceria vazio na arvore do cliente -- uma linha prometendo
  -- conteudo que a policy esconde logo abaixo.
  insert into public.deliverables (campaign_id, nome, ordem, prazo)
  values (campanha, 'Vídeos TV', 3, current_date + 4)
  returning id into grupo;

  for peca in
    select * from (values ('Vertical', 0), ('Horizontal', 1), ('Tombado', 2)) as t(nome, ordem)
  loop
    insert into public.deliverables (campaign_id, parent_id, nome, ordem, prazo,
                                     status)
    values (campanha, grupo, peca.nome, peca.ordem, current_date + 4,
            'em_producao');
  end loop;

  -- ------------------------------------------------------------- Tabloide --
  insert into public.deliverables (campaign_id, nome, ordem, prazo,
                                   arte_url, thumbnail_url, arquivo_nome, enviado_em)
  values (campanha, 'Tabloide', 4, primeiro + 15,
          '/exemplos/arte-2.svg', '/exemplos/arte-2.svg', 'tabloide-outubro.pdf',
          now() - interval '14 days')
  returning id into item;
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('deliverable', item, 1, 'interna', 'aprovada', bruno, diego, now() - interval '12 days');
  insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
  values ('deliverable', item, 1, 'cliente', 'aprovada', diego, joana, now() - interval '11 days');
  update public.deliverables set status = 'aprovado' where id = item;

  -- ------------------------------------------------------- Arquivos Deskfy --
  -- SEM `enviado_em` EM NENHUM SUB-ITEM: este grupo inteiro NAO aparece para
  -- o cliente. E o caso que so da para conferir tentando ver e nao vendo --
  -- se a linha `enviado_em is not null` sair da policy, e por aqui que se
  -- percebe.
  insert into public.deliverables (campaign_id, nome, ordem, prazo)
  values (campanha, 'Arquivos Deskfy', 5, current_date + 5)
  returning id into grupo;

  for peca in
    select *
      from (values
        ('Adesivo A0', 0), ('Adesivo A1', 1), ('Banner A5', 2),
        ('Feed/story site', 3), ('Feed/story iFood', 4),
        ('Precificador editável', 5), ('Display produto A3', 6),
        ('Selo campanha', 7), ('Lâmina A5', 8)
      ) as t(nome, ordem)
  loop
    -- `enviado_em` fica NULO de proposito, e por omissao: e o default da
    -- coluna, e escrever `null` aqui daria a entender que alguem o apagou.
    insert into public.deliverables (campaign_id, parent_id, nome, ordem, prazo)
    values (campanha, grupo, peca.nome, peca.ordem, current_date + 5);
  end loop;

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 13: Wave Outubro Rosa criada para o cliente piloto.';
end
$$;


-- ===========================================================================
-- SPRINT 3D - Demandas recorrentes
--
-- Duas regras, uma de cada modo, e as ocorrencias geradas pela FUNCAO e nao
-- por inserts a mao. E deliberado: o seed que monta a task no bracao nao
-- exercita `gerar_ocorrencia()`, e o que se quer aqui e justamente ver o que
-- a rotina da madrugada produz -- inclusive o historico que ela grava.
-- ===========================================================================
do $$
declare
  verde     uuid;
  otica     uuid;
  carla     uuid := 'a0000000-0000-0000-0000-000000000003';  -- Atendimento
  marina    uuid := 'a0000000-0000-0000-0000-000000000006';  -- Social Media
  bruno     uuid := 'a0000000-0000-0000-0000-000000000005';  -- Design
  regra     uuid;
  periodo   date;
  gerada    uuid;
begin
  select id into verde from public.clients where slug = 'mundo-verde' limit 1;
  -- POR NOME, como o resto do seed: o slug sai do gatilho e depende de como
  -- ele trata o acento, que nao e o que este bloco quer testar.
  select id into otica from public.clients where nome_empresa = 'Óptica Visão' limit 1;
  if verde is null then
    raise notice 'Sem cliente para semear as recorrencias.';
    return;
  end if;

  delete from public.task_recurrences where criado_por = carla;

  perform set_config('request.jwt.claim.sub', carla::text, true);

  -- ------------------------------------------------- 1. Mensal agrupada --
  -- Uma task por mes com uma etapa por dia util. E o caso que justifica o
  -- modo existir: sem ele, o board da agencia teria vinte e duas linhas do
  -- mesmo trabalho por mes, por cliente.
  insert into public.task_recurrences (
    client_id, nome, modo, frequencia, dias_semana, pular_feriados,
    data_inicio, antecedencia_dias, criado_por, modelo
  ) values (
    verde, 'Stories diarios', 'mensal_agrupada', 'diaria',
    array[1,2,3,4,5], true,
    date_trunc('month', current_date)::date, 3, carla,
    jsonb_build_object(
      'titulo', 'Stories {MES}/{ANO} — {CLIENTE}',
      'prioridade', 'normal',
      'pasta_entrega', 'https://drive.google.com/drive/folders/stories-mundo-verde',
      -- PELO PADRAO DA REGRA (0041), e nao na etapa: e o caso que o campo
      -- existe para servir. Trocar quem faz os stories passa a ser um campo
      -- so, em vez de reabrir a regra e mexer em cada etapa.
      'responsavel_padrao', marina,
      'subtarefa_diaria', jsonb_build_object(
        'titulo', 'Stories {DATA}',
        'prioridade', 'normal',
        'requer_aprovacao', false,
        'tipo_aprovacao', null
      ),
      'subtarefas', '[]'::jsonb,
      'referencias', '[]'::jsonb
    )
  ) returning id into regra;

  -- GERADA PELA FUNCAO, com o periodo que ela propria escolhe. Se algum dia
  -- `proximo_periodo_da_recorrencia()` passar a devolver retroativo, este
  -- seed produz uma task no mes errado -- e e onde se quer descobrir.
  select public.proximo_periodo_da_recorrencia(regra) into periodo;
  if periodo is not null then
    select public.gerar_ocorrencia(regra, periodo) into gerada;
    raise notice 'Stories diarios: task % gerada para %.', gerada, periodo;
  end if;

  -- ---------------------------------------------- 2. Task por ocorrencia --
  -- Cada repeticao e um trabalho com etapas proprias: coletar, montar,
  -- revisar. Aqui a cadeia importa, e por isso o outro modo nao serve.
  if otica is not null then
    insert into public.task_recurrences (
      client_id, nome, modo, frequencia, dia_mes, pular_feriados,
      data_inicio, antecedencia_dias, criado_por, modelo
    ) values (
      otica, 'Relatorio mensal de midia', 'task_por_ocorrencia', 'mensal',
      5, true,
      date_trunc('month', current_date)::date, 5, carla,
      jsonb_build_object(
        'titulo', 'Relatório de mídia — {MES}/{ANO}',
        'prioridade', 'alta',
        'pasta_entrega', 'https://drive.google.com/drive/folders/relatorios-optica',
        'subtarefa_diaria', null,
        'subtarefas', jsonb_build_array(
          jsonb_build_object(
            'titulo', 'Coletar os números', 'responsavel_id', bruno,
            'prazo_offset_dias', 1, 'prioridade', 'normal',
            'requer_aprovacao', false, 'tipo_aprovacao', null,
            'depende_de_ordem', null),
          jsonb_build_object(
            'titulo', 'Montar o relatório', 'responsavel_id', bruno,
            'prazo_offset_dias', 3, 'prioridade', 'normal',
            'requer_aprovacao', false, 'tipo_aprovacao', null,
            -- DEPENDE DA PRIMEIRA, por POSICAO e nao por uuid: o modelo e
            -- reutilizavel, e a etapa de que ela depende so ganha id no
            -- instante em que a ocorrencia nasce.
            'depende_de_ordem', 1),
          jsonb_build_object(
            'titulo', 'Revisar com o cliente', 'responsavel_id', carla,
            'prazo_offset_dias', 5, 'prioridade', 'alta',
            -- ESTA PEDE AVAL, e e de proposito: a demanda gerada entra na
            -- fila de aprovacoes como qualquer outra. Uma recorrencia que
            -- nascesse fora do fluxo de aprovacao seria um segundo caminho
            -- ao lado do que o produto ja tem.
            'requer_aprovacao', true, 'tipo_aprovacao', 'cliente',
            'depende_de_ordem', 2)
        ),
        'referencias', '[]'::jsonb
      )
    ) returning id into regra;

    -- DUAS COISAS APARECEM AQUI, e as duas sao comportamento e nao acidente:
    --
    -- 1. o PERIODO DA TASK nao e a data da ocorrencia. A regra diz "todo dia
    --    5" e a task nasce comecando no dia 6, porque `subtasks_recalcula_
    --    periodo` (0028) deriva o periodo das folhas e a primeira etapa tem
    --    offset 1. Quem guarda a data da ocorrencia e `chave_ocorrencia`, na
    --    execucao -- e e ela que impede a rotina de gerar a mesma duas vezes;
    -- 2. o HISTORICO traz o aviso de `aviso_do_responsavel()` quando alguem
    --    esta fora no prazo da etapa. Ele AVISA e nao reatribui: trocar o
    --    responsavel sozinho por causa de um recesso e exatamente o que o
    --    sprint pediu para nao fazer.
    select public.proximo_periodo_da_recorrencia(regra) into periodo;
    if periodo is not null then
      select public.gerar_ocorrencia(regra, periodo) into gerada;
      raise notice 'Relatorio mensal: task % gerada para %.', gerada, periodo;
    end if;

    -- CHAMAR DE NOVO NAO DUPLICA, e o seed prova isso em vez de afirmar: a
    -- trava e o indice unico de `recurrence_runs`, nao uma consulta antes do
    -- insert. Duas abas clicando em "Gerar agora" ao mesmo tempo passariam
    -- pelas duas consultas antes de qualquer uma gravar.
    if periodo is not null then
      select public.gerar_ocorrencia(regra, periodo) into gerada;
      if gerada is not null then
        raise exception 'A idempotencia quebrou: a segunda chamada criou a task %.', gerada;
      end if;
    end if;
  end if;

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 3D: duas regras recorrentes criadas, com a primeira ocorrencia de cada.';
end
$$;


-- ===========================================================================
-- 0042 - A CORRENTE DE MAO EM MAO DO SOCIAL MEDIA
--
-- Os posts do Sprint 12 nasceram todos com `criado_por = bruno` e sem
-- responsavel -- o modelo de antes, em que quem abria era quem produzia. Este
-- bloco poe a corrente neles: a GESTAO abre, e a producao fica com quem faz.
--
-- E acrescenta os dois casos que o sprint existe para desenhar e que nao
-- havia como representar antes: o CARROSSEL, com os slides, e o VIDEO POR
-- LINK.
-- ===========================================================================
do $$
declare
  verde   uuid;
  ana     uuid := 'a0000000-0000-0000-0000-000000000001';  -- Socia
  diego   uuid := 'a0000000-0000-0000-0000-000000000002';  -- Desenvolvedor
  bruno   uuid := 'a0000000-0000-0000-0000-000000000005';  -- Design
  marina  uuid := 'a0000000-0000-0000-0000-000000000006';  -- Social Media
  primeiro date := date_trunc('month', current_date)::date;
  p       uuid;
begin
  select id into verde from public.clients where slug = 'mundo-verde' limit 1;
  if verde is null then
    raise notice 'Sem cliente para semear o Social Media interno.';
    return;
  end if;

  -- A CORRENTE NOS POSTS QUE JA EXISTIAM. Quem abriu passa a ser a gestao, e
  -- quem produz fica no `responsavel_id`. Sem isto, `dono_do_post()` devolve
  -- o Bruno em todos e a tela mostra a gestao como produtora.
  update public.posts
     set criado_por = ana,
         responsavel_id = coalesce(responsavel_id, bruno)
   where client_id = verde and criado_por = bruno;

  -- E A MIDIA DELES, pela mesma conversao que a 0042 faz em producao. O seed
  -- do Sprint 12 gravava `formato = 'carrossel'` e `formato = 'video'` porque
  -- nao havia onde dizer o que a tela desenha; sem esta linha o ambiente local
  -- fica diferente do que a migration produz no banco de verdade -- e o bug de
  -- um carrossel abrindo no editor de arte unica so apareceria la.
  update public.posts
     set midia = case
       when lower(coalesce(formato, '')) in ('carrossel', 'carousel') then 'carrossel'
       when lower(coalesce(formato, '')) in ('video', 'vídeo', 'reels', 'reel', 'shorts', 'short') then 'video'
       else 'imagem'
     end::public.post_midia
   where client_id = verde and midia = 'imagem';

  perform set_config('request.jwt.claim.sub', ana::text, true);

  -- ------------------------------------------------------------ CARROSSEL --
  -- Cinco slides, e a CAPA sai do primeiro pelo trigger
  -- `post_versions_sincroniza`. E o caso que prova que o calendario, o card e
  -- a miniatura do portal nao precisam saber que carrossel existe.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, midia, criado_por, responsavel_id)
  values (verde, 'Carrossel de dicas',
          'Cinco dicas para manter a horta viva no calor. Arrasta pro lado.',
          primeiro + 18, '12:00', 'instagram', 'Carrossel', 'carrossel', ana, bruno)
  returning id into p;

  insert into public.post_versions (post_id, arquivos, legenda, criado_por)
  values (p, jsonb_build_array(
            jsonb_build_object('url', '/exemplos/arte-1.svg', 'thumbnail_url', '/exemplos/arte-1.svg', 'nome', 'slide-1.png'),
            jsonb_build_object('url', '/exemplos/arte-2.svg', 'thumbnail_url', '/exemplos/arte-2.svg', 'nome', 'slide-2.png'),
            jsonb_build_object('url', '/exemplos/arte-1.svg', 'thumbnail_url', '/exemplos/arte-1.svg', 'nome', 'slide-3.png'),
            jsonb_build_object('url', '/exemplos/arte-2.svg', 'thumbnail_url', '/exemplos/arte-2.svg', 'nome', 'slide-4.png'),
            jsonb_build_object('url', '/exemplos/arte-1.svg', 'thumbnail_url', '/exemplos/arte-1.svg', 'nome', 'slide-5.png')),
          'Cinco dicas para manter a horta viva no calor. Arrasta pro lado.', bruno);

  -- ---------------------------------------------------------- VIDEO POR LINK --
  -- Decisao do usuario, com o custo dito: o cliente assiste fora do portal.
  -- `validar_nova_rodada` recusa enviar sem o link, e o seed traz o link
  -- preenchido de proposito -- o caso SEM link e da bateria, nao daqui.
  insert into public.posts (client_id, tema, legenda, data_publicacao, horario,
                            plataforma, formato, midia, video_url,
                            criado_por, responsavel_id)
  values (verde, 'Reels da receita',
          'A receita que a nutricionista mandou, em 30 segundos.',
          primeiro + 21, '18:00', 'instagram', 'Reels', 'video',
          'https://drive.google.com/file/d/exemplo-reels/view', ana, marina);

  -- -------------------------------------------------- BRIEFING SEM DONO --
  -- O estado que a lista destaca em "Esperando alguem", e que no calendario
  -- fica cinza: a gestao abriu e ninguem pegou.
  insert into public.posts (client_id, tema, data_publicacao,
                            plataforma, formato, midia, criado_por)
  values (verde, 'Fim de mes', primeiro + 27, 'instagram', 'Feed', 'imagem', diego);

  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Sprint 14: corrente do Social Media, carrossel de 5 slides e video por link.';
end
$$;
