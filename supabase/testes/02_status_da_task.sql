\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

-- Task com 4 subtarefas; a ultima exige aprovacao interna.
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('eeeeeeee-0000-0000-0000-00000000000a', :VERDE, 'Regra da última subtarefa', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao) values
  ('ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-00000000000a','Uma',   1,:MARINA,false,null),
  ('ffffffff-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-00000000000a','Duas',  2,:MARINA,false,null),
  ('ffffffff-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-00000000000a','Três',  3,:MARINA,false,null),
  ('ffffffff-0000-0000-0000-000000000004','eeeeeeee-0000-0000-0000-00000000000a','Quatro',4,:MARINA,true,'interna');

create or replace function teste.status_da_task(p uuid) returns text
language sql stable as $$ select status::text from public.tasks where id = p $$;

create or replace function teste.conferir(p_descricao text, p_achado text, p_esperado text)
returns void language plpgsql as $$
begin
  insert into teste.resultado (descricao, situacao, detalhe)
  values (p_descricao,
          case when p_achado is not distinct from p_esperado then 'passou' else 'FALHOU' end,
          format('esperado %s, achado %s', p_esperado, p_achado));
end $$;

select teste.conferir('Task nova, todas nao iniciadas: nao_iniciada',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'nao_iniciada');

update public.subtasks set status = 'em_andamento' where id = 'ffffffff-0000-0000-0000-000000000001';
select teste.conferir('Uma em andamento: em_andamento',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_andamento');

update public.subtasks set status = 'aguardando_informacoes' where id = 'ffffffff-0000-0000-0000-000000000001';
select teste.conferir('Unica atividade esperando informacao: aguardando_informacoes',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'aguardando_informacoes');

update public.subtasks set status = 'concluida' where id in
  ('ffffffff-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-000000000002','ffffffff-0000-0000-0000-000000000003');
select teste.conferir('Tres concluidas e a quarta parada: em_andamento',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_andamento');

-- A etapa "Quatro" pede aval interno e nao tem rodada nenhuma. Desde a 0023 o
-- `entregue` para aqui: a demanda so e dada por entregue quando TODA etapa que
-- pediu aval tiver a rodada aprovada dela.
select teste.recusa_com('Entregue e recusado com etapa sem aprovacao', :ANA,
  $$update public.tasks set status = 'entregue', status_manual = true
     where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  '"Quatro"');

select teste.conferir('E a task fica no status calculado',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_andamento');

-- Sem etapa pedindo aval, o gestor marca a mao e o calculo respeita. E o que
-- este trecho sempre testou; a exigencia sai e volta para provar so isso.
update public.subtasks set requer_aprovacao = false, tipo_aprovacao = null
 where id = 'ffffffff-0000-0000-0000-000000000004';
update public.tasks set status = 'entregue', status_manual = true
 where id = 'eeeeeeee-0000-0000-0000-00000000000a';
select teste.conferir('Gestor marca entregue a mao, e fica',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'entregue');
update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna'
 where id = 'ffffffff-0000-0000-0000-000000000004';
select teste.conferir('E o entregue resiste a exigencia voltar',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'entregue');

-- A quarta vai para aprovacao: a rodada pendente toma o controle de volta
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('ffffffff-0000-0000-0000-000000000004', 1, 'interna', :MARINA);
select teste.conferir('Rodada pendente reassume o controle: em_aprovacao',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_aprovacao');

select teste.conferir('status_manual foi zerado',
  (select status_manual::text from public.tasks where id = 'eeeeeeee-0000-0000-0000-00000000000a'), 'false');

-- Com aprovacao pendente, concluir e impossivel: nao existe caminho
select teste.cenario('Task nao vai a concluido com aprovacao pendente', :ANA,
  'update public.subtasks set status = ''concluida'' where id = ''ffffffff-0000-0000-0000-000000000004''',
  'recusa');
select teste.conferir('A task continua em em_aprovacao',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_aprovacao');

-- Ajustes solicitados vencem a rodada pendente na precedencia
update public.subtasks set requer_aprovacao = true, tipo_aprovacao = 'interna', status = 'nao_iniciada'
 where id = 'ffffffff-0000-0000-0000-000000000003';
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('ffffffff-0000-0000-0000-000000000003', 1, 'interna', :MARINA);
select teste.cenario('em_ajustes sem rodada que pediu ajuste e recusado', :MARINA,
  'update public.subtasks set status = ''em_ajustes'' where id = ''ffffffff-0000-0000-0000-000000000003''',
  'recusa');
update public.approval_rounds set status = 'ajustes_solicitados', decidido_por = :DIEGO,
       comentario = 'Refazer a terceira'
 where subtask_id = 'ffffffff-0000-0000-0000-000000000003';
update public.subtasks set status = 'em_ajustes' where id = 'ffffffff-0000-0000-0000-000000000003';
select teste.conferir('em_ajustes vence em_aprovacao na precedencia',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_ajustes');

-- Fecha tudo: a task conclui
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('ffffffff-0000-0000-0000-000000000003', 2, 'interna', :MARINA);
update public.approval_rounds set status = 'aprovada', decidido_por = :DIEGO
 where subtask_id = 'ffffffff-0000-0000-0000-000000000003' and numero_rodada = 2;
update public.subtasks set status = 'concluida' where id = 'ffffffff-0000-0000-0000-000000000003';
update public.approval_rounds set status = 'aprovada', decidido_por = :DIEGO
 where subtask_id = 'ffffffff-0000-0000-0000-000000000004';
update public.subtasks set status = 'concluida' where id = 'ffffffff-0000-0000-0000-000000000004';
select teste.conferir('Todas concluidas e nenhuma rodada pendente: concluido',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'concluido');
select teste.conferir('concluida_em foi carimbado',
  (select (concluida_em is not null)::text from public.tasks where id = 'eeeeeeee-0000-0000-0000-00000000000a'), 'true');

-- ---------------------------------------------------------------------------
-- Cancelada saiu dos status da Task (migration 0020)
--
-- Ela era o terceiro status manual. Saiu porque uma demanda que nao vai mais
-- acontecer se apaga, e uma Task parada em `cancelada` ficava para sempre no
-- board de quem nao quer ve-la.
--
-- O valor continua no enum do Postgres -- `alter type ... drop value` nao
-- existe --, e e por isso que a trava precisa ser um trigger. Sem ele, o
-- enum aceitaria a escrita calada.
-- ---------------------------------------------------------------------------
select teste.recusa_com('Marcar cancelada a mao e recusado', :ANA,
  $$update public.tasks set status = 'cancelada', status_manual = true
     where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  'Cancelada saiu dos status da Task');

-- A recusa aponta a saida. "Nao pode" sem caminho manda a pessoa procurar
-- outro jeito -- ou abandonar a demanda aberta no board.
select teste.recusa_com_dica('E a recusa diz o que fazer no lugar', :ANA,
  $$update public.tasks set status = 'cancelada', status_manual = true
     where id = 'eeeeeeee-0000-0000-0000-00000000000a'$$,
  'se apaga, em Gestao de Tasks');

-- Nascer cancelada tambem nao passa: o trigger cobre insert e update.
select teste.recusa_com('Nascer cancelada tambem e recusado', :ANA,
  $$insert into public.tasks (client_id, titulo, criado_por, data_inicio, link_entrega, status, status_manual)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Ja nasce morta', $$ || quote_literal(:ANA) || $$,
            '2026-10-01', 'https://drive.google.com/drive/folders/teste', 'cancelada', true)$$,
  'Cancelada saiu dos status da Task');

-- E a Task segue viva: a recusa nao deixou meio caminho gravado.
update public.subtasks set status = 'em_andamento' where id = 'ffffffff-0000-0000-0000-000000000001';
select teste.conferir('Depois da recusa a task continua sendo calculada',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'em_andamento');

-- ---------------------------------------------------------------------------
-- Os dois que sobraram continuam manuais
--
-- Sem `cancelada`, `entregue` e `aguardando_informacoes` sao os unicos que
-- alguem escreve a mao. Se a 0020 tivesse levado o resisto do calculo junto,
-- este cenario cairia.
-- ---------------------------------------------------------------------------
update public.tasks set status = 'entregue', status_manual = true
 where id = 'eeeeeeee-0000-0000-0000-00000000000a';
update public.subtasks set status = 'em_andamento' where id = 'ffffffff-0000-0000-0000-000000000002';
select teste.conferir('Entregue a mao resiste ao recalculo',
  teste.status_da_task('eeeeeeee-0000-0000-0000-00000000000a'), 'entregue');
