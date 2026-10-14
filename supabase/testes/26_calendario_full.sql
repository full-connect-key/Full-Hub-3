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
-- 0055/0077 -- O CALENDARIO FULL: A VIEW QUE PODIA VAZAR TUDO, E OS EVENTOS
--
-- O que estes cenarios guardam, e que nenhuma tela mostraria:
--
--   1. `security_invoker = true` NA VIEW. Sem essa clausula a view roda com
--      os direitos de quem a criou -- o superusuario da migration -- e passa
--      a ler as tabelas de origem INTEIRAS, para qualquer pessoa
--      autenticada. O cliente de uma empresa veria a agenda da agencia com o
--      nome das demandas de todos os outros clientes.
--
--      **E o furo passa despercebido num banco com um cliente so**: ele ve
--      seis campanhas, que e o total, e "seis de seis" tem a mesma cara com a
--      RLS ligada e desligada. Por isso os cenarios abaixo criam material da
--      OPTICA e conferem que a JOANA, que e do Mundo Verde, nao o alcanca. E
--      esse o cenario que falha se alguem tirar o `security_invoker`.
--
--   2. A VIEW TEM UMA ORIGEM SO, E ELA E O EVENTO (0105), por decisao do
--      usuario: *"ele deve ser apenas para eventos que serao lancados nele,
--      nada de outros abas"*. A demanda e a etapa ja tinham saido na 0077, a
--      etapa de post na 0088; esta migration tirou as CINCO que sobravam --
--      ausencia, post, fase do mes de social, campanha e entregavel.
--
--      AS FIXTURES DAS SETE CONTINUAM TODAS AQUI -- demanda publicada,
--      rascunho, mae e filha com prazo, as duas campanhas, os dois posts
--      enviados e as duas ausencias --, e os cenarios que mediam cada uma
--      foram VIRADOS DO AVESSO: hoje conferem que NENHUMA atravessa a view,
--      nem para o socio. Devolvendo qualquer `union all`, um deles falha e
--      diz qual.
--
--      **E tres deles medem o TEXTO da view**, e nao a contagem: um banco sem
--      campanha nenhuma passaria por todos os outros com as origens de pe. O
--      terceiro e a metade POSITIVA -- a view TEM de ler `events` --, sem a
--      qual os outros dois passariam numa view que perdeu a ultima origem
--      tambem.
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
\set CAMP_VERDE   '''c0000000-0000-0000-0000-00000000d001'''
\set CAMP_OPTICA  '''c0000000-0000-0000-0000-00000000d002'''
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

insert into public.campaigns (id, client_id, nome, data_inicio, data_fim, status, criado_por)
values
  (:CAMP_VERDE,  :VERDE,  'Wave Verde',  current_date, current_date + 20, 'ativa', :ANA),
  (:CAMP_OPTICA, :OPTICA, 'Wave Óptica', current_date, current_date + 20, 'ativa', :ANA);

-- UMA PECA COM PRAZO, que e a origem `entregavel` da 0055.
--
-- ELA FALTAVA, e a falta so apareceu no teste de mutacao: o arquivo apagava
-- `deliverables` no inicio e nunca inseria nenhuma, entao o cenario "a peca de
-- campanha nao atravessa a view" contava zero de nada -- ele passava com a
-- origem ligada E desligada. E a licao do `select` antes do `insert` na
-- idempotencia da recorrencia: um teste que nao separa a resposta certa da
-- errada e um teste que afirma sem provar.
insert into public.deliverables (campaign_id, nome, prazo, responsavel_id, ordem)
values (:CAMP_OPTICA, 'Lâmina A5', current_date + 7, :CARLA, 1);

-- Um post ENVIADO de cada empresa: o cliente enxerga post enviado, e so o da
-- empresa dele.
insert into public.posts (client_id, tema, data_publicacao, plataformas, status, criado_por, enviado_em)
values
  (:VERDE,  'Post do Verde',  current_date + 1, '{instagram}', 'em_aprovacao', :ANA, now()),
  (:OPTICA, 'Post da Óptica', current_date + 1, '{instagram}', 'em_aprovacao', :ANA, now());

-- Duas ausencias: uma combinada e uma esperando resposta.
insert into public.hr_requests (user_id, tipo, data_inicio, data_fim, dias_uteis, status)
values
  (:BRUNO,  'ferias',   current_date + 2, current_date + 6, 5, 'aprovada'),
  (:RAFAEL, 'ausencia', current_date + 3, current_date + 3, 1, 'pendente');

-- UM EVENTO DA OPTICA, E ELE E A SONDA DO `security_invoker` DEPOIS DA 0105.
--
-- Ate aqui quem media isso era a CAMPANHA da Optica: o cliente do Verde
-- contava zero linhas dela, e sem a clausula a view leria `campaigns` inteira
-- e ele contaria uma. Com a campanha fora da view, aquele cenario passaria a
-- contar zero de nada -- o teste que nao separa a resposta certa da errada.
--
-- Os dois eventos da secao 5 nao servem para isto: eles nascem la embaixo, e
-- os cenarios do cliente sao os primeiros do arquivo -- a view devolveria
-- lista vazia para todo mundo e eles passariam sem medir nada. Este nasce
-- aqui, como `postgres`, de proposito: montar o cenario nao e o que se
-- verifica.
insert into public.events (id, nome, tipo, client_id, data_inicio, data_fim, criado_por)
values ('c0000000-0000-0000-0000-00000000e003', 'Feira da Óptica', 'feira',
        :OPTICA, current_date + 16, current_date + 17, :ANA);


-- ---------------------------------------------------------------------------
-- 1. O CLIENTE NAO ATRAVESSA A VIEW
--
-- E O CENARIO QUE FALHA SE O `security_invoker` SAIR. Ele nao pergunta
-- "quantas linhas a Joana ve", pergunta "ela alcanca alguma coisa da OPTICA" --
-- que e zero com a RLS valendo e diferente de zero sem ela.
--
-- A SONDA MUDOU NA 0105, e a razao e que a antiga deixou de medir o que diz.
-- Ela contava pelo `client_id` da Optica, e quem punha linha la era a CAMPANHA
-- e o POST daquela empresa -- as duas origens sairam. Hoje quem a povoa e o
-- evento da Optica, que nasce na fixture exatamente para isto: `events_select`
-- e `is_staff()`, entao o cliente conta zero com a clausula e UM sem ela.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Cliente nao alcanca NADA da outra empresa pela view',
  :JOANA,
  $$select count(*)::text from public.calendar_events where client_id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '0'
);

-- E NEM O EVENTO DA PROPRIA EMPRESA, que e a metade que a 0105 deixou sendo a
-- unica: o Portal mostra material enviado, nao a agenda interna da agencia. Sem
-- o `security_invoker` esta conta tambem sobe, porque a view leria `events`
-- inteira.
select teste.conferir_como(
  'Cliente nao ve evento nenhum, nem o da propria empresa',
  :JOANA,
  $$select count(*)::text from public.calendar_events where tipo = 'evento'$$,
  '0'
);

-- E A EQUIPE VE, que e a metade positiva: so os zeros de cima passariam numa
-- view devolvendo lista vazia para todo mundo -- inclusive quebrada.
select teste.conferir_como(
  'E a equipe ve o evento da Óptica',
  :BRUNO,
  $$select titulo from public.calendar_events where tipo = 'evento'$$,
  'Feira da Óptica'
);


-- ---------------------------------------------------------------------------
-- 2. AS SETE ORIGENS QUE SAIRAM, E A UNICA QUE FICOU
--
-- A `calendar_events` nasceu na 0055 juntando OITO. A demanda e a etapa
-- sairam na 0077 (*"quero que elas fiquem apenas dentro do Minhas Tasks"*), a
-- etapa de post na 0088 (*"a corrente do social vive so em minhas tasks e na
-- carga"*), e a 0105 tirou as cinco que sobravam -- por decisao do usuario:
-- *"ele deve ser apenas para eventos que serao lancados nele, nada de outros
-- abas"*.
--
-- SAO OS CENARIOS DA 0055 E DA 0090 VIRADOS DO AVESSO. Ate aqui esta parte
-- media os filtros de cada origem -- "o rascunho nao vaza nem para quem o
-- criou", "so as folhas", "o cliente ve o post ENVIADO da empresa dele", "a
-- campanha continua entrando". AS FIXTURES CONTINUAM TODAS DE PE, e o que se
-- confere e que nenhuma delas atravessa a view. Devolvendo qualquer um dos
-- `union all`, um destes falha e diz qual.
--
-- E A PERGUNTA E FEITA PARA A ANA, QUE E SOCIA: medir isto pelo cliente nao
-- mediria nada, porque a RLS ja o barrava antes em metade das origens. O que
-- mudou foi para quem ve tudo.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'A camada de demanda nao existe mais, nem para o socio',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'task'$$,
  '0'
);

select teste.conferir_como(
  'A camada de etapa nao existe mais, nem para o socio',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'subtarefa'$$,
  '0'
);

-- PELO TITULO, e nao so pelo `tipo`: uma origem devolvida com outro rotulo
-- passaria pelos dois cenarios de cima.
select teste.conferir_como(
  'A demanda publicada nao aparece pelo titulo',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'Wave do Mundo Verde'$$,
  '0'
);

select teste.conferir_como(
  'A etapa folha, que ENTRAVA, tambem nao aparece mais',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'KV'$$,
  '0'
);

-- AS CINCO DA 0105, uma por `tipo`. As fixtures de cada uma estao montadas
-- acima -- dois posts enviados, duas campanhas, duas ausencias --, entao o
-- zero aqui e resposta e nao ausencia de material.
select teste.conferir_como(
  'O POST nao atravessa mais a view, nem para o socio',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'post'$$,
  '0'
);

select teste.conferir_como(
  'A CAMPANHA nao atravessa mais, e eram duas',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'campanha'$$,
  '0'
);

select teste.conferir_como(
  'Nem a PECA de campanha, e ha uma com prazo na fixture',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'entregavel'$$,
  '0'
);

select teste.conferir_como(
  'E ela nao aparece pelo nome',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'Lâmina A5'$$,
  '0'
);

select teste.conferir_como(
  'Nem a FASE do mes de social',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'fase_de_social'$$,
  '0'
);

-- PELO TITULO TAMBEM, pela razao de cima: uma origem devolvida com outro
-- rotulo de `tipo` passaria pelos quatro de cima.
select teste.conferir_como(
  'E o post nao aparece pelo tema',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'Post do Verde'$$,
  '0'
);

select teste.conferir_como(
  'E a campanha nao aparece pelo nome',
  :ANA,
  $$select count(*)::text from public.calendar_events where titulo = 'Wave Verde'$$,
  '0'
);

-- E O TEXTO DA VIEW, que e a sonda que a contagem nao sabe fazer. E a mesma
-- forma do `sem_na_view` do `onde-esta-o-banco.sql`: os cenarios de cima
-- contam linhas, e um banco sem campanha nenhuma passaria por todos eles com
-- as origens de pe.
--
-- `pg_get_viewdef` DEVOLVE O TEXTO DEPARSADO, sem o prefixo de schema -- `from
-- events e`, e nao `from public.events e`. Por isso as sondas procuram o nome
-- NU: `like '%public.posts%'` responderia "a origem saiu" numa view que a le.
select teste.conferir(
  'A definicao da view nao cita mais a rota de Gestao de Tasks',
  (select (pg_get_viewdef('public.calendar_events'::regclass) like '%gestao-tasks%')::text),
  'false'
);

select teste.conferir(
  'Nem a fase do mes de social (`social_papel`)',
  (select (pg_get_viewdef('public.calendar_events'::regclass) like '%social_papel%')::text),
  'false'
);

select teste.conferir(
  'Nem as tabelas das outras quatro origens',
  (select (pg_get_viewdef('public.calendar_events'::regclass) like any (array[
      '%hr_requests%', '%posts%', '%campaigns%', '%deliverables%']))::text),
  'false'
);

-- E A METADE POSITIVA, sem a qual as tres de cima passariam numa view que
-- perdeu a ULTIMA origem tambem -- e aí o calendario ficaria vazio para todo
-- mundo, sem erro em lugar nenhum.
select teste.conferir(
  'E a view le `events`, que e a origem que ficou',
  (select (pg_get_viewdef('public.calendar_events'::regclass) like '%events e%')::text),
  'true'
);

-- `security_invoker` FOI REPETIDA PELA SEXTA VEZ -- 0055, 0059, 0077, 0088,
-- 0090 e 0105 --, porque `create or replace view` NAO herda a clausula.
select teste.conferir(
  'E a view continua com security_invoker depois do replace',
  (select (array_to_string(reloptions, ',') like '%security_invoker=true%')::text
     from pg_class where relname = 'calendar_events'),
  'true'
);


-- ---------------------------------------------------------------------------
-- 4. A AUSENCIA SAIU TAMBEM (0105), E `user_id` FICOU SEM NINGUEM
--
-- ESTA SECAO ESTA VIRADA DO AVESSO, e ela media duas coisas: que a ausencia
-- APROVADA entrava e que o pedido PENDENTE nao entrava -- aquele ainda pode
-- ser remarcado, e pintar a agenda com um periodo que o socio nem respondeu
-- faria a equipe planejar em cima do que talvez nao aconteca.
--
-- A SEGUNDA REGRA NAO SE PERDE: ela continua inteira no Full Days, que e onde
-- a ausencia e lancada e lida -- a matriz pinta so o periodo combinado, e o
-- arquivo 05 e quem mede isso. O que saiu desta tela foi a camada.
--
-- AS DUAS FIXTURES CONTINUAM ACIMA, uma aprovada e uma pendente: devolvendo o
-- `union all` da ausencia, o primeiro cenario acha 1 onde espera 0.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'A ausencia aprovada, que ENTRAVA, nao atravessa mais',
  :ANA,
  $$select count(*)::text from public.calendar_events where tipo = 'ausencia'$$,
  '0'
);

-- E `user_id` FICOU SEM NINGUEM QUE A ESCREVA. `create or replace view` nao
-- deixa tirar coluna -- so acrescentar no fim --, entao ela fica nula como
-- `prioridade` ficou desde a 0077.
--
-- E O CENARIO EXISTE PORQUE A TELA DEPENDIA DELA: o filtro "Filtrar por
-- responsavel" perguntava por `user_id` e passaria a devolver ZERO sempre, e o
-- chip "So minha pauta" -- que deixa passar o que tem o meu nome mais o que e
-- da agencia -- passaria a deixar passar tudo. Os dois sairam no mesmo commit,
-- e este cenario e o que diz por que.
select teste.conferir_como(
  'E nenhuma linha da view tem responsavel',
  :ANA,
  $$select count(*)::text from public.calendar_events where user_id is not null$$,
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

-- O CLIENTE NAO ALCANCA EVENTO NENHUM, e o cenario subiu para a secao 1: com
-- a 0105 ele passou a ser a sonda do `security_invoker`, e lá ele tem o evento
-- da Optica da fixture para medir.

-- TRES E NAO DOIS: os dois que a Carla e o Diego acabaram de abrir, mais a
-- Feira da Optica que nasce na fixture para ser a sonda do `security_invoker`.
select teste.conferir_como(
  'A equipe ve os tres eventos',
  :BRUNO,
  $$select count(*)::text from public.calendar_events where tipo = 'evento'$$,
  '3'
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
-- 540 E O EXPEDIENTE DE NOVE HORAS, decisao do usuario na 0081. A ficha nasce
-- em 480 pelo `add column ... default 480` da 0055 -- que e o estado em que
-- producao estava --, e a 0081 leva para 540 as linhas que ainda carregam o
-- default herdado. Quem escolheu outro numero fica, porque a coluna e por
-- pessoa: meio periodo existe.
select teste.conferir(
  'Capacidade nasce no expediente de nove horas (540)',
  (select capacidade_minutos_dia::text from public.team_members
    where user_id = '44444444-4444-4444-4444-444444444444'),
  '540'
);

select teste.cenario(
  'Capacidade de zero e recusada -- dividir por ela quebraria a barra',
  :ANA,
  $$update public.team_members set capacidade_minutos_dia = 0
     where user_id = '44444444-4444-4444-4444-444444444444'$$,
  'recusa'
);
