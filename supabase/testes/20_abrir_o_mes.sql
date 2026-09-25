\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''

-- ===========================================================================
-- 0044 -- ABRIR O MES DE SOCIAL DE UMA VEZ
--
-- Decisao do usuario: mais de dez clientes, todos com social, e a gestao nao
-- vai abrir cento e vinte posts a mao inventando cento e vinte datas que quem
-- produz vai refazer. O mes abre em branco e a Social Media distribui.
--
-- SAO DUAS AFIRMACOES OPOSTAS NO MESMO ARQUIVO, e e de proposito:
--   * a data e de QUEM PRODUZ (a trava da 0042 saiu, e o cenario dela ficou
--     virado do avesso no 19);
--   * e post sem data NAO VAI AO CLIENTE.
-- A primeira diz quem manda na data, a segunda diz que ela existe antes de o
-- material sair da agencia. Quem ler so uma das duas vai achar a outra errada.
-- ===========================================================================


-- --- 1. Quem abre o mes ----------------------------------------------------

-- O COLABORADOR NAO ABRE, e a trava e a primeira linha da funcao e nao a
-- policy: `abrir_mes_de_social` e `security definer`, entao a RLS de `posts`
-- nao e consultada la dentro. Sem o `is_gestor()` explicito, quem produz
-- abriria o mes inteiro pela API.
-- O BRUNO E `colaborador` E E DESIGN, e e a funcao que decide desde a 0046 --
-- a Carla, com o MESMO perfil, abre, porque esta no Atendimento. O arquivo 22
-- guarda os dois lados dessa mesma pergunta.
select teste.recusa_com('O Design nao abre o mes', :BRUNO,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-11', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  'é do Atendimento');

select teste.cenario('E o cliente muito menos', :JOANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-11', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE), 'recusa');

select teste.cenario('A gestao abre tres no Instagram e dois no LinkedIn', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2026-11', '{"instagram": 3, "linkedin": 2}'::jsonb)$fmt$, :VERDE), 'ok', 1);

select teste.conferir('Nasceram cinco posts',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%de _ · %'), '5');

-- O PONTO INTEIRO DA MIGRATION: eles nascem SEM DATA. Antes da 0044 a coluna
-- era `not null`, e abrir o mes obrigaria a gestao a inventar cinco datas.
select teste.conferir('E todos os cinco sem data',
  (select count(*)::text from public.posts
    where client_id = :VERDE and data_publicacao is null), '5');

-- O TEMA NASCE ESCRITO, e nao vazio. `tema` e `not null` desde a 0032, mas
-- mais que isso: cinco linhas em branco numa lista nao se distinguem, e quem
-- produz nao sabe qual ja mexeu.
select teste.conferir('O tema diz a rede, o numero e o mes',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema = 'Instagram 1 de 3 · Novembro/2026'), '1');


-- --- 2. O que a funcao recusa ----------------------------------------------

select teste.recusa_com('Zero post nao abre mes nenhum', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '{"instagram": 0}'::jsonb)$fmt$,
    :VERDE),
  'Escolha quantos posts abrir');

-- O TETO RECUSA, E NAO CORTA -- ao contrario do limite por task da
-- recorrencia, onde o excesso vem de uma regra de calendario e cortar e melhor
-- que deixar o mes sem nada. Aqui o numero e DIGITADO, e um zero a mais e erro
-- de digitacao: sessenta e um posts criados em silencio sao sessenta e um para
-- apagar a mao.
select teste.recusa_com('Sessenta e um de uma vez nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '{"instagram": 61}'::jsonb)$fmt$,
    :VERDE),
  'o limite é 60');

select teste.recusa_com_dica('E a recusa diz o que fazer no lugar', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '{"instagram": 61}'::jsonb)$fmt$,
    :VERDE),
  'abra em duas vezes');

select teste.recusa_com('Quantidade negativa nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '{"instagram": -3}'::jsonb)$fmt$,
    :VERDE),
  'negativa');

select teste.recusa_com('Mes fora do formato nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, 'novembro', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  'AAAA-MM');

select teste.recusa_com('Cliente que nao existe nao abre mes', :ANA,
  $fmt$select public.abrir_mes_de_social(
    'aaaaaaaa-0000-0000-0000-00000000ffff', '2026-11', '{"instagram": 2}'::jsonb)$fmt$,
  'Cliente não encontrado');

-- E NASCERAM TODOS OU NENHUM. Cinco continuam sendo cinco depois de seis
-- recusas: se a funcao inserisse antes de conferir o teto, as sessenta e uma
-- primeiras estariam no banco agora.
select teste.conferir('Nenhuma recusa deixou post pela metade',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%de _ · %'), '5');


-- --- 3. O responsavel ja sai definido, quando alguem diz quem -------------
--
-- Nao e obrigatorio, e e a mesma razao do responsavel padrao da recorrencia:
-- etapa sem dono nao aparece no "Minhas Tasks" de ninguem, e post sem dono nao
-- aparece na fila de ninguem. Mas quem abre o mes pode ainda nao saber quem
-- vai pegar.

select teste.cenario('A gestao abre dois ja no nome do Bruno', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2026-12', '{"tiktok": 2}'::jsonb, %L)$fmt$, :VERDE, :BRUNO), 'ok', 1);

select teste.conferir('Os dois sairam com dono',
  (select count(*)::text from public.posts
    where client_id = :VERDE and plataforma = 'tiktok' and responsavel_id = :BRUNO), '2');

select teste.conferir('E o Bruno enxerga os dois',
  (select count(*)::text from public.posts
    where client_id = :VERDE and plataforma = 'tiktok'), '2');


-- --- 4. POST SEM DATA NAO VAI AO CLIENTE ----------------------------------
--
-- A trava nova da 0044, e ela e a metade que a decisao da data nao cobre: sem
-- ela o cliente abre o portal, ve a arte e a legenda, e decide sem saber
-- quando aquilo vai ao ar -- com o botao de aprovar do lado.

-- Um dos posts sem data, liberado para o Bruno e com o aval interno ja
-- aprovado: falta so a data.
update public.posts set responsavel_id = :BRUNO
 where client_id = :VERDE and tema = 'Instagram 1 de 3 · Novembro/2026';

insert into public.approval_rounds
  (content_type, content_id, numero_rodada, escopo, solicitado_por, status, decidido_por)
select 'post', p.id, 1, 'interna', :BRUNO, 'aprovada', :DIEGO
  from public.posts p
 where p.client_id = :VERDE and p.tema = 'Instagram 1 de 3 · Novembro/2026';

select teste.recusa_com('Post sem data nao vai ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    select 'post', p.id, 1, 'cliente', %L, 'pendente'
      from public.posts p
     where p.client_id = %L and p.tema = 'Instagram 1 de 3 · Novembro/2026'$fmt$,
    :DIEGO, :VERDE),
  'ainda não tem data de publicação');

-- A DICA, E NAO SO A MENSAGEM. Mesmo critério de `tasks_sem_cancelada`: e o
-- `hint` que a tela mostra, e uma trava com a dica apagada passaria por uma
-- checagem que so le a mensagem.
select teste.recusa_com_dica('E a recusa diz para escolher o dia antes', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    select 'post', p.id, 1, 'cliente', %L, 'pendente'
      from public.posts p
     where p.client_id = %L and p.tema = 'Instagram 1 de 3 · Novembro/2026'$fmt$,
    :DIEGO, :VERDE),
  'Escolha o dia antes de enviar');

-- E QUEM PRODUZ E QUEM POE A DATA. As duas afirmacoes do cabecalho, uma em
-- seguida da outra: o Bruno escolhe o dia, e so depois dele o post sai.
select teste.cenario('Quem produz escolhe o dia', :BRUNO,
  format($fmt$update public.posts set data_publicacao = '2026-11-18'
     where client_id = %L and tema = 'Instagram 1 de 3 · Novembro/2026'$fmt$, :VERDE),
  'ok', 1);

select teste.cenario('E agora ele vai ao cliente', :DIEGO,
  format($fmt$insert into public.approval_rounds
    (content_type, content_id, numero_rodada, escopo, solicitado_por, status)
    select 'post', p.id, 1, 'cliente', %L, 'pendente'
      from public.posts p
     where p.client_id = %L and p.tema = 'Instagram 1 de 3 · Novembro/2026'$fmt$,
    :DIEGO, :VERDE),
  'ok', 1);


-- --- 5. O cliente continua sem ver o que nao foi enviado -------------------
--
-- A 0044 mexeu em quem escreve e no que pode faltar. Nada disso pode ter
-- aberto uma porta do lado de la, e a pergunta se faz de novo -- inclusive
-- para o estado NOVO, que e o post sem data: ele nao pode aparecer no
-- calendario do cliente como um dia em branco.

select teste.cenario('O cliente nao ve post sem data', :JOANA,
  format($fmt$select id from public.posts
     where client_id = %L and data_publicacao is null$fmt$, :VERDE), 'ok', 0);

select teste.cenario('E nao escolhe a data de nada', :JOANA,
  format($fmt$update public.posts set data_publicacao = '2026-11-30'
     where client_id = %L and tema like 'Instagram 2 de 3%%'$fmt$, :VERDE), 'recusa');
