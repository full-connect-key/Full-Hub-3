-- ===========================================================================
-- 42 - FLUXOS DE SOCIAL: a corrente deixa de ser fixa (migration 0087)
--
-- Decisao do usuario: *"algumas contas possuem um fluxo de aprovacao
-- diferentes (...) Algumas contas validam pauta e conteudo, antes de ir para
-- Producao de Layout. E apos o layout feito, ele tambem vai para aprovacao do
-- cliente. Preciso poder montar fluxos de Social diferentes, para serem
-- aplicados em determinados socials, de meses de determinadas contas."*
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "um fluxo que chama a entrega de
-- outro nome continua tendo portao do cliente". Ele atravessa a unica coisa
-- que esta migration podia quebrar de forma cara: ate ela, SEIS comparacoes do
-- produto perguntavam `nome = 'Envio'`, e com a cadeia editavel um fluxo que
-- chamasse aquele elo de "Entrega" ficaria sem portao nenhum -- o mes abriria,
-- os doze posts nasceriam, e "Enviar ao cliente" ficaria desligado para
-- sempre, sem erro em lugar nenhum.
--
-- E OS DOIS FLUXOS DESTE ARQUIVO SAO DE PROPOSITO, um com os nomes da casa e
-- um com nomes proprios: medindo so o da casa, todo cenario passaria com as
-- comparacoes por nome de volta no lugar -- que e a licao da `calendar_events`
-- com um cliente so.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set DIEGO  '''22222222-2222-2222-2222-222222222222'''
\set CARLA  '''33333333-3333-3333-3333-333333333333'''
\set BRUNO  '''44444444-4444-4444-4444-444444444444'''
\set MARINA '''55555555-5555-5555-5555-555555555555'''
\set JOANA  '''77777777-7777-7777-7777-777777777777'''
\set OTTO   '''88888888-8888-8888-8888-888888888888'''

\set CASA   '''f1000000-0000-4000-8000-000000000001'''

\set FCLI   '''e0870000-0000-0000-0000-0000000000c1'''
\set FTRES  '''e0870000-0000-0000-0000-0000000000f1'''
\set FNOMES '''e0870000-0000-0000-0000-0000000000f2'''

select teste.limpar();

insert into public.clients (id, nome_empresa, nome_contato, email_contato, slug, ativo)
values (:FCLI, 'Fluxo & Cia', 'Sueli', 'sueli@fluxo.com', 'fluxo-cia', true)
on conflict (id) do nothing;

insert into public.client_users (client_id, user_id)
values (:FCLI, :JOANA) on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 1. O FLUXO DA CASA NASCE NA MIGRATION
--
-- Catalogo vazio no primeiro dia faz o modulo estrear sem funcionar -- quem
-- abre o mes encontra um seletor sem opcao e conclui que a area nao esta
-- pronta. E a decisao dos workflows da 0008.
-- ---------------------------------------------------------------------------

select teste.conferir('O fluxo da casa tem as cinco etapas da 0045',
  (select string_agg(nome, ' > ' order by ordem) from public.social_flow_steps
    where flow_id = :CASA),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('E o Envio e a entrega, nao o Programar',
  (select string_agg(nome || ':' || papel, ', ' order by ordem)
     from public.social_flow_steps
    where flow_id = :CASA and papel <> 'producao'),
  'Envio:entrega, Programar:pos_entrega');

select teste.conferir('Sem conta nem mes escolhendo, o fluxo e o da casa',
  (select public.fluxo_do_mes(:FCLI)::text), :CASA);

-- AS DUAS PONTAS SUGERIDAS VIAJAM COM O FLUXO (0083 e 0084). Elas moravam em
-- `ETAPAS_DA_CORRENTE`, em TypeScript, e aquela lista nao sabe sugerir nada
-- para uma etapa que alguem acrescentou -- dez campos de data vazios fariam
-- quem abre o mes inventar dez datas na hora.
select teste.conferir('A Pauta sugere comecar 31 dias antes do mes',
  (select comeca_dias_antes || '/' || termina_dias_antes
     from public.social_flow_steps where flow_id = :CASA and nome = 'Pauta'),
  '31/27');

-- E O DE-PARA DO CARD (0046) VIROU COLUNA, e nao o nome da etapa: renomear
-- "Pauta" fazia a tela do portal abrir o portao com a caixa de texto vazia.
select teste.conferir('A Pauta enche o campo pauta e o Conteudo a legenda',
  (select string_agg(nome || '=' || campo, ', ' order by ordem)
     from public.social_flow_steps where flow_id = :CASA and campo is not null),
  'Pauta=pauta, Conteúdo=legenda');


-- ---------------------------------------------------------------------------
-- 2. MONTAR UM FLUXO: O CASO QUE O USUARIO DESCREVEU
--
-- Tres avaliacoes do cliente antes da arte sair como peca fechada -- pauta,
-- conteudo e layout --, que e o arranjo que a corrente fixa nao sabia
-- representar.
-- ---------------------------------------------------------------------------

select teste.conferir_como('O desenvolvedor monta o fluxo de tres avais', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Três avaliações do cliente',
    jsonb_build_array(
      jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                         'campo','legenda','aprovacao_cliente',true),
      jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                         'aprovacao_cliente',true),
      jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FTRES, :FTRES),
  'true');

select teste.conferir('Os tres portoes do meio estao marcados',
  (select string_agg(nome, ', ' order by ordem) from public.social_flow_steps
    where flow_id = :FTRES and aprovacao_cliente),
  'Pauta, Conteúdo, Layout');

-- A ORDEM SAI DA POSICAO NA LISTA, com espaco de dez: a etapa de Ajustes nasce
-- ENTRE duas, e sem a folga um pedido do cliente obrigaria a renumerar as
-- seguintes (0045).
select teste.conferir('E a ordem tem folga de dez',
  (select string_agg(ordem::text, ',' order by ordem) from public.social_flow_steps
    where flow_id = :FTRES),
  '10,20,30,40,50');

-- O COLABORADOR NAO MONTA FLUXO, e quem barra e a policy -- nao a funcao, que
-- e `security invoker` justamente para que seja a policy a decidir. Um definer
-- aqui entregaria a edicao do fluxo a quem a corrente manda trabalhar.
select teste.recusa_com('O colaborador nao monta fluxo', :MARINA,
  $$select public.salvar_fluxo_de_social('Fluxo da Marina',
      jsonb_build_array(
        jsonb_build_object('nome','Fazer','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Mandar','funcao','Gestao','papel','entrega')))$$,
  'row-level security');

select teste.recusa_com('Nem o cliente', :JOANA,
  $$select public.salvar_fluxo_de_social('Fluxo da Joana',
      jsonb_build_array(
        jsonb_build_object('nome','Mandar','funcao','Gestao','papel','entrega')))$$,
  'row-level security');

-- E ELE NEM LE A CORRENTE DE NINGUEM: o fluxo e conversa interna -- quem
-- produz o que, em que ordem --, e a ausencia de policy e a trava, como em
-- `post_etapas` desde a 0045.
select teste.conferir_como('O cliente nao le fluxo nenhum', :JOANA,
  $$select count(*)::text from public.social_flows$$, '0');

select teste.conferir_como('Mas quem produz le, porque a corrente e dele', :MARINA,
  $$select (count(*) > 0)::text from public.social_flow_steps$$, 'true');


-- ---------------------------------------------------------------------------
-- 3. A TRAVA DA CORRENTE: producao* entrega pos_entrega*
--
-- UM FLUXO COM ETAPA E SEM ENTREGA e um mes cujos posts nunca chegam ao
-- cliente: o mes abre, os doze posts nascem, e "Enviar ao cliente" fica
-- desligado para sempre sem nada na tela dizendo por que. E o modo de falha
-- mais caro que a 0087 cria, entao e trava de banco e nao validacao de tela.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Fluxo sem entrega e recusado', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo sem entrega',
      jsonb_build_array(
        jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao'),
        jsonb_build_object('nome','Layout','funcao','Design','papel','producao')))$$,
  'precisa de uma etapa de entrega');

select teste.recusa_com('Duas entregas tambem', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com duas entregas',
      jsonb_build_array(
        jsonb_build_object('nome','Manda uma','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Manda outra','funcao','Gestao','papel','entrega')))$$,
  'a entrega é uma só');

-- E A TRAVA DO BANCO E A QUE VALE: as duas recusas acima saem da funcao, que
-- escreve a frase antes de gravar nada -- a decisao da maquina de estados da
-- subtarefa ao lado dos gatilhos da 0007. Estas duas vao direto na tabela, que
-- e o caminho de quem monta a chamada a mao.
select teste.recusa_com('E o gatilho recusa o mesmo, na tabela', :DIEGO,
  format($q$delete from public.social_flow_steps
            where flow_id = %L and papel = 'entrega'$q$, :FTRES),
  'precisa de uma etapa de entrega');

-- O ELO ESCOLHIDO AQUI E O PROGRAMAR e nao o Layout, e a razao e um achado da
-- propria bateria: o Layout carrega a marca do cliente neste fluxo, entao o
-- `check` de LINHA -- a marca so cabe em elo de producao -- dispara antes do
-- gatilho, e o cenario passaria medindo a trava errada.
select teste.recusa_com('E recusa a segunda entrega escrita a mao', :DIEGO,
  format($q$update public.social_flow_steps set papel = 'entrega'
            where flow_id = %L and nome = 'Programar'$q$, :FTRES),
  'a entrega é uma só');

-- A ORDEM TAMBEM, e a recusa NOMEIA a etapa fora de lugar: "a ordem esta
-- errada" manda a pessoa conferir seis linhas; dizer qual e a diferenca entre
-- uma recusa e uma instrucao (0023).
select teste.recusa_com_dica('Producao depois da entrega e recusada, nomeando a etapa', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo de tras para frente',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Faz a arte','funcao','Design','papel','producao')))$$,
  'produção, entrega e depois');

select teste.recusa_com('E a frase nomeia qual elo esta do lado errado', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo de tras para frente 2',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega'),
        jsonb_build_object('nome','Faz a arte','funcao','Design','papel','producao')))$$,
  'Faz a arte');

-- O PORTAO SO CABE NUM ELO DE PRODUCAO, e e `check` de linha: a entrega JA e o
-- portao, e o pos_entrega vem depois da decisao. Ate a 0076 isso era um FILTRO
-- na leitura -- `montar_etapas_do_post` descartava a marca do Envio e do
-- Programar --, e virou trava de escrita.
select teste.recusa_com('A entrega nao recebe a marca do cliente', :DIEGO,
  format($q$update public.social_flow_steps set aprovacao_cliente = true
            where flow_id = %L and papel = 'entrega'$q$, :FTRES),
  'social_flow_steps_portao_coerente');

select teste.recusa_com('Nem o que vem depois da decisao', :DIEGO,
  format($q$update public.social_flow_steps set aprovacao_cliente = true
            where flow_id = %L and papel = 'pos_entrega'$q$, :FTRES),
  'social_flow_steps_portao_coerente');

-- FLUXO SEM ETAPA NENHUMA passa pelo gatilho de proposito -- e o estado entre
-- o `delete` e o `insert` de quem o esta reescrevendo --, e e a FUNCAO que o
-- recusa. Recusar no gatilho travaria a edicao para proteger o uso.
select teste.recusa_com('Mas um fluxo vazio nao se salva', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo pelado', '[]'::jsonb)$$,
  'sem etapa nenhuma não abre mês nenhum');

select teste.cenario('E esvaziar os elos de um fluxo passa, porque e o meio da edicao',
  :DIEGO,
  format($q$delete from public.social_flow_steps where flow_id = %L$q$, :FTRES),
  'passa');

-- E O FLUXO VOLTA, porque os cenarios de baixo o usam.
select teste.conferir_como('O fluxo e remontado', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Três avaliações do cliente',
    jsonb_build_array(
      jsonb_build_object('nome','Pauta','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Conteúdo','funcao','Redator','papel','producao',
                         'campo','legenda','aprovacao_cliente',true),
      jsonb_build_object('nome','Layout','funcao','Design','papel','producao',
                         'aprovacao_cliente',true),
      jsonb_build_object('nome','Envio','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Programar','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FTRES, :FTRES),
  'true');

-- DUAS ETAPAS COM O MESMO NOME nao e detalhe: `p_prazos` e um mapa POR NOME
-- desde a 0059, e as duas receberiam o mesmo periodo -- com a trava da ordem
-- recusando o mes em seguida, por uma razao que a mensagem nao explicaria.
select teste.recusa_com('Duas etapas homonimas no mesmo fluxo', :DIEGO,
  $$select public.salvar_fluxo_de_social('Fluxo com nome repetido',
      jsonb_build_array(
        jsonb_build_object('nome','Arte','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Arte','funcao','Design','papel','producao'),
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')))$$,
  'duas etapas chamadas "Arte"');


-- ---------------------------------------------------------------------------
-- 4. UM FLUXO COM NOMES PROPRIOS -- O CENARIO QUE JUSTIFICA O ARQUIVO
--
-- Nenhum elo deste fluxo se chama Envio, Pauta, Conteudo, Layout ou Programar.
-- Se qualquer uma das seis comparacoes por nome voltar ao produto, os cenarios
-- desta secao caem -- e e o unico jeito de medir isso, porque com os nomes da
-- casa eles passariam dos dois jeitos.
-- ---------------------------------------------------------------------------

select teste.conferir_como('Um fluxo que nao usa nenhum dos cinco nomes', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social(
    'Fluxo com outro vocabulário',
    jsonb_build_array(
      jsonb_build_object('nome','Briefing do mês','funcao','Social Media','papel','producao',
                         'campo','pauta','aprovacao_cliente',true),
      jsonb_build_object('nome','Produção de Layout','funcao','Design','papel','producao',
                         'campo','legenda'),
      jsonb_build_object('nome','Entrega ao cliente','funcao','Gestao','papel','entrega'),
      jsonb_build_object('nome','Agendamento','funcao','Social Media','papel','pos_entrega')
    ), %L) = %L)::text$q$, :FNOMES, :FNOMES),
  'true');

insert into public.client_flow_defaults (client_id, social_flow_id)
values (:FCLI, :FNOMES)
on conflict (client_id) do update set social_flow_id = :FNOMES;

\set POST1 '''e0870000-0000-0000-0000-0000000000a1'''

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:POST1, :FCLI, 'Peça com vocabulário próprio', '2027-05-10', '{instagram}',
        'imagem', :ANA, :BRUNO);

select teste.conferir('A corrente do post saiu do fluxo da conta',
  (select string_agg(nome, ' > ' order by ordem) from public.post_etapas
    where post_id = :POST1),
  'Briefing do mês > Produção de Layout > Entrega ao cliente > Agendamento');

-- ESTE E O CENARIO. Com `nome = 'Envio'` de volta em
-- `porta_do_cliente_no_post`, o primeiro portao aberto deste post seria o
-- "Briefing do mes" -- que esta certo, porque ele TEM a marca -- e depois de
-- concluido nao haveria mais nenhum: o post nunca sairia da agencia.
select teste.conferir('O primeiro portao e o briefing, que a conta aprova',
  (select (public.porta_do_cliente_no_post(:POST1)).nome), 'Briefing do mês');

update public.post_etapas set status = 'concluida'
 where post_id = :POST1 and nome = 'Briefing do mês';

select teste.conferir('Fechado ele, o portao passa a ser a ENTREGA, pelo papel',
  (select (public.porta_do_cliente_no_post(:POST1)).nome), 'Entrega ao cliente');

select teste.conferir('E ela e a entrega sem se chamar Envio',
  (select (public.porta_do_cliente_no_post(:POST1)).papel::text), 'entrega');

-- E A ENTREGA NAO SE MARCA A MAO, nem pela gestao -- ela e consequencia da
-- rodada de escopo cliente, como `posts.enviado_em` desde a 0032. A trava
-- perguntava pelo nome; agora pergunta pelo papel.
select teste.recusa_com('A entrega nao se marca a mao, mesmo com outro nome', :DIEGO,
  format($q$update public.post_etapas set status = 'em_andamento'
            where post_id = %L and nome = 'Entrega ao cliente'$q$, :POST1),
  'acompanha a decisão do cliente');

-- E O QUE O CLIENTE DECIDE sai do CAMPO e nao do nome: com
-- `case e.nome when 'Pauta'` de volta, esta tela abriria em branco.
update public.posts set pauta = 'Três telas, tom de conversa.' where id = :POST1;

update public.post_etapas set status = 'nao_iniciada'
 where post_id = :POST1 and nome = 'Briefing do mês';

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :POST1, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao manda o briefing ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :POST1, :DIEGO),
  'ok', 1);

select teste.conferir_como('O cliente le o texto do portao, pelo campo', :JOANA,
  format($q$select texto from public.o_que_o_cliente_decide(%L)$q$, :POST1),
  'Três telas, tom de conversa.');

select teste.conferir_como('E o nome do portao e o do fluxo dele', :JOANA,
  format($q$select etapa from public.o_que_o_cliente_decide(%L)$q$, :POST1),
  'Briefing do mês');

-- O CLIENTE APROVA, E O POST NAO FICA APROVADO -- a linha que a 0076 existe
-- para proteger, atravessando a 0087: o portao decidido nao e a entrega, entao
-- o post volta para producao. Com `porta.nome <> 'Envio'` de volta, este post
-- ficaria verde no calendario dele com a arte inexistente.
select teste.cenario('A Joana aprova o briefing', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode seguir.')$fmt$, :POST1),
  'ok', 1);

select teste.conferir('O post voltou para producao, e nao ficou aprovado',
  (select status::text from public.posts where id = :POST1), 'em_producao');

select teste.conferir('E o briefing fechou',
  (select status::text from public.post_etapas
    where post_id = :POST1 and nome = 'Briefing do mês'), 'concluida');


-- ---------------------------------------------------------------------------
-- 5. O AJUSTE VOLTA PARA QUEM ENTREGOU, E NAO PARA A PALAVRA 'Layout'
--
-- Com a cadeia editavel, `e.nome = 'Layout'` devolveria o ajuste para NINGUEM
-- num fluxo que chame aquela etapa de outra coisa -- a etapa nasceria orfa, e
-- etapa sem dono nao aparece no "Minhas Tasks" de ninguem, que e o pior
-- destino de um pedido do cliente.
-- ---------------------------------------------------------------------------

update public.post_etapas set responsavel_id = :CARLA
 where post_id = :POST1 and nome = 'Produção de Layout';

update public.post_etapas set status = 'concluida'
 where post_id = :POST1 and nome = 'Produção de Layout';

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :POST1, 2, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao manda a peca pronta', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 2, 'cliente', %L, 'pendente')$fmt$, :POST1, :DIEGO),
  'ok', 1);

select teste.cenario('E a Joana pede ajustes', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'Trocar a cor do fundo.')$fmt$, :POST1),
  'ok', 1);

select teste.conferir('A etapa de Ajustes nasceu',
  (select count(*)::text from public.post_etapas
    where post_id = :POST1 and nome = 'Ajustes'), '1');

select teste.conferir('E e da Carla, que fez o ultimo elo de producao',
  (select responsavel_id::text from public.post_etapas
    where post_id = :POST1 and nome = 'Ajustes'), :CARLA);

select teste.conferir('Com a funcao dela, e nao Design escrito a mao',
  (select funcao::text from public.post_etapas
    where post_id = :POST1 and nome = 'Ajustes'), 'Design');


-- ---------------------------------------------------------------------------
-- 6. A ORDEM E MES -> CONTA -> CASA
--
-- Quem escreveu no lugar mais especifico mandou -- a ordem de
-- `coalesce(etapa, padrao)` (0041) e de `etapas_resolvidas_do_workflow()`
-- (0064). Lendo a conta primeiro, trocar o padrao dela reescreveria a corrente
-- dos meses que estao correndo, e a frase do usuario e o contrario.
-- ---------------------------------------------------------------------------

select teste.conferir_como('O Atendimento abre novembro com o fluxo de tres avais', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-11',
           '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/fluxo-nov', %L)::text$q$,
         :FCLI, :FTRES),
  '2');

select teste.conferir('A demanda do mes guardou o fluxo escolhido',
  (select social_flow_id::text from public.tasks
    where client_id = :FCLI and social_do_mes = '2027-11-01'), :FTRES);

-- O FLUXO DO MES GANHA DO DA CONTA, e este e o cenario que cai se
-- `fluxo_do_post()` ler a conta primeiro: a conta aponta para o fluxo de
-- vocabulario proprio, e os posts de novembro nasceram com a corrente da casa.
select teste.conferir('Os posts do mes nasceram com a corrente DELE, nao a da conta',
  (select string_agg(distinct e.nome, ', ' order by e.nome)
     from public.post_etapas e
     join public.posts p on p.id = e.post_id
     join public.subtasks s on s.id = p.subtask_id
    where s.task_id = (select id from public.tasks
                        where client_id = :FCLI and social_do_mes = '2027-11-01')),
  'Conteúdo, Envio, Layout, Pauta, Programar');

select teste.conferir('E `fluxo_do_post` responde o do mes',
  (select public.fluxo_do_post(p.id)::text
     from public.posts p
     join public.subtasks s on s.id = p.subtask_id
    where s.task_id = (select id from public.tasks
                        where client_id = :FCLI and social_do_mes = '2027-11-01')
    limit 1),
  :FTRES);

-- E O POST AVULSO CAI NA CONTA, que e a verdade do que ele e: um post que
-- ninguem abriu dentro de um mes (0061).
select teste.conferir('O post avulso responde o fluxo da conta',
  (select public.fluxo_do_post(:POST1)::text), :FNOMES);

-- ABRIR O MESMO MES EM DUAS VEZES USA A MESMA CORRENTE, e e para isso que
-- `tasks.social_flow_id` existe: sem ela a segunda chamada usaria o fluxo da
-- conta, e o mes ficaria com metade dos posts indo ao cliente por um caminho e
-- metade por outro.
select teste.conferir_como('A segunda chamada acrescenta posts ao mesmo mes', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-11',
           '[{"redes":["facebook"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, null, %L)::text$q$, :FCLI, :FNOMES),
  '1');

select teste.conferir('E o terceiro post nasceu com a corrente do MES, nao a pedida',
  (select string_agg(e.nome, ' > ' order by e.ordem)
     from public.post_etapas e
    where e.post_id = (select p.id from public.posts p
                        join public.subtasks s on s.id = p.subtask_id
                       where s.task_id = (select id from public.tasks
                                           where client_id = :FCLI
                                             and social_do_mes = '2027-11-01')
                         and p.plataformas = '{facebook}'::public.plataforma_social[]
                       limit 1)),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('O mes continua apontando para o fluxo original',
  (select social_flow_id::text from public.tasks
    where client_id = :FCLI and social_do_mes = '2027-11-01'), :FTRES);


-- ---------------------------------------------------------------------------
-- 7. ABRIR O MES PERGUNTA PELAS ETAPAS DO FLUXO, E A DICA NOMEIA AS DELE
--
-- Com a lista fixa das cinco escrita a mao na dica, a recusa mandaria a pessoa
-- procurar "Pauta" num fluxo que nao tem nenhuma.
-- ---------------------------------------------------------------------------

select teste.recusa_com_dica('O periodo de uma etapa que o fluxo nao tem, com a dica certa',
  :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-01',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Pauta": {"inicio": "2027-12-01", "fim": "2027-12-05"}}'::jsonb,
           'https://drive.com/x', %L)$q$, :FCLI, :FNOMES),
  'Briefing do mês');

select teste.recusa_com('E a mensagem diz que o fluxo deste mes nao a tem', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-01',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Pauta": {"inicio": "2027-12-01", "fim": "2027-12-05"}}'::jsonb,
           'https://drive.com/x', %L)$q$, :FCLI, :FNOMES),
  'não tem etapa chamada "Pauta"');

-- E A ORDEM DO FLUXO CONTINUA SENDO CONFERIDA PELO FIM (0084), com os nomes
-- dele na dica.
select teste.recusa_com_dica('A corrente nao vence de tras para a frente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-02',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb,
           '{"Briefing do mês": {"fim": "2028-01-20"},
             "Produção de Layout": {"fim": "2028-01-10"}}'::jsonb,
           'https://drive.com/y', %L)$q$, :FCLI, :FNOMES),
  'A ordem deste fluxo é Briefing do mês, Produção de Layout');

-- FLUXO VAZIO NAO ABRE MES, e a recusa diz o que falta. A trava do gatilho o
-- deixa existir de proposito; o que ele nao pode e abrir um mes.
\set FVAZIO '''e0870000-0000-0000-0000-0000000000f3'''

select teste.conferir_como('Um fluxo nasce e os elos dele saem', :DIEGO,
  format($q$select (public.salvar_fluxo_de_social('Fluxo que vai ficar vazio',
      jsonb_build_array(
        jsonb_build_object('nome','Manda','funcao','Gestao','papel','entrega')),
      %L) = %L)::text$q$, :FVAZIO, :FVAZIO),
  'true');

select teste.cenario('Os elos dele sao apagados', :DIEGO,
  format($q$delete from public.social_flow_steps where flow_id = %L$q$, :FVAZIO),
  'passa');

select teste.recusa_com_dica('E ele nao abre mes nenhum', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2028-03',
           '[{"redes":["instagram"],"quantidade":1}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/z', %L)$q$,
         :FCLI, :FVAZIO),
  'Monte a corrente dele antes de abrir o mês');


-- ---------------------------------------------------------------------------
-- 8. A CONVERSAO DE `social_aprovacoes`, E A COLUNA QUE SAIU
--
-- A decisao da 0023: a coluna sai, nao fica parada ao lado da nova. E a
-- CONVERSAO e a metade que importa -- sem ela, toda conta que combinou aprovar
-- a pauta perderia o portao no instante em que a migration fosse aplicada, e a
-- frase do contrato deixaria de valer sem ninguem ter decidido isso.
--
-- O CENARIO NAO DA PARA MONTAR AQUI, e vale dito em vez de escondido: a coluna
-- nao existe mais neste banco, entao nao ha como criar o estado de antes. O
-- que se mede e que ela SAIU e que a conversao DEIXOU rastro -- a Mundo Verde
-- do `_dados_de_teste.sql` nao tinha lista, entao quem prova a conversao e o
-- fluxo que o arquivo 39 monta e aponta.
-- ---------------------------------------------------------------------------

select teste.conferir('A coluna social_aprovacoes nao existe mais',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'client_flow_defaults'
      and column_name = 'social_aprovacoes'), '0');

select teste.conferir('E nem a funcao que dizia quais etapas davam para marcar',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'etapas_que_o_cliente_pode_aprovar'), '0');

-- `etapas_padrao_do_social()` SAIU TAMBEM, e nao virou apelido: duas funcoes
-- respondendo "qual e a corrente" sao o lugar onde as duas verdades comecam a
-- divergir, e a segunda seria a que alguem chama sem perceber que ela ignora o
-- fluxo da conta.
select teste.conferir('E nem a corrente fixa da 0045',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'etapas_padrao_do_social'), '0');


-- ---------------------------------------------------------------------------
-- 9. AS CORRENTES QUE JA EXISTIAM GANHARAM O PAPEL
--
-- Sem a passada da migration, todo post anterior a 0087 ficaria com os cinco
-- elos em `producao` -- e `porta_do_cliente_no_post()`, que passou a perguntar
-- pelo papel, nao acharia portao nenhum: o produto inteiro pararia de
-- conseguir enviar material ao cliente, nos posts que JA estao no ar.
-- ---------------------------------------------------------------------------

select teste.conferir('Todo Envio materializado e entrega',
  (select count(*)::text from public.post_etapas
    where nome = 'Envio' and papel <> 'entrega'), '0');

select teste.conferir('Todo Programar e pos-entrega',
  (select count(*)::text from public.post_etapas
    where nome = 'Programar' and papel <> 'pos_entrega'), '0');

select teste.conferir('E toda Pauta enche o campo pauta',
  (select count(*)::text from public.post_etapas
    where nome = 'Pauta' and campo is distinct from 'pauta'), '0');


-- ---------------------------------------------------------------------------
-- 10. O QUE QUEM PRODUZ NAO TROCA NA ETAPA
--
-- Policy nao limita coluna: sem o trigger, um PATCH no PostgREST diria que a
-- etapa dele E a entrega ao cliente -- e o portao do post passaria a ser ela.
-- ---------------------------------------------------------------------------

select teste.recusa_com('Quem produz nao troca o papel da etapa dele', :CARLA,
  format($q$update public.post_etapas set papel = 'entrega'
            where post_id = %L and nome = 'Produção de Layout'$q$, :POST1),
  'o resto é da gestão');

-- O VALOR AQUI E 'pauta' e nao 'legenda', e e o segundo achado da bateria: o
-- elo ja enche a legenda neste fluxo, entao `new.campo is distinct from
-- old.campo` seria falso e o cenario passaria sem a trava ter sido exercida --
-- um teste que afirma sem provar.
select teste.recusa_com('Nem o campo que ela enche', :CARLA,
  format($q$update public.post_etapas set campo = 'pauta'
            where post_id = %L and nome = 'Produção de Layout'$q$, :POST1),
  'o resto é da gestão');


-- ---------------------------------------------------------------------------
-- 11. O FLUXO DA CASA PODE SAIR, E A VOLTA E O MAIS ANTIGO ATIVO
--
-- Uma agencia que montou os fluxos dela nao precisa carregar o padrao que veio
-- de fabrica. Nao havendo nenhum, quem recusa e `abrir_mes_de_social` com a
-- frase que diz o que falta -- `fluxo_padrao_da_casa()` devolver nulo e dizer
-- a verdade.
-- ---------------------------------------------------------------------------

select teste.cenario('O socio desativa o fluxo da casa', :ANA,
  format($q$update public.social_flows set ativo = false where id = %L$q$, :CASA),
  'passa');

select teste.conferir('A volta e um fluxo ativo, e nao nulo',
  (select (public.fluxo_padrao_da_casa() is not null)::text), 'true');

select teste.conferir('E ele nao e o da casa',
  (select (public.fluxo_padrao_da_casa() = :CASA)::text), 'false');

select teste.cenario('E ele volta', :ANA,
  format($q$update public.social_flows set ativo = true where id = %L$q$, :CASA),
  'passa');

select teste.conferir('O padrao da casa voltou a ser o da casa',
  (select public.fluxo_padrao_da_casa()::text), :CASA);
