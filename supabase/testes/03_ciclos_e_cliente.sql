\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

select teste.limpar();

-- ===========================================================================
-- Dois ciclos de ajuste: as duas rodadas continuam no banco, com o que foi
-- pedido em cada uma. Nada e sobrescrito para "limpar" o estado atual.
-- ===========================================================================
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio)
values ('abababab-0000-0000-0000-00000000000a', :VERDE, 'Duas voltas de ajuste', :CARLA, current_date);

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao, status)
values ('bcbcbcbc-0000-0000-0000-000000000001','abababab-0000-0000-0000-00000000000a','Peça-chave',1,:BRUNO,true,'interna','em_andamento');

-- Rodada 1 -> ajustes
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('bcbcbcbc-0000-0000-0000-000000000001', 1, 'interna', :BRUNO);
update public.subtasks set status = 'enviada_aprovacao' where id = 'bcbcbcbc-0000-0000-0000-000000000001';
update public.approval_rounds set status = 'ajustes_solicitados', decidido_por = :DIEGO,
       comentario = 'Primeira volta: trocar a cor.'
 where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000001' and numero_rodada = 1;
update public.subtasks set status = 'em_ajustes' where id = 'bcbcbcbc-0000-0000-0000-000000000001';

-- Rodada 2 -> ajustes de novo
update public.subtasks set status = 'em_andamento' where id = 'bcbcbcbc-0000-0000-0000-000000000001';
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('bcbcbcbc-0000-0000-0000-000000000001', 2, 'interna', :BRUNO);
update public.subtasks set status = 'enviada_aprovacao' where id = 'bcbcbcbc-0000-0000-0000-000000000001';
update public.approval_rounds set status = 'ajustes_solicitados', decidido_por = :DIEGO,
       comentario = 'Segunda volta: a tipografia.'
 where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000001' and numero_rodada = 2;
update public.subtasks set status = 'em_ajustes' where id = 'bcbcbcbc-0000-0000-0000-000000000001';

select teste.conferir('As duas rodadas continuam no banco',
  (select count(*)::text from public.approval_rounds
    where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000001'), '2');

select teste.conferir('A rodada 1 preservou o comentario dela',
  (select comentario from public.approval_rounds
    where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000001' and numero_rodada = 1),
  'Primeira volta: trocar a cor.');

select teste.conferir('A task ficou em em_ajustes',
  teste.status_da_task('abababab-0000-0000-0000-00000000000a'), 'em_ajustes');

-- ===========================================================================
-- O caminho completo de uma aprovacao de CLIENTE, do envio a conclusao.
-- ===========================================================================
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao, status)
values ('bcbcbcbc-0000-0000-0000-000000000002','abababab-0000-0000-0000-00000000000a','KV final',2,:BRUNO,true,'cliente','em_andamento');

insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por)
values ('bcbcbcbc-0000-0000-0000-000000000002', 1, 'interna', :BRUNO);
update public.subtasks set status = 'enviada_aprovacao' where id = 'bcbcbcbc-0000-0000-0000-000000000002';
update public.approval_rounds set status = 'aprovada', decidido_por = :DIEGO
 where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000002' and escopo = 'interna';

select teste.conferir('Aval interno nao conclui a de tipo cliente',
  (select status::text from public.subtasks where id = 'bcbcbcbc-0000-0000-0000-000000000002'),
  'enviada_aprovacao');

-- O envio ao cliente precisa rodar COMO o desenvolvedor: o trigger
-- validar_nova_rodada exige is_gestor(), e num SQL solto auth.uid() e nulo.
-- Ou seja: nem por SQL direto o responsavel manda material ao cliente.
-- Diego e gestor, mas se a entrega fosse DELE nem ele poderia enviar.
insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao, status)
values ('bcbcbcbc-0000-0000-0000-000000000003','abababab-0000-0000-0000-00000000000a','Entrega do proprio Diego',3,:DIEGO,true,'cliente','em_andamento');
insert into public.approval_rounds (subtask_id, numero_rodada, escopo, status, solicitado_por, decidido_por, decidido_em)
values ('bcbcbcbc-0000-0000-0000-000000000003', 1, 'interna', 'pendente', :DIEGO, null, null);
update public.approval_rounds set status = 'aprovada', decidido_por = :ANA, decidido_em = now()
 where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000003';

select teste.cenario('Nem o gestor envia ao cliente a propria entrega', :DIEGO,
  format('insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por) values (''bcbcbcbc-0000-0000-0000-000000000003'', 1, ''cliente'', %L)', :DIEGO),
  'recusa');

select teste.cenario('Desenvolvedor abre a rodada do cliente', :DIEGO,
  format('insert into public.approval_rounds (subtask_id, numero_rodada, escopo, solicitado_por) values (''bcbcbcbc-0000-0000-0000-000000000002'', 1, ''cliente'', %L)', :DIEGO),
  'ok', 1);

select teste.cenario('Cliente aprova pela funcao do banco', '77777777-7777-7777-7777-777777777777',
  '(select public.decidir_rodada_do_cliente((select id from public.approval_rounds where subtask_id = ''bcbcbcbc-0000-0000-0000-000000000002'' and escopo = ''cliente''), ''aprovada'', ''Pode publicar.''))',
  'ok');

select teste.conferir('A decisao do cliente concluiu a subtarefa',
  (select status::text from public.subtasks where id = 'bcbcbcbc-0000-0000-0000-000000000002'),
  'concluida');

select teste.conferir('O historico registrou a decisao do cliente',
  (select count(*)::text from public.task_history where acao = 'cliente_aprovou'), '1');

select teste.conferir('O comentario do cliente nao e interno',
  (select interno::text from public.task_comentarios
    where subtask_id = 'bcbcbcbc-0000-0000-0000-000000000002' limit 1), 'false');
