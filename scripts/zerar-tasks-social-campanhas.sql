-- ===========================================================================
-- ZERAR AS DEMANDAS, O SOCIAL E AS CAMPANHAS
--
-- Decisao do usuario, antes da apresentacao: *"tudo que foi feito nela ate
-- agora era de teste, para ver se as coisas funcionavam. Voce pode zerar as
-- tasks, social, e campanhas?"*
--
-- Cola no SQL Editor do Supabase. NAO E MIGRATION, e nao pode ser: migration
-- e schema, roda em todo ambiente e no deploy seguinte -- esta aqui apaga
-- DADO, uma vez, no banco que alguem escolheu. E a mesma distincao do
-- `campanhas-sem-demanda.sql` e do `agendar-rotinas.sql`.
--
-- ---------------------------------------------------------------------------
-- O PASSO 1 NAO APAGA NADA, e e ele que decide.
--
-- Cole o PASSO 1 sozinho, leia os numeros, e so entao cole o PASSO 2. E a
-- decisao do dialogo de apagar campanha e do mes de social: a CONTAGEM e o
-- que faz alguem parar, nao a pergunta "tem certeza?" -- e aqui ela e a unica
-- coisa entre o clique e o apagamento, porque nenhuma trava do produto recusa
-- um `delete` vindo do SQL Editor.
--
-- NAO TEM VOLTA. O banco de producao do Supabase tem backup diario no plano
-- pago; se a conta for do plano gratuito, nao ha de onde restaurar.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A ORDEM NAO E ESTILO, e cada passo existe por um gatilho.
--
-- 1. OS POSTS PRIMEIRO, e e a linha que mais importa. `tasks_apaga_o_social`
--    e `before delete` em `tasks` (0086) e, enquanto a migration 0094 nao for
--    aplicada, ele RECUSA apagar um mes que ja tenha post enviado ao cliente.
--    Com os posts fora, `posts_do_mes()` acha zero e o trigger passa calado --
--    entao este arquivo funciona igual com a 0094 aplicada ou nao.
--
-- 2. AS CAMPANHAS ANTES DAS DEMANDAS, por `subtasks_espelha_ao_apagar` (0080):
--    apagar a etapa apaga a peca vazia da campanha. Com a campanha ja fora, o
--    espelho nao acha nada -- e o trabalho e feito uma vez, pela cascata de
--    `campaigns`, em vez de peca por peca pelo espelho.
--
-- 3. AS DEMANDAS, que levam por cascata: `subtasks` (e com elas as
--    dependencias, as entregas, `post_etapa_progresso` e `social_lotes`),
--    `task_referencias`, `task_comentarios` e `task_history`.
--
-- 4. AS REGRAS RECORRENTES, e esta e a que ninguem lembra: uma regra que
--    sobrevive REABRE a demanda sozinha na proxima madrugada, e o `pg_cron`
--    pode estar ligado. Zerar as tasks e deixar a regra de pe e zerar as
--    tasks ate quarta de manha.
--
-- 5. A VARREDURA DE `approval_rounds`, que tem de dar ZERO -- e e por isso que
--    ela fica por ultimo. `posts_limpa_conteudo`, `deliverables_limpa_conteudo`
--    e `subtasks_limpa_rodadas` ja apagam as rodadas de cada um ao apagar o
--    dono; o numero que sair aqui diferente de zero e um content_type sem
--    gatilho de limpeza, que e exatamente o que a 0030 avisou que aconteceria.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- ELE FOI RODADO, e nao so escrito.
--
-- Contra um Postgres 16 do zero, com as 94 migrations e o `seed.sql`
-- aplicados, e com a versao 0086 de `tasks_apaga_o_social` REPOSTA por cima
-- -- que e a que o banco de producao tem, porque a 0094 ainda nao foi
-- aplicada. A recusa morde: `delete from tasks where social_do_mes is not
-- null` responde *"Este mes tem 8 post(s) que ja foram ao cliente"*, que e
-- exatamente a frase que apareceu na tela. Com os posts saindo primeiro, o
-- arquivo inteiro passa.
--
-- O que ele apagou: 21 posts, 1 campanha, 10 demandas, 2 regras recorrentes.
-- O que sobrou: 10 pessoas, 3 empresas, 7 workflows, 2 fluxos de social, 3
-- modelos de campanha e 4 tipos de pedido.
--
-- E AS DUAS AFIRMACOES DESTE CABECALHO FORAM MEDIDAS, em vez de deduzidas:
--
--   - a varredura do passo 5 apagou ZERO -- os tres gatilhos de limpeza
--     (`posts_limpa_conteudo`, `deliverables_limpa_conteudo` e
--     `subtasks_limpa_rodadas`) ja tinham levado as 47 rodadas;
--   - as 14 tabelas dependentes ficaram todas em zero, sem orfao nenhum:
--     subtasks, dependencias, entregas, comentarios, referencias, historico,
--     versoes e referencias de post, caixinhas, comentarios do portal, lotes,
--     materiais, versoes de material e execucoes de recorrencia.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO NAO TOCA, e e decisao:
--
--   - GENTE E EMPRESAS. `profiles`, `team_members`, `clients`, `client_users`.
--   - A CONFIGURACAO que faz o produto funcionar vazio: os workflows
--     (`task_types`, `workflow_templates`, `workflow_steps`), os fluxos de
--     social (`social_flows`, `social_flow_steps`), os modelos de campanha
--     (`campaign_templates`), os tipos de pedido (`request_types`), os
--     padroes de cada conta (`client_flow_defaults`,
--     `client_function_defaults`) e os feriados. Sem eles a plataforma abre
--     zerada E quebrada, que e outra coisa.
--   - OS OUTROS MODULOS: Full Days, Notas Fiscais, Comodatos, Financeiro,
--     Academy, Recomendacoes, Solicitacoes, eventos do Calendario Full.
--   - `audit_log`. A trilha do socio registra ESTA limpeza, e esta certo: ela
--     existe para dizer quem apagou o que e quando, e apagar a trilha junto
--     com o que ela registra e o unico jeito de ela deixar de servir.
--   - OS ARQUIVOS NO STORAGE. Estao no PASSO 3, separados, com o motivo.
--   - OS PEDIDOS DO CLIENTE que viraram demanda. Estao no PASSO 4, pelo mesmo
--     motivo.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASSO 1 -- O QUE VAI SAIR. Cole SO ISTO primeiro, e leia os numeros.
-- ===========================================================================

select 'demandas (tasks)'            as o_que, count(*) as quantas from public.tasks
union all select 'etapas (subtasks)',             count(*) from public.subtasks
union all select '  dessas, meses de social',     count(*) from public.tasks where social_do_mes is not null
union all select '  dessas, rascunhos',           count(*) from public.tasks where publicada_em is null
union all select 'comentarios de demanda',        count(*) from public.task_comentarios
union all select 'referencias de demanda',        count(*) from public.task_referencias
union all select 'historico de etapa',            count(*) from public.task_history
union all select 'posts',                         count(*) from public.posts
union all select '  desses, ja enviados ao cliente', count(*) from public.posts where enviado_em is not null
union all select 'versoes de post',               count(*) from public.post_versions
union all select 'caixinhas do social',           count(*) from public.post_etapa_progresso
union all select 'comentarios de post',           count(*) from public.comments
union all select 'lotes de envio do social',      count(*) from public.social_lotes
union all select 'campanhas',                     count(*) from public.campaigns
union all select 'materiais de campanha',         count(*) from public.deliverables
union all select '  desses, aprovados pelo cliente', count(*) from public.deliverables where status = 'aprovado'
union all select 'versoes de material',           count(*) from public.deliverable_versions
union all select 'rodadas de aprovacao',          count(*) from public.approval_rounds
union all select 'regras recorrentes',            count(*) from public.task_recurrences
union all select 'avisos do sino dos tres modulos', count(*)
  from public.notifications
  where link like '/painel/gestao-tasks%'
     or link like '/painel/social-media%'
     or link like '/painel/aprovacoes%'
     or link like '/painel/minhas-tasks%'
order by 1;


-- ===========================================================================
-- PASSO 2 -- A LIMPEZA. Cole isto depois de ler o PASSO 1.
--
-- O SQL Editor roda o arquivo colado como UMA transacao: ou os sete comandos
-- passam, ou nenhum passa. Se algum falhar, nada foi apagado -- e o erro diz
-- em qual tabela parou.
-- ===========================================================================

-- 1. OS POSTS. Levam por cascata as versoes, as referencias, as caixinhas e os
--    comentarios; `posts_limpa_conteudo` leva as rodadas de cada um.
delete from public.posts;

-- 2. AS CAMPANHAS. Levam por cascata os materiais e as versoes deles;
--    `deliverables_limpa_conteudo` leva as rodadas de cada material.
delete from public.campaigns;

-- 3. AS DEMANDAS. Levam por cascata as etapas, as dependencias, as entregas,
--    os comentarios, as referencias, o historico e os lotes de envio.
delete from public.tasks;

-- 4. AS REGRAS RECORRENTES, e com elas o historico de execucao de cada uma.
--    Sem esta linha a demanda de teste volta sozinha na proxima madrugada.
delete from public.task_recurrences;

-- 5. A VARREDURA. Tem de dar zero -- veja o PASSO 2B.
delete from public.approval_rounds;

-- 6. OS AVISOS DO SINO dos tres modulos, e so deles. Um sino cheio de "a Ana
--    te atribuiu X" apontando para uma demanda que nao existe mais e um 404
--    por clique na tela que a pessoa abre primeiro. Os avisos de Full Days, de
--    nota fiscal e de comodato ficam: eles continuam levando a algum lugar.
delete from public.notifications
 where link like '/painel/gestao-tasks%'
    or link like '/painel/social-media%'
    or link like '/painel/aprovacoes%'
    or link like '/painel/minhas-tasks%';


-- ===========================================================================
-- PASSO 2B -- A CONFERENCIA. Tudo tem de dar 0.
-- ===========================================================================

select 'demandas'              as o_que, count(*) as sobraram from public.tasks
union all select 'etapas',               count(*) from public.subtasks
union all select 'posts',                count(*) from public.posts
union all select 'campanhas',            count(*) from public.campaigns
union all select 'materiais',            count(*) from public.deliverables
union all select 'rodadas de aprovacao', count(*) from public.approval_rounds
union all select 'regras recorrentes',   count(*) from public.task_recurrences
order by 1;

-- E o que CONTINUA de pe, que e o que faz a plataforma abrir funcionando:
select 'pessoas'               as o_que, count(*) as continuam from public.profiles
union all select 'empresas',             count(*) from public.clients
union all select 'workflows',            count(*) from public.workflow_templates
union all select 'fluxos de social',     count(*) from public.social_flows
union all select 'modelos de campanha',  count(*) from public.campaign_templates
union all select 'tipos de pedido',      count(*) from public.request_types
order by 1;


-- ===========================================================================
-- PASSO 3 (OPCIONAL) -- AS ARTES NO STORAGE
--
-- Com os posts e os materiais fora, NADA no produto aponta mais para estes
-- arquivos: a arte vive em `post_versions.arquivos` e em
-- `deliverable_versions.arquivos`, e as duas tabelas sairam na cascata. Eles
-- ficam ocupando espaco no bucket e mais nada -- nenhuma tela os alcanca,
-- porque toda URL do produto e assinada a partir da linha que nao existe mais.
--
-- O JEITO CERTO E A TELA DE STORAGE do Supabase (Storage -> o bucket ->
-- selecionar as pastas -> Delete), e nao este SQL: apagar a linha de
-- `storage.objects` tira o arquivo do alcance da API e deixa o binario orfao
-- no S3, que e metade do trabalho com a mesma cara de inteiro.
--
-- Os tres buckets sao `posts-artes`, `campanhas-arquivos` e `task-arquivos`.
-- Os outros cinco -- `avatars`, `notas-fiscais`, `comodatos-fotos`,
-- `solicitacoes-arquivos` e `recomendacoes-capas` -- NAO sao destes modulos.
--
-- Para ver quanto ha em cada um antes de decidir:
--
--   select bucket_id, count(*) as arquivos
--     from storage.objects
--    where bucket_id in ('posts-artes', 'campanhas-arquivos', 'task-arquivos')
--    group by bucket_id;


-- ===========================================================================
-- PASSO 4 (OPCIONAL) -- OS PEDIDOS DO CLIENTE QUE VIRARAM DEMANDA
--
-- `tasks.request_id` e `on delete cascade`? Nao: ele aponta de `tasks` PARA
-- `client_requests`, entao apagar a demanda nao encosta no pedido -- e
-- `tasks_espelha_no_pedido` so roda no UPDATE da task, nunca no delete. Quem
-- converteu um pedido em demanda durante os testes fica com o pedido em "Em
-- producao" no portal do cliente, apontando para uma demanda que nao existe.
--
-- O usuario pediu tasks, social e campanhas -- e os pedidos sao do cliente,
-- entao eles nao entram sem alguem decidir. As duas saidas:
--
--   -- (a) devolver os pedidos convertidos para a fila do Atendimento:
--   update public.client_requests
--      set status = 'nova'
--    where status in ('em_andamento', 'concluida');
--
--   -- (b) zerar os pedidos de teste tambem (leva anexos e conversa por
--   --     cascata; o arquivo fica no bucket `solicitacoes-arquivos`):
--   delete from public.client_requests;
