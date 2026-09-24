\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- Sprint 3C -- Portais de Clientes
--
-- A pergunta destes cenarios: a visualizacao administrativa do portal e mesmo
-- so LEITURA, e o registro dela resiste a quem quiser forjar?
--
-- Joana e cliente da Mundo Verde. Ana e socia, Diego desenvolvedor, Carla
-- colaboradora -- e colaborador NAO alcanca portal de cliente nenhum.
-- ===========================================================================

delete from public.client_portal_views;


-- --- O slug ----------------------------------------------------------------

select teste.cenario('Todo cliente tem slug', :DIEGO,
  'select 1 from public.clients where slug is null', 'ok', 0);

select teste.cenario('O slug perde o acento e vira endereco', :DIEGO,
  format('select 1 from public.clients where id = %L and slug = %L', :OPTICA, 'optica-visao'),
  'ok', 1);

-- Dois nomes que colapsariam no mesmo endereco: o segundo ganha sufixo, em vez
-- de o indice unico derrubar o cadastro na cara de quem esta cadastrando.
select teste.cenario('Nome repetido nao quebra o cadastro: o slug desempata', :ANA,
  format($fmt$
    insert into public.clients (nome_empresa) values (%L)
  $fmt$, 'Óptica Visão'), 'ok', 1);

select teste.cenario('O desempate saiu como optica-visao-2', :DIEGO,
  format('select 1 from public.clients where slug = %L', 'optica-visao-2'), 'ok', 1);


-- --- Quem registra visita --------------------------------------------------

select teste.cenario('Socia registra que abriu o portal da Mundo Verde', :ANA,
  format($fmt$
    insert into public.client_portal_views (client_id, staff_user_id)
    values (%L, %L)
  $fmt$, :VERDE, :ANA), 'ok', 1);

select teste.cenario('Desenvolvedor tambem registra', :DIEGO,
  format($fmt$
    insert into public.client_portal_views (client_id, staff_user_id)
    values (%L, %L)
  $fmt$, :OPTICA, :DIEGO), 'ok', 1);

-- O ponto da auditoria: registro que qualquer um forja nao registra nada.
select teste.cenario('Colaboradora NAO registra visita -- ela nem alcanca o portal', :CARLA,
  format($fmt$
    insert into public.client_portal_views (client_id, staff_user_id)
    values (%L, %L)
  $fmt$, :VERDE, :CARLA), 'recusa');

select teste.cenario('Ninguem registra visita em nome de outra pessoa', :DIEGO,
  format($fmt$
    insert into public.client_portal_views (client_id, staff_user_id)
    values (%L, %L)
  $fmt$, :VERDE, :ANA), 'recusa');

select teste.cenario('Cliente NAO registra visita', :JOANA,
  format($fmt$
    insert into public.client_portal_views (client_id, staff_user_id)
    values (%L, %L)
  $fmt$, :VERDE, :JOANA), 'recusa');


-- --- Quem le o registro ----------------------------------------------------

select teste.cenario('Gestao le o registro inteiro', :ANA,
  'select 1 from public.client_portal_views', 'ok', 2);

select teste.cenario('Colaboradora nao le registro de visita', :CARLA,
  'select 1 from public.client_portal_views', 'ok', 0);

select teste.cenario('Cliente nao le registro de visita', :JOANA,
  'select 1 from public.client_portal_views', 'ok', 0);


-- --- Encerrar a visita -----------------------------------------------------

select teste.cenario('A pessoa encerra a propria visita', :ANA,
  format($fmt$
    update public.client_portal_views set encerrado_em = now()
     where staff_user_id = %L and encerrado_em is null
  $fmt$, :ANA), 'ok', 1);

select teste.cenario('Ninguem encerra a visita de outra pessoa', :DIEGO,
  format($fmt$
    update public.client_portal_views set encerrado_em = now()
     where staff_user_id = %L
  $fmt$, :ANA), 'recusa');

-- Registro de auditoria nao se apaga pela aplicacao: nao existe policy de
-- DELETE, entao nem a socia consegue.
select teste.cenario('Nem a socia apaga um registro de visita', :ANA,
  'delete from public.client_portal_views', 'recusa');


-- --- A trava que vale: decidir pelo cliente --------------------------------
--
-- Este e o criterio de aceite do sprint. A visualizacao administrativa mostra
-- as telas do cliente; a decisao do cliente continua fora de alcance, e a
-- recusa esta no BANCO -- nao adianta chamar a API do Supabase direto.

delete from public.task_history;
delete from public.approval_rounds;
delete from public.subtasks;
delete from public.tasks;

insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('eeeeeeee-0000-0000-0000-00000000000a', :VERDE, 'Campanha de outubro', :CARLA, '2026-10-01', 'https://drive.google.com/drive/folders/teste');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao, status)
values ('ffffffff-0000-0000-0000-00000000000a', 'eeeeeeee-0000-0000-0000-00000000000a',
        'Arte do post', 1, '44444444-4444-4444-4444-444444444444', true, 'cliente', 'em_andamento');

-- O caminho inteiro, porque o banco nao deixa pular etapa: o Bruno pede o aval
-- interno, o Diego aprova, e SO ENTAO a rodada do cliente pode nascer. Montar
-- o cenario ja e uma prova de que a cadeia esta de pe.
insert into public.approval_rounds (content_id, numero_rodada, escopo, solicitado_por)
values ('ffffffff-0000-0000-0000-00000000000a', 1, 'interna', '44444444-4444-4444-4444-444444444444');
update public.subtasks set status = 'enviada_aprovacao'
 where id = 'ffffffff-0000-0000-0000-00000000000a';
update public.approval_rounds set status = 'aprovada', decidido_por = :DIEGO, decidido_em = now()
 where content_id = 'ffffffff-0000-0000-0000-00000000000a' and escopo = 'interna';

-- A rodada de cliente so nasce pela mao do Desenvolvedor: o gatilho
-- validar_nova_rodada le auth.uid(), que como superusuario e nulo. Por isso o
-- preparo se identifica como o Diego.
select set_config('request.jwt.claim.sub', :DIEGO, false);

insert into public.approval_rounds (id, content_id, escopo, numero_rodada, status, solicitado_por)
values ('ffffffff-0000-0000-0000-0000000000c1', 'ffffffff-0000-0000-0000-00000000000a',
        'cliente', 1, 'pendente', :DIEGO);

select set_config('request.jwt.claim.sub', '', false);

-- A ordem importa: as recusas vem primeiro, contra a rodada AINDA PENDENTE.
-- Aprovar antes faria cada recusa passar pelo motivo errado -- "esta rodada ja
-- foi decidida" em vez de "voce nao e o cliente dela" -- e o teste diria que
-- esta tudo bem sem ter olhado para o que importa.

select teste.cenario('A SOCIA nao decide no lugar do cliente, nem chamando o banco direto', :ANA,
  format($fmt$
    select public.decidir_rodada_do_cliente(%L, 'aprovada', null)
  $fmt$, 'ffffffff-0000-0000-0000-0000000000c1'), 'recusa');

select teste.cenario('O desenvolvedor tambem nao decide pelo cliente', :DIEGO,
  format($fmt$
    select public.decidir_rodada_do_cliente(%L, 'ajustes_solicitados', 'muda a cor')
  $fmt$, 'ffffffff-0000-0000-0000-0000000000c1'), 'recusa');

-- E o cliente de OUTRA empresa tambem nao: o isolamento por client_id vale
-- para a decisao como vale para a leitura.
select teste.cenario('O cliente da outra empresa nao decide esta rodada',
  '88888888-8888-8888-8888-888888888888',
  format($fmt$
    select public.decidir_rodada_do_cliente(%L, 'aprovada', null)
  $fmt$, 'ffffffff-0000-0000-0000-0000000000c1'), 'recusa');

-- A rodada continua de pe depois das tres recusas.
select teste.cenario('Depois das recusas a rodada segue pendente', :DIEGO,
  format('select 1 from public.approval_rounds where id = %L and status = %L',
         'ffffffff-0000-0000-0000-0000000000c1', 'pendente'), 'ok', 1);

select teste.cenario('A cliente aprova a propria rodada', :JOANA,
  format($fmt$
    select public.decidir_rodada_do_cliente(%L, 'aprovada', null)
  $fmt$, 'ffffffff-0000-0000-0000-0000000000c1'), 'ok');

select teste.cenario('A aprovacao do cliente concluiu a subtarefa', :DIEGO,
  format('select 1 from public.subtasks where id = %L and status = %L',
         'ffffffff-0000-0000-0000-00000000000a', 'concluida'), 'ok', 1);


-- --- O slug reservado ------------------------------------------------------
--
-- No Next, rota estatica ganha de rota dinamica. Um cliente com slug
-- "campanhas" nao roubaria /portal/campanhas -- o portal dele e que nunca
-- abriria, e ninguem entenderia por que. O banco desvia antes.

select teste.cenario('Empresa chamada Campanhas nao fica com o slug "campanhas"', :ANA,
  format('insert into public.clients (nome_empresa) values (%L)', 'Campanhas'), 'ok', 1);

select teste.cenario('Ela recebeu campanhas-2', :DIEGO,
  format('select 1 from public.clients where nome_empresa = %L and slug = %L',
         'Campanhas', 'campanhas-2'), 'ok', 1);

select teste.cenario('Escolher "aprovacoes" a mao e recusado com explicacao', :ANA,
  format($fmt$
    insert into public.clients (nome_empresa, slug) values (%L, %L)
  $fmt$, 'Outra Empresa', 'aprovacoes'), 'recusa');
