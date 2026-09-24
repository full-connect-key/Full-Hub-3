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
      when 'sem_no_corpo' then not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = split_part(v.nome, '|', 1)
           and p.prosrc like '%' || split_part(v.nome, '|', 2) || '%')
    end as ok
  from (values
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
    ('0040', 'task_recurrences',                'tabela',       'task_recurrences')
  ) as v(migration, item, tipo, nome)
) x
order by migration;
