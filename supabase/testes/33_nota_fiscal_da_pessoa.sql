\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
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
