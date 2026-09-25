-- ---------------------------------------------------------------------------
-- EM QUE MIGRATION ESTE BANCO ESTA
--
-- Cole no SQL Editor do Supabase e rode. Nao muda nada -- so olha.
--
-- Uma linha por migration, com a coisa que ela cria. A primeira que disser
-- FALTA e por onde continuar.
--
-- ESTE E O CURTO, DE PROPOSITO. O `conferir-migrations.sql` confere item por
-- item (54 linhas de resultado) e serve para quando alguma coisa parece
-- errada; este responde a pergunta que se faz antes de aplicar, e cabe numa
-- colagem sem risco de vir cortado pela metade -- que foi o que aconteceu com
-- o outro.
--
-- ANTES DE APLICAR A 0034: ela apaga o Resumo Semanal e o Financeiro Pessoal,
-- que eram privados de cada pessoa. Rode `scripts/exportar-antes-da-0034.sql`
-- primeiro e entregue o conteudo a quem escreveu. Nao tem volta.
--
-- ANTES DA 0043: ela apaga a autoavaliacao e as observacoes de skill.
-- `scripts/exportar-antes-da-0043.sql` e CONVENIENCIA e nao condicao -- ao
-- contrario do da 0034, estas tabelas a gestao ja lia.
-- ---------------------------------------------------------------------------
select
  migration,
  case when ok then 'ok' else 'FALTA' end as situacao,
  item
from (
  select v.migration, v.item,
    case v.tipo
      when 'tabela' then exists (
        select 1 from information_schema.tables t
         where t.table_schema = 'public' and t.table_name = v.nome)
      when 'sem_tabela' then not exists (
        select 1 from information_schema.tables t
         where t.table_schema = 'public' and t.table_name = v.nome)
      when 'coluna' then exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = split_part(v.nome, '.', 1)
           and c.column_name = split_part(v.nome, '.', 2))
      when 'sem_coluna' then not exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = split_part(v.nome, '.', 1)
           and c.column_name = split_part(v.nome, '.', 2))
      when 'funcao' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = v.nome)
      when 'trigger' then exists (
        select 1 from pg_trigger g where g.tgname = v.nome)
      when 'feriado' then exists (
        select 1 from public.holidays h where h.data = v.nome::date)
      -- Corpo de funcao, e nao ausencia de objeto: a 0029 nao cria nada, ela
      -- TIRA a pergunta de dentro de `pode_aprovar_subtarefa()`. Procurar um
      -- objeto que sumiu diria "ok" tambem para um banco que nunca teve a
      -- 0026 -- o trecho no corpo distingue os tres estados.
      -- O ESPELHO DO `sem_no_corpo`: a migration que ACRESCENTA um trecho a
      -- uma funcao que ja existia. Sem ele, a unica pergunta possivel seria
      -- "a funcao existe?" -- e ela existe desde muito antes.
      when 'no_corpo' then exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = split_part(v.nome, '|', 1)
           and p.prosrc like '%' || split_part(v.nome, '|', 2) || '%')
      -- POLICY QUE MUDOU DE REGRA, e nao policy que nasceu: a `campaigns_insert`
      -- existe desde a 0033 com outra pergunta dentro. O que se confere e o
      -- CORPO dela -- `tabela|policy|trecho`.
      when 'policy' then exists (
        select 1 from pg_policies pl
         where pl.schemaname = 'public'
           and pl.tablename = split_part(v.nome, '|', 1)
           and pl.policyname = split_part(v.nome, '|', 2)
           and coalesce(pl.with_check, pl.qual) like '%' || split_part(v.nome, '|', 3) || '%')
      -- POLICY FORA DO SCHEMA `public`. A 0057 escreve em
      -- `realtime.messages`, que e do Supabase -- o `policy` acima fecha em
      -- `schemaname = 'public'` e responderia FALTA para sempre.
      -- `schema|tabela|policy`.
      when 'policy_fora' then exists (
        select 1 from pg_policies pl
         where pl.schemaname = split_part(v.nome, '|', 1)
           and pl.tablename  = split_part(v.nome, '|', 2)
           and pl.policyname = split_part(v.nome, '|', 3))
      when 'sem_no_corpo' then not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = split_part(v.nome, '|', 1)
           and p.prosrc like '%' || split_part(v.nome, '|', 2) || '%')
    end as ok
  from (values
    -- SEM LINHA: 0026 - ela nao deixa rastro. A 0026 reescreveu
    -- `pode_aprovar_subtarefa()` para fazer tres perguntas, e a 0029
    -- reescreveu de novo tirando as tres. Num banco em dia nao sobra objeto
    -- nem trecho de corpo que diga se a 0026 passou por aqui, e a linha da
    -- 0029 logo abaixo ja cobre o estado final. Inventar uma checagem que
    -- responde "ok" sempre seria pior que a ausencia: ela afirmaria sem
    -- conferir. Quem estiver parado na 0025 le a 0027 dizendo FALTA e aplica
    -- da 0026 em diante, que e a ordem certa de qualquer jeito.
    ('0022', 'subtasks.parent_id',              'coluna',       'subtasks.parent_id'),
    ('0023', 'exigencia_aprovacao apagada',     'sem_coluna',   'tasks.exigencia_aprovacao'),
    ('0024', 'dias_do_pedido()',                'funcao',       'dias_do_pedido'),
    ('0025', 'tasks_volta_a_calcular',          'trigger',      'tasks_volta_a_calcular'),
    ('0027', 'subtasks.data_inicio',            'coluna',       'subtasks.data_inicio'),
    ('0028', 'tasks.publicada_em',              'coluna',       'tasks.publicada_em'),
    ('0029', 'trava de autoaprovacao fora',     'sem_no_corpo', 'pode_aprovar_subtarefa|responsavel_id'),
    ('0030', 'approval_rounds.content_id',      'coluna',       'approval_rounds.content_id'),
    ('0031', 'client_access_log',               'tabela',       'client_access_log'),
    ('0032', 'posts',                           'tabela',       'posts'),
    ('0033', 'campaigns',                       'tabela',       'campaigns'),
    ('0034', 'weekly_entries APAGADA',          'sem_tabela',   'weekly_entries'),
    ('0035', 'carga_do_dia()',                  'funcao',       'carga_do_dia'),
    ('0036', 'demandas_do_workflow()',          'funcao',       'demandas_do_workflow'),
    ('0037', 'hr_requests.origem',              'coluna',       'hr_requests.origem'),
    ('0038', 'Natal de 2030 na tabela',         'feriado',      '2030-12-25'),
    ('0039', 'ciclos_de_descanso()',            'funcao',       'ciclos_de_descanso'),
    ('0040', 'task_recurrences',                'tabela',       'task_recurrences'),
    ('0041', 'responsavel padrao da regra',     'no_corpo',     'gerar_ocorrencia|responsavel_padrao'),
    ('0042', 'posts.midia',                     'coluna',       'posts.midia'),
    ('0043', 'user_skills APAGADA',             'sem_tabela',   'user_skills'),
    ('0044', 'abrir_mes_de_social()',           'funcao',       'abrir_mes_de_social'),
    ('0045', 'post_etapas',                     'tabela',       'post_etapas'),
    ('0046', 'post_referencias',                'tabela',       'post_referencias'),
    ('0047', 'tenho_etapa_no_post()',           'funcao',       'tenho_etapa_no_post'),
    ('0048', 'post_versions.removeu_arquivos',  'coluna',       'post_versions.removeu_arquivos'),
    ('0049', 'home_summary()',                  'funcao',       'home_summary'),
    ('0050', 'campaigns.capa_url',              'coluna',       'campaigns.capa_url'),
    ('0051', 'abrir_campanha()',                'funcao',       'abrir_campanha'),
    -- A 0052 e a unica das seis que nao cria objeto: ela devolve o bloco de
    -- carimbos que a 0030 perdeu. Procurar uma funcao diria "ok" para um banco
    -- que nunca a aplicou -- o trecho no corpo e o que distingue.
    ('0052', 'carimbos de data de volta',       'no_corpo',     'validar_transicao_de_subtarefa|concluida_em'),
    ('0053', 'deliverable_versions.arquivos',   'coluna',       'deliverable_versions.arquivos'),
    ('0054', 'campaigns_insert e atendimento',  'policy',       'campaigns|campaigns_insert|is_atendimento'),
    -- A 0055 e a que faltava nesta lista, e a falta apareceu do pior jeito:
    -- o /painel/calendario devolvia erro de servidor e ESTE script respondia
    -- "ok" em todas as linhas, porque a ultima que ele conhecia era a 0054.
    -- Um script cujo trabalho inteiro e dizer qual migration falta nao pode
    -- ficar para tras da pasta em silencio: quem o rodasse concluiria que o
    -- banco estava em dia e iria procurar o problema no codigo.
    -- Hoje quem confere a lista e o `npm run check:migrations`, no CI.
    ('0055', 'view calendar_events',            'tabela',       'calendar_events'),
    ('0056', 'rate_limits',                     'tabela',       'rate_limits'),
    ('0057', 'equipe_ouve_o_canal',            'policy_fora',  'realtime|messages|equipe_ouve_o_canal')
  ) as v(migration, item, tipo, nome)
) x
order by migration;
