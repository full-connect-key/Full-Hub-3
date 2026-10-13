-- ===========================================================================
-- 0095 - A RECEITA SAI DO FINANCEIRO, E A DESPESA FICA
--
-- Decisao do usuario: "Preciso que o financeiro tenha apenas duas abas, a aba
-- de visualizar as notas recebidas, e pagar, ou recusar, e a aba de Softwares
-- - em que a pessoa responsavel consegue fazer controle, de todos os gastos da
-- agencia".
--
-- Duas abas, e nenhuma delas e sobre faturamento. Entao o que sai e a RECEITA:
-- o contrato que a gera, a coluna que separa uma da outra, e a conta que
-- cruzava as duas com as horas da equipe.
--
--
-- `finance_entries` FICA, E ESSA E A LINHA QUE MAIS IMPORTA DESTA MIGRATION.
--
-- A primeira leitura do pedido foi apagar as duas tabelas, e ela nao sobrevive
-- a uma chave estrangeira: `team_invoices.finance_entry_id` aponta para
-- `finance_entries` desde a 0065, e `nota_paga_vira_despesa()` grava ali
-- quando o socio marca uma nota como paga. Apagar a tabela quebraria o botao
-- Pagar -- que e a OUTRA aba que o pedido descreve.
--
-- E ela e, literalmente, a tabela de gastos: `finance_entries` com
-- `tipo = 'despesa'` e o controle de despesa da agencia, com categoria,
-- competencia, vencimento, pagamento e fornecedor. A aba Softwares nao precisa
-- de tabela nova; precisa que esta pare de carregar receita junto.
--
--
-- AS LINHAS DE RECEITA SAEM ANTES DA COLUNA, e a ordem nao e zelo.
--
-- `drop column tipo` sozinho nao apaga receita nenhuma: ele apaga a DISTINCAO.
-- Toda linha que era receita continuaria la, indistinguivel, e a aba de gastos
-- abriria somando o faturamento da agencia como se fosse despesa. O numero
-- sairia alto, plausivel, e errado -- que e o modo de falha desta casa.
--
--
-- `finance_categories.tipo` SAI JUNTO, e ela quase passou batida.
--
-- A categoria tambem e tipada (`unique (nome, tipo)`), entao "Software" podia
-- existir duas vezes, uma de cada lado. Sem receita, sobra um lado so: as
-- categorias de receita saem, a coluna sai, e a unicidade passa a ser o nome.
-- Deixar a coluna manteria no cadastro uma pergunta que nao decide mais nada
-- -- o pior tipo de campo, porque quem responde acha que garantiu alguma
-- coisa. E a decisao da 0023 com `tasks.exigencia_aprovacao`.
--
--
-- O TIPO SAI, e isto NAO contradiz a regra de `cancelada`.
--
-- O que o Postgres recusa e `alter type ... drop value` -- tirar UM valor de
-- um enum em uso. Apagar o tipo inteiro, quando nenhuma coluna o referencia,
-- e `drop type`, e foi o que a 0023 fez com `exigencia_aprovacao`.
-- `fin_tipo` e `contrato_recorrencia` nao sao citados em migration nenhuma
-- fora da 0013, entao os dois saem de verdade em vez de ficarem orfaos como
-- `pf_tipo` ficou na 0034.
--
--
-- O QUE SE PERDE, E E CONSEQUENCIA ACEITA POR QUEM DECIDIU
--
--   * faturamento por cliente, margem e inadimplencia -- a agencia deixa de
--     ter onde ver quanto entra;
--   * o DRE por categoria;
--   * `rentabilidade_do_periodo()` (0035) e a aba dela em /painel/metricas.
--     Ela cruza receita com as horas das subtarefas, e sem receita ela
--     devolveria uma coluna de zeros -- que e uma afirmacao sobre a conta, e o
--     que se quer dizer e que ninguem mede mais isso.
--
-- Foi dito a quem decidiu, e a saida continua existindo: o que sai daqui e
-- schema, nao regra de negocio espalhada. Devolver o faturamento e devolver a
-- tabela e as telas, com os dados antigos perdidos -- e por isso a decisao foi
-- confirmada duas vezes antes desta migration existir.
--
--
-- O QUE NAO MUDA
--
--   * `is_socio()` nos quatro comandos, nas tabelas que ficam. O desenvolvedor
--     continua de fora, e a aba de notas recebidas e a folha de pagamento da
--     agencia vista de outro angulo;
--   * `nota_paga_vira_despesa()` (0065) continua inteira -- e passa a ser o
--     caminho principal da despesa, em vez de um detalhe do modulo de notas;
--   * `coerencia_do_pagamento()` e `situacao_do_lancamento()`: atraso continua
--     DERIVADO, nunca gravado;
--   * a competencia continua gravada no dia 1, por trigger.
--
-- A auditoria se ajusta sozinha: o laco da 0058 pula a tabela que nao existe
-- (`to_regclass(...) is null then continue`), e o trigger de `contracts` sai
-- junto com ela. A trilha passa de 13 tabelas para 12.
--
--
-- E `nota_paga_vira_despesa()` TEM DE SER REESCRITA, no passo 7.
--
-- Esta e a parte que eu quase deixei de fora, e a bateria encontrou. O
-- cabecalho ja dizia que ela "continua inteira" e que ela passa a ser o
-- caminho PRINCIPAL da despesa -- e ela escrevia `tipo = 'despesa'` no insert.
-- Sem a reescrita, marcar uma nota como paga passa a levar
-- *"column tipo of relation finance_entries does not exist"*: a migration que
-- existe para arrumar a aba de gastos quebraria a aba de notas, que e a OUTRA
-- metade do pedido.
--
-- A licao e a de sempre, de outro angulo: `drop column` nao avisa quem
-- escrevia nela. O corpo de uma funcao e texto para o Postgres ate a hora de
-- rodar, e a hora de rodar e o clique de alguem.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A conta que cruzava receita com horas
--
-- Antes de tudo: ela le `finance_entries.tipo`, e a coluna sai no passo 4.
-- ---------------------------------------------------------------------------
drop function if exists public.rentabilidade_do_periodo(date, date);


-- ---------------------------------------------------------------------------
-- PASSO 2 - As linhas de receita
--
-- Antes da coluna, pela razao do cabecalho: sem isto elas viram despesa.
-- ---------------------------------------------------------------------------
do $migracao$
declare
  quantas bigint;
begin
  if to_regclass('public.finance_entries') is null then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'finance_entries'
       and column_name  = 'tipo'
  ) then
    raise notice '0095: finance_entries.tipo ja saiu, nada a apagar.';
    return;
  end if;

  delete from public.finance_entries where tipo = 'receita';
  get diagnostics quantas = row_count;
  raise notice '0095: % lancamento(s) de receita apagado(s).', quantas;
end
$migracao$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - As categorias de receita
--
-- `finance_entries.category_id` e `on delete set null`, entao isto nao arrasta
-- despesa nenhuma junto.
-- ---------------------------------------------------------------------------
do $migracao$
declare
  quantas bigint;
begin
  if to_regclass('public.finance_categories') is null then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'finance_categories'
       and column_name  = 'tipo'
  ) then
    return;
  end if;

  delete from public.finance_categories where tipo = 'receita';
  get diagnostics quantas = row_count;
  raise notice '0095: % categoria(s) de receita apagada(s).', quantas;
end
$migracao$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - As colunas
--
-- `contract_id` leva junto o indice unico parcial
-- `finance_entries_contrato_competencia`, que existia para "gerar lancamentos
-- do mes" nao duplicar. Sem contrato nao ha o que gerar, e a action some com
-- ele.
-- ---------------------------------------------------------------------------
alter table public.finance_entries drop column if exists contract_id;
alter table public.finance_entries drop column if exists tipo;

alter table public.finance_categories drop constraint if exists finance_categories_nome_tipo_key;
alter table public.finance_categories drop column if exists tipo;

-- A unicidade passa a ser so o nome. `if not exists` em constraint nao existe,
-- entao a criacao vai num bloco que confere antes -- a migration precisa poder
-- rodar duas vezes.
do $migracao$
begin
  if to_regclass('public.finance_categories') is null then
    return;
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.finance_categories'::regclass
       and conname  = 'finance_categories_nome_key'
  ) then
    alter table public.finance_categories
      add constraint finance_categories_nome_key unique (nome);
  end if;
end
$migracao$;


-- ---------------------------------------------------------------------------
-- PASSO 5 - O contrato
--
-- `cascade` porque a unica dependencia que sobrou e a policy dele proprio: a
-- coluna que o apontava saiu no passo 4, e o trigger de auditoria morre com a
-- tabela.
-- ---------------------------------------------------------------------------
drop table if exists public.contracts cascade;


-- ---------------------------------------------------------------------------
-- PASSO 6 - Os dois enums que ficaram sem coluna
-- ---------------------------------------------------------------------------
drop type if exists public.fin_tipo;
drop type if exists public.contrato_recorrencia;


-- ---------------------------------------------------------------------------
-- PASSO 7 - A funcao que escrevia na coluna que saiu
--
-- `nota_paga_vira_despesa()` (0065) lanca o gasto quando o socio marca a nota
-- como paga. Ela nomeava `tipo` no insert, e sem esta reescrita o botao Pagar
-- -- que e a PRIMEIRA aba do pedido -- passaria a recusar.
--
-- O corpo e o da 0065 menos a coluna. `security definer` continua, pela mesma
-- razao: `finance_entries` fecha em `is_socio()`, e quem decide o acesso e a
-- policy da nota mais o `nota_protege_colunas`, nao esta funcao. O trigger nao
-- e recriado -- ele aponta para o nome, e o nome nao mudou.
-- ---------------------------------------------------------------------------
create or replace function public.nota_paga_vira_despesa()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_nome     text;
  v_entrada  uuid;
begin
  if new.status <> 'paga' or old.status = 'paga' then
    return new;
  end if;

  if new.finance_entry_id is not null then
    return new;
  end if;

  select nome into v_nome from public.profiles where id = new.user_id;

  insert into public.finance_entries
    (descricao, valor, competencia, vencimento, pagamento, status,
     fornecedor, observacoes, criado_por)
  values (
    'Nota fiscal de ' || coalesce(v_nome, 'colaborador'),
    new.valor,
    new.competencia,
    new.pagamento,
    new.pagamento,
    'pago',
    coalesce(v_nome, 'Equipe'),
    case when new.numero is null then null else 'NF ' || new.numero end,
    -- SEM SESSAO O AUTOR E O PROPRIO DONO DA NOTA, e nao um nulo: `criado_por`
    -- e `not null` la, e derrubar o pagamento por causa do registro de autoria
    -- seria a 0062 de novo -- o aviso que leva junto a escrita que o chamou.
    coalesce((select auth.uid()), new.user_id)
  )
  returning id into v_entrada;

  new.finance_entry_id := v_entrada;
  return new;
end;
$func$;

comment on function public.nota_paga_vira_despesa is
  'Lanca o gasto quando a nota e marcada como paga (0065, reescrita na 0095 sem a coluna `tipo`). `security definer` porque finance_entries fecha em is_socio(); quem decide o acesso e a policy da nota, nao esta funcao.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - O que as tabelas dizem de si mesmas agora
--
-- `comment on` e o unico lugar que responde a quem abre o schema, e ele estava
-- falando de receita.
-- ---------------------------------------------------------------------------
comment on table public.finance_entries is
  'Os GASTOS da agencia (0095). Ate a 0095 ela guardava receita e despesa, separadas por uma coluna `tipo`; hoje toda linha e despesa. E o destino de nota_paga_vira_despesa() (0065) e a tabela que a aba Softwares do Financeiro le. So o socio alcanca, nos quatro comandos.';

comment on table public.finance_categories is
  'As categorias de gasto (0095). Ate a 0095 elas eram tipadas, e o mesmo nome podia existir dos dois lados; hoje o nome e unico.';


-- ---------------------------------------------------------------------------
-- CONFERENCIA - cole o bloco abaixo depois de aplicar
--
-- O esperado: a primeira devolve zero linhas, as duas seguintes devolvem
-- `false`, e a ultima devolve so as colunas que sobraram.
-- ---------------------------------------------------------------------------
-- select to_regclass('public.contracts') as contracts_ainda_existe;
--
-- select exists (
--   select 1 from information_schema.columns
--    where table_schema = 'public' and table_name = 'finance_entries'
--      and column_name in ('tipo', 'contract_id')
-- ) as colunas_de_receita_ainda_existem;
--
-- select exists (
--   select 1 from pg_type where typname in ('fin_tipo', 'contrato_recorrencia')
-- ) as enums_ainda_existem;
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'finance_entries'
--  order by ordinal_position;
