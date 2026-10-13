-- ===========================================================================
-- APAGAR AS NOTAS FISCAIS RECEBIDAS
--
-- Decisao do usuario, antes da apresentacao: *"apague todas as notas fiscais
-- recebidas"*.
--
-- Cola no SQL Editor. NAO E MIGRATION, pelo mesmo motivo dos outros dois:
-- migration e schema e roda em todo ambiente; esta apaga DADO, uma vez, no
-- banco que alguem escolheu.
--
-- VER TAMBEM: `scripts/zerar-tasks-social-campanhas.sql` e
-- `scripts/zerar-full-days.sql`. Sao tres arquivos e nao um porque sao tres
-- decisoes -- um apagamento vale exatamente o que alguem pediu.
--
-- ---------------------------------------------------------------------------
-- O PASSO 1 NAO APAGA NADA, e e ele que decide. NAO TEM VOLTA.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A ARMADILHA E A MESMA DO FULL DAYS, NOUTRO LUGAR -- e aqui ela custa
-- DINHEIRO na tela do socio.
--
-- `team_invoices.finance_entry_id` e `on delete SET NULL` (0065), e nao
-- cascade. Toda nota que o socio marcou como PAGA criou uma DESPESA em
-- `finance_entries` -- e e assim que a rentabilidade por cliente nao ignora o
-- maior custo da casa. Apagar so as NOTAS deixa essas despesas no Financeiro,
-- sem nota nenhuma do outro lado: o Financeiro continua dizendo que a agencia
-- gastou aquilo, e nao ha mais de onde ele veio.
--
-- O `set null` esta CERTO onde ele existe: a despesa e um fato contabil, e um
-- lancamento nao pode sumir porque alguem mexeu na nota. Ele e errado so aqui,
-- onde os dois sao de teste.
--
-- Entao a DESPESA sai primeiro, e ela e encontrada pela ponte: as unicas
-- despesas que este arquivo toca sao as que uma nota aponta. Lancamento que o
-- socio escreveu a mao no Financeiro nao e nota fiscal e fica onde esta.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- ELE FOI RODADO, e a armadilha acima foi MEDIDA em vez de deduzida.
--
-- Contra um Postgres 16 do zero, com as 94 migrations e o `seed.sql`, com as
-- notas levadas ate `paga` pela maquina de estados de verdade (enviada ->
-- aprovada -> paga, que e o caminho que cria a despesa):
--
--   - apagando SO as notas, sobram 3 despesas no Financeiro somando
--     R$ 13.450,00, sem nota nenhuma do outro lado. E o relato que ainda nao
--     aconteceu;
--   - rodando o arquivo inteiro, as 5 notas e as 3 despesas saem, e o
--     Financeiro fica com os 38 lancamentos que nao eram de nota, os 3
--     contratos e as 13 categorias.
--
-- *Um detalhe que a contagem do PASSO 1 ja trata, e vale saber:* nota que
-- nasceu `paga` por um `insert` direto -- como a do seed -- nunca passou pelo
-- trigger e nao tem despesa. Por isso o PASSO 1 conta pela PONTE
-- (`finance_entry_id`), e nao por "quantas estao pagas": sao numeros
-- diferentes, e o que importa e quantas despesas existem de verdade.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O QUE ESTE ARQUIVO NAO TOCA, e e decisao:
--
--   - O RESTO DO FINANCEIRO: contratos, categorias e todo lancamento que nao
--     nasceu de uma nota paga. "Notas fiscais recebidas" nao e "o Financeiro".
--   - OS ARQUIVOS no bucket `notas-fiscais`. Estao no PASSO 3, com o motivo --
--     e aqui o cuidado e maior que nas artes: uma nota fiscal traz CNPJ,
--     endereco e valor, entao o bucket e privado e a pasta e da pessoa.
--   - `audit_log`. A trilha do socio registra ESTA limpeza, e esta certo: ela
--     e o unico lugar que guarda que houve nota e que ela saiu -- e `valor`
--     passa por ela, que e por que so o socio le a trilha.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- PASSO 1 -- O QUE VAI SAIR. Cole SO ISTO primeiro.
-- ===========================================================================

select 'notas fiscais'                      as o_que, count(*) as quantas from public.team_invoices
union all select '  dessas, so enviadas',            count(*) from public.team_invoices where status = 'enviada'
union all select '  dessas, aprovadas',              count(*) from public.team_invoices where status = 'aprovada'
union all select '  dessas, JA PAGAS',               count(*) from public.team_invoices where status = 'paga'
union all select '  dessas, recusadas',              count(*) from public.team_invoices where status = 'recusada'
union all select 'despesas que elas criaram',        count(*) from public.finance_entries
  where id in (select finance_entry_id from public.team_invoices where finance_entry_id is not null)
union all select 'pedidos de "notas do mes"',        count(*) from public.invoice_requests
union all select 'avisos do sino de nota fiscal',    count(*) from public.notifications
  where link like '/painel/notas-fiscais%'
order by 1;

-- QUANTO SAI DO FINANCEIRO, em reais. E o numero que diz o tamanho do que
-- esta sendo apagado -- e ele e a unica coisa entre o clique e o apagamento.
select coalesce(sum(f.valor), 0) as total_das_despesas_que_saem,
       count(*)                  as lancamentos
  from public.finance_entries f
 where f.id in (select finance_entry_id from public.team_invoices where finance_entry_id is not null);


-- ===========================================================================
-- PASSO 2 -- A LIMPEZA. Cole isto depois de ler o PASSO 1.
--
-- O SQL Editor roda o arquivo colado como UMA transacao: ou os quatro comandos
-- passam, ou nenhum passa.
-- ===========================================================================

-- 1. AS DESPESAS QUE NASCERAM DE NOTA PAGA, e so elas. Sem esta linha elas
--    ficam no Financeiro apontando para nota nenhuma.
delete from public.finance_entries
 where id in (select finance_entry_id from public.team_invoices where finance_entry_id is not null);

-- 2. AS NOTAS.
delete from public.team_invoices;

-- 3. OS PEDIDOS DE "notas do mes" -- o registro de quando o socio cobrou e de
--    quantas pessoas ele cobrou. Sem as notas, eles cobram um mes que nao
--    existe mais, e a faixa na tela de quem deve some junto.
delete from public.invoice_requests;

-- 4. OS AVISOS DO SINO do modulo, e so deles.
delete from public.notifications where link like '/painel/notas-fiscais%';


-- ===========================================================================
-- PASSO 2B -- A CONFERENCIA. As quatro primeiras tem de dar 0, e o Financeiro
-- tem de continuar com o resto.
-- ===========================================================================

select 'notas fiscais'                   as o_que, count(*) as sobraram from public.team_invoices
union all select 'pedidos de notas do mes',       count(*) from public.invoice_requests
union all select 'despesas orfas de nota',        count(*) from public.finance_entries f
  where not exists (select 1 from public.team_invoices t where t.finance_entry_id = f.id)
    and f.descricao ilike '%nota fiscal%'
union all select 'lancamentos do Financeiro (continuam)', count(*) from public.finance_entries
union all select 'contratos (continuam)',         count(*) from public.contracts
union all select 'categorias (continuam)',        count(*) from public.finance_categories
order by 1;


-- ===========================================================================
-- PASSO 3 (OPCIONAL) -- OS ARQUIVOS DAS NOTAS
--
-- Com as notas fora, nada no produto aponta mais para estes PDFs: a tela os
-- alcanca por URL assinada a partir da linha que nao existe mais.
--
-- O JEITO CERTO E A TELA DE STORAGE do Supabase (Storage -> `notas-fiscais` ->
-- selecionar as pastas -> Delete), e nao este SQL: apagar a linha de
-- `storage.objects` tira o arquivo do alcance da API e deixa o binario orfao,
-- que e metade do trabalho com a mesma cara de inteiro.
--
-- E ELES PEDEM MAIS CUIDADO QUE AS ARTES: uma nota fiscal traz CNPJ, endereco
-- e valor de cada pessoa. O bucket e privado e a pasta e de quem emitiu.
--
-- Para ver quanto ha antes de decidir:
--
--   select count(*) as arquivos
--     from storage.objects where bucket_id = 'notas-fiscais';
