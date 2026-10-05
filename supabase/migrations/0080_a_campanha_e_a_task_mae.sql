-- ---------------------------------------------------------------------------
-- 0080 - A CAMPANHA E A TASK MAE, E AS SUBTAREFAS SAO OS ITENS DELA
--
-- Decisao do usuario:
--
--   "quero que a campanha apareca como uma task. A campanha e a task mae, e
--    as subtarefas sao os itens da campanha."
--
-- ---------------------------------------------------------------------------
-- A FRASE JA ERA VERDADE, E SO NO INSTANTE DA ABERTURA
--
-- `abrir_campanha()` (0051) cria a demanda e, para cada no da arvore, uma
-- etapa e um entregavel apontando para ela. Daquele instante em diante os
-- dois lados ANDAM SEPARADOS, e a separacao e total:
--
--   * nao existe caminho no produto para acrescentar um item a uma campanha
--     aberta. Nenhum. A arvore de uma campanha e congelada no clique de
--     "Criar campanha", e o jeito de acrescentar uma peca e abrir outra
--     campanha;
--   * acrescentar uma ETAPA na demanda da campanha -- que e o caminho que
--     existe, e o que a tela de producao MANDA fazer, com a frase *"Acrescente
--     na demanda - cada etapa vira uma peca aqui"* -- nao criava peca nenhuma.
--     Aquela frase era uma promessa que o produto nao cumpria;
--   * renomear a etapa deixava a peca com o nome antigo para sempre, e trocar
--     o responsavel dela deixava a peca no nome de quem saiu do trabalho.
--
-- Entao a frase do usuario nao e um pedido de modelo novo: e o pedido de a
-- ligacao continuar valendo depois do primeiro dia. **Ha um lugar onde uma
-- peca de campanha nasce, e esse lugar e a ETAPA DA DEMANDA.**
--
-- ---------------------------------------------------------------------------
-- E POR ISSO A `abrir_campanha()` PARA DE INSERIR ENTREGAVEL
--
-- Com o espelho de pe, a funcao inseria a etapa (o espelho criava a peca) e
-- em seguida inseria a peca de novo -- duas pecas por item, no clique de
-- criar. A saida nao e um `if` no espelho para ele se calar durante a
-- abertura: e tirar a segunda escrita. Uma fonte, uma peca.
--
-- Isto e a decisao de `arte_url` ser a capa escrita pelo trigger (0042) e a
-- de `tasks.data_inicio` ser derivada das etapas (0028), aplicada aqui: o que
-- e consequencia nao se escreve duas vezes, senao as duas divergem e a
-- divergencia aparece no lugar mais caro -- aqui, uma campanha com o dobro
-- dos itens que a demanda tem.
--
-- ---------------------------------------------------------------------------
-- O QUE O ESPELHO NAO FAZ, E E DECISAO
--
-- **Ele nao vai no sentido contrario.** Criar um entregavel nao cria etapa:
-- quem cria entregavel hoje e o seed e o espelho, e uma segunda direcao
-- fecharia um laco -- a etapa cria a peca, a peca cria a etapa. Se um dia
-- houver tela de "acrescentar peca" direto na campanha, ela chama a demanda.
--
-- **Ele nao apaga a peca que tem material.** Apagar a etapa apaga a peca
-- vazia -- que e o que a pessoa quis dizer --, e PRESERVA a que tem versao
-- gravada ou carimbo de envio: ali o `on delete set null` de `subtask_id` faz
-- a peca ficar sem etapa, que e o estado em que vivem as campanhas anteriores
-- a 0051 e que o produto ja desenha. Levar junto a arte que o cliente aprovou
-- por causa de um clique numa lista de etapas e perda de material, e a regra
-- da casa e que apagar nao e desfazer.
--
-- **Ele nao copia status nem tempo.** O status da peca e o ciclo dela com o
-- cliente (`content_status`) e o da etapa e o trabalho da pessoa
-- (`subtask_status`): sao enums diferentes porque respondem a perguntas
-- diferentes, e um de-para entre os dois seria o lugar onde as duas verdades
-- comecam a divergir -- a decisao dos tres vocabularios de status. Quem liga
-- os dois onde eles se encontram de verdade ja existe:
-- `etapa_acompanha_o_entregavel` (0052) conclui a etapa quando o cliente
-- aprova, e `entregavel_volta_da_analise` (0079) a devolve quando a gestao
-- pede ajuste.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - DE QUEM E ESTA DEMANDA
--
-- Uma pergunta, um lugar. `campanha_da_task()` e a forma de
-- `subtarefa_de_post()` (0061) e de `subtask_eh_agrupadora()` (0022): o
-- espelho roda em TODA escrita em `subtasks`, e repetir o `select` em quatro
-- ramos seria quatro lugares para o dia em que a coluna mudar de nome.
-- ---------------------------------------------------------------------------
create or replace function public.campanha_da_task(p_task_id uuid)
returns uuid
language plpgsql
stable
as $funcao$
declare
  resposta uuid;
begin
  if p_task_id is null then
    return null;
  end if;
  select c.id into resposta
    from public.campaigns c
   where c.task_id = p_task_id
   limit 1;
  return resposta;
end
$funcao$;

comment on function public.campanha_da_task(uuid) is
  'A campanha desta demanda, ou null (0080). Um lugar so, como `subtarefa_de_post()`: o espelho de `subtasks` roda em toda escrita e nao pode repetir a consulta em cada ramo.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - CADA ETAPA DA DEMANDA DA CAMPANHA E UM ITEM DELA
--
-- `security definer` porque ele escreve `deliverables` em nome de quem mexeu
-- na etapa, e quem distribui trabalho numa demanda pode nao passar por
-- `deliverables_insert` (`is_staff()` desde a 0033 -- hoje passa, e amarrar o
-- espelho a uma policy que pode estreitar e deixar a campanha perder itens em
-- silencio). O recorte e estreito: ele so toca a peca DESTA etapa.
-- ---------------------------------------------------------------------------
create or replace function public.etapa_espelha_no_entregavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
declare
  a_campanha uuid;
  o_pai      uuid;
  tem_peso   boolean;
begin
  -- ---------------------------------------------------------------- apagar
  if tg_op = 'DELETE' then
    -- A PECA COM MATERIAL FICA, e e a unica assimetria deste espelho. Versao
    -- gravada ou carimbo de envio querem dizer que existe arquivo e, muito
    -- provavelmente, decisao do cliente em cima dele. O `on delete set null`
    -- de `subtask_id` deixa a peca sem etapa -- o estado das campanhas
    -- anteriores a 0051, que a tela de producao ja sabe desenhar.
    select exists (
             select 1 from public.deliverable_versions v
              where v.deliverable_id = d.id
           )
           or d.enviado_em is not null
      into tem_peso
      from public.deliverables d
     where d.subtask_id = old.id
     limit 1;

    if not coalesce(tem_peso, true) then
      delete from public.deliverables where subtask_id = old.id;
    end if;

    return old;
  end if;

  a_campanha := public.campanha_da_task(new.task_id);
  if a_campanha is null then
    return new;
  end if;

  -- ----------------------------------------------------------------- o pai
  -- O TERCEIRO NIVEL DA DEMANDA E O SEGUNDO DA CAMPANHA, e os dois batem sem
  -- de-para: `subtasks_agrupadora` (0022) recusa o neto da etapa e
  -- `deliverables_dois_niveis` (0033) recusa o neto da peca. Sao a mesma
  -- regra, escrita duas vezes porque sao duas tabelas -- e por isso o
  -- mapeamento e uma linha e nao uma conversa.
  if new.parent_id is not null then
    select d.id into o_pai
      from public.deliverables d
     where d.subtask_id = new.parent_id
     limit 1;
  end if;

  -- -------------------------------------------------------------- escrever
  if exists (select 1 from public.deliverables d where d.subtask_id = new.id) then
    -- O QUE O ESPELHO ATUALIZA SAO QUATRO COLUNAS, e nenhuma delas e status:
    -- renomear a etapa renomeia a peca, trocar o dono troca o dono, mudar o
    -- prazo muda o prazo, reordenar reordena. Sem isso a peca ficava com o
    -- nome de fabrica para sempre, que e o bug que o titulo da subtarefa de
    -- post ja teve (0061).
    update public.deliverables
       set nome           = new.titulo,
           prazo          = new.prazo,
           responsavel_id = new.responsavel_id,
           ordem          = new.ordem,
           parent_id      = o_pai
     where subtask_id = new.id;
  else
    insert into public.deliverables (
      campaign_id, parent_id, nome, ordem, prazo, responsavel_id, subtask_id
    )
    values (
      a_campanha, o_pai, new.titulo, new.ordem, new.prazo, new.responsavel_id, new.id
    );
  end if;

  return new;
end
$funcao$;

-- ---------------------------------------------------------------------------
-- SAO DOIS TRIGGERS NA MESMA FUNCAO, E A DIFERENCA E O MOMENTO
--
-- `after` para nascer e mudar, porque `deliverables.subtask_id` aponta para
-- `subtasks.id`: num `before insert` a etapa ainda nao existe e a peca
-- estouraria na chave estrangeira.
--
-- `before` para apagar, e foi a BATERIA que mostrou -- o cenario "a peca vazia
-- foi com ela" achou 1 onde esperava 0. `subtask_id` e `on delete set null`, e
-- a acao da chave estrangeira roda como trigger AFTER tambem: num `after
-- delete` a coluna ja pode estar nula, e o `where d.subtask_id = old.id` nao
-- acha a peca que acabou de ser desligada. A peca ficava orfa em vez de sair,
-- sem erro nenhum -- o modo de falha desta casa, onde o resultado e plausivel.
-- No `before` a ligacao ainda esta de pe.
-- ---------------------------------------------------------------------------
drop trigger if exists subtasks_espelha_no_entregavel on public.subtasks;
create trigger subtasks_espelha_no_entregavel
  after insert or update of titulo, prazo, responsavel_id, parent_id, ordem
  on public.subtasks
  for each row execute function public.etapa_espelha_no_entregavel();

drop trigger if exists subtasks_espelha_ao_apagar on public.subtasks;
create trigger subtasks_espelha_ao_apagar
  before delete on public.subtasks
  for each row execute function public.etapa_espelha_no_entregavel();

comment on function public.etapa_espelha_no_entregavel is
  'Cada etapa da demanda de uma campanha E um item dela (0080): nome, prazo, responsavel, ordem e o nivel. Nao copia status (enums diferentes, perguntas diferentes), nao vai no sentido contrario (fecharia laco) e nao apaga peca com versao gravada ou carimbo de envio.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - `abrir_campanha()` DEIXA A PECA PARA O ESPELHO
--
-- A unica diferenca em relacao a 0051 sao os dois `insert into deliverables`,
-- que sairam: a etapa nasce e o espelho cria a peca. O resto do corpo e o
-- mesmo, inclusive o `select s.parent_id into a_etapa` que devolve o pai no
-- fim de cada filho -- ele era o primeiro bug desta funcao, e continua sendo
-- a linha que impede uma arvore de quatro niveis.
--
-- A ORDEM AGORA IMPORTA MAIS: a campanha precisa existir ANTES da primeira
-- etapa, senao `campanha_da_task()` devolve null e a etapa nasce sem peca.
-- Ela ja era criada antes do laco na 0051, por outra razao (a demanda carrega
-- as travas mais duras e e melhor falhar antes de haver campanha) -- e agora
-- as duas razoes apontam para a mesma ordem.
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
  quem      uuid := (select auth.uid());
  a_task    uuid;
  a_campanha uuid;
  no        jsonb;
  filho     jsonb;
  a_etapa   uuid;
  i         integer := 0;
  j         integer;
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

    j := 0;
    for filho in select * from jsonb_array_elements(coalesce(no->'filhos', '[]'::jsonb))
    loop
      insert into public.subtasks (task_id, parent_id, titulo, prazo, responsavel_id, ordem)
      values (
        a_task,
        a_etapa,
        filho->>'nome',
        nullif(filho->>'prazo', '')::date,
        nullif(filho->>'responsavel', '')::uuid,
        j
      )
      returning id into a_etapa;

      -- `a_etapa` foi reaproveitada pela sub-etapa acima; devolve o pai para o
      -- proximo filho apontar para ele, e nao para o irmao anterior.
      select s.parent_id into a_etapa from public.subtasks s where s.id = a_etapa;

      j := j + 1;
    end loop;

    i := i + 1;
  end loop;

  return a_campanha;
end
$funcao$;

comment on function public.abrir_campanha(uuid, text, text, date, date, public.campaign_status, text, jsonb, text, uuid, jsonb) is
  'Abre a campanha COM a demanda e as etapas, numa transacao so (0051). Desde a 0080 ela NAO insere entregavel: quem cria a peca e o espelho de `subtasks`, para a peca ter uma fonte so. Nao e security definer: `campaigns_insert` e `tasks_insert` continuam decidindo quem pode.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - AS CAMPANHAS QUE JA ESTAO ABERTAS
--
-- Uma campanha aberta antes desta migration tem etapas sem peca sempre que
-- alguem acrescentou uma na demanda -- e ninguem sabe que elas existem,
-- porque a tela da campanha mostra as pecas e nao as etapas. Esta passada
-- fecha a diferenca, e so para campanha que tem demanda: as anteriores a
-- 0051 continuam com `task_id` nulo e a resposta para elas e o
-- `scripts/campanhas-sem-demanda.sql`, que pede a pasta de entrega a quem
-- sabe qual e.
--
-- Os PAIS primeiro e os FILHOS depois, em dois comandos: o filho precisa do
-- `parent_id` da peca do pai, e num comando so a ordem das linhas nao e
-- garantida -- metade dos filhos sairia sem pai, no nivel de topo.
-- ---------------------------------------------------------------------------
insert into public.deliverables (campaign_id, nome, ordem, prazo, responsavel_id, subtask_id)
select c.id, s.titulo, s.ordem, s.prazo, s.responsavel_id, s.id
  from public.subtasks s
  join public.campaigns c on c.task_id = s.task_id
 where s.parent_id is null
   and not exists (select 1 from public.deliverables d where d.subtask_id = s.id);

insert into public.deliverables (campaign_id, parent_id, nome, ordem, prazo, responsavel_id, subtask_id)
select c.id, pai.id, s.titulo, s.ordem, s.prazo, s.responsavel_id, s.id
  from public.subtasks s
  join public.campaigns c on c.task_id = s.task_id
  join public.deliverables pai on pai.subtask_id = s.parent_id
 where s.parent_id is not null
   and not exists (select 1 from public.deliverables d where d.subtask_id = s.id);

notify pgrst, 'reload schema';
