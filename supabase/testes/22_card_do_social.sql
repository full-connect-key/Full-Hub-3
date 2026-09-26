\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set CARD '''50600000-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 0046 -- O CARD DO SOCIAL
--
-- Decisao do usuario: quem pega a etapa preenche o card -- referencia, pauta,
-- arte. E quem abre o mes passa a ser o Atendimento TAMBEM, nao so a gestao.
--
-- SAO DUAS AFIRMACOES QUE PARECEM BRIGAR e nao brigam: o colaborador escreve
-- no card e NAO abre post nem distribui a corrente. Abrir trabalho, distribuir
-- trabalho e fazer trabalho sao tres coisas, e o arquivo prova as tres.
-- ===========================================================================

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          midia, criado_por, responsavel_id)
values (:CARD, :VERDE, 'Card completo', '2026-11-28', 'instagram',
        'imagem', :ANA, :MARINA);

-- A corrente ja nasceu pelo gatilho. A Pauta vai para a Carla e o Layout para
-- o Bruno: os dois lados da policy de update precisam existir para os dois
-- cenarios da secao 2 dizerem coisas diferentes.
update public.post_etapas set responsavel_id = :CARLA
 where post_id = :CARD and nome = 'Pauta';
update public.post_etapas set responsavel_id = :BRUNO
 where post_id = :CARD and nome = 'Layout';


-- --- 1. Quem abre o mes ----------------------------------------------------
--
-- E `is_atendimento()`, a MESMA funcao de `tasks_insert` desde a 0006 -- e nao
-- uma parecida. Uma segunda funcao dizendo quase isso seria o lugar onde as
-- duas verdades comecam a divergir.

-- A CARLA E `colaborador` E ESTA NO ATENDIMENTO. Este cenario e o que separa
-- perfil de acesso de funcao na agencia: ate a 0046 ela levava "é da gestão".
select teste.cenario('O Atendimento abre o mes, sendo colaborador', :CARLA,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-03', '{"instagram": 2}'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/PASTA-DE-TESTE')$fmt$,
    :VERDE), 'ok', 1);

select teste.cenario('E abre post avulso tambem', :CARLA,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Story que o cliente pediu hoje', '2027-03-05', 'instagram')$fmt$,
    :VERDE), 'ok', 1);

-- O BRUNO E `colaborador` E E DESIGN. Mesmo perfil da Carla, outra funcao --
-- e e a funcao que decide. Se alguem trocar `is_atendimento()` por
-- `is_staff()`, este cenario passa a aceitar e diz que a trava caiu.
select teste.recusa_com('O Design nao abre o mes', :BRUNO,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-03', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  'é do Atendimento');

select teste.cenario('Nem abre post avulso', :BRUNO,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Post que eu abri', '2027-03-06', 'instagram')$fmt$, :VERDE),
  'recusa');

select teste.cenario('E o cliente muito menos', :JOANA,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Post do cliente', '2027-03-07', 'instagram')$fmt$, :VERDE),
  'recusa');


-- --- 2. O QUE O ATENDIMENTO ABRE ELE NAO DISTRIBUI -------------------------
--
-- Abrir trabalho e distribuir trabalho sao duas decisoes, e o usuario separou
-- as duas na mesma frase: "nao vao poder abrir um novo social, ou definir
-- responsaveis. So quem faz isso e desenvolvedor."
--
-- Dentro de `abrir_mes_de_social` a distribuicao passa, porque a funcao e
-- `security definer` e o mapa veio na mesma chamada. Fora dela, nao.

-- ZERO LINHAS E NAO EXCECAO, e a diferenca importa: quem recusa aqui e a
-- POLICY de update (`is_gestor() or responsavel_id = auth.uid()`), e a etapa
-- de Layout nao e da Carla -- ela nem chega ao trigger. Escrevi este cenario
-- esperando a mensagem do trigger e ele acusou; a recusa que vale e mais
-- funda que a que eu procurava, e a action traduz "nao voltou linha" em
-- recusa justamente para a tela nao dizer "salvo" a toa.
select teste.cenario('O Atendimento nao passa etapa para outra pessoa', :CARLA,
  format($fmt$update public.post_etapas set responsavel_id = %L
     where post_id = %L and nome = 'Layout'$fmt$, :BRUNO, :CARD), 'ok', 0);

-- E NA ETAPA QUE E DELA A POLICY DEIXA PASSAR, e ai quem recusa e o trigger --
-- com a frase que a pessoa le. Sao as duas camadas, uma atras da outra.
select teste.recusa_com('E na etapa dela, quem recusa e o trigger', :CARLA,
  format($fmt$update public.post_etapas set responsavel_id = %L
     where post_id = %L and nome = 'Pauta'$fmt$, :BRUNO, :CARD),
  'o resto é da gestão');

select teste.cenario('Nem a etapa dela mesma', :CARLA,
  format($fmt$update public.post_etapas set responsavel_id = %L
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CARLA, :CARD),
  'recusa');

select teste.cenario('A gestao distribui', :DIEGO,
  format($fmt$update public.post_etapas set responsavel_id = %L
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CARLA, :CARD), 'ok', 1);


-- --- 3. A PAUTA: onde a primeira etapa da corrente escreve -----------------
--
-- Sem esta coluna, quem pegava a etapa Pauta abria a tela e nao tinha onde
-- escrever nada -- a etapa existia e o trabalho dela nao cabia em lugar
-- nenhum.

select teste.cenario('Quem produz escreve a pauta', :MARINA,
  format($fmt$update public.posts
     set pauta = 'Tema: horta no calor. Ângulo: quem mora em apartamento.'
   where id = %L$fmt$, :CARD), 'ok', 1);

-- A PAUTA E CONVERSA INTERNA, e a legenda vai ao ar. Sao duas colunas porque
-- sao duas coisas -- escrever a pauta na legenda mandaria a pauta ao cliente.
select teste.conferir('E a legenda continua vazia',
  (select coalesce(legenda, '(vazia)') from public.posts where id = :CARD), '(vazia)');

select teste.cenario('O cliente nao le a pauta', :JOANA,
  format($fmt$select pauta from public.posts where id = %L$fmt$, :CARD), 'ok', 0);


-- --- 4. AS REFERENCIAS ----------------------------------------------------

select teste.cenario('Quem produz junta uma referencia', :MARINA,
  format($fmt$insert into public.post_referencias (post_id, url, titulo)
    values (%L, 'https://exemplo.com/moodboard', 'Moodboard do cliente')$fmt$, :CARD),
  'ok', 1);

select teste.cenario('E o redator junta outra', :CARLA,
  format($fmt$insert into public.post_referencias (post_id, url, titulo)
    values (%L, 'https://exemplo.com/post-parecido', 'Post que foi bem em julho')$fmt$,
    :CARD), 'ok', 1);

-- O TRIGGER ASSINA, e não o cliente. Policy não limita coluna: sem ele, um
-- PATCH poria a referência no nome de outra pessoa.
select teste.conferir('A referencia ficou no nome de quem a pos',
  (select count(*)::text from public.post_referencias
    where post_id = :CARD and adicionado_por = :CARLA), '1');

-- "ver com a Ana" digitado aqui vira um link quebrado na tela de quem for
-- buscar. Mesmo `check` do `link_entrega` da task, desde a 0014.
select teste.cenario('Texto solto nao e referencia', :MARINA,
  format($fmt$insert into public.post_referencias (post_id, url)
    values (%L, 'ver com a Ana')$fmt$, :CARD), 'recusa');

-- APAGAR E DE QUEM POS, OU DA GESTAO. A gestao modera apagando; ninguem apaga
-- a referencia de outra pessoa so por estar na mesma tela.
select teste.cenario('Ninguem apaga a referencia alheia', :MARINA,
  format($fmt$delete from public.post_referencias
     where post_id = %L and adicionado_por = %L$fmt$, :CARD, :CARLA), 'ok', 0);

select teste.cenario('Mas apaga a propria', :MARINA,
  format($fmt$delete from public.post_referencias
     where post_id = %L and adicionado_por = %L$fmt$, :CARD, :MARINA), 'ok', 1);

select teste.cenario('E a gestao apaga a de qualquer um', :DIEGO,
  format($fmt$delete from public.post_referencias where post_id = %L$fmt$, :CARD),
  'ok', 1);

-- SEM POLICY DE UPDATE, e a ausencia e a regra: editar o endereco de uma
-- referencia que alguem ja abriu e trocar o destino embaixo de quem a leu.
insert into public.post_referencias (post_id, url, titulo, adicionado_por)
values (:CARD, 'https://exemplo.com/briefing', 'Briefing', :MARINA);

select teste.cenario('Nem quem a pos troca o endereco dela', :MARINA,
  format($fmt$update public.post_referencias set url = 'https://outro.com'
     where post_id = %L$fmt$, :CARD), 'ok', 0);

select teste.cenario('Nem a gestao', :DIEGO,
  format($fmt$update public.post_referencias set url = 'https://outro.com'
     where post_id = %L$fmt$, :CARD), 'ok', 0);


-- --- 5. O cliente nao alcanca o card --------------------------------------
--
-- Referencia de apoio e conversa interna, como a corrente: ele decide sobre o
-- material, nao acompanha como a agencia chegou nele.

select teste.cenario('O cliente nao ve referencia nenhuma', :JOANA,
  format($fmt$select id from public.post_referencias where post_id = %L$fmt$, :CARD),
  'ok', 0);

select teste.cenario('Nem junta uma', :JOANA,
  format($fmt$insert into public.post_referencias (post_id, url)
    values (%L, 'https://exemplo.com/eu')$fmt$, :CARD), 'recusa');

-- APAGAR O POST LEVA AS REFERENCIAS JUNTO, por `on delete cascade` -- aqui a
-- chave estrangeira existe, ao contrario de `approval_rounds.content_id`.
select teste.cenario('A gestao apaga o post', :ANA,
  format($fmt$delete from public.posts where id = %L$fmt$, :CARD), 'ok', 1);

select teste.conferir('E as referencias foram com ele',
  (select count(*)::text from public.post_referencias where post_id = :CARD), '0');


-- ===========================================================================
-- 0047 -- QUEM TEM ETAPA NA CORRENTE EDITA O CARD
--
-- O FURO QUE ESTE ARQUIVO NAO PEGOU DA PRIMEIRA VEZ, e e a licao: os cenarios
-- da 0046 testaram quem ABRE o post e quem DISTRIBUI a corrente, e nenhum
-- testou a pessoa para quem o modulo inteiro existe -- a redatora escrevendo.
-- A bateria ficou verde com o card fechado para ela, e quem encontrou foi o
-- usuario, tentando trocar a data de um post do mes que acabara de abrir.
-- ===========================================================================

\set CARD2 '''50600000-0000-0000-0000-000000000002'''

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          midia, criado_por, responsavel_id)
values (:CARD2, :VERDE, 'Card da corrente', null, 'instagram',
        'imagem', :ANA, :MARINA);

-- A Carla tem a etapa Conteudo e NAO e `posts.responsavel_id` -- que e a
-- Marina. Ate a 0047, `posts_update` so aceitava gestao ou o dono do post.
update public.post_etapas set responsavel_id = :CARLA
 where post_id = :CARD2 and nome = 'Conteúdo';

select teste.cenario('A redatora escreve a legenda do post que nao e dela', :CARLA,
  format($fmt$update public.posts set legenda = 'Cinco dicas para o calor.'
     where id = %L$fmt$, :CARD2), 'ok', 1);

-- O PEDIDO DO USUARIO, palavra por palavra: "a data do post e funcao da social
-- media e da redatora". Este e o cenario que ele tentou na tela e nao passou.
select teste.cenario('E define a data, que e o que faltava', :CARLA,
  format($fmt$update public.posts set data_publicacao = '2026-12-10'
     where id = %L$fmt$, :CARD2), 'ok', 1);

select teste.cenario('E a pauta tambem', :CARLA,
  format($fmt$update public.posts set pauta = 'Angulo de quem mora em apartamento.'
     where id = %L$fmt$, :CARD2), 'ok', 1);

-- MAS A CORRENTE DE COLUNAS CONTINUA DE PE: a policy diz quem ENTRA, e o
-- trigger diz o que se mexe depois de entrar. A 0047 mexeu so na primeira.
select teste.recusa_com('Mas nao troca o cliente do post', :CARLA,
  format($fmt$update public.posts set client_id = %L where id = %L$fmt$,
    'aaaaaaaa-0000-0000-0000-000000000002', :CARD2),
  'Trocar o cliente');

select teste.recusa_com('Nem passa o post para outra pessoa', :CARLA,
  format($fmt$update public.posts set responsavel_id = %L where id = %L$fmt$,
    :CARLA, :CARD2),
  'Passar o post para outra pessoa');

-- E QUEM NAO TEM ETAPA NENHUMA CONTINUA DE FORA. E o que separa
-- `tenho_etapa_no_post()` de um `is_staff()` solto: com dez clientes, o
-- designer de outra conta trocaria a data de um post que nunca viu.
select teste.cenario('Quem nao esta na corrente nao escreve', :BRUNO,
  format($fmt$update public.posts set legenda = 'eu passei por aqui'
     where id = %L$fmt$, :CARD2), 'ok', 0);

select teste.cenario('Nem define a data', :BRUNO,
  format($fmt$update public.posts set data_publicacao = '2026-12-31'
     where id = %L$fmt$, :CARD2), 'ok', 0);

-- E o Bruno passa a escrever no instante em que ganha uma etapa. E a mesma
-- linha da policy vista do outro lado.
update public.post_etapas set responsavel_id = :BRUNO
 where post_id = :CARD2 and nome = 'Layout';

select teste.cenario('Com a etapa na mao, ele escreve', :BRUNO,
  format($fmt$update public.posts set legenda = 'Agora sim.'
     where id = %L$fmt$, :CARD2), 'ok', 1);

select teste.cenario('E o cliente continua sem escrever nada', :JOANA,
  format($fmt$update public.posts set data_publicacao = '2027-01-01'
     where id = %L$fmt$, :CARD2), 'ok', 0);
