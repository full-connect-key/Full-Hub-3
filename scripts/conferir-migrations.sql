-- ---------------------------------------------------------------------------
-- O QUE JA ENTROU E O QUE FALTA
--
-- Cole isto no SQL Editor do Supabase. Ele nao muda nada -- so olha.
--
-- Cada linha e uma coisa que uma das migrations novas cria. "FALTA" quer
-- dizer que aquela migration ainda nao rodou neste banco.
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

    ('pode_decidir_rodada() (ninguem aprova o proprio trabalho)',
     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'pode_decidir_rodada'), '0026'),

    ('subtasks.data_inicio (periodo da etapa)',
     exists (select 1 from information_schema.columns
              where table_name = 'subtasks' and column_name = 'data_inicio'), '0027'),

    ('tasks.publicada_em (rascunho)',
     exists (select 1 from information_schema.columns
              where table_name = 'tasks' and column_name = 'publicada_em'), '0028')
) as t(item, existe, migration)
order by migration;
