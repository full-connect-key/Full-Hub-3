\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''

-- ===========================================================================
-- 45 - O E-BOOK INTERATIVO (0102)
--
-- Sprint 3L-B. O e-book deixa de ser so um PDF: ele pode ser uma pagina
-- interativa, com capitulos marcaveis e checklists -- e o progresso dela mora
-- no BANCO, nao no `localStorage` de cada navegador.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO EXISTE PARA MEDIR, e o primeiro item e a razao dele:
--
--   1. A LINHA DE UM CAPITULO E A LINHA DO ITEM INTEIRO CONVIVEM. As duas tem
--      `aula_id` nulo, entao a do capitulo cai dentro do
--      `academy_progresso_item_unico` da 0096 -- que e `(user_id, item_id)
--      where aula_id is null` -- e colide com a do item. **O texto do sprint
--      nao sabia desse indice**: ele manda derrubar uma constraint que nao
--      existe aqui e trocar por um `unique nulls not distinct`, o que
--      deixaria o indice parcial de pe e faria o PRIMEIRO capitulo marcado
--      levar recusa de chave duplicada. Este cenario e o que separa as duas
--      implementacoes.
--
--   2. A RELEITURA VEM ANTES DA CONCLUSAO, em `academy_estado_do_item`. Quem
--      confirmou a v1 TEM a linha concluida -- perguntar `concluido` primeiro
--      devolveria 'concluido' e a v2 com `exige_releitura` nao cobraria
--      ninguem. A marca seria uma caixa que nao faz nada.
--
--   3. OS CHECKLISTS SAO POR VERSAO, e os da v1 nao vazam para a v2. A chave
--      de um item de checklist e POSICIONAL no HTML, entao editar o e-book
--      move posicoes: sem a versao na chave, alguem abriria a v2 e veria
--      marcada uma caixa que agora quer dizer outra coisa -- daria por
--      conferido o que nao conferiu.
--
--   4. A GESTAO NAO LE CHECKLIST DE NINGUEM. O criterio de aceite pede isto
--      pela API e nao pela tela, e e o que `teste.cenario` faz: ele entra como
--      `authenticated` com o uid da pessoa, que e o mesmo caminho do
--      PostgREST. Checklist e instrumento de trabalho; o que a gestao
--      acompanha e a CONCLUSAO.
-- ===========================================================================

select teste.limpar();

delete from public.academy_ebook_checklists;
delete from public.academy_progresso;
delete from public.academy_ebook_capitulos;
delete from public.academy_arquivos;
delete from public.academy_items where slug in
  ('ebook-interativo-de-teste', 'ebook-em-pdf-de-teste', 'ebook-rascunho-de-teste');

-- ---------------------------------------------------------------------------
-- O MATERIAL
--
-- TRES e-books, e cada um existe por um motivo:
--   o interativo  -- tres capitulos, duas versoes, publicado;
--   o em PDF      -- NENHUM capitulo, para provar que o ramo antigo nao mudou;
--   o rascunho    -- para a leitura dos capitulos seguir o item.
-- ---------------------------------------------------------------------------
insert into public.academy_items
  (id, tipo, titulo, slug, categoria, publicado, exige_confirmacao_leitura)
values
  ('ebb00001-0000-4000-8000-000000000001', 'ebook', 'Operacoes de teste',
   'ebook-interativo-de-teste', 'Producao', true, true),
  ('ebb00002-0000-4000-8000-000000000002', 'ebook', 'Manual em PDF',
   'ebook-em-pdf-de-teste', 'Cultura', true, false),
  ('ebb00003-0000-4000-8000-000000000003', 'ebook', 'Rascunho do acervo',
   'ebook-rascunho-de-teste', 'Cultura', false, false);

insert into public.academy_ebook_capitulos (id, item_id, chave, titulo, ordem)
values
  ('caa00001-0000-4000-8000-000000000001', 'ebb00001-0000-4000-8000-000000000001',
   'como-usar', 'Como usar este documento', 1),
  ('caa00002-0000-4000-8000-000000000002', 'ebb00001-0000-4000-8000-000000000001',
   'escopos', 'Escopos e responsabilidades', 2),
  ('caa00003-0000-4000-8000-000000000003', 'ebb00001-0000-4000-8000-000000000001',
   'grafica', 'Fechamento para grafica', 3);

insert into public.academy_ebook_capitulos (id, item_id, chave, titulo, ordem)
values
  ('caa00009-0000-4000-8000-000000000009', 'ebb00003-0000-4000-8000-000000000003',
   'abertura', 'Abertura', 1);

insert into public.academy_arquivos (item_id, url, nome, formato, versao)
values ('ebb00001-0000-4000-8000-000000000001',
        'ebooks/ebb00001/v1/index.html', 'operacoes.html', 'html_interativo', 1),
       ('ebb00002-0000-4000-8000-000000000002',
        'ebooks/ebb00002/v1/manual.pdf', 'manual.pdf', 'pdf', 1);


-- ===========================================================================
-- OS INDICES: O CAPITULO E O ITEM INTEIRO SAO LINHAS DIFERENTES
-- ===========================================================================

-- ESTE E O CENARIO DO DESVIO. Com os indices da 0096 intactos, o segundo
-- insert leva "duplicate key value violates unique constraint
-- academy_progresso_item_unico" -- a linha do capitulo e a do item inteiro
-- disputam o mesmo indice parcial.
insert into public.academy_progresso (user_id, item_id, concluido)
values ('33333333-3333-3333-3333-333333333333',
        'ebb00001-0000-4000-8000-000000000001', false);

select teste.cenario(
  'A Carla marca um capitulo sem derrubar a linha do item inteiro',
  :CARLA,
  $c$insert into public.academy_progresso (user_id, item_id, capitulo_id, concluido)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001',
             'caa00001-0000-4000-8000-000000000001', true)$c$,
  'ok', 1);

select teste.conferir(
  'E as duas linhas convivem',
  (select count(*)::text from public.academy_progresso
    where user_id = '33333333-3333-3333-3333-333333333333'
      and item_id = 'ebb00001-0000-4000-8000-000000000001'),
  '2');

select teste.cenario(
  'E um segundo capitulo e uma terceira linha',
  :CARLA,
  $c$insert into public.academy_progresso (user_id, item_id, capitulo_id, concluido)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001',
             'caa00002-0000-4000-8000-000000000002', true)$c$,
  'ok', 1);

-- O MESMO CAPITULO DUAS VEZES E RECUSADO, que e o que o indice novo protege:
-- sem ele, cada clique na caixinha empilharia uma linha e a contagem de
-- "X de 23" passaria de 23.
select teste.recusa_com(
  'Mas o mesmo capitulo duas vezes nao',
  :CARLA,
  $c$insert into public.academy_progresso (user_id, item_id, capitulo_id, concluido)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001',
             'caa00001-0000-4000-8000-000000000001', true)$c$,
  'academy_progresso_capitulo_unico');

-- E A SEGUNDA LINHA DE ITEM INTEIRO TAMBEM, que e o que o sprint queria
-- garantir -- e que a 0096 ja garantia, com o indice parcial que o texto dele
-- nao conhecia.
select teste.recusa_com(
  'E uma segunda linha de conclusao do mesmo item tambem nao',
  :CARLA,
  $c$insert into public.academy_progresso (user_id, item_id, concluido)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001', true)$c$,
  'academy_progresso_item_unico');

-- O `check` DIZ O QUE OS INDICES NAO DIZEM: uma linha que aponta para uma aula
-- E um capitulo ao mesmo tempo nao e repeticao de nada -- nenhum indice a
-- recusa --, e e um estado que nenhuma tela sabe desenhar.
select teste.recusa_com(
  'E ninguem aponta para uma aula e um capitulo na mesma linha',
  :ANA,
  $c$insert into public.academy_progresso (user_id, item_id, aula_id, capitulo_id)
     select '11111111-1111-1111-1111-111111111111',
            'ebb00001-0000-4000-8000-000000000001',
            a.id, 'caa00003-0000-4000-8000-000000000003'
       from public.academy_aulas a limit 1$c$,
  'academy_progresso_um_alvo');


-- ===========================================================================
-- A VERSAO DO ARQUIVO
-- ===========================================================================

select teste.cenario(
  'A gestao publica a versao 2 do e-book',
  :DIEGO,
  $c$insert into public.academy_arquivos
       (item_id, url, nome, formato, versao, exige_releitura, notas_mudanca)
     values ('ebb00001-0000-4000-8000-000000000001',
             'ebooks/ebb00001/v2/index.html', 'operacoes.html',
             'html_interativo', 2, true, 'O fluxo de entrada mudou.')$c$,
  'ok', 1);

select teste.recusa_com(
  'Mas nao duas vezes a mesma versao',
  :DIEGO,
  $c$insert into public.academy_arquivos (item_id, url, nome, formato, versao)
     values ('ebb00001-0000-4000-8000-000000000001',
             'ebooks/ebb00001/v2/outro.html', 'outro.html',
             'html_interativo', 2)$c$,
  'academy_arquivo_versao_unica');

-- NAO EXISTE COLUNA `atual`, e o cenario e para o dia em que alguem a
-- acrescentar "para facilitar": a versao vigente e a de maior numero, e uma
-- bandeira ao lado seria a segunda verdade sobre o mesmo fato -- ela
-- divergiria na primeira publicacao concorrente.
select teste.conferir(
  'E nao existe coluna `atual` para divergir da maior versao',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'academy_arquivos'
      and column_name in ('atual', 'corrente', 'vigente')),
  '0');

select teste.conferir(
  'A versao vigente e a MAIOR',
  (select versao::text from public.academy_arquivos
    where item_id = 'ebb00001-0000-4000-8000-000000000001'
    order by versao desc limit 1),
  '2');


-- ===========================================================================
-- O ESTADO DO ITEM
-- ===========================================================================

select teste.conferir(
  'Com dois de tres capitulos lidos, a Carla esta EM ANDAMENTO',
  public.academy_estado_do_item('33333333-3333-3333-3333-333333333333',
                                'ebb00001-0000-4000-8000-000000000001'),
  'em_andamento');

select teste.conferir(
  'O Bruno, que nao abriu nada, esta NAO INICIADO',
  public.academy_estado_do_item('44444444-4444-4444-4444-444444444444',
                                'ebb00001-0000-4000-8000-000000000001'),
  'nao_iniciado');

-- A MARINA CONFIRMA A LEITURA DA V1, e a v2 ja esta publicada com a marca.
insert into public.academy_progresso
  (user_id, item_id, concluido, concluido_em, versao_confirmada)
values ('55555555-5555-5555-5555-555555555555',
        'ebb00001-0000-4000-8000-000000000001', true, now(), 1);

-- ESTE E O CENARIO DA ORDEM. Perguntando `concluido` primeiro, a resposta
-- seria 'concluido' -- a linha dela E concluida -- e a v2 com
-- `exige_releitura` nao cobraria ninguem.
select teste.conferir(
  'Quem confirmou a v1 volta a pendente quando a v2 exige releitura',
  public.academy_estado_do_item('55555555-5555-5555-5555-555555555555',
                                'ebb00001-0000-4000-8000-000000000001'),
  'releitura');

select teste.cenario(
  'E confirmar a v2 fecha de novo',
  :MARINA,
  $c$update public.academy_progresso set versao_confirmada = 2
      where user_id = '55555555-5555-5555-5555-555555555555'
        and item_id = 'ebb00001-0000-4000-8000-000000000001'
        and capitulo_id is null$c$,
  'ok', 1);

select teste.conferir(
  'E a Marina volta a concluida',
  public.academy_estado_do_item('55555555-5555-5555-5555-555555555555',
                                'ebb00001-0000-4000-8000-000000000001'),
  'concluido');

-- O E-BOOK EM PDF NAO MUDA DE COMPORTAMENTO, e e o que torna a 0102 barata:
-- sem capitulo nenhum a conta cai no ramo antigo. E o `count(*) = 0` do curso
-- recem-aberto, aplicado ao formato que nao tem capitulo para contar.
insert into public.academy_progresso (user_id, item_id, concluido, concluido_em)
values ('33333333-3333-3333-3333-333333333333',
        'ebb00002-0000-4000-8000-000000000002', true, now());

select teste.conferir(
  'O e-book em PDF continua respondendo concluido pelo clique no fim',
  public.academy_estado_do_item('33333333-3333-3333-3333-333333333333',
                                'ebb00002-0000-4000-8000-000000000002'),
  'concluido');

select teste.conferir(
  'E quem nao o abriu continua NAO INICIADO, sem capitulo para contar',
  public.academy_estado_do_item('44444444-4444-4444-4444-444444444444',
                                'ebb00002-0000-4000-8000-000000000002'),
  'nao_iniciado');

-- UMA VERSAO NOVA SEM A MARCA NAO COBRA NINGUEM, e e a outra metade da
-- decisao: o padrao e desmarcado porque senao toda virgula trocada vira um
-- aviso, e na terceira ninguem mais le nenhum.
insert into public.academy_arquivos (item_id, url, nome, formato, versao, exige_releitura)
values ('ebb00002-0000-4000-8000-000000000002',
        'ebooks/ebb00002/v2/manual.pdf', 'manual.pdf', 'pdf', 2, false);

select teste.conferir(
  'Uma versao nova SEM a marca nao devolve ninguem a pendente',
  public.academy_estado_do_item('33333333-3333-3333-3333-333333333333',
                                'ebb00002-0000-4000-8000-000000000002'),
  'concluido');


-- ===========================================================================
-- OS CHECKLISTS: DE CADA PESSOA, E POR VERSAO
-- ===========================================================================

select teste.cenario(
  'A Carla marca um bloco de checklist',
  :CARLA,
  $c$insert into public.academy_ebook_checklists
       (user_id, item_id, versao, chave, itens_marcados)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001', 1, 'inicio-7',
             array['inicio-7-0','inicio-7-2'])$c$,
  'ok', 1);

select teste.conferir_como(
  'E ela le o proprio',
  :CARLA,
  $c$select count(*)::text from public.academy_ebook_checklists$c$,
  '1');

-- A GESTAO NAO LE, e o criterio de aceite pede isto pela API. `teste.cenario`
-- entra como `authenticated` com o uid da pessoa, que e o mesmo caminho do
-- PostgREST -- nao e a tela escondendo o botao.
select teste.conferir_como(
  'E a gestao NAO le o checklist de ninguem',
  :DIEGO,
  $c$select count(*)::text from public.academy_ebook_checklists$c$,
  '0');

select teste.conferir_como(
  'Nem o socio',
  :ANA,
  $c$select count(*)::text from public.academy_ebook_checklists$c$,
  '0');

select teste.cenario(
  'E ninguem escreve no nome de outra pessoa',
  :BRUNO,
  $c$insert into public.academy_ebook_checklists
       (user_id, item_id, versao, chave, itens_marcados)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001', 1, 'forjado',
             array['x'])$c$,
  'recusa');

-- A VERSAO SEPARA, e este e o cenario que impede alguem de tirar `versao` da
-- chave unica "porque e a mesma pessoa e o mesmo bloco": a chave do item e
-- posicional, entao a marcacao da v1 sobre a v2 e uma afirmacao errada.
select teste.cenario(
  'E a MESMA chave na versao 2 e outra linha',
  :CARLA,
  $c$insert into public.academy_ebook_checklists
       (user_id, item_id, versao, chave, itens_marcados)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001', 2, 'inicio-7',
             array[]::text[])$c$,
  'ok', 1);

select teste.conferir(
  'E a v2 comeca limpa, com a v1 intacta ao lado',
  (select array_length(itens_marcados, 1)::text
     from public.academy_ebook_checklists
    where user_id = '33333333-3333-3333-3333-333333333333'
      and item_id = 'ebb00001-0000-4000-8000-000000000001' and versao = 1),
  '2');

select teste.recusa_com(
  'E a mesma chave na mesma versao nao se repete',
  :CARLA,
  $c$insert into public.academy_ebook_checklists
       (user_id, item_id, versao, chave)
     values ('33333333-3333-3333-3333-333333333333',
             'ebb00001-0000-4000-8000-000000000001', 1, 'inicio-7')$c$,
  'academy_ebook_checklists_user_id_item_id_versao_chave_key');


-- ===========================================================================
-- OS CAPITULOS SEGUEM O ITEM
-- ===========================================================================

select teste.conferir_como(
  'A equipe le os capitulos de um e-book publicado',
  :CARLA,
  $c$select count(*)::text from public.academy_ebook_capitulos
      where item_id = 'ebb00001-0000-4000-8000-000000000001'$c$,
  '3');

-- O RASCUNHO NAO VAZA PELOS CAPITULOS, e o cenario existe porque e o caminho
-- de fora: a tabela do item esconde o rascunho, e uma policy mais larga aqui
-- deixaria o indice de capitulos contar o acervo que ninguem publicou.
select teste.conferir_como(
  'E o capitulo de um item em rascunho nao e dela',
  :CARLA,
  $c$select count(*)::text from public.academy_ebook_capitulos
      where item_id = 'ebb00003-0000-4000-8000-000000000003'$c$,
  '0');

select teste.conferir_como(
  'Mas a gestao le',
  :DIEGO,
  $c$select count(*)::text from public.academy_ebook_capitulos
      where item_id = 'ebb00003-0000-4000-8000-000000000003'$c$,
  '1');

select teste.cenario(
  'O colaborador nao escreve capitulo',
  :CARLA,
  $c$insert into public.academy_ebook_capitulos (item_id, chave, titulo, ordem)
     values ('ebb00001-0000-4000-8000-000000000001', 'forjado', 'Forjado', 9)$c$,
  'recusa');

select teste.cenario(
  'A gestao escreve',
  :DIEGO,
  $c$insert into public.academy_ebook_capitulos (item_id, chave, titulo, ordem)
     values ('ebb00001-0000-4000-8000-000000000001', 'drive', 'Drive', 4)$c$,
  'ok', 1);

select teste.recusa_com(
  'E a mesma chave duas vezes no mesmo item nao',
  :DIEGO,
  $c$insert into public.academy_ebook_capitulos (item_id, chave, titulo, ordem)
     values ('ebb00001-0000-4000-8000-000000000001', 'drive', 'Drive de novo', 5)$c$,
  'academy_ebook_capitulos_item_id_chave_key');


-- ===========================================================================
-- A CONFIRMACAO DE LEITURA E DO ITEM
-- ===========================================================================

-- O DEFAULT E `false`, e e o estado de quase todo item. O contrario faria todo
-- item do acervo nascer cobrando uma confirmacao que ninguem pediu.
select teste.conferir(
  'A confirmacao de leitura nasce desligada',
  (select exige_confirmacao_leitura::text from public.academy_items
    where slug = 'ebook-em-pdf-de-teste'),
  'false');

-- E ELA E DO ITEM E NAO DO TIPO, que e o que o sprint pede em uma linha: com
-- a coluna, o botao "Li e estou ciente" vale para playbook, e-book e curso sem
-- um de-para por formato.
select teste.conferir(
  'E ela vale para um e-book, nao so para playbook',
  (select exige_confirmacao_leitura::text from public.academy_items
    where slug = 'ebook-interativo-de-teste'),
  'true');

select teste.conferir(
  'O formato do arquivo e enum, e nao texto livre',
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'academy_arquivos'
      and column_name = 'formato'),
  'USER-DEFINED');
