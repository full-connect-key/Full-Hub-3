-- ===========================================================================
-- 0149 - O ESCOPO DO CONTRATO MENSAL
--
-- Decisao do usuario: *"No portal do cliente, deve aparecer um espaco onde
-- mostra quantos % do escopo do contrato mensal, o cliente ja usou. essas
-- quantidades devem ser preenchidas pela agencia na parte interna, onde
-- visualiza a conta cliente a cliente. assim, o cliente vai saber quantos
-- posts ele ainda tem direito, e outras informacoes em aberto"*.
--
-- ---------------------------------------------------------------------------
-- A MEDICAO QUE DECIDE ESTA MIGRATION, e ela e o contrario do que a regra
-- desta casa faria por reflexo.
--
-- "O que da para calcular nao se guarda" e a frase mais repetida do produto --
-- atraso nao e coluna, bloqueio nao e status, `maoDoPost()` nao e gravada. A
-- tentacao aqui e CONTAR o usado: tantos posts no mes, tantas pecas de
-- campanha, e a porcentagem sai de graca.
--
-- Medido contra o Postgres de producao, no dia desta migration: 21 contas
-- ativas, 3 posts, ZERO pecas de campanha, ZERO meses de social abertos, ZERO
-- campanhas. Quer dizer que um "usado" contado leria **0% em toda conta, todo
-- mes**, e o bloco que o usuario pediu nasceria afirmando que nenhum cliente
-- consumiu nada do contrato dele.
--
-- E nao e so a falta de dado. Para contar seria preciso um DE-PARA entre tres
-- vocabularios que o produto mantem separados de proposito: `posts.midia`
-- (imagem/carrossel/video, 0042), `posts.formato` (Feed, Stories, Reels,
-- texto livre desde a 0032 porque "esses nomes mudam a cada temporada") e
-- `deliverables.tipo` (sete valores, 0122). Um de-para entre eles e, nas
-- palavras deste arquivo, *o lugar onde as duas verdades comecam a divergir* --
-- e ele decidiria quanto a agencia pode cobrar.
--
-- Entao o usado e DIGITADO, e isso nao quebra a regra: ela e sobre fato que o
-- produto DERIVA. Aqui o produto nao deriva -- quem sabe que o contrato de
-- doze posts consumiu sete e a pessoa que fez os sete.
--
-- ---------------------------------------------------------------------------
-- SAO DUAS TABELAS, e a razao e o numero de vezes que alguem digita.
--
-- Numa tabela so -- `(client_id, competencia, descricao, contratado, usado)` --
-- a agencia reescreveria a lista inteira todo mes: 21 contas vezes uma duzia
-- de itens sao duzentas e cinquenta linhas digitadas por mes, que e exatamente
-- o campo que ninguem preenche (a 0015).
--
-- O CONTRATO e um por conta e se digita UMA vez (doze posts, oito stories, um
-- relatorio). O CONSUMO e por mes, e por item e UM numero -- o minimo
-- possivel.
--
-- ---------------------------------------------------------------------------
-- E O USADO PODE PASSAR DO CONTRATADO, de proposito e sem check.
--
-- Um teto em `usado <= quantidade` e a tentacao obvia e esconderia justamente
-- o fato que a agencia precisa ver: o mes em que o cliente pediu mais do que
-- contratou. A barra passa de 100%, a tela diz isso em palavras, e e essa a
-- conversa que o bloco existe para abrir.
--
-- ---------------------------------------------------------------------------
-- E NAO HA POLICY DE DELETE EM NENHUMA DAS DUAS. Um item que sai do contrato
-- se DESATIVA, que e a regra de `client_vertentes` (0118) e de `skills.ativa`:
-- apagar levaria o consumo de todo mes que aponta para ele, que e justamente o
-- historico do que a conta usou.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1 - O contrato: uma linha por item, por conta
--
-- `descricao` e TEXTO LIVRE e nao enum, ao contrario de `deliverable_tipo`
-- (0122). Aquele enum existe porque e a dimensao que o relatorio da agencia
-- AGRUPA entre campanhas, e com texto livre "Estatico" e "estatico" viram duas
-- linhas do mesmo material. Aqui ninguem agrupa entre contas: o escopo de uma
-- conta e lido ao lado dele mesmo, e o pedido diz *"e outras informacoes em
-- aberto"* -- "2 reunioes mensais", "1 relatorio de performance", "4 e-mails
-- marketing". Um enum recusaria metade do que um contrato de agencia tem
-- dentro, e a recusa chegaria como um seletor sem a opcao que a pessoa
-- procura.
--
-- `quantidade > 0` pela razao da 0122: uma linha de zero contratado afirma um
-- contrato de nada -- um item que nao esta no contrato nao tem linha.
-- ---------------------------------------------------------------------------
create table if not exists public.client_scope_items (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  descricao   text not null,
  quantidade  integer not null,
  unidade     text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.client_scope_items
  drop constraint if exists client_scope_items_descricao_escrita;
alter table public.client_scope_items
  add constraint client_scope_items_descricao_escrita
    check (btrim(descricao) <> '');

alter table public.client_scope_items
  drop constraint if exists client_scope_items_quantidade_positiva;
alter table public.client_scope_items
  add constraint client_scope_items_quantidade_positiva
    check (quantidade > 0 and quantidade <= 100000);

-- O INDICE E PARCIAL, so entre os ATIVOS: dois itens chamados "Posts" no mesmo
-- contrato sao duas barras dizendo a mesma coisa, e quem le nao tem como
-- reconciliar. Um item desativado nao disputa o nome com o que o substituiu --
-- e a forma dos indices de `client_folders` (0139).
--
-- E a comparacao e por `lower(btrim(...))`, senao "Posts" e "posts " sao dois.
create unique index if not exists client_scope_items_nome_unico
  on public.client_scope_items (client_id, lower(btrim(descricao)))
  where ativo;

create index if not exists client_scope_items_por_conta
  on public.client_scope_items (client_id, ordem);

comment on table public.client_scope_items is
  'O escopo do contrato MENSAL de uma conta (0149): uma linha por item, digitada uma vez. Nao se apagam -- desativam-se, senao o consumo de todo mes que aponta para o item vai junto.';
comment on column public.client_scope_items.descricao is
  'O nome do item nas palavras do contrato -- "Posts no feed", "Stories", "Relatorio de performance". Texto livre e nao enum: ninguem agrupa escopo entre contas, e o pedido fala de "outras informacoes em aberto".';
comment on column public.client_scope_items.unidade is
  'Opcional, para o item que nao se conta em unidades -- "horas", "GB". Nulo quer dizer que a propria descricao e a unidade.';
comment on column public.client_scope_items.ordem is
  'Passo de dez, para inserir no meio sem renumerar o resto (0118).';
comment on column public.client_scope_items.ativo is
  'Falso sai do portal e do consumo novo, e CONTINUA valendo para o consumo dos meses que ja aponta para ele.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O consumo: um numero por item, por mes
--
-- `competencia` e sempre o DIA 1, carimbado por gatilho -- a forma de
-- `finance_entries.competencia` (0013): guardar `2026-11-17` faria "novembro"
-- depender de qual dia alguem digitou.
--
-- `unique (item_id, competencia)` e a trava: dois numeros para o mesmo item no
-- mesmo mes sao duas respostas para "quanto este cliente usou", e a tela
-- desenharia uma delas sem dizer qual.
-- ---------------------------------------------------------------------------
create table if not exists public.client_scope_usage (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.client_scope_items(id) on delete cascade,
  competencia  date not null,
  usado        integer not null default 0,
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (item_id, competencia)
);

-- SEM TETO SUPERIOR, e a razao esta no cabecalho: o mes em que o cliente
-- passou do contrato e o fato que o bloco existe para mostrar.
alter table public.client_scope_usage
  drop constraint if exists client_scope_usage_usado_nao_negativo;
alter table public.client_scope_usage
  add constraint client_scope_usage_usado_nao_negativo
    check (usado >= 0 and usado <= 1000000);

create index if not exists client_scope_usage_por_competencia
  on public.client_scope_usage (competencia);

comment on table public.client_scope_usage is
  'Quanto de um item do escopo a conta usou em UM mes (0149). Um numero por item por mes -- o minimo que a agencia digita. O usado PODE passar do contratado: e o mes em que o cliente pediu mais do que contratou.';
comment on column public.client_scope_usage.observacao is
  'Opcional, para o mes que precisa de uma frase -- "3 extras aprovados por e-mail". O cliente le.';

create or replace function public.carimbar_competencia_do_escopo()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  new.updated_at  := now();
  return new;
end
$fn$;

drop trigger if exists client_scope_usage_carimba on public.client_scope_usage;
create trigger client_scope_usage_carimba
  before insert or update on public.client_scope_usage
  for each row execute function public.carimbar_competencia_do_escopo();

comment on function public.carimbar_competencia_do_escopo() is
  'Forca a competencia do consumo para o dia 1 do mes (0149), como a 0013 faz no Financeiro: sem isto "novembro" depende de qual dia alguem digitou.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Quem le e quem escreve
--
-- LER E DE `is_staff()` MAIS A PROPRIA EMPRESA, que e a forma de
-- `client_vertentes` (0118): o cliente precisa do escopo para o bloco do
-- portal, e le so o da conta dele pelo `my_client_ids()` de sempre.
--
-- ESCREVER E DE `is_gestor()`, e a razao e a frase do pedido -- *"preenchidas
-- pela agencia na parte interna, onde visualiza a conta cliente a cliente"*. A
-- ficha do cliente e `GESTAO` na rota desde o Sprint 3C, entao quem chega la
-- ja passou; rota nao e trava, e quem montar o `insert` a mao bate aqui.
--
-- E O CLIENTE NAO ESCREVE NADA, nem o consumo da propria conta: o escopo e o
-- que a agencia afirma ter entregue, e o portal e onde ele LE isso.
-- ---------------------------------------------------------------------------
alter table public.client_scope_items enable row level security;
alter table public.client_scope_usage enable row level security;

drop policy if exists client_scope_items_select on public.client_scope_items;
create policy client_scope_items_select on public.client_scope_items
  for select to authenticated
  using (public.is_staff() or client_id in (select public.my_client_ids()));

drop policy if exists client_scope_items_insert on public.client_scope_items;
create policy client_scope_items_insert on public.client_scope_items
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists client_scope_items_update on public.client_scope_items;
create policy client_scope_items_update on public.client_scope_items
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- O SELECT DO CONSUMO PERGUNTA PELO ITEM, e nao por uma coluna `client_id`
-- repetida aqui. Uma segunda coluna da conta seria a segunda verdade sobre de
-- quem e aquele numero, e ela divergiria num `update` que trocasse o item.
drop policy if exists client_scope_usage_select on public.client_scope_usage;
create policy client_scope_usage_select on public.client_scope_usage
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.client_scope_items i
       where i.id = client_scope_usage.item_id
         and i.client_id in (select public.my_client_ids())
    )
  );

drop policy if exists client_scope_usage_insert on public.client_scope_usage;
create policy client_scope_usage_insert on public.client_scope_usage
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists client_scope_usage_update on public.client_scope_usage;
create policy client_scope_usage_update on public.client_scope_usage
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 4 - A trilha de auditoria
--
-- As duas entram, pela razao da 0058: o escopo e o que a agencia afirma ter
-- contratado e entregue, e e sobre ele que a conversa de cobranca acontece.
-- Quem mudou um numero de doze para oito precisa estar escrito em algum lugar,
-- e `audit_log` e so do socio -- que e exatamente quem responde por contrato.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['client_scope_items', 'client_scope_usage']
  loop
    execute format('drop trigger if exists auditoria_%1$s on public.%1$s', t);
    execute format(
      'create trigger auditoria_%1$s after insert or update or delete on public.%1$s'
      || ' for each row execute function public.registrar_auditoria()', t);
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in ('client_scope_items', 'client_scope_usage');
  if n <> 6 then
    raise exception 'esperava 6 policies no escopo do contrato, achei %', n;
  end if;

  if to_regclass('public.client_scope_items') is null
     or to_regclass('public.client_scope_usage') is null then
    raise exception 'as tabelas do escopo nao foram criadas';
  end if;

  raise notice '0149 ok: escopo do contrato com 6 policies, carimbo de competencia e auditoria.';
end
$$;
