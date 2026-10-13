\set ANA     '''11111111-1111-1111-1111-111111111111'''
\set DIEGO   '''22222222-2222-2222-2222-222222222222'''
\set CARLA   '''33333333-3333-3333-3333-333333333333'''
\set BRUNO   '''44444444-4444-4444-4444-444444444444'''
\set JOANA   '''77777777-7777-7777-7777-777777777777'''
\set VERDE   '''aaaaaaaa-0000-0000-0000-000000000001'''
\set OPTICA  '''aaaaaaaa-0000-0000-0000-000000000002'''

-- ===========================================================================
-- Sprint 8 + 0095 -- OS GASTOS DA AGENCIA
--
-- Ana e socia. Diego e DESENVOLVEDOR -- gestao para todo o resto do sistema,
-- e nada aqui. Carla e Bruno sao colaboradores. Joana e cliente.
--
-- O criterio de aceite diz "a consulta direta as tabelas pela API tambem e
-- negada", e e exatamente isso que esta bateria faz: ela nao passa pela tela,
-- roda como cada pessoa de verdade e pergunta ao Postgres.
--
-- ---------------------------------------------------------------------------
-- A RECEITA SAIU (0095), E OS CENARIOS DELA FICARAM VIRADOS DO AVESSO.
--
-- Eram seis cenarios de `contracts` e cinco de receita. A 0095 apagou a
-- tabela, a coluna `tipo`, `contract_id` e as categorias de receita -- por
-- decisao do usuario, porque o Financeiro passou a ter duas abas e nenhuma
-- delas e sobre faturamento.
--
-- Apagar os cenarios junto deixaria a remocao sem guarda nenhuma: quem
-- devolvesse qualquer uma das quatro coisas nao derrubaria teste nenhum, e o
-- produto voltaria a somar receita num lugar que a tela chama de gastos. Eles
-- medem hoje a AUSENCIA, e cada um diz qual peca voltou.
-- ---------------------------------------------------------------------------
-- ===========================================================================

delete from public.finance_entries;


-- ---------------------------------------------------------------------------
-- O QUE A 0095 APAGOU, e cada cenario nomeia uma peca
-- ---------------------------------------------------------------------------

select teste.conferir('A tabela de contratos nao existe mais',
  coalesce(to_regclass('public.contracts')::text, 'nao existe'),
  'nao existe');

select teste.conferir('finance_entries nao tem mais `tipo`',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_entries'
      and column_name = 'tipo'),
  '0');

select teste.conferir('finance_entries nao tem mais `contract_id`',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_entries'
      and column_name = 'contract_id'),
  '0');

select teste.conferir('finance_categories nao tem mais `tipo`',
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_categories'
      and column_name = 'tipo'),
  '0');

-- A UNICIDADE PASSOU A SER O NOME. Sem isto a categoria "Software" poderia
-- existir duas vezes, e o seletor da aba Softwares mostraria duas iguais.
select teste.conferir('E a categoria e unica por NOME',
  (select count(*)::text from pg_constraint
    where conrelid = 'public.finance_categories'::regclass
      and conname = 'finance_categories_nome_key'),
  '1');

select teste.conferir('Os dois enums de receita sairam',
  (select count(*)::text from pg_type
    where typname in ('fin_tipo', 'contrato_recorrencia')),
  '0');

-- A CONTA QUE CRUZAVA RECEITA COM HORAS TAMBEM. Ela era a quinta funcao da
-- 0035, a unica de `is_socio()`; sem receita ela devolveria uma coluna de
-- zeros, que e uma afirmacao sobre a conta onde o que se quer dizer e que
-- ninguem mede mais isso.
select teste.conferir('rentabilidade_do_periodo() saiu',
  (select count(*)::text from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rentabilidade_do_periodo'),
  '0');

-- E A FORMA ANTIGA DO `insert` E RECUSADA. Este e o cenario que separa "a
-- coluna saiu do schema" de "ninguem consegue mais escrever nela": sem ele, um
-- `insert` com `tipo` passaria a ser erro de sintaxe e ninguem notaria a
-- diferenca entre as duas coisas.
select teste.cenario('Lancar com `tipo` e recusado', :ANA,
  format($fmt$
    insert into public.finance_entries
      (tipo, descricao, valor, competencia, criado_por)
    values ('receita', %L, 4500.00, date_trunc('month', current_date)::date, %L)
  $fmt$, 'Fee de setembro', :ANA), 'recusa');


-- ---------------------------------------------------------------------------
-- O financeiro da agencia e SO do socio
--
-- Estes cenarios sao o coracao do sprint, e a 0095 nao encostou neles: nao
-- existe "so leitura para o gestor". O desenvolvedor cadastra cliente, aprova
-- entrega e distribui trabalho, e mesmo assim nao ve um numero daqui.
-- ---------------------------------------------------------------------------

-- O plano de contas tambem. Parece inocente -- e so uma lista de nomes --,
-- mas "Freelancers" e "Impostos" ja contam o que a agencia gasta.
select teste.cenario('O desenvolvedor NAO le o plano de contas', :DIEGO,
  'select 1 from public.finance_categories', 'ok', 0);

-- ERAM TREZE E SAO OITO: as cinco de receita sairam com ela.
select teste.cenario('A socia le o plano de contas', :ANA,
  'select 1 from public.finance_categories', 'ok', 8);

select teste.cenario('E nenhuma delas e de receita', :ANA,
  $$select 1 from public.finance_categories where nome = 'Fee mensal'$$, 'ok', 0);


-- ---------------------------------------------------------------------------
-- Os gastos
-- ---------------------------------------------------------------------------

select teste.cenario('A socia lanca um gasto', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, client_id, descricao, valor, competencia, vencimento, criado_por)
    values ('ffffffff-0000-0000-0000-000000000001', %L, %L, 4500.00,
            date_trunc('month', current_date)::date, current_date + 5, %L)
  $fmt$, :VERDE, 'Impulsionamento de setembro', :ANA), 'ok', 1);

select teste.cenario('O desenvolvedor NAO le gasto', :DIEGO,
  'select 1 from public.finance_entries', 'ok', 0);

select teste.cenario('O colaborador nao cria gasto', :BRUNO,
  format($fmt$
    insert into public.finance_entries (descricao, valor, competencia, criado_por)
    values ('Nao deveria entrar', 10.00, current_date, %L)
  $fmt$, :BRUNO), 'recusa');

select teste.cenario('O cliente NAO le gasto', :JOANA,
  'select 1 from public.finance_entries', 'ok', 0);

select teste.cenario('O desenvolvedor nao marca nada como pago', :DIEGO,
  format($fmt$
    update public.finance_entries set status = 'pago', pagamento = current_date
  $fmt$), 'recusa');

select teste.cenario('O desenvolvedor nao apaga gasto', :DIEGO,
  'delete from public.finance_entries', 'recusa');


-- --- A competencia e sempre o mes ------------------------------------------

select teste.cenario('Competencia no meio do mes vira dia 1', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, descricao, valor, competencia, criado_por)
    values ('ffffffff-0000-0000-0000-000000000002', %L, 800.00,
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
-- Um gasto vencido e nao pago aparece como atrasado sem ninguem ter mexido
-- nele. E por isso que a funcao le current_date em vez de a coluna guardar o
-- estado: uma coluna precisaria de uma rotina noturna, e no dia em que ela
-- nao rodasse o relatorio mentiria.

select teste.cenario('A socia lanca um gasto ja vencido', :ANA,
  format($fmt$
    insert into public.finance_entries
      (id, client_id, descricao, valor, competencia, vencimento, criado_por)
    values ('ffffffff-0000-0000-0000-000000000003', %L, %L, 2000.00,
            date_trunc('month', current_date)::date, current_date - 3, %L)
  $fmt$, :OPTICA, 'Licenca atrasada', :ANA), 'ok', 1);

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
-- atraso e a data, senao haveria duas verdades sobre o mesmo gasto.
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
-- VARIOS GASTOS NA MESMA COMPETENCIA CONVIVEM
--
-- Era um cenario sobre o indice PARCIAL `(contract_id, competencia)`: ele
-- impedia gerar duas vezes a receita do mesmo contrato no mesmo mes, e deixava
-- passar o avulso, que nao tem contrato. O indice saiu com a coluna na 0095 --
-- sem contrato nao ha o que gerar --, e o que sobra e a metade que SEMPRE
-- valeu: a agencia paga quatro coisas diferentes no mesmo mes.
--
-- Ele fica porque devolver qualquer trava de unicidade a esta tabela seria
-- recusar o caso normal, e nenhum outro cenario pegaria isso.
-- ---------------------------------------------------------------------------

select teste.cenario('Quatro gastos na mesma competencia convivem', :ANA,
  format($fmt$
    insert into public.finance_entries (descricao, valor, competencia, criado_por)
    values ('Cafe', 50.00, date_trunc('month', current_date)::date, %L),
           ('Papelaria', 80.00, date_trunc('month', current_date)::date, %L),
           ('Adobe', 289.00, date_trunc('month', current_date)::date, %L),
           ('Figma', 120.00, date_trunc('month', current_date)::date, %L)
  $fmt$, :ANA, :ANA, :ANA, :ANA), 'ok', 4);
