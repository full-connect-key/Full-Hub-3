\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

\set CORRENTE '''50590000-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 0045 -- A CORRENTE DE ETAPAS DO POST
--
-- Decisao do usuario: Pauta (Social Media), Conteudo (Redator), Layout
-- (Diretor de Arte = funcao `Design`), Envio, e -- se o cliente pedir --
-- Ajustes (Design), antes de Programar (Social Media).
--
-- O CENARIO QUE JUSTIFICA O ARQUIVO INTEIRO e "o cliente pede ajustes e a
-- etapa nasce". Ele atravessa as duas travas que a 0045 criou: a etapa Envio
-- nao se marca a mao, e a corrente e em ordem. As duas rodam com o
-- `auth.uid()` DO CLIENTE, porque `security definer` nao troca quem esta
-- logado -- e sem a saida do GUC elas recusariam a unica acao que o cliente
-- tem no portal.
-- ===========================================================================

insert into public.posts (id, client_id, tema, data_publicacao, plataforma,
                          midia, criado_por, responsavel_id)
values (:CORRENTE, :VERDE, 'Corrente completa', '2026-11-25', 'instagram',
        'imagem', :ANA, :BRUNO);


-- --- 1. A corrente nasce com o post ----------------------------------------
--
-- E O GATILHO QUE MONTA, e nao a tela. Este post foi inserido por um `insert`
-- cru, como faz o seed -- e nasceu com as cinco etapas do mesmo jeito. Uma
-- tela que monta a corrente e uma tela que esquece de monta-la.

select teste.conferir('O post nasceu com cinco etapas',
  (select count(*)::text from public.post_etapas where post_id = :CORRENTE), '5');

select teste.conferir('E na ordem que o usuario ditou',
  (select string_agg(nome, ' > ' order by ordem) from public.post_etapas
    where post_id = :CORRENTE),
  'Pauta > Conteúdo > Layout > Envio > Programar');

select teste.conferir('Cada uma com a funcao dela',
  (select string_agg(funcao::text, ', ' order by ordem) from public.post_etapas
    where post_id = :CORRENTE),
  'Social Media, Redator, Design, Gestao, Social Media');

-- A ORDEM TEM ESPACO ENTRE OS NUMEROS, e nao e enfeite: a etapa de Ajustes
-- nasce entre Envio e Programar, e com 1,2,3,4,5 ela obrigaria a renumerar as
-- seguintes -- um update em cascata por causa de um pedido do cliente.
select teste.conferir('Com folga entre os numeros',
  (select string_agg(ordem::text, ',' order by ordem) from public.post_etapas
    where post_id = :CORRENTE), '10,20,30,40,50');

-- "AJUSTES" NAO NASCE COM O POST. Ela nao e uma etapa que todo post percorre:
-- e a resposta a um pedido. Uma etapa de Ajustes parada em toda corrente diria
-- que todo post vai voltar.
select teste.conferir('E nenhuma etapa de Ajustes ainda',
  (select count(*)::text from public.post_etapas
    where post_id = :CORRENTE and nome like 'Ajustes%'), '0');


-- --- 2. Abrir o mes distribui a corrente por funcao ------------------------
--
-- UMA PESSOA POR FUNCAO e nao uma por etapa, decisao do usuario: a Pauta e o
-- Programar do mesmo post sao da mesma social media.
--
-- A Carla e Atendimento e nao Redatora, e entra como Redator de proposito: o
-- mapa diz QUEM FAZ ESTA ETAPA, e a funcao diz O QUE A ETAPA E. Cobrar que a
-- pessoa tenha a funcao viraria uma trava que impede a agencia pequena de se
-- arranjar num dia de aperto.

select teste.cenario('A gestao abre dois posts distribuindo a corrente', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-01', '{"instagram": 2}'::jsonb, null,
    jsonb_build_object('Social Media', %L::text, 'Redator', %L::text, 'Design', %L::text))$fmt$,
    :VERDE, :MARINA, :CARLA, :BRUNO), 'ok', 1);

select teste.conferir('A Pauta e o Programar sairam na mesma social media',
  (select count(*)::text from public.post_etapas e
    join public.posts p on p.id = e.post_id
   where p.tema like '%Janeiro/2027' and e.funcao = 'Social Media'
     and e.responsavel_id = :MARINA), '4');

select teste.conferir('O Conteudo saiu na Carla',
  (select count(*)::text from public.post_etapas e
    join public.posts p on p.id = e.post_id
   where p.tema like '%Janeiro/2027' and e.nome = 'Conteúdo'
     and e.responsavel_id = :CARLA), '2');

-- O ENVIO FICA SEM DONO, e e de proposito: a funcao dele e `Gestao`, e o mapa
-- nao traz `Gestao`. Enviar ao cliente e da gestao desde a 0007 -- quem envia
-- e quem estiver de plantao, nao um nome escolhido no comeco do mes.
select teste.conferir('E o Envio nao tem dono',
  (select count(*)::text from public.post_etapas e
    join public.posts p on p.id = e.post_id
   where p.tema like '%Janeiro/2027' and e.nome = 'Envio'
     and e.responsavel_id is null), '2');

-- E SAO CINCO E NAO DEZ. A corrente ja nasceu pelo gatilho, e `abrir_mes` faz
-- `update` e nao um segundo `insert` -- duas montagens dariam dez etapas.
select teste.conferir('Cinco etapas por post, e nao dez',
  (select count(*)::text from public.post_etapas e
    join public.posts p on p.id = e.post_id
   where p.tema like '%Janeiro/2027'), '10');

select teste.conferir('A Marina foi avisada das etapas dela',
  (select case when count(*) >= 1 then 'sim' else 'nao' end
     from public.notifications where user_id = :MARINA and tipo = 'task'), 'sim');


-- --- 3. A corrente e uma corrente ------------------------------------------

update public.post_etapas set responsavel_id = :MARINA
 where post_id = :CORRENTE and nome in ('Pauta', 'Programar');
update public.post_etapas set responsavel_id = :CARLA
 where post_id = :CORRENTE and nome = 'Conteúdo';
update public.post_etapas set responsavel_id = :BRUNO
 where post_id = :CORRENTE and nome = 'Layout';

-- O redator escrevendo antes de a pauta existir escreve sobre o que achou.
select teste.recusa_com('O Conteudo nao comeca antes da Pauta', :CARLA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE),
  'vem depois de Pauta');

-- A RECUSA NOMEIA O QUE FALTA, E TODAS. "Etapa bloqueada" manda a pessoa
-- procurar; dizer quais ja diz a quem perguntar.
select teste.recusa_com('E o Layout diz as duas que faltam', :BRUNO,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Layout'$fmt$, :CORRENTE),
  'vem depois de Pauta, Conteúdo');

select teste.cenario('A Pauta comeca, porque e a primeira', :MARINA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Pauta'$fmt$, :CORRENTE), 'ok', 1);

select teste.cenario('E se conclui', :MARINA,
  format($fmt$update public.post_etapas set status = 'concluida'
     where post_id = %L and nome = 'Pauta'$fmt$, :CORRENTE), 'ok', 1);

select teste.conferir('Concluir carimbou a data sozinho',
  (select case when concluida_em is null then 'nao' else 'sim' end
     from public.post_etapas where post_id = :CORRENTE and nome = 'Pauta'), 'sim');

select teste.cenario('Agora o Conteudo comeca', :CARLA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE), 'ok', 1);


-- --- 4. Numa etapa que e sua, o que muda e o andamento ---------------------
--
-- POLICY NAO LIMITA COLUNA: as quatro passam pela policy de update (a etapa e
-- dela) e morrem no trigger.

select teste.recusa_com('A Carla nao passa a etapa dela para outra pessoa', :CARLA,
  format($fmt$update public.post_etapas set responsavel_id = %L
     where post_id = %L and nome = 'Conteúdo'$fmt$, :BRUNO, :CORRENTE),
  'o resto é da gestão');

select teste.recusa_com('Nem renomeia a etapa', :CARLA,
  format($fmt$update public.post_etapas set nome = 'Texto'
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE),
  'o resto é da gestão');

select teste.recusa_com('Nem muda a ordem dela na corrente', :CARLA,
  format($fmt$update public.post_etapas set ordem = 5
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE),
  'o resto é da gestão');

select teste.cenario('E a gestao muda tudo isso', :ANA,
  format($fmt$update public.post_etapas set prazo = '2026-11-20'
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE), 'ok', 1);

select teste.cenario('O colaborador nao apaga etapa', :CARLA,
  format($fmt$delete from public.post_etapas
     where post_id = %L and nome = 'Conteúdo'$fmt$, :CORRENTE), 'ok', 0);


-- --- 5. O Envio nao se marca a mao, NEM PELA GESTAO ------------------------
--
-- Mesma razao de `posts.enviado_em` desde a 0032: marcar a etapa afirmaria que
-- o post foi ao cliente sem nada ter saido da agencia.

select teste.recusa_com('Nem a socia marca o Envio a mao', :ANA,
  format($fmt$update public.post_etapas set status = 'concluida'
     where post_id = %L and nome = 'Envio'$fmt$, :CORRENTE),
  'não se marca à mão');

select teste.recusa_com('E a recusa diz por onde e', :ANA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Envio'$fmt$, :CORRENTE),
  'não se marca à mão');


-- --- 6. O Envio acompanha a rodada do cliente -----------------------------

update public.post_etapas set status = 'concluida'
 where post_id = :CORRENTE and nome in ('Conteúdo', 'Layout');

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :CORRENTE, 1, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('A gestao envia ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 1, 'cliente', %L, 'pendente')$fmt$, :CORRENTE, :DIEGO),
  'ok', 1);

select teste.conferir('O Envio entrou em curso sozinho',
  (select status::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Envio'), 'enviada_aprovacao');


-- --- 7. O CLIENTE PEDE AJUSTES, E A ETAPA NASCE ---------------------------
--
-- O cenario que justifica o arquivo. Sem a saida do GUC em
-- `post_etapas_regras`, este `select` recusaria com "o Envio nao se marca a
-- mao" -- e o cliente levaria um erro de banco clicando no unico botao que ele
-- tem. A trava nova quebrando a acao mais antiga do portal.

select teste.cenario('A Joana pede ajustes', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
      order by numero_rodada desc limit 1),
    'ajustes_solicitados', 'O logo ficou pequeno no rodape.')$fmt$, :CORRENTE),
  'ok', 1);

select teste.conferir('Nasceu uma etapa de Ajustes',
  (select count(*)::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Ajustes'), '1');

-- QUEM FEZ O LAYOUT FAZ O AJUSTE. Etapa sem dono nao aparece no "Minhas
-- Tasks" de ninguem, e um pedido do cliente e a ultima coisa do produto que
-- pode ficar sem dono.
select teste.conferir('E ela caiu em quem fez o Layout',
  (select responsavel_id::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Ajustes'),
  '44444444-4444-4444-4444-444444444444');

select teste.conferir('Na funcao Design',
  (select funcao::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Ajustes'), 'Design');

-- ENTRE O ENVIO E O PROGRAMAR, e nao no fim: programar um post que o cliente
-- pediu para mudar e programar a versao que ele recusou.
select teste.conferir('Entre o Envio e o Programar',
  (select string_agg(nome, ' > ' order by ordem) from public.post_etapas
    where post_id = :CORRENTE and ordem >= 40),
  'Envio > Ajustes > Programar');

select teste.conferir('E o Envio voltou para ajustes',
  (select status::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Envio'), 'em_ajustes');

-- O CENARIO QUE A IMAGEM DO PROTOTIPO ENCONTROU, e que nenhuma das duas
-- travas sozinha mostrava: a etapa de Ajustes nasce DEPOIS do Envio, e o Envio
-- fica em `em_ajustes` -- nunca `concluida` enquanto o ajuste nao for feito.
-- Com a regra da corrente lendo so "concluida", comecar o Ajustes era recusado
-- com "vem depois de Envio", e o pedido do cliente criava uma etapa que
-- ninguem conseguia pegar. Um abraco.
select teste.cenario('E o Bruno CONSEGUE comecar o ajuste', :BRUNO,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Ajustes'$fmt$, :CORRENTE), 'ok', 1);

-- E O PROGRAMAR CONTINUA TRAVADO, que e a metade que nao pode afrouxar junto:
-- ninguem programa o que o cliente nao aprovou. Enquanto o Ajustes nao fecha,
-- ele e o bloqueio; depois, o Envio volta a `enviada_aprovacao` e bloqueia de
-- novo. So a aprovacao o libera.
select teste.recusa_com('Mas o Programar nao', :MARINA,
  format($fmt$update public.post_etapas set status = 'em_andamento'
     where post_id = %L and nome = 'Programar'$fmt$, :CORRENTE),
  'vem depois de Ajustes');

select teste.conferir('O Bruno foi avisado do pedido',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and titulo like 'O cliente pediu ajustes%'), '1');

-- E O GUC DESLIGA ANTES DE A FUNCAO DEVOLVER. Se ele ficasse ligado, a mesma
-- transacao passaria pelas travas caladas -- a saida de emergencia virando
-- porta destrancada. Numa transacao nova ela esta de pe outra vez.
select teste.recusa_com('E a trava do Envio continua de pe depois disso', :ANA,
  format($fmt$update public.post_etapas set status = 'concluida'
     where post_id = %L and nome = 'Envio'$fmt$, :CORRENTE),
  'não se marca à mão');


-- --- 8. O segundo pedido nao reescreve o primeiro -------------------------
--
-- Mesma razao pela qual rodada fechada nunca e reescrita (0007): sao dois
-- pedidos, com dois motivos, e reaproveitar a linha apagaria o primeiro.

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :CORRENTE, 2, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('Segunda volta ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 2, 'cliente', %L, 'pendente')$fmt$, :CORRENTE, :DIEGO),
  'ok', 1);

select teste.cenario('E a Joana pede ajustes de novo', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
        and numero_rodada = 2),
    'ajustes_solicitados', 'Agora a cor do fundo.')$fmt$, :CORRENTE),
  'ok', 1);

select teste.conferir('Sao duas etapas de ajuste, numeradas',
  (select string_agg(nome, ' > ' order by ordem) from public.post_etapas
    where post_id = :CORRENTE and nome like 'Ajustes%'), 'Ajustes > Ajustes 2');

select teste.conferir('E as duas continuam antes do Programar',
  (select count(*)::text from public.post_etapas
    where post_id = :CORRENTE and nome like 'Ajustes%' and ordem < 50), '2');


-- --- 9. Aprovar fecha o Envio; recusar NAO abre ajuste -------------------

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
values ('post', :CORRENTE, 3, 'interna', :BRUNO, 'aprovada', :DIEGO);

select teste.cenario('Terceira volta, e agora ela aprova', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    values ('post', %L, 3, 'cliente', %L, 'pendente')$fmt$, :CORRENTE, :DIEGO),
  'ok', 1);

select teste.cenario('A Joana aprova', :JOANA,
  format($fmt$select public.decidir_rodada_do_cliente(
    (select id from public.approval_rounds
      where content_type = 'post' and content_id = %L and escopo = 'cliente'
        and numero_rodada = 3),
    'aprovada', 'Ficou ótimo.')$fmt$, :CORRENTE),
  'ok', 1);

select teste.conferir('O Envio fechou sozinho',
  (select status::text from public.post_etapas
    where post_id = :CORRENTE and nome = 'Envio'), 'concluida');

select teste.conferir('E nao nasceu uma terceira etapa de ajuste',
  (select count(*)::text from public.post_etapas
    where post_id = :CORRENTE and nome like 'Ajustes%'), '2');

-- POST RECUSADO NAO GANHA ETAPA DE AJUSTES, e e a distincao da 0032: rejeitar
-- diz *nao*, pedir ajustes diz *mude isto e volte*. Criar a etapa nos dois
-- casos afirmaria que um post recusado e para refazer.
update public.posts set status = 'rejeitado' where id = :CORRENTE;

select teste.conferir('E recusar nao cria etapa nenhuma',
  (select count(*)::text from public.post_etapas
    where post_id = :CORRENTE and nome like 'Ajustes%'), '2');


-- --- 10. O cliente nao enxerga a corrente --------------------------------
--
-- A corrente e conversa interna: ele decide sobre o material, nao acompanha
-- quem da casa esta com ele na mao. E a trava e a AUSENCIA de policy para ele
-- -- nao um filtro na consulta.

select teste.cenario('O cliente nao ve etapa de post nenhuma', :JOANA,
  format($fmt$select id from public.post_etapas where post_id = %L$fmt$, :CORRENTE),
  'ok', 0);

select teste.cenario('Nem do proprio post que ele aprovou', :JOANA,
  $fmt$select id from public.post_etapas$fmt$, 'ok', 0);

select teste.cenario('E nao escreve em nenhuma', :JOANA,
  format($fmt$update public.post_etapas set status = 'concluida'
     where post_id = %L$fmt$, :CORRENTE), 'ok', 0);

select teste.cenario('Nem cria uma', :JOANA,
  format($fmt$insert into public.post_etapas (post_id, ordem, nome, funcao)
    values (%L, 99, 'Minha etapa', 'Design')$fmt$, :CORRENTE), 'recusa');


-- --- 11. Apagar o post apaga a corrente ---------------------------------
--
-- `on delete cascade` e nao trigger, porque aqui a chave estrangeira existe --
-- ao contrario de `approval_rounds.content_id`, que aponta para tabelas
-- diferentes conforme o tipo e por isso precisou do gatilho da 0030.

select teste.cenario('A socia apaga o post', :ANA,
  format($fmt$delete from public.posts where id = %L$fmt$, :CORRENTE), 'ok', 1);

select teste.conferir('E a corrente foi com ele',
  (select count(*)::text from public.post_etapas where post_id = :CORRENTE), '0');
