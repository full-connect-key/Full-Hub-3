-- ---------------------------------------------------------------------------
-- O QUE JA ENTROU E O QUE FALTA
--
-- Cole isto no SQL Editor do Supabase. Ele nao muda nada -- so olha.
--
-- Cada linha e uma coisa que uma das migrations novas cria. "FALTA" quer
-- dizer que aquela migration ainda nao rodou neste banco.
--
-- ATE ONDE ELE VAI: da 0019 a 0040, e nao mais. Ele e o LONGO -- item por
-- item, para quando alguma coisa ja parece errada --, e ficou onde estava
-- enquanto o `onde-esta-o-banco.sql` seguia em frente. Isto esta escrito aqui
-- porque a alternativa e pior: sem a linha, quem o rodasse num banco parado na
-- 0054 leria tudo "ok" e concluiria que o banco esta em dia. Para saber em que
-- migration o banco esta, o script e o `onde-esta-o-banco.sql`, cuja lista o
-- `npm run check:migrations` confere contra a pasta a cada rodada.
-- ---------------------------------------------------------------------------
select
  item,
  case when existe then 'ok' else 'FALTA' end as situacao,
  migration
from (
  values
    ('subtasks.parent_id (sub-etapa)',
     exists (select 1 from information_schema.columns
              where table_name = 'subtasks' and column_name = 'parent_id'), '0022'),

    ('tasks.exigencia_aprovacao APAGADA',
     not exists (select 1 from information_schema.columns
                  where table_name = 'tasks' and column_name = 'exigencia_aprovacao'), '0023'),

    ('dias_do_pedido() (descanso corrido)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'dias_do_pedido'), '0024'),

    ('tasks_volta_a_calcular (os sete status a mao)',
     exists (select 1 from pg_trigger where tgname = 'tasks_volta_a_calcular'), '0025'),

    -- A 0026 criou `pode_decidir_rodada()` e a 0029 apagou junto com o resto
    -- da trava. Como as duas se anulam, o que se confere aqui e o estado
    -- FINAL: a trava fora. Um banco parado na 0026 acusa este item.

    ('subtasks.data_inicio (periodo da etapa)',
     exists (select 1 from information_schema.columns
              where table_name = 'subtasks' and column_name = 'data_inicio'), '0027'),

    ('tasks.publicada_em (rascunho)',
     exists (select 1 from information_schema.columns
              where table_name = 'tasks' and column_name = 'publicada_em'), '0028'),

    ('trava de autoaprovacao FORA (a gestao aprova o proprio)',
     not exists (select 1 from pg_trigger
                  where tgname = 'approval_rounds_sem_autoaprovacao'
                    and not tgisinternal), '0029'),

    -- 0030: a rodada deixou de ser so da subtarefa. Sao DOIS itens porque a
    -- migration faz duas coisas que podem falhar separado -- a coluna nova
    -- entra e a velha sai --, e um banco que parou no meio mostra so uma.
    ('approval_rounds.content_id (rodada generica)',
     exists (select 1 from information_schema.columns
              where table_name = 'approval_rounds' and column_name = 'content_id'), '0030'),

    ('approval_rounds.subtask_id APAGADA',
     not exists (select 1 from information_schema.columns
                  where table_name = 'approval_rounds' and column_name = 'subtask_id'), '0030'),

    -- 0031: o Portal do Cliente.
    ('client_access_log (registro de acesso)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'client_access_log'), '0031'),

    ('client_notification_prefs (preferencias de aviso)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'client_notification_prefs'), '0031'),

    -- O furo que a 0031 fechou: o cliente trocava o endereco do proprio
    -- portal por um PATCH. Quem separa e o trigger, e o que se confere e a
    -- linha dentro dele -- a coluna existe desde a 0009 de qualquer jeito.
    ('protect_client_columns protege o slug',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'protect_client_columns'
                -- Regex e nao `like`: o corpo da funcao alinha o `:=` com
                -- espacos, e um `like` com um espaco so devolve FALTA num
                -- banco que esta certo. Foi o que aconteceu ao escrever isto
                -- -- e um item que acusa falta sem faltar nada e pior que
                -- item nenhum, porque manda rodar de novo o que ja rodou.
                and pg_get_functiondef(p.oid) ~ 'new\.slug\s*:=\s*old\.slug'), '0031'),

    -- 0032: posts de social media.
    ('posts (calendario de social)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'posts'), '0032'),

    ('post_versions (historico de arte e legenda)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'post_versions'), '0032'),

    ('comments (comentario de post)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'comments'), '0032'),

    -- O terceiro desfecho da rodada. Valor de enum entra sozinho: um banco
    -- que aplicou a 0032 pela metade pode ter as tabelas e nao ter este.
    ('status_rodada tem rejeitada',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'status_rodada' and e.enumlabel = 'rejeitada'), '0032'),

    ('post_visivel_ao_cliente() (a RLS do post)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'post_visivel_ao_cliente'), '0032'),

    -- A policy que segura o sprint inteiro: post em producao nao existe para
    -- o cliente. Confere a CONDICAO, e nao so o nome -- uma policy com a
    -- clausula errada passaria por uma checagem que so procura o nome.
    ('posts_select_cliente exige enviado_em',
     exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'posts'
                and policyname = 'posts_select_cliente'
                and qual like '%enviado_em IS NOT NULL%'), '0032'),

    -- O bucket das artes. Pode faltar sozinho: ele nasce num bloco que so
    -- roda se o schema `storage` existir.
    ('bucket posts-artes',
     exists (select 1 from storage.buckets where id = 'posts-artes'), '0032'),

    -- 0033: campanhas e entregaveis.
    ('campaigns (a campanha)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'campaigns'), '0033'),

    ('deliverables (a arvore de entregaveis)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'deliverables'), '0033'),

    ('deliverable_versions (historico de arquivos)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'deliverable_versions'), '0033'),

    ('campaign_templates (os modelos de Wave)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'campaign_templates'), '0033'),

    -- O status do grupo e calculado, e esta funcao e quem calcula. Sem ela a
    -- arvore mostra o valor gravado, que no grupo nao quer dizer nada.
    ('status_do_entregavel() (o status calculado do grupo)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'status_do_entregavel'), '0033'),

    -- A policy que segura este sprint, como a do post seguro o anterior:
    -- entregavel em producao nao existe para o cliente. Confere a CONDICAO,
    -- e nao so o nome.
    ('deliverables_select_cliente exige enviado_em',
     exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'deliverables'
                and policyname = 'deliverables_select_cliente'
                and qual like '%enviado_em IS NOT NULL%'), '0033'),

    -- O motor aprendeu o terceiro tipo. Sem isto, rodada de entregavel e
    -- recusada e o Portal de campanhas nao decide nada.
    ('entregavel_da_rodada() (o motor aceita deliverable)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'entregavel_da_rodada'), '0033'),

    -- O trigger que carimba `enviado_em` mudou de nome junto com a funcao:
    -- um trigger chamado "marca post" que carimba entregavel e pista falsa.
    ('trigger approval_rounds_marca_conteudo',
     exists (select 1 from pg_trigger
              where tgname = 'approval_rounds_marca_conteudo'), '0033'),

    ('template Wave Outubro Rosa',
     exists (select 1 from public.campaign_templates
              where nome = 'Wave Outubro Rosa' and client_id is null), '0033'),

    ('bucket campanhas-arquivos',
     exists (select 1 from storage.buckets where id = 'campanhas-arquivos'), '0033'),

    -- ---- 0034: dois modulos saem do produto ----
    --
    -- AQUI O "ok" E A AUSENCIA. As tres tabelas fechavam em `auth.uid()`, e
    -- a 0034 as apagou com o dado dentro. Rodar `exportar-antes-da-0034.sql`
    -- ANTES e a unica chance de entregar aquele texto a quem escreveu: depois
    -- nao ha de onde tirar.
    ('weekly_entries APAGADA',
     not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'weekly_entries'), '0034'),

    ('weekly_notes APAGADA',
     not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'weekly_notes'), '0034'),

    ('personal_finance_entries APAGADA',
     not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'personal_finance_entries'), '0034'),

    -- ---- 0035: os indicadores ----
    ('carga_do_dia() (a carga de uma pessoa)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'carga_do_dia'), '0035'),

    -- Sem este trigger nao ha "tempo medio por etapa": ele e quem grava a
    -- TRANSICAO. Um estado atual sozinho nao diz quanto tempo se passou.
    ('trigger subtasks_registra_status',
     exists (select 1 from pg_trigger where tgname = 'subtasks_registra_status'), '0035'),

    ('rentabilidade_do_periodo()',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'rentabilidade_do_periodo'), '0035'),

    -- ---- 0036: apagar workflow ----
    ('task_types_delete (apagar workflow)',
     exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'task_types'
                and policyname = 'task_types_delete'), '0036'),

    ('demandas_do_workflow() (o que o workflow ja gerou)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'demandas_do_workflow'), '0036'),

    -- ---- 0037: lancamento retroativo ----
    ('hr_requests.origem (pedido x lancamento)',
     exists (select 1 from information_schema.columns
              where table_name = 'hr_requests' and column_name = 'origem'), '0037'),

    ('lancar_periodo() (a gestao registra o passado)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'lancar_periodo'), '0037'),

    -- A POLICY E UMA SO COM DOIS RAMOS, e conferir o nome nao bastaria:
    -- partida em duas permissivas ela vira um OR, e a de pedido sozinha ja
    -- deixaria o colaborador gravar qualquer origem. Por isso o teste olha a
    -- expressao.
    ('hr_requests_insert tem os dois ramos numa policy so',
     exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'hr_requests'
                and policyname = 'hr_requests_insert'
                and with_check like '%lancamento_retroativo%'
                and with_check like '%solicitacao%'), '0037'),

    -- ---- 0038: os feriados que o calendario passou a alcancar ----
    --
    -- Ano sem feriado na tabela nao aparece vazio, aparece NORMAL: o Natal
    -- vira um dia util qualquer e a contagem sai maior, sem nada avisando.
    ('feriados de 2025 (13 linhas)',
     (select count(*) from public.holidays
       where data between '2025-01-01' and '2025-12-31') >= 13, '0038'),

    ('feriados de 2030 (13 linhas)',
     (select count(*) from public.holidays
       where data between '2030-01-01' and '2030-12-31') >= 13, '0038'),

    -- ---- 0039: o descanso por ciclo de 12 meses ----
    ('ciclos_de_descanso() (o ciclo contado da entrada)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'ciclos_de_descanso'), '0039'),

    -- A ARIDADE E O TESTE, e nao o nome: a funcao existe desde a 0011 com
    -- dois parametros. Um banco parado na 0038 tem `saldo_de_ferias` e
    -- responderia "ok" a uma checagem que so procurasse o nome.
    ('saldo_de_ferias() perdeu o parametro de ano',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'saldo_de_ferias'
                and p.pronargs = 1), '0039'),

    ('hr_requests.ano_referencia APAGADA',
     not exists (select 1 from information_schema.columns
                  where table_name = 'hr_requests' and column_name = 'ano_referencia'), '0039'),

    ('descanso_do_ciclo() (a tela pergunta o saldo ao banco)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'descanso_do_ciclo'), '0039'),

    -- ---- 0040: demandas recorrentes ----
    ('task_recurrences (a regra)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'task_recurrences'), '0040'),

    ('recurrence_runs (o historico de execucao)',
     exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'recurrence_runs'), '0040'),

    -- A PROTECAO MAIS IMPORTANTE DA MIGRATION. Sem o indice unico, a rotina
    -- noturna e o botao "Gerar agora" clicados no mesmo segundo criam a
    -- mesma demanda duas vezes -- e o duplicado aparece como trabalho de
    -- verdade na fila de alguem.
    ('indice unico (regra, ocorrencia) -- a idempotencia',
     exists (select 1 from pg_indexes
              where schemaname = 'public' and tablename = 'recurrence_runs'
                and indexdef like '%UNIQUE%'
                and indexdef like '%recurrence_id%'
                and indexdef like '%chave_ocorrencia%'), '0040'),

    ('gerar_ocorrencia() (gera uma ocorrencia)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'gerar_ocorrencia'), '0040'),

    ('gerar_recorrencias() (a rotina diaria)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'gerar_recorrencias'), '0040'),

    ('tasks.recurrence_id (de que regra a task saiu)',
     exists (select 1 from information_schema.columns
              where table_name = 'tasks' and column_name = 'recurrence_id'), '0040'),

    ('subtasks.aviso_geracao (o aviso na etapa gerada)',
     exists (select 1 from information_schema.columns
              where table_name = 'subtasks' and column_name = 'aviso_geracao'), '0040'),

    -- Desativar cliente pausa as regras dele. Sem isto, uma conta encerrada
    -- continua recebendo demanda todo mes -- e ninguem olha o board de um
    -- cliente que saiu.
    ('trigger clients_pausa_recorrencias',
     exists (select 1 from pg_trigger where tgname = 'clients_pausa_recorrencias'), '0040')
) as t(item, existe, migration)
order by migration;
