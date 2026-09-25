\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- 0055 -- O CALENDARIO FULL: A VIEW QUE PODIA VAZAR TUDO, E OS EVENTOS
--
-- O que estes cenarios guardam, e que nenhuma tela mostraria:
--
--   1. `security_invoker = true` NA VIEW. Sem essa clausula a view roda com
--      os direitos de quem a criou -- o superusuario da migration -- e passa
--      a ler as sete tabelas de origem INTEIRAS, para qualquer pessoa
--      autenticada. O cliente de uma empresa veria a agenda da agencia com o
--      nome das demandas de todos os outros clientes.
--
--      **E o furo passa despercebido num banco com um cliente so**: ele ve
--      seis campanhas, que e o total, e "seis de seis" tem a mesma cara com a
--      RLS ligada e desligada. Por isso os cenarios abaixo criam material da
--      OPTICA e conferem que a JOANA, que e do Mundo Verde, nao o alcanca. E
--      esse o cenario que falha se alguem tirar o `security_invoker`.
--
--   2. O RASCUNHO NAO VAZA NEM PARA QUEM O CRIOU. A RLS restritiva ja esconde
--      o dos outros; o filtro `publicada_em is not null` da view esconde o
--      meu. Sem ele, o calendario da agencia mostraria para mim uma demanda
--      que ninguem mais enxerga -- e eu a trataria como combinada.
--
--   3. SO AS FOLHAS. A agrupadora guarda o prazo de quando ainda era folha, e
--      sem o `not exists` a mesma entrega apareceria duas vezes no mes, uma
--      delas numa data que ninguem mais usa.
--
--   4. QUEM ABRE EVENTO e `is_atendimento()`, a mesma pergunta de
--      `tasks_insert`. Bruno e Design: ele le o calendario e nao escreve nele.
--
--   5. O EVENTO QUE BLOQUEIA PERIODO alcanca os PARTICIPANTES quando ha
--      participantes, e TODO MUNDO quando nao ha. Os dois sentidos, porque
--      inverter essa regra e o erro natural -- "sem participantes" lido como
--      "ninguem" deixaria a convencao da agencia sem bloquear nada.
-- ===========================================================================

select teste.limpar();
delete from public.event_participants;
delete from public.events;
delete from public.deliverables;
delete from public.campaigns;
delete from public.posts;
delete from public.hr_requests;

\set TASK_VERDE   '''c0000000-0000-0000-0000-00000000a001'''
\set TASK_OPTICA  '''c0000000-0000-0000-0000-00000000a002'''
\set TASK_DRAFT   '''c0000000-0000-0000-0000-00000000a003'''
\set MAE          '''c0000000-0000-0000-0000-00000000b001'''
\set FILHA        '''c0000000-0000-0000-0000-00000000b002'''
\set EVENTO_TODOS '''c0000000-0000-0000-0000-00000000e001'''
\set EVENTO_ALGUNS '''c0000000-0000-0000-0000-00000000e002'''


-- ---------------------------------------------------------------------------
-- O MATERIAL DOS DOIS CLIENTES
--
-- Como `postgres`, de proposito: montar o cenario nao e o que se verifica --
-- o que se verifica e quem consegue LER isto depois.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, data_inicio, data_fim, link_entrega, criado_por)
values
  (:TASK_VERDE,  :VERDE,  'Wave do Mundo Verde', current_date, current_date + 10,
   'https://drive.google.com/verde', :ANA),
  (:TASK_OPTICA, :OPTICA, 'Campanha da Óptica',  current_date, current_date + 10,
   'https://drive.google.com/optica', :ANA);

-- O RASCUNHO: `publicada_em` nulo. Criado pela ANA, e nem ela deve ve-lo aqui.
insert into public.tasks (id, client_id, titulo, data_inicio, data_fim, link_entrega, criado_por, publicada_em)
values (:TASK_DRAFT, :VERDE, 'Ideia solta que ainda nao existe', current_date,
        current_date + 3, 'https://drive.google.com/rascunho', :ANA, null);

-- A MAE E A FILHA, as duas com prazo: so a filha pode aparecer.
insert into public.subtasks (id, task_id, titulo, prazo, responsavel_id, ordem)
values (:MAE, :TASK_VERDE, 'Arte', current_date + 5, :BRUNO, 1);
insert into public.subtasks (id, task_id, parent_id, titulo, prazo, responsavel_id, ordem)
values (:FILHA, :TASK_VERDE, :MAE, 'KV', current_date + 4, :BRUNO, 1);

-- O rascunho tambem tem etapa com prazo: ela nao pode aparecer por tabela
-- nenhuma.
insert into public.subtasks (task_id, titulo, prazo, responsavel_id, ordem)
values (:TASK_DRAFT, 'Etapa de um rascunho', current_date + 2, :BRUNO, 1);

insert into public.campaigns (client_id, nome, data_inicio, data_fim, status, criado_por)
values
  (:VERDE,  'Wave Verde',  current_date, current_date + 20, 'ativa', :ANA),
  (:OPTICA, 'Wave Óptica', current_date, current_date + 20, 'ativa', :ANA);

-- Um post ENVIADO de cada empresa: o cliente enxerga post enviado, e so o da
-- empresa dele.
insert into public.posts (client_id, tema, data_publicacao, plataforma, status, criado_por, enviado_em)
values
  (:VERDE,  'Post do Verde',  current_date + 1, 'instagram', 'em_aprovacao', :ANA, now()),
  (:OPTICA, 'Post da Óptica', current_date + 1, 'instagram', 'em_aprovacao', :ANA, now());

-- Duas ausencias: uma combinada e uma esperando resposta.
insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, status)
values
  (:BRUNO,  'ferias',   current_date + 2, current_date + 6, 5, 'aprovada'),
  (:RAFAEL, 'ausencia', current_date + 3, current_date + 3, 1, 'pendente');


-- ---------------------------------------------------------------------------
-- 1. O CLIENTE NAO ATRAVESSA A VIEW
--
-- E O CENARIO QUE FALHA SE O `security_invoker` SAIR. Ele nao pergunta
-- "quantas linhas a Joana ve", pergunta "ela alcanca alguma coisa da OPTICA" --
-- que e zero com a RLS valendo e diferente de zero sem ela.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Cliente nao alcanca NADA da outra empresa pela view',
  :JOANA,
  $$select count(*)::text from public.calendar_events where client_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '0'
);

select teste.conferir_como(
  'Cliente nao ve demanda nenhuma, nem da propria empresa',
  :JOANA,
  $$select count(*)::text from public.calendar_events where tipo = 'task'$$,
  '0'
);

select teste.conferir_como(
  'Cliente nao ve etapa da equipe',
  :JOANA,
  $$select count(*)::text from public.calendar_events where tipo = 'subtarefa'$$,
  '0'
);

select teste.conferir_como(
  'Cliente nao ve quem da agencia esta fora',
  :JOANA,
  $$select count(*)::text from public.calendar_events where tipo = 'ausencia'$$,
  '0'
);

-- O QUE ELE VE: o post enviado e a campanha da empresa dele, que e o desenho
-- do Portal. Um cenario que so conferisse os zeros passaria com a view
-- devolvendo lista vazia para todo mundo -- inclusive quebrada.
select teste.conferir_como(
  'Cliente ve o post ENVIADO da empresa dele',
  :JOANA,
  $$select titulo from public.calendar_events where tipo = 'post'$$,
  'Post do Verde'
);

select teste.conferir_como(
  'Cliente ve a campanha da empresa dele, desde o planejamento',
  :JOANA,
  $$select titulo from public.calendar_events where tipo = 'campanha'$$,
  'Wave Verde'
);

select teste.conferir_como(
  'Cliente da Óptica ve a campanha DELE, e nao a do Verde',
  :OTTO,
  $$select titulo from public.calendar_events where tipo = 'campanha'$$,
  'Wave Óptica'
);


-- ---------------------------------------------------------------------------
-- 2. O RASCUNHO NAO VAZA, NEM PARA QUEM O CRIOU
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Rascunho nao entra no calendario nem para quem o criou',
  :ANA,
  $$select count(*)::text from public.calendar_events
     where titulo = 'Ideia solta que ainda nao existe'$$,
  '0'
);

select teste.conferir_como(
  'Etapa de rascunho tambem nao entra',
  :ANA,
  $$select count(*)::text from public.calendar_events
     where titulo = 'Etapa de um rascunho'$$,
  '0'
);


-- ---------------------------------------------------------------------------
-- 3. SO AS FOLHAS
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'A etapa FILHA entra no calendario',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'KV'$$,
  '1'
);

select teste.conferir_como(
  'A AGRUPADORA nao entra, mesmo tendo prazo',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'Arte'$$,
  '0'
);


-- ---------------------------------------------------------------------------
-- 4. SO AUSENCIA COMBINADA
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Ausencia aprovada entra',
  :ANA,
  $$select count(*)::text from public.calendar_events
     where tipo = 'ausencia' and user_id = '44444444-4444-4444-4444-444444444444'$$,
  '1'
);

select teste.conferir_como(
  'Pedido PENDENTE nao entra -- ele ainda pode ser remarcado',
  :ANA,
  $$select count(*)::text from public.calendar_events
     where tipo = 'ausencia' and user_id = '66666666-6666-6666-6666-666666666666'$$,
  '0'
);


-- ---------------------------------------------------------------------------
-- 5. QUEM ABRE EVENTO
-- ---------------------------------------------------------------------------
select teste.cenario(
  'Atendimento abre evento',
  :CARLA,
  $$insert into public.events (id, nome, tipo, data_inicio, data_fim, criado_por)
    values ('c0000000-0000-0000-0000-00000000e001', 'Convenção da agência', 'convencao',
            current_date + 8, current_date + 10, '33333333-3333-3333-3333-333333333333')$$,
  'ok', 1
);

select teste.cenario(
  'Gestão abre evento',
  :DIEGO,
  $$insert into public.events (id, nome, tipo, client_id, data_inicio, data_fim, bloqueia_ferias, criado_por)
    values ('c0000000-0000-0000-0000-00000000e002', 'Feira do Mundo Verde', 'feira',
            'aaaaaaaa-0000-0000-0000-000000000001',
            current_date + 12, current_date + 14, true, '22222222-2222-2222-2222-222222222222')$$,
  'ok', 1
);

-- BRUNO E DESIGN, nao Atendimento: ele le o calendario e nao escreve nele.
select teste.cenario(
  'Colaborador fora do Atendimento NAO abre evento',
  :BRUNO,
  $$insert into public.events (nome, tipo, data_inicio, data_fim, criado_por)
    values ('Evento que não deve nascer', 'outro', current_date, current_date,
            '44444444-4444-4444-4444-444444444444')$$,
  'recusa'
);

select teste.cenario(
  'Colaborador fora do Atendimento NAO apaga evento',
  :BRUNO,
  $$delete from public.events where id = 'c0000000-0000-0000-0000-00000000e001'$$,
  'recusa'
);

select teste.cenario(
  'Colaborador fora do Atendimento NAO edita evento',
  :BRUNO,
  $$update public.events set nome = 'Renomeado por quem não pode'
     where id = 'c0000000-0000-0000-0000-00000000e001'$$,
  'recusa'
);

-- NINGUEM ABRE EVENTO NO NOME DE OUTRA PESSOA: `criado_por = auth.uid()` no
-- with check. Sem essa linha, um PATCH montado a mao assinaria a convencao
-- com o nome do socio.
select teste.cenario(
  'Atendimento NAO abre evento assinado por outra pessoa',
  :CARLA,
  $$insert into public.events (nome, tipo, data_inicio, data_fim, criado_por)
    values ('Assinado pela Ana sem ela saber', 'outro', current_date, current_date,
            '11111111-1111-1111-1111-111111111111')$$,
  'recusa'
);

-- O CLIENTE NAO ALCANCA EVENTO, nem o da propria empresa: o Portal mostra
-- material enviado, nao a agenda interna.
select teste.conferir_como(
  'Cliente nao ve evento nenhum, nem o da propria empresa',
  :JOANA,
  $$select count(*)::text from public.calendar_events where tipo = 'evento'$$,
  '0'
);

select teste.conferir_como(
  'A equipe ve os dois eventos',
  :BRUNO,
  $$select count(*)::text from public.calendar_events where tipo = 'evento'$$,
  '2'
);


-- ---------------------------------------------------------------------------
-- 6. A LISTA DE PARTICIPANTES E DE QUEM ORGANIZA
--
-- Sem esta trava, quem nao quer ir se tira da convencao apagando a propria
-- linha -- e o evento passa a valer so para os que sobraram, sem ninguem
-- saber.
-- ---------------------------------------------------------------------------
select teste.cenario(
  'Atendimento poe participante',
  :CARLA,
  $$insert into public.event_participants (event_id, user_id)
    values ('c0000000-0000-0000-0000-00000000e002', '44444444-4444-4444-4444-444444444444')$$,
  'ok', 1
);

select teste.cenario(
  'Participante NAO se tira do evento',
  :BRUNO,
  $$delete from public.event_participants
     where event_id = 'c0000000-0000-0000-0000-00000000e002'
       and user_id = '44444444-4444-4444-4444-444444444444'$$,
  'recusa'
);


-- ---------------------------------------------------------------------------
-- 7. O EVENTO QUE BLOQUEIA PERIODO
--
-- Os DOIS sentidos. "Sem participantes" lido como "ninguem" e o erro natural,
-- e ele deixa a convencao da agencia sem bloquear nada -- exatamente o caso
-- que a regra existe para cobrir.
-- ---------------------------------------------------------------------------

-- A feira tem participante (Bruno), e bloqueia. Sao 3 dias: 12, 13 e 14.
select teste.conferir_como(
  'Evento com participante bloqueia os dias DELE',
  :BRUNO,
  $$select count(*)::text from public.eventos_que_bloqueiam(
      '44444444-4444-4444-4444-444444444444', current_date, current_date + 30)$$,
  '3'
);

select teste.conferir_como(
  'E NAO bloqueia quem nao vai',
  :RAFAEL,
  $$select count(*)::text from public.eventos_que_bloqueiam(
      '66666666-6666-6666-6666-666666666666', current_date, current_date + 30)$$,
  '0'
);

-- Agora a convencao, que nao tem participante nenhum, passa a bloquear.
update public.events set bloqueia_ferias = true
 where id = 'c0000000-0000-0000-0000-00000000e001';

select teste.conferir_como(
  'Evento SEM participante bloqueia todo mundo',
  :RAFAEL,
  $$select count(*)::text from public.eventos_que_bloqueiam(
      '66666666-6666-6666-6666-666666666666', current_date, current_date + 30)$$,
  '3'
);

select teste.conferir_como(
  'A recusa diz o NOME do evento, e nao só "bloqueado"',
  :RAFAEL,
  $$select distinct nome from public.eventos_que_bloqueiam(
      '66666666-6666-6666-6666-666666666666', current_date, current_date + 30)$$,
  'Convenção da agência'
);

-- A JANELA CORTA: perguntando por um intervalo que pega um dia só do evento,
-- volta um dia só. Sem o `greatest`/`least`, a funcao devolveria os tres e a
-- tela pintaria dias fora do mes que ela desenha.
select teste.conferir_como(
  'A janela corta o evento nas bordas',
  :RAFAEL,
  $$select count(*)::text from public.eventos_que_bloqueiam(
      '66666666-6666-6666-6666-666666666666', current_date + 9, current_date + 9)$$,
  '1'
);


-- ---------------------------------------------------------------------------
-- 8. O PERIODO INVERTIDO E RECUSADO
-- ---------------------------------------------------------------------------
select teste.cenario(
  'Evento que acaba antes de comecar e recusado',
  :CARLA,
  $$insert into public.events (nome, tipo, data_inicio, data_fim, criado_por)
    values ('Volta no tempo', 'outro', current_date + 5, current_date,
            '33333333-3333-3333-3333-333333333333')$$,
  'recusa'
);

select teste.cenario(
  'Evento com hora de fim antes da de inicio e recusado',
  :CARLA,
  $$insert into public.events (nome, tipo, data_inicio, data_fim, dia_inteiro, hora_inicio, hora_fim, criado_por)
    values ('Reunião ao contrário', 'reuniao', current_date, current_date, false,
            '18:00', '09:00', '33333333-3333-3333-3333-333333333333')$$,
  'recusa'
);


-- ---------------------------------------------------------------------------
-- 9. A CAPACIDADE DA PESSOA
-- ---------------------------------------------------------------------------
select teste.conferir(
  'Capacidade nasce em 480 minutos (8h)',
  (select capacidade_minutos_dia::text from public.team_members
    where user_id = '44444444-4444-4444-4444-444444444444'),
  '480'
);

select teste.cenario(
  'Capacidade de zero e recusada -- dividir por ela quebraria a barra',
  :ANA,
  $$update public.team_members set capacidade_minutos_dia = 0
     where user_id = '44444444-4444-4444-4444-444444444444'$$,
  'recusa'
);
