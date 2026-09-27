\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set MARINA  '''55555555-5555-5555-5555-555555555555'''
\set RAFAEL  '''66666666-6666-6666-6666-666666666666'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''

-- ===========================================================================
-- 0065 -- A nota fiscal da pessoa
--
-- O que este arquivo persegue:
--
--   1. QUEM VE. A propria pessoa e o socio. O desenvolvedor NAO -- ele e
--      gestao para todo o resto do sistema e aqui nao, porque ler esta tabela
--      e ler quanto cada colega ganha.
--   2. QUEM DECIDE. So o socio aprova, recusa e paga. E o colaborador nao
--      carimba a propria nota como paga nem por PATCH montado a mao.
--   3. O QUE CADA LADO MEXE. O socio nao reescreve o valor declarado; a pessoa
--      nao mexe na decisao. Policy nao limita coluna, entao quem separa e o
--      trigger -- e ele RECUSA em vez de reescrever.
--   4. A NOTA PAGA VIRA DESPESA, uma vez so, com o valor certo.
--   5. O HISTORICO DA RECUSA. Uma nota viva por mes, e as recusadas acumulam.
-- ===========================================================================
-- `teste.limpar()` e NAO `truncate teste.resultado`: quem zera a tabela de
-- resultados e o 01, que roda primeiro. Truncar aqui apagaria os mil e tantos
-- cenarios dos arquivos anteriores, e a rodada terminaria dizendo "todos
-- passaram" sobre os quarenta e cinco deste arquivo.
select teste.limpar();

delete from public.finance_entries;
delete from public.team_invoices;


-- ---------------------------------------------------------------------------
-- 1. ENVIAR
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno envia a nota dele de setembro', :BRUNO,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, numero, arquivo_url)
          values (%L, '2027-09-14', 4200.00, '000123', 'nf/bruno-setembro.pdf')$fmt$, :BRUNO),
  'ok', 1);

-- A COMPETENCIA VAI PARA O DIA 1, e nao e cosmetico: e o que faz o indice
-- unico enxergar duas notas do mesmo mes como o mesmo mes.
select teste.conferir(
  'A competencia foi gravada no dia 1',
  (select competencia::text from public.team_invoices where user_id = :BRUNO),
  '2027-09-01');

select teste.cenario('Ninguem emite nota no nome de outra pessoa', :BRUNO,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-01', 9000.00, 'nf/falsa.pdf')$fmt$, :CARLA),
  'recusa');

-- A TRAVA QUE FAZ TODO O RESTO VALER: sem ela, a nota nasce paga e a
-- conferencia inteira e pulada.
select teste.cenario('Nota nao nasce paga', :CARLA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url, status, pagamento)
          values (%L, '2027-09-01', 5000.00, 'nf/carla.pdf', 'paga', '2027-10-05')$fmt$, :CARLA),
  'recusa');

select teste.cenario('O cliente nao emite nota para a agencia', :JOANA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-01', 100.00, 'nf/joana.pdf')$fmt$, :JOANA),
  'recusa');

select teste.cenario('Valor zerado e recusado', :CARLA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-01', 0, 'nf/carla.pdf')$fmt$, :CARLA),
  'recusa');

-- O TETO E CONTRA O ZERO A MAIS, nao contra o valor alto: um erro de digitacao
-- vira uma despesa de sete digitos no relatorio do socio.
select teste.cenario('Um zero a mais e recusado', :CARLA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-01', 42000000.00, 'nf/carla.pdf')$fmt$, :CARLA),
  'recusa');

select teste.cenario('Carla envia a dela', :CARLA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-01', 5300.00, 'nf/carla-setembro.pdf')$fmt$, :CARLA),
  'ok', 1);

select teste.cenario('A mesma pessoa nao manda duas notas do mesmo mes', :BRUNO,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-09-20', 999.00, 'nf/bruno-de-novo.pdf')$fmt$, :BRUNO),
  'recusa');

select teste.cenario('Mas manda a de outro mes', :BRUNO,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-10-01', 4400.00, 'nf/bruno-outubro.pdf')$fmt$, :BRUNO),
  'ok', 1);


-- ---------------------------------------------------------------------------
-- 2. QUEM VE
--
-- O cenario do DESENVOLVEDOR e o que carrega a decisao inteira: ele cadastra
-- cliente, aprova entrega e distribui trabalho, e esta tabela ele nao le.
-- ---------------------------------------------------------------------------
select teste.cenario('Bruno ve as notas dele', :BRUNO,
  'select 1 from public.team_invoices', 'ok', 2);

select teste.cenario('E nao ve a da Carla', :BRUNO,
  format('select 1 from public.team_invoices where user_id = %L', :CARLA), 'ok', 0);

select teste.cenario('O socio ve todas', :ANA,
  'select 1 from public.team_invoices', 'ok', 3);

select teste.cenario('O DESENVOLVEDOR nao ve nota de ninguem', :DIEGO,
  'select 1 from public.team_invoices', 'ok', 0);

select teste.cenario('O cliente nao ve nada', :JOANA,
  'select 1 from public.team_invoices', 'ok', 0);


-- ---------------------------------------------------------------------------
-- 3. QUEM DECIDE
-- ---------------------------------------------------------------------------
select teste.cenario('O desenvolvedor nao aprova nota', :DIEGO,
  format($fmt$update public.team_invoices set status = 'aprovada'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'ok', 0);

select teste.cenario('Bruno nao aprova a propria nota', :BRUNO,
  format($fmt$update public.team_invoices set status = 'aprovada'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');

select teste.cenario('Bruno nao se paga', :BRUNO,
  format($fmt$update public.team_invoices set status = 'paga', pagamento = current_date
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');

select teste.cenario('Bruno corrige o valor enquanto a nota esta enviada', :BRUNO,
  format($fmt$update public.team_invoices set valor = 4250.00
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'ok', 1);

select teste.cenario('A socia aprova', :ANA,
  format($fmt$update public.team_invoices set status = 'aprovada'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'ok', 1);

-- O CARIMBO SAI DO BANCO, nunca do pedido: sem isto um PATCH montado a mao
-- assinaria a aprovacao com o nome de outra pessoa.
select teste.conferir(
  'Quem decidiu ficou registrado, e nao veio no pedido',
  (select case when decidido_por = :ANA and decidido_em is not null
               then 'carimbado' else 'em branco' end
     from public.team_invoices where user_id = :BRUNO and competencia = '2027-09-01'),
  'carimbado');

select teste.cenario('Depois de aprovada, Bruno nao edita mais', :BRUNO,
  format($fmt$update public.team_invoices set valor = 9999.00
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');

-- O SOCIO DECIDE E NAO REDIGE. Corrigir o valor por fora transformaria a
-- conferencia em reescrita, e a pessoa veria a propria nota com outro numero.
select teste.cenario('Nem a socia reescreve o valor declarado', :ANA,
  format($fmt$update public.team_invoices set valor = 1.00
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');


-- ---------------------------------------------------------------------------
-- 4. A RECUSA, E O HISTORICO QUE ELA DEIXA
-- ---------------------------------------------------------------------------
select teste.cenario('Recusar sem motivo e recusado', :ANA,
  format($fmt$update public.team_invoices set status = 'recusada'
             where user_id = %L and competencia = '2027-10-01'$fmt$, :BRUNO),
  'recusa');

select teste.cenario('Com motivo, passa', :ANA,
  format($fmt$update public.team_invoices
             set status = 'recusada', motivo_recusa = 'O CNPJ esta o da empresa antiga.'
             where user_id = %L and competencia = '2027-10-01'$fmt$, :BRUNO),
  'ok', 1);

-- A RECUSADA FICA, e a nova nasce ao lado. O indice unico e PARCIAL justamente
-- para isto: reescrever a recusada apagaria o que foi pedido.
select teste.cenario('E Bruno manda outra nota do mesmo mes', :BRUNO,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-10-01', 4400.00, 'nf/bruno-outubro-v2.pdf')$fmt$, :BRUNO),
  'ok', 1);

select teste.conferir(
  'As duas de outubro convivem: a recusada e a nova',
  (select count(*)::text from public.team_invoices
    where user_id = :BRUNO and competencia = '2027-10-01'),
  '2');

select teste.conferir(
  'E o motivo da recusa continua escrito',
  (select motivo_recusa from public.team_invoices
    where user_id = :BRUNO and competencia = '2027-10-01' and status = 'recusada'),
  'O CNPJ esta o da empresa antiga.');

select teste.cenario('Nota recusada nao volta atras', :ANA,
  format($fmt$update public.team_invoices set status = 'aprovada'
             where user_id = %L and competencia = '2027-10-01' and status = 'recusada'$fmt$, :BRUNO),
  'recusa');


-- ---------------------------------------------------------------------------
-- 5. PAGAR, E A DESPESA QUE NASCE DISSO
-- ---------------------------------------------------------------------------
select teste.cenario('Pagar sem data e recusado', :ANA,
  format($fmt$update public.team_invoices set status = 'paga'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');

select teste.cenario('Pular de enviada direto para paga e recusado', :ANA,
  format($fmt$update public.team_invoices set status = 'paga', pagamento = '2027-10-05'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :CARLA),
  'recusa');

select teste.cenario('A socia paga a nota aprovada', :ANA,
  format($fmt$update public.team_invoices set status = 'paga', pagamento = '2027-10-05'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'ok', 1);

-- A DECISAO DO USUARIO, medida: sem esta linha o maior custo da casa fica fora
-- do relatorio de margem.
select teste.conferir(
  'A nota paga virou UMA despesa no Financeiro',
  (select count(*)::text from public.finance_entries where tipo = 'despesa'),
  '1');

select teste.conferir(
  'Com o valor, a competencia e a data de pagamento da nota',
  (select valor::text || ' | ' || competencia::text || ' | ' || pagamento::text || ' | ' || status::text
     from public.finance_entries where tipo = 'despesa'),
  '4250.00 | 2027-09-01 | 2027-10-05 | pago');

-- A PONTE NOS DOIS SENTIDOS: sem ela, quem abre o lancamento no Financeiro nao
-- sabe de qual nota ele veio, e uma segunda passagem por `paga` lancaria de
-- novo.
select teste.conferir(
  'E a nota aponta para o lancamento que ela gerou',
  (select case when i.finance_entry_id = f.id then 'ligados' else 'soltos' end
     from public.team_invoices i, public.finance_entries f
    where i.user_id = :BRUNO and i.competencia = '2027-09-01' and f.tipo = 'despesa'),
  'ligados');

select teste.cenario('Nota paga nao muda mais de estado', :ANA,
  format($fmt$update public.team_invoices set status = 'recusada', motivo_recusa = 'mudei de ideia'
             where user_id = %L and competencia = '2027-09-01'$fmt$, :BRUNO),
  'recusa');

-- O DESENVOLVEDOR NAO LE O FINANCEIRO, e a despesa que nasceu aqui obedece a
-- mesma regra: o valor da nota nao vaza pela porta dos fundos.
select teste.cenario('E a despesa gerada continua so do socio', :DIEGO,
  'select 1 from public.finance_entries', 'ok', 0);


-- ---------------------------------------------------------------------------
-- 6. APAGAR
-- ---------------------------------------------------------------------------
select teste.cenario('Carla apaga a nota que ainda ninguem conferiu', :CARLA,
  format($fmt$delete from public.team_invoices where user_id = %L and status = 'enviada'$fmt$, :CARLA),
  'ok', 1);

select teste.cenario('Ninguem apaga nota paga -- nem a socia', :ANA,
  format($fmt$delete from public.team_invoices where user_id = %L and status = 'paga'$fmt$, :BRUNO),
  'ok', 0);

select teste.cenario('Nem a recusada, que e o historico', :BRUNO,
  format($fmt$delete from public.team_invoices where user_id = %L and status = 'recusada'$fmt$, :BRUNO),
  'ok', 0);


-- ---------------------------------------------------------------------------
-- 7. O SINO
--
-- Os dois sentidos, e o segundo e o que faz o modulo nao ser uma tela que
-- alguem lembra de abrir.
-- ---------------------------------------------------------------------------
delete from public.notifications;

select teste.cenario('Carla envia a nota de novembro', :CARLA,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, '2027-11-01', 5300.00, 'nf/carla-novembro.pdf')$fmt$, :CARLA),
  'ok', 1);

select teste.conferir(
  'A socia foi avisada de que ha nota para conferir',
  (select count(*)::text from public.notifications where user_id = :ANA),
  '1');

select teste.conferir(
  'E o desenvolvedor nao foi avisado de nada',
  (select count(*)::text from public.notifications where user_id = :DIEGO),
  '0');

delete from public.notifications;

select teste.cenario('A socia recusa a de novembro', :ANA,
  format($fmt$update public.team_invoices
             set status = 'recusada', motivo_recusa = 'Falta o numero da nota.'
             where user_id = %L and competencia = '2027-11-01'$fmt$, :CARLA),
  'ok', 1);

select teste.conferir(
  'Carla recebeu o aviso com o motivo no corpo',
  (select corpo from public.notifications where user_id = :CARLA),
  'Falta o numero da nota.');


-- ===========================================================================
-- 8. SOLICITAR AS NOTAS DO MES (0066)
--
-- O que estes cenarios perseguem:
--
--   1. QUEM PEDE. So o socio -- pedir a nota de todo mundo e uma acao sobre a
--      equipe inteira, e a contagem de quem falta diz de quantas pessoas a
--      agencia deve dinheiro.
--   2. O PEDIDO NAO VAI PARA QUEM JA MANDOU. E a linha que faz "cobrar de
--      novo" ser seguro, e o unico cenario que falha se ela sair.
--   3. A RECUSADA CONTA COMO NAO ENVIADA, porque e exatamente quem precisa
--      mandar outra.
--   4. QUEM PEDE NAO SE COBRA.
--   5. O PRAZO E O MESMO DIA DO PEDIDO, E ELE AVISA EM VEZ DE RECUSAR: a nota
--      atrasada ENTRA, porque nota recusada por atraso e nota que a agencia
--      nao recebe. O prazo aparece no corpo do aviso e em
--      `meus_pedidos_de_nota()`, que e por onde a pessoa o le depois.
--
-- ---------------------------------------------------------------------------
-- ESTA SECAO NAO USA O CALENDARIO DE 2027 DO RESTO DO ARQUIVO, e a razao e
-- mecanica: `solicitar_notas_do_mes()` recusa mes que ainda nao comecou, e e a
-- PRIMEIRA funcao deste arquivo a comparar com `current_date`. As sete secoes
-- de cima datam tudo em 2027 sem problema porque nenhuma trava delas olha o
-- relogio -- a competencia de uma nota e so uma etiqueta de mes.
--
-- Entao aqui o mes de servico e um mes que JA PASSOU, e passado nao volta a
-- ser futuro: uma data fixa no passado vale em qualquer rodada, hoje e em
-- 2030. Datar com `current_date` daria o mesmo resultado e exigiria `format()`
-- em cada cenario, porque psql nao interpola variavel dentro de `$$`.
-- ---------------------------------------------------------------------------
\set MES_SERVICO  '''2026-08-01'''
\set MES_ANTERIOR '''2026-07-01'''

delete from public.notifications;
delete from public.team_invoices;
delete from public.invoice_requests;

-- Bruno ja mandou a dele; Carla nao; Marina teve a dela recusada.
insert into public.team_invoices (user_id, competencia, valor, arquivo_url, status)
values (:BRUNO, :MES_SERVICO, 4250.00, 'nf/b-mes.pdf', 'enviada');

insert into public.team_invoices
  (user_id, competencia, valor, arquivo_url, status, motivo_recusa, decidido_por)
values (:MARINA, :MES_SERVICO, 3900.00, 'nf/m-mes.pdf', 'recusada', 'Numero ilegivel.', :ANA);

-- ZERAR OS AVISOS DEPOIS DA MONTAGEM, E NAO ANTES.
--
-- Os dois inserts de cima disparam `nota_avisa` e tocam o sino da socia -- e
-- com eles no meio, o cenario "a socia nao se cobrou" contaria dois avisos que
-- nao vieram do pedido e falharia por um motivo que nao e o dele. A montagem
-- precisa terminar antes de a medicao comecar; e a armadilha da fixture
-- ocupando o lugar do cenario, vista do outro lado.
delete from public.notifications;

select teste.cenario('O colaborador nao pede as notas da equipe', :CARLA,
  format($fmt$select public.solicitar_notas_do_mes(%L)$fmt$, :MES_SERVICO), 'recusa');

select teste.cenario('O DESENVOLVEDOR tambem nao', :DIEGO,
  format($fmt$select public.solicitar_notas_do_mes(%L)$fmt$, :MES_SERVICO), 'recusa');

select teste.cenario('Nem enxerga quem esta devendo', :DIEGO,
  format($fmt$select public.quem_deve_nota(%L)$fmt$, :MES_SERVICO), 'recusa');

select teste.cenario('Nao se pede a nota de um mes que nao comecou', :ANA,
  $$select public.solicitar_notas_do_mes('2099-01-01')$$, 'recusa');

-- ---------------------------------------------------------------------------
-- A CONTA ANTES DO CLIQUE, e ela e a mesma que o envio usa: o dialogo promete
-- um numero, e um numero diferente do que sai seria a tela mentindo sobre o
-- que o botao acabou de fazer.
--
-- MEDIDO POR ID E POR CONTAGEM, E NAO PELA LISTA DE NOMES. A primeira versao
-- comparava `string_agg(nome)` com os seis nomes escritos a mao, e ela falhou
-- na primeira rodada: o arquivo 29 renomeia a Carla para provar a trilha de
-- auditoria, e o nome dela chega aqui com "Auditada" no fim. Um cenario que
-- quebra porque OUTRO arquivo mexeu num nome nao esta medindo esta regra --
-- esta medindo a ordem dos arquivos.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Sao quatro devendo: a equipe menos a socia que pede e menos Bruno',
  :ANA,
  format($fmt$select count(*)::text from public.quem_deve_nota(%L)$fmt$, :MES_SERVICO),
  '4');

select teste.conferir_como(
  'Bruno fica de fora: a dele ja esta enviada',
  :ANA,
  format($fmt$select count(*)::text from public.quem_deve_nota(%L) where user_id = %L$fmt$,
         :MES_SERVICO, :BRUNO),
  '0');

select teste.conferir_como(
  'Marina fica dentro: recusada conta como nao enviada',
  :ANA,
  format($fmt$select count(*)::text from public.quem_deve_nota(%L) where user_id = %L$fmt$,
         :MES_SERVICO, :MARINA),
  '1');

select teste.conferir_como(
  'E a socia nao se cobra: a contagem da tela seria 5 com ela dentro',
  :ANA,
  format($fmt$select count(*)::text from public.quem_deve_nota(%L) where user_id = %L$fmt$,
         :MES_SERVICO, :ANA),
  '0');

select teste.cenario('A socia pede as notas do mes', :ANA,
  format($fmt$select public.solicitar_notas_do_mes(%L)$fmt$, :MES_SERVICO), 'ok', 1);

select teste.conferir(
  'Carla foi cobrada',
  (select count(*)::text from public.notifications where user_id = :CARLA),
  '1');

-- A LINHA QUE FAZ O BOTAO PODER SER APERTADO DE NOVO: sem ela, a cobranca
-- chega tambem para quem ja enviou, e vira o aviso que se aprende a ignorar.
select teste.conferir(
  'E Bruno NAO foi cobrado',
  (select count(*)::text from public.notifications where user_id = :BRUNO),
  '0');

select teste.conferir(
  'Marina foi cobrada',
  (select count(*)::text from public.notifications where user_id = :MARINA),
  '1');

select teste.conferir(
  'A socia nao se cobrou',
  (select count(*)::text from public.notifications where user_id = :ANA),
  '0');

-- O PRAZO VIAJA NO CORPO DO AVISO, COM A DATA E NAO COM A PALAVRA "HOJE".
--
-- Este cenario e o que impede a volta do "Envie hoje": gravada no dia 5, essa
-- frase passa a mentir no dia 6 -- e mente para quem esta atrasado, que e quem
-- mais precisa ler a verdade. Se alguem tirar a data do corpo, este falha.
select teste.conferir(
  'O aviso diz que o prazo e o dia do pedido, com a data escrita',
  (select corpo from public.notifications where user_id = :CARLA),
  'O prazo é o mesmo dia do pedido: ' || to_char(current_date, 'DD/MM/YYYY')
    || '. Anexe a sua em Notas Fiscais.');

select teste.conferir(
  'E o pedido ficou registrado com quantas pessoas alcancou',
  (select competencia::text || ' | ' || quantas_pessoas::text
     from public.invoice_requests),
  '2026-08-01 | 4');

select teste.cenario('O colaborador nao le os pedidos', :CARLA,
  'select 1 from public.invoice_requests', 'ok', 0);

-- ---------------------------------------------------------------------------
-- O PRAZO DO LADO DE QUEM DEVE A NOTA
--
-- A policy de `invoice_requests` e do socio e continua sendo; quem devolve a
-- Carla o recorte que e dela e `meus_pedidos_de_nota()`, definer. Sem ela o
-- prazo existiria so no aviso do sino -- que a pessoa marca como lido e nunca
-- mais encontra.
-- ---------------------------------------------------------------------------
select teste.conferir_como(
  'Carla le o pedido que a cobra, com o prazo no dia em que ele saiu',
  :CARLA,
  $$select competencia::text || ' | ' || pedido_em::text
      from public.meus_pedidos_de_nota()$$,
  '2026-08-01 | ' || current_date::text);

-- QUEM JA MANDOU NAO LE PEDIDO EM ABERTO, e e a mesma pergunta que decide a
-- cobranca: sem ela, Bruno abriria Notas Fiscais e leria uma faixa pedindo a
-- nota que ele enviou na semana passada.
select teste.conferir_como(
  'Bruno nao tem pedido em aberto: a dele ja foi',
  :BRUNO,
  $$select count(*)::text from public.meus_pedidos_de_nota()$$,
  '0');

select teste.conferir_como(
  'Marina tem: a recusada nao encerra o pedido',
  :MARINA,
  $$select count(*)::text from public.meus_pedidos_de_nota()$$,
  '1');

-- O CLIENTE NAO LE NADA DISSO. Ele nao emite nota para a agencia, e sem a
-- guarda de `is_staff()` ele leria a lista de meses em que a Full cobrou notas
-- -- porque nao tendo nota nenhuma, nenhum pedido sai pelo `not exists`.
select teste.conferir_como(
  'O cliente nao le pedido de nota nenhum',
  :JOANA,
  $$select count(*)::text from public.meus_pedidos_de_nota()$$,
  '0');

-- ---------------------------------------------------------------------------
-- COBRAR DE NOVO: Carla manda a dela, e a segunda cobranca nao a alcanca.
-- ---------------------------------------------------------------------------
-- O PRIMEIRO PEDIDO RECUA TRES DIAS, E SEM ESSE RECUO O CENARIO DO PRAZO NAO
-- MEDE NADA. A primeira versao desta secao disparava os dois pedidos na mesma
-- rodada, entao os dois nasciam com o mesmo `now()`: `min` e `max` davam a
-- mesma data, e a mutacao que troca um pelo outro passou verde. Um teste que
-- nao separa a resposta certa da errada e um teste que afirma sem provar -- a
-- mesma licao do `select` antes do `insert` na idempotencia da recorrencia.
update public.invoice_requests set created_at = now() - interval '3 days';

delete from public.notifications;

insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
values (:CARLA, :MES_SERVICO, 5300.00, 'nf/c-mes.pdf');

delete from public.notifications;

select teste.cenario('A socia cobra de novo', :ANA,
  format($fmt$select public.solicitar_notas_do_mes(%L)$fmt$, :MES_SERVICO), 'ok', 1);

select teste.conferir(
  'Carla nao foi cobrada de novo',
  (select count(*)::text from public.notifications where user_id = :CARLA),
  '0');

select teste.conferir(
  'E a segunda cobranca e uma linha propria, com a contagem menor',
  (select count(*)::text || ' pedidos, o ultimo para ' ||
          (select quantas_pessoas::text from public.invoice_requests
            order by created_at desc limit 1)
     from public.invoice_requests),
  '2 pedidos, o ultimo para 3');

-- O PRAZO QUE VALE E O DO PEDIDO MAIS RECENTE, e isso e o `max(created_at)`.
-- Rafael tem dois pedidos em cima dele agora; devolvendo os dois, a tela dele
-- mostraria duas faixas cobrando o mesmo mes, e devolvendo o primeiro ele
-- leria um prazo que a cobranca de hoje ja substituiu.
select teste.conferir_como(
  'Rafael tem UMA linha para os dois pedidos do mesmo mes, com o prazo novo',
  :RAFAEL,
  $$select count(*)::text || ' | ' ||
      (select max(pedido_em)::text from public.meus_pedidos_de_nota())
      from public.meus_pedidos_de_nota()$$,
  '1 | ' || current_date::text);

-- ATRASAR NAO FECHA A PORTA, e este e o cenario que guarda a decisao: o prazo
-- passou faz duas semanas e a nota entra. Uma trava aqui deixaria a agencia sem
-- a nota, que e o oposto de pedi-la.
insert into public.invoice_requests (competencia, solicitado_por, quantas_pessoas, created_at)
values (:MES_ANTERIOR, :ANA, 1, now() - interval '14 days');

select teste.conferir_como(
  'Rafael le o prazo do mes anterior, que passou faz duas semanas',
  :RAFAEL,
  format($fmt$select pedido_em::text from public.meus_pedidos_de_nota()
               where competencia = %L$fmt$, :MES_ANTERIOR),
  (current_date - 14)::text);

select teste.cenario('Rafael manda a do mes anterior duas semanas depois do prazo', :RAFAEL,
  format($fmt$insert into public.team_invoices (user_id, competencia, valor, arquivo_url)
          values (%L, %L, 4100.00, 'nf/r-anterior.pdf')$fmt$, :RAFAEL, :MES_ANTERIOR),
  'ok', 1);

select teste.conferir_como(
  'E o pedido dele sai da lista, porque a nota chegou',
  :RAFAEL,
  format($fmt$select count(*)::text from public.meus_pedidos_de_nota()
               where competencia = %L$fmt$, :MES_ANTERIOR),
  '0');
