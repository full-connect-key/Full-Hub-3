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
  format($fmt$select public.abrir_mes_de_social(%L, '2026-11', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
    :VERDE),
  'é do Atendimento');

select teste.cenario('E o cliente muito menos', :JOANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-11', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
    :VERDE), 'recusa');

select teste.cenario('A gestao abre tres no Instagram e dois no LinkedIn', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2026-11', '[{"redes": ["instagram"], "quantidade": 3},
                      {"redes": ["linkedin"], "quantidade": 2}]'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/PASTA-DE-TESTE')$fmt$, :VERDE), 'ok', 1);

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
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '[{"redes": ["instagram"], "quantidade": 0}]'::jsonb)$fmt$,
    :VERDE),
  'Escolha quantos posts abrir');

-- O TETO RECUSA, E NAO CORTA -- ao contrario do limite por task da
-- recorrencia, onde o excesso vem de uma regra de calendario e cortar e melhor
-- que deixar o mes sem nada. Aqui o numero e DIGITADO, e um zero a mais e erro
-- de digitacao: sessenta e um posts criados em silencio sao sessenta e um para
-- apagar a mao.
select teste.recusa_com('Sessenta e um de uma vez nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '[{"redes": ["instagram"], "quantidade": 61}]'::jsonb)$fmt$,
    :VERDE),
  'o limite é 60');

select teste.recusa_com_dica('E a recusa diz o que fazer no lugar', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '[{"redes": ["instagram"], "quantidade": 61}]'::jsonb)$fmt$,
    :VERDE),
  'abra em duas vezes');

select teste.recusa_com('Quantidade negativa nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2026-12', '[{"redes": ["instagram"], "quantidade": -3}]'::jsonb)$fmt$,
    :VERDE),
  'negativa');

select teste.recusa_com('Mes fora do formato nao passa', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, 'novembro', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
    :VERDE),
  'AAAA-MM');

select teste.recusa_com('Cliente que nao existe nao abre mes', :ANA,
  $fmt$select public.abrir_mes_de_social(
    'aaaaaaaa-0000-0000-0000-00000000ffff', '2026-11', '[{"redes": ["instagram"], "quantidade": 2}]'::jsonb)$fmt$,
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
    %L, '2026-12', '[{"redes": ["tiktok"], "quantidade": 2}]'::jsonb, %L,
    p_link_entrega => 'https://drive.google.com/drive/folders/PASTA-DE-TESTE')$fmt$, :VERDE, :BRUNO), 'ok', 1);

select teste.conferir('Os dois sairam com dono',
  (select count(*)::text from public.posts
    where client_id = :VERDE and plataformas = '{tiktok}' and responsavel_id = :BRUNO), '2');

select teste.conferir('E o Bruno enxerga os dois',
  (select count(*)::text from public.posts
    where client_id = :VERDE and plataformas = '{tiktok}'), '2');


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


-- ===========================================================================
-- 6. DUAS REDES NA MESMA PECA (0082)
--
-- Decisao do usuario: *"permita juntar duas redes sociais, ja que tudo que
-- postamos no Instagram postamos no Facebook"*.
--
-- O CENARIO QUE JUSTIFICA A MIGRATION INTEIRA e o primeiro: doze no Instagram
-- junto com o Facebook sao DOZE posts, nao vinte e quatro. Lendo a frase dele
-- como "abra os dois lados pareados", a conta dobra -- e com ela a decisao do
-- cliente, a corrente de cinco etapas e a linha no board.
-- ===========================================================================

select teste.cenario('A gestao abre quatro no Instagram JUNTO com o Facebook', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-08', '[{"redes": ["instagram", "facebook"], "quantidade": 4}]'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/PASTA-DE-AGOSTO')$fmt$,
    :VERDE), 'ok', 1);

-- SAO QUATRO E NAO OITO. Se alguem ler a combinacao como "um post por rede",
-- este cenario acha 8 e diz exatamente o que mudou.
select teste.conferir('Nasceram QUATRO posts, e nao oito',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%· Agosto/2027'), '4');

select teste.conferir('E cada um carrega as DUAS redes',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%· Agosto/2027'
      and plataformas = '{instagram,facebook}'), '4');

-- O NOME DA COMBINACAO sai por extenso e na ordem do enum, nao na ordem em
-- que a pessoa marcou as caixas: duas chamadas iguais com as redes trocadas
-- de lugar dariam dois temas diferentes para o mesmo mes.
select teste.conferir('O tema nomeia as duas',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema = 'Instagram + Facebook 1 de 4 · Agosto/2027'), '1');

-- E A DEMANDA DO MES TEM UMA ETAPA POR FASE, nao por post nem por rede. Era
-- "uma por post" na 0061, e a 0088 trocou: as quatro pecas combinadas nao sao
-- quatro trabalhos, sao quatro CAIXINHAS dentro das cinco fases do mes.
select teste.conferir('A demanda do mes ganhou as cinco etapas do fluxo',
  (select count(*)::text from public.etapas_do_mes(
    (select id from public.tasks
      where client_id = :VERDE and social_do_mes = '2027-08-01'))), '5');

select teste.conferir('E as quatro pecas viraram vinte caixinhas',
  (select count(*)::text from public.post_etapa_progresso g
    where g.post_id in (select id from public.posts_do_mes(
      (select id from public.tasks
        where client_id = :VERDE and social_do_mes = '2027-08-01')))), '20');

-- UMA LINHA DE CADA, NA MESMA CHAMADA: e assim que o dialogo e desenhado --
-- doze em IG+FB e quatro no LinkedIn.
select teste.cenario('Duas linhas na mesma chamada', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-09', '[{"redes": ["instagram", "facebook"], "quantidade": 3},
                     {"redes": ["linkedin"], "quantidade": 2}]'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/PASTA-DE-SETEMBRO')$fmt$,
    :VERDE), 'ok', 1);

select teste.conferir('Cinco posts: tres combinados e dois do LinkedIn',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%· Setembro/2027'), '5');

select teste.conferir('E so dois carregam o LinkedIn',
  (select count(*)::text from public.posts
    where client_id = :VERDE and tema like '%· Setembro/2027'
      and 'linkedin' = any(plataformas)), '2');


-- --- O que a funcao recusa, e a forma que ela nao aceita mais --------------

-- O OBJETO DA 0044 E RECUSADO COM FRASE PROPRIA, e nao com um erro sobre tipo
-- de jsonb vindo de dentro de `jsonb_array_elements`. Quem cair aqui esta
-- mandando a forma antiga, e a recusa precisa dizer qual e a nova.
select teste.recusa_com_dica('A forma antiga, de objeto, e recusada', :ANA,
  format($fmt$select public.abrir_mes_de_social(%L, '2027-04', '{"instagram": 2}'::jsonb)$fmt$,
    :VERDE),
  '"redes": ["instagram","facebook"]');

select teste.recusa_com('Uma linha com quantidade e sem rede nao abre nada', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-04', '[{"redes": [], "quantidade": 3}]'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/X')$fmt$, :VERDE),
  'Escolha ao menos uma rede');

-- E A LINHA ZERADA NAO E RECUSADA POR FALTA DE REDE: ela e so uma linha que
-- ninguem preencheu, e quem responde por ela e o "escolha quantos posts
-- abrir". Sem essa distincao, o dialogo com uma linha em branco recusaria
-- falando de rede quando o que falta e numero.
select teste.recusa_com('A linha zerada cai no "escolha quantos", e nao na rede', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-04', '[{"redes": [], "quantidade": 0}]'::jsonb)$fmt$, :VERDE),
  'Escolha quantos posts abrir');

-- O TETO DE 60 CONTA POSTS, e nao posts vezes redes: trinta e cinco em duas
-- redes sao trinta e cinco pecas. Se alguem multiplicar, este cenario recusa
-- e diz que o teto passou a contar outra coisa.
select teste.cenario('Trinta e cinco em duas redes passam do teto', :ANA,
  format($fmt$select public.abrir_mes_de_social(
    %L, '2027-05', '[{"redes": ["instagram", "facebook"], "quantidade": 35}]'::jsonb,
    p_link_entrega => 'https://drive.google.com/drive/folders/Y')$fmt$, :VERDE),
  'ok', 1);


-- --- As duas travas da coluna, medidas direto -----------------------------
--
-- Os cenarios de cima passam pela funcao, que normaliza com `distinct` antes
-- de gravar. Estes medem o `check` da TABELA, que e quem segura o PATCH
-- montado a mao -- a diferenca de sempre entre "a tela nao faz" e "o banco
-- nao aceita".

select teste.recusa_com('Lista de redes vazia e recusada pelo banco', :ANA,
  format($fmt$insert into public.posts (client_id, tema, plataformas)
    values (%L, 'Post sem rede', '{}')$fmt$, :VERDE),
  'posts_plataformas_nao_vazia');

select teste.recusa_com('E a rede repetida tambem', :ANA,
  format($fmt$insert into public.posts (client_id, tema, plataformas)
    values (%L, 'Post repetido', '{instagram,instagram}')$fmt$, :VERDE),
  'posts_plataformas_sem_repeticao');

-- A COLUNA ANTIGA NAO VOLTA. Ela foi apagada e nao aposentada (0023), e uma
-- `plataforma` singular ao lado da lista seria "a rede principal" -- dois
-- lugares para o mesmo fato. Se alguem a recriar por conveniencia, este
-- cenario cai.
select teste.conferir('`posts.plataforma` nao existe mais',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'plataforma'), '0');
