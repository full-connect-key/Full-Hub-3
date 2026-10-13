-- ===========================================================================
-- ZERAR OS GASTOS DA AGENCIA
--
-- Decisao do usuario, na mesma conversa que reduziu o Financeiro a duas abas:
-- *"Zera as despesas também"*. O que estava ali era lancamento de teste --
-- seed e conferencia -- e o modulo estreia com a aba Softwares em branco.
--
-- Cole no SQL Editor do Supabase. O PASSO 1 **NAO APAGA NADA**.
--
--
-- O PASSO 1 E A UNICA COISA ENTRE O CLIQUE E O APAGAMENTO
--
-- Nenhuma trava deste produto recusa um `delete` vindo do SQL Editor: a RLS
-- nao vale para o dono do banco, e nao existe gatilho impedindo apagar
-- `finance_entries`. Entao o que faz alguem parar e o NUMERO -- a mesma
-- decisao do dialogo de apagar campanha e do de apagar o mes de social, que
-- contam em vez de perguntar "tem certeza?".
--
-- Leia o PASSO 1, confira que os numeros batem com o que voce espera, e so
-- entao cole o PASSO 2.
--
--
-- A ARMADILHA E A ORDEM, E ELA JA FOI PAGA DUAS VEZES
--
-- `team_invoices.finance_entry_id` e `on delete SET NULL` (0065). Quer dizer
-- que apagar os gastos NAO apaga as notas -- e esta certo, porque a nota e o
-- documento que a pessoa emitiu, nao o lancamento que ela gerou. Mas tambem
-- quer dizer que a nota paga perde o vinculo e passa a nao apontar para
-- lancamento nenhum: se ela voltar a `paga` por algum caminho,
-- `nota_paga_vira_despesa()` lanca de novo, porque a guarda dela e justamente
-- `finance_entry_id is not null`.
--
-- Na pratica isso nao acontece -- nota paga nao muda mais de estado, nem pelo
-- socio (0065) --, e fica escrito porque e o tipo de consequencia que aparece
-- um ano depois sem ninguem ligar uma coisa a outra. **Se voce quer zerar as
-- notas tambem, o arquivo e `scripts/zerar-notas-fiscais.sql`**, e ele apaga
-- as duas pontas na ordem certa.
--
--
-- O QUE FICA, E E DECISAO
--
--   * `finance_categories` -- o plano de contas e configuracao, nao dado de
--     teste: sem ele a aba Softwares abre com o seletor de categoria vazio, e
--     quem lancar o primeiro gasto nao tem onde classifica-lo;
--   * `team_invoices` -- as notas da equipe, por tudo o que esta acima;
--   * `audit_log` -- a trilha e justamente o registro de que houve lancamento
--     e de que ele saiu. Apaga-la seria apagar a prova do apagamento.
--
-- NAO HA RECEITA PARA ZERAR: a 0095 apagou `contracts`, a coluna `tipo` e as
-- categorias de receita. Toda linha de `finance_entries` e gasto.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O QUE VAI SAIR  (nao apaga nada; leia antes de colar o PASSO 2)
-- ---------------------------------------------------------------------------

select 'gastos no total'                as o_que, count(*)::text as quantos
  from public.finance_entries
union all
select 'ja pagos',                      count(*)::text
  from public.finance_entries where status = 'pago'
union all
select 'em aberto',                     count(*)::text
  from public.finance_entries where status <> 'pago' and status <> 'cancelado'
union all
select 'vieram de nota fiscal da equipe', count(*)::text
  from public.finance_entries f
 where exists (select 1 from public.team_invoices i where i.finance_entry_id = f.id)
union all
select 'soma de tudo (R$)',
       to_char(coalesce(sum(valor), 0), 'FM999G999G990D00')
  from public.finance_entries
union all
select 'competencia mais antiga',
       coalesce(min(competencia)::text, '-')
  from public.finance_entries
union all
select 'competencia mais recente',
       coalesce(max(competencia)::text, '-')
  from public.finance_entries;

-- E o que NAO sai, para a conferencia ser dos dois lados.
select 'categorias de gasto (FICAM)'  as o_que, count(*)::text as quantos
  from public.finance_categories
union all
select 'notas da equipe (FICAM)',       count(*)::text
  from public.team_invoices
union all
select 'notas que perdem o vinculo',    count(*)::text
  from public.team_invoices where finance_entry_id is not null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - APAGA  (so depois de ler o PASSO 1)
--
-- Numa transacao so: ou sai tudo, ou nao sai nada. Com dois comandos soltos,
-- o segundo falhando deixaria o Financeiro meio zerado -- e meio zerado e o
-- unico estado que nao se explica para ninguem.
-- ---------------------------------------------------------------------------

begin;

delete from public.finance_entries;

-- A CONFERENCIA ANTES DO COMMIT. Se qualquer um destes nao for zero, de
-- `rollback` em vez de `commit` e descubra por que.
select 'gastos que sobraram' as o_que, count(*)::text as quantos
  from public.finance_entries;

commit;


-- ---------------------------------------------------------------------------
-- DEPOIS: o que a tela passa a mostrar
--
-- A aba Softwares abre com o vazio desenhado -- "Nenhum gasto neste mês",
-- com a frase que diz que a nota marcada como paga entra ali sozinha. A faixa
-- ambar de atraso de meses anteriores nao aparece, porque nao ha atraso. E a
-- aba Notas recebidas nao muda: ela le `team_invoices`, que ficou inteira.
-- ---------------------------------------------------------------------------
