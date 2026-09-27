\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

\set NOTE    '''aa000000-0000-0000-0000-0000000000a1'''
\set CAMERA  '''aa000000-0000-0000-0000-0000000000a2'''
\set LENTE   '''aa000000-0000-0000-0000-0000000000a3'''
\set TRIPE   '''aa000000-0000-0000-0000-0000000000a4'''
-- O EMPRESTIMO DA SECAO 7, e o nome diz que ele e emprestimo: ele nasceu
-- chamado `:TRIPE`, com um uuid de equipamento, e passava -- uuid e uuid.
-- Custou um cenario escrito contra um equipamento que nunca foi cadastrado.
\set L_APAGAR '''bb000000-0000-0000-0000-0000000000b2'''
\set L_NOTE  '''bb000000-0000-0000-0000-0000000000b1'''

-- ===========================================================================
-- 0069 -- Comodatos: qual equipamento esta com qual pessoa
--
-- O que este arquivo persegue:
--
--   1. O QUE O COLABORADOR NAO ALCANCA. A linha de `assets` carrega valor de
--      aquisicao e nota fiscal, e o criterio do sprint diz "nem pela API".
--      Aqui isso e medido na TABELA, e nao na tela.
--   2. UM EMPRESTIMO ATIVO POR EQUIPAMENTO, recusado pelo BANCO.
--   3. O STATUS ESCRITO PELO EMPRESTIMO, inclusive o desvio para manutencao.
--   4. AS DUAS ACOES DO COLABORADOR, e o fato de ele nao ter mais nenhuma.
--   5. O HISTORICO QUE NAO SE APAGA.
-- ===========================================================================
select teste.limpar();

delete from public.asset_events;
delete from public.asset_photos;
delete from public.asset_loans;
delete from public.assets;
delete from public.notifications where tipo = 'comodato';
-- A sequence volta ao comeco para o cenario do FCK-0001 medir o que ele diz
-- medir: sem isto ele passaria com qualquer numero que a rodada anterior
-- tivesse deixado.
alter sequence public.assets_codigo_seq restart with 1;


-- ---------------------------------------------------------------------------
-- 1. CADASTRO E O CODIGO DE PATRIMONIO
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao cadastra um equipamento', :DIEGO,
  format($fmt$insert into public.assets (id, tipo, nome, marca, modelo, numero_serie,
                 valor_aquisicao, criado_por)
          values (%L, 'notebook', 'MacBook Pro 14 M3', 'Apple', 'A2918', 'C02X1',
                  18500.00, %L)$fmt$, :NOTE, :DIEGO),
  'ok', 1);

select teste.conferir(
  'Cadastrar sem codigo gera FCK-0001',
  (select codigo from public.assets where id = :NOTE),
  'FCK-0001');

select teste.cenario('A gestao cadastra o segundo', :DIEGO,
  format($fmt$insert into public.assets (id, tipo, nome, valor_aquisicao, criado_por)
          values (%L, 'camera', 'Sony A7 IV', 22000.00, %L)$fmt$, :CAMERA, :DIEGO),
  'ok', 1);

select teste.conferir(
  'O segundo segue a sequencia',
  (select codigo from public.assets where id = :CAMERA),
  'FCK-0002');

select teste.cenario('O codigo digitado a mao e respeitado', :ANA,
  format($fmt$insert into public.assets (id, codigo, tipo, nome, criado_por)
          values (%L, 'LENTE-50', 'lente', 'Sigma 50mm 1.4', %L)$fmt$, :LENTE, :ANA),
  'ok', 1);

select teste.conferir(
  'O codigo digitado nao foi trocado pelo gerado',
  (select codigo from public.assets where id = :LENTE),
  'LENTE-50');

select teste.cenario('O colaborador nao cadastra equipamento', :BRUNO,
  $$insert into public.assets (tipo, nome) values ('mouse', 'Mouse do Bruno')$$,
  'recusa');

-- BAIXA SEM MOTIVO NAO PASSA: o historico do equipamento e o valor do modulo,
-- e "sumiu" nao e um motivo.
select teste.cenario('Dar baixa exige motivo', :ANA,
  format($fmt$update public.assets set status = 'baixado' where id = %L$fmt$, :LENTE),
  'recusa');

select teste.cenario('Dar baixa com motivo passa', :ANA,
  format($fmt$update public.assets set status = 'baixado', motivo_baixa = 'Vendida'
           where id = %L$fmt$, :LENTE),
  'ok', 1);

-- E O EQUIPAMENTO NAO SE APAGA, nem pelo socio: nao existe policy de DELETE, e
-- e a ausencia que faz "dar baixa" ser o caminho e nao uma sugestao.
select teste.cenario('Nem o socio apaga um equipamento', :ANA,
  format($fmt$delete from public.assets where id = %L$fmt$, :LENTE),
  'recusa');


-- ---------------------------------------------------------------------------
-- 2. EMPRESTAR
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao empresta o notebook para o Bruno', :DIEGO,
  format($fmt$insert into public.asset_loans
            (id, asset_id, user_id, data_entrega, data_prevista_devolucao,
             acessorios, entregue_por)
          values (%L, %L, %L, '2027-03-02', '2027-12-20', 'carregador, capa', %L)$fmt$,
         :L_NOTE, :NOTE, :BRUNO, :DIEGO),
  'ok', 1);

select teste.conferir(
  'O equipamento passou a emprestado',
  (select status::text from public.assets where id = :NOTE),
  'emprestado');

-- A TRAVA DO MODULO, e ela e do BANCO. Sem o indice unico parcial, a tela
-- seria a unica coisa entre um equipamento e duas pessoas.
select teste.cenario('O mesmo equipamento nao vai para duas pessoas', :ANA,
  format($fmt$insert into public.asset_loans (asset_id, user_id, entregue_por)
          values (%L, %L, %L)$fmt$, :NOTE, :MARINA, :ANA),
  'recusa');

select teste.cenario('O colaborador nao empresta nada', :BRUNO,
  format($fmt$insert into public.asset_loans (asset_id, user_id, entregue_por)
          values (%L, %L, %L)$fmt$, :CAMERA, :BRUNO, :BRUNO),
  'recusa');

select teste.conferir(
  'Quem recebeu foi avisado',
  (select count(*)::text from public.notifications
    where user_id = :BRUNO and tipo = 'comodato'),
  '1');

select teste.conferir(
  'A entrega virou evento na folha do equipamento',
  (select count(*)::text from public.asset_events
    where asset_id = :NOTE and tipo = 'emprestado'),
  '1');


-- ---------------------------------------------------------------------------
-- 3. O QUE O COLABORADOR NAO ALCANCA
--
-- E AQUI QUE O ARQUIVO GANHA O SALARIO. O sprint deixava `assets` legivel para
-- quem tem o equipamento e mandava esconder o valor numa view -- e view nao
-- limita a tabela de baixo. Estes tres cenarios medem a tabela.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'O colaborador nao le assets, nem o que esta com ele',
  :BRUNO,
  'select count(*) from public.assets',
  '0');

select teste.conferir_como(
  'E nem o valor de aquisicao, que e o que a policy protege',
  :BRUNO,
  'select count(*) from public.assets where valor_aquisicao is not null',
  '0');

-- A METADE POSITIVA: sem ela, uma policy que recusasse TODO MUNDO passaria
-- nos dois cenarios de cima.
select teste.conferir_como(
  'A gestao le o inventario inteiro',
  :DIEGO,
  'select count(*) from public.assets',
  '3');

select teste.conferir_como(
  'O colaborador ve o proprio comodato por meus_comodatos()',
  :BRUNO,
  'select count(*) from public.meus_comodatos()',
  '1');

-- A FUNCAO NAO DEVOLVE A COLUNA, e este cenario e o que impede alguem de
-- acrescenta-la "para a tela mostrar o patrimonio": o dia em que ela voltar,
-- este cenario para de recusar.
select teste.cenario('meus_comodatos() nao tem valor_aquisicao', :BRUNO,
  'select valor_aquisicao from public.meus_comodatos()',
  'recusa');

select teste.conferir_como(
  'Um colega nao ve o comodato do Bruno',
  :MARINA,
  'select count(*) from public.asset_loans',
  '0');

select teste.conferir_como(
  'O Bruno ve o comodato dele na tabela',
  :BRUNO,
  'select count(*) from public.asset_loans',
  '1');

select teste.conferir_como(
  'E a folha corrida do equipamento e da gestao',
  :BRUNO,
  'select count(*) from public.asset_events',
  '0');

select teste.conferir_como(
  'A gestao le a folha corrida',
  :DIEGO,
  'select count(*) from public.asset_events where asset_id = ' || quote_literal(:NOTE) || '::uuid',
  '2');


-- ---------------------------------------------------------------------------
-- 4. O ACEITE
-- ---------------------------------------------------------------------------
-- SEM POLICY DE UPDATE PARA ELE, e por isso nao ha coluna a proteger: o PATCH
-- montado a mao nao encontra linha nenhuma para escrever.
select teste.cenario('O colaborador nao carimba o aceite por update direto', :BRUNO,
  format($fmt$update public.asset_loans set aceito_em = now()
           where user_id = %L$fmt$, :BRUNO),
  'ok', 0);

-- O ID VAI LITERAL, e nao por subconsulta, e a diferenca e o teste inteiro.
-- Com `(select id from asset_loans where asset_id = ...)` a Marina nao enxerga
-- a linha do Bruno pelo RLS, a subconsulta devolve null, e a funcao recusa com
-- "esse comodato nao existe" -- o cenario ficava VERDE medindo a policy de
-- SELECT, que ja tem cenario proprio, em vez da pergunta de dono que ele diz
-- medir. A mutacao mostrou: tirei a pergunta de dentro da funcao e ele
-- continuou passando. Com o id na mao, a funcao recebe um comodato de verdade
-- e so a pergunta de dono a separa do update.
select teste.cenario('Um colega nao confirma o recebimento alheio', :MARINA,
  format($fmt$select public.confirmar_recebimento(%L)$fmt$, :L_NOTE),
  'recusa');

select teste.cenario('A pessoa confirma o recebimento', :BRUNO,
  format($fmt$select public.confirmar_recebimento(%L)$fmt$, :L_NOTE),
  'ok', 1);

select teste.conferir(
  'O aceite ficou gravado',
  (select (aceito_em is not null)::text from public.asset_loans where asset_id = :NOTE),
  'true');

-- O SEGUNDO CLIQUE NAO REESCREVE A DATA. Sem esta linha, recarregar a tela e
-- clicar de novo moveria a hora do aceite -- e o aceite e o que a agencia mostra
-- quando alguem pergunta desde quando o equipamento esta com a pessoa.
select teste.cenario('Confirmar de novo nao e erro', :BRUNO,
  format($fmt$select public.confirmar_recebimento(%L)$fmt$, :L_NOTE),
  'ok', 1);

select teste.conferir(
  'E nao gravou um segundo aceite na folha',
  (select count(*)::text from public.asset_events
    where asset_id = :NOTE and tipo = 'aceito'),
  '1');


-- ---------------------------------------------------------------------------
-- 5. REPORTAR PROBLEMA
-- ---------------------------------------------------------------------------
select teste.cenario('Reportar sem texto e recusado', :BRUNO,
  format($fmt$select public.reportar_problema_do_comodato(%L, '   ')$fmt$, :L_NOTE),
  'recusa');

select teste.cenario('A pessoa reporta um problema', :BRUNO,
  format($fmt$select public.reportar_problema_do_comodato(%L, 'A tampa esta soltando')$fmt$, :L_NOTE),
  'ok', 1);

select teste.conferir(
  'O relato virou evento, e nao so sino',
  (select texto from public.asset_events
    where asset_id = :NOTE and tipo = 'problema'),
  'A tampa esta soltando');

-- E ELE NAO MEXE NO STATUS: quem avalia e a gestao. Mandar o equipamento para
-- manutencao no clique de quem o usa tiraria dela a decisao.
select teste.conferir(
  'O status continua emprestado',
  (select status::text from public.assets where id = :NOTE),
  'emprestado');

select teste.cenario('Ninguem reporta problema do equipamento alheio', :MARINA,
  format($fmt$select public.reportar_problema_do_comodato(%L, 'quebrou')$fmt$, :L_NOTE),
  'recusa');


-- ---------------------------------------------------------------------------
-- 6. DEVOLVER
-- ---------------------------------------------------------------------------
select teste.cenario('O colaborador nao devolve sozinho', :BRUNO,
  format($fmt$update public.asset_loans
             set data_devolucao = current_date, estado_devolucao = 'bom'
           where asset_id = %L$fmt$, :NOTE),
  'ok', 0);

-- O PAR INTEIRO: devolucao sem estado perde exatamente o que a devolucao
-- existe para registrar.
select teste.cenario('Devolver sem dizer o estado e recusado', :DIEGO,
  format($fmt$update public.asset_loans set data_devolucao = '2027-06-10'
           where asset_id = %L$fmt$, :NOTE),
  'recusa');

select teste.cenario('A gestao registra a devolucao', :DIEGO,
  format($fmt$update public.asset_loans
             set data_devolucao = '2027-06-10', estado_devolucao = 'bom',
                 recebido_por = %L
           where asset_id = %L$fmt$, :DIEGO, :NOTE),
  'ok', 1);

select teste.conferir(
  'O equipamento voltou para disponivel',
  (select status::text from public.assets where id = :NOTE),
  'disponivel');

-- O DESVIO PARA MANUTENCAO: devolver um equipamento quebrado para a prateleira
-- e emprestar o problema para a proxima pessoa.
select teste.cenario('A camera vai para a Marina', :DIEGO,
  format($fmt$insert into public.asset_loans (asset_id, user_id, entregue_por)
          values (%L, %L, %L)$fmt$, :CAMERA, :MARINA, :DIEGO),
  'ok', 1);

select teste.cenario('E volta com o estado ruim', :DIEGO,
  format($fmt$update public.asset_loans
             set data_devolucao = current_date, estado_devolucao = 'ruim',
                 recebido_por = %L
           where asset_id = %L$fmt$, :DIEGO, :CAMERA),
  'ok', 1);

select teste.conferir(
  'Estado ruim manda para manutencao, nao para a prateleira',
  (select status::text from public.assets where id = :CAMERA),
  'manutencao');

select teste.conferir(
  'E a manutencao virou linha na folha corrida',
  (select count(*)::text from public.asset_events
    where asset_id = :CAMERA and tipo = 'manutencao'),
  '1');


-- ---------------------------------------------------------------------------
-- 7. O HISTORICO NAO SE APAGA
-- ---------------------------------------------------------------------------
select teste.cenario('Emprestimo em aberto se apaga', :DIEGO,
  format($fmt$insert into public.asset_loans (id, asset_id, user_id, entregue_por)
          values (%L, %L, %L, %L)$fmt$, :L_APAGAR, :NOTE, :MARINA, :DIEGO),
  'ok', 1);

select teste.cenario('...e some de verdade', :DIEGO,
  format($fmt$delete from public.asset_loans where id = %L$fmt$, :L_APAGAR),
  'ok', 1);

-- NEM O SOCIO. O emprestimo devolvido e a resposta de "eu devolvi em marco", e
-- e a unica coisa que a pessoa tem para se defender.
select teste.cenario('Emprestimo devolvido nao se apaga, nem pelo socio', :ANA,
  format($fmt$delete from public.asset_loans
           where asset_id = %L and data_devolucao is not null$fmt$, :NOTE),
  'ok', 0);

select teste.conferir(
  'O devolvido continua la',
  (select count(*)::text from public.asset_loans
    where asset_id = :NOTE and data_devolucao is not null),
  '1');


-- ---------------------------------------------------------------------------
-- 8. O MODELO DO TERMO
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'A equipe le o modelo do termo',
  :BRUNO,
  'select count(*) from public.asset_term_template',
  '1');

-- SO O SOCIO ESCREVE: este texto e o que a agencia afirma por escrito para
-- cada pessoa da equipe, e quem responde por isso responde pela empresa.
select teste.cenario('O desenvolvedor nao reescreve o termo', :DIEGO,
  $$update public.asset_term_template set corpo = 'Outro texto' where unica$$,
  'ok', 0);

select teste.cenario('O socio reescreve o termo', :ANA,
  $$update public.asset_term_template set corpo = corpo || ' ' where unica$$,
  'ok', 1);

select teste.conferir_como(
  'O cliente nao alcanca o termo',
  :JOANA,
  'select count(*) from public.asset_term_template',
  '0');

-- ---------------------------------------------------------------------------
-- E O TERMO DE UM COMODATO NAO ANDA COM O MODELO
--
-- Este e o cenario que separa "ler o modelo na hora de imprimir" de "congelar
-- o texto na entrega". Sem ele, a diferenca entre as duas so apareceria no dia
-- em que o socio reescrevesse o termo -- e o que mudaria seria o documento de
-- um comodato de dois anos atras, que e a coisa que nao pode mudar. E a
-- decisao de `workflow_snapshot` desde a 0008.
-- ---------------------------------------------------------------------------
select teste.conferir(
  'O comodato do Bruno guardou o texto do termo',
  (select (termo_corpo like 'TERMO DE COMODATO%')::text
     from public.asset_loans where id = :L_NOTE),
  'true');

select teste.cenario('O socio reescreve o modelo inteiro', :ANA,
  $$update public.asset_term_template set corpo = 'Modelo novo, de hoje' where unica$$,
  'ok', 1);

select teste.conferir(
  'E o termo do comodato antigo continua o de antes',
  (select (termo_corpo like 'TERMO DE COMODATO%')::text
     from public.asset_loans where id = :L_NOTE),
  'true');

-- A METADE POSITIVA: o comodato NOVO nasce com o texto novo. Sem ela, um
-- trigger que nunca copiasse nada passaria no cenario de cima.
select teste.cenario('O tripe sai depois da troca do modelo', :DIEGO,
  format($fmt$insert into public.asset_loans (asset_id, user_id, entregue_por)
          values (%L, %L, %L)$fmt$, :CAMERA, :BRUNO, :DIEGO),
  'ok', 1);

select teste.conferir(
  'O comodato novo nasceu com o modelo novo',
  (select termo_corpo from public.asset_loans
    where asset_id = :CAMERA and data_devolucao is null),
  'Modelo novo, de hoje');


-- ---------------------------------------------------------------------------
-- 9. O DESLIGAMENTO PRECISA SABER
-- ---------------------------------------------------------------------------
select teste.cenario('A Marina fica com a lente do tripe', :DIEGO,
  format($fmt$insert into public.asset_loans (asset_id, user_id, entregue_por)
          values (%L, %L, %L)$fmt$, :NOTE, :MARINA, :DIEGO),
  'ok', 1);

select teste.conferir_como(
  'A gestao ve o que esta com a pessoa antes de desligar',
  :DIEGO,
  'select count(*) from public.comodatos_em_aberto_de(' || quote_literal(:MARINA) || '::uuid)',
  '1');

select teste.conferir_como(
  'E o colaborador nao usa essa porta para ler o dos outros',
  :BRUNO,
  'select count(*) from public.comodatos_em_aberto_de(' || quote_literal(:MARINA) || '::uuid)',
  '0');

select teste.conferir_como(
  'O cliente nao alcanca comodato nenhum',
  :JOANA,
  'select count(*) from public.asset_loans',
  '0');


-- ---------------------------------------------------------------------------
-- 10. A FICHA TECNICA (0070)
--
-- Quatro colunas de texto, e o que precisa ser provado nao e que `text` aceita
-- texto: e que elas ficam DO LADO DE DENTRO da trava que a 0069 pos em
-- `assets`. `valor_aquisicao` e `nota_fiscal_url` ja estavam fora do alcance
-- do colaborador porque `assets_select` e `is_gestor()`; a ficha nasce na
-- mesma linha, entao ela herda a mesma regra -- e o cenario existe para o dia
-- em que alguem abrir `assets_select` achando que "especificacao de maquina
-- nao e sigilo" e levar o valor de compra junto.
-- ---------------------------------------------------------------------------
select teste.cenario('A gestao preenche a ficha tecnica do notebook', :DIEGO,
  format($fmt$update public.assets
             set memoria_ram = '16 GB',
                 processador = 'Apple M3 Pro',
                 armazenamento = '512 GB SSD'
           where id = %L$fmt$, :NOTE),
  'ok', 1);

select teste.conferir_como(
  'E ela fica gravada como foi escrita',
  :DIEGO,
  'select memoria_ram || '' / '' || armazenamento from public.assets where id = '
    || quote_literal(:NOTE) || '::uuid',
  '16 GB / 512 GB SSD');

-- A METADE QUE IMPORTA: quem esta COM o notebook continua sem ler a linha de
-- `assets`. O recorte dele e `meus_comodatos()`, e a ficha nao entra nele --
-- ele ja sabe o que tem na maquina, ela esta na mesa dele.
select teste.conferir_como(
  'O colaborador nao le a linha do equipamento nem para ver a ficha',
  :MARINA,
  'select count(*) from public.assets where memoria_ram is not null',
  '0');

-- E A FICHA NAO E DE COMPUTADOR SO, pelo lado do banco: nao ha `check` por
-- tipo, de proposito. Um tripe com processador e bobagem; uma mesa
-- digitalizadora com processador proprio nao e, e recusar no banco chegaria
-- como erro numa tela de cadastro. Quem esconde e a tela.
select teste.cenario('A gestao cadastra um tripe', :DIEGO,
  format($fmt$insert into public.assets (id, tipo, nome, criado_por)
          values (%L, 'tripe', 'Manfrotto 190', %L)$fmt$, :TRIPE, :DIEGO),
  'ok', 1);

select teste.cenario('E o banco aceita ficha em equipamento que nao e computador', :DIEGO,
  format($fmt$update public.assets set processador = 'chip proprio' where id = %L$fmt$, :TRIPE),
  'ok', 1);
