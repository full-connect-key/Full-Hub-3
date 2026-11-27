-- ===========================================================================
-- 0153 - A DEMANDA VIRA CAMPANHA, E O CLIENTE VE CADA ETAPA ANDAR
-- ===========================================================================
--
-- Decisao do usuario, em uma frase:
--
--   "hoje so o acesso do cliente consegue criar uma campanha que fica
--   vinculada no portal do cliente, mas eu quero poder criar esse mesmo tipo
--   de job na hora de abrir uma task, entao na hora da abertura da task eu
--   seleciono que aquilo e uma campanha, e ainda posso usar o workflow que ja
--   criei, e quando estivermos com essas demandas em andamento ela aparece na
--   aba de campanha do cliente com todas as etapas com seu devido status,
--   ESSE e o objetivo da pagina de Campanha pro cliente, acompanhar a
--   evolucao de cada etapa, inclusive com versionamento, prazo, visualizacao
--   etc, e isso tem que estar vinculado com a gestao de task interna"
--
-- ---------------------------------------------------------------------------
-- A PREMISSA DELE NAO E LITERALMENTE VERDADE, E IR MEDIR E O QUE FEZ ESTA
-- MIGRATION SER PEQUENA.
-- ---------------------------------------------------------------------------
--
-- A agencia JA abre campanha, em /painel/aprovacoes/campanhas/nova, e JA
-- escolhe um workflow ali desde a 0108. O que nao existe e o caminho
-- CONTRARIO -- marcar uma demanda que ja esta sendo aberta como campanha --,
-- e e esse o pedido.
--
-- Por que ele soa verdadeiro: a entrada "Campanhas" e `hiddenFromMenu` desde
-- o Sprint 3J, e a porta dela eram os chips de area de Minhas Tasks, que
-- sairam no sprint da porta das areas. Hoje a porta e a pilula de uma LINHA de
-- campanha -- ou seja, ela so existe para quem JA tem peca de campanha. Quem
-- nunca abriu uma nao tem como achar "Nova campanha". Isso e tela, nao banco,
-- e sai no mesmo commit.
--
-- ---------------------------------------------------------------------------
-- O QUE JA ESTAVA PRONTO, e e a maior parte do pedido
-- ---------------------------------------------------------------------------
--
--   o workflow na campanha        | 0108
--   o versionamento de cada peca  | `deliverable_versions`, 0033 e 0053
--   prazo, visualizacao, decisao  | a arvore do portal, desde o Sprint 13
--   a evolucao de cada etapa      | `linhaDoEntregavel()`: quem aprovou e
--                                 | quando, ha quantos dias espera, o motivo
--                                 | da recusa, o prazo previsto
--   o vinculo com a gestao        | `campanha_da_task()` + "Ver campanha"
--   a etapa virando peca          | `etapa_espelha_no_entregavel()`, 0080
--
-- Entao esta migration faz DUAS coisas, e nenhuma delas e um conceito novo:
-- liga a campanha a uma demanda que JA existe (PASSOS 1 a 3) e deixa o cliente
-- ver a etapa que ainda nao foi enviada (PASSO 4).
--
-- ---------------------------------------------------------------------------
-- O PASSO 4 E O GAP DE VERDADE
-- ---------------------------------------------------------------------------
--
-- "com todas as etapas com seu devido status" e, hoje, RECUSADO pelo banco:
-- `deliverables_select_cliente` exige `enviado_em is not null` -- a 0033
-- chama aquela linha de "A LINHA QUE SEGURA O SPRINT". Quer dizer que uma
-- etapa em producao nao existe para o cliente, e o que ele ve e a frase
-- "Os materiais desta campanha ainda estao em producao." com a arvore vazia
-- embaixo. A campanha, essa ele ve desde o planejamento
-- (`campaigns_select_cliente` nao tem aquela condicao) -- entao a tela promete
-- acompanhamento e nao tem o que mostrar.
--
-- Afrouxar a policy entregaria a ARTE e o ARQUIVO de tudo o que esta em
-- producao. A saida e a da 0111: uma funcao `security definer` que devolve o
-- AGREGADO e nada mais, com as condicoes da policy do cliente reescritas a
-- mao. Nome, status, prazo e ordem -- nunca `arte_url`, `thumbnail_url`,
-- `arquivo_nome`, `versao_atual`, `descricao` nem `responsavel_id`: nem
-- arquivo, nem arte, nem contagem de versao, nem a descricao interna, nem quem
-- dentro da agencia esta com aquilo na mao.
--
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - A INTENCAO, e por que ela e um booleano e mais nada
-- ---------------------------------------------------------------------------
--
-- Nao ha dado a mais para pedir: o nome da campanha E o titulo da demanda (e
-- `campaigns_espelha_na_demanda`, da 0078, ja mantem os dois juntos no sentido
-- contrario), e o periodo sai das datas da demanda. Uma tabela de "pedido de
-- campanha" guardaria o que ja esta na linha ao lado.
--
-- `not null default false` e o lado certo do erro, como `publicada_em` na
-- 0028: esquecer o campo deixa a demanda como ela sempre foi, e o erro
-- contrario -- uma campanha nascendo no portal do cliente sem ninguem ter
-- pedido -- e o que ninguem descobre.

alter table public.tasks
  add column if not exists campanha_pedida boolean not null default false;

comment on column public.tasks.campanha_pedida is
  'Decisao do usuario (0153): a demanda foi marcada como campanha na abertura. '
  'E a INTENCAO, nao o fato: quem responde "esta demanda e uma campanha?" e '
  'campanha_da_task(). Desmarcar depois de a campanha existir nao a apaga -- '
  'o campo vira um link, nao um interruptor.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A CAMPANHA NASCE DA DEMANDA
-- ---------------------------------------------------------------------------
--
-- E FUNCAO E NAO UM INSERT NA TELA, e a razao e a da 0051:
-- `campaigns.task_id` fica fora de `Insert` e de `Update` em
-- database.types.ts de proposito -- "ligar a mao daria campanha apontando para
-- demanda de outro cliente".
--
-- E ELA E IDEMPOTENTE, e isso nao e zelo: `campaigns.task_id` tem INDICE e
-- nao `unique` (0051, linha 63), entao nada no banco impede duas campanhas na
-- mesma demanda. Chamada duas vezes, ela devolve a que existe.
--
-- `security definer` POR UMA RAZAO MEDIDA, e nao por conveniencia:
-- `campaigns_insert` e `is_atendimento()` (0054) e `tasks_update` e
-- `pode_editar_task()` -- que inclui o RESPONSAVEL da demanda. Numa funcao
-- `invoker`, o responsavel publicando uma demanda que o Atendimento marcou
-- levaria a recusa de `campaigns_insert`: a pessoa clica em "Criar task" e le
-- uma mensagem sobre campanhas. E a decisao ja foi tomada pela acao que marcou
-- o campo, que passa por `pode_editar_task()`; criar no instante da publicacao
-- e CONSEQUENCIA. E a forma de `etapa_espelha_no_entregavel()` (0080), que e
-- definer pelo mesmo motivo.
--
-- Por isso o `execute` dela e revogado no fim: a unica porta e o gatilho.

create or replace function public.criar_campanha_da_task(p_task uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  a_task     public.tasks;
  a_campanha uuid;
  v_inicio   date;
  v_fim      date;
begin
  if p_task is null then
    return null;
  end if;

  select * into a_task from public.tasks t where t.id = p_task;

  if not found then
    return null;
  end if;

  -- JA EXISTE: devolve a que existe, sem criar a segunda.
  a_campanha := public.campanha_da_task(p_task);
  if a_campanha is not null then
    return a_campanha;
  end if;

  -- RASCUNHO NAO VIRA CAMPANHA, e a razao e a 0028: "rascunho nao entra em
  -- lista, board, calendario, Minhas Tasks, contador, relatorio, notificacao
  -- nem portal". A campanha aparece no portal desde o planejamento, entao
  -- cria-la a partir de um rascunho poria no portal do cliente uma demanda que
  -- nem a equipe enxerga.
  --
  -- O GATILHO NUNCA CAI AQUI: ele so chama esta funcao com a demanda
  -- publicada, e e ele que trata a marca feita num rascunho -- ela fica
  -- guardada e a campanha nasce na publicacao. Esta recusa e para quem chamar
  -- a funcao por fora.
  if a_task.publicada_em is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Um rascunho não vira campanha.',
      hint    = 'Publique a demanda primeiro: a campanha aparece no portal do cliente desde o planejamento, e um rascunho não existe para ninguém além de quem o criou.';
  end if;

  if a_task.client_id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Uma campanha precisa de empresa.',
      hint    = 'Escolha o cliente da demanda: é a empresa dela que decide quem vê a campanha no portal.';
  end if;

  -- AS DATAS SAO DERIVADAS, e o `greatest` existe por causa de uma trava:
  -- `campaigns_periodo` (0033) cobra `data_fim >= data_inicio`, e as duas
  -- colunas da demanda sao opcionais e DERIVADAS das etapas (0028) -- uma
  -- demanda sem etapa nenhuma tem as duas nulas. O periodo se edita depois, na
  -- tela da campanha, que e `is_atendimento()` desde a 0078.
  v_inicio := coalesce(a_task.data_inicio, a_task.data_fim, current_date);
  v_fim    := greatest(v_inicio, coalesce(a_task.data_fim, a_task.data_inicio, current_date));

  -- O BRIEFING NAO VIRA `descricao`, e a ausencia e a decisao da 0125: o
  -- briefing nao viaja para `CampanhaDoPortal` -- "por as sete ali mandaria o
  -- objetivo, o publico e as restricoes no payload de quem contratou". A
  -- `descricao` da campanha e desenhada no portal, embaixo do titulo.
  insert into public.campaigns (
    client_id, task_id, nome, data_inicio, data_fim, status, criado_por
  ) values (
    a_task.client_id,
    p_task,
    coalesce(nullif(btrim(a_task.titulo), ''), 'Campanha sem nome'),
    v_inicio,
    v_fim,
    'planejamento',
    auth.uid()
  )
  returning id into a_campanha;

  -- ------------------------------------------------------------------------
  -- AS ETAPAS QUE JA EXISTEM VIRAM PECAS, e e por isso que esta parte existe.
  --
  -- `etapa_espelha_no_entregavel()` (0080) e `after insert or update` em
  -- `subtasks`: ela so enxerga ESCRITA. Numa demanda que ja tem as etapas do
  -- workflow materializadas -- que e o caso inteiro deste pedido, porque o
  -- workflow e aplicado na abertura --, nenhuma escrita acontece depois da
  -- campanha nascer, e a campanha ficaria VAZIA. Sem erro em lugar nenhum.
  --
  -- SAO DOIS COMANDOS e nao um, que e a licao do PASSO 4 da propria 0080:
  -- num comando so a ordem das linhas nao e garantida, e metade das filhas
  -- cairia no nivel de topo. O `not exists` e o que torna a passada
  -- re-executavel.
  --
  -- E AS AGRUPADORAS ENTRAM, de proposito: a mae vira o GRUPO do lado da
  -- campanha, e o status dela e calculado pelos filhos (`statusDoGrupo`), que
  -- e a forma que a arvore do portal desenha desde a 0033.
  -- ------------------------------------------------------------------------
  insert into public.deliverables (
    campaign_id, nome, ordem, prazo, responsavel_id, subtask_id
  )
  select a_campanha, s.titulo, s.ordem, s.prazo, s.responsavel_id, s.id
    from public.subtasks s
   where s.task_id = p_task
     and s.parent_id is null
     and not exists (
       select 1 from public.deliverables d where d.subtask_id = s.id
     );

  insert into public.deliverables (
    campaign_id, parent_id, nome, ordem, prazo, responsavel_id, subtask_id
  )
  select a_campanha, o_pai.id, s.titulo, s.ordem, s.prazo, s.responsavel_id, s.id
    from public.subtasks s
    join public.deliverables o_pai on o_pai.subtask_id = s.parent_id
   where s.task_id = p_task
     and s.parent_id is not null
     and not exists (
       select 1 from public.deliverables d where d.subtask_id = s.id
     );

  return a_campanha;
end;
$func$;

comment on function public.criar_campanha_da_task(uuid) is
  'Cria a campanha de uma demanda ja publicada e materializa as etapas que ja '
  'existem como pecas (0153). Idempotente: devolve a campanha que existe. '
  'definer porque campaigns_insert e is_atendimento() e tasks_update aceita o '
  'responsavel -- a decisao foi tomada ao marcar o campo, e criar na '
  'publicacao e consequencia. A unica porta e o gatilho tasks_vira_campanha.';

revoke all on function public.criar_campanha_da_task(uuid) from public;
revoke all on function public.criar_campanha_da_task(uuid) from anon;
revoke all on function public.criar_campanha_da_task(uuid) from authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 3 - O GATILHO E A PORTA UNICA
-- ---------------------------------------------------------------------------
--
-- Ele escuta as DUAS colunas, e a segunda e o que faz a marca num rascunho
-- valer: marcar antes de publicar guarda a intencao, e a campanha nasce no
-- instante em que a demanda passa a existir para a equipe. Sem ela, quem
-- marcasse no rascunho ficaria sem campanha nenhuma e sem nada dizendo por
-- que.
--
-- E a acao da tela escreve SO o booleano. E a decisao da 0045 e da 0098: a
-- demanda e escrita por mais de um caminho -- a tela de detalhe, o
-- `publicarTask`, um PATCH no PostgREST --, e uma criacao escrita na camada de
-- aplicacao registra o que passou pela tela e perde o resto.

create or replace function public.task_vira_campanha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
begin
  if new.campanha_pedida
     and new.publicada_em is not null
     and ( not coalesce(old.campanha_pedida, false)
           or old.publicada_em is null )
  then
    perform public.criar_campanha_da_task(new.id);
  end if;

  return new;
end;
$func$;

drop trigger if exists tasks_vira_campanha on public.tasks;

create trigger tasks_vira_campanha
after update of campanha_pedida, publicada_em on public.tasks
for each row
execute function public.task_vira_campanha();

comment on function public.task_vira_campanha() is
  'A campanha nasce quando a marca e feita numa demanda publicada, ou quando '
  'uma demanda marcada e publicada (0153). Os dois ramos: o segundo e o que '
  'faz marcar no rascunho valer.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O CLIENTE VE A ETAPA QUE AINDA NAO FOI ENVIADA
-- ---------------------------------------------------------------------------
--
-- A forma e a de `pecas_programadas()` (0111): `security definer` devolvendo
-- o AGREGADO, com a pergunta da policy do cliente reescrita a mao -- o definer
-- nao a faz sozinho.
--
-- O QUE ELA NAO DEVOLVE E A METADE QUE IMPORTA: nem `arte_url`, nem
-- `thumbnail_url`, nem `arquivo_nome`, nem `versao_atual`, nem `descricao`,
-- nem `responsavel_id`. Nenhum arquivo, nenhuma arte, nenhuma contagem de
-- versao, nenhuma descricao interna, e nunca quem dentro da agencia esta com
-- aquilo na mao. O material continua preso ao envio, que e a linha que a 0033
-- chama de "A LINHA QUE SEGURA O SPRINT".
--
-- `status` nao abre vocabulario novo: o mesmo `content_status` ja chega ao
-- portal pelo selo de cada peca enviada, e a traducao e de tela.
--
-- `enviado` e o que a tela usa para decidir se a linha e um LINK: o detalhe de
-- uma peca nao enviada nao abre para o cliente, e um link que leva a 404 e
-- pior que uma linha sem link.
--
-- E ELA DEVOLVE NADA, nunca um erro, quando a campanha nao e dele: a tela ja
-- responde 404 por `obterCampanha()`, e um erro aqui derrubaria a pagina em
-- vez de nao mostrar a campanha.

create or replace function public.etapas_da_campanha_para_o_cliente(p_campanha uuid)
returns table (
  id        uuid,
  parent_id uuid,
  nome      text,
  status    public.content_status,
  prazo     date,
  ordem     integer,
  enviado   boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $func$
begin
  if p_campanha is null then
    return;
  end if;

  -- A MESMA PERGUNTA QUE `campaigns_select_cliente` FAZ NA TABELA DELA. Sem
  -- estas duas condicoes, a funcao devolve as etapas da campanha de qualquer
  -- empresa para quem tiver o uuid -- e o furo passa despercebido num banco
  -- com um cliente so, que e a licao da `calendar_events`.
  if not exists (
    select 1
      from public.campaigns c
     where c.id = p_campanha
       and ( public.is_staff()
             or c.client_id in (select public.my_client_ids()) )
  ) then
    return;
  end if;

  return query
    select d.id,
           d.parent_id,
           d.nome,
           d.status,
           d.prazo,
           d.ordem,
           d.enviado_em is not null
      from public.deliverables d
     where d.campaign_id = p_campanha
     order by d.ordem;
end;
$func$;

comment on function public.etapas_da_campanha_para_o_cliente(uuid) is
  'O esqueleto de TODA etapa de uma campanha -- nome, status, prazo, ordem e '
  'se foi enviada (0153). deliverables_select_cliente exige enviado_em, entao '
  'a etapa em producao e invisivel para o cliente; esta funcao devolve o '
  'agregado e nunca o material: nem arte, nem arquivo, nem versao, nem quem '
  'da agencia esta com ela. A forma de pecas_programadas() (0111).';

revoke all on function public.etapas_da_campanha_para_o_cliente(uuid) from public;
revoke all on function public.etapas_da_campanha_para_o_cliente(uuid) from anon;
grant execute on function public.etapas_da_campanha_para_o_cliente(uuid) to authenticated;


notify pgrst, 'reload schema';


-- ===========================================================================
-- CONFERENCIA, para a segunda colagem
-- ===========================================================================
--
-- select
--   (select count(*) from information_schema.columns
--     where table_schema = 'public' and table_name = 'tasks'
--       and column_name = 'campanha_pedida')                        as col_1,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('criar_campanha_da_task', 'task_vira_campanha',
--                         'etapas_da_campanha_para_o_cliente'))      as funcoes_3,
--   (select count(*) from pg_trigger
--     where tgname = 'tasks_vira_campanha' and not tgisinternal)     as gatilho_1,
--   -- A porta unica: as duas primeiras tem de ser `f`, a terceira `t`.
--   has_function_privilege('authenticated',
--     'public.criar_campanha_da_task(uuid)', 'execute')              as cria_auth_f,
--   has_function_privilege('anon',
--     'public.etapas_da_campanha_para_o_cliente(uuid)', 'execute')   as etapas_anon_f,
--   has_function_privilege('authenticated',
--     'public.etapas_da_campanha_para_o_cliente(uuid)', 'execute')   as etapas_auth_t;
