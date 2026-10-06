-- ===========================================================================
-- 0090 - O ENVIO E DO MES, O AVAL INTERNO E OPCIONAL, E O PORTAO DO MEIO
--        PASSA A FUNCIONAR
--
-- Sprint 3K, decisao do usuario. O recorte e a frase dele: *"tanto campanhas,
-- quando Social Media, faca sentido"* -- e esta migration e a metade do
-- Social. Campanhas fica fora, de proposito.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTAVA QUEBRADO, E SAO DOIS BUGS E NAO UM
--
-- A 0076 pos o cliente aprovando a corrente etapa por etapa. A feature nunca
-- funcionou ponta a ponta, e os dois furos foram medidos contra o Postgres
-- antes desta migration:
--
--   1. O POST ENVIADO NUM PORTAO DO MEIO NAO APARECIA PARA O CLIENTE. Desde a
--      0044 o mes abre sem data em nenhum post, e a trava "post sem data nao
--      vai ao cliente" vale so no portao de entrega -- de proposito, porque a
--      Pauta e a PRIMEIRA etapa e exigir data ali seria uma recusa que a
--      corrente nao tem como satisfazer. So que `postsDoMes` filtrava por
--      `data_publicacao` dentro do mes. A RLS liberava e a consulta escondia:
--      o post saia do calendario, da lista e da grade do feed, e aparecia so
--      na tela inicial do portal, cuja consulta nao filtra por data. Um item
--      em "esperando voce" na home e a area de Social vazia.
--
--   2. E DEPOIS DE UM PEDIDO DE AJUSTES, O PORTAO DO MEIO NAO PODIA SER
--      REENVIADO. `approval_rounds_conteudo_rodada_key` e unico em
--      `(content_type, content_id, numero_rodada, escopo)`, e a rodada de
--      cliente de um post era numerada por `posts.versao_atual`. A Pauta nao
--      tem versao -- `post_versions` e arte e legenda --, entao reenviar
--      tentava gravar a mesma `(post, 1, cliente)` e levava
--      *"duplicate key value violates unique constraint"*. Nao havia caminho
--      nenhum: a peca voltava e nao tinha como sair de novo.
--
-- O primeiro e consulta de tela e esta fora desta migration. O SEGUNDO E
-- DAQUI, e e ele que explica por que o PASSO 4 existe.
--
-- ---------------------------------------------------------------------------
-- O QUE MUDA: A UNIDADE DE ENVIO
--
-- Ate aqui a gestao clicava "Enviar ao cliente" por POST. A partir daqui
-- clica "Enviar o mes ao cliente", uma vez, e o cliente recebe todas as pecas
-- daquele portao de uma vez -- decidindo peca por peca, como antes.
--
-- O post continua individual para comentar e decidir. O que deixa de ser
-- individual e o ENVIO, porque o mes e um conjunto e o cliente precisa ver o
-- conjunto para avaliar cada peca. E a mesma decisao da 0088 um passo
-- adiante: lá a producao virou mensal, aqui a entrega.
--
-- ---------------------------------------------------------------------------
-- TRES DIVERGENCIAS DO TEXTO DO SPRINT, e as tres tem motivo mecanico
--
-- 1. O LOTE APONTA PARA A ETAPA DO MES, NAO PARA O ELO DO FLUXO.
--
--    O sprint escreve `step_id uuid not null references social_flow_steps(id)`.
--    Isso quebra a edicao de fluxo: `salvar_fluxo_de_social()` APAGA e
--    reinsere os elos a cada edicao (0087), e uma chave estrangeira sem
--    `on delete` e `restrict` -- o `delete` passaria a falhar em todo fluxo
--    que já tivesse um mes enviado, e a aba Fluxos pararia de salvar sem
--    ninguem ligar uma coisa a outra.
--
--    A identidade estavel do portao e a SUBTAREFA do mes, que e o snapshot e
--    nunca e recriada -- e e ela que `portoes_do_mes()` devolve desde a 0088.
--    Entao e `etapa_id -> subtasks(id)`, e a chave unica e
--    `(task_id, etapa_id, numero_rodada)`.
--
-- 2. `approval_rounds.numero_rodada` DA RODADA DE CLIENTE PASSA A SER A
--    SEQUENCIA DAQUELE POST, e nao "a maior rodada daquele (task, step) + 1".
--
--    A formula do sprint colide com o indice unico de duas maneiras: por
--    portao ela reinicia em 1 (a rodada 1 do Layout bateria com a rodada 1 da
--    Pauta no mesmo post), e por mes ela nao distingue a peca.
--
--    A sequencia do proprio post nao colide nunca, e e exatamente a conta que
--    o produto ja faz: `aprovacoes_do_cliente_no_post()` conta as aprovadas e
--    o portao e a (k+1)-esima. O numero do sprint vai para o LOTE -- que e
--    "qual rodada deste portao" --, que e o que a chave unica dele diz.
--
--    O QUE ISSO CUSTA, e e o unico lugar em que esta migration desfaz uma
--    regra escrita: *"o numero da rodada e a versao da peca"*. Ela continua
--    valendo para a rodada INTERNA, que e onde ela e sobre arte; e a garantia
--    que ela dava -- subir a v2 depois do aval da v1 deixa a v2 sem aval --
--    passa a ser perguntada direto, no PASSO 5, em vez de depender de os dois
--    numeros coincidirem por acaso. A garantia fica; o acaso sai.
--
-- 3. `activity_log` NAO EXISTE neste produto, e os cabecalhos da 0035, 0037 e
--    0040 ja registram isso. O que existe e `task_history` (em que pe esteve
--    cada etapa) e `audit_log` (0058, so do socio). O registro do envio e a
--    PROPRIA LINHA do lote: quem enviou, quando, com que recado, e quantas
--    pecas. Uma segunda copia disso seria a segunda verdade que o lote existe
--    para nao ter.
--
-- ---------------------------------------------------------------------------
-- A REGRA QUE NAO SE QUEBRA: O LOTE NAO GUARDA DECISAO
--
-- Ele AGRUPA as `approval_rounds` que ja existem. Quantos decididos, quantos
-- aprovados, quantos com ajustes -- tudo derivado das rodadas. E a decisao de
-- "atraso nao e coluna", de "bloqueio nao e status" e de `maoDoPost()`: duas
-- fontes de verdade para o mesmo fato e o que produziu a confusao que este
-- sprint existe para desfazer.
--
-- As duas unicas colunas de estado do lote sao carimbos, e nenhuma das duas
-- e decisao: `enviado_em` (quando saiu) e `fechado_em` (quando a ultima peca
-- recebeu resposta). A segunda e escrita por gatilho a partir das rodadas.
--
-- ---------------------------------------------------------------------------
-- MEDIDO COM SEIS MUTACOES
--
--   * devolver a numeracao antiga da rodada de cliente ....... 10 cenarios
--   * tirar o mes andando junto .............................. 5
--   * tirar as tres guardas de `is_staff()` .................. 2
--   * fazer o aval interno voltar a ser obrigatorio .......... 8
--   * fazer a policy do lote passar pela RLS de `tasks` ...... 1
--   * desligar a fase do Calendario Full ..................... 3
--
-- A PENULTIMA DERRUBA UM, e e a que precisa de explicacao: ela e a diferenca
-- entre "a policy pergunta por uma funcao `definer`" e "a policy pergunta
-- direto na tabela" -- e um cenario so separa as duas, porque o furo e o
-- cliente nao ver NADA, que e indistinguivel de nao haver lote.
--
-- E A DA FASE DERRUBOU ZERO na primeira rodada. Os tres cenarios dela nao
-- mediam nada: os meses deste arquivo nascem sem prazo nenhum, entao a view
-- devolvia zero, a subconsulta de controle tambem, e `0 = 0` passava --
-- com um `teste.cenario(..., 'ok')` sem contagem aceitando zero linhas ao
-- lado. Foi a mutacao que mostrou, e e exatamente para isso que ela existe.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O LOTE
--
-- Uma linha por (mes, portao, rodada daquele portao). Ela nao guarda decisao
-- nenhuma: o que ela carrega e quem enviou, quando, e o recado que foi junto.
-- ---------------------------------------------------------------------------
create table if not exists public.social_lotes (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id)    on delete cascade,
  etapa_id      uuid not null references public.subtasks(id) on delete cascade,
  numero_rodada integer not null,
  enviado_por   uuid references public.profiles(id),
  enviado_em    timestamptz not null default now(),
  fechado_em    timestamptz,
  recado        text,
  created_at    timestamptz not null default now(),
  constraint social_lotes_rodada_positiva check (numero_rodada > 0),
  constraint social_lotes_unico unique (task_id, etapa_id, numero_rodada)
);

comment on table public.social_lotes is
  'Um envio do mes de social ao cliente (0090): o conjunto de pecas que saiu num portao, numa rodada. NAO guarda decisao -- ela mora nas `approval_rounds` que apontam para ele.';
comment on column public.social_lotes.etapa_id is
  'A etapa do MES que e o portao (subtasks). Nao e `social_flow_steps`: aqueles elos sao apagados e reinseridos a cada edicao do fluxo (0087), e uma chave estrangeira para eles travaria a aba Fluxos.';
comment on column public.social_lotes.numero_rodada is
  'Qual rodada deste portao: 1 na primeira vez, 2 quando as pecas que voltaram sao reenviadas. Nao e o `numero_rodada` das rodadas de aprovacao -- aquele e a sequencia de cada post.';
comment on column public.social_lotes.fechado_em is
  'Quando a ultima peca do lote recebeu resposta. Escrito por gatilho a partir das rodadas, nunca a mao -- e carimbo, nao decisao.';
comment on column public.social_lotes.recado is
  'A mensagem da agencia que viajou com o envio. O cliente le; e a unica coisa do lote que ele le.';

create index if not exists social_lotes_mes_idx    on public.social_lotes (task_id, etapa_id);
create index if not exists social_lotes_abertos_idx on public.social_lotes (task_id) where fechado_em is null;

alter table public.social_lotes enable row level security;

drop policy if exists social_lotes_select         on public.social_lotes;
drop policy if exists social_lotes_select_cliente on public.social_lotes;
drop policy if exists social_lotes_insert         on public.social_lotes;
drop policy if exists social_lotes_update         on public.social_lotes;

create policy social_lotes_select on public.social_lotes
  for select to authenticated using (public.is_staff());

-- O CLIENTE LE O LOTE DA EMPRESA DELE, e e o que faz o cabecalho do portal
-- existir: "18 pecas · 12 decididas · 6 pendentes", mais o recado. As duas
-- contagens sao derivadas das rodadas, que ele ja enxerga desde a 0032; o que
-- so vem daqui e o recado e a existencia do lote.
--
-- E ELA PASSA POR UMA FUNCAO `security definer`, e NAO por um `exists` em
-- `tasks`. Foi a bateria que me obrigou: a primeira versao perguntava
-- `exists (select 1 from tasks t where t.id = ... and t.client_id in
-- my_client_ids())`, e aquele `select` roda sob a RLS DO CLIENTE --
-- `tasks_select_cliente` exige uma rodada de escopo cliente numa subtarefa da
-- demanda, e a demanda do MES nao tem nenhuma (as rodadas sao dos posts).
-- Resultado: o `exists` dava falso, o cliente nao lia lote nenhum, e o
-- cabecalho do portal nascia vazio.
--
-- O modo de falha e o de sempre nesta casa: lista vazia e indistinguivel da
-- verdade. Um lote que nao aparece se le como "a agencia nao mandou nada".
create or replace function public.lote_e_do_meu_cliente(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and t.client_id in (select public.my_client_ids())
  );
$$;

comment on function public.lote_e_do_meu_cliente(uuid) is
  'Se a demanda do mes de social e de uma empresa de quem esta logado (0090). `security definer` porque a policy do lote nao pode passar pela RLS de `tasks`: o cliente nao enxerga a demanda do mes, e so as rodadas dos posts dela.';

create policy social_lotes_select_cliente on public.social_lotes
  for select to authenticated
  using (public.lote_e_do_meu_cliente(task_id));

-- QUEM ENVIA E `is_gestor() or is_atendimento()`, e e decisao do usuario,
-- escrita duas vezes no sprint. Ate aqui era `is_gestor()` e mais nada (0060).
--
-- A regra que a 0060 garantia continua de pe, e muda de lugar: ela dizia que
-- `is_gestor()` barra todo colaborador, e por isso a segunda pergunta ("quem
-- produziu nao envia") nao tinha a quem recusar. Com a porta aberta ao
-- Atendimento ela PASSA a ter: o colaborador do Atendimento que produziu uma
-- peca do lote. A pergunta volta no PASSO 7, com trabalho de verdade para
-- fazer -- o inverso exato do que a 0060 desfez.
create policy social_lotes_insert on public.social_lotes
  for insert to authenticated
  with check (public.is_gestor() or public.is_atendimento());

-- O `update` existe para o recado ser corrigido antes de o cliente abrir, e
-- para mais nada: `fechado_em` e escrito pelo gatilho, que e `security
-- definer` e nao passa por aqui. NAO HA POLICY DE DELETE -- um envio nao se
-- desfaz, e a decisao e a de `approval_rounds`: rodada fechada nunca e
-- reescrita nem apagada.
create policy social_lotes_update on public.social_lotes
  for update to authenticated
  using (public.is_gestor() or public.is_atendimento())
  with check (public.is_gestor() or public.is_atendimento());


-- ---------------------------------------------------------------------------
-- PASSO 2 - A RODADA SABE DE QUE LOTE ELA E
--
-- `on delete set null` e nao `cascade`, pela razao de `recurrence_id` na
-- 0040: as rodadas sao decisao de verdade, com quem decidiu, quando e com que
-- comentario. Apagar o lote nao pode apagar a decisao que saiu nele.
-- ---------------------------------------------------------------------------
alter table public.approval_rounds
  add column if not exists lote_id uuid references public.social_lotes(id) on delete set null;

comment on column public.approval_rounds.lote_id is
  'O envio em lote que criou esta rodada (0090). Nulo em toda rodada que nao veio de um mes de social -- etapa de demanda, peca de campanha, e os posts anteriores a esta migration.';

create index if not exists approval_rounds_lote_idx on public.approval_rounds (lote_id) where lote_id is not null;


-- ---------------------------------------------------------------------------
-- PASSO 3 - AS DUAS MARCACOES DO ELO, E A OPCAO DO FLUXO
--
-- `aprovacao_interna` nasce `true` para nao mudar o comportamento de nenhuma
-- conta sem alguem ter decidido -- que e a decisao do default `publicada` da
-- 0028: esquecer o campo mantem o que ja acontecia, e o erro contrario nao
-- aparece em tela nenhuma.
--
-- ELA E INDEPENDENTE DE `aprovacao_cliente`, e as duas juntas sao quatro
-- combinacoes legitimas: o elo que passa pelos dois, o que passa so pelo aval
-- interno (o normal), o que vai direto ao cliente sem revisao, e o que nao
-- passa por ninguem. Nenhum `check` as amarra, de proposito.
-- ---------------------------------------------------------------------------
alter table public.social_flow_steps
  add column if not exists aprovacao_interna boolean not null default true;

comment on column public.social_flow_steps.aprovacao_interna is
  'Se este elo passa pelo aval interno antes de ir ao cliente (0090). Default true: as contas que existem continuam exigindo, e quem quiser pular decide elo por elo.';

-- E A ETAPA DO MES GUARDA A COPIA, pela razao de `social_papel` na 0088: o
-- fluxo e editavel, e perguntar a ele direto faria a trava de um mes que esta
-- correndo mudar porque alguem desligou o aval na configuracao da conta. A
-- etapa do mes E o snapshot desde a 0088, e esta coluna entra ao lado das
-- outras tres.
alter table public.subtasks
  add column if not exists social_aval_interno boolean;

comment on column public.subtasks.social_aval_interno is
  'Copia de `social_flow_steps.aprovacao_interna` no instante em que o mes foi aberto (0090). Nula em toda subtarefa que nao e etapa de mes de social, e os chamadores fazem `coalesce(..., true)` -- post avulso continua exigindo o aval, que e a forma anterior a 0045.';

-- O PARALELISMO E DO FLUXO, e nao do elo. A pergunta e "nesta conta o mes
-- anda junto?", que e uma politica de como a agencia trabalha aquela conta --
-- e por elo ela daria um mes que espera na Pauta e nao espera no Layout, que
-- e um comportamento que ninguem consegue descrever em voz alta.
alter table public.social_flows
  add column if not exists avanca_em_paralelo boolean not null default false;

comment on column public.social_flows.avanca_em_paralelo is
  'Se as pecas aprovadas num portao avancam sem esperar as demais (0090). Default false: o mes anda junto, que e o que a frase do usuario descreve -- a peca e individual, mas faz parte de um conjunto.';

-- E O MES GUARDA A COPIA, pela razao de `social_papel` na 0088: o fluxo e
-- editavel, e ler a coluna dele direto faria a trava de um mes que esta
-- correndo mudar porque alguem mexeu na configuracao da conta. O snapshot e o
-- que impede isso.
alter table public.tasks
  add column if not exists social_paralelo boolean not null default false;

comment on column public.tasks.social_paralelo is
  'Copia de `social_flows.avanca_em_paralelo` no instante em que o mes foi aberto (0090). Snapshot e nao chave, pela razao de `subtasks.social_papel`: editar o fluxo nao pode mudar a trava de um mes em producao.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A NUMERACAO DA RODADA DE CLIENTE
--
-- O BUG 2 DO CABECALHO MORRE AQUI. A rodada de cliente de um post passa a ser
-- numerada pela sequencia DELE: a enesima vez que esta peca foi ao cliente,
-- qualquer que seja o portao. Monotonica, nunca colide com o indice unico, e
-- e exatamente a conta que `aprovacoes_do_cliente_no_post()` ja fazia para
-- achar o portao aberto.
--
-- A rodada INTERNA continua em `posts.versao_atual`, que e onde aquele numero
-- significa alguma coisa: ele e a versao da ARTE, e e ele que faz subir a v2
-- depois do aval da v1 deixar a v2 sem aval.
-- ---------------------------------------------------------------------------
create or replace function public.proxima_rodada_do_cliente(p_post_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(r.numero_rodada), 0)::integer + 1
    from public.approval_rounds r
   where r.content_type = 'post'
     and r.content_id = p_post_id
     and r.escopo = 'cliente';
$$;

comment on function public.proxima_rodada_do_cliente(uuid) is
  'O numero da proxima rodada de cliente deste post (0090): a sequencia dele proprio. Era `posts.versao_atual`, e um portao do meio reenviado colidia com o indice unico -- a Pauta nao tem versao para incrementar.';

-- ---------------------------------------------------------------------------
-- E A PERGUNTA DO AVAL INTERNO PASSA A SER DIRETA
--
-- Ela era "existe rodada interna aprovada com o MESMO numero desta", e isso
-- so funcionava enquanto os dois numeros eram a mesma coisa. O que ela quer
-- dizer e outra frase, e agora ela e perguntada assim: a versao que esta no
-- ar tem aval?
-- ---------------------------------------------------------------------------
create or replace function public.post_tem_aval_interno(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.approval_rounds r
      join public.posts p on p.id = r.content_id
     where r.content_type = 'post'
       and r.content_id = p_post_id
       and r.escopo = 'interna'
       and r.status = 'aprovada'
       and r.numero_rodada >= p.versao_atual
  );
$$;

comment on function public.post_tem_aval_interno(uuid) is
  'Se a versao corrente deste post tem aval interno aprovado (0090). `>= versao_atual` e a mesma linha que `analiseDosEntregaveis()` usa nas campanhas: subir uma versao nova deixa a nova SEM aval, que e o que tem de acontecer.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - `validar_nova_rodada` REESCRITA A PARTIR DA VERSAO DA 0088
--
-- Dois ramos mudam, e so o do post:
--
--   * o aval interno passa a ser perguntado por `post_tem_aval_interno()` e
--     SO QUANDO O ELO EXIGE (`social_flow_steps.aprovacao_interna`, copiada
--     para a etapa do mes no PASSO 6);
--   * quem envia ao cliente passa a ser `is_gestor() or is_atendimento()`,
--     com a pergunta de "quem produziu nao envia" voltando para quem nao e
--     gestao.
--
-- O ramo da etapa de demanda e o do entregavel ficam LETRA POR LETRA como
-- estavam. Reescrever uma funcao a partir da metade dela e o erro que a 0030
-- cometeu com os carimbos e que a 0052 consertou quatro migrations depois.
-- ---------------------------------------------------------------------------
create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  post  uuid := public.post_da_rodada(new.content_type, new.content_id);
  entr  uuid := public.entregavel_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
  porta public.subtasks;
begin
  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Os tipos com regra hoje são subtask, post e deliverable.';
  end if;

  -- ------------------------------------------------------------- entregavel
  if entr is not null then
    if not exists (select 1 from public.deliverables d where d.id = entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Entregável não encontrado.';
    end if;

    if public.entregavel_eh_grupo(entr) then
      raise exception using
        errcode = 'check_violation',
        message = 'Este entregável agrupa outros: quem vai para aprovação são os itens de dentro.',
        hint    = 'O status do grupo é calculado pelos sub-itens.';
    end if;

    dono := (select d.responsavel_id from public.deliverables d where d.id = entr);

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o entregável envia para aprovação.';
      end if;
    else
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o material nunca o envia ao cliente.';
      end if;

      if not exists (
        select 1 from public.approval_rounds r
         where r.content_type = new.content_type
           and r.content_id = new.content_id
           and r.numero_rodada = new.numero_rodada
           and r.escopo = 'interna'
           and r.status = 'aprovada'
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.';
      end if;
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------------- post
  if post is not null then
    dono := public.dono_do_post(post);

    if not exists (select 1 from public.posts p where p.id = post) then
      raise exception using
        errcode = 'check_violation',
        message = 'Post não encontrado.';
    end if;

    if new.escopo = 'interna' then
      if new.solicitado_por is distinct from dono and not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Só quem produziu o post envia para aprovação.';
      end if;
    else
      -- QUEM ENVIA AO CLIENTE (0090): gestao, ou o Atendimento -- que e quem
      -- abre o mes desde a 0046 e quem fala com a conta. Era `is_gestor()` e
      -- mais nada desde a 0060.
      if not (public.is_gestor() or public.is_atendimento()) then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar ao cliente é da gestão ou do Atendimento.',
          hint    = 'Quem produz o post nunca o envia ao cliente.';
      end if;

      -- E A SEGUNDA PERGUNTA VOLTA A TER A QUEM RECUSAR. A 0060 tirou "quem
      -- produziu nao envia" porque `is_gestor()` acima ja barrava todo
      -- colaborador -- ela nao alcancava ninguem. Com o Atendimento passando,
      -- ela alcanca exatamente uma pessoa: o colaborador do Atendimento que
      -- produziu esta peca. A regra que o usuario pediu na 0060 -- nenhum
      -- colaborador envia o que produziu -- continua inteira.
      if not public.is_gestor()
         and dono is not null
         and dono = (select auth.uid()) then
        raise exception using
          errcode = 'check_violation',
          message = 'Ninguém envia ao cliente a própria entrega.',
          hint    = 'Quem produziu esta peça foi você: peça à gestão para enviar.';
      end if;

      porta := public.porta_do_cliente_no_post(post);

      -- POST SEM DATA NAO VAI AO CLIENTE (0044), e SO NO PORTAO DE ENTREGA
      -- (0076). Num portao do meio quem sai e a pauta ou a legenda, e a data
      -- ainda nao existe -- exigi-la ali seria uma recusa que a corrente nao
      -- tem como satisfazer, e o portao ficaria fechado para sempre.
      --
      -- A frase aqui fala de UM post, porque o gatilho e por linha. Quem
      -- NOMEIA as pecas que faltam e `o_que_falta_no_portao()` no PASSO 6,
      -- chamada por `enviar_mes_ao_cliente()` antes de inserir qualquer
      -- rodada: a recusa que a pessoa le diz quais sao as seis, e esta aqui e
      -- o piso para quem montar o insert a mao.
      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.data_publicacao is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post ainda não tem data de publicação.',
          hint    = 'Escolha o dia antes de enviar: o cliente decide sobre o material e sobre quando ele vai ao ar.';
      end if;

      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o link.',
          hint    = 'Cole o endereço do Drive ou do YouTube antes de enviar.';
      end if;

      -- O AVAL INTERNO E DO ELO (0090), e a pergunta deixou de comparar
      -- numeros. `porta.social_aval_interno` e nulo em post avulso -- que e a
      -- forma anterior a 0045 --, e ali o `coalesce` mantem o comportamento
      -- de sempre: exige.
      if coalesce(porta.social_aval_interno, true)
         and not public.post_tem_aval_interno(post) then
        raise exception using
          errcode = 'check_violation',
          message = 'Esta rodada ainda não passou pela aprovação interna.',
          hint    = 'Peça o aval interno desta versão, ou desligue o aval do elo no fluxo da conta.';
      end if;
    end if;

    return new;
  end if;

  -- ---------------------------------------------------------------- subtask
  dono  := (select s.responsavel_id   from public.subtasks s where s.id = alvo);
  exige := (select s.requer_aprovacao from public.subtasks s where s.id = alvo);

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    if not exists (
      select 1 from public.approval_rounds r
       where r.content_type = new.content_type
         and r.content_id = new.content_id
         and r.numero_rodada = new.numero_rodada
         and r.escopo = 'interna'
         and r.status = 'aprovada'
    ) then
      raise exception using
        errcode = 'check_violation',
        message = 'Esta rodada ainda não passou pela aprovação interna.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validar_nova_rodada() is
  'As travas de quem abre rodada. Desde a 0090 o aval interno do post e do ELO (`social_aval_interno`) e perguntado por versao, e enviar ao cliente e da gestao ou do Atendimento -- com a pergunta de "quem produziu nao envia" voltando a ter a quem recusar.';


-- ---------------------------------------------------------------------------
-- PASSO 6 - O FLUXO PASSA A CARREGAR A MARCACAO, E O MES A COPIA
--
-- `etapas_do_fluxo()` ganha a sexta coluna. O `drop` e OBRIGATORIO e nao e
-- zelo: `create or replace function` nao consegue trocar o tipo de retorno de
-- uma funcao que existe -- e a 0089 pagou exatamente isto uma migration atras.
-- ---------------------------------------------------------------------------
drop function if exists public.etapas_do_fluxo(uuid);

create or replace function public.etapas_do_fluxo(p_flow_id uuid)
returns table (
  ordem              integer,
  nome               text,
  funcao             public.team_funcao,
  papel              public.social_flow_papel,
  aprovacao_cliente  boolean,
  aprovacao_interna  boolean,
  campo              text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- `security definer` PELA MESMA RAZAO DE `porta_do_cliente_no_post` (0076):
  -- ela e chamada de dentro de `posts_corrente_do_cliente`, que roda com o
  -- `auth.uid()` DO CLIENTE -- e o cliente nao tem policy em
  -- `social_flow_steps`. Sem o definer, o cliente aprovando um post levaria
  -- uma lista vazia e a corrente nao andaria.
  return query
    select s.ordem, s.nome, s.funcao, s.papel,
           s.aprovacao_cliente, s.aprovacao_interna, s.campo
      from public.social_flow_steps s
     where s.flow_id = p_flow_id
     order by s.ordem;
end;
$$;

comment on function public.etapas_do_fluxo(uuid) is
  'Os elos de um fluxo de social, em ordem. `aprovacao_interna` entrou na 0090: ela e independente de `aprovacao_cliente`, e as quatro combinacoes sao legitimas.';


-- ---------------------------------------------------------------------------
-- `salvar_fluxo_de_social` GRAVA A MARCACAO NOVA
--
-- O corpo e o da 0089 com UMA edicao, e ela esta marcada no lugar: o `insert`
-- passa a gravar `aprovacao_interna`, com default `true` quando a chamada nao
-- fala dela. A assinatura NAO muda -- `p_etapas` continua `jsonb`, e trocar a
-- lista de parametros criaria uma SEGUNDA funcao no PostgREST (a pegadinha da
-- 0061, que ja custou um *"Could not find the function"* ao usuario).
--
-- As quatro travas que ela carrega -- nome vazio, nome repetido, a forma
-- antiga da 0089, e a entrega que falta com a frase que nomeia o elo --
-- continuam letra por letra como estavam.
-- ---------------------------------------------------------------------------
create or replace function public.salvar_fluxo_de_social(
  p_nome      text,
  p_etapas    jsonb,
  p_flow_id   uuid default null,
  p_descricao text default null,
  p_ativo     boolean default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  alvo     uuid := p_flow_id;
  etapa    jsonb;
  nomes    text[] := '{}';
  nome_et  text;
  entregas integer := 0;
  portao   text;
begin
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de um nome.',
      hint    = 'O nome é o que a lista mostra na hora de abrir o mês — "Padrão da casa", "Fluxo da Mundo Verde".';
  end if;

  if p_etapas is null or jsonb_typeof(p_etapas) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As etapas do fluxo vêm como uma lista, na ordem da corrente.',
      hint    = 'Cada etapa é {"nome": "Pauta", "funcao": "Social Media", "papel": "producao"}.';
  end if;

  -- FLUXO SEM ETAPA E RECUSADO AQUI, e nao pela trava do PASSO 2 da 0087 --
  -- ela deixa o fluxo vazio passar de proposito, porque esse e o estado entre
  -- o `delete` e o `insert` desta propria funcao.
  if jsonb_array_length(p_etapas) = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Um fluxo sem etapa nenhuma não abre mês nenhum.',
      hint    = 'Monte a corrente: o trabalho que acontece antes de enviar, a entrega ao cliente, e o que vem depois da decisão dele.';
  end if;

  -- OS NOMES SAO CONFERIDOS ANTES DE GRAVAR, pela razao dos periodos em
  -- `abrir_mes_de_social`: a recusa do indice unico diria
  -- "social_flow_steps_flow_id_nome_key", que nao e portugues e nao diz qual
  -- nome repetiu. E o nome repetido nao e detalhe: `p_prazos` e um mapa POR
  -- NOME desde a 0059, e duas etapas homonimas receberiam o mesmo periodo.
  --
  -- O MESMO LACO RECUSA A FORMA DA 0087, e e aqui que ele pertence: `p_etapas`
  -- e `jsonb`, entao uma chave a mais entra CALADA -- quem mandar
  -- `comeca_dias_antes` gravaria o fluxo sem erro nenhum e descobriria no mes
  -- seguinte que as datas que ele acha que combinou nao estao em lugar nenhum.
  -- E a decisao do objeto de quantidades (0082) e da data solta (0084): a
  -- recusa diz qual e a forma nova, em vez de um erro sobre sintaxe.
  for etapa in select * from jsonb_array_elements(p_etapas)
  loop
    if etapa ? 'comeca_dias_antes' or etapa ? 'termina_dias_antes' then
      raise exception using
        errcode = 'check_violation',
        message = 'O fluxo não guarda mais os dias de cada etapa.',
        hint    = 'Ele é a sequência de ações; as datas são do mês, e quem abre o mês as escolhe — o diálogo já sugere as duas pontas de cada etapa a partir da ordem dela na corrente.';
    end if;

    nome_et := nullif(btrim(coalesce(etapa ->> 'nome', '')), '');

    if nome_et is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Toda etapa do fluxo precisa de um nome.';
    end if;

    if nome_et = any(nomes) then
      raise exception using
        errcode = 'check_violation',
        message = format('O fluxo tem duas etapas chamadas "%s".', nome_et),
        hint    = 'O nome da etapa é a chave do período que cada mês escolhe, então ele é único dentro do fluxo.';
    end if;

    nomes := nomes || nome_et;

    if coalesce(etapa ->> 'papel', 'producao') = 'entrega' then
      entregas := entregas + 1;
    end if;

    -- O ULTIMO PORTAO DE CLIENTE, guardado para a frase da recusa de baixo.
    if coalesce(etapa ->> 'papel', 'producao') = 'producao'
       and coalesce((etapa ->> 'aprovacao_cliente')::boolean, false) then
      portao := nome_et;
    end if;
  end loop;

  -- AS DUAS RECUSAS DO PASSO 2 APARECEM AQUI TAMBEM, e nao e duplicacao de
  -- verdade: a trava do banco e a que vale, e esta escreve a frase antes de
  -- gravar nada -- a decisao da maquina de estados da subtarefa ao lado dos
  -- gatilhos da 0007. A diferenca pratica e que esta nomeia a linha do
  -- formulario, e a do gatilho pega quem monta a chamada a mao.
  --
  -- E A FRASE E A MESMA DOS DOIS LADOS, que e a licao da 0029 e da 0060: regra
  -- que mora em dois lugares com duas frases diferentes manda a pessoa a dois
  -- lugares diferentes.
  if entregas = 0 then
    if portao is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Marcar "o cliente aprova" em %s não entrega o material: falta dizer qual etapa é a entrega.', portao),
        hint    = format('Se é em %s que o cliente dá a palavra final, mude "O que é" dela para "Entrega ao cliente" — o nome da etapa continua o mesmo, e ela segue sendo o trabalho de quem a faz. Se depois dela ainda há um passo em que a gestão confere e manda, é esse passo que é a entrega.', portao);
    end if;

    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo precisa de uma etapa de entrega ao cliente.',
      hint    = 'A entrega é o portão: é nela que o material sai da agência e a rodada do cliente nasce. Marque em "O que é" qual etapa da corrente é essa.';
  end if;

  if entregas > 1 then
    raise exception using
      errcode = 'check_violation',
      message = format('O fluxo tem %s etapas de entrega, e a entrega é uma só.', entregas),
      hint    = 'Se há um segundo aval no meio da corrente, marque aquela etapa como "o cliente aprova" em vez de criar outra entrega.';
  end if;

  -- `p_flow_id` COM FLUXO QUE NAO EXISTE CRIA COM AQUELE ID, e nao recusa: e
  -- o que deixa o seed e a bateria fixarem o id de um fluxo.
  if alvo is not null and exists (select 1 from public.social_flows f where f.id = alvo) then
    update public.social_flows
       set nome = btrim(p_nome),
           descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
           ativo = coalesce(p_ativo, true),
           updated_at = now()
     where id = alvo
    returning id into alvo;

    -- SEM LINHA DE VOLTA E RECUSA DO RLS, e nao fluxo inexistente -- o `if` de
    -- cima ja separou os dois casos.
    if alvo is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Montar e editar fluxo de social é do desenvolvedor ou do sócio.',
        hint    = 'Quem produz percorre a corrente; quem a desenha é quem responde pelo contrato.';
    end if;
  else
    insert into public.social_flows (id, nome, descricao, ativo, criado_por)
    values (coalesce(alvo, gen_random_uuid()),
            btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''),
            coalesce(p_ativo, true), (select auth.uid()))
    returning id into alvo;
  end if;

  delete from public.social_flow_steps where flow_id = alvo;

  -- OS ELOS ENTRAM NUM `INSERT` SO, e nao num laco -- o gatilho de coerencia
  -- do PASSO 2 da 0087 e POR INSTRUCAO: num laco, a primeira volta deixa o
  -- fluxo com um elo e nenhuma entrega, e a trava recusa ali, com a frase
  -- certa sobre um fluxo que ainda estava sendo montado.
  insert into public.social_flow_steps (
    flow_id, ordem, nome, funcao, papel, campo,
    aprovacao_cliente, aprovacao_interna
  )
  select alvo,
         (t.pos * 10)::integer,
         btrim(t.e ->> 'nome'),
         (t.e ->> 'funcao')::public.team_funcao,
         coalesce(nullif(t.e ->> 'papel', ''), 'producao')::public.social_flow_papel,
         nullif(btrim(coalesce(t.e ->> 'campo', '')), ''),
         coalesce((t.e ->> 'aprovacao_cliente')::boolean, false),
         -- O DEFAULT AQUI E `true`, e e o mesmo da coluna (0090): uma chamada
         -- que nao fala do aval interno nao pode desligar o aval interno. E a
         -- decisao do default `publicada` da 0028 -- esquecer o campo mantem o
         -- que ja acontecia.
         coalesce((t.e ->> 'aprovacao_interna')::boolean, true)
    from jsonb_array_elements(p_etapas) with ordinality as t(e, pos);

  return alvo;
end;
$$;

comment on function public.salvar_fluxo_de_social is
  'Grava um fluxo de social com a corrente dele, numa transacao so. `p_etapas` e a lista na ordem: [{"nome","funcao","papel","campo","aprovacao_cliente","aprovacao_interna"}]. A ultima entrou na 0090 e o default dela e true.';


-- ---------------------------------------------------------------------------
-- `abrir_mes_de_social` COPIA AS DUAS MARCACOES NOVAS
--
-- O corpo e o da 0088 com TRES edicoes, e as tres estao marcadas no lugar:
-- a demanda do mes guarda `social_paralelo`, e cada etapa guarda
-- `social_aval_interno`. Nada mais muda -- nem a assinatura, nem as travas de
-- periodo, nem o teto de 60, nem a ordem em que ela confere.
--
-- O CORPO FOI REGENERADO DO ARQUIVO DA 0088, e nao redigitado: reescrever uma
-- funcao de quatrocentas linhas a partir da leitura dela e exatamente o erro
-- que a 0030 cometeu -- ela perdeu o bloco de carimbos de
-- `validar_transicao_de_subtarefa` e ninguem notou por quatro migrations,
-- porque o sintoma era um contador respondendo zero, que e plausivel.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_mes_de_social(
  p_client_id     uuid,
  p_mes           text,
  p_quantidades   jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis  jsonb default '{}'::jsonb,
  p_prazos        jsonb default '{}'::jsonb,
  p_link_entrega  text default null,
  p_flow_id       uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  linha     jsonb;
  redes     public.plataforma_social[];
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  ultimo    date;
  empresa   text;
  novo      uuid;
  chave     text;
  par       jsonb;
  comeca    date;
  termina   date;
  anterior  date;
  etapa     record;
  demanda   uuid;
  etiqueta  text;
  nome      text;
  fluxo     uuid;
  nomes     text;
  quem      uuid;
  nova_sub  uuid;
  elo_antes uuid;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- O ATENDIMENTO ABRE O MES (0046): a mesma funcao que `tasks_insert` usa
  -- desde a 0006, e nao uma parecida.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
      -- A FRASE E A DA 0046, PALAVRA POR PALAVRA, e a bateria pegou quando eu
      -- a reescrevi: dois cenarios conferem o texto da recusa, e uma trava que
      -- recusa com outra frase e uma trava que ninguem sabe mais se é a mesma.
      message = 'Abrir o mês de social é do Atendimento, do desenvolvedor ou do sócio.',
      hint    = 'Quem produz recebe os posts; quem os abre é quem responde pelo contrato.';
  end if;

  begin
    primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  exception when others then
    raise exception using
      errcode = 'check_violation',
      message = 'O mês precisa estar no formato AAAA-MM.';
  end;

  ultimo := (primeiro + interval '1 month' - interval '1 day')::date;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- QUAL FLUXO ESTE MES PERCORRE (0087). A ORDEM E MES EXISTENTE -> ESCOLHA DO
  -- DIALOGO -> PADRAO DA CONTA -> CASA. O mes que JA existe vem primeiro, e ele
  -- e a razao de `tasks.social_flow_id` existir: sem esta leitura a segunda
  -- chamada poderia usar outro fluxo, e o mes ficaria com duas correntes
  -- dentro.
  select t.social_flow_id into fluxo
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro
     and t.social_flow_id is not null;

  if fluxo is null then
    fluxo := public.fluxo_do_mes(p_client_id, p_flow_id);
  end if;

  if fluxo is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Não há fluxo de social ativo para abrir o mês.',
      hint    = 'Monte um fluxo em Social Media, na aba Fluxos: ele é a corrente de etapas que os posts do mês percorrem.';
  end if;

  select string_agg(e.nome, ', ' order by e.ordem) into nomes
    from public.etapas_do_fluxo(fluxo) e;

  -- FLUXO VAZIO E RECUSADO AQUI, e nao pela trava da 0087, que o deixa passar
  -- de proposito -- um fluxo sem etapa e o estado de quem esta montando. O que
  -- ele nao pode e abrir um mes: os posts nasceriam sem corrente e nunca
  -- chegariam ao cliente.
  if nomes is null then
    raise exception using
      errcode = 'check_violation',
      message = 'O fluxo escolhido não tem etapa nenhuma.',
      hint    = 'Monte a corrente dele antes de abrir o mês — sem etapas, os posts nascem sem trabalho e sem caminho até o cliente.';
  end if;

  -- A FORMA NOVA E UMA LISTA (0082), e a recusa diz isso em vez de estourar
  -- dentro de um `jsonb_array_elements` com uma mensagem sobre tipo de jsonb.
  if p_quantidades is null or jsonb_typeof(p_quantidades) <> 'array' then
    raise exception using
      errcode = 'check_violation',
      message = 'As quantidades vêm como uma lista de combinações de redes.',
      hint    = 'Cada linha é {"redes": ["instagram","facebook"], "quantidade": 12}.';
  end if;

  -- OS PERIODOS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a mensagem
  -- sairia depois de sessenta inserts, e o custo de conferir cinco periodos
  -- primeiro e zero.
  for chave, par in select key, value from jsonb_each(p_prazos)
  loop
    -- A DICA NOMEIA AS ETAPAS DO FLUXO ESCOLHIDO, e nao as cinco da casa
    -- escritas a mao (0087): com a cadeia editavel, uma lista fixa aqui
    -- mandaria a pessoa procurar "Pauta" num fluxo que nao tem nenhuma.
    if not exists (select 1 from public.etapas_do_fluxo(fluxo) e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('O fluxo deste mês não tem etapa chamada "%s".', chave),
        hint    = format('As etapas dele são %s.', nomes);
    end if;

    -- A FORMA DA 0083 -- uma data solta -- E RECUSADA COM FRASE PROPRIA, e nao
    -- aceita como "so o fim": quem cair aqui esta mandando a forma antiga, e um
    -- mes aberto com a corrente sem inicio nenhum nao da erro em lugar nenhum
    -- -- some na carga de quem produz, que e onde ninguem procura.
    if jsonb_typeof(par) <> 'object' then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" precisa do período, e não de uma data só.', chave),
        hint    = 'Cada etapa é {"inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD"} — as duas pontas, e as duas valem para o mês inteiro.';
    end if;

    begin
      comeca  := nullif(btrim(coalesce(par ->> 'inicio', '')), '')::date;
      termina := nullif(btrim(coalesce(par ->> 'fim', '')), '')::date;
    exception when others then
      raise exception using
        errcode = 'check_violation',
        message = format('As datas da etapa "%s" precisam estar no formato AAAA-MM-DD.', chave);
    end;

    -- PERIODO INVERTIDO NAO E PERIODO, e a funcao recusa antes do `check` de
    -- `subtasks_periodo` para a mensagem nomear a ETAPA -- aquele check nao diz
    -- qual das cinco esta trocada.
    if comeca is not null and termina is not null and comeca > termina then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" terminaria antes de começar.', chave),
        hint    = 'O início vem antes do fim — confira se os dois campos não estão trocados.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE, e quem responde e o FIM
  -- de cada etapa: e ele que define atraso (0027), e e por ele que a corrente
  -- recusa comecar o Layout antes de o Conteudo fechar. Comparar os inicios
  -- recusaria o normal -- o Layout comeca enquanto o Conteudo ainda corre, e
  -- isso e trabalho em paralelo, nao erro.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_do_fluxo(fluxo) e order by e.ordem
  loop
    termina := nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date;
    if termina is not null then
      if anterior is not null and termina < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = format('A ordem deste fluxo é %s — os dias precisam andar na mesma direção.', nomes);
      end if;
      anterior := termina;
    end if;
  end loop;

  -- AS LINHAS SAO CONFERIDAS INTEIRAS ANTES DE ABRIR POST NENHUM, pela mesma
  -- razao dos periodos.
  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);

    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
    end if;

    -- UMA LINHA SEM REDE NENHUMA E RECUSADA, e nao ignorada: ignora-la faria o
    -- dialogo prometer doze posts e a funcao devolver zero, sem dizer por que.
    if quantos > 0 and jsonb_array_length(coalesce(linha -> 'redes', '[]'::jsonb)) = 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Escolha ao menos uma rede para cada linha.',
        hint    = 'Uma linha com quantidade e sem rede abriria posts que não vão a lugar nenhum.';
    end if;

    total := total + quantos;
  end loop;

  if total = 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha quantos posts abrir.',
      hint    = 'Pelo menos uma rede precisa de um número maior que zero.';
  end if;

  if total > 60 then
    raise exception using
      errcode = 'check_violation',
      message = format('São %s posts de uma vez, e o limite é 60.', total),
      hint    = 'Se o número está certo, abra em duas vezes — assim um zero a mais não vira sessenta posts para apagar.';
  end if;

  -- ------------------------------------------------------------------------
  -- A DEMANDA DO MES: achada ou criada, nunca duplicada
  --
  -- Quem garante a unicidade e o indice `tasks_social_do_mes_unico`, e nao
  -- este `select`: duas abas clicando ao mesmo tempo passam pelas duas
  -- consultas, e a segunda leva a recusa do indice. E a decisao da 0040.
  -- ------------------------------------------------------------------------
  select t.id into demanda
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro;

  if demanda is null then
    if p_link_entrega is null or btrim(p_link_entrega) = '' then
      raise exception using
        errcode = 'check_violation',
        message = 'A demanda do mês precisa da pasta de entrega.',
        hint    = 'O mês de social é uma demanda só, com uma etapa por fase do fluxo — e toda demanda precisa da pasta onde o material vai ficar. O botão "Criar no Drive" cria a do mês.';
    end if;

    etiqueta := format('Social · %s/%s de %s',
                       meses[extract(month from primeiro)::integer],
                       extract(year from primeiro)::integer,
                       empresa);

    -- NASCE PUBLICADA, e nao como rascunho: rascunho e de quem o criou, e
    -- esconderia da equipe as etapas que ela acabou de distribuir (0051).
    insert into public.tasks (
      client_id, titulo, data_inicio, data_fim, link_entrega,
      social_do_mes, social_flow_id, criado_por, publicada_em,
      -- EDICAO DA 0090: o snapshot do paralelismo. Ler
      -- `social_flows.avanca_em_paralelo` na hora da trava faria um mes que
      -- esta correndo mudar de comportamento porque alguem mexeu na
      -- configuracao da conta -- que e a razao de `social_papel` ser snapshot.
      social_paralelo
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, fluxo, (select auth.uid()), now(),
      coalesce((select f.avanca_em_paralelo from public.social_flows f where f.id = fluxo), false)
    )
    returning id into demanda;
  end if;

  -- ------------------------------------------------------------------------
  -- AS ETAPAS DO MES, UMA POR ELO DO FLUXO
  --
  -- Elas nascem UMA VEZ, na primeira chamada. A segunda acrescenta posts, e as
  -- etapas que ja estao la ficam como estao -- com o dono e o periodo que
  -- alguem pode ter ajustado.
  -- ------------------------------------------------------------------------
  if not exists (select 1 from public.etapas_do_mes(demanda)) then
    elo_antes := null;

    for etapa in select * from public.etapas_do_fluxo(fluxo) order by ordem
    loop
      quem := nullif(p_responsaveis ->> (etapa.funcao::text), '')::uuid;

      insert into public.subtasks (
        task_id, titulo, ordem, responsavel_id,
        data_inicio, prazo,
        social_papel, social_campo, social_portao,
        -- EDICAO DA 0090: o snapshot do aval interno do elo.
        social_aval_interno,
        -- FUNCAO SEM DONO AVISA, NUNCA RECUSA (0064), e a frase NOMEIA a
        -- funcao que faltou -- "ha etapa sem responsavel" manda abrir uma por
        -- uma. Travar a abertura do mes por causa de um cadastro deixaria o
        -- cliente sem entrega.
        aviso_geracao
      ) values (
        demanda, etapa.nome, etapa.ordem, quem,
        nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'inicio', '')), '')::date,
        nullif(btrim(coalesce(p_prazos -> etapa.nome ->> 'fim', '')), '')::date,
        etapa.papel, etapa.campo, etapa.aprovacao_cliente,
        etapa.aprovacao_interna,
        case when quem is null
             then format('Esta etapa é do %s, e a conta não tem ninguém nessa função.', etapa.funcao)
             else null end
      )
      returning id into nova_sub;

      -- A CORRENTE E DEPENDENCIA DE VERDADE, e nao mais a ordem de uma tabela
      -- propria: `validar_transicao_de_subtarefa` (0007) recusa sair de
      -- `nao_iniciada` com dependencia em aberto, e a tela mostra o cadeado
      -- com o que esta faltando. Era isso que `post_etapas_regras` reimplementava.
      if elo_antes is not null then
        insert into public.subtask_dependencies (subtask_id, depende_de_id)
        values (nova_sub, elo_antes)
        on conflict (subtask_id, depende_de_id) do nothing;
      end if;

      elo_antes := nova_sub;
    end loop;
  end if;

  -- ------------------------------------------------------------------------
  -- OS POSTS. A caixinha de cada um nasce pelo gatilho `posts_entra_no_mes`.
  -- ------------------------------------------------------------------------
  for linha in select * from jsonb_array_elements(p_quantidades)
  loop
    quantos := coalesce((linha ->> 'quantidade')::integer, 0);
    continue when quantos = 0;

    -- `distinct` NA LEITURA (0082): a linha vem de um dialogo em que a pessoa
    -- marca caixas, e a trava da tabela fica para quem monta a chamada a mao.
    select array_agg(distinct r::public.plataforma_social order by r::public.plataforma_social)
      into redes
      from jsonb_array_elements_text(linha -> 'redes') as t(r);

    -- O NOME DA COMBINACAO sai das redes, por extenso e na ORDEM DO ENUM
    -- (0082): alfabeticamente o Facebook viria antes do Instagram.
    select string_agg(initcap(r::text), ' + ' order by r)
      into nome
      from unnest(redes) as t(r);

    for i in 1..quantos loop
      insert into public.posts (
        client_id, tema, data_publicacao, plataformas, midia,
        criado_por, responsavel_id, social_task_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', nome, i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        redes,
        'imagem',
        (select auth.uid()),
        p_responsavel_id,
        demanda
      )
      returning id into novo;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text, uuid) is
  'Abre o mes de social de um cliente: UMA demanda, UMA etapa por elo do fluxo escolhido, e um post por linha de combinacao. Desde a 0090 ela copia `social_paralelo` para a demanda e `social_aval_interno` para cada etapa -- as duas sao snapshot, e editar o fluxo depois nao as encosta.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - QUAL PORTAO O MES ESTA ESPERANDO, E QUEM VAI NELE
--
-- `portao_atual_do_mes()` e a pergunta do sprint: *"o primeiro elo com
-- aprovacao do cliente cujo lote nao foi integralmente aprovado"*. A conta e
-- posicional, como toda conta de portao desde a 0088 -- e ela sai do MINIMO
-- das aprovacoes das pecas:
--
--   posicao do portao do mes = min(k por peca) + 1
--
-- Com o mes andando junto (o padrao), todas as pecas tem o mesmo k e o minimo
-- e ele. Com paralelismo ligado, o minimo e a peca mais atrasada -- que e
-- justamente o portao que ainda tem gente dentro.
--
-- Mes sem post devolve nulo, e nao o primeiro portao: um mes vazio nao esta
-- esperando nada, e devolver o primeiro faria a tela oferecer "Enviar o mes
-- (0)".
-- ---------------------------------------------------------------------------
create or replace function public.portao_atual_do_mes(p_task_id uuid)
returns public.subtasks
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  menor integer;
  vazia public.subtasks;
begin
  -- A GUARDA E ESCRITA A MAO, e e a parte que a bateria mede. `security
  -- definer` nao passa pela RLS de `posts` nem de `subtasks`, entao sem ela
  -- esta funcao responde sobre o mes de QUALQUER empresa para quem tiver o
  -- uuid -- e quem esta logado inclui o cliente. E a forma de
  -- `o_que_o_cliente_decide()` na 0076: definer para devolver o agregado, com
  -- a pergunta de quem pode escrita dentro.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Essa consulta é da equipe.';
  end if;

  if p_task_id is null then
    return vazia;
  end if;

  select min(public.aprovacoes_do_cliente_no_post(p.id))
    into menor
    from public.posts_do_mes(p_task_id) p;

  if menor is null then
    return vazia;
  end if;

  return public.portao_do_mes_na_posicao(p_task_id, menor + 1);
end;
$$;

comment on function public.portao_atual_do_mes(uuid) is
  'O portao que o mes de social esta esperando (0090): o (min(k)+1)-esimo, onde k sao as rodadas de cliente aprovadas de cada peca. Nulo quando o mes nao tem post, ou quando todos os portoes ja fecharam.';

-- ---------------------------------------------------------------------------
-- AS PECAS QUE VAO NO LOTE
--
-- Elegivel e a peca cujo portao ABERTO e exatamente este -- a conta de
-- `porta_do_cliente_no_post()` lida do outro lado -- e que nao tem rodada de
-- cliente PENDENTE. A segunda metade e o que impede o segundo clique de
-- mandar a mesma peca duas vezes: quem esta esperando o cliente nao esta
-- esperando a agencia.
--
-- Peca com ajustes pedidos E elegivel, e e o ponto do sprint: a rodada
-- recusada nao conta (0023), entao o portao aberto dela continua sendo este, e
-- a rodada 2 do lote leva exatamente ela. Quem ja aprovou tem k maior e fica
-- de fora -- o cliente nao re-decide o que ja aprovou.
-- ---------------------------------------------------------------------------
create or replace function public.posts_elegiveis_do_portao(p_task_id uuid, p_etapa_id uuid)
returns setof public.posts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pos integer;
begin
  -- A GUARDA E ESCRITA A MAO, e e a parte que a bateria mede. `security
  -- definer` nao passa pela RLS de `posts` nem de `subtasks`, entao sem ela
  -- esta funcao responde sobre o mes de QUALQUER empresa para quem tiver o
  -- uuid -- e quem esta logado inclui o cliente. E a forma de
  -- `o_que_o_cliente_decide()` na 0076: definer para devolver o agregado, com
  -- a pergunta de quem pode escrita dentro.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Essa consulta é da equipe.';
  end if;

  select g.posicao into pos
    from (
      select s.id, row_number() over (order by s.ordem) as posicao
        from public.portoes_do_mes(p_task_id) s
    ) g
   where g.id = p_etapa_id;

  if pos is null then
    return;
  end if;

  return query
    select p.*
      from public.posts_do_mes(p_task_id) p
     where public.aprovacoes_do_cliente_no_post(p.id) = pos - 1
       and not exists (
         select 1 from public.approval_rounds r
          where r.content_type = 'post'
            and r.content_id = p.id
            and r.escopo = 'cliente'
            and r.status = 'pendente'
       )
     order by p.data_publicacao nulls last, p.tema;
end;
$$;

comment on function public.posts_elegiveis_do_portao(uuid, uuid) is
  'As pecas do mes que vao no proximo lote deste portao (0090): aquelas cujo portao aberto e este e que nao estao esperando o cliente. A que voltou com ajustes entra; a que ja aprovou, nao.';

-- ---------------------------------------------------------------------------
-- O QUE FALTA, PECA POR PECA
--
-- Esta e a funcao que faz a recusa ENSINAR em vez de so recusar, e o sprint
-- pede isso por nome: *"a mensagem precisa dizer quais pecas estao sem data,
-- com link para elas"*. E a decisao da 0023, que nomeia cada etapa sem
-- aprovacao -- dizer quais e a diferenca entre uma recusa e uma instrucao.
--
-- Ela devolve UMA LINHA POR PECA COM PROBLEMA, com o motivo por extenso e o
-- id, que e o que a tela usa para montar o link. A tela a chama para desligar
-- o botao antes do clique; `enviar_mes_ao_cliente` a chama para recusar.
-- ---------------------------------------------------------------------------
create or replace function public.o_que_falta_no_portao(p_task_id uuid, p_etapa_id uuid)
returns table (post_id uuid, tema text, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  etapa public.subtasks;
begin
  -- A GUARDA E ESCRITA A MAO, e e a parte que a bateria mede. `security
  -- definer` nao passa pela RLS de `posts` nem de `subtasks`, entao sem ela
  -- esta funcao responde sobre o mes de QUALQUER empresa para quem tiver o
  -- uuid -- e quem esta logado inclui o cliente. E a forma de
  -- `o_que_o_cliente_decide()` na 0076: definer para devolver o agregado, com
  -- a pergunta de quem pode escrita dentro.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Essa consulta é da equipe.';
  end if;

  select s.* into etapa from public.subtasks s where s.id = p_etapa_id;
  if etapa.id is null or etapa.social_papel is null then
    return;
  end if;

  return query
    select p.id, p.tema, m.motivo
      from public.posts_elegiveis_do_portao(p_task_id, p_etapa_id) p
      cross join lateral (
        select case
          -- A ORDEM DOS MOTIVOS E A ORDEM DO TRABALHO, e por isso o `case`
          -- para no primeiro: quem nao terminou a fase nao precisa ouvir que
          -- tambem falta a data. Uma lista de tres motivos para a mesma peca e
          -- um paragrafo onde a pessoa precisa de uma frase.
          when not exists (
            select 1 from public.post_etapa_progresso g
             where g.post_id = p.id and g.subtask_id = p_etapa_id and g.concluido
          -- A CAIXINHA DA ENTREGA FICA FORA, e nao por excecao: ela nao se
          -- marca a mao (0088), porque e consequencia da aprovacao daquela
          -- peca. Exigi-la aqui seria uma recusa que ninguem tem como
          -- satisfazer -- a mesma forma da trava de data no portao do meio.
          ) and etapa.social_papel <> 'entrega'
            then format('a etapa "%s" ainda não está marcada nesta peça', etapa.titulo)

          when coalesce(etapa.social_aval_interno, true)
           and not public.post_tem_aval_interno(p.id)
            then 'falta o aval interno desta versão'

          when etapa.social_papel = 'entrega' and p.data_publicacao is null
            then 'não tem data de publicação'

          when etapa.social_papel = 'entrega' and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
            then 'é vídeo e não tem o link'

          else null
        end as motivo
      ) m
     where m.motivo is not null
     order by p.tema;
end;
$$;

comment on function public.o_que_falta_no_portao(uuid, uuid) is
  'As pecas do lote que ainda nao podem sair, com o motivo de cada uma (0090). A recusa que nomeia e a diferenca entre um "nao pode" e uma instrucao, que e a decisao da 0023.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - ENVIAR O MES AO CLIENTE
--
-- Uma transacao so, pela razao de `abrir_campanha()` na 0051 e de
-- `solicitar_notas_do_mes()` na 0066: sao N+2 escritas encadeadas, e pelo
-- PostgREST seriam N+2 transacoes -- a terceira falhando deixaria um lote
-- gravado com metade das pecas dentro, e o cliente vendo um conjunto
-- incompleto sem nada na tela dizendo o que faltou.
--
-- ELA NAO E `security definer`, e isso e deliberado: `approval_rounds_insert`
-- e `social_lotes_insert` continuam decidindo quem pode, e abrir aqui daria a
-- qualquer pessoa com a chave anon o poder de mandar material de qualquer
-- empresa para fora da agencia. E a decisao de `abrir_campanha()` e de
-- `busca_global()`.
-- ---------------------------------------------------------------------------
create or replace function public.enviar_mes_ao_cliente(
  p_task_id  uuid,
  p_etapa_id uuid,
  p_recado   text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  etapa    public.subtasks;
  demanda  public.tasks;
  lote     uuid;
  numero   integer;
  pecas    integer := 0;
  peca     public.posts;
  faltam   text;
  quantas  integer;
  pessoa   uuid;
begin
  if not (public.is_gestor() or public.is_atendimento()) then
    raise exception using
      errcode = 'check_violation',
      message = 'Enviar o mês ao cliente é da gestão ou do Atendimento.';
  end if;

  select t.* into demanda from public.tasks t where t.id = p_task_id;
  if demanda.id is null or demanda.social_do_mes is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Esse mês de social não existe.';
  end if;

  select s.* into etapa from public.subtasks s where s.id = p_etapa_id;

  -- A ETAPA TEM DE SER UM PORTAO DESTE MES, e as duas metades importam: uma
  -- etapa de outro mes abriria um lote cujas rodadas sao de pecas que nao
  -- estao nele, e uma etapa que nao e portao abriria um lote que o cliente
  -- nunca decide -- ele veria material sem ter onde responder.
  if etapa.id is null
     or etapa.task_id is distinct from p_task_id
     or not exists (select 1 from public.portoes_do_mes(p_task_id) g where g.id = p_etapa_id) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa etapa não é um portão deste mês.',
      hint    = 'Portão é a etapa em que o cliente dá a palavra: a entrega, ou um elo de produção marcado com "o cliente aprova".';
  end if;

  select count(*)::integer into quantas
    from public.posts_elegiveis_do_portao(p_task_id, p_etapa_id);

  if quantas = 0 then
    raise exception using
      errcode = 'check_violation',
      message = format('Não há peça esperando a sua vez em "%s".', etapa.titulo),
      hint    = 'Ou todas já foram decididas neste portão, ou estão aguardando o cliente responder o envio anterior.';
  end if;

  -- O QUE FALTA E CONFERIDO ANTES DE GRAVAR QUALQUER COISA, e a frase nomeia
  -- as pecas. A funcao e transacional, entao recusar no meio tambem desfaria
  -- tudo -- mas a mensagem sairia depois de dezoito inserts e falaria de UMA
  -- peca, porque `validar_nova_rodada` e por linha. E a ordem de
  -- `abrir_mes_de_social`, que confere os cinco periodos antes de abrir post
  -- nenhum.
  select string_agg(format('%s (%s)', f.tema, f.motivo), '; ' order by f.tema)
    into faltam
    from public.o_que_falta_no_portao(p_task_id, p_etapa_id) f;

  if faltam is not null then
    raise exception using
      errcode = 'check_violation',
      message = format('Há peça que ainda não pode ir ao cliente em "%s".', etapa.titulo),
      hint    = faltam;
  end if;

  -- O NUMERO DO LOTE E A RODADA DAQUELE PORTAO. Ele nao e o
  -- `numero_rodada` das rodadas de aprovacao: aquele e a sequencia de cada
  -- post, e o PASSO 4 explica por que os dois nao podem ser o mesmo numero.
  select coalesce(max(l.numero_rodada), 0) + 1 into numero
    from public.social_lotes l
   where l.task_id = p_task_id and l.etapa_id = p_etapa_id;

  insert into public.social_lotes (task_id, etapa_id, numero_rodada, enviado_por, recado)
  values (p_task_id, p_etapa_id, numero, (select auth.uid()),
          nullif(btrim(coalesce(p_recado, '')), ''))
  returning id into lote;

  for peca in select * from public.posts_elegiveis_do_portao(p_task_id, p_etapa_id)
  loop
    -- `enviado_em` E `posts.status` CONTINUAM SENDO CONSEQUENCIA DA RODADA,
    -- pelo gatilho `approval_rounds_marca_post` da 0032. Carimba-los aqui
    -- seria o segundo comando que aquela migration existe para nao ter.
    insert into public.approval_rounds (
      content_type, content_id, numero_rodada, escopo, solicitado_por, status, lote_id
    ) values (
      'post', peca.id, public.proxima_rodada_do_cliente(peca.id),
      'cliente', (select auth.uid()), 'pendente', lote
    );

    pecas := pecas + 1;
  end loop;

  -- UM AVISO POR PESSOA, E UM SO -- nao um por peca. Dezoito sinos para um
  -- envio e o que ensina a ignorar o sino, e e a razao pela qual
  -- `solicitar_notas_do_mes()` (0066) toca os N sinos de dentro da mesma
  -- transacao em vez de a action tocar um por chamada.
  --
  -- `notificar()` nunca avisa quem causou o aviso, nunca avisa quem saiu, e
  -- devolve `null` sem derrubar a escrita quando nao ha a quem avisar -- as
  -- tres recusas sao da 0062 e nao se repetem aqui.
  for pessoa in
    select cu.user_id from public.client_users cu where cu.client_id = demanda.client_id
  loop
    perform public.notificar(
      pessoa, 'aprovacao',
      format('%s está pronta para a sua aprovação', etapa.titulo),
      format('%s %s aguardando a sua decisão em %s.',
             pecas,
             case when pecas = 1 then 'peça' else 'peças' end,
             demanda.titulo),
      '/portal/social-media'
    );
  end loop;

  return jsonb_build_object(
    'lote_id', lote,
    'portao',  etapa.titulo,
    'rodada',  numero,
    'pecas',   pecas
  );
end;
$$;

comment on function public.enviar_mes_ao_cliente(uuid, uuid, text) is
  'Envia um portao do mes de social ao cliente, em lote (0090): um `social_lotes` e uma rodada de escopo cliente por peca elegivel, numa transacao so, com UM aviso por pessoa da empresa. A unidade de envio e o mes; a decisao continua sendo de cada peca.';


-- ---------------------------------------------------------------------------
-- PASSO 9 - O LOTE FECHA QUANDO A ULTIMA PECA RESPONDE
--
-- `fechado_em` e CARIMBO e nao decisao: ele nao diz nada que as rodadas nao
-- digam, ele diz QUANDO elas acabaram de dizer. E por isso ele e escrito por
-- gatilho a partir delas -- gravado pela action, ele seria a segunda fonte de
-- verdade que o lote existe para nao ter.
--
-- E O GATILHO MORA EM `approval_rounds`, nao dentro de
-- `decidir_rodada_do_cliente`: aquela funcao ja foi reescrita inteira varias
-- vezes, e cada reescrita e uma chance de o trecho ficar para tras (0045). De
-- quebra ele pega todo caminho, inclusive um PATCH montado a mao.
-- ---------------------------------------------------------------------------
create or replace function public.social_lote_fecha_sozinho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  abertas  integer;
  l        public.social_lotes;
  resumo   text;
  etapa    text;
  demanda  text;
begin
  if new.lote_id is null then
    return new;
  end if;

  select * into l from public.social_lotes where id = new.lote_id;
  if l.id is null or l.fechado_em is not null then
    return new;
  end if;

  select count(*)::integer into abertas
    from public.approval_rounds r
   where r.lote_id = new.lote_id and r.status = 'pendente';

  if abertas > 0 then
    return new;
  end if;

  update public.social_lotes set fechado_em = now() where id = new.lote_id;

  -- O RESUMO PARA A GESTAO sai das rodadas, que e a unica fonte. "15
  -- aprovados, 3 com ajustes" e a frase do sprint, e ela e derivada: o lote
  -- nao guarda nenhum desses dois numeros.
  select string_agg(txt, ', ' order by ord) into resumo
    from (
      select 1 as ord, format('%s aprovadas', count(*)) as txt
        from public.approval_rounds r where r.lote_id = new.lote_id and r.status = 'aprovada'
       having count(*) > 0
      union all
      select 2, format('%s com ajustes', count(*))
        from public.approval_rounds r where r.lote_id = new.lote_id and r.status = 'ajustes_solicitados'
       having count(*) > 0
      union all
      select 3, format('%s recusadas', count(*))
        from public.approval_rounds r where r.lote_id = new.lote_id and r.status = 'rejeitada'
       having count(*) > 0
    ) t;

  select s.titulo into etapa  from public.subtasks s where s.id = l.etapa_id;
  select t.titulo into demanda from public.tasks t    where t.id = l.task_id;

  -- QUEM RECEBE E QUEM ENVIOU, e nao a gestao inteira: o envio foi um ato de
  -- uma pessoa, e e ela que esta esperando a resposta. Tocar o sino de todo
  -- gestor a cada lote fechado seria um aviso por mes por conta, que e o
  -- caminho mais curto para o sino virar ruido.
  if l.enviado_por is not null then
    perform public.notificar(
      l.enviado_por, 'aprovacao',
      format('%s — %s: o cliente respondeu', demanda, etapa),
      coalesce(resumo, 'Todas as peças deste envio foram decididas.'),
      '/painel/social-media'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists approval_rounds_fecha_o_lote on public.approval_rounds;
create trigger approval_rounds_fecha_o_lote
  after update of status on public.approval_rounds
  for each row execute function public.social_lote_fecha_sozinho();

comment on function public.social_lote_fecha_sozinho() is
  'Carimba `social_lotes.fechado_em` quando a ultima rodada do lote recebe resposta, e avisa quem enviou com o resumo (0090). O resumo e derivado das rodadas -- o lote nao guarda decisao.';


-- ---------------------------------------------------------------------------
-- PASSO 10 - O MES ANDA JUNTO, E A TRAVA B GANHA A OUTRA METADE
--
-- O corpo e o da 0088 com DUAS edicoes, marcadas no lugar. A trava da
-- corrente (A) e as duas excecoes (sem sessao, e o GUC) ficam letra por letra.
-- ---------------------------------------------------------------------------
create or replace function public.post_etapa_progresso_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa        public.subtasks;
  pendente     text;
  portoes      integer;
  falta        text;
  -- EDICAO DA 0090
  paralelo     boolean;
  menor        integer;
  atrasadas    integer;
  travas boolean := (select auth.uid()) is not null
                    and coalesce(current_setting('full_hub.corrente', true), '') <> 'on';
begin
  select s.* into etapa from public.subtasks s where s.id = new.subtask_id;

  if etapa.id is null or etapa.social_papel is null then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha de progresso é de uma etapa de mês de social.',
      hint    = 'Uma subtarefa comum não tem posts dentro dela: o progresso dela é o status.';
  end if;

  -- O POST E A ETAPA NAO TROCAM DE LUGAR. Policy nao limita coluna: sem esta
  -- parte, um PATCH no PostgREST moveria a marcacao de um post para outro --
  -- e o "12 de 18" continuaria dizendo doze.
  if tg_op = 'UPDATE'
     and (new.post_id is distinct from old.post_id
          or new.subtask_id is distinct from old.subtask_id) then
    raise exception using
      errcode = 'check_violation',
      message = 'A caixinha pertence a um post e a uma etapa, e nenhum dos dois muda.',
      hint    = 'Para mover trabalho entre etapas, mexa nas etapas do mês.';
  end if;

  -- `mudou` E O QUE SEPARA A ESCRITA DA CAIXINHA DO NASCIMENTO DELA, e a
  -- distincao nao e zelo: as linhas nascem em bloco, uma por post x etapa,
  -- desmarcadas -- e sem esta variavel a trava da entrega recusaria o proprio
  -- `insert` que cria as caixinhas dela, deixando toda etapa de entrega sem
  -- denominador. O "12 de 18" dela sairia "0 de 0".
  if not ((tg_op = 'INSERT' and new.concluido)
          or (tg_op = 'UPDATE' and new.concluido is distinct from old.concluido)) then
    new.updated_at := now();
    return new;
  end if;

  -- A CAIXINHA DA ENTREGA NAO SE MARCA A MAO, nem pela gestao. E a regra da
  -- 0045 um nivel abaixo: a etapa Envio era consequencia da rodada de escopo
  -- cliente, e a caixinha dela e consequencia da APROVACAO daquele post.
  -- Marcar a mao afirmaria que a peca foi e voltou aprovada sem nada ter
  -- saido da agencia -- e DESMARCAR a mao afirmaria o contrario de uma
  -- aprovacao que esta gravada na rodada.
  if travas and etapa.social_papel = 'entrega' then
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" acompanha a decisão do cliente, e não se marca à mão.', etapa.titulo),
      hint    = 'Use a ação Enviar ao cliente; quando ele aprovar, a caixinha deste post fecha sozinha.';
  end if;

  if travas and new.concluido then
    -- A ORDEM DAS DUAS E DELIBERADA, e a bateria me obrigou a escolher: no
    -- Programar as DUAS valem -- a caixinha da entrega so fecha pela aprovacao
    -- do cliente, entao ela esta desmarcada e a trava da corrente tambem
    -- dispararia. Com a A primeiro, a pessoa lia *"falta Envio"*, que e
    -- verdade e nao diz o que fazer; com a B primeiro ela le *"o cliente ainda
    -- nao aprovou Envio"*, que e a mesma recusa dizendo de quem a bola esta.
    -- E a decisao da 0023: a recusa que nomeia e a diferenca entre um "nao
    -- pode" e uma instrucao.

    -- TRAVA B - o cliente ja decidiu os portoes anteriores DESTE post.
    --
    -- Ela nao e coberta pela A, e e o ponto: a caixinha de um portao do MEIO
    -- marca que a PESSOA escreveu a pauta, nao que o cliente a aprovou. Sem
    -- esta, as doze pautas marcadas liberariam o conteudo das doze sem nenhuma
    -- ter sido validada -- que e o fluxo que a conta contratou para nao
    -- acontecer.
    --
    -- E ela cobre "ninguem programa o que o cliente nao aprovou" sem uma
    -- segunda regra: antes do Programar ha dois portoes num fluxo que valida a
    -- pauta (a Pauta e o Envio), entao ele precisa de duas aprovacoes.
    select count(*)::integer into portoes
      from public.portoes_do_mes(etapa.task_id) p
     where p.ordem < etapa.ordem;

    -- EDICAO DA 0090 - O MES ANDA JUNTO, E E O PADRAO
    --
    -- A frase do sprint: *"o portao so e vencido quando todos os posts forem
    -- aprovados nele. Enquanto 3 estiverem em ajustes na Pauta, o Layout nao
    -- comeca para nenhum"*. E o que o usuario descreveu com outras palavras:
    -- a peca e individual, mas faz parte de um conjunto.
    --
    -- Ela e uma trava A MAIS e nao uma troca: a de baixo continua perguntando
    -- por ESTA peca, e com o mes andando junto o minimo ja a cobre -- se toda
    -- peca passou dos portoes anteriores, esta passou. Com paralelismo ligado
    -- o minimo nao e perguntado e sobra a de baixo, que e o comportamento da
    -- 0088 inteiro.
    --
    -- `tasks.social_paralelo` e o SNAPSHOT (0090) e nao
    -- `social_flows.avanca_em_paralelo`: ler a configuracao da conta aqui
    -- faria a trava de um mes em producao mudar porque alguem marcou uma caixa
    -- na aba Fluxos.
    select coalesce(t.social_paralelo, false) into paralelo
      from public.tasks t where t.id = etapa.task_id;

    -- E ELA VALE SO EM ETAPA DE PRODUCAO, e foi o seed que me obrigou a
    -- escrever isso: a primeira versao perguntava em toda etapa, e o
    -- `Programar` -- que e `pos_entrega` -- passou a ser recusado enquanto
    -- QUALQUER peca do mes nao tivesse sido aprovada. Na pratica isso impede a
    -- social media de agendar as quinze pecas aprovadas por causa de tres em
    -- ajustes, que e o oposto do que o mes andando junto existe para proteger.
    --
    -- A frase do sprint e sobre PRODUCAO -- *"enquanto 3 estiverem em ajustes
    -- na Pauta, o Layout nao comeca para nenhum"* --, e `pos_entrega` vem
    -- DEPOIS da decisao de cada peca por definicao (0087): ali a trava de
    -- baixo, que e por peca, e a pergunta certa e a unica.
    if not coalesce(paralelo, false)
       and portoes > 0
       and etapa.social_papel = 'producao' then
      select min(public.aprovacoes_do_cliente_no_post(p.id)) into menor
        from public.posts_do_mes(etapa.task_id) p;

      if coalesce(menor, 0) < portoes then
        -- A FRASE DIZ QUANTAS FALTAM, e nao "o mes nao pode andar": quem le
        -- precisa saber se falta uma peca ou dezessete para decidir se espera
        -- ou se cobra o cliente. E a decisao da 0023 outra vez.
        select count(*)::integer into atrasadas
          from public.posts_do_mes(etapa.task_id) p
         where public.aprovacoes_do_cliente_no_post(p.id) < portoes;

        -- O `offset` MORA NUMA SUBCONSULTA, e nao no nivel do `string_agg`:
        -- um `order by` de instrucao sobre uma consulta agregada e recusado
        -- com *"column p.ordem must appear in the GROUP BY clause"*. E a forma
        -- que a trava B logo abaixo ja usava desde a 0088 -- foi o seed que me
        -- mostrou, aplicando a migration do zero.
        select string_agg(p.titulo, ', ' order by p.ordem) into falta
          from (select p.titulo, p.ordem
                  from public.portoes_do_mes(etapa.task_id) p
                 where p.ordem < etapa.ordem
                 order by p.ordem
                offset coalesce(menor, 0)) p;

        raise exception using
          errcode = 'check_violation',
          message = format('O mês anda junto, e %s %s ainda não %s por %s.',
                           atrasadas,
                           case when atrasadas = 1 then 'peça' else 'peças' end,
                           case when atrasadas = 1 then 'passou' else 'passaram' end,
                           falta),
          hint    = 'Esta conta espera o mês fechar cada portão antes de seguir. Para as peças aprovadas andarem sem esperar as demais, ligue "as peças aprovadas avançam" no fluxo da conta.';
      end if;
    end if;

    if public.aprovacoes_do_cliente_no_post(new.post_id) < portoes then
      -- A FRASE NOMEIA SO O QUE FALTA, e nao os portoes todos.
      --
      -- As aprovacoes desta peca fecham os portoes NA ORDEM -- e a conta que
      -- `porta_do_cliente_no_post()` faz --, entao os aprovados sao os `k`
      -- primeiros e o `offset` tira exatamente eles. Sem ele, num fluxo que
      -- valida a pauta a recusa do Programar dizia *"o cliente ainda nao
      -- aprovou Pauta, Envio"* numa peca cuja Pauta esta aprovada: uma frase
      -- que a pessoa confere, ve que esta errada, e passa a desconfiar do
      -- resto. E a decisao da 0023, que nomeia CADA etapa sem aprovacao --
      -- dizer quais e a diferenca entre uma recusa e uma instrucao, e dizer
      -- quais errado e pior que nao dizer.
      select string_agg(p.titulo, ', ' order by p.ordem) into falta
        from (select p.titulo, p.ordem
                from public.portoes_do_mes(etapa.task_id) p
               where p.ordem < etapa.ordem
               order by p.ordem
              offset public.aprovacoes_do_cliente_no_post(new.post_id)) p;

      raise exception using
        errcode = 'check_violation',
        message = format('O cliente ainda não aprovou %s neste post.', falta),
        hint    = 'Cada peça passa pelos portões dela: a etapa é do mês, a decisão é de cada post.';
    end if;

    -- TRAVA A - a corrente, neste post.
    select string_agg(s.titulo, ', ' order by s.ordem) into pendente
      from public.subtasks s
      left join public.post_etapa_progresso g
             on g.subtask_id = s.id and g.post_id = new.post_id
     where s.task_id = etapa.task_id
       and s.social_papel is not null
       and s.ordem < etapa.ordem
       and coalesce(g.concluido, false) = false;

    if pendente is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('Neste post falta %s antes desta etapa.', pendente),
        hint    = 'A corrente do mês é em ordem, post por post: cada etapa espera a anterior daquele post.';
    end if;
  end if;

  -- O CARIMBO NAO E TRAVA, e por isso fica fora dos `if travas`: ele vale para
  -- toda escrita, a do seed e a do cliente inclusive. Caixinha marcada sem
  -- data e sem autor e uma linha que nao serve para relatorio nenhum.
  if new.concluido and (tg_op = 'INSERT' or not old.concluido) then
    new.concluido_em  := now();
    new.concluido_por := coalesce(new.concluido_por, (select auth.uid()));
  elsif not new.concluido then
    new.concluido_em  := null;
    new.concluido_por := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_etapa_progresso_regras on public.post_etapa_progresso;
create trigger post_etapa_progresso_regras
  before insert or update on public.post_etapa_progresso
  for each row execute function public.post_etapa_progresso_regras();

comment on function public.post_etapa_progresso_regras() is
  'As travas da caixinha: a corrente post por post, os portoes que o cliente ja decidiu daquele post, a caixinha da entrega que nao se marca a mao, e -- desde a 0090 -- o mes andando junto, que e o padrao.';


-- ---------------------------------------------------------------------------
-- PASSO 11 - A FASE DO SOCIAL VOLTA AO CALENDARIO FULL
--
-- `create or replace view` NAO HERDA `security_invoker`, e esta e a QUINTA vez
-- que a clausula e repetida -- 0055, 0059, 0077, 0088 e aqui. Sem ela a view
-- volta a rodar com os direitos de quem a criou e le as tabelas de origem
-- inteiras para qualquer pessoa autenticada, num objeto que o PostgREST
-- publica sozinho. E o furo passa despercebido num banco com um cliente so:
-- ele ve seis campanhas, que e o total, e "seis de seis" tem a mesma cara com
-- a RLS ligada e desligada. A bateria mede com material de duas empresas.
--
-- O corpo e o da 0088 com UM `union all` a mais, no fim.
-- ---------------------------------------------------------------------------
create or replace view public.calendar_events
with (security_invoker = true) as

  -- 1. QUEM ESTA FORA, e so o que foi combinado.
  --
  -- Pedido pendente NAO entra: ele ainda pode ser remarcado, e pintar o
  -- calendario da agencia com um periodo que o socio nem respondeu faria a
  -- equipe planejar em cima de uma ausencia que talvez nao aconteca.
  --
  -- ELA PASSOU A SER A PRIMEIRA, e por isso carrega os nomes das colunas.
  select
    h.id                                   as id,
    'ausencia'::text                       as tipo,
    h.tipo::text                           as titulo,
    h.data_inicio                          as data_inicio,
    h.data_fim                             as data_fim,
    null::uuid                             as client_id,
    h.user_id                              as user_id,
    null::text                             as prioridade,
    h.status::text                         as status,
    '/painel/full-days'                    as link
  from public.hr_requests h
  where h.status = 'aprovada'

  union all

  -- 2. O QUE ACONTECE.
  select
    e.id,
    'evento',
    e.nome,
    e.data_inicio,
    e.data_fim,
    e.client_id,
    null::uuid,
    null::text,
    e.tipo::text,
    '/painel/calendario?evento=' || e.id
  from public.events e

  union all

  -- 3. O POST, no dia em que vai ao ar.
  --
  -- Post sem data nao entra -- e estado de verdade do trabalho desde a 0044,
  -- e ele vive na faixa "Sem data ainda" da tela de Social Media. Inventar um
  -- dia aqui para ele aparecer seria o calendario afirmando uma data que
  -- ninguem escolheu.
  select
    p.id,
    'post',
    p.tema,
    p.data_publicacao,
    p.data_publicacao,
    p.client_id,
    p.responsavel_id,
    null::text,
    p.status::text,
    '/painel/social-media?post=' || p.id
  from public.posts p
  where p.data_publicacao is not null

  union all

  -- 4. A CAMPANHA, com o periodo inteiro.
  --
  -- A VIEW CARREGA A VERDADE; quem decide como desenhar e a tela. Na grade do
  -- mes a campanha aparece no ENCERRAMENTO, porque uma Wave de trinta dias
  -- pintaria trinta celulas e empurraria para baixo tudo o que acontece em
  -- cada uma. Na Linha do Tempo ela e a barra longa. Os dois desenhos saem da
  -- mesma linha, e e `diaNaGrade()` em `lib/dominio/calendario.ts` que
  -- escolhe -- um lugar so.
  select
    c.id,
    'campanha',
    c.nome,
    c.data_inicio,
    c.data_fim,
    c.client_id,
    null::uuid,
    null::text,
    c.status::text,
    '/painel/aprovacoes/campanhas/' || c.id
  from public.campaigns c

  union all

  -- 5. A PECA DA CAMPANHA, no prazo dela.
  --
  -- So as FOLHAS: o grupo e uma linha na tela e quinze entregas no trabalho, e
  -- conta-lo tambem faria "16 de 16" onde ha quinze coisas.
  --
  -- ELA FICA, e a peca de campanha E uma subtarefa desde a 0051 -- o que
  -- parece contradizer a remocao das etapas e nao contradiz: o que sai e a
  -- camada que lista TODA etapa de TODA demanda da agencia, que e a pauta
  -- pessoal de cada um. O entregavel e a PECA que o cliente vai decidir, com
  -- data combinada na campanha, e e por isso que ele tem camada propria desde
  -- a 0055 em vez de vir pela de etapa.
  select
    d.id,
    'entregavel',
    d.nome,
    d.prazo,
    d.prazo,
    c.client_id,
    d.responsavel_id,
    null::text,
    d.status::text,
    '/painel/aprovacoes/campanhas/' || d.campaign_id || '?item=' || d.id
  from public.deliverables d
  join public.campaigns c on c.id = d.campaign_id
  where d.prazo is not null
    and not exists (
      select 1 from public.deliverables f where f.parent_id = d.id
    )
  union all

  -- 6. A FASE DO MES DE SOCIAL, no prazo dela (0090).
  --
  -- ELA VOLTA, e o registro da ida e da volta fica porque a decisao foi do
  -- usuario nas duas vezes. Ela entrou na 0059 como etapa de POST -- uma linha
  -- por peca, dezoito por mes --, saiu na 0088 com a frase *"a corrente do
  -- social vive so em minhas tasks e na carga"*, e volta agora como a fase do
  -- MES: CINCO pontos por mes, nao dezoito.
  --
  -- E a diferenca e o que torna a volta barata. O que saiu na 0088 era a
  -- camada que punha no calendario da agencia uma linha por peca por fase; o
  -- que entra e uma linha por FASE, que e o trabalho de uma pessoa num dia --
  -- exatamente o que o calendario responde. A conta que a 0077 fez contra a
  -- etapa de demanda ("a linha caia no mesmo dia que outra, dizendo o mesmo
  -- fato") nao se aplica: a fase nao coincide com nada.
  --
  -- SO O FIM, como o post e o entregavel: a fase tem periodo desde a 0088
  -- (ela e uma subtarefa), e pintar as duas pontas de cinco fases poria dez
  -- linhas por mes de uma conta so. E a decisao da 0027 -- comecar tarde nao e
  -- atrasar; entregar tarde e.
  --
  -- E O RASCUNHO FICA FORA. O mes nasce publicado (0088), entao o filtro quase
  -- nunca recusa nada -- e ele existe porque a regra vale em toda parte: uma
  -- demanda rascunhada e um pensamento pela metade, e a RLS restritiva da 0028
  -- esconde a dos outros enquanto a consulta esconde a minha.
  select
    s.id,
    'fase_de_social',
    s.titulo,
    s.prazo,
    s.prazo,
    t.client_id,
    s.responsavel_id,
    null::text,
    s.status::text,
    '/painel/social-media?mes=' || t.id
  from public.subtasks s
  join public.tasks t on t.id = s.task_id
  where s.social_papel is not null
    and s.prazo is not null
    and t.publicada_em is not null;

comment on view public.calendar_events is
  'As SEIS origens do Calendário Full num formato só: ausência, evento, post, '
  'campanha, entregável e a fase do mês de social. A demanda e a etapa saíram '
  'na 0077; a etapa de POST saiu na 0088 e a FASE do mês entrou na 0090, e as '
  'duas coisas não são a mesma — uma era uma linha por peça, a outra é cinco '
  'por mês. security_invoker = true: a RLS de cada tabela de origem continua valendo.';


-- ---------------------------------------------------------------------------
-- PASSO 12 - O MES CONCLUIDO SE ARQUIVA DEPOIS DE 90 DIAS
--
-- O sprint pede *"arquivado é manual, e automático após 90 dias de
-- concluído"*. "Depois de concluido" precisa de uma data de conclusao.
--
-- `tasks.concluida_em` JA EXISTIA, desde a 0004, e isto so se descobre
-- olhando: o `add column if not exists` abaixo e um no-op, e esta nota esta
-- aqui porque a primeira versao deste cabecalho afirmava que a coluna era
-- nova. Afirmar uma propriedade sem conferi-la e o que faz quem vier depois
-- ler como verdade -- a licao que a 0079 registrou sobre a pilha de avatares.
--
-- E `recalcular_status_task()` (0025) JA A ESCREVE, pelo caminho CALCULADO:
--   `concluida_em = case when novo = 'concluido' then coalesce(concluida_em, now()) end`
-- -- e o `case` sem `else` da nulo nos outros status, entao ela ja nasce e se
-- limpa sozinha quando o status vem das folhas.
--
-- O QUE FALTAVA E O CAMINHO MANUAL. Aquela funcao e gatilho em `subtasks` e em
-- `approval_rounds`: ela dispara quando uma ETAPA muda. Marcar a demanda como
-- `concluido` a mao -- que os sete status permitem desde a 0025 -- nao passa
-- por ela, e o mes ficava concluido sem data de conclusao. A rotina de
-- arquivamento nunca o alcancaria, e o sintoma seria "o arquivamento
-- automatico nao funciona" sem nada para investigar.
--
-- O GATILHO NOVO NAO BRIGA COM O ANTIGO, e as duas regras coincidem de
-- proposito: `coalesce(new.concluida_em, now())` ao entrar e nulo ao sair sao
-- exatamente o que o `case` da 0025 faz, entao a escrita que vem do recalculo
-- passa por este gatilho e sai com o mesmo valor.
--
-- AS DUAS SAIDAS SEM CARIMBO FORAM RECUSADAS, e vale dizer por que:
-- `updated_at` e reescrito por qualquer edicao, entao um mes corrigido ontem
-- nunca arquivaria; e `social_do_mes + 90 dias` arquivaria na hora um mes de
-- julho que a agencia fechou em novembro. A primeira erra sempre para o lado
-- seguro e a segunda para o lado errado, e as duas respondem outra pergunta.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists concluida_em timestamptz;

comment on column public.tasks.concluida_em is
  'Quando esta demanda entrou em `concluido`. Existe desde a 0004 e e escrita por `recalcular_status_task()` (0025) no caminho calculado; desde a 0090 um gatilho em `tasks` fecha o caminho MANUAL, que nao passava por aquela funcao. E a data que a rotina de arquivamento do social conta.';

create index if not exists tasks_social_arquivar_idx
  on public.tasks (concluida_em)
  where social_do_mes is not null and arquivada_em is null;

create or replace function public.tasks_carimba_conclusao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    new.concluida_em := coalesce(new.concluida_em, now());
  elsif new.status <> 'concluido' then
    -- LIMPA AO SAIR, e nao mantem o carimbo antigo: o status da Task e
    -- calculado pelas folhas (0007), entao uma etapa reaberta devolve a
    -- demanda para `em_andamento` -- e um carimbo de conclusao numa demanda
    -- que voltou a andar faria a rotina arquivar trabalho em producao.
    new.concluida_em := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_carimba_conclusao on public.tasks;
create trigger tasks_carimba_conclusao
  before insert or update of status on public.tasks
  for each row execute function public.tasks_carimba_conclusao();

comment on function public.tasks_carimba_conclusao() is
  'Carimba `tasks.concluida_em` quando a demanda entra em `concluido`, e limpa quando ela sai (0090).';

-- A migration carimba o que ja esta concluido, senao a rotina nunca alcanca
-- nenhum mes anterior a ela -- `concluida_em` nasceria nulo em todos, e um
-- carimbo que so vale para o futuro faz a regra parecer quebrada por meses.
-- `updated_at` e a melhor aproximacao que existe para o passado, e o que ela
-- erra e para o lado seguro: arquiva mais tarde, nunca mais cedo.
update public.tasks
   set concluida_em = updated_at
 where status = 'concluido' and concluida_em is null;

-- ---------------------------------------------------------------------------
-- A ROTINA
--
-- `security definer` porque ela roda de madrugada, sem sessao, e precisa
-- escrever em `tasks` -- e com `revoke` de `public` e de `authenticated`, que
-- e a licao da 0071: o Postgres concede `execute` a `public` por padrao em
-- toda funcao nova, e o PostgREST publica o schema `public` sozinho. Sem o
-- revoke, um POST em `/rest/v1/rpc/arquivar_meses_de_social` com a chave anon
-- -- que vai no bundle que o navegador baixa -- arquivaria o social da agencia
-- inteira sem sessao nenhuma.
-- ---------------------------------------------------------------------------
create or replace function public.arquivar_meses_de_social(p_dias integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos integer;
begin
  update public.tasks t
     set arquivada_em = now()
   where t.social_do_mes is not null
     and t.arquivada_em is null
     and t.status = 'concluido'
     and t.concluida_em is not null
     and t.concluida_em < now() - make_interval(days => greatest(coalesce(p_dias, 90), 1));

  get diagnostics quantos = row_count;
  return quantos;
end;
$$;

comment on function public.arquivar_meses_de_social(integer) is
  'Arquiva os meses de social concluidos ha mais de N dias, 90 por padrao (0090). Chamada pela rotina diaria; arquivar a mao continua valendo e nao passa por aqui.';

revoke all on function public.arquivar_meses_de_social(integer) from public;
revoke all on function public.arquivar_meses_de_social(integer) from anon;
revoke all on function public.arquivar_meses_de_social(integer) from authenticated;
grant execute on function public.arquivar_meses_de_social(integer) to service_role;


-- ---------------------------------------------------------------------------
-- PASSO 13 - OS PRIVILEGIOS DO QUE NASCEU AQUI
--
-- `proxima_rodada_do_cliente` e `post_tem_aval_interno` sao `security
-- definer` e leem `approval_rounds` e `posts` inteiras -- elas respondem um
-- NUMERO e um BOOLEANO sobre um post, que e o recorte, e e por isso que elas
-- podem ser chamadas por quem esta logado. O que nao pode sair da mao de
-- ninguem sao as tres que devolvem dado de peca -- `portao_atual_do_mes`,
-- `posts_elegiveis_do_portao` e `o_que_falta_no_portao` --, e as tres tem
-- `is_staff()` escrito no corpo. `grant` nao substitui a guarda: `authenticated`
-- inclui o CLIENTE.
-- ---------------------------------------------------------------------------
revoke all on function public.o_que_falta_no_portao(uuid, uuid) from public;
revoke all on function public.o_que_falta_no_portao(uuid, uuid) from anon;
grant execute on function public.o_que_falta_no_portao(uuid, uuid) to authenticated;

revoke all on function public.posts_elegiveis_do_portao(uuid, uuid) from public;
revoke all on function public.posts_elegiveis_do_portao(uuid, uuid) from anon;
grant execute on function public.posts_elegiveis_do_portao(uuid, uuid) to authenticated;

revoke all on function public.portao_atual_do_mes(uuid) from public;
revoke all on function public.portao_atual_do_mes(uuid) from anon;
grant execute on function public.portao_atual_do_mes(uuid) to authenticated;

grant select, insert, update on public.social_lotes to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 14 - CONFERENCIA
--
-- Cole no SQL Editor depois de aplicar. As quatro linhas sao as que separam
-- "a migration passou" de "a migration fez o que diz".
-- ---------------------------------------------------------------------------
-- select count(*) as deve_ser_6 from information_schema.columns
--  where table_name = 'social_lotes';
--
-- select count(*) as deve_ser_1 from information_schema.columns
--  where table_name = 'social_flow_steps' and column_name = 'aprovacao_interna';
--
-- -- a fase voltou ao calendario, e a clausula de seguranca ficou
-- select count(*) filter (where tipo = 'fase_de_social') as fases
--   from public.calendar_events;
-- select reloptions from pg_class where relname = 'calendar_events';
--   -- tem de conter security_invoker=true
--
-- -- e o aval interno nasceu ligado em todo elo que ja existia
-- select count(*) filter (where aprovacao_interna) as ligados, count(*) as total
--   from public.social_flow_steps;
