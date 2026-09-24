\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

\set RASCUNHO '''50570000-0000-0000-0000-000000000001'''
\set ENVIADO  '''50570000-0000-0000-0000-000000000002'''
\set DA_OPTICA '''50570000-0000-0000-0000-000000000003'''

-- ===========================================================================
-- Sprint 12 -- Posts, versoes e comentarios
--
-- Uma pergunta domina o arquivo: O QUE O CLIENTE ALCANCA.
--
-- Metade dos criterios de aceite deste sprint e sobre o que ele NAO ve -- post
-- em producao, comentario interno, botao de reverter versao. Criterio assim e
-- o que mais passa batido, porque a tela "parece certa" para quem a abriu como
-- socio. Aqui cada um desses e um cenario rodando com o uid do cliente, contra
-- o Postgres, sem tela nenhuma no meio.
--
-- A outra metade e sobre o motor: 'post' ganhou regra na 0032, e ganhar regra
-- nao pode ter afrouxado a da etapa.
-- ===========================================================================

select teste.limpar();
delete from public.comments;
delete from public.post_versions;
delete from public.posts;


-- ---------------------------------------------------------------------------
-- A MONTAGEM
--
-- Bruno (colaborador) produz; Diego (desenvolvedor) valida e envia. E essa
-- separacao que permite provar a trava de "ninguem envia a propria entrega"
-- sem ela virar um cenario artificial.
-- ---------------------------------------------------------------------------
update public.clients set responsavel_atendimento_id = :MARINA where id = :VERDE;

insert into public.posts (id, client_id, tema, legenda, data_publicacao, horario,
                          plataforma, formato, criado_por)
values (:RASCUNHO, :VERDE, 'Bastidores da fabrica', 'Legenda em construcao',
        '2026-10-08', '18:30', 'instagram', 'feed', :BRUNO),
       (:ENVIADO, :VERDE, 'Promocao de outubro', 'Corre que acaba!',
        '2026-10-15', '12:00', 'instagram', 'carrossel', :BRUNO),
       (:DA_OPTICA, :OPTICA, 'Campanha de armacoes', null,
        '2026-10-20', null, 'facebook', 'feed', :BRUNO);

select teste.conferir('Post nasce em producao',
  (select status::text from public.posts where id = :ENVIADO), 'em_producao');

select teste.conferir('E nasce sem carimbo de envio',
  (select (enviado_em is null)::text from public.posts where id = :ENVIADO), 'true');


-- ---------------------------------------------------------------------------
-- 1. O POST EM PRODUCAO NAO EXISTE PARA O CLIENTE
--
-- Nem pela lista, nem pelo id na mao -- que e o caminho de quem recebeu o
-- endereco por engano, ou de quem chuta um uuid contra a API do Supabase com
-- a chave anon. A recusa e a mesma nos dois porque e a mesma policy.
-- ---------------------------------------------------------------------------
select teste.cenario('Joana nao ve o post em producao da propria empresa', :JOANA,
  format('select 1 from public.posts where id = %L', :RASCUNHO), 'recusa');

select teste.cenario('A equipe ve o post em producao', :DIEGO,
  format('select 1 from public.posts where id = %L', :RASCUNHO), 'ok', 1);

select teste.cenario('Joana nao lista nenhum post ainda', :JOANA,
  'select 1 from public.posts', 'recusa');


-- ---------------------------------------------------------------------------
-- 2. O CLIENTE NAO ESCREVE POST
--
-- Ele decide, e decidir passa pelo motor. Tres comandos, tres recusas: e a
-- diferenca entre "a tela nao tem o botao" e "o banco nao aceita".
-- ---------------------------------------------------------------------------
select teste.cenario('Joana nao cria post', :JOANA,
  format($fmt$insert into public.posts (client_id, tema, data_publicacao, plataforma)
    values (%L, 'Post que eu quero', '2026-10-30', 'instagram')$fmt$, :VERDE),
  'recusa');

select teste.cenario('Joana nao edita post', :JOANA,
  format($fmt$update public.posts set tema = 'Outro tema' where id = %L$fmt$, :ENVIADO),
  'recusa');

select teste.cenario('Joana nao apaga post', :JOANA,
  format($fmt$delete from public.posts where id = %L$fmt$, :ENVIADO),
  'recusa');


-- ---------------------------------------------------------------------------
-- 3. A RODADA INTERNA DO POST
-- ---------------------------------------------------------------------------
select teste.cenario('Marina nao manda para aprovacao o post que nao e dela', :MARINA,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'interna', %L)$fmt$, :ENVIADO, :MARINA),
  'recusa');

select teste.cenario('Bruno manda o proprio post para aprovacao interna', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'interna', %L)$fmt$, :ENVIADO, :BRUNO),
  'ok', 1);

-- A 0029 vale para post pela mesma razao: colaborador nao decide nada.
select teste.cenario('Bruno nao aprova a rodada interna que ele abriu', :BRUNO,
  format($fmt$update public.approval_rounds set status = 'aprovada'
     where content_type = 'post' and content_id = %L and escopo = 'interna'$fmt$, :ENVIADO),
  'recusa');

select teste.cenario('Diego aprova a rodada interna', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where content_type = 'post' and content_id = %L and escopo = 'interna'$fmt$, :DIEGO, :ENVIADO),
  'ok', 1);

select teste.cenario('Joana nao enxerga a rodada interna', :JOANA,
  format($fmt$select 1 from public.approval_rounds where content_type = 'post' and content_id = %L$fmt$, :ENVIADO),
  'recusa');


-- ---------------------------------------------------------------------------
-- 4. ENVIAR AO CLIENTE
--
-- Tres travas, e as tres sao as mesmas da etapa de demanda -- de proposito:
-- quem aprende o fluxo num modulo nao precisa reaprender no outro.
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno nao envia ao cliente, mesmo sendo dele o post', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'cliente', %L)$fmt$, :ENVIADO, :BRUNO),
  'recusa');

select teste.recusa_com('E a recusa diz que enviar e do Desenvolvedor', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'cliente', %L)$fmt$, :ENVIADO, :BRUNO),
  'Enviar para o cliente é do Desenvolvedor');

select teste.recusa_com('Sem aval interno, o post nao vai ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'cliente', %L)$fmt$, :RASCUNHO, :DIEGO),
  'ainda não passou pela aprovação interna');

select teste.cenario('Diego envia ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 1, 'cliente', %L)$fmt$, :ENVIADO, :DIEGO),
  'ok', 1);

-- O CARIMBO E CONSEQUENCIA DA RODADA, e nao um segundo comando. Se algum dia
-- alguem separar os dois, este cenario e o que avisa.
select teste.conferir('Enviar carimbou o post',
  (select (enviado_em is not null)::text from public.posts where id = :ENVIADO), 'true');

select teste.conferir('E o status virou em aprovacao',
  (select status::text from public.posts where id = :ENVIADO), 'em_aprovacao');


-- ---------------------------------------------------------------------------
-- 5. AGORA SIM O CLIENTE VE -- E SO O DELE
-- ---------------------------------------------------------------------------
select teste.cenario('Joana ve o post enviado', :JOANA,
  format('select 1 from public.posts where id = %L', :ENVIADO), 'ok', 1);

select teste.cenario('E continua sem ver o que esta em producao', :JOANA,
  format('select 1 from public.posts where id = %L', :RASCUNHO), 'recusa');

select teste.cenario('Otto nao ve o post da Mundo Verde', :OTTO,
  format('select 1 from public.posts where id = %L', :ENVIADO), 'recusa');

select teste.cenario('Joana enxerga exatamente 1 post', :JOANA,
  'select 1 from public.posts', 'ok', 1);


-- ---------------------------------------------------------------------------
-- 6. A DECISAO DO CLIENTE
--
-- Todas por `decidir_rodada_do_cliente`. Nenhum update direto em `posts`
-- existe no caminho do cliente -- ele nem tem policy para isso (cenario 2).
-- ---------------------------------------------------------------------------
select teste.recusa_com('Rejeitar sem motivo e recusado', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'post' and content_id = %L and escopo = 'cliente'),
    'rejeitada', null)$fmt$, :ENVIADO),
  'Diga por que o material foi recusado');

select teste.recusa_com('Pedir ajustes sem motivo tambem', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'post' and content_id = %L and escopo = 'cliente'),
    'ajustes_solicitados', '   ')$fmt$, :ENVIADO),
  'Diga o que precisa ser ajustado');

-- SAO DUAS PAREDES, E ELAS RECUSAM POR MOTIVOS DIFERENTES.
--
-- A primeira e a RLS: Otto nem enxerga a rodada. Escrevi este cenario com um
-- subselect buscando o id, e ele reprovou com "Rodada nao encontrada" -- a
-- resposta certa pelo caminho errado, porque a funcao nunca chegou a decidir
-- nada. A segunda parede e a da propria funcao, e para prova-la o id precisa
-- vir de fora, como viria de alguem que o anotou.
select teste.cenario('Otto nem enxerga a rodada do post alheio', :OTTO,
  format($fmt$select 1 from public.approval_rounds where content_type = 'post' and content_id = %L$fmt$, :ENVIADO),
  'recusa');

select id as rodada_do_envio from public.approval_rounds
 where content_type = 'post' and content_id = :ENVIADO and escopo = 'cliente' and numero_rodada = 1
\gset

select teste.recusa_com('E com o id na mao a funcao recusa do mesmo jeito', :OTTO,
  format($fmt$select public.decidir_rodada_do_cliente(%L, 'aprovada', null)$fmt$, :'rodada_do_envio'),
  'Sem acesso a esta aprovação');

select teste.cenario('Joana pede ajustes, com motivo', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'post' and content_id = %L and escopo = 'cliente'),
    'ajustes_solicitados', 'O logo ficou pequeno demais no terceiro card.')$fmt$, :ENVIADO),
  'ok');

select teste.conferir('O post foi para ajustes',
  (select status::text from public.posts where id = :ENVIADO), 'ajustes');

select teste.conferir('A rodada guardou quem decidiu',
  (select (decidido_por = :JOANA)::text from public.approval_rounds
    where content_type = 'post' and content_id = :ENVIADO and escopo = 'cliente'), 'true');

select teste.conferir('E o pedido virou comentario publico da rodada',
  (select count(*)::text from public.comments
    where content_type = 'post' and content_id = :ENVIADO
      and interno = false and approval_round_id is not null), '1');

select teste.conferir('A equipe foi avisada pelo sino',
  (select count(*)::text from public.notifications
    where user_id = :MARINA and tipo = 'aprovacao'), '1');

select teste.recusa_com('Rodada decidida nao se redecide', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'post' and content_id = %L and escopo = 'cliente'),
    'aprovada', null)$fmt$, :ENVIADO),
  'já foi decidida');


-- ---------------------------------------------------------------------------
-- 7. A SEGUNDA RODADA, E A APROVACAO
--
-- Rodada fechada nunca e reescrita: o ciclo de ajuste cria a de numero 2.
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno abre a rodada interna 2', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 2, 'interna', %L)$fmt$, :ENVIADO, :BRUNO),
  'ok', 1);

select teste.cenario('Diego aprova a interna 2', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where content_type = 'post' and content_id = %L and escopo = 'interna' and numero_rodada = 2$fmt$,
    :DIEGO, :ENVIADO),
  'ok', 1);

select teste.cenario('Diego envia a versao 2 ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('post', %L, 2, 'cliente', %L)$fmt$, :ENVIADO, :DIEGO),
  'ok', 1);

select teste.cenario('Joana aprova', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'post' and content_id = %L
       and escopo = 'cliente' and numero_rodada = 2),
    'aprovada', 'Perfeito assim.')$fmt$, :ENVIADO),
  'ok');

select teste.conferir('O post esta aprovado',
  (select status::text from public.posts where id = :ENVIADO), 'aprovado');

select teste.conferir('E a rodada 1 continua dizendo ajustes',
  (select status::text from public.approval_rounds
    where content_type = 'post' and content_id = :ENVIADO and escopo = 'cliente' and numero_rodada = 1),
  'ajustes_solicitados');


-- ---------------------------------------------------------------------------
-- 8. O COMENTARIO INTERNO NAO ATRAVESSA A PAREDE
--
-- Este e o cenario que a tela nunca provaria: o cliente nao tem onde clicar
-- para ver um comentario interno. O que se testa aqui e a chamada crua.
-- ---------------------------------------------------------------------------
select teste.cenario('Diego comenta internamente', :DIEGO,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto, interno)
    values ('post', %L, %L, 'Cliente pediu desconto de novo. Segurar o preco.', true)$fmt$,
    :ENVIADO, :DIEGO),
  'ok', 1);

select teste.cenario('Joana nao ve o comentario interno', :JOANA,
  format($fmt$select 1 from public.comments where content_type = 'post' and content_id = %L and interno$fmt$, :ENVIADO),
  'recusa');

select teste.conferir('A equipe ve os dois comentarios',
  (select count(*)::text from public.comments where content_type = 'post' and content_id = :ENVIADO), '3');

-- O CLIENTE TENTANDO SE ESCONDER, que e a outra ponta da mesma regra: policy
-- nao limita coluna, e sem o trigger este insert passaria com interno = true.
select teste.cenario('Joana comenta pedindo interno = true', :JOANA,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto, interno)
    values ('post', %L, %L, 'Isto deveria ser interno', true)$fmt$, :ENVIADO, :JOANA),
  'ok', 1);

select teste.conferir('E o banco gravou publico assim mesmo',
  (select interno::text from public.comments where texto = 'Isto deveria ser interno'), 'false');

-- E ASSINANDO COM O NOME DE OUTRA PESSOA.
select teste.cenario('Joana comenta assinando como Diego', :JOANA,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto)
    values ('post', %L, %L, 'Comentario com assinatura trocada')$fmt$, :ENVIADO, :DIEGO),
  'ok', 1);

select teste.conferir('E a assinatura voltou a ser dela',
  (select (autor_id = :JOANA)::text from public.comments where texto = 'Comentario com assinatura trocada'),
  'true');

select teste.cenario('Otto nao comenta no post de outra empresa', :OTTO,
  format($fmt$insert into public.comments (content_type, content_id, autor_id, texto)
    values ('post', %L, %L, 'Oi')$fmt$, :ENVIADO, :OTTO),
  'recusa');

-- Comentario e registro: nao se reescreve, como a rodada fechada.
select teste.cenario('Nem a gestao reescreve o que o cliente disse', :ANA,
  format($fmt$update public.comments set texto = 'outra coisa'
     where content_type = 'post' and content_id = %L$fmt$, :ENVIADO),
  'recusa');


-- ---------------------------------------------------------------------------
-- 9. A THREAD TEM UM NIVEL
--
-- Resposta de resposta vira resposta da raiz. O banco corrige em vez de
-- recusar: o erro seria sobre uma estrutura que quem escreveu nem viu.
-- ---------------------------------------------------------------------------
insert into public.comments (id, content_type, content_id, autor_id, texto)
values ('60570000-0000-0000-0000-000000000001', 'post', :ENVIADO, :DIEGO, 'Raiz');

insert into public.comments (id, content_type, content_id, autor_id, texto, resposta_a)
values ('60570000-0000-0000-0000-000000000002', 'post', :ENVIADO, :DIEGO, 'Resposta',
        '60570000-0000-0000-0000-000000000001');

insert into public.comments (id, content_type, content_id, autor_id, texto, resposta_a)
values ('60570000-0000-0000-0000-000000000003', 'post', :ENVIADO, :DIEGO, 'Resposta da resposta',
        '60570000-0000-0000-0000-000000000002');

select teste.conferir('A neta virou filha da raiz',
  (select (resposta_a = '60570000-0000-0000-0000-000000000001')::text
     from public.comments where id = '60570000-0000-0000-0000-000000000003'),
  'true');


-- ---------------------------------------------------------------------------
-- 10. VERSOES
--
-- O numero sai do banco, a arte do post acompanha, e o cliente le mas nao
-- escreve -- e o "nao escreve" e o criterio de aceite que diz que nao existe
-- botao de reverter no portal. Aqui ele e provado sem tela.
-- ---------------------------------------------------------------------------
insert into public.post_versions (post_id, numero_versao, arte_url, legenda, notas_mudanca, criado_por)
values (:ENVIADO, 999, 'https://exemplo/v1.png', 'Corre que acaba!', 'Primeira arte', :BRUNO);

select teste.conferir('O numero pedido foi ignorado: a versao e a 1',
  (select numero_versao::text from public.post_versions where post_id = :ENVIADO order by numero_versao limit 1),
  '1');

insert into public.post_versions (post_id, numero_versao, arte_url, legenda, notas_mudanca, criado_por)
values (:ENVIADO, 1, 'https://exemplo/v2.png', 'Corre que acaba mesmo!', 'Logo maior no card 3', :BRUNO);

select teste.conferir('A segunda virou 2 sem bater no unique',
  (select max(numero_versao)::text from public.post_versions where post_id = :ENVIADO), '2');

select teste.conferir('E o post passou a apontar para a arte nova',
  (select arte_url from public.posts where id = :ENVIADO), 'https://exemplo/v2.png');

select teste.conferir('Com a versao atual em 2',
  (select versao_atual::text from public.posts where id = :ENVIADO), '2');

select teste.cenario('Joana le o historico do post dela', :JOANA,
  format('select 1 from public.post_versions where post_id = %L', :ENVIADO), 'ok', 2);

select teste.cenario('Joana nao grava versao -- nao existe reverter no portal', :JOANA,
  format($fmt$insert into public.post_versions (post_id, numero_versao, arte_url, criado_por)
    values (%L, 3, 'https://exemplo/minha.png', %L)$fmt$, :ENVIADO, :JOANA),
  'recusa');

select teste.cenario('Nem apaga', :JOANA,
  format('delete from public.post_versions where post_id = %L', :ENVIADO), 'recusa');

insert into public.post_versions (post_id, numero_versao, arte_url, criado_por)
values (:RASCUNHO, 1, 'https://exemplo/rascunho.png', :BRUNO);

select teste.cenario('E nao alcanca o historico de um post nao enviado', :JOANA,
  format('select 1 from public.post_versions where post_id = %L', :RASCUNHO), 'recusa');


-- ---------------------------------------------------------------------------
-- 11. O QUE O POST NAO PODE TER AFROUXADO
--
-- 'rejeitada' e desfecho de post. A etapa de demanda continua com dois, e a
-- recusa diz o que fazer no lugar.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, criado_por, data_inicio, link_entrega)
values ('70570000-0000-0000-0000-000000000001', :VERDE, 'Demanda do Sprint 12', :DIEGO,
        '2026-10-01', 'https://drive.google.com/drive/folders/s12');

insert into public.subtasks (id, task_id, titulo, ordem, responsavel_id, requer_aprovacao, tipo_aprovacao)
values ('70570000-0000-0000-0000-000000000002', '70570000-0000-0000-0000-000000000001',
        'Etapa do Sprint 12', 1, :BRUNO, true, 'cliente');

-- A rodada de cliente da etapa vai pelo caminho de verdade, e nao por um
-- insert de dono: `validar_nova_rodada` roda em qualquer escrita, e montar a
-- linha por fora provaria a trava contra uma linha que o produto nao produz.
select teste.cenario('Bruno abre a interna da etapa', :BRUNO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('subtask', '70570000-0000-0000-0000-000000000002', 1, 'interna', %L)$fmt$, :BRUNO),
  'ok', 1);

select teste.cenario('Diego aprova a interna da etapa', :DIEGO,
  format($fmt$update public.approval_rounds set status = 'aprovada', decidido_por = %L, decidido_em = now()
     where content_type = 'subtask' and content_id = '70570000-0000-0000-0000-000000000002'
       and escopo = 'interna'$fmt$, :DIEGO),
  'ok', 1);

select teste.cenario('Diego envia a etapa ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('subtask', '70570000-0000-0000-0000-000000000002', 1, 'cliente', %L)$fmt$, :DIEGO),
  'ok', 1);

select teste.recusa_com('Etapa de demanda nao e recusada, e a recusa ensina o caminho', :JOANA,
  $fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds where content_type = 'subtask'
       and content_id = '70570000-0000-0000-0000-000000000002' and escopo = 'cliente'),
    'rejeitada', 'Nao gostei')$fmt$,
  'Etapa de demanda não é recusada');

-- 'deliverable' ganhou regra na 0033, entao quem prova a frase aqui tambem
-- passou a ser um tipo inventado. As regras do entregavel estao em
-- 16_campanhas.sql.
select teste.recusa_com('E tipo sem regra continua recusado', :DIEGO,
  format($fmt$insert into public.approval_rounds (content_type, content_id, numero_rodada, escopo, solicitado_por)
    values ('campanha_inteira', %L, 1, 'interna', %L)$fmt$, :ENVIADO, :DIEGO),
  'ainda não tem regra');


-- ---------------------------------------------------------------------------
-- 12. APAGAR O POST LEVA JUNTO O QUE APONTAVA PARA ELE
--
-- `content_id` nao tem chave estrangeira -- ela aponta para tabelas diferentes
-- conforme o tipo --, entao o cascade e trigger. Sem ele a fila de aprovacoes
-- tentaria abrir um post que nao existe mais.
-- ---------------------------------------------------------------------------
delete from public.posts where id = :DA_OPTICA;

select teste.conferir('Rodadas do post apagado sumiram',
  (select count(*)::text from public.approval_rounds where content_type = 'post' and content_id = :DA_OPTICA), '0');

delete from public.posts where id = :ENVIADO;

select teste.conferir('Rodadas do post principal sumiram',
  (select count(*)::text from public.approval_rounds where content_type = 'post' and content_id = :ENVIADO), '0');

select teste.conferir('E os comentarios tambem',
  (select count(*)::text from public.comments where content_type = 'post' and content_id = :ENVIADO), '0');

select teste.conferir('As versoes foram pela chave estrangeira',
  (select count(*)::text from public.post_versions where post_id = :ENVIADO), '0');
