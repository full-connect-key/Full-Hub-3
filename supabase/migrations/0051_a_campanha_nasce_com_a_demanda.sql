-- ---------------------------------------------------------------------------
-- 0051 - A CAMPANHA NASCE COM A DEMANDA, E SE FINALIZA SOZINHA
--
-- Duas decisoes do usuario, na mesma migration porque sao as duas pontas do
-- mesmo fio -- uma liga a campanha ao trabalho, a outra desliga quando ele
-- acaba:
--
--   "a criacao de uma campanha, automaticamente deve criar uma task, ja que
--    cada material da campanha e basicamente uma subtarefa de uma tarefa mae
--    (A task em si). Por isso na hora de criar, ja devo poder preencher os
--    responsaveis, colocar briefing da campanha, alem de prazos."
--
--   "ao finalizar uma campanha, ela deve automaticamente ir para a aba de
--    finalizadas. Uma campanha so e finalizada quando todas as suas etapas
--    sao entregues e finalizadas."
--
-- ---------------------------------------------------------------------------
-- O QUE JA EXISTIA, E NINGUEM PREENCHIA
--
-- `deliverables.subtask_id` e `deliverables.responsavel_id` nasceram na 0033.
-- O comentario da coluna dizia "a etapa que produziu o entregavel; opcional,
-- como no post". A ponte estava desenhada e nenhum caminho do produto a
-- atravessava: a tela de abertura nao pedia responsavel, e task nenhuma era
-- criada. Esta migration nao inventa a ligacao -- ela liga.
--
-- Por isso a coluna nova e UMA SO: `campaigns.task_id`. Daria para chegar a
-- demanda pelo caminho longo (`deliverable -> subtask -> task`), e a campanha
-- aberta sem nenhum entregavel ficaria sem nenhum -- justamente o caso em que
-- alguem abre a campanha primeiro e monta a lista depois.
--
-- ---------------------------------------------------------------------------
-- E TUDO NUMA FUNCAO SO, PORQUE E UMA TRANSACAO SO
--
-- Sao cinco escritas encadeadas: a demanda, a campanha, uma etapa por
-- entregavel, o entregavel apontando para a etapa, e as sub-etapas. Pelo
-- PostgREST seriam cinco transacoes, e a terceira falhando deixaria uma
-- campanha ligada a uma demanda com metade das etapas -- sem nada na tela
-- dizendo o que faltou. E a mesma razao de `decidir_solicitacao()` e de
-- `lancar_periodo()` viverem no banco.
--
-- **NAO E `security definer`.** Ela existe para gravar tudo de uma vez, nao
-- para furar a RLS: quem nao pode abrir campanha (`campaigns_insert` exige
-- `is_staff()`) e quem nao pode abrir demanda (`tasks_insert` exige
-- `is_atendimento()`) continua nao podendo, e a bateria tem cenario provando.
--
-- ---------------------------------------------------------------------------
-- A DEMANDA NASCE PUBLICADA, E NAO COMO RASCUNHO
--
-- A tela de task abre um rascunho no clique (0028) porque a pessoa vai
-- digitar o titulo ali dentro. Aqui ela ja preencheu tudo antes de clicar em
-- "Criar campanha" -- e um rascunho e de quem o criou e de mais ninguem, o
-- que esconderia da equipe inteira as etapas que ela acabou de distribuir.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.campaigns
  add column if not exists task_id uuid references public.tasks (id) on delete set null;

comment on column public.campaigns.task_id is
  'A demanda da campanha (0051). Cada entregavel e uma etapa dela, por `deliverables.subtask_id`. `on delete set null`: apagar a demanda nao apaga a campanha -- ela tem material aprovado pelo cliente.';

create index if not exists campaigns_task_idx on public.campaigns (task_id);


-- ---------------------------------------------------------------------------
-- PASSO 1 - ABRIR A CAMPANHA COM A DEMANDA JUNTO
--
-- A ARVORE CHEGA COMO `jsonb`, e e a arvore que a pessoa deixou na tela --
-- nunca o id do modelo. Quem expande o template e a tela, no instante em que
-- ele e escolhido, e dai em diante o Atendimento acrescenta, remove e
-- datilografa prazos. Reexpandir aqui desfaria cada ajuste no clique de
-- salvar: a pessoa veria uma arvore e gravaria outra.
--
-- A forma: [{nome, prazo, responsavel, filhos:[{nome, prazo, responsavel}]}]
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
  a_peca    uuid;
  i         integer := 0;
  j         integer;
begin
  -- A DEMANDA PRIMEIRO. Ela e quem as etapas apontam, e e ela que carrega as
  -- travas mais duras: `tasks_publicar_exige_minimo` cobra titulo, cliente e
  -- pasta de entrega, e `tasks_exige_pasta_de_entrega` recusa demanda nova
  -- sem pasta. Criando-a antes da campanha, uma recusa dessas para tudo antes
  -- de existir campanha alguma -- em vez de deixar uma campanha orfa.
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
    -- A ETAPA VEM ANTES DO ENTREGAVEL, porque e o entregavel que aponta para
    -- ela. A ordem inversa exigiria um update logo em seguida, e um update a
    -- mais e mais uma coisa que pode ficar pela metade.
    insert into public.subtasks (task_id, titulo, prazo, responsavel_id, ordem)
    values (
      a_task,
      no->>'nome',
      nullif(no->>'prazo', '')::date,
      nullif(no->>'responsavel', '')::uuid,
      i
    )
    returning id into a_etapa;

    insert into public.deliverables (
      campaign_id, nome, ordem, prazo, responsavel_id, subtask_id
    )
    values (
      a_campanha,
      no->>'nome',
      i,
      nullif(no->>'prazo', '')::date,
      nullif(no->>'responsavel', '')::uuid,
      a_etapa
    )
    returning id into a_peca;

    j := 0;
    for filho in select * from jsonb_array_elements(coalesce(no->'filhos', '[]'::jsonb))
    loop
      -- A SUB-ETAPA FAZ DA ETAPA UMA AGRUPADORA, e e a regra da casa desde a
      -- 0022: o relogio da mae para de correr, o status dela passa a ser
      -- calculado pelas filhas, e a soma da demanda conta so as folhas. E
      -- exatamente o que o grupo de entregaveis ja era do lado da campanha --
      -- `status_do_entregavel()` faz a mesma conta. Os dois lados chegaram na
      -- mesma regra por caminhos diferentes, e agora sao a mesma linha.
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

      insert into public.deliverables (
        campaign_id, parent_id, nome, ordem, prazo, responsavel_id, subtask_id
      )
      values (
        a_campanha,
        a_peca,
        filho->>'nome',
        j,
        nullif(filho->>'prazo', '')::date,
        nullif(filho->>'responsavel', '')::uuid,
        a_etapa
      );

      -- `a_etapa` foi reaproveitada pela sub-etapa acima; devolve o pai para o
      -- proximo filho apontar para ele, e nao para o irmao anterior. Foi o
      -- primeiro bug desta funcao, e ele nao estoura: gera uma arvore de
      -- quatro niveis que o trigger `subtasks_agrupadora` recusa tres linhas
      -- adiante, falando de outra coisa.
      select s.parent_id into a_etapa from public.subtasks s where s.id = a_etapa;

      j := j + 1;
    end loop;

    i := i + 1;
  end loop;

  return a_campanha;
end
$funcao$;

comment on function public.abrir_campanha(uuid, text, text, date, date, public.campaign_status, text, jsonb, text, uuid, jsonb) is
  'Abre a campanha COM a demanda e as etapas, numa transacao so (0051). Nao e security definer: `campaigns_insert` e `tasks_insert` continuam decidindo quem pode.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A CAMPANHA SE FINALIZA SOZINHA, E SE REABRE SOZINHA
--
-- "Uma campanha so e finalizada quando todas as suas etapas sao entregues e
-- finalizadas" -- e a frase vale nos DOIS sentidos. Uma campanha com peca em
-- producao nao esta finalizada, e e por isso que o trigger tambem devolve
-- para `ativa`: acrescentar um entregavel a uma campanha finalizada a reabre,
-- em vez de deixa-la na aba errada dizendo que acabou.
--
-- **SO AS FOLHAS CONTAM**, como em toda conta deste modulo. Um grupo com
-- quinze sub-itens e uma linha na tela e quinze entregas no trabalho; contar
-- o grupo tambem faria a campanha esperar por um status que e derivado dos
-- filhos que ela ja contou.
--
-- **`planejamento` e `cancelada` NAO SAO TOCADOS.** Planejamento diz que a
-- campanha ainda nao comecou -- promove-la a finalizada porque ela nao tem
-- entregavel aprovado nenhum seria afirmar que acabou o que nem comecou. E
-- cancelada e decisao de gente.
--
-- **E campanha SEM entregavel nunca finaliza.** `count(*) = 0` com
-- `count(*) filter (where aprovado) = 0` sao iguais, e sem esta linha toda
-- campanha recem-aberta nasceria finalizada -- indo direto para a aba que o
-- cliente so abre para ver o que ja acabou.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_status_campanha(p_campanha uuid)
returns void
language plpgsql
as $funcao$
declare
  folhas    integer;
  aprovadas integer;
  atual     public.campaign_status;
begin
  if p_campanha is null then
    return;
  end if;

  select c.status into atual from public.campaigns c where c.id = p_campanha;
  if atual is null or atual in ('planejamento', 'cancelada') then
    return;
  end if;

  select
    count(*) filter (
      where not exists (
        select 1 from public.deliverables f where f.parent_id = d.id
      )
    ),
    count(*) filter (
      where d.status = 'aprovado'
        and not exists (
          select 1 from public.deliverables f where f.parent_id = d.id
        )
    )
    into folhas, aprovadas
  from public.deliverables d
  where d.campaign_id = p_campanha;

  if folhas > 0 and folhas = aprovadas then
    if atual <> 'finalizada' then
      update public.campaigns set status = 'finalizada' where id = p_campanha;
    end if;
  elsif atual = 'finalizada' then
    update public.campaigns set status = 'ativa' where id = p_campanha;
  end if;
end
$funcao$;

create or replace function public.campanha_acompanha_entregaveis()
returns trigger
language plpgsql
as $funcao$
begin
  -- O DELETE TAMBEM RECALCULA, e nao e detalhe: apagar a unica peca que
  -- faltava e o caminho mais comum de uma campanha chegar ao fim sem ninguem
  -- aprovar nada. Sem este ramo ela ficaria em `ativa` para sempre, com a
  -- barra dizendo "12 de 12".
  if tg_op = 'DELETE' then
    perform public.recalcular_status_campanha(old.campaign_id);
    return old;
  end if;

  perform public.recalcular_status_campanha(new.campaign_id);
  if tg_op = 'UPDATE' and new.campaign_id is distinct from old.campaign_id then
    perform public.recalcular_status_campanha(old.campaign_id);
  end if;
  return new;
end
$funcao$;

drop trigger if exists deliverables_move_a_campanha on public.deliverables;
create trigger deliverables_move_a_campanha
  after insert or delete or update of status, parent_id, campaign_id
  on public.deliverables
  for each row execute function public.campanha_acompanha_entregaveis();

notify pgrst, 'reload schema';
