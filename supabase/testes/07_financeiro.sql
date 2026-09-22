\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- Sprint 8 -- Financeiro da agencia e Financeiro Pessoal
--
-- Ana e socia. Diego e DESENVOLVEDOR -- gestao para todo o resto do sistema,
-- e nada aqui. Carla e Bruno sao colaboradores. Joana e cliente.
--
-- O criterio de aceite diz "a consulta direta as tabelas pela API tambem e
-- negada", e e exatamente isso que esta bateria faz: ela nao passa pela tela,
-- roda como cada pessoa de verdade e pergunta ao Postgres.
-- ===========================================================================

delete from public.personal_finance_entries;
delete from public.finance_entries;
delete from public.contracts;


-- ---------------------------------------------------------------------------
-- O financeiro da agencia e SO do socio
--
-- Estes cenarios sao o coracao do sprint. Nao existe "so leitura para o
-- gestor": o desenvolvedor cadastra cliente, aprova entrega e distribui
-- trabalho, e mesmo assim nao ve um numero daqui.
-- ---------------------------------------------------------------------------

select teste.cenario('A socia cadastra contrato', :ANA,
  format($fmt$
    insert into public.contracts (id, client_id, nome, valor, recorrencia, dia_vencimento, data_inicio)
    values ('cccccccc-0000-0000-0000-000000000001', %L, %L, 4500.00, 'mensal', 10, current_date - 90)
  $fmt$, :VERDE, 'Fee mensal - social media'), 'ok', 1);

select teste.cenario('O desenvolvedor NAO le contrato', :DIEGO,
  'select 1 from public.contracts', 'ok', 0);

select teste.cenario('O desenvolvedor nao cria contrato', :DIEGO,
  format($fmt$
    insert into public.contracts (client_id, nome, valor, data_inicio)
    values (%L, 'Contrato por fora', 1.00, current_date)
  $fmt$, :VERDE), 'recusa');

select teste.cenario('O desenvolvedor nao altera contrato', :DIEGO,
  'update public.contracts set valor = 1.00', 'recusa');

select teste.cenario('O desenvolvedor nao apaga contrato', :DIEGO,
  'delete from public.contracts', 'recusa');

select teste.cenario('O colaborador NAO le contrato', :CARLA,
  'select 1 from public.contracts', 'ok', 0);

select teste.cenario('O cliente NAO le contrato', :JOANA,
  'select 1 from public.contracts', 'ok', 0);

-- O plano de contas tambem. Parece inocente -- e so uma lista de nomes --,
-- mas "Freelancers" e "Impostos" ja contam o que a agencia gasta.
select teste.cenario('O desenvolvedor NAO le o plano de contas', :DIEGO,
  'select 1 from public.finance_categories', 'ok', 0);

select teste.cenario('A socia le o plano de contas', :ANA,
  'select 1 from public.finance_categories', 'ok', 13);


-- ---------------------------------------------------------------------------
-- Lancamentos
-- ---------------------------------------------------------------------------

select teste.cenario('A socia lanca uma receita', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, tipo, client_id, descricao, valor, competencia, vencimento, criado_por)
    values ('ffffffff-0000-0000-0000-000000000001', 'receita', %L, %L, 4500.00,
            date_trunc('month', current_date)::date, current_date + 5, %L)
  $fmt$, :VERDE, 'Fee de setembro', :ANA), 'ok', 1);

select teste.cenario('O desenvolvedor NAO le lancamento', :DIEGO,
  'select 1 from public.finance_entries', 'ok', 0);

select teste.cenario('O colaborador nao cria lancamento', :BRUNO,
  format($fmt$
    insert into public.finance_entries (tipo, descricao, valor, competencia, criado_por)
    values ('despesa', 'Nao deveria entrar', 10.00, current_date, %L)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('O desenvolvedor nao marca nada como pago', :DIEGO,
  format($fmt$
    update public.finance_entries set status = 'pago', pagamento = current_date
  $fmt$), 'recusa');

select teste.cenario('O desenvolvedor nao apaga lancamento', :DIEGO,
  'delete from public.finance_entries', 'recusa');


-- --- A competencia e sempre o mes ------------------------------------------

select teste.cenario('Competencia no meio do mes vira dia 1', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, tipo, descricao, valor, competencia, criado_por)
    values ('ffffffff-0000-0000-0000-000000000002', 'despesa', %L, 800.00,
            date_trunc('month', current_date)::date + 16, %L)
  $fmt$, 'Ferramentas', :ANA), 'ok', 1);

select teste.conferir('E o dia gravado e 1',
  (select extract(day from competencia)::text
     from public.finance_entries
    where id = 'ffffffff-0000-0000-0000-000000000002'),
  '1');


-- --- Pago exige a data, e a data implica pago ------------------------------

select teste.cenario('Marcar como pago sem data e recusado', :ANA,
  format($fmt$
    update public.finance_entries set status = 'pago'
     where id = 'ffffffff-0000-0000-0000-000000000002'
  $fmt$), 'recusa');

select teste.cenario('Preencher a data marca como pago sozinho', :ANA,
  format($fmt$
    update public.finance_entries set pagamento = current_date
     where id = 'ffffffff-0000-0000-0000-000000000002'
  $fmt$), 'ok', 1);

select teste.conferir('E o status virou pago',
  (select status::text from public.finance_entries
    where id = 'ffffffff-0000-0000-0000-000000000002'),
  'pago');


-- --- Atraso e DERIVADO, nunca gravado --------------------------------------
--
-- Um titulo vencido e nao pago aparece como atrasado sem ninguem ter mexido
-- nele. E por isso que a funcao le current_date em vez de a coluna guardar o
-- estado: uma coluna precisaria de uma rotina noturna, e no dia em que ela
-- nao rodasse o relatorio mentiria.

select teste.cenario('A socia lanca um titulo ja vencido', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, tipo, client_id, descricao, valor, competencia, vencimento, criado_por)
    values ('ffffffff-0000-0000-0000-000000000003', 'receita', %L, %L, 2000.00,
            date_trunc('month', current_date)::date, current_date - 3, %L)
  $fmt$, :OPTICA, 'Fee atrasado', :ANA), 'ok', 1);

select teste.conferir('Ele foi GRAVADO como previsto',
  (select status::text from public.finance_entries
    where id = 'ffffffff-0000-0000-0000-000000000003'),
  'previsto');

select teste.conferir('E aparece como atrasado, sem ninguem ter mexido',
  (select public.situacao_do_lancamento(status, vencimento, pagamento)::text
     from public.finance_entries
    where id = 'ffffffff-0000-0000-0000-000000000003'),
  'atrasado');

select teste.conferir('O que foi pago nao vira atrasado, mesmo vencido',
  (select public.situacao_do_lancamento('pago', current_date - 30, current_date - 20)::text),
  'pago');

select teste.conferir('O cancelado tambem nao vira atrasado',
  (select public.situacao_do_lancamento('cancelado', current_date - 30, null)::text),
  'cancelado');

select teste.conferir('Sem vencimento nao ha atraso',
  (select public.situacao_do_lancamento('previsto', null, null)::text),
  'previsto');

select teste.conferir('Vencendo hoje ainda nao esta atrasado',
  (select public.situacao_do_lancamento('previsto', current_date, null)::text),
  'previsto');

-- Gravar 'atrasado' a mao e reescrito para 'previsto': a unica fonte do
-- atraso e a data, senao haveria duas verdades sobre o mesmo titulo.
select teste.cenario('Gravar atrasado a mao nao cola', :ANA,
  format($fmt$
    update public.finance_entries set status = 'atrasado'
     where id = 'ffffffff-0000-0000-0000-000000000001'
  $fmt$), 'ok', 1);

select teste.conferir('Continua previsto no banco',
  (select status::text from public.finance_entries
    where id = 'ffffffff-0000-0000-0000-000000000001'),
  'previsto');


-- ---------------------------------------------------------------------------
-- Gerar lancamentos do mes nao duplica
--
-- O criterio de aceite pede isso, e a trava e um indice unico -- nao a
-- consulta da action. Duas abas abertas clicando ao mesmo tempo passariam
-- pelas duas consultas antes de qualquer uma gravar.
-- ---------------------------------------------------------------------------

select teste.cenario('Gerar o lancamento do contrato', :ANA,
  format($fmt$
    insert into public.finance_entries
      (tipo, client_id, contract_id, descricao, valor, competencia, vencimento, criado_por)
    values ('receita', %L, 'cccccccc-0000-0000-0000-000000000001', %L, 4500.00,
            date_trunc('month', current_date)::date,
            date_trunc('month', current_date)::date + 9, %L)
  $fmt$, :VERDE, 'Fee mensal - social media', :ANA), 'ok', 1);

select teste.cenario('Gerar de novo, o mesmo mes, e recusado', :ANA,
  format($fmt$
    insert into public.finance_entries
      (tipo, client_id, contract_id, descricao, valor, competencia, vencimento, criado_por)
    values ('receita', %L, 'cccccccc-0000-0000-0000-000000000001', %L, 4500.00,
            date_trunc('month', current_date)::date,
            date_trunc('month', current_date)::date + 9, %L)
  $fmt$, :VERDE, 'Fee mensal - social media', :ANA), 'recusa');

-- A trava e por MES: o mes seguinte do mesmo contrato tem que passar, senao
-- o contrato so geraria receita uma vez na vida.
select teste.cenario('O mes seguinte do mesmo contrato passa', :ANA,
  format($fmt$
    insert into public.finance_entries
      (tipo, client_id, contract_id, descricao, valor, competencia, vencimento, criado_por)
    values ('receita', %L, 'cccccccc-0000-0000-0000-000000000001', %L, 4500.00,
            (date_trunc('month', current_date) + interval '1 month')::date,
            (date_trunc('month', current_date) + interval '1 month')::date + 9, %L)
  $fmt$, :VERDE, 'Fee mensal - social media', :ANA), 'ok', 1);

-- E o indice e PARCIAL: lancamento avulso nao tem contrato, e varios deles
-- na mesma competencia sao normais.
select teste.cenario('Dois avulsos na mesma competencia convivem', :ANA,
  format($fmt$
    insert into public.finance_entries (tipo, descricao, valor, competencia, criado_por)
    values ('despesa', 'Cafe', 50.00, date_trunc('month', current_date)::date, %L),
           ('despesa', 'Papelaria', 80.00, date_trunc('month', current_date)::date, %L)
  $fmt$, :ANA, :ANA), 'ok', 2);


-- ---------------------------------------------------------------------------
-- Financeiro Pessoal: o outro extremo
--
-- Aqui nem a socia entra. E a mesma regra do Resumo Semanal, pela mesma
-- razao: o modulo so serve se a pessoa confiar nele.
-- ---------------------------------------------------------------------------

select teste.cenario('Bruno lanca uma entrada dele', :BRUNO,
  format($fmt$
    insert into public.personal_finance_entries (user_id, tipo, descricao, categoria, valor, data)
    values (%L, 'entrada', 'Salário', 'Renda', 6500.00, current_date)
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('E uma saida', :BRUNO,
  format($fmt$
    insert into public.personal_finance_entries
      (user_id, tipo, descricao, categoria, valor, data, recorrente)
    values (%L, 'saida', 'Aluguel', 'Moradia', 1800.00, current_date, true)
  $fmt$, :BRUNO), 'ok', 1);

select teste.cenario('Bruno le os proprios lancamentos', :BRUNO,
  'select 1 from public.personal_finance_entries', 'ok', 2);

select teste.cenario('A SOCIA nao le o financeiro pessoal de Bruno', :ANA,
  'select 1 from public.personal_finance_entries', 'ok', 0);

select teste.cenario('O desenvolvedor tambem nao', :DIEGO,
  'select 1 from public.personal_finance_entries', 'ok', 0);

select teste.cenario('Nem um colega', :CARLA,
  'select 1 from public.personal_finance_entries', 'ok', 0);

select teste.cenario('Nem o cliente', :JOANA,
  'select 1 from public.personal_finance_entries', 'ok', 0);

select teste.cenario('A socia nao altera o lancamento de Bruno', :ANA,
  'update public.personal_finance_entries set valor = 1.00', 'recusa');

select teste.cenario('A socia nao apaga o lancamento de Bruno', :ANA,
  'delete from public.personal_finance_entries', 'recusa');

-- Escrever no nome de outra pessoa e recusado pelo `with check`. Sem ele,
-- daria para lancar uma despesa no controle pessoal de um colega.
select teste.cenario('Carla nao lanca no nome de Bruno', :CARLA,
  format($fmt$
    insert into public.personal_finance_entries (user_id, tipo, descricao, valor, data)
    values (%L, 'saida', 'Lancamento forjado', 999.00, current_date)
  $fmt$, :BRUNO), 'recusa');

-- "Apagar todos os meus dados" tem que funcionar de verdade: um modulo
-- opcional do qual nao se consegue sair nao e opcional.
select teste.cenario('Bruno apaga tudo o que e dele', :BRUNO,
  format($fmt$delete from public.personal_finance_entries where user_id = %L$fmt$, :BRUNO),
  'ok', 2);

select teste.conferir('E nao sobrou nada dele',
  (select count(*)::text from public.personal_finance_entries
    where user_id = '44444444-4444-4444-4444-444444444444'),
  '0');
