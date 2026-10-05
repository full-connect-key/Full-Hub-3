\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set SEMPORTAO '''50760000-0000-0000-0000-000000000001'''
\set COMPAUTA  '''50760000-0000-0000-0000-000000000002'''
\set AJUSTE    '''50760000-0000-0000-0000-000000000003'''

-- ===========================================================================
-- 0076 -- O CLIENTE APROVA A CORRENTE ETAPA POR ETAPA
--
-- Decisao do usuario: "preciso poder escolher, se as etapas vao ser aprovadas
-- pelo cliente, uma por uma. Algumas contas aprovam pauta, antes de entrar em
-- producao."
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o cliente aprova a Pauta e o
-- post NAO fica aprovado". Ele atravessa a unica coisa que esta migration
-- podia quebrar de forma cara: `decidir_rodada_do_cliente` escreve
-- `status = 'aprovado'` no post a cada decisao positiva, e com os portoes do
-- meio isso passaria a dizer que a peca inteira esta fechada -- no calendario
-- do cliente, na grade do feed e na leitura da agencia -- quando o que ele
-- aprovou foi um paragrafo de texto e a arte nem existe.
-- ===========================================================================


-- --- 1. Sem lista na conta, a corrente e a de sempre -----------------------
--
-- E o lado seguro do erro: esquecer a coluna nova deixa o produto como ele
-- estava, com um portao so. O contrario -- todo post nascendo com cinco
-- portoes -- poria o cliente decidindo cinco vezes sobre uma peca.

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:SEMPORTAO, :VERDE, 'Conta sem portao do meio', '2027-03-10', '{instagram}',
        'imagem', :ANA, :BRUNO);

select teste.conferir('Sem lista na conta, nenhuma etapa vira portao',
  (select count(*)::text from public.post_etapas
    where post_id = :SEMPORTAO and aprovacao_cliente), '0');

-- E A PORTA CONTINUA SENDO O ENVIO. E esta linha que prova que a funcao nova
-- nao mudou o comportamento de quem nao pediu nada.
select teste.conferir('E a porta do cliente continua sendo o Envio',
  (select (public.porta_do_cliente_no_post(:SEMPORTAO)).nome), 'Envio');


-- --- 2. A conta combina que aprova a pauta ---------------------------------

insert into public.client_flow_defaults (client_id, social_aprovacoes)
values (:VERDE, array['Pauta'])
on conflict (client_id) do update set social_aprovacoes = array['Pauta'];

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:COMPAUTA, :VERDE, 'Conta que aprova a pauta', null, '{instagram}',
        'imagem', :ANA, :BRUNO);

update public.post_etapas set responsavel_id = :MARINA
 where post_id = :COMPAUTA and nome = 'Pauta';

update public.post_etapas set responsavel_id = :CARLA
 where post_id = :COMPAUTA and nome = 'Conteúdo';

select teste.conferir('A Pauta nasceu como portao do cliente',
  (select aprovacao_cliente::text from public.post_etapas
    where post_id = :COMPAUTA and nome = 'Pauta'), 'true');

select teste.conferir('E so ela',
  (select string_agg(nome, ', ' order by ordem) from public.post_etapas
    where post_id = :COMPAUTA and aprovacao_cliente), 'Pauta');

-- A PORTA PASSOU A SER A PAUTA, e e este cenario que cai se alguem devolver a
-- palavra 'Envio' escrita a mao a `posts_corrente_do_cliente`.
select teste.conferir('E a porta do cliente passou a ser ela',
  (select (public.porta_do_cliente_no_post(:COMPAUTA)).nome), 'Pauta');


-- --- 3. O Envio e o Programar nunca viram portao ---------------------------
--
-- Mesmo escritos na lista: o primeiro JA e o portao do cliente desde a 0045, e
-- o segundo vem depois da decisao -- um portao ali esperaria o cliente aprovar
-- que o post foi agendado.

update public.client_flow_defaults
   set social_aprovacoes = array['Pauta', 'Envio', 'Programar', 'Etapa que nao existe']
 where client_id = :VERDE;

\set TUDO '''50760000-0000-0000-0000-000000000004'''

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:TUDO, :VERDE, 'Lista com tudo dentro', '2027-03-12', '{instagram}',
        'imagem', :ANA, :BRUNO);

select teste.conferir('Envio, Programar e nome inventado nao viram portao',
  (select string_agg(nome, ', ' order by ordem) from public.post_etapas
    where post_id = :TUDO and aprovacao_cliente), 'Pauta');

select teste.conferir('E a lista do que da para escolher tem tres elos',
  (select string_agg(nome, ' > ' order by ordem)
     from public.etapas_que_o_cliente_pode_aprovar()),
  'Pauta > Conteúdo > Layout');

update public.client_flow_defaults
   set social_aprovacoes = array['Pauta'] where client_id = :VERDE;


-- --- 4. Quem escreve a pauta trabalha nela, e nao a fecha ------------------
--
-- A DIFERENCA PARA O ENVIO ESTA AQUI. O Envio recusa qualquer mudanca a mao,
-- porque nele nao ha nada a fazer alem de esperar; num portao do meio HA
-- trabalho, e recusar `em_andamento` deixaria quem escreve a pauta sem como
-- dizer que comecou.

select teste.cenario('A Marina comeca a Pauta', :MARINA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
    where post_id = %L and nome = 'Pauta'$fmt$, :COMPAUTA), 'ok', 1);

select teste.recusa_com_dica('Mas nao a conclui a mao', :MARINA,
  format($fmt$update public.post_etapas set status = 'concluida'
    where post_id = %L and nome = 'Pauta'$fmt$, :COMPAUTA),
  'Enviar ao cliente');

-- NEM A GESTAO, e e a mesma razao do Envio: marcar a etapa afirmaria que o
-- cliente decidiu sem nada ter saido da agencia.
select teste.recusa_com('Nem a gestao a conclui', :ANA,
  format($fmt$update public.post_etapas set status = 'concluida'
    where post_id = %L and nome = 'Pauta'$fmt$, :COMPAUTA),
  'passa pelo cliente');

-- E NEM FINGE QUE A RODADA EXISTE. `enviada_aprovacao` afirma que ha uma
-- rodada aberta, e a fila de aprovacoes vai procura-la.
select teste.recusa_com('E ninguem a poe em aprovacao a mao', :ANA,
  format($fmt$update public.post_etapas set status = 'enviada_aprovacao'
    where post_id = %L and nome = 'Pauta'$fmt$, :COMPAUTA),
  'passa pelo cliente');

-- E O COLABORADOR NAO DECIDE SE A ETAPA DELE PASSA PELO CLIENTE. Isso e
-- combinado com a conta, e mora em `client_flow_defaults`.
select teste.recusa_com_dica('E nao desliga o proprio portao', :MARINA,
  format($fmt$update public.post_etapas set aprovacao_cliente = false
    where post_id = %L and nome = 'Pauta'$fmt$, :COMPAUTA),
  'Nome, função, ordem, responsável e prazo');


-- --- 5. O portao do meio sai SEM data de publicacao ------------------------
--
-- A trava da 0044 -- "post sem data nao vai ao cliente" -- e sobre a ARTE: o
-- cliente decidiria sobre a peca sem saber quando ela vai ao ar. Num portao do
-- meio nao ha arte, ha pauta, e o mes abre em branco (0044) com a Pauta sendo
-- a PRIMEIRA etapa: exigir a data ali seria uma recusa que a corrente nao tem
-- como satisfazer, e o portao ficaria fechado para sempre.

select teste.conferir('Este post continua sem data',
  (select coalesce(data_publicacao::text, 'sem data') from public.posts
    where id = :COMPAUTA), 'sem data');

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :COMPAUTA, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao manda a pauta ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :COMPAUTA, :DIEGO),
  'ok', 1);

select teste.conferir('A PAUTA entrou em curso, e nao o Envio',
  (select status::text from public.post_etapas
    where post_id = :COMPAUTA and nome = 'Pauta'), 'enviada_aprovacao');

select teste.conferir('O Envio continua parado no comeco',
  (select status::text from public.post_etapas
    where post_id = :COMPAUTA and nome = 'Envio'), 'nao_iniciada');

-- E O POST PASSOU A EXISTIR PARA O CLIENTE. `enviado_em` e consequencia da
-- rodada de escopo cliente desde a 0032, e e ele que `posts_select_cliente` le
-- -- entao o primeiro portao ja abre o post para ele, que e exatamente o que
-- precisa acontecer para ele LER a pauta.
select teste.cenario('E a Joana ja enxerga o post', :JOANA,
  format($fmt$select 1 from public.posts where id = %L$fmt$, :COMPAUTA), 'ok', 1);


-- --- 6. O CLIENTE APROVA A PAUTA, E O POST NAO FICA APROVADO --------------
--
-- O cenario que justifica o arquivo.

select teste.cenario('A Joana aprova a pauta', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode seguir.')$fmt$, :COMPAUTA),
  'ok', 1);

select teste.conferir('A Pauta fechou',
  (select status::text from public.post_etapas
    where post_id = :COMPAUTA and nome = 'Pauta'), 'concluida');

-- A LINHA QUE IMPORTA. Sem ela o post ficaria 'aprovado' -- verde no
-- calendario do cliente, fechado na grade do feed, "pode programar" para a
-- agencia -- por causa de um paragrafo de texto.
select teste.conferir('Mas o POST voltou para producao',
  (select status::text from public.posts where id = :COMPAUTA), 'em_producao');

select teste.conferir('E a rodada ficou gravada como aprovada',
  (select status::text from public.approval_rounds
    where content_type = 'post' and content_id = :COMPAUTA and escopo = 'cliente'
    order by numero_rodada desc limit 1), 'aprovada');

-- A CORRENTE ANDOU: o Conteudo destravou, que e o ponto do portao existir.
select teste.cenario('E o redator ja pode comecar o Conteudo', :CARLA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
    where post_id = %L and nome = 'Conteúdo'$fmt$, :COMPAUTA), 'ok', 1);

select teste.conferir('A porta do cliente passou a ser o Envio',
  (select (public.porta_do_cliente_no_post(:COMPAUTA)).nome), 'Envio');


-- --- 7. Ajustes num portao do meio ----------------------------------------
--
-- O ajuste nasce DEPOIS DO PORTAO que o cliente recusou, e nao no vao fixo
-- entre 40 e 50. E quem refaz e o dono do proprio portao: quem escreveu a
-- pauta reescreve a pauta. Ler "Layout" aqui poria o designer para reescrever
-- texto.

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:AJUSTE, :VERDE, 'Pauta que volta', '2027-03-20', '{instagram}',
        'imagem', :ANA, :BRUNO);

update public.post_etapas set responsavel_id = :MARINA
 where post_id = :AJUSTE and nome = 'Pauta';

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :AJUSTE, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a pauta deste post', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :AJUSTE, :DIEGO),
  'ok', 1);

select teste.cenario('A Joana pede ajustes NA PAUTA', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'O angulo nao e o que combinamos.')$fmt$, :AJUSTE),
  'ok', 1);

select teste.conferir('Nasceu uma etapa de Ajustes da Pauta',
  (select count(*)::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Ajustes da Pauta'), '1');

-- E NAO A "Ajustes" do Envio. Duas etapas com o mesmo nome na mesma corrente
-- dariam duas linhas iguais no "Minhas Tasks" de duas pessoas diferentes.
select teste.conferir('E nao a Ajustes do Envio',
  (select count(*)::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Ajustes'), '0');

select teste.conferir('Entre a Pauta e o Conteudo, e nao depois do Envio',
  (select ordem::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Ajustes da Pauta'), '11');

-- QUEM ESCREVEU A PAUTA REESCREVE A PAUTA.
select teste.conferir('E e da Marina, que escreveu a pauta',
  (select responsavel_id::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Ajustes da Pauta'), :MARINA);

select teste.conferir('Com a funcao dela, e nao Design',
  (select funcao::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Ajustes da Pauta'), 'Social Media');

select teste.conferir('E a Pauta voltou para ajustes',
  (select status::text from public.post_etapas
    where post_id = :AJUSTE and nome = 'Pauta'), 'em_ajustes');

-- O POST FICA EM 'ajustes', e aqui isso e verdade: ha uma coisa a refazer. A
-- correcao do PASSO 6 vale so para a aprovacao, que e a que afirmaria que a
-- peca inteira fechou.
select teste.conferir('E o post esta em ajustes, que e a verdade',
  (select status::text from public.posts where id = :AJUSTE), 'ajustes');


-- --- 8. O Envio continua o Envio ------------------------------------------
--
-- A corrente de uma conta SEM portao do meio nao mudou em nada, e este e o
-- cenario que prova isso do outro lado: o mesmo caminho da 0045, do comeco ao
-- fim, com o ajuste nascendo entre 40 e 50 e no nome do Layout.

update public.post_etapas set status = 'concluida'
 where post_id = :SEMPORTAO and nome in ('Pauta', 'Conteúdo', 'Layout');

update public.post_etapas set responsavel_id = :BRUNO
 where post_id = :SEMPORTAO and nome = 'Layout';

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :SEMPORTAO, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a arte ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :SEMPORTAO, :DIEGO),
  'ok', 1);

select teste.cenario('A Joana pede ajustes no Envio', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'O logo ficou pequeno.')$fmt$, :SEMPORTAO),
  'ok', 1);

select teste.conferir('A etapa continua se chamando Ajustes',
  (select count(*)::text from public.post_etapas
    where post_id = :SEMPORTAO and nome = 'Ajustes'), '1');

select teste.conferir('E nasce entre o Envio e o Programar',
  (select ordem::text from public.post_etapas
    where post_id = :SEMPORTAO and nome = 'Ajustes'), '41');

select teste.conferir('E e do Bruno, que fez o Layout',
  (select responsavel_id::text from public.post_etapas
    where post_id = :SEMPORTAO and nome = 'Ajustes'), :BRUNO);

-- E O POST FICA APROVADO QUANDO O PORTAO ERA O ENVIO -- a correcao do PASSO 6
-- nao pode ter apagado o caminho normal.
\set NORMAL '''50760000-0000-0000-0000-000000000005'''

update public.client_flow_defaults set social_aprovacoes = '{}'
 where client_id = :VERDE;

insert into public.posts (id, client_id, tema, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:NORMAL, :VERDE, 'Caminho de sempre', '2027-03-25', '{instagram}',
        'imagem', :ANA, :BRUNO);

update public.post_etapas set status = 'concluida'
 where post_id = :NORMAL and nome in ('Pauta', 'Conteúdo', 'Layout');

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :NORMAL, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia a arte deste post', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :NORMAL, :DIEGO),
  'ok', 1);

select teste.cenario('A Joana aprova a arte', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode publicar.')$fmt$, :NORMAL),
  'ok', 1);

select teste.conferir('E AGORA o post fica aprovado',
  (select status::text from public.posts where id = :NORMAL), 'aprovado');

select teste.conferir('Com o Envio concluido',
  (select status::text from public.post_etapas
    where post_id = :NORMAL and nome = 'Envio'), 'concluida');


-- --- 9. O QUE O CLIENTE DECIDE, do lado dele -------------------------------
--
-- SEM ESTA FUNCAO A TELA DO PORTAL ABRE VAZIA num portao do meio: a arte nao
-- existe, e o que saiu da agencia foi um paragrafo. Ela e `security definer`
-- porque o cliente NAO tem policy em `post_etapas` (0045) e nao passa a ter --
-- a corrente e conversa interna, e abrir a tabela entregaria de lambuja quem
-- esta com cada etapa e quem atrasou.
--
-- E E POR ISSO QUE A GUARDA DELA E ESCRITA A MAO: `security definer` nao passa
-- pela RLS de `posts`, entao sem aquelas quatro linhas a funcao responderia
-- sobre o post de qualquer empresa para quem tivesse o uuid. Os cenarios do
-- Otto sao os que caem se alguem a tirar -- e o furo passaria despercebido num
-- banco com um cliente so, que e a licao da `calendar_events`.

\set LEITURA '''50760000-0000-0000-0000-000000000006'''

-- A LISTA VOLTA, porque a secao 8 a esvaziou para provar o caminho de sempre.
-- Ela e lida no INSERT do post por `montar_etapas_do_post`, e nao na leitura --
-- entao a ordem dos dois comandos e a diferenca entre este post ter portao e
-- nao ter.
update public.client_flow_defaults
   set social_aprovacoes = array['Pauta'] where client_id = :VERDE;

insert into public.posts (id, client_id, tema, pauta, data_publicacao, plataformas,
                          midia, criado_por, responsavel_id)
values (:LEITURA, :VERDE, 'Dia do Cliente', 'Carrossel de cinco telas, tom de conversa.',
        null, '{instagram}', 'carrossel', :ANA, :BRUNO);

update public.post_etapas set responsavel_id = :MARINA
 where post_id = :LEITURA and nome = 'Pauta';

-- ANTES DE SAIR, NAO HA NADA A DIZER: o portao existe mas ninguem o mandou, e
-- a tela do portal nem alcanca este post. Devolver a pauta aqui seria devolver
-- material interno de um post que o cliente nao enxerga.
select teste.conferir('Post que nao saiu nao responde nada',
  (select count(*)::text from public.o_que_o_cliente_decide(:LEITURA)), '0');

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :LEITURA, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao manda a pauta ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :LEITURA, :DIEGO),
  'ok', 1);

-- A DONA DA EMPRESA LE A PAUTA, e e a inversao declarada no cabecalho da 0076:
-- a 0046 escreveu que a pauta e conversa interna, e era verdade enquanto
-- ninguem de fora a decidia. O recorte e exatamente este -- so a etapa marcada,
-- so enquanto ela e o portao aberto, so na conta que a ligou.
select teste.cenario('A Joana descobre QUAL etapa espera ela', :JOANA,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)
    where etapa = 'Pauta'$fmt$, :LEITURA), 'ok', 1);

select teste.cenario('E le o texto da pauta', :JOANA,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)
    where texto = 'Carrossel de cinco telas, tom de conversa.'$fmt$, :LEITURA),
  'ok', 1);

-- O CLIENTE DA OUTRA EMPRESA NAO RECEBE NADA. Nem o nome da etapa: "a Pauta da
-- Mundo Verde esta esperando" ja e informacao sobre uma conta que nao e dele.
select teste.cenario('O Otto nao alcanca o portao da outra empresa', :OTTO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)$fmt$, :LEITURA),
  'ok', 0);

select teste.cenario('Nem lendo o texto direto', :OTTO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)
    where texto is not null$fmt$, :LEITURA), 'ok', 0);

-- A EQUIPE ALCANCA, e e a visualizacao administrativa de `/portal/{slug}`: a
-- mesma tela, com as mesmas frases, para a agencia conferir o que ele ve. Sem
-- este ramo ela abriria sem o aviso, mostrando um post sem arte e sem explicar.
select teste.cenario('A agencia ve o mesmo, na visualizacao do portal', :DIEGO,
  format($fmt$select 1 from public.o_que_o_cliente_decide(%L)
    where etapa = 'Pauta'$fmt$, :LEITURA), 'ok', 1);

-- E NO CAMINHO DE SEMPRE ELA CALA. O Envio e portao de todo post desde a 0032:
-- devolve-lo aqui faria a tela anunciar uma etapa em cima de toda arte enviada
-- nos ultimos quatro sprints -- um aviso permanente, que e o que ensina a
-- ignorar aviso.
select teste.conferir('No portao do Envio ela nao devolve nada',
  (select count(*)::text from public.o_que_o_cliente_decide(:NORMAL)), '0');

-- E DEPOIS DE DECIDIDA, o portao fecha e ela cala de novo: quem abre o post
-- para reler a decisao nao pode ver a pergunta ainda na tela.
select teste.cenario('A Joana aprova a pauta', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'aprovada', 'Pode seguir.')$fmt$, :LEITURA),
  'ok', 1);

select teste.conferir('Pauta aprovada, nada mais a anunciar',
  (select count(*)::text from public.o_que_o_cliente_decide(:LEITURA)), '0');
