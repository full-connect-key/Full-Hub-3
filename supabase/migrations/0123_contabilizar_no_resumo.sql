-- ---------------------------------------------------------------------------
-- 0123 — "Contabilizar no resumo da agência?"
--
-- Decisão do usuário, item 6: *"na criação de uma recorrência, incluir a
-- opção 'Contabilizar no resumo da agência?' com Sim/Não por item"*, com
-- quatro requisitos: *"permitir alterar depois, preservando o histórico"*,
-- *"não alterar retroativamente os registros já gerados"* e *"impedir
-- duplicidade"*.
--
-- O PORQUÊ DO PEDIDO, em uma frase: nem toda demanda que a rotina das três
-- da manhã cria é produção da agência. O stories de toda segunda é; o
-- lembrete interno que alguém pôs para nascer todo dia 1 não é — e hoje os
-- dois entram na mesma contagem de "criadas" e "concluídas" do Resumo da
-- Agência e das Métricas, inflando o número que a agência usa para decidir.
--
-- ---------------------------------------------------------------------------
-- SÃO DUAS COLUNAS, E A SEGUNDA É QUE RESPONDE "NÃO RETROATIVO"
--
-- `task_recurrences.conta_no_resumo` é a REGRA, e muda quando alguém quiser.
-- `tasks.conta_no_resumo` é o SNAPSHOT: a rotina copia a regra no instante em
-- que a demanda nasce, e dali em diante a demanda carrega a resposta dela.
--
-- Com uma coluna só — na regra — o resumo leria a regra de hoje para contar o
-- trabalho de março, e desligar o interruptor **reescreveria o passado**: o
-- relatório de um mês fechado mudaria de número sozinho. É a decisão de
-- `tasks.workflow_snapshot` (0008) e de `subtasks.social_papel` (0088) pela
-- mesma razão escrita nas duas: editar o modelo não pode mudar o que já está
-- correndo.
--
-- E ela mora em `tasks` e não em `recurrence_runs` porque **o resumo conta
-- DEMANDA e não execução**: a demanda gerada é editada, ganha etapa, muda de
-- cliente — ela é o objeto que o relatório lê, e a execução é só o registro
-- de que ela nasceu.
--
-- ---------------------------------------------------------------------------
-- O DEFAULT É `true`, E O LADO DO ERRO É ESCOLHIDO
--
-- É a decisão de `publicada_em` na 0028, palavra por palavra: esquecer o
-- campo deixa a demanda VISÍVEL no resumo, e o erro contrário — uma demanda
-- que some do número da agência inteira — **ninguém descobre**. Um número
-- baixo e plausível é o modo de falha desta casa.
--
-- E é por isso que toda demanda ganha a coluna, e não só a gerada por
-- recorrência: `true` em todas é exatamente o comportamento de hoje, então a
-- migration não muda número nenhum ao ser aplicada.
--
-- ---------------------------------------------------------------------------
-- "IMPEDIR DUPLICIDADE" JÁ ESTÁ RESPONDIDO, E POR DUAS REGRAS QUE EXISTEM
--
-- É a 0060 de novo — uma segunda pergunta embaixo de uma primeira que já
-- barra todo mundo não barra ninguém —, e vale nomear as duas em vez de
-- inventar uma terceira:
--
--  * a mesma ocorrência não gera duas demandas, e quem garante é o ÍNDICE
--    ÚNICO `recurrence_runs (recurrence_id, chave_ocorrencia)` (0040), com o
--    `insert ... on conflict do nothing returning id` antes de qualquer
--    escrita. Um `select` antes do `insert` passaria nos mesmos cenários e
--    falharia na vida real, com duas abas clicando em "Gerar agora";
--  * e o mesmo trabalho não conta duas vezes no resumo, porque toda soma
--    deste produto conta **só as folhas** (0022) — um mês agrupado com vinte
--    e duas etapas é uma demanda e vinte e duas unidades de trabalho, que é
--    o número certo.
--
-- Uma trava nova aqui seria uma segunda verdade sobre um fato que duas já
-- afirmam.
--
-- ---------------------------------------------------------------------------
-- COLE NO SQL EDITOR DO SUPABASE, do PASSO 1 ao PASSO 5, na ordem.
-- Rodar de novo não faz nada: tudo é `if not exists` ou `create or replace`.
-- ---------------------------------------------------------------------------


-- PASSO 1 — a regra: a recorrência conta no resumo?
-- ---------------------------------------------------------------------------
alter table public.task_recurrences
  add column if not exists conta_no_resumo boolean not null default true;

comment on column public.task_recurrences.conta_no_resumo is
  'As demandas que esta regra gerar entram no Resumo da Agencia e nas Metricas? (0123) E a REGRA, e muda quando alguem quiser -- o que ja nasceu nao muda junto, porque cada demanda carrega a propria resposta em `tasks.conta_no_resumo`.';


-- PASSO 2 — o snapshot: ESTA demanda conta no resumo?
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists conta_no_resumo boolean not null default true;

comment on column public.tasks.conta_no_resumo is
  'Esta demanda entra no Resumo da Agencia e nas Metricas? (0123) Default `true`: esquecer o campo deixa a demanda VISIVEL, e o erro contrario -- uma demanda que some do numero da agencia -- ninguem descobre. Quem a gera por recorrencia copia a regra no instante do nascimento, e nao le a regra depois: desligar o interruptor nao pode reescrever o relatorio de um mes fechado.';

-- O ÍNDICE É PARCIAL, e é a forma certa para uma coluna que quase sempre
-- vale `true`: quem o usa é o `where` que EXCLUI, e ele procura a minoria.
-- Um índice cheio teria o tamanho da tabela para responder "quase todas".
create index if not exists tasks_fora_do_resumo_idx
  on public.tasks (client_id) where conta_no_resumo = false;


-- PASSO 3 — a rotina copia a regra para a demanda
--
-- `create or replace` AQUI É SEGURO e não precisa de `drop`: a assinatura não
-- muda. E o texto NÃO é redigitado: ele é lido do catálogo e recebe a coluna.
-- É a lição da 0030 pelo lado barato — `create or replace` se reescreve a
-- partir do texto de agora e não avisa quando o texto novo tem menos coisa
-- que o velho, e esta função tem cento e quarenta linhas em que um bloco se
-- perde sem ninguém ver.
-- ---------------------------------------------------------------------------
do $passo3$
declare
  corpo text;
begin
  select pg_get_functiondef(p.oid) into corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'gerar_ocorrencia'
   limit 1;

  if corpo is null then
    raise exception 'gerar_ocorrencia() nao existe: aplique a 0040 (e a 0113) antes desta.';
  end if;

  if corpo like '%conta_no_resumo%' then
    raise notice '0123: gerar_ocorrencia() ja copia conta_no_resumo, nada a fazer.';
    return;
  end if;

  -- É UMA INSERÇÃO DE `tasks` e não duas, e eu tinha escrito duas aqui: a
  -- função monta `datas` por modo e INSERE uma vez só, no fim. Fica
  -- registrado porque o erro é o que torna o bloco abaixo obrigatório.
  --
  -- A LISTA DE COLUNAS E A DE VALORES, no par. Trocar uma sem a outra
  -- desloca TODA coluna seguinte, e o Postgres só reclama quando os tipos
  -- não batem — o que aqui NÃO aconteceria, porque a vizinha
  -- (`task_type_id`) aceita nulo e `publicada_em` é a última.
  corpo := replace(
    corpo,
    'criado_por, recurrence_id, task_type_id,',
    'criado_por, recurrence_id, conta_no_resumo, task_type_id,');
  corpo := replace(
    corpo,
    'r.criado_por, r.id, r.task_type_id,',
    'r.criado_por, r.id, r.conta_no_resumo, r.task_type_id,');

  -- E AQUI ELA RECUSA EM VEZ DE NÃO FAZER NADA, que é a única razão pela qual
  -- este bloco pode existir. `replace()` que não acha o texto devolve o texto
  -- inteiro, calado: o `execute` recriaria a função IDÊNTICA, a demanda
  -- gerada nasceria sem o snapshot, e "não retroativo" — que é a frase que
  -- esta migration existe para cumprir — deixaria de valer sem erro em lugar
  -- nenhum. Foi exatamente o que a primeira versão desta migration fazia:
  -- ela procurava um texto que a função deployada não tem.
  if (select count(*) from regexp_matches(corpo, 'conta_no_resumo', 'g')) <> 2 then
    raise exception
      'A 0123 nao conseguiu remendar gerar_ocorrencia(): o texto da funcao mudou.'
      using hint =
        'Abra o corpo com pg_get_functiondef, ache o insert into public.tasks, '
        'e acrescente conta_no_resumo na lista de colunas e r.conta_no_resumo '
        'na de valores, na mesma posicao. Nao aplique o PASSO 4 antes disso.';
  end if;

  execute corpo;
end
$passo3$;


-- PASSO 4 — o indicador da agência deixa de contar o que não conta
--
-- UMA LINHA, e é a única mudança de comportamento desta migration.
-- `producao_do_periodo()` é a fonte dos números do Resumo da Agência e das
-- Métricas desde a 0035 — e ela já filtrava `publicada_em is not null` pela
-- mesma razão: rascunho não é produção da agência.
-- ---------------------------------------------------------------------------
create or replace function public.producao_do_periodo(
  p_de        date,
  p_ate       date,
  p_client_id uuid default null
)
returns table (
  criadas         bigint,
  concluidas      bigint,
  atrasadas       bigint,
  no_prazo        bigint,
  fora_do_prazo   bigint,
  sem_prazo       bigint,
  minutos_reais   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $funcao$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Indicador da agência: apenas gestão.';
  end if;

  return query
  with folhas as (
    select s.*, t.client_id
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where t.publicada_em is not null
       -- A LINHA DA 0123. Ela fica ao lado do filtro de rascunho porque as
       -- duas respondem a mesma pergunta: isto é produção da agência?
       and t.conta_no_resumo
       and not public.subtask_eh_agrupadora(s.id)
       and (p_client_id is null or t.client_id = p_client_id)
  )
  select
    count(*) filter (where f.created_at::date between p_de and p_ate),
    count(*) filter (where f.concluida_em::date between p_de and p_ate),
    -- ATRASADA e "em aberto e passou da data", medido HOJE. Nao e um evento
    -- do periodo: e o estado de agora, como `situacao_do_lancamento()` no
    -- Financeiro. Guardar atraso como coluna criaria a rotina noturna que
    -- mente no dia em que nao roda.
    count(*) filter (where f.status <> 'concluida' and f.prazo < current_date),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is not null and f.concluida_em::date <= f.prazo),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is not null and f.concluida_em::date > f.prazo),
    count(*) filter (where f.concluida_em::date between p_de and p_ate
                       and f.prazo is null),
    coalesce(sum(f.tempo_real_minutos) filter (
      where f.concluida_em::date between p_de and p_ate), 0)::bigint
    from folhas f;
end;
$funcao$;

comment on function public.producao_do_periodo(date, date, uuid) is
  'Os numeros de producao da agencia num periodo (0035). Conta so FOLHAS de demanda PUBLICADA -- e, desde a 0123, so de demanda que `conta_no_resumo`: nem toda demanda que a rotina cria e producao da agencia.';


-- PASSO 5 — conferência
--
-- NENHUM `select` aqui cita o valor `false`, e nenhum conta linha: num banco
-- recem-migrado toda demanda vale `true`, entao uma contagem diria o total
-- da tabela e nao provaria nada.
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'task_recurrences'
      and column_name = 'conta_no_resumo')                                  as regra,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks'
      and column_name = 'conta_no_resumo')                                  as snapshot,
  (select count(*) from pg_indexes where schemaname = 'public'
      and indexname = 'tasks_fora_do_resumo_idx')                           as indice,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gerar_ocorrencia'
      and p.prosrc like '%conta_no_resumo%')                                as rotina_copia,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'producao_do_periodo'
      and p.prosrc like '%t.conta_no_resumo%')                              as indicador_filtra;

notify pgrst, 'reload schema';
