\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set BRIEFING  '''50580000-0000-0000-0000-000000000001'''
\set CARROSSEL '''50580000-0000-0000-0000-000000000002'''
\set VIDEO     '''50580000-0000-0000-0000-000000000003'''

-- ===========================================================================
-- 0042 -- A CORRENTE DE MAO EM MAO DO SOCIAL MEDIA
--
-- Decisao do usuario: a gestao abre, libera ao colaborador que produz, e envia
-- ao cliente quando estiver pronto. Tres maos, e o arquivo prova as tres.
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "quem produziu nao envia a
-- propria entrega". Ele ja passava antes da 0042 -- e passava pela razao
-- ERRADA, porque a trava olhava `criado_por` e nos posts antigos o criador
-- era o produtor. Com a gestao abrindo o briefing, as duas coisas se separam,
-- e sem `dono_do_post()` a trava passaria a proteger a pessoa errada.
-- ===========================================================================

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          formato, midia, criado_por, responsavel_id)
values (:BRIEFING, :VERDE, 'Briefing sem dono', '2026-11-10', 'instagram',
        'Feed', 'imagem', :ANA, null),
       (:CARROSSEL, :VERDE, 'Carrossel de dicas', '2026-11-12', 'instagram',
        'Feed', 'carrossel', :ANA, :BRUNO),
       (:VIDEO, :VERDE, 'Reels da receita', '2026-11-15', 'instagram',
        'Reels', 'video', :ANA, :BRUNO);


-- --- 1. Quem abre o post ---------------------------------------------------

select teste.cenario('O socio abre um post', :ANA,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Aberto pela socia', '2026-11-20', 'instagram')$fmt$, :VERDE), 'ok', 1);

select teste.cenario('O desenvolvedor abre um post', :DIEGO,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Aberto pelo dev', '2026-11-21', 'instagram')$fmt$, :VERDE), 'ok', 1);

-- ERA `is_staff()` ATE A 0042, e a mudanca e decisao do usuario: "criada por
-- um desenvolvedor ou socio". Um colaborador abrindo post proprio furava a
-- corrente logo no primeiro elo.
select teste.cenario('O colaborador NAO abre post', :BRUNO,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Aberto pelo Bruno', '2026-11-22', 'instagram')$fmt$, :VERDE), 'recusa');

-- E O DO ATENDIMENTO ABRE, desde a 0046 -- cenario VIRADO DO AVESSO, como o
-- da data. Ate aqui `posts_insert` era `is_gestor()`, e a Carla levava recusa
-- por ser `colaborador`. Decisao do usuario: "desenvolvedor E ATENDIMENTO
-- abrem um Social Mensal". Virou `is_atendimento()`, a mesma pergunta que
-- `tasks_insert` faz desde a 0006 -- perfil de acesso e funcao na agencia sao
-- coisas diferentes. Se alguem devolver a policy para `is_gestor()`, este
-- cenario falha e diz que a decisao foi desfeita.
select teste.cenario('E o do Atendimento ABRE -- decisao da 0046', :CARLA,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Aberto pela Carla', '2026-11-23', 'instagram')$fmt$, :VERDE), 'ok', 1);


-- --- 2. Quem edita ---------------------------------------------------------

select teste.cenario('O responsavel edita a legenda do post dele', :BRUNO,
  format($fmt$update public.posts set legenda = '5 dicas para a horta' where id = %L$fmt$,
    :CARROSSEL), 'ok', 1);

-- A LISTA E DE `is_staff()` -- todo mundo VE o calendario da agencia --, mas
-- editar e so de quem recebeu. Sem isto, dois colaboradores mexeriam na mesma
-- arte sem saber um do outro.
select teste.cenario('A Marina NAO edita o post que e do Bruno', :MARINA,
  format($fmt$update public.posts set legenda = 'Escrevi por cima' where id = %L$fmt$,
    :CARROSSEL), 'recusa');

select teste.cenario('Mas ela VE o post na lista', :MARINA,
  format($fmt$select id from public.posts where id = %L$fmt$, :CARROSSEL), 'ok', 1);

select teste.cenario('A gestao edita qualquer post', :ANA,
  format($fmt$update public.posts set legenda = 'Ajustado pela gestao' where id = %L$fmt$,
    :CARROSSEL), 'ok', 1);


-- --- 3. O que o colaborador NAO troca --------------------------------------
--
-- POLICY NAO LIMITA COLUNA: as tres passam pela policy de update (o post e
-- dele) e morrem no trigger. E o trigger RECUSA em vez de reescrever, porque
-- os tres campos aparecem na tela -- devolver o valor antigo em silencio faria
-- a pessoa concluir que a tela esta quebrada.

select teste.recusa_com('O responsavel nao troca o cliente do post', :BRUNO,
  format($fmt$update public.posts set client_id = %L where id = %L$fmt$,
    'aaaaaaaa-0000-0000-0000-000000000002', :CARROSSEL),
  'Trocar o cliente');

select teste.recusa_com('Nem passa o post para outra pessoa', :BRUNO,
  format($fmt$update public.posts set responsavel_id = %L where id = %L$fmt$,
    :MARINA, :CARROSSEL),
  'Passar o post para outra pessoa');

-- A DATA SAIU DESTA LISTA na 0044, e este cenario esta VIRADO DO AVESSO de
-- proposito: ate a 0044 ele recusava, porque a data tinha sido "combinada com o
-- cliente". Decisao do usuario: quem produz decide quando o post vai ao ar --
-- o mes abre sem data nenhuma e e a Social Media que distribui. Se alguem
-- recolocar a data no trigger, este cenario falha e diz que a regra voltou.
select teste.cenario('E A DATA, essa ele troca -- decisao da 0044', :BRUNO,
  format($fmt$update public.posts set data_publicacao = '2026-12-01' where id = %L$fmt$,
    :CARROSSEL), 'ok', 1);

select teste.recusa_com('E nao carimba o envio a mao', :BRUNO,
  format($fmt$update public.posts set enviado_em = now() where id = %L$fmt$, :CARROSSEL),
  'não se marca à mão');


-- --- 4. A CORRENTE, e o cenario que a 0042 existe para proteger ------------

-- Bruno produziu (e o responsavel) e pede o aval interno. Ele NAO e
-- `criado_por` -- quem abriu foi a Ana.
select teste.cenario('Quem produziu pede o aval interno', :BRUNO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'interna', %L, 'pendente')$fmt$, :CARROSSEL, :BRUNO),
  'ok', 1);

-- ANTES DA 0042 ESTE CENARIO FALHARIA, e e o ponto do arquivo: a trava olhava
-- `criado_por`, que aqui e a Ana, e recusaria o Bruno com "So quem produziu o
-- post envia para aprovacao" -- o produtor barrado por nao ter aberto o
-- briefing.

update public.approval_rounds set status = 'aprovada', decidido_por = :DIEGO
 where content_type = 'post' and content_id = :CARROSSEL and escopo = 'interna';

select teste.recusa_com('O colaborador nao envia ao cliente', :BRUNO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :CARROSSEL, :BRUNO),
  'Enviar para o cliente');

-- VIRADO DO AVESSO NA 0060, e o cenario fica por isso. Ate ela o banco
-- recusava a gestao que tinha produzido; agora aceita, por decisao do
-- usuario -- "se a pessoa for Desenvolvedor, ou socio, ela pode enviar".
--
-- Se alguem reintroduzir a trava, este cenario falha e diz qual: e a mesma
-- forma dos tres que a 0029 deixou para tras quando a autoaprovacao saiu.
--
-- E repare no que ele NAO prova: que qualquer um envia. O cenario de cima --
-- o Bruno, colaborador -- continua recusado, e e ele que guarda a metade da
-- regra que ficou de pe.
update public.posts set responsavel_id = :DIEGO where id = :CARROSSEL;

select teste.cenario('A gestao envia inclusive o que ela mesma produziu', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :CARROSSEL, :DIEGO),
  'ok', 1);

-- E a rodada de cima precisa sair antes da proxima: o cenario seguinte insere
-- outra igual, e duas rodadas de cliente na mesma versao sao dois pedidos.
delete from public.approval_rounds
 where content_type = 'post' and content_id = :CARROSSEL and escopo = 'cliente';

-- E a gestao que NAO produziu envia.
update public.posts set responsavel_id = :BRUNO where id = :CARROSSEL;

select teste.cenario('A gestao que nao produziu envia', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :CARROSSEL, :DIEGO),
  'ok', 1);

-- ENVIAR E CARIMBAR, e o carimbo e consequencia e nao um segundo comando.
select teste.conferir('Enviar carimbou `enviado_em` sozinho',
  (select case when enviado_em is null then 'nao' else 'sim' end
     from public.posts where id = :CARROSSEL), 'sim');


-- --- 5. Video sem link nao sai da agencia ----------------------------------

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :VIDEO, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

-- O cliente abriria a tela para decidir sobre uma arte que nao existe -- e
-- decidiria, porque o botao de aprovar estaria la.
select teste.recusa_com('Video sem link nao vai ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :VIDEO, :DIEGO),
  'ainda não tem o link');

-- A DICA, E NAO SO A MENSAGEM. E o mesmo criterio de `tasks_sem_cancelada`:
-- `atualizarPost` concatena o `hint` do Postgres na tela, e uma trava com a
-- dica apagada passaria por uma checagem que so le a mensagem -- deixando a
-- pessoa sem saber o que fazer no lugar.
select teste.recusa_com_dica('E a recusa diz onde colar o link', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :VIDEO, :DIEGO),
  'Drive ou do YouTube');

update public.posts set video_url = 'https://drive.google.com/file/d/abc' where id = :VIDEO;

select teste.cenario('Com o link, vai', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :VIDEO, :DIEGO),
  'ok', 1);

-- Link quebrado digitado a mao e pior que campo vazio: alguem clica.
select teste.cenario('"ver com a Ana" nao e link de video', :ANA,
  format($fmt$update public.posts set video_url = 'ver com a Ana' where id = %L$fmt$,
    :VIDEO), 'recusa');


-- --- 6. Os slides do carrossel, e a capa -----------------------------------

insert into public.post_versions (post_id, arquivos, legenda)
values (:CARROSSEL, jsonb_build_array(
          jsonb_build_object('url', 'a/1.png', 'thumbnail_url', 'a/1t.png'),
          jsonb_build_object('url', 'a/2.png'),
          jsonb_build_object('url', 'a/3.png')),
        'Cinco dicas');

-- A CAPA SAI DO PRIMEIRO SLIDE. Sem esta linha do trigger, subir cinco slides
-- deixaria o card e o calendario sem imagem nenhuma -- e ninguem ligaria uma
-- coisa a outra.
select teste.conferir('A capa do post virou o primeiro slide',
  (select arte_url from public.posts where id = :CARROSSEL), 'a/1.png');

select teste.conferir('E a miniatura tambem',
  (select thumbnail_url from public.posts where id = :CARROSSEL), 'a/1t.png');

select teste.conferir('Os tres slides ficaram na versao',
  (select jsonb_array_length(arquivos)::text from public.post_versions
    where post_id = :CARROSSEL order by numero_versao desc limit 1), '3');

-- `arquivos` e LISTA, e o check existe porque um objeto solto ali passaria
-- pelo jsonb e estouraria na tela, no `map`.
select teste.cenario('Um objeto solto nao e lista de slides', :ANA,
  format($fmt$insert into public.post_versions (post_id, arquivos)
    values (%L, '{"url":"x.png"}'::jsonb)$fmt$, :CARROSSEL), 'recusa');


-- --- 7. Liberar avisa quem recebeu -----------------------------------------

select teste.cenario('A gestao libera o briefing para a Marina', :ANA,
  format($fmt$update public.posts set responsavel_id = %L where id = %L$fmt$,
    :MARINA, :BRIEFING), 'ok', 1);

select teste.conferir('A Marina foi avisada',
  (select count(*)::text from public.notifications
    where user_id = :MARINA and titulo like 'Briefing sem dono%'), '1');

-- `notificar()` NUNCA avisa quem causou o aviso, e por isso a gestao que
-- libera um post para si mesma nao recebe nada.
select teste.cenario('A Ana libera um post para ela mesma', :ANA,
  format($fmt$update public.posts set responsavel_id = %L where id = %L$fmt$,
    :ANA, :BRIEFING), 'ok', 1);

select teste.conferir('E nao se avisa',
  (select count(*)::text from public.notifications
    where user_id = :ANA and titulo like 'Briefing sem dono%'), '0');


-- --- 8. O cliente continua fora --------------------------------------------
--
-- A 0042 mexeu em quem escreve. Nada do que ela fez pode ter aberto uma porta
-- do lado de la, e estes tres cenarios sao a pergunta feita de novo.

select teste.cenario('O cliente nao ve o post em producao', :JOANA,
  format($fmt$select id from public.posts where id = %L$fmt$, :BRIEFING), 'ok', 0);

select teste.cenario('O cliente nao edita post', :JOANA,
  format($fmt$update public.posts set legenda = 'eu escrevi' where id = %L$fmt$,
    :CARROSSEL), 'recusa');

select teste.cenario('E nao se poe como responsavel de nada', :JOANA,
  format($fmt$update public.posts set responsavel_id = %L where id = %L$fmt$,
    :JOANA, :BRIEFING), 'recusa');


-- ===========================================================================
-- 0048 -- APAGAR UM ARQUIVO GRAVA UMA VERSAO
--
-- Decisao do usuario: poder apagar uma imagem errada e subir outra, "sempre
-- registrando no historico".
--
-- O QUE A 0048 CONSERTA e uma linha que estava CERTA e nao cobria um caso:
-- `arte_url = coalesce(capa, arte_url)` faz versao que nao mexeu em arquivo
-- nao apagar a arte -- e fazia tambem uma versao SEM arquivo nenhum nao
-- apagar. A remocao entrava no historico e nao aparecia na tela.
-- ===========================================================================

\set SOZINHO '''50580000-0000-0000-0000-000000000009'''

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          midia, criado_por, responsavel_id)
values (:SOZINHO, :VERDE, 'Arte que saiu errada', '2026-12-20', 'instagram',
        'imagem', :ANA, :BRUNO);

select teste.cenario('Sobe a arte', :BRUNO,
  format($fmt$insert into public.post_versions (post_id, arte_url, thumbnail_url, notas_mudanca)
    values (%L, 'a/errada.png', 'a/errada-t.png', 'Primeira arte')$fmt$, :SOZINHO),
  'ok', 1);

select teste.conferir('E ela virou a capa do post',
  (select arte_url from public.posts where id = :SOZINHO), 'a/errada.png');

-- `removeu_arquivos` E O SINAL, e nao o array vazio: `arquivos` e
-- `not null default '[]'`, entao vazio e o estado de TODA versao que so mexeu
-- na legenda. Foi o cenario "versao so de legenda nao apaga a arte", mais
-- abaixo, que derrubou a primeira tentativa desta migration.
select teste.cenario('Apaga a arte gravando uma versao nova', :BRUNO,
  format($fmt$insert into public.post_versions (post_id, removeu_arquivos, notas_mudanca)
    values (%L, true, 'Arte removida')$fmt$, :SOZINHO), 'ok', 1);

select teste.conferir('O post ficou sem capa',
  (select coalesce(arte_url, '(sem)') from public.posts where id = :SOZINHO), '(sem)');

select teste.conferir('E a miniatura tambem',
  (select coalesce(thumbnail_url, '(sem)') from public.posts where id = :SOZINHO), '(sem)');

-- O HISTORICO E O PONTO INTEIRO: a v1 continua mostrando a arte que saiu, e e
-- por isso que o arquivo nao e apagado do bucket junto.
select teste.conferir('Mas a versao 1 continua com ela',
  (select arte_url from public.post_versions
    where post_id = :SOZINHO and numero_versao = 1), 'a/errada.png');

select teste.conferir('E sao duas versoes, nao uma reescrita',
  (select count(*)::text from public.post_versions where post_id = :SOZINHO), '2');

select teste.cenario('E sobe a arte certa por cima', :BRUNO,
  format($fmt$insert into public.post_versions (post_id, arte_url, notas_mudanca)
    values (%L, 'a/certa.png', 'Arte nova')$fmt$, :SOZINHO), 'ok', 1);

select teste.conferir('A capa voltou, com a arte nova',
  (select arte_url from public.posts where id = :SOZINHO), 'a/certa.png');

-- O CENARIO QUE DERRUBOU A PRIMEIRA VERSAO DA 0048, e por isso ele fica aqui
-- em destaque. A razao de a 0042 ter posto o `coalesce` continua valendo: quem
-- grava so a legenda nao pode zerar a arte. Com o array vazio como sinal, este
-- `insert` -- que nao fala de arquivo nenhum -- apagava a capa.
select teste.cenario('Versao so de legenda nao apaga a arte', :BRUNO,
  format($fmt$insert into public.post_versions (post_id, legenda, notas_mudanca)
    values (%L, 'Só mexi no texto.', 'Ajuste de legenda')$fmt$, :SOZINHO), 'ok', 1);

select teste.conferir('E a arte continua de pe',
  (select arte_url from public.posts where id = :SOZINHO), 'a/certa.png');

-- --- Um slide sai do meio do carrossel ------------------------------------

\set CINCO '''50580000-0000-0000-0000-00000000000a'''

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          midia, criado_por, responsavel_id)
values (:CINCO, :VERDE, 'Carrossel com slide errado', '2026-12-22', 'instagram',
        'carrossel', :ANA, :BRUNO);

insert into public.post_versions (post_id, arquivos, notas_mudanca, criado_por)
values (:CINCO, jsonb_build_array(
          jsonb_build_object('url', 'c/1.png'),
          jsonb_build_object('url', 'c/2.png'),
          jsonb_build_object('url', 'c/3.png')), 'Tres slides', :BRUNO);

select teste.conferir('A capa e o primeiro slide',
  (select arte_url from public.posts where id = :CINCO), 'c/1.png');

-- REMOVER O PRIMEIRO promove o segundo a capa, e isso NAO e trava nova: e a
-- mesma linha que ja escolhia o primeiro slide desde a 0042.
select teste.cenario('Remove o primeiro slide', :BRUNO,
  format($fmt$insert into public.post_versions (post_id, arquivos, notas_mudanca)
    values (%L, jsonb_build_array(
             jsonb_build_object('url', 'c/2.png'),
             jsonb_build_object('url', 'c/3.png')), 'Slide 1 removido')$fmt$,
    :CINCO), 'ok', 1);

select teste.conferir('E o segundo virou a capa',
  (select arte_url from public.posts where id = :CINCO), 'c/2.png');

select teste.conferir('A versao anterior continua com os tres',
  (select jsonb_array_length(arquivos)::text from public.post_versions
    where post_id = :CINCO and numero_versao = 1), '3');
