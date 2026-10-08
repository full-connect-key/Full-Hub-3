-- ===========================================================================
-- 41 - O MES DE SOCIAL E A DEMANDA DELE SAO UMA COISA SO (migration 0086)
--
-- Decisao do usuario: *"se eu apago a demanda, o social deve ser deletado em
-- todos os locais. Se eu apago o social, a demanda deve ser deletada."*
--
-- O VINCULO SE DESFAZIA EM SILENCIO ANTES DISTO, e e o cenario que abre este
-- arquivo: `posts.subtask_id` e `on delete set null`, entao apagar a demanda
-- apagava as subtarefas e deixava os POSTS ORFAOS -- no Social Media, no
-- portal do cliente, e sem mes nenhum. Sem erro e sem aviso.
--
-- OS CENARIOS SAO AS DUAS PORTAS, UMA A UMA, e a razao de serem duas e a
-- mesma de a trava morar no trigger: com a simetria ligada, uma trava escrita
-- so numa delas transforma a outra na porta dos fundos. Quem tirar o trigger
-- derruba os cenarios das duas.
-- ===========================================================================

\set ANA    '''11111111-1111-1111-1111-111111111111'''
\set DIEGO  '''22222222-2222-2222-2222-222222222222'''
\set CARLA  '''33333333-3333-3333-3333-333333333333'''
\set MARINA '''55555555-5555-5555-5555-555555555555'''
\set OTTO   '''88888888-8888-8888-8888-888888888888'''

\set MCLI '''e0860000-0000-0000-0000-0000000000c1'''

select teste.limpar();

insert into public.clients (id, nome_empresa, nome_contato, email_contato, ativo)
values (:MCLI, 'Social S.A.', 'Sandra', 'sandra@social.com', true)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- A MONTAGEM: dois meses abertos pela funcao de verdade
--
-- Eles nascem por `abrir_mes_de_social()` e nao por `insert` solto, e isso nao
-- e zelo: a ponte que este arquivo mede e `posts.subtask_id -> subtasks
-- .task_id`, que SO a funcao escreve. Montando a mao, os cenarios mediriam um
-- estado que o produto nao produz -- a conveniencia de fixture ocupando o
-- lugar do cenario, que e o erro que a 0062 pagou.
-- ---------------------------------------------------------------------------
select teste.conferir_como('O Atendimento abre o mes de novembro', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-11', '[{"redes":["instagram"],"quantidade":4}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-nov')::text$q$, :MCLI),
  '4');

select teste.conferir_como('E o de dezembro, que fica de fora de tudo', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-12', '[{"redes":["instagram"],"quantidade":3}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-dez')::text$q$, :MCLI),
  '3');

select teste.conferir('A demanda de novembro nasceu com os quatro posts',
  (select count(*)::text from public.posts_do_mes(
     (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-11-01'))),
  '4');


-- ---------------------------------------------------------------------------
-- 1. PORTA 1 - APAGAR A DEMANDA LEVA O SOCIAL JUNTO
--
-- Era aqui que os posts ficavam orfaos. Tirando o trigger
-- `tasks_apaga_o_social`, o primeiro cenario acha 4 onde espera 0 -- e o
-- segundo continua passando, que e o que fazia o furo ser invisivel: a
-- demanda SOME, e so os posts ficam.
-- ---------------------------------------------------------------------------
select teste.cenario(
  'A gestao apaga a demanda do mes de dezembro',
  :ANA,
  format($$delete from public.tasks
            where client_id = %L and social_do_mes = '2027-12-01'$$, :MCLI),
  'passa'
);

select teste.conferir('E os posts de dezembro foram junto',
  (select count(*)::text from public.posts p
     where p.client_id = :MCLI
       and to_char(p.data_publicacao, 'YYYY-MM') = '2027-12'),
  '0');

-- E A CONTA NAO PODE SER "SOBROU POST ORFAO EM ALGUM LUGAR". Sem esta linha,
-- um trigger que apagasse so os posts COM data passaria.
select teste.conferir('Nenhum post de dezembro sobrou, com data ou sem',
  (select count(*)::text from public.posts p
     join public.clients c on c.id = p.client_id
    where c.id = :MCLI and p.tema like '%Dezembro%'),
  '0');


-- ---------------------------------------------------------------------------
-- 2. PORTA 2 - APAGAR O MES LEVA A DEMANDA JUNTO
--
-- A funcao apaga os posts e DEPOIS a demanda, e nessa ordem o trigger da
-- porta 1 encontra zero post: o laco nao existe por construcao.
-- ---------------------------------------------------------------------------
select teste.conferir_como('A gestao apaga o mes de novembro pelo Social Media', :ANA,
  format($q$select public.apagar_mes_de_social(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-11-01'))::text$q$, :MCLI),
  '4');

select teste.conferir('A demanda de novembro saiu junto',
  (select count(*)::text from public.tasks
    where client_id = :MCLI and social_do_mes = '2027-11-01'),
  '0');

select teste.conferir('E os quatro posts tambem',
  (select count(*)::text from public.posts p where p.client_id = :MCLI),
  '0');


-- ---------------------------------------------------------------------------
-- 3. A TRAVA DO POST JA ENVIADO SAIU (0094), E OS CENARIOS FICARAM VIRADOS
--    DO AVESSO
--
-- Ela recusava, pelas tres portas, apagar um mes em que alguma peca ja tinha
-- ido ao cliente. Saiu por decisao do usuario -- *"libera para ser excluido
-- mesmo assim"* --, e o que estes cenarios medem hoje e o contrario: se
-- alguem a reintroduzir em qualquer um dos tres lugares, um deles falha e diz
-- qual.
--
-- O QUE CONTINUA DE PE e a guarda de quem: `is_gestor()` nas duas funcoes,
-- medida na secao 5. A 0094 nao encostou nela.
-- ---------------------------------------------------------------------------
select teste.conferir_como('Abre o mes de outubro, que vai ao cliente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-10', '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-out')::text$q$, :MCLI),
  '2');

-- O CARIMBO VAI A MAO AQUI, e e a unica coisa deste arquivo montada assim: o
-- caminho de verdade e a rodada de escopo cliente (0032), e ela exige data de
-- publicacao, arte e o aval interno -- cinco passos para montar o estado que
-- a trava antiga olhava, que era so `enviado_em`.
--
-- OUTUBRO NAO E APAGADO AQUI, e e de proposito: ele e a fixture das secoes 6
-- e 7, que contam o que vai junto e arquivam. Os cenarios do apagamento usam
-- meses proprios, logo abaixo -- um por porta, porque cada um consome o mes
-- que ele apaga.
update public.posts set enviado_em = now()
 where id in (select id from public.posts_do_mes(
   (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-10-01'))
   order by created_at limit 1);

-- A PRIMEIRA PORTA: a funcao do Social Media. Ela devolve quantas pecas
-- sairam, e as duas saem -- inclusive a que o cliente ja tinha visto.
select teste.conferir_como('Abre agosto, com uma peca que vai ao cliente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-08', '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-ago')::text$q$, :MCLI),
  '2');

update public.posts set enviado_em = now()
 where id in (select id from public.posts_do_mes(
   (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-08-01'))
   order by created_at limit 1);

select teste.conferir_como('Apagar o mes com post no cliente PASSA, e leva as duas pecas', :ANA,
  format($q$select public.apagar_mes_de_social(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-08-01'))::text$q$, :MCLI),
  '2');

select teste.conferir('E agosto nao existe mais',
  (select count(*)::text from public.tasks
    where client_id = :MCLI and social_do_mes = '2027-08-01'),
  '0');

-- A SEGUNDA PORTA: o "Excluir task" do board, que passa pelo TRIGGER. Este e
-- o cenario que separa "a trava saiu do banco" de "a trava saiu da funcao":
-- tirando-a so de `apagar_mes_de_social()`, apagar a demanda no board
-- continuaria recusando, e com a mesma frase. E a licao da 0029 e da 0060,
-- medida pelo lado de ca.
select teste.conferir_como('Abre julho, com uma peca que vai ao cliente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-07', '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-jul')::text$q$, :MCLI),
  '2');

update public.posts set enviado_em = now()
 where id in (select id from public.posts_do_mes(
   (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-07-01'))
   order by created_at limit 1);

select teste.cenario(
  'E apagar a demanda dele no board tambem passa',
  :ANA,
  format($$delete from public.tasks
            where client_id = %L and social_do_mes = '2027-07-01'$$, :MCLI),
  'passa'
);

-- O QUE ESTE CENARIO MEDE E A AUSENCIA DA RECUSA, e nao o apagamento dos
-- posts: `posts.social_task_id` e `on delete cascade` desde a 0088, entao as
-- pecas sairiam de qualquer jeito. Contar os posts depois daria zero com o
-- trigger ligado E desligado -- um teste que afirma sem provar.
select teste.conferir('E a demanda de julho nao existe mais',
  (select count(*)::text from public.tasks
    where client_id = :MCLI and social_do_mes = '2027-07-01'),
  '0');


-- ---------------------------------------------------------------------------
-- 4. LIMPAR SO OS POSTS, E A TERCEIRA PORTA
--
-- A 0086 punha a mesma recusa aqui, com o argumento de que ela era sobre o
-- MATERIAL e nao sobre a casca. Ela saiu junto na 0094, e tinha de sair: era
-- justamente a saida que a recusa das outras duas OFERECIA na dica, e negava
-- quando a pessoa a seguia.
-- ---------------------------------------------------------------------------
select teste.conferir_como('Abre junho, com uma peca que vai ao cliente', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-06', '[{"redes":["instagram"],"quantidade":2}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-jun')::text$q$, :MCLI),
  '2');

update public.posts set enviado_em = now()
 where id in (select id from public.posts_do_mes(
   (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-06-01'))
   order by created_at limit 1);

select teste.conferir_como('Limpar os posts do mes enviado PASSA', :ANA,
  format($q$select public.limpar_posts_do_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-06-01'))::text$q$, :MCLI),
  '2');

select teste.conferir('E a demanda de junho ficou de pe, sem peca nenhuma',
  (select count(*)::text from public.tasks
    where client_id = :MCLI and social_do_mes = '2027-06-01'),
  '1');

select teste.conferir_como('Mas num mes sem envio ela limpa e deixa a demanda', :CARLA,
  format($q$select public.abrir_mes_de_social(%L, '2027-09', '[{"redes":["instagram"],"quantidade":3}]'::jsonb,
           null, '{}'::jsonb, '{}'::jsonb, 'https://drive.com/social-set')::text$q$, :MCLI),
  '3');

select teste.conferir_como('Limpar devolve quantos saíram', :ANA,
  format($q$select public.limpar_posts_do_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-09-01'))::text$q$, :MCLI),
  '3');

select teste.conferir('A demanda de setembro FICOU de pé',
  (select count(*)::text from public.tasks
    where client_id = :MCLI and social_do_mes = '2027-09-01'),
  '1');


-- ---------------------------------------------------------------------------
-- 5. QUEM PODE, E QUEM NAO PODE
--
-- Apagar sessenta posts nao pode ser mais facil que apagar um, e apagar UM e
-- do desenvolvedor ou do socio desde a 0042. O Atendimento continua ABRINDO o
-- mes -- abrir trabalho e destruir trabalho sao duas decisoes.
-- ---------------------------------------------------------------------------
select teste.recusa_com_dica('O Atendimento abre o mes e nao o apaga', :CARLA,
  format($q$select public.apagar_mes_de_social(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-09-01'))$q$, :MCLI),
  'Quem abre o mês é o Atendimento');

select teste.recusa_com('E o colaborador tambem nao', :MARINA,
  format($q$select public.apagar_mes_de_social(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-09-01'))$q$, :MCLI),
  'desenvolvedor ou do sócio');

select teste.recusa_com('Nem o cliente, que nem enxerga a demanda', :OTTO,
  format($q$select public.apagar_mes_de_social(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-09-01'))$q$, :MCLI),
  'desenvolvedor ou do sócio');


-- ---------------------------------------------------------------------------
-- 6. O QUE VAI JUNTO, PARA O DIALOGO CONTAR ANTES
--
-- A contagem sai da MESMA ponte que o apagamento usa, pela razao de
-- `quem_deve_nota()` na 0066: duas contas dariam um dialogo prometendo doze e
-- um apagamento alcancando onze.
-- ---------------------------------------------------------------------------
select teste.conferir_como('O dialogo conta os dois posts de outubro', :ANA,
  format($q$select posts::text from public.o_que_vai_com_o_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-10-01'))$q$, :MCLI),
  '2');

select teste.conferir_como('E conta quantos ja foram ao cliente', :ANA,
  format($q$select enviados::text from public.o_que_vai_com_o_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-10-01'))$q$, :MCLI),
  '1');

-- AS ETAPAS E AS MARCACOES SAO DUAS CONTAS, e a 0088 as separou: as etapas do
-- MES sao cinco, e as marcacoes sao uma por post x etapa -- dez, nos dois
-- posts. Juntar as duas num numero so daria "dez etapas" num mes de cinco, e o
-- sprint pede as duas na frase do dialogo.
select teste.conferir_como('O dialogo conta as cinco etapas do mes', :ANA,
  format($q$select etapas::text from public.o_que_vai_com_o_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-10-01'))$q$, :MCLI),
  '5');

select teste.conferir_como('E as dez marcacoes de progresso dos dois posts', :ANA,
  format($q$select marcacoes::text from public.o_que_vai_com_o_mes(
       (select id from public.tasks where client_id = %L and social_do_mes = '2027-10-01'))$q$, :MCLI),
  '10');


-- ---------------------------------------------------------------------------
-- 7. ARQUIVAR, QUE CONTINUA SENDO A SAIDA PARA O MES QUE ACABOU
--
-- Ela era o que a recusa da 0086 oferecia; com a recusa fora (0094) ela deixa
-- de ser o unico caminho e passa a ser a ESCOLHA certa para o caso dela --
-- tirar da navegacao um mes inteiro e correto, sem destruir nada.
--
-- Ele e CARIMBO e nao valor de enum: `task_status` tem sete e nenhum deles e
-- "arquivado", e no enum ele entraria no seletor dos sete e viraria coluna no
-- board. E a decisao de `publicada_em` (0028), letra por letra.
-- ---------------------------------------------------------------------------
select teste.cenario(
  'A gestao arquiva o mes em vez de apagar',
  :ANA,
  format($$update public.tasks set arquivada_em = now()
            where client_id = %L and social_do_mes = '2027-10-01'$$, :MCLI),
  'passa'
);

select teste.conferir('Arquivar nao apagou nada',
  (select count(*)::text from public.posts_do_mes(
     (select id from public.tasks where client_id = :MCLI and social_do_mes = '2027-10-01'))),
  '2');

select teste.cenario(
  'E ele volta, porque arquivar e reversivel',
  :ANA,
  format($$update public.tasks set arquivada_em = null
            where client_id = %L and social_do_mes = '2027-10-01'$$, :MCLI),
  'passa'
);


-- ---------------------------------------------------------------------------
-- 8. A DEMANDA COMUM NAO E TOCADA
--
-- O trigger sai na primeira linha quando `social_do_mes` e nulo. Sem essa
-- guarda ele rodaria em TODO apagamento de task da agencia -- duas consultas
-- por delete, para nada.
-- ---------------------------------------------------------------------------
insert into public.tasks (id, client_id, titulo, criado_por, link_entrega, publicada_em)
values ('e0860000-0000-0000-0000-000000000001', :MCLI, 'Demanda comum', :CARLA,
        'https://drive.com/comum', now())
on conflict (id) do nothing;

select teste.cenario(
  'Apagar uma demanda que nao e de social continua passando',
  :ANA,
  $$delete from public.tasks where id = 'e0860000-0000-0000-0000-000000000001'$$,
  'passa'
);
