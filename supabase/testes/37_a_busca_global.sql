-- ===========================================================================
-- 37 - A BUSCA GLOBAL (migration 0073)
--
-- A busca da topbar era uma casca desde o Sprint 1. Agora ela le NOVE tabelas
-- numa chamada -- `tasks`, `subtasks`, `clients`, `profiles`, `campaigns`,
-- `posts`, `assets`, `client_requests` e `academy_tracks`.
--
-- ---------------------------------------------------------------------------
-- ESTE ARQUIVO EXISTE POR UMA LINHA QUE NAO ESTA NA MIGRATION:
-- `busca_global()` NAO E `security definer`.
--
-- Uma funcao plpgsql comum roda com o `current_user` de quem a chamou, entao a
-- policy das nove tabelas vale dentro dela. Trocando uma palavra na 0073, a
-- funcao passaria a ler as nove INTEIRAS para qualquer pessoa autenticada --
-- e o modo de falha e o do `security_invoker` da view `calendar_events`: **num
-- banco com um cliente so, vazar tudo e mostrar o certo tem a mesma cara.**
--
-- Por isso os cenarios de baixo buscam um termo que casa nas DUAS empresas do
-- fixture, e perguntam a QUATRO pessoas de tres perfis. Com `security definer`
-- na funcao, os cenarios da secao 3 caem e dizem o que vazaria.
-- ---------------------------------------------------------------------------
--
-- E A SECAO 1 MEDE O ACENTO, que e a outra metade da migration. Ela nao e
-- zelo: `lower()` depende do locale do banco, e o Postgres desta bateria e
-- locale C. E o mesmo bug que o `grep -i` do `check:cores` teve -- uma
-- checagem que dizia "ok" numa maquina e falhava no CI para o mesmo commit.
-- ===========================================================================

\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set OTTO    '''88888888-8888-8888-8888-888888888888'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

select teste.limpar();


-- ===========================================================================
-- 1. O ACENTO E A CAIXA
--
-- A pessoa digita "midia" e o dado diz "mídia". Sao dois problemas
-- empilhados, e o segundo e o que morde: `lower()` resolve a caixa do ASCII e
-- NAO resolve o acento -- e o que ele faz com um caractere acentuado depende
-- do locale.
-- ===========================================================================

select teste.conferir(
  'sem_acento dobra acento e caixa de uma vez',
  public.sem_acento('Óptica Visão'),
  'optica visao');

select teste.conferir(
  'sem_acento dobra a MAIUSCULA ACENTUADA, que e o caso que o locale estraga',
  public.sem_acento('RELATÓRIO DE MÍDIA'),
  'relatorio de midia');

-- ---------------------------------------------------------------------------
-- O CENARIO QUE PROVA POR QUE O `translate` EXISTE.
--
-- Ele nao mede o produto: mede a alternativa que parece bastar. Sem ele,
-- alguem trocaria `sem_acento()` por `lower()` achando que e a mesma coisa, e
-- a busca continuaria verde na maquina de quem escreveu -- porque num banco em
-- locale UTF-8 o `lower()` dobra acento. Aqui, em locale C, ele nao dobra.
--
-- O caso e o REAL: termo sem acento, dado com acento. E o que toda pessoa
-- digita, porque ninguem poe acento em campo de busca.
-- ---------------------------------------------------------------------------
select teste.conferir(
  'lower() sozinho NAO acha "optica" em "Óptica Visão"',
  (strpos(lower('Óptica Visão'), lower('optica')) > 0)::text,
  'false');

select teste.conferir(
  'sem_acento acha',
  (strpos(public.sem_acento('Óptica Visão'), public.sem_acento('optica')) > 0)::text,
  'true');


-- ===========================================================================
-- 2. O TERMO CURTO, E O QUE NAO E CURINGA
-- ===========================================================================

-- UMA LETRA DEVOLVE VAZIO, e nao tudo: com um caractere a lista deixa de
-- responder qualquer coisa. O numero mora em dois lugares de proposito --
-- `MINIMO_PARA_BUSCAR` na tela decide se chama, e este `return` decide o que
-- volta --, e o comentario de `lib/dominio/busca.ts` diz por que.
select teste.conferir_como(
  'uma letra devolve vazio',
  :ANA,
  'select count(*)::text from public.busca_global(''a'')',
  '0');

-- ---------------------------------------------------------------------------
-- `strpos` E NAO `like '%termo%'`, e os dois cenarios abaixo SEPARAM as duas
-- implementacoes -- o que a primeira versao deles nao fazia.
--
-- Ela buscava "100%", e passava com `like` tambem: "100" nao aparece em nome
-- nenhum do banco, entao `like '%100%%'` tambem devolve zero. O teste de
-- mutacao mostrou -- trocar `strpos` por `like` nao derrubava o cenario. Um
-- teste que nao separa a resposta certa da errada e um teste que afirma sem
-- provar, que e a licao do `select` antes do `insert` na idempotencia da 0040.
--
-- O termo agora e um em que o curinga CASARIA, e ele casa contra a EMPRESA do
-- fixture e nao contra uma demanda: esta secao roda ANTES da secao 3, onde as
-- demandas nascem, e a primeira tentativa media contra uma tabela vazia. O zero
-- vinha do `teste.limpar()` do topo do arquivo, nao da implementacao -- e aí ele
-- passava com `like` tambem. Um cenario pode passar pelo motivo errado, e a
-- unica forma de saber e quebrar de proposito o que ele afirma medir.
--
-- Com `like`, "Mundo%Verde" acha "Mundo Verde"; com `strpos`, nao acha, porque
-- o `%` e so um caractere que o nome nao tem.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'o % digitado e literal, e nao curinga',
  :ANA,
  'select count(*)::text from public.busca_global(''Mundo%Verde'')',
  '0');

select teste.conferir_como(
  'o _ digitado tambem e literal',
  :ANA,
  'select count(*)::text from public.busca_global(''Mu_do'')',
  '0');


-- ===========================================================================
-- 3. A RLS, COM MATERIAL DAS DUAS EMPRESAS
--
-- E a secao que justifica o arquivo. Uma demanda em cada empresa, com um termo
-- que casa nas duas, e a mesma pergunta feita por quatro pessoas.
-- ===========================================================================

insert into public.tasks (id, client_id, titulo, briefing_texto, link_entrega, criado_por)
values
  ('bb000000-0000-0000-0000-00000000b001', :VERDE,
   'Busca de mídia — Mundo Verde',
   'O briefing fala de PANFLETO e a busca nao pode achar por ele.',
   'https://drive.google.com/drive/folders/b1', :DIEGO),
  ('bb000000-0000-0000-0000-00000000b002', :OPTICA,
   'Busca de mídia — Óptica Visão',
   'Nada de interessante aqui.',
   'https://drive.google.com/drive/folders/b2', :DIEGO);

-- O SOCIO ACHA AS DUAS. E a linha de base: sem ela, um zero na busca do
-- cliente nao provaria nada -- poderia ser a funcao quebrada.
select teste.conferir_como(
  'o socio acha a demanda das DUAS empresas',
  :ANA,
  'select count(*)::text from public.busca_global(''Busca de midia'')',
  '2');

select teste.conferir_como(
  'o desenvolvedor tambem',
  :DIEGO,
  'select count(*)::text from public.busca_global(''Busca de midia'')',
  '2');

-- ---------------------------------------------------------------------------
-- O CLIENTE NAO ACHA DEMANDA NENHUMA, nem a da propria empresa.
--
-- `tasks_select_cliente` exige uma rodada de escopo cliente: a demanda so e
-- legivel para ele quando algo dela foi enviado. Nenhuma das duas foi.
--
-- E ele CHAMA a funcao: o `grant` e para `authenticated`, e cliente e
-- authenticated. Recusar a chamada nao e a protecao -- a protecao e a funcao
-- nao devolver nada. Este cenario mede exatamente isso, e nao a porta.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'o cliente da Mundo Verde nao acha demanda nenhuma',
  :JOANA,
  'select count(*)::text from public.busca_global(''Busca de midia'')',
  '0');

select teste.conferir_como(
  'o cliente da Óptica tambem nao',
  :OTTO,
  'select count(*)::text from public.busca_global(''Busca de midia'')',
  '0');

-- ---------------------------------------------------------------------------
-- E O CLIENTE ACHA UMA EMPRESA SO -- A DELE.
--
-- Aqui esta a razao de a bateria ter DUAS: com uma empresa no banco, "achou
-- uma" seria o total, e o cenario passaria com a RLS ligada e desligada. Com
-- duas, o numero separa as duas coisas.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'o cliente da Mundo Verde acha a empresa dele, e uma so',
  :JOANA,
  'select string_agg(titulo, '', '' order by titulo) from public.busca_global(''visao'')'
  || ' where tipo = ''cliente''',
  null);

-- "Mundo" casa com a empresa dele e com nada da outra.
select teste.conferir_como(
  'buscando o nome da propria empresa, o cliente a acha',
  :JOANA,
  'select count(*)::text from public.busca_global(''Mundo Verde'') where tipo = ''cliente''',
  '1');

select teste.conferir_como(
  'e o cliente da Optica NAO acha a Mundo Verde',
  :OTTO,
  'select count(*)::text from public.busca_global(''Mundo Verde'') where tipo = ''cliente''',
  '0');

-- ---------------------------------------------------------------------------
-- O GRUPO "EQUIPE" SO RESPONDE PARA A GESTAO, e isto NAO e escolha da busca.
--
-- `profiles_select` e `own or is_gestor()` desde o Sprint 2: um colaborador le
-- exatamente UM perfil, o dele. Entao buscar o nome de um colega devolve nada
-- para quem nao e gestao -- e a busca herda isso sem uma linha a respeito,
-- porque quem decide e a policy.
--
-- O cenario existe para o dia em que alguem achar que a busca esta quebrada e
-- "consertar" com `security definer`: isso nao consertaria a busca, abriria a
-- tabela de perfis da agencia inteira. Se a regra tiver que mudar, muda na
-- policy -- num lugar, para as vinte telas que leem `profiles`.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'a gestao acha a pessoa da equipe pelo nome',
  :ANA,
  'select count(*)::text from public.busca_global(''Carla'') where tipo = ''pessoa''',
  '1');

select teste.conferir_como(
  'o colaborador NAO acha o colega -- e a policy de profiles, nao a busca',
  :CARLA,
  'select count(*)::text from public.busca_global(''Marina'') where tipo = ''pessoa''',
  '0');

select teste.conferir_como(
  'mas acha o proprio nome, que e o unico perfil que ele le',
  :CARLA,
  'select count(*)::text from public.busca_global(''Carla'') where tipo = ''pessoa''',
  '1');

-- O CLIENTE NAO ACHA NINGUEM DA EQUIPE. Duas travas independentes: a policy de
-- `profiles` nao lhe da a linha, e o ramo filtra `role <> 'cliente'`, que tira
-- o proprio perfil dele da lista. A primeira e a que vale.
select teste.conferir_como(
  'o cliente nao acha pessoa nenhuma, nem a si mesmo',
  :JOANA,
  'select count(*)::text from public.busca_global(''Joana'') where tipo = ''pessoa''',
  '0');


-- ===========================================================================
-- 4. O QUE ELA NAO BUSCA
-- ===========================================================================

-- O CORPO FICA DE FORA. Casar no briefing devolve a demanda que menciona
-- "panfleto" por acaso, e quem le a linha nao ve POR QUE ela casou -- o titulo
-- na tela nao contem o que foi digitado.
select teste.conferir_como(
  'o briefing nao e buscavel',
  :ANA,
  'select count(*)::text from public.busca_global(''panfleto'')',
  '0');

-- A SUBTAREFA DE POST FICA FORA DO RAMO DE ETAPA (0061): ela carrega o tema do
-- post como titulo, e o post tem ramo proprio. Sem essa linha, buscar o tema
-- devolveria duas linhas para o mesmo trabalho, levando a duas telas -- e a
-- certa e a do post, que e onde o card se preenche.
insert into public.tasks (id, client_id, titulo, link_entrega, criado_por, social_do_mes)
values ('bb000000-0000-0000-0000-00000000b003', :VERDE,
        'Social · Novembro/2027 de Mundo Verde',
        'https://drive.google.com/drive/folders/b3', :DIEGO, '2027-11-01');

insert into public.subtasks (id, task_id, titulo, ordem)
values ('bb000000-0000-0000-0000-00000000b0d1', 'bb000000-0000-0000-0000-00000000b003',
        'Espelho de post: guarda-chuva', 10);

insert into public.posts (id, client_id, tema, data_publicacao, plataformas, criado_por, subtask_id)
values ('bb000000-0000-0000-0000-00000000b0e1', :VERDE,
        'Espelho de post: guarda-chuva', current_date + 10, '{instagram}', :DIEGO,
        'bb000000-0000-0000-0000-00000000b0d1');

select teste.conferir_como(
  'o tema do post volta UMA vez, e como post -- nao como etapa',
  :ANA,
  'select string_agg(tipo, '','' order by tipo) from public.busca_global(''guarda-chuva'')',
  'post');

-- E A ETAPA COMUM CONTINUA APARECENDO, com a linhagem. Sem este cenario, o
-- filtro de cima passaria por uma busca que perdeu o ramo de etapa inteiro.
insert into public.subtasks (id, task_id, titulo, ordem)
values ('bb000000-0000-0000-0000-00000000b0d2', 'bb000000-0000-0000-0000-00000000b001',
        'Diagramar a lâmina', 10);

select teste.conferir_como(
  'a etapa comum aparece, com Cliente · Demanda no contexto',
  :ANA,
  'select contexto from public.busca_global(''Diagramar'') where tipo = ''etapa''',
  'Mundo Verde · Busca de mídia — Mundo Verde');


-- ===========================================================================
-- 5. O RASCUNHO ENTRA, E E SO O MEU
--
-- A regra escrita diz que rascunho nao entra em lista, board, calendario,
-- Minhas Tasks, contador, relatorio, notificacao nem portal -- e todos aqueles
-- respondem "qual e o trabalho da agencia". A busca responde outra pergunta:
-- "onde esta a coisa que eu tenho em mente", e um rascunho e exatamente a coisa
-- que ninguem acha.
--
-- A trava e a RLS RESTRITIVA da 0028, e nao um filtro na consulta: o que volta
-- e o meu, e nem o socio ve o de outra pessoa.
-- ===========================================================================

insert into public.tasks (id, client_id, titulo, link_entrega, criado_por, publicada_em)
values ('bb000000-0000-0000-0000-00000000b004', :VERDE,
        'Rascunho do Diego sobre bicicletas',
        'https://drive.google.com/drive/folders/b4', :DIEGO, null);

select teste.conferir_como(
  'quem criou acha o proprio rascunho',
  :DIEGO,
  'select count(*)::text from public.busca_global(''bicicletas'')',
  '1');

select teste.conferir_como(
  'e ele vem com o selo Rascunho, que diz que a equipe ainda nao o ve',
  :DIEGO,
  'select selo from public.busca_global(''bicicletas'')',
  'Rascunho');

select teste.conferir_como(
  'NEM O SOCIO acha o rascunho de outra pessoa',
  :ANA,
  'select count(*)::text from public.busca_global(''bicicletas'')',
  '0');


-- ===========================================================================
-- 6. O CORTE DIZ QUANTOS SOBRARAM
--
-- O limite e POR TIPO e nao global: um limite global de dez com trinta
-- demandas casando mostraria ZERO clientes, e quem digita "Mundo" quase sempre
-- quer a empresa.
--
-- E `total` roda ANTES do limite, por janela -- e a unica forma de ele contar o
-- que foi cortado. Somando depois, ele diria seis, e o "e mais N" da tela nunca
-- apareceria: cortar calado faz a pessoa concluir que aquilo e tudo.
-- ===========================================================================

-- VINTE E CINCO FATIAS, E NAO NOVE, e o numero e a diferenca entre medir e
-- afirmar: o teto do `p_limite` e vinte, entao com nove linhas casando uma
-- chamada com `p_limite = 1000` devolve nove grampeada ou nao -- e o cenario
-- passaria nas duas implementacoes. O teste de mutacao mostrou isso: tirar o
-- `least(..., 20)` nao derrubava nada. Com vinte e cinco, ele derruba.
insert into public.tasks (client_id, titulo, link_entrega, criado_por)
select :VERDE,
       'Fatia do bolo numero ' || n,
       'https://drive.google.com/drive/folders/bolo' || n,
       :DIEGO
  from generate_series(1, 25) as n;

select teste.conferir_como(
  'vinte e cinco casam e voltam seis, que e o limite por tipo',
  :ANA,
  'select count(*)::text from public.busca_global(''Fatia do bolo'')',
  '6');

select teste.conferir_como(
  'e o total diz VINTE E CINCO, para a tela poder escrever "e mais 19"',
  :ANA,
  'select distinct total::text from public.busca_global(''Fatia do bolo'')',
  '25');

-- O LIMITE E GRAMPEADO, e nao aceito como vem: sem o teto, um `p_limite` de mil
-- numa chamada montada a mao transforma a busca numa exportacao da agencia.
select teste.conferir_como(
  'p_limite absurdo e grampeado em vinte',
  :ANA,
  'select count(*)::text from public.busca_global(''Fatia do bolo'', 1000)',
  '20');

select teste.conferir_como(
  'p_limite zero nao zera a busca -- o piso e um',
  :ANA,
  'select count(*)::text from public.busca_global(''Fatia do bolo'', 0)',
  '1');


-- ===========================================================================
-- 7. A ORDEM DENTRO DO GRUPO E A POSICAO DO CASAMENTO
--
-- Posicao 1 e casamento no comeco do nome. Digitar "mundo" poe "Mundo Verde"
-- acima de "Feira do Mundo Verde", que e o que a pessoa espera -- e ordenar por
-- data poria a demanda de ontem acima da que tem o nome exato.
-- ===========================================================================

insert into public.tasks (id, client_id, titulo, link_entrega, criado_por)
values
  ('bb000000-0000-0000-0000-00000000b005', :VERDE, 'Zebra listada',
   'https://drive.google.com/drive/folders/b5', :DIEGO),
  ('bb000000-0000-0000-0000-00000000b006', :VERDE, 'Cavalo com zebra ao lado',
   'https://drive.google.com/drive/folders/b6', :DIEGO);

select teste.conferir_como(
  'o casamento no comeco do nome vem primeiro',
  :ANA,
  'select string_agg(titulo, '' | '' order by posicao) from public.busca_global(''zebra'')',
  'Zebra listada | Cavalo com zebra ao lado');


-- ===========================================================================
-- 8. O EQUIPAMENTO ENTRA PELO CODIGO, QUE E A RAZAO DO RAMO EXISTIR
--
-- Ninguem procura "Notebook" numa lista de dez notebooks: procura o numero da
-- etiqueta. E `assets_select` e `is_gestor()` desde a 0069 -- o colaborador
-- chega ao que e dele por `meus_comodatos()`, e nao por aqui.
-- ===========================================================================

insert into public.assets (id, codigo, tipo, nome, marca, modelo, numero_serie, criado_por)
values ('bb000000-0000-0000-0000-00000000b0a1', 'FCK-9001', 'notebook',
        'Notebook de teste', 'Dell', 'Vostro', 'SN-ZZZ-777', :ANA);

select teste.conferir_como(
  'a gestao acha o equipamento pelo codigo de patrimonio',
  :ANA,
  'select count(*)::text from public.busca_global(''FCK-9001'')',
  '1');

select teste.conferir_como(
  'e pelo numero de serie',
  :ANA,
  'select count(*)::text from public.busca_global(''SN-ZZZ'')',
  '1');

-- O COLABORADOR NAO ACHA, e nao e furo: `assets_select` e da gestao porque a
-- linha carrega `valor_aquisicao` e `nota_fiscal_url`, e policy nao limita
-- coluna. A divergencia do texto do sprint na 0069 e exatamente esta.
select teste.conferir_como(
  'o colaborador nao acha equipamento pela busca -- a policy e da gestao',
  :CARLA,
  'select count(*)::text from public.busca_global(''FCK-9001'')',
  '0');


-- ===========================================================================
-- 9. O QUE NENHUMA TELA FAZ: A CHAMADA CRUA
--
-- A action da tela passa por `exigirEquipeNaAcao()`, entao o cliente nao chega
-- na busca pelo produto. Isto mede o que sobra quando alguem monta a chamada a
-- mao com a chave anon -- que e publica e vai no bundle que o navegador baixa.
-- ===========================================================================

select teste.tem_execute(
  'authenticated CHAMA a busca -- e a tela do painel',
  'authenticated', 'public.busca_global(text, integer)', true);

-- `anon` E SEM SESSAO. A funcao respeita a RLS, entao ela nao devolveria nada
-- de qualquer forma -- mas o Supabase concede `execute` de toda funcao nova a
-- `anon` sozinho, e a 0071 e a razao de isto estar escrito: uma funcao nasceu
-- assim e ficou chamavel sem sessao por quatro dezenas de migrations.
select teste.tem_execute(
  'anon NAO chama',
  'anon', 'public.busca_global(text, integer)', false);

-- O PSEUDO-PAPEL `public` NAO PASSA POR `teste.tem_execute`, e a primeira
-- versao deste cenario passava por ele -- e FALHAVA dizendo "o papel public nao
-- existe neste banco". Ele existe: e que PUBLIC nao e linha de `pg_roles`, e
-- `to_regrole('public')` devolve nulo. A guarda daquele auxiliar estava certa e
-- a pergunta estava errada.
--
-- Quem responde e o proprio ACL da funcao, onde a concessao a PUBLIC aparece
-- com `grantee = 0`. E o `revoke ... from public` da 0073 e o que a apaga --
-- sem ele, o Postgres concede `execute` a PUBLIC em toda funcao nova.
select teste.conferir(
  'PUBLIC nao tem execute na busca, e o revoke da 0073 e o que garante',
  (exists (
     select 1
       from pg_proc p, aclexplode(p.proacl) a
      where p.oid = 'public.busca_global(text, integer)'::regprocedure
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE'
   ))::text,
  'false');
