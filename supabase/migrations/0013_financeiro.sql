-- ===========================================================================
-- 0013 - Financeiro da agencia e Financeiro Pessoal
--
-- DUAS COISAS QUE NAO SE MISTURAM, e estao na mesma migration so porque o
-- sprint as entregou junto:
--
--   1. O financeiro DA AGENCIA (contracts, finance_categories,
--      finance_entries). So `is_socio()` le e escreve. Nem desenvolvedor.
--   2. O financeiro PESSOAL de cada um (personal_finance_entries). So o
--      proprio dono le e escreve. Nem o socio.
--
-- Sao os dois extremos do sigilo no produto, e e proposital que fiquem lado a
-- lado aqui: quem mexer numa policy destas ve a outra na mesma tela.
--
-- O QUE O SPRINT PEDIA E NAO ENTRA: a tabela `invoices` e a aba "Notas
-- Fiscais" das notas que a agencia emite para o cliente. Decisao do usuario,
-- tomada neste sprint: a plataforma fica so com o modulo de nota fiscal DA
-- PESSOA (`/painel/notas-fiscais`, Sprint 3C), que e a nota que o colaborador
-- manda para a agencia receber. Emissao de NF para cliente continua fora do
-- Full Hub.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Vocabulario
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fin_tipo') then
    create type public.fin_tipo as enum ('receita', 'despesa');
  end if;

  -- `atrasado` esta no enum porque o sprint o pediu, mas NUNCA E GRAVADO.
  -- Veja o comentario de `situacao_do_lancamento()`, no PASSO 5: atraso e
  -- derivado da data, nao um estado que alguem escreve.
  if not exists (select 1 from pg_type where typname = 'fin_status') then
    create type public.fin_status as enum (
      'previsto', 'faturado', 'pago', 'atrasado', 'cancelado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'contrato_recorrencia') then
    create type public.contrato_recorrencia as enum (
      'mensal', 'trimestral', 'anual', 'pontual'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'pf_tipo') then
    create type public.pf_tipo as enum ('entrada', 'saida');
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - Contratos
--
-- O contrato e o que a agencia TEM A RECEBER de forma recorrente. E dele que
-- sai a receita prevista de cada mes, e e por isso que ele guarda recorrencia
-- e vigencia em vez de uma data so.
--
-- `on delete restrict` no cliente: apagar uma empresa que tem contrato
-- apagaria a memoria do que foi faturado dela. Cliente com historico se
-- desativa, nao se apaga -- a mesma regra que vale para pessoa.
-- ---------------------------------------------------------------------------

create table if not exists public.contracts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete restrict,
  nome           text not null,
  valor          numeric(12,2) not null,
  recorrencia    public.contrato_recorrencia not null default 'mensal',
  -- Dia do mes em que vence. Nulo em contrato pontual, que nao se repete.
  dia_vencimento integer check (dia_vencimento between 1 and 31),
  data_inicio    date not null,
  data_fim       date,
  ativo          boolean not null default true,
  observacoes    text,
  created_at     timestamptz not null default now(),
  constraint contracts_vigencia_coerente
    check (data_fim is null or data_fim >= data_inicio)
);

create index if not exists contracts_client_idx on public.contracts (client_id);
create index if not exists contracts_ativo_idx on public.contracts (ativo);

comment on table public.contracts is
  'Receita recorrente contratada. Leitura e escrita somente por socio.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Categorias
--
-- Categoria e por TIPO: "Mídia" como despesa e "Mídia" como receita sao duas
-- linhas diferentes, e e por isso que o unique e (nome, tipo) e nao so nome.
-- Numa agencia isso acontece o tempo todo: a verba de midia entra do cliente
-- e sai para a plataforma.
-- ---------------------------------------------------------------------------

create table if not exists public.finance_categories (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null,
  tipo   public.fin_tipo not null,
  unique (nome, tipo)
);

comment on table public.finance_categories is
  'Plano de contas simples. Leitura e escrita somente por socio.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - Lancamentos
--
-- COMPETENCIA x VENCIMENTO x PAGAMENTO sao tres datas diferentes, e e a
-- distincao que faz o relatorio prestar:
--
--   competencia -- o mes A QUE o valor se refere (o trabalho de setembro);
--   vencimento  -- quando deveria entrar ou sair;
--   pagamento   -- quando entrou ou saiu de verdade.
--
-- Um so campo de data obrigaria a escolher entre "quanto a agencia produziu
-- em setembro" e "quanto entrou no caixa em setembro", que sao as duas
-- perguntas que o socio faz.
--
-- `criado_por` nunca vem do formulario: sai da sessao. O default existe para
-- a migration nao quebrar em linha antiga, mas a action preenche sempre.
-- ---------------------------------------------------------------------------

create table if not exists public.finance_entries (
  id          uuid primary key default gen_random_uuid(),
  tipo        public.fin_tipo not null,
  client_id   uuid references public.clients (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  category_id uuid references public.finance_categories (id) on delete set null,
  descricao   text not null,
  valor       numeric(12,2) not null,
  competencia date not null,
  vencimento  date,
  pagamento   date,
  status      public.fin_status not null default 'previsto',
  fornecedor  text,
  observacoes text,
  criado_por  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index if not exists finance_entries_competencia_idx
  on public.finance_entries (competencia);
create index if not exists finance_entries_client_idx
  on public.finance_entries (client_id);
create index if not exists finance_entries_vencimento_idx
  on public.finance_entries (vencimento)
  where pagamento is null;

-- "Gerar lancamentos do mes" rodado duas vezes nao pode duplicar. A trava e
-- ESTE indice, nao a consulta da action: duas abas abertas clicando ao mesmo
-- tempo passariam pelas duas consultas antes de qualquer uma gravar.
-- Parcial porque lancamento avulso nao tem contrato, e varios deles podem
-- coexistir na mesma competencia.
create unique index if not exists finance_entries_contrato_competencia_uk
  on public.finance_entries (contract_id, competencia)
  where contract_id is not null;

comment on table public.finance_entries is
  'Receitas e despesas da agencia. Leitura e escrita somente por socio.';
comment on column public.finance_entries.competencia is
  'Mes A QUE o valor se refere, sempre no dia 1. Diferente de vencimento e de pagamento.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - Competencia e o atraso derivado
-- ---------------------------------------------------------------------------

-- A competencia e um MES, e por isso vira sempre dia 1. Guardar 2026-09-17
-- como competencia faria "setembro" depender de qual dia foi digitado, e dois
-- lancamentos do mesmo mes cairiam em grupos diferentes no relatorio.
create or replace function public.normalizar_competencia()
returns trigger
language plpgsql
as $$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  return new;
end;
$$;

drop trigger if exists finance_entries_competencia on public.finance_entries;
create trigger finance_entries_competencia
  before insert or update of competencia on public.finance_entries
  for each row execute function public.normalizar_competencia();

-- Pago exige a data do pagamento, e ter a data exige estar pago. Sem as duas
-- direcoes, "marcar como pago" sem preencher a data deixaria o titulo fora do
-- realizado do mes -- e o socio veria o dinheiro sumir do relatorio sem
-- entender por que.
create or replace function public.coerencia_do_pagamento()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pago' and new.pagamento is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Lancamento pago precisa da data do pagamento.';
  end if;

  if new.pagamento is not null and new.status not in ('pago', 'cancelado') then
    new.status := 'pago';
  end if;

  -- `atrasado` e derivado, nunca gravado: veja situacao_do_lancamento().
  if new.status = 'atrasado' then
    new.status := 'previsto';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_entries_pagamento on public.finance_entries;
create trigger finance_entries_pagamento
  before insert or update on public.finance_entries
  for each row execute function public.coerencia_do_pagamento();

/*
 * A situacao que a tela mostra.
 *
 * ATRASO NAO E UM ESTADO GRAVADO, e a razao e a mesma pela qual bloqueio de
 * subtarefa nao e status: ele depende da data de hoje. Uma coluna dizendo
 * "atrasado" precisaria de uma rotina noturna para continuar verdadeira, e no
 * dia em que a rotina nao rodasse o relatorio mentiria sem avisar ninguem.
 *
 * Derivado, ele esta certo a cada leitura, inclusive um minuto depois da
 * meia-noite. `lib/dominio/financeiro.ts` repete esta regra em TypeScript de
 * proposito -- a tela precisa da mesma resposta sem ida ao banco --, e as duas
 * sao testadas contra os mesmos casos.
 */
create or replace function public.situacao_do_lancamento(
  p_status     public.fin_status,
  p_vencimento date,
  p_pagamento  date
) returns public.fin_status
language plpgsql
-- `stable`, nunca `immutable`: ela le current_date. Marcada immutable, o
-- Postgres aceita criar e depois pode congelar o resultado dentro de uma
-- consulta ou de um indice -- e o atraso pararia de virar atraso a cada
-- meia-noite, que e a unica coisa que esta funcao faz.
stable
as $$
begin
  if p_status in ('pago', 'cancelado') then
    return p_status;
  end if;
  if p_pagamento is not null then
    return 'pago';
  end if;
  if p_vencimento is not null and p_vencimento < current_date then
    return 'atrasado';
  end if;
  return p_status;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 6 - RLS do financeiro da agencia
--
-- SO O SOCIO. LEIA ISTO ANTES DE AFROUXAR.
--
-- Nao existe "so leitura para o gestor", e a omissao e deliberada: o
-- desenvolvedor e gestao para todo o resto do sistema -- cadastra cliente,
-- aprova entrega, distribui trabalho -- e aqui nao. Faturamento por cliente,
-- margem e inadimplencia sao a informacao mais sensivel da casa; quem pode
-- le-la e quem responde por ela.
--
-- A mesma regra vale nas tres tabelas, nos quatro comandos, sem excecao. Se um
-- dia a agencia quiser abrir para o desenvolvedor, que seja decisao explicita
-- com policy nova e aviso na tela -- nao um `using (is_gestor())` que entrou
-- de carona numa tabela nova.
-- ---------------------------------------------------------------------------

alter table public.contracts          enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_entries    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['contracts', 'finance_categories', 'finance_entries']
  loop
    execute format('drop policy if exists %I_socio_select on public.%I', t, t);
    execute format('drop policy if exists %I_socio_insert on public.%I', t, t);
    execute format('drop policy if exists %I_socio_update on public.%I', t, t);
    execute format('drop policy if exists %I_socio_delete on public.%I', t, t);

    execute format(
      'create policy %I_socio_select on public.%I for select using (public.is_socio())', t, t);
    execute format(
      'create policy %I_socio_insert on public.%I for insert with check (public.is_socio())', t, t);
    execute format(
      'create policy %I_socio_update on public.%I for update using (public.is_socio()) with check (public.is_socio())', t, t);
    execute format(
      'create policy %I_socio_delete on public.%I for delete using (public.is_socio())', t, t);
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 7 - Financeiro Pessoal
--
-- O OUTRO EXTREMO. So o dono le e escreve, nas quatro operacoes.
--
-- Nem o socio, que alcanca todo o resto do sistema, alcanca isto. Nao existe
-- policy de leitura para gestao, nao existe relatorio agregado, e nenhuma
-- consulta do painel pode cruzar esta tabela com nada -- e a mesma regra do
-- Resumo Semanal, pela mesma razao: o modulo so tem serventia se a pessoa
-- confiar nele, e basta um relatorio da gestao citando um numero daqui para a
-- confianca acabar de vez.
--
-- `on delete cascade` no usuario: aqui o historico NAO e para preservar. Se a
-- pessoa sai da agencia, o controle de gastos dela vai junto -- o oposto do
-- que vale para autoria de task, que fica.
-- ---------------------------------------------------------------------------

create table if not exists public.personal_finance_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tipo       public.pf_tipo not null,
  descricao  text not null,
  categoria  text,
  valor      numeric(12,2) not null,
  data       date not null,
  recorrente boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists personal_finance_user_data_idx
  on public.personal_finance_entries (user_id, data);

comment on table public.personal_finance_entries is
  'Controle financeiro PESSOAL. So o proprio dono le e escreve -- nem o socio.';

alter table public.personal_finance_entries enable row level security;

drop policy if exists personal_finance_select on public.personal_finance_entries;
drop policy if exists personal_finance_insert on public.personal_finance_entries;
drop policy if exists personal_finance_update on public.personal_finance_entries;
drop policy if exists personal_finance_delete on public.personal_finance_entries;

create policy personal_finance_select on public.personal_finance_entries
  for select using (user_id = (select auth.uid()));

create policy personal_finance_insert on public.personal_finance_entries
  for insert with check (user_id = (select auth.uid()));

create policy personal_finance_update on public.personal_finance_entries
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- DELETE existe, e e importante que exista: "apagar todos os meus dados" e o
-- que permite a pessoa sair do modulo sem deixar rastro. Um modulo opcional
-- do qual nao se consegue sair nao e opcional.
create policy personal_finance_delete on public.personal_finance_entries
  for delete using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 8 - Plano de contas inicial
--
-- Catalogo vazio faria o socio inventar o vocabulario na primeira noite de
-- fechamento, que e o pior momento para decidir nome de categoria.
-- ---------------------------------------------------------------------------

insert into public.finance_categories (nome, tipo) values
  ('Fee mensal',           'receita'),
  ('Projeto pontual',      'receita'),
  ('Verba de mídia',       'receita'),
  ('Produção',             'receita'),
  ('Outras receitas',      'receita'),
  ('Salários e pró-labore','despesa'),
  ('Freelancers',          'despesa'),
  ('Mídia paga',           'despesa'),
  ('Ferramentas e software','despesa'),
  ('Estrutura',            'despesa'),
  ('Impostos',             'despesa'),
  ('Produção externa',     'despesa'),
  ('Outras despesas',      'despesa')
on conflict (nome, tipo) do nothing;
