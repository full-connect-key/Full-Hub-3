-- ===========================================================================
-- 0122 — A CAMPANHA TEM COMPOSIÇÃO: quantos materiais de cada tipo
-- ===========================================================================
--
-- Decisão do usuário: *"permitir definir quantidades variáveis por tipo de
-- material — por exemplo 10 estáticos, 5 carrosséis, 3 vídeos, 15 stories, 2
-- banners e 1 landing page —, acrescentar e remover tipos, aceitar quantidade
-- zero, e registrar a quantidade planejada, produzida, entregue, aprovada e
-- pendente de ajustes."*
--
-- ---------------------------------------------------------------------------
-- O QUE JÁ EXISTIA, E POR QUE NÃO BASTAVA
-- ---------------------------------------------------------------------------
--
-- `campaign_templates.estrutura` aceita `quantidade` num grupo desde a 0033, e
-- `entregaveisDoTemplate()` a expande em "Feed/Story 1"… "Feed/Story 15". O
-- comentário dela diz, em quantas palavras, que *"quantos são se decide na
-- criação, porque muda a cada mês"* — e não era o que o código fazia: o número
-- estava gravado NO MODELO, igual para todo mês. Quem abria a campanha com
-- outra grade apagava e acrescentava linha por linha.
--
-- Pior: **nenhuma tela do produto cria `campaign_templates`** (está escrito na
-- 0108), então aquele `quantidade` só existia no que alguém colou no SQL.
--
-- ---------------------------------------------------------------------------
-- O TIPO É ENUM, E NÃO TEXTO LIVRE
-- ---------------------------------------------------------------------------
--
-- O critério desta casa já está escrito, na 0032: `posts.formato` é texto com
-- `datalist` porque *"esses nomes mudam a cada temporada de produto das
-- plataformas"*, e `posts.midia` é enum porque é ele que decide qual tela
-- aparece. Aqui não é nenhum dos dois: o tipo é uma DIMENSÃO DE RELATÓRIO, e
-- é justamente o que texto livre estraga — "Estático", "estatico" e "Post
-- estático" viram três linhas do mesmo material no resumo da agência.
--
-- São sete valores, e o sétimo é `outro`: a peça que não cabe nos seis
-- continua tendo onde entrar, com o nome dela em `deliverables.nome`. Um
-- oitavo tipo é uma migration de uma linha, que é a forma da 0109.
--
-- ---------------------------------------------------------------------------
-- A COLUNA É OPCIONAL, E "SEM TIPO" É UM BALDE DE VERDADE
-- ---------------------------------------------------------------------------
--
-- Toda peça anterior a esta migration não tem tipo, e a que nascer de uma
-- etapa acrescentada à mão na demanda (o espelho da 0080) também não — lá não
-- há onde escolher. Inventar um valor para elas seria afirmar no relatório um
-- material que ninguém classificou. `not null` com default seria pior ainda:
-- `outro` passaria a querer dizer duas coisas, "é outro" e "ninguém disse".
--
-- ---------------------------------------------------------------------------
-- SÓ A PLANEJADA É GRAVADA. AS OUTRAS QUATRO SÃO DERIVADAS.
-- ---------------------------------------------------------------------------
--
-- É a regra do produto desde que `atraso` não virou coluna no Financeiro:
-- o que dá para calcular não se guarda, senão são duas verdades e a guardada
-- é a que envelhece. Produzida, entregue, aprovada e em ajustes saem do
-- estado de cada peça, e mudam sozinhas quando o trabalho anda.
--
-- **A planejada não sai de lá**, e é por isso que ela é tabela: apagar uma
-- peça não pode reescrever o que foi combinado. Com o plano guardado, "10
-- estáticos planejados, 8 produzidos" continua sendo uma frase verdadeira
-- depois de alguém apagar duas; sem ele, a campanha passaria a dizer que
-- sempre foram oito.
--
-- ---------------------------------------------------------------------------
-- E `abrir_campanha()` NÃO MUDA DE ASSINATURA, de propósito
-- ---------------------------------------------------------------------------
--
-- `create or replace function` não troca a lista de argumentos: ele cria uma
-- SEGUNDA função ao lado, e a chamada antiga passa a ser ambígua — a
-- pegadinha que a 0061 registrou e que já custou um *"Could not find the
-- function"* ao usuário. A saída seria `drop` + `create`, e ela abre uma
-- janela em que o código no ar chama uma assinatura que não existe mais.
--
-- **Esse buraco já cobrou hoje**, com a 0120: o código subiu lendo uma coluna
-- cuja migration não tinha sido colada, e o Portal inteiro respondeu 500. Com
-- `p_estrutura` carregando mais uma chave, não há janela: o `jsonb` antigo
-- continua válido e o novo acrescenta `"tipo"`.
--
-- **E O PLANO SE CONTA DA PRÓPRIA ESTRUTURA**, sem parâmetro novo: a grade que
-- a pessoa escolheu É o conjunto de peças que nasce. Conta-se a FOLHA, que é a
-- regra de toda soma deste módulo — um grupo com dez filhos é uma linha na
-- tela e dez entregas no trabalho.
--
-- ---------------------------------------------------------------------------
-- O ENUM NASCE AQUI, ENTÃO ESTE ARQUIVO NÃO USA NENHUM VALOR DELE
-- ---------------------------------------------------------------------------
--
-- O SQL Editor do Supabase roda a colagem como UMA transação, e o Postgres
-- recusa usar um valor de enum na mesma transação em que ele nasce — a razão
-- escrita na 0028 e na 0109. Usar o TIPO (numa coluna, num parâmetro) é
-- permitido; escrever `'estatico'::deliverable_tipo` não. Por isso não há
-- `check` com literal, não há `update` de conversão, e o `select` de
-- conferência do fim não cita valor nenhum.
--
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 — o tipo do material
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t
                   join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'deliverable_tipo') then
    create type public.deliverable_tipo as enum (
      'estatico', 'carrossel', 'video', 'story', 'banner', 'landing', 'outro'
    );
  end if;
end
$$;

comment on type public.deliverable_tipo is
  'O tipo de material de uma peca de campanha (0122). E a dimensao que o resumo da agencia agrupa -- por isso enum e nao texto livre, que faria "Estatico" e "estatico" virarem duas linhas do mesmo material. `outro` e a peca que nao cabe nos seis; quem a nomeia e `deliverables.nome`.';


-- ---------------------------------------------------------------------------
-- PASSO 2 — a peça diz de que tipo ela é
-- ---------------------------------------------------------------------------
alter table public.deliverables
  add column if not exists tipo public.deliverable_tipo;

comment on column public.deliverables.tipo is
  'De que tipo e esta peca (0122). OPCIONAL de proposito: a peca anterior a esta migration nao tem, e a que nasce de uma etapa acrescentada a mao na demanda tambem nao -- la nao ha onde escolher. "Sem tipo" e um balde de verdade no relatorio; inventar um valor seria afirmar um material que ninguem classificou.';

create index if not exists deliverables_tipo_idx
  on public.deliverables (campaign_id, tipo) where tipo is not null;


-- ---------------------------------------------------------------------------
-- PASSO 3 — o PLANO: quantos de cada tipo foram combinados
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_composicao (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tipo        public.deliverable_tipo not null,
  quantidade  integer not null check (quantidade > 0),
  created_at  timestamptz not null default now(),
  primary key (campaign_id, tipo)
);

comment on table public.campaign_composicao is
  'Quantos materiais de cada tipo a campanha COMBINOU entregar (0122). So a planejada e gravada: produzida, entregue, aprovada e em ajustes sao derivadas do estado de cada peca, pela regra de que o que da para calcular nao se guarda. Esta nao da: apagar uma peca nao pode reescrever o que foi combinado.';

comment on column public.campaign_composicao.quantidade is
  'Sempre maior que zero. Quantidade ZERO nao vira linha: o pedido fala em "aceitar quantidade zero" na TELA, e zero quer dizer que aquele tipo nao entra nesta campanha -- uma linha com zero afirmaria um plano de nenhum material.';

alter table public.campaign_composicao enable row level security;

drop policy if exists campaign_composicao_select on public.campaign_composicao;
create policy campaign_composicao_select on public.campaign_composicao
  for select to authenticated
  using (public.is_staff());

-- QUEM ESCREVE E QUEM ABRE CAMPANHA, a mesma pergunta de `campaigns_insert`
-- desde a 0054: a composicao e o combinado com o cliente, e combinar e do
-- Atendimento. Nao ha policy de DELETE porque nao ha o que apagar sozinho --
-- o `on delete cascade` leva a composicao junto com a campanha.
drop policy if exists campaign_composicao_insert on public.campaign_composicao;
create policy campaign_composicao_insert on public.campaign_composicao
  for insert to authenticated
  with check (public.is_atendimento());

drop policy if exists campaign_composicao_update on public.campaign_composicao;
create policy campaign_composicao_update on public.campaign_composicao
  for update to authenticated
  using (public.is_atendimento())
  with check (public.is_atendimento());


-- ---------------------------------------------------------------------------
-- PASSO 4 — `abrir_campanha()` grava o tipo de cada peça e o plano
--
-- MESMA ASSINATURA, pela razão do cabeçalho. O que muda é o conteúdo de
-- `p_estrutura`, que agora pode trazer `"tipo"` em cada nó.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_campanha(
  p_cliente        uuid,
  p_nome           text,
  p_descricao      text,
  p_data_inicio    date,
  p_data_fim       date,
  p_status         public.campaign_status,
  p_link_entrega   text,
  p_briefing_rico  jsonb,
  p_briefing_texto text,
  p_template       uuid,
  p_estrutura      jsonb
) returns uuid
language plpgsql
as $funcao$
declare
  quem       uuid := (select auth.uid());
  a_task     uuid;
  a_campanha uuid;
  no         jsonb;
  filho      jsonb;
  a_etapa    uuid;
  o_pai      uuid;
  i          integer := 0;
  j          integer;
begin
  insert into public.tasks (
    client_id, titulo, briefing_rico, briefing_texto,
    data_inicio, data_fim, link_entrega, criado_por
  )
  values (
    p_cliente,
    p_nome,
    p_briefing_rico,
    p_briefing_texto,
    p_data_inicio,
    p_data_fim,
    nullif(btrim(coalesce(p_link_entrega, '')), ''),
    quem
  )
  returning id into a_task;

  insert into public.campaigns (
    client_id, nome, descricao, data_inicio, data_fim,
    status, template_id, task_id, criado_por
  )
  values (
    p_cliente, p_nome, nullif(btrim(coalesce(p_descricao, '')), ''),
    p_data_inicio, p_data_fim, coalesce(p_status, 'ativa'), p_template,
    a_task, quem
  )
  returning id into a_campanha;

  for no in select * from jsonb_array_elements(coalesce(p_estrutura, '[]'::jsonb))
  loop
    insert into public.subtasks (task_id, titulo, prazo, responsavel_id, ordem)
    values (
      a_task,
      no->>'nome',
      nullif(no->>'prazo', '')::date,
      nullif(no->>'responsavel', '')::uuid,
      i
    )
    returning id into a_etapa;

    o_pai := a_etapa;

    -- O TIPO VAI NA PECA DEPOIS DO ESPELHO, e nao numa coluna de `subtasks`.
    --
    -- Quem cria a peca e `etapa_espelha_no_entregavel` (0080), num trigger
    -- `after insert` -- entao neste ponto ela ja existe. Poe-se o tipo nela
    -- direto, que e onde ele e verdade: tipo de material e propriedade da
    -- PECA, nao do passo de trabalho. A alternativa seria mais uma coluna na
    -- tabela mais lida do produto, como a 0088 fez com `social_papel`; ali
    -- ela se pagava porque a corrente inteira vive em `subtasks`, e aqui nao
    -- ha nada que leia o tipo do lado da demanda.
    if nullif(no->>'tipo', '') is not null then
      update public.deliverables
         set tipo = (no->>'tipo')::public.deliverable_tipo
       where subtask_id = o_pai;
    end if;

    j := 0;
    for filho in select * from jsonb_array_elements(coalesce(no->'filhos', '[]'::jsonb))
    loop
      insert into public.subtasks (task_id, parent_id, titulo, prazo, responsavel_id, ordem)
      values (
        a_task,
        o_pai,
        filho->>'nome',
        nullif(filho->>'prazo', '')::date,
        nullif(filho->>'responsavel', '')::uuid,
        j
      )
      returning id into a_etapa;

      -- O FILHO HERDA O TIPO DO GRUPO quando nao traz o dele. Dez estaticos
      -- sao um grupo "Estaticos" com dez filhos, e escrever o tipo so no
      -- grupo deixaria as dez FOLHAS sem classificacao -- que e exatamente o
      -- que o relatorio conta.
      if coalesce(nullif(filho->>'tipo', ''), nullif(no->>'tipo', '')) is not null then
        update public.deliverables
           set tipo = coalesce(nullif(filho->>'tipo', ''), nullif(no->>'tipo', ''))::public.deliverable_tipo
         where subtask_id = a_etapa;
      end if;

      j := j + 1;
    end loop;

    i := i + 1;
  end loop;

  -- ------------------------------------------------------------- o plano
  -- CONTA-SE A FOLHA, que e a regra de toda soma deste modulo: um grupo com
  -- dez filhos e uma linha na tela e dez entregas no trabalho. O grupo carrega
  -- o tipo para a arvore saber desenha-lo, e nao entra na conta.
  insert into public.campaign_composicao (campaign_id, tipo, quantidade)
  select a_campanha, d.tipo, count(*)
    from public.deliverables d
   where d.campaign_id = a_campanha
     and d.tipo is not null
     and not exists (
           select 1 from public.deliverables f where f.parent_id = d.id
         )
   group by d.tipo
  on conflict (campaign_id, tipo) do update
     set quantidade = excluded.quantidade;

  return a_campanha;
end
$funcao$;

comment on function public.abrir_campanha(uuid, text, text, date, date, public.campaign_status, text, jsonb, text, uuid, jsonb) is
  'Abre a campanha COM a demanda e as etapas, numa transacao so (0051). Desde a 0080 ela NAO insere entregavel: quem cria a peca e o espelho de `subtasks`. Desde a 0122 cada no de `p_estrutura` pode trazer `"tipo"`, que vai para `deliverables.tipo` depois do espelho, e o PLANO (`campaign_composicao`) e contado das folhas. A assinatura nao mudou de proposito: `create or replace` nao troca a lista de argumentos, ele cria uma segunda funcao ao lado.';


-- ---------------------------------------------------------------------------
-- PASSO 5 — o que a campanha planejou e onde cada tipo está
--
-- UMA PERGUNTA, UMA FUNCAO. A tela e o relatorio leem daqui, e nao de dois
-- `select` parecidos -- que e como a mesma campanha passaria a ter dois
-- numeros de "aprovados" conforme a tela.
-- ---------------------------------------------------------------------------
create or replace function public.composicao_da_campanha(p_campanha uuid)
returns table (
  tipo           public.deliverable_tipo,
  planejada      integer,
  criadas        integer,
  produzidas     integer,
  entregues      integer,
  aprovadas      integer,
  em_ajustes     integer
)
language plpgsql
stable
as $funcao$
begin
  return query
  with folhas as (
    select d.*
      from public.deliverables d
     where d.campaign_id = p_campanha
       and not exists (select 1 from public.deliverables f where f.parent_id = d.id)
  ),
  contagem as (
    select f.tipo,
           count(*)::integer                                        as criadas,
           -- PRODUZIDA E TER VERSAO GRAVADA, e nao um status: a peca pode
           -- estar "em producao" com a arte ja subida esperando o aval
           -- interno, e pode estar "aguardando informacoes" com duas versoes
           -- atras. O que diz que alguem produziu e o arquivo.
           count(*) filter (
             where exists (select 1 from public.deliverable_versions v
                            where v.deliverable_id = f.id)
           )::integer                                               as produzidas,
           -- ENTREGUE E O CARIMBO, pela razao da 0033: e ele que faz a peca
           -- existir para o cliente, e nao o status.
           count(*) filter (where f.enviado_em is not null)::integer as entregues,
           count(*) filter (where f.status = 'aprovado')::integer    as aprovadas,
           count(*) filter (where f.status = 'ajustes')::integer     as em_ajustes
      from folhas f
     group by f.tipo
  )
  select coalesce(c.tipo, p.tipo),
         coalesce(p.quantidade, 0)::integer,
         coalesce(c.criadas, 0),
         coalesce(c.produzidas, 0),
         coalesce(c.entregues, 0),
         coalesce(c.aprovadas, 0),
         coalesce(c.em_ajustes, 0)
    from contagem c
    full outer join public.campaign_composicao p
      on p.campaign_id = p_campanha and p.tipo = c.tipo
   -- O FULL JOIN E O PONTO: o tipo planejado que perdeu todas as pecas
   -- continua aparecendo com zero produzidas -- que e a frase que o relatorio
   -- precisa dizer --, e a peca classificada depois da abertura aparece mesmo
   -- sem plano. Um `left join` de qualquer um dos lados esconderia um dos dois.
   order by 1;
end
$funcao$;

comment on function public.composicao_da_campanha(uuid) is
  'O plano da campanha por tipo de material, e onde cada tipo esta (0122). So `planejada` e gravada; as outras cinco sao contadas das FOLHAS, pela regra de toda soma deste modulo. `full outer join` de proposito: o tipo planejado sem peca e a peca sem plano precisam os dois aparecer.';

revoke all on function public.composicao_da_campanha(uuid) from public;
grant execute on function public.composicao_da_campanha(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 6 — conferência
--
-- NENHUM VALOR DO ENUM E CITADO AQUI, pela razao do cabecalho: ele nasce no
-- PASSO 1, e o Postgres recusa usar um valor de enum na mesma transacao em
-- que ele e criado. O que se confere e a forma.
-- ---------------------------------------------------------------------------
select
  'o tipo do material'                                            as o_que,
  (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'deliverable_tipo')  as o_enum,
  (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'deliverable_tipo')                           as valores,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'deliverables'
      and column_name = 'tipo')                                     as na_peca;

select
  'o plano'                                                       as o_que,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'campaign_composicao')  as a_tabela,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'campaign_composicao')     as policies,
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'campaign_composicao')      as rls_ligada;

select
  'quem le e quem grava'                                          as o_que,
  (select position('deliverable_tipo' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'abrir_campanha')    as abrir_grava_o_tipo,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'abrir_campanha')    as quantas_abrir_campanha,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'composicao_da_campanha') as a_leitura;

notify pgrst, 'reload schema';
