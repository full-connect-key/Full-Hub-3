\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set FLUXOCASA  '''f1000000-0000-4000-8000-000000000001'''
\set FLUXOPAUTA '''50870000-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 39 - O CLIENTE APROVA A CORRENTE ETAPA POR ETAPA (0076, 0087 e 0088)
--
-- Decisao do usuario: *"preciso poder escolher, se as etapas vao ser aprovadas
-- pelo cliente, uma por uma. Algumas contas aprovam pauta, antes de entrar em
-- producao."*
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o cliente aprova a Pauta e o
-- post NAO fica aprovado". Ele atravessa a unica coisa que a 0076 podia
-- quebrar de forma cara: `decidir_rodada_do_cliente` escreve
-- `status = 'aprovado'` no post a cada decisao positiva, e com os portoes do
-- meio isso passaria a dizer que a peca inteira esta fechada -- no calendario
-- do cliente, na grade do feed e na leitura da agencia -- quando o que ele
-- aprovou foi um paragrafo de texto e a arte nem existe.
--
-- ---------------------------------------------------------------------------
-- O QUE A 0088 MUDOU AQUI, e e onde o arquivo quase passou mentindo
--
-- O portao era a etapa daquele POST, e virou a etapa do MES mais a contagem de
-- rodadas aprovadas DAQUELE post. A conta e `(k+1)-esimo portao`, e ela tem
-- uma pegadinha de indice que a bateria encontrou:
-- `decidir_rodada_do_cliente` grava a rodada como `aprovada` ANTES de escrever
-- o status do post, entao quando o gatilho roda `k` JA inclui a decisao que o
-- disparou -- e `porta_do_cliente_no_post()` devolve o portao SEGUINTE. Sem
-- separar as duas posicoes, o ramo do `aprovado` olhava o Envio, concluia que
-- o portao era a entrega, e o post ficava `aprovado` por causa de uma pauta.
-- Exatamente a mentira que este arquivo existe para impedir, de volta por
-- outro caminho.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.post_versions;
delete from public.posts;

-- UMA DEMANDA COMUM, com uma etapa comum: e o CONTROLE da secao 3. Sem ela o
-- cenario *"fora do social as tres colunas ficam vazias"* alcanca zero linhas,
-- e um `update` que nao acha nada nao estoura -- ele passa. Foi a bateria que
-- mostrou: `teste.limpar()` tira toda subtarefa, e este arquivo so cria etapas
-- de mes.
insert into public.tasks (id, client_id, titulo, link_entrega, criado_por)
values ('cccccccc-0076-0000-0000-000000000001', :VERDE,
        'Demanda comum, para comparar', 'https://exemplo.com/pasta', :ANA)
on conflict (id) do nothing;

insert into public.subtasks (id, task_id, titulo, ordem)
values ('dddddddd-0076-0000-0000-000000000001',
        'cccccccc-0076-0000-0000-000000000001', 'Etapa comum', 10)
on conflict (id) do nothing;


-- --- 1. Sem portao do meio, a corrente e a de sempre -----------------------
--
-- E o lado seguro do erro: esquecer o fluxo novo deixa o produto como ele
-- estava, com um portao so. O contrario -- todo post nascendo com cinco
-- portoes -- poria o cliente decidindo cinco vezes sobre uma peca.

select teste.cenario('A gestao abre marco com o fluxo da casa', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-03', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb,
    %L, jsonb_build_object('Design', %L::text),
    '{}'::jsonb, 'https://drive.google.com/drive/folders/MARCO', %L)$fmt$,
    :VERDE, :BRUNO, :BRUNO, :FLUXOCASA), 'ok', 1);

select set_config('t39.marco',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-03-01'),
  false);
select set_config('t39.sem',
  (select id::text from public.posts_do_mes(current_setting('t39.marco')::uuid)
    order by tema limit 1), false);

select teste.conferir('Sem portao do meio, nenhuma etapa tem a marca',
  (select count(*)::text from public.etapas_do_mes(current_setting('t39.marco')::uuid)
    where social_portao), '0');

-- E A PORTA CONTINUA SENDO O ENVIO. E esta linha que prova que o fluxo novo
-- nao mudou o comportamento de quem nao pediu nada.
select teste.conferir('E a porta do cliente e o Envio, que e a entrega',
  (public.porta_do_cliente_no_post(current_setting('t39.sem')::uuid)).titulo, 'Envio');

select teste.conferir('Com um portao so no mes',
  (select count(*)::text from public.portoes_do_mes(current_setting('t39.marco')::uuid)), '1');


-- --- 2. A conta combina que aprova a pauta ---------------------------------

-- O FLUXO E UMA COPIA DO DA CASA com a Pauta marcada, e e assim que a tela do
-- editor o monta: parte do padrao e liga o portao que a conta combinou.
select public.salvar_fluxo_de_social(
  'Fluxo que aprova a pauta',
  jsonb_build_array(
    jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                       'campo','pauta','aprovacao_cliente',true),
    jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                       'campo','legenda'),
    jsonb_build_object('nome','Layout','funcao','Design','papel','producao'),
    jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega'),
    jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
  ),
  :FLUXOPAUTA);

-- E ELE AVANCA EM PARALELO (0090), e esta linha e o que faz o arquivo medir o
-- que ele diz que mede.
--
-- Este arquivo e sobre a corrente PECA POR PECA: *"a etapa e do mes, a decisao
-- e de cada post"*. O padrao do produto desde a 0090 e o contrario -- o mes
-- anda junto, e um portao so vence quando toda peca passou por ele --, e com
-- ele ligado a trava do MES recusa antes da trava da PECA. Os cenarios
-- continuariam vermelhos... de verde: eles esperam uma recusa, levariam uma
-- recusa, e nenhum deles estaria medindo a regra que o arquivo existe para
-- provar.
--
-- Com o paralelismo ligado quem recusa e a trava B, que e a pergunta deste
-- arquivo. O modo PADRAO tem cenarios proprios, no arquivo 43.
update public.social_flows set avanca_em_paralelo = true where id = :FLUXOPAUTA;

insert into public.client_flow_defaults (client_id, social_flow_id)
values (:VERDE, :FLUXOPAUTA)
on conflict (client_id) do update set social_flow_id = :FLUXOPAUTA;

-- A CONTA APONTA PARA O FLUXO, E O MES NASCE COM ELE -- sem `p_flow_id`, que e
-- a ordem mes -> conta -> casa de `fluxo_do_mes()` (0087).
select teste.cenario('A gestao abre abril, e a conta decide o fluxo', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-04', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb,
    %L, jsonb_build_object('Social Media', %L::text, 'Redator', %L::text, 'Design', %L::text),
    '{}'::jsonb, 'https://drive.google.com/drive/folders/ABRIL')$fmt$,
    :VERDE, :BRUNO, :MARINA, :CARLA, :BRUNO), 'ok', 1);

select set_config('t39.abril',
  (select id::text from public.tasks where client_id = :VERDE and social_do_mes = '2027-04-01'),
  false);
select set_config('t39.post',
  (select id::text from public.posts_do_mes(current_setting('t39.abril')::uuid)
    order by tema limit 1), false);
select set_config('t39.pauta',
  (select id::text from public.etapas_do_mes(current_setting('t39.abril')::uuid)
    where titulo = 'Pauta'), false);
select set_config('t39.conteudo',
  (select id::text from public.etapas_do_mes(current_setting('t39.abril')::uuid)
    where titulo = 'Conteúdo'), false);
select set_config('t39.layout',
  (select id::text from public.etapas_do_mes(current_setting('t39.abril')::uuid)
    where titulo = 'Layout'), false);
select set_config('t39.envio',
  (select id::text from public.etapas_do_mes(current_setting('t39.abril')::uuid)
    where titulo = 'Envio'), false);
select set_config('t39.programar',
  (select id::text from public.etapas_do_mes(current_setting('t39.abril')::uuid)
    where titulo = 'Programar'), false);

select teste.conferir('A Pauta nasceu como portao do cliente',
  (select social_portao::text from public.subtasks where id = current_setting('t39.pauta')::uuid),
  'true');

select teste.conferir('E so ela',
  (select string_agg(titulo, ', ' order by ordem)
     from public.etapas_do_mes(current_setting('t39.abril')::uuid) where social_portao),
  'Pauta');

select teste.conferir('Entao o mes tem DOIS portoes, na ordem',
  (select string_agg(titulo, ' > ' order by ordem)
     from public.portoes_do_mes(current_setting('t39.abril')::uuid)), 'Pauta > Envio');

-- A PORTA PASSOU A SER A PAUTA, e e este cenario que cai se alguem fizer o
-- portao sair da etapa do mes sem contar as rodadas daquele post.
select teste.conferir('E a porta do cliente passou a ser ela',
  (public.porta_do_cliente_no_post(current_setting('t39.post')::uuid)).titulo, 'Pauta');

-- E O CAMPO DELA VIAJA COM A ETAPA, e nao com o nome (0087): renomear "Pauta"
-- fazia a tela do portal abrir o portao com a caixa de texto VAZIA.
select teste.conferir('Com o campo do card que ela enche',
  (public.porta_do_cliente_no_post(current_setting('t39.post')::uuid)).social_campo, 'pauta');


-- --- 3. O Envio e o Programar nunca viram portao ---------------------------
--
-- O primeiro JA e o portao do cliente desde a 0045, e o segundo vem depois da
-- decisao -- um portao ali esperaria o cliente aprovar que o post foi agendado.
--
-- SAO DUAS TRAVAS, NOS DOIS LADOS, e vale a distincao: o `check` do FLUXO
-- (0087) recusa montar o fluxo errado, e o `check` da ETAPA (0088) recusa
-- materializar um. Um `check` que vale num lado e nao no outro e o lugar onde
-- as duas verdades divergem.

select teste.recusa_com('A entrega do fluxo nao recebe a marca', :DIEGO,
  format($fmt$update public.social_flow_steps set aprovacao_cliente = true
     where flow_id = %L and papel = 'entrega'$fmt$, :FLUXOPAUTA),
  'social_flow_steps_portao_coerente');

select teste.recusa_com('Nem o que vem depois da decisao', :DIEGO,
  format($fmt$update public.social_flow_steps set aprovacao_cliente = true
     where flow_id = %L and papel = 'pos_entrega'$fmt$, :FLUXOPAUTA),
  'social_flow_steps_portao_coerente');

select teste.recusa_com('E a ETAPA do mes recusa o mesmo', :DIEGO,
  format($fmt$update public.subtasks set social_portao = true where id = %L$fmt$,
    current_setting('t39.envio')),
  'subtasks_social_coerente');

-- E UMA SUBTAREFA COMUM NAO CARREGA NADA DISSO. Sem esta metade do `check`,
-- uma etapa de demanda com `social_campo` preenchido entraria em
-- `etapas_do_mes()` de um mes qualquer e abriria um portao que ninguem
-- configurou.
-- `update ... limit` NAO EXISTE NO POSTGRES, e foi a bateria que me lembrou:
-- a primeira versao deste cenario recusava com *"syntax error at or near
-- limit"* e passava, porque `recusa_com` so exige que o trecho apareca -- e o
-- trecho nao aparecia. A recusa pelo motivo errado esta quebrada e passaria
-- assim mesmo se o trecho fosse generico.
select teste.recusa_com('E fora do social as tres colunas ficam vazias', :DIEGO,
  $fmt$update public.subtasks set social_campo = 'pauta'
     where id = 'dddddddd-0076-0000-0000-000000000001'$fmt$,
  'subtasks_social_coerente');


-- --- 4. A ETAPA DO PORTAO SE CONCLUI, E QUEM TRAVA E A CAIXINHA ------------
--
-- ISTO ESTA VIRADO DO AVESSO, e a inversao e o 3J. Na 0076 a etapa do portao
-- recusava `concluida` e `enviada_aprovacao` pela mao de quem a fazia -- os
-- dois afirmavam uma decisao do cliente que nao aconteceu.
--
-- A etapa agora e do MES: ela cobre doze posts, e concluir a Pauta quer dizer
-- *"escrevi as doze"* -- que e trabalho, e quem o faz afirma. O que o cliente
-- decide e CADA post, e a trava desceu para a caixinha: marcar o Conteudo de um
-- post cuja pauta ele nao aprovou e recusado.
--
-- A trava A sozinha nao pegaria isso, e e o ponto: a caixinha do portao marca
-- que a PESSOA escreveu a pauta, nao que o cliente a aprovou.

select teste.cenario('A Marina comeca a Pauta do mes', :MARINA,
  format($fmt$update public.subtasks set status = 'em_andamento' where id = %L$fmt$,
    current_setting('t39.pauta')), 'ok', 1);

select teste.cenario('E marca a caixinha de um post', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.pauta')), 'ok', 1);

select teste.recusa_com_dica('Mas o Conteudo daquele post espera o cliente', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.conteudo')),
  'a decisão é de cada post');

select teste.recusa_com('E a recusa nomeia o portao que falta', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.conteudo')),
  'ainda não aprovou Pauta');

-- E NEM A SOCIA PASSA. A trava e sobre o fato -- a rodada aprovada daquele
-- post --, e nao sobre o perfil de quem clica.
select teste.recusa_com('Nem a socia marca por cima do portao', :ANA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.conteudo')),
  'ainda não aprovou Pauta');

-- E O COLABORADOR NAO DECIDE SE A ETAPA DELE PASSA PELO CLIENTE. Isso e
-- combinado com a conta, e mora no FLUXO -- `social_flow_steps_write` e
-- `is_gestor()` desde a 0087.
-- ZERO LINHAS E NAO EXCECAO, e a diferenca importa: quem recusa aqui e a
-- policy de `social_flow_steps` (0087), que e `is_gestor()` na escrita -- e um
-- `update` barrado pela policy nao estoura, ele nao acha a linha. A action
-- traduz "nao voltou linha" em recusa justamente para a tela nao dizer
-- "salvo" a toa.
select teste.cenario('E nao desliga o portao no fluxo', :MARINA,
  format($fmt$update public.social_flow_steps set aprovacao_cliente = false
     where flow_id = %L and nome = 'Pauta'$fmt$, :FLUXOPAUTA),
  'ok', 0);


-- --- 5. O portao do meio sai SEM data de publicacao ------------------------
--
-- A trava da 0044 -- "post sem data nao vai ao cliente" -- e sobre a ARTE: o
-- cliente decidiria sobre a peca sem saber quando ela vai ao ar. Num portao do
-- meio nao ha arte, ha pauta, e o mes abre em branco (0044) com a Pauta sendo
-- a PRIMEIRA etapa: exigir a data ali seria uma recusa que a corrente nao tem
-- como satisfazer, e o portao ficaria fechado para sempre.

select teste.conferir('Este post continua sem data',
  (select coalesce(data_publicacao::text, 'sem data') from public.posts
    where id = current_setting('t39.post')::uuid), 'sem data');

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t39.post')::uuid, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao manda a pauta ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t39.post'), :DIEGO), 'ok', 1);

-- E O POST PASSOU A EXISTIR PARA O CLIENTE. `enviado_em` e consequencia da
-- rodada de escopo cliente desde a 0032, e e ele que `posts_select_cliente` le
-- -- entao o primeiro portao ja abre o post para ele, que e exatamente o que
-- precisa acontecer para ele LER a pauta.
select teste.cenario('E a Joana ja enxerga o post', :JOANA,
  format($fmt$select 1 from public.posts where id = %L$fmt$, current_setting('t39.post')),
  'ok', 1);

-- E A CAIXINHA DA ENTREGA NAO ANDOU, porque o que saiu nao foi a arte.
select teste.conferir('A caixinha da entrega continua aberta',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.post')::uuid
      and subtask_id = current_setting('t39.envio')::uuid), 'false');


-- --- 6. O CLIENTE APROVA A PAUTA, E O POST NAO FICA APROVADO --------------
--
-- O cenario que justifica o arquivo.

select teste.cenario('A Joana aprova a pauta', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode seguir.')$fmt$, current_setting('t39.post')), 'ok', 1);

-- A LINHA QUE IMPORTA. Sem ela o post ficaria 'aprovado' -- verde no
-- calendario do cliente, fechado na grade do feed, "pode programar" para a
-- agencia -- por causa de um paragrafo de texto.
select teste.conferir('O POST voltou para producao',
  (select status::text from public.posts where id = current_setting('t39.post')::uuid),
  'em_producao');

select teste.conferir('E a rodada ficou gravada como aprovada',
  (select status::text from public.approval_rounds
    where content_type = 'post' and content_id = current_setting('t39.post')::uuid
      and escopo = 'cliente' order by numero_rodada desc limit 1), 'aprovada');

-- E A CAIXINHA DA ENTREGA CONTINUA ABERTA. Este e o cenario que cai se alguem
-- juntar as duas posicoes do portao: com `porta_do_cliente_no_post()` no ramo
-- do `aprovado`, o gatilho olharia o Envio e fecharia a caixinha dele.
select teste.conferir('E a caixinha da entrega NAO fechou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.post')::uuid
      and subtask_id = current_setting('t39.envio')::uuid), 'false');

-- A CORRENTE ANDOU: o Conteudo daquele post destravou, que e o ponto do portao
-- existir.
select teste.cenario('E o redator ja marca o Conteudo daquele post', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.conteudo')), 'ok', 1);

select teste.conferir('A porta do cliente passou a ser o Envio',
  (public.porta_do_cliente_no_post(current_setting('t39.post')::uuid)).titulo, 'Envio');

-- E O OUTRO POST DO MES CONTINUA TRAVADO. A producao e mensal, a aprovacao e
-- por post -- e esta e a frase do usuario em SQL.
select teste.recusa_com('E o outro post do mes continua esperando a pauta dele', :CARLA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where subtask_id = %L and post_id <> %L$fmt$,
    current_setting('t39.conteudo'), current_setting('t39.post')),
  'ainda não aprovou Pauta');


-- --- 7. Ajustes num portao do meio ----------------------------------------
--
-- NAO NASCE ETAPA NENHUMA (0088): com a etapa sendo do MES, criar uma "Ajustes"
-- por pedido afirmaria que o mes inteiro voltou por causa de um post. O que
-- volta e a CAIXINHA daquele post, na etapa de quem fez o trabalho.
--
-- E QUEM REFAZ E O DONO DO PROPRIO PORTAO: quem escreveu a pauta reescreve a
-- pauta. Ler "o ultimo elo de producao" aqui poria o designer para reescrever
-- texto -- e esse ramo e o do Envio, que a secao 8 mede.

select set_config('t39.outro',
  (select id::text from public.posts_do_mes(current_setting('t39.abril')::uuid)
    where id <> current_setting('t39.post')::uuid limit 1), false);

select teste.cenario('A Marina escreve a pauta do segundo post', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.outro'), current_setting('t39.pauta')), 'ok', 1);

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t39.outro')::uuid, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a pauta dele', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t39.outro'), :DIEGO), 'ok', 1);

select teste.cenario('A Joana pede ajustes NA PAUTA', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'O angulo nao e o que combinamos.')$fmt$,
    current_setting('t39.outro')), 'ok', 1);

select teste.conferir('Nao nasceu etapa de Ajustes nenhuma',
  (select count(*)::text from public.subtasks
    where task_id = current_setting('t39.abril')::uuid and titulo like 'Ajustes%'), '0');

-- A CAIXINHA DA PAUTA DAQUELE POST DESMARCOU -- e nao a do Layout, que e o
-- ramo da entrega.
select teste.conferir('A caixinha da PAUTA dele desmarcou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.outro')::uuid
      and subtask_id = current_setting('t39.pauta')::uuid), 'false');

select teste.conferir('E o pedido ficou na observacao dela',
  (select observacao from public.post_etapa_progresso
    where post_id = current_setting('t39.outro')::uuid
      and subtask_id = current_setting('t39.pauta')::uuid),
  'O angulo nao e o que combinamos.');

-- E O PRIMEIRO POST NAO FOI TOCADO. A etapa e de dois posts e o pedido e de um.
select teste.conferir('E a caixinha do primeiro post continua marcada',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.post')::uuid
      and subtask_id = current_setting('t39.pauta')::uuid), 'true');

-- QUEM ESCREVEU A PAUTA RECEBE O AVISO.
select teste.conferir('E a Marina foi avisada, e nao o designer',
  (select count(*)::text from public.notifications
    where user_id = :MARINA and titulo like 'O cliente pediu ajustes%'), '1');

select teste.conferir('O Bruno nao recebeu nada deste pedido',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and titulo like 'O cliente pediu ajustes%'), '0');

-- O POST FICA EM 'ajustes', e aqui isso e verdade: ha uma coisa a refazer. A
-- correcao da secao 6 vale so para a aprovacao, que e a que afirmaria que a
-- peca inteira fechou.
select teste.conferir('E o post esta em ajustes, que e a verdade',
  (select status::text from public.posts where id = current_setting('t39.outro')::uuid),
  'ajustes');

-- E O PORTAO CONTINUA SENDO A PAUTA: rodada recusada nao conta, que e a regra
-- da 0023 -- pedir aprovacao nao e ter aprovacao.
select teste.conferir('E o portao aberto dele continua sendo a Pauta',
  (public.porta_do_cliente_no_post(current_setting('t39.outro')::uuid)).titulo, 'Pauta');


-- --- 8. No ENVIO, quem recebe o post de volta e quem fez a ARTE ------------
--
-- A regra da 0045 sobrevive inteira, e e a unica parte da etapa de Ajustes que
-- ficou. A pergunta e POSICIONAL -- o ultimo elo de producao antes da entrega
-- -- e nao pelo nome 'Layout' (0087): num fluxo que chame aquela etapa de
-- "Producao de Layout", `nome = 'Layout'` devolveria ninguem, e a caixinha de
-- ninguem desmarcaria.

select teste.cenario('O Bruno fecha o Layout do primeiro post', :BRUNO,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.layout')), 'ok', 1);

select teste.cenario('A gestao data o post', :DIEGO,
  format($fmt$update public.posts set data_publicacao = '2027-04-10' where id = %L$fmt$,
    current_setting('t39.post')), 'ok', 1);

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t39.post')::uuid, 2, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a arte', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 2, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t39.post'), :DIEGO), 'ok', 1);

select teste.cenario('A Joana pede ajustes NA ARTE', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
        and numero_rodada = 2),
    'ajustes_solicitados', 'O logo ficou pequeno.')$fmt$,
    current_setting('t39.post')), 'ok', 1);

select teste.conferir('Agora foi a caixinha do LAYOUT que desmarcou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.post')::uuid
      and subtask_id = current_setting('t39.layout')::uuid), 'false');

select teste.conferir('E a da Pauta continua marcada, porque ele a aprovou',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.post')::uuid
      and subtask_id = current_setting('t39.pauta')::uuid), 'true');

select teste.conferir('E o Bruno foi avisado desta vez',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and titulo like 'O cliente pediu ajustes%'), '1');


-- --- 8b. A RECUSA DA TRAVA B NOMEIA SO O QUE FALTA -------------------------
--
-- E O UNICO LUGAR DA BATERIA QUE PEGA ISSO, e e por isso que o cenario mora
-- aqui e nao no 21: lá o fluxo tem UM portao (o Envio), e com um a lista do
-- jeito errado e a do jeito certo dao a mesma frase. Aqui sao DOIS -- a Pauta
-- e o Envio --, e esta peca tem a Pauta aprovada: a frase precisa dizer
-- "Envio" e nunca "Pauta, Envio".
--
-- A VERSAO ERRADA NAO ESTOURA -- ela devolve uma recusa plausivel, que a
-- pessoa confere, ve que esta errada, e passa a desconfiar do resto. Foi a
-- imagem do prototipo que mostrou, nao a bateria, e e por isso que o cenario
-- entra agora. E a decisao da 0023, que nomeia CADA etapa sem aprovacao.
--
-- Medido com mutacao: tirando o `offset` da trava B, este cenario cai e diz
-- que a recusa veio com "Pauta, Envio".
select teste.conferir('A Pauta desta peca esta aprovada',
  public.aprovacoes_do_cliente_no_post(current_setting('t39.post')::uuid)::text,
  '1');

select teste.recusa_com('E a recusa do Programar nomeia so o Envio', :MARINA,
  format($fmt$update public.post_etapa_progresso set concluido = true
     where post_id = %L and subtask_id = %L$fmt$,
    current_setting('t39.post'), current_setting('t39.programar')),
  'ainda não aprovou Envio neste post');

-- O TRECHO PROCURADO ATRAVESSA O NOME, de "aprovou" a "neste post", e e isso
-- que faz ele medir: `recusa_com` busca uma substring, e "aprovou Envio neste
-- post" NAO esta dentro de "aprovou Pauta, Envio neste post". Um trecho mais
-- curto -- so "Envio" -- passaria nas duas formas e afirmaria sem provar.


-- --- 9. E no caminho de sempre o post FICA aprovado -----------------------
--
-- A correcao da secao 6 nao pode ter apagado o caminho normal: quando o portao
-- E a entrega, `aprovado` e a verdade.

select set_config('t39.semenvio',
  (select id::text from public.etapas_do_mes(current_setting('t39.marco')::uuid)
    where titulo = 'Envio'), false);
select set_config('t39.semlayout',
  (select id::text from public.etapas_do_mes(current_setting('t39.marco')::uuid)
    where titulo = 'Layout'), false);

-- UMA CAIXINHA POR VEZ, EM ORDEM, e nao um `update` com `in (...)`.
--
-- O ACHADO E DO DIA EM QUE ESTE CENARIO FALHOU SOZINHO, sem ninguem ter tocado
-- nele: a trava A de `post_etapa_progresso_regras` e POR LINHA, e o Postgres
-- nao garante a ordem em que as tres linhas de um `update` sao processadas.
-- Caindo o Layout antes do Conteudo, a trava recusa com "Neste post falta
-- Conteúdo antes desta etapa" -- que e a trava funcionando, sobre um caminho
-- que o produto nao tem: na tela a pessoa marca uma caixinha por clique.
--
-- Ele passou dezenas de rodadas por sorte, que e exatamente o que um cenario
-- nao pode fazer -- a mesma licao do `select` antes do `insert` na idempotencia
-- da recorrencia: um teste que depende da ordem das linhas afirma sem provar.
do $$
declare
  fase uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  for fase in
    select id from public.etapas_do_mes(current_setting('t39.marco')::uuid)
     where titulo in ('Pauta', 'Conteúdo', 'Layout')
     order by ordem
  loop
    update public.post_etapa_progresso set concluido = true
     where post_id = current_setting('t39.sem')::uuid
       and subtask_id = fase;
  end loop;
  reset role;
end $$;

-- POST SEM DATA NAO VAI AO CLIENTE (0044), e o mes abre em branco.
select teste.cenario('A gestao data este post', :DIEGO,
  format($fmt$update public.posts set data_publicacao = '2027-03-20' where id = %L$fmt$,
    current_setting('t39.sem')), 'ok', 1);

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', current_setting('t39.sem')::uuid, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a arte do mes sem portao do meio', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$,
    current_setting('t39.sem'), :DIEGO), 'ok', 1);

select teste.cenario('A Joana aprova a arte', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode publicar.')$fmt$, current_setting('t39.sem')), 'ok', 1);

select teste.conferir('E AGORA o post fica aprovado',
  (select status::text from public.posts where id = current_setting('t39.sem')::uuid),
  'aprovado');

select teste.conferir('Com a caixinha da entrega fechada pela aprovacao',
  (select concluido::text from public.post_etapa_progresso
    where post_id = current_setting('t39.sem')::uuid
      and subtask_id = current_setting('t39.semenvio')::uuid), 'true');


-- --- 10. O QUE O CLIENTE DECIDE, do lado dele -----------------------------
--
-- SEM ESTA FUNCAO A TELA DO PORTAL ABRE VAZIA num portao do meio: a arte nao
-- existe, e o que saiu da agencia foi um paragrafo. Ela e `security definer`
-- porque o cliente NAO tem policy em `post_etapa_progresso` (0088) e nao passa
-- a ter -- a corrente e conversa interna, e abrir a tabela entregaria de
-- lambuja quem esta com cada etapa e quem atrasou.
--
-- E E POR ISSO QUE A GUARDA DELA E ESCRITA A MAO: `security definer` nao passa
-- pela RLS de `posts`, entao sem aquelas quatro linhas a funcao responderia
-- sobre o post de qualquer empresa para quem tivesse o uuid. Os cenarios do
-- Otto sao os que caem se alguem a tirar -- e o furo passaria despercebido num
-- banco com um cliente so, que e a licao da `calendar_events`.

select teste.cenario('A gestao escreve a pauta do segundo post', :DIEGO,
  format($fmt$update public.posts
     set pauta = 'Carrossel de cinco telas, tom de conversa.' where id = %L$fmt$,
    current_setting('t39.outro')), 'ok', 1);

-- A DONA DA EMPRESA LE A PAUTA, e e a inversao declarada no cabecalho da 0076:
-- a 0046 escreveu que a pauta e conversa interna, e era verdade enquanto
-- ninguem de fora a decidia. O recorte e exatamente este -- so a etapa marcada,
-- so enquanto ela e o portao aberto, so na conta que a ligou.
select teste.cenario('A Joana descobre QUAL etapa espera ela', :JOANA,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L) where etapa = 'Pauta'$fmt$,
    current_setting('t39.outro')), 'ok', 1);

select teste.cenario('E le o texto da pauta', :JOANA,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)
    where texto = 'Carrossel de cinco telas, tom de conversa.'$fmt$,
    current_setting('t39.outro')), 'ok', 1);

-- O CLIENTE DA OUTRA EMPRESA NAO RECEBE NADA. Nem o nome da etapa: "a Pauta da
-- Mundo Verde esta esperando" ja e informacao sobre uma conta que nao e dele.
select teste.cenario('O Otto nao alcanca o portao da outra empresa', :OTTO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)$fmt$,
    current_setting('t39.outro')), 'ok', 0);

select teste.cenario('Nem lendo o texto direto', :OTTO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L) where texto is not null$fmt$,
    current_setting('t39.outro')), 'ok', 0);

-- A EQUIPE ALCANCA, e e a visualizacao administrativa de `/portal/{slug}`: a
-- mesma tela, com as mesmas frases, para a agencia conferir o que ele ve.
select teste.cenario('A agencia ve o mesmo, na visualizacao do portal', :DIEGO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L) where etapa = 'Pauta'$fmt$,
    current_setting('t39.outro')), 'ok', 1);

-- E NO CAMINHO DE SEMPRE ELA CALA. O Envio e portao de todo post desde a 0032:
-- devolve-lo aqui faria a tela anunciar uma etapa em cima de toda arte enviada
-- nos ultimos quatro sprints -- um aviso permanente, que e o que ensina a
-- ignorar aviso.
select teste.conferir('No portao do Envio ela nao devolve nada',
  (select count(*)::text from public.o_que_o_cliente_decide(
    current_setting('t39.sem')::uuid)), '0');

-- E POST AVULSO TAMBEM CALA: sem mes nao ha corrente, e ele volta a se
-- comportar como um post anterior a 0045 -- um envio, uma decisao.
insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values ('50760000-0000-0000-0000-00000000000a', :VERDE, 'Story avulso', '2027-04-20',
        '{instagram}', 'imagem', :ANA, :BRUNO);

select teste.conferir('E o post avulso nao tem portao nenhum',
  coalesce((public.porta_do_cliente_no_post(
    '50760000-0000-0000-0000-00000000000a'::uuid)).titulo, '(nenhum)'), '(nenhum)');
