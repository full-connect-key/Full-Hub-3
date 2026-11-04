-- =============================================================================
-- 0128 — O RESPONSÁVEL PELA APROVAÇÃO DO CLIENTE
-- =============================================================================
--
-- Decisão do usuário, item 14: *"Responsável obrigatório pela aprovação do
-- cliente — modal com Cliente (auto), Responsável (obrigatório), Mensagem
-- (opcional); só usuários ativos; impedir envio sem responsável; registrar
-- quem enviou/recebeu/quando; notificar; exibir pendência. Responsável de
-- produção e de aprovação armazenados separados."*
--
-- -----------------------------------------------------------------------------
-- METADE DO PEDIDO JÁ EXISTIA, e medir antes de escrever é o que separou o que
-- precisava de coluna do que só precisava ser nomeado — a lição da 0060:
--
--   | o pedido                | onde já estava                              |
--   | ----------------------- | ------------------------------------------- |
--   | quem ENVIOU             | `approval_rounds.solicitado_por`, not null   |
--   | QUANDO                  | `approval_rounds.solicitado_em`, default now |
--   | de que empresa é a peça | `cliente_da_rodada()` (0064), os três tipos  |
--   | notificar               | `notificar()` (0011), com as três recusas    |
--   | quem RECEBEU            | **não existia**                              |
--   | a mensagem do envio     | **metade** — só o lote do mês (0090)         |
--
-- -----------------------------------------------------------------------------
-- A MEDIÇÃO QUE DECIDE ESTA MIGRATION: DAS 28 CONTAS, UMA TEM PORTAL.
--
-- `select count(cu.user_id) from clients c left join client_users cu ...`
-- devolve 1 para a ABF Expo e **0 para as outras 27**. E `my_client_ids()` sai
-- de `client_users`: uma conta sem vínculo é uma conta em que NENHUMA pessoa
-- consegue abrir o portal.
--
-- Quer dizer que enviar material para 27 das 28 contas hoje **envia para
-- ninguém** — a peça entra num portal que não tem quem o abra, e nada na tela
-- diz isso. Então exigir um destinatário nomeado não CRIA um problema: ele
-- revela um que já existe em 27 contas, e é por isso que a recusa de conta sem
-- acesso nomeia a empresa e diz onde se dá o acesso (0023).
--
-- **E É POR ISSO QUE A TRAVA É SATISFAZÍVEL, ao contrário da 0118.** Lá a
-- exigência de vertente ficou como AVISO porque três caminhos inserem task já
-- publicada sem passar por tela nenhuma — a campanha, o mês de social e a
-- rotina das três da manhã —, e ligá-la pararia a geração em silêncio. Aqui os
-- quatro caminhos que abrem rodada de cliente são ações humanas de ENVIO, cada
-- uma com tela: as quatro podem informar quem recebe.
--
-- -----------------------------------------------------------------------------
-- É TRIGGER E NÃO `not null`, QUE É A DECISÃO DA 0015.
--
-- Há **18 rodadas de cliente** no banco (5 pendentes, 13 aprovadas), e nenhuma
-- tem aprovador. `not null` quebraria a migration em qualquer ambiente com uma
-- delas, e preencher as antigas com um nome qualquer seria pior: inventaria um
-- destinatário, e o histórico passaria a afirmar que alguém recebeu. Então a
-- coluna aceita nulo, o trigger exige **na abertura**, e as 18 ficam dizendo
-- "ninguém nomeado", que é a verdade.
--
-- **E não há `check` ao lado, pela 0060.** O da 0127 existe porque
-- `proteger_rodada_fechada` é `before update` e não tem como pegar o `insert`;
-- aqui `validar_nova_rodada` É `before insert`, então um check diria a mesma
-- coisa que ele — e recusaria as 18 que já existem.
--
-- -----------------------------------------------------------------------------
-- NOMEAR NÃO É TRANCAR, e esta é a linha que mais importa.
--
-- `decidir_rodada_do_cliente` NÃO ganhou pergunta nenhuma: quem decide continua
-- sendo qualquer pessoa da empresa, que é a regra escrita do produto —
-- *"múltiplos usuários por empresa têm o MESMO acesso; não há hierarquia do
-- lado do cliente: os dois aprovam, os dois comentam"*. O aprovador é quem a
-- agência NOMEIA e AVISA, não uma tranca sobre quem pode responder — travar a
-- decisão deixaria o material parado no dia em que a pessoa nomeada estivesse
-- de férias, e o caminho de volta seria o WhatsApp.
--
-- -----------------------------------------------------------------------------
-- A MENSAGEM NÃO É `comentario`, e a separação é deliberada.
--
-- `approval_rounds.comentario` é o motivo da DECISÃO, e a 0127 acabou de
-- torná-lo obrigatório nos dois desfechos negativos. Reusá-lo para o recado do
-- envio poria dois fatos na mesma coluna — e o check da 0127 passaria a cobrar
-- o recado de quem recusa. `mensagem` é coluna própria.
--
-- **E ela fica NULA nas rodadas de lote**, onde a mensagem do envio é
-- `social_lotes.recado` (0090): uma cópia por peça seriam dezoito lugares para
-- a mesma frase divergir, que é a razão escrita daquela coluna. Quem responde
-- "qual foi a mensagem deste envio" é um lugar só, do lado da tela.
--
-- -----------------------------------------------------------------------------
-- PASSOS
--   1. as duas colunas
--   2. `aprovadores_da_conta()` — quem pode aprovar pela conta
--   3. a trava, em `validar_nova_rodada` (função copiada INTEIRA)
--   4. `enviar_mes_ao_cliente` recebe o aprovador  (drop + create)
--   5. conferência
-- =============================================================================


-- =============================================================================
-- PASSO 1 — AS DUAS COLUNAS
-- =============================================================================

alter table public.approval_rounds
  add column if not exists aprovador_id uuid references public.profiles(id);

alter table public.approval_rounds
  add column if not exists mensagem text;

-- A CHAVE ESTRANGEIRA É SEM AÇÃO, como `solicitado_por` e `decidido_por`
-- (0007). Não é `on delete set null` de propósito: rodada fechada nunca é
-- reescrita neste produto, e apagar o perfil não pode apagar o registro de que
-- aquela pessoa recebeu o material. Ninguém com histórico é apagado aqui — o
-- caminho é desativar —, então a ação quase nunca dispara; quando disparar, o
-- certo é recusar.

comment on column public.approval_rounds.aprovador_id is
  'QUEM RECEBEU (0128). A pessoa do lado do CLIENTE que a agência nomeou ao '
  'enviar, e para quem o aviso foi. Nulo nas 18 rodadas anteriores à migration '
  'e em toda rodada de escopo interna. Não é tranca: quem DECIDE continua '
  'sendo qualquer pessoa da empresa. É separado do responsável de PRODUÇÃO '
  '(`subtasks.responsavel_id`, `posts.responsavel_id`, '
  '`deliverables.responsavel_id`), que é quem faz — e não quem aprova.';

comment on column public.approval_rounds.mensagem is
  'A mensagem da agência que viajou com ESTE envio (0128). Opcional. NÃO é '
  '`comentario`, que é o motivo da decisão e que a 0127 tornou obrigatório nos '
  'desfechos negativos. Fica nula na rodada que veio de um lote: ali a '
  'mensagem do envio é `social_lotes.recado`, uma por envio e não uma por peça.';

create index if not exists approval_rounds_aprovador_pendente_idx
  on public.approval_rounds (aprovador_id)
  where status = 'pendente';

-- O ÍNDICE É PARCIAL, que é a forma da 0123: quem o usa é a pergunta *"o que
-- está esperando esta pessoa?"*, e ela procura só o que está pendente. Um
-- índice cheio teria o tamanho da tabela para responder a minoria.


-- =============================================================================
-- PASSO 2 — QUEM PODE APROVAR PELA CONTA
-- =============================================================================
--
-- UMA DEFINIÇÃO, DOIS LEITORES: o gatilho do PASSO 3 confere a pertinência, e
-- o modal de envio lista os nomes. Duas consultas com o mesmo `where` seriam o
-- lugar onde a lista da tela e a trava do banco começam a divergir — e a que
-- divergiria é a do banco, porque ninguém a relê ao mexer no seletor. É
-- `ICONE_DA_AREA`, que tinha três cópias e duas já divergidas.
--
-- **`profiles.ativo` é o "só usuários ativos" do pedido**, e é a mesma pergunta
-- que `quem_atende()` (0103) faz do outro lado da porta: quem ESTÁ na conta.
-- Pessoa desativada continua no histórico das rodadas que recebeu e sai do
-- seletor — a decisão de `pessoa_desligada()` na 0041.
--
-- **`security definer` porque o colaborador do Atendimento envia o mês** desde
-- a 0090, e `profiles_select` é `own or is_gestor()`: sem ela, o modal dele
-- abriria com a lista vazia e a tela afirmaria que a conta não tem ninguém.
--
-- **E a guarda é `is_staff()`**, que é o que a separa de `quem_atende()`: aquela
-- devolve uuid e nada mais, e esta devolve NOME E E-MAIL — sem a guarda, quem
-- tivesse a chave anon leria os contatos do portal de qualquer empresa passando
-- o uuid dela. A guarda é segura para o gatilho porque toda inserção de rodada
-- de cliente já passa por `is_gestor()` ou `is_atendimento()` logo acima dela,
-- e porque o seed abre sessão antes de inserir (`request.jwt.claim.sub`).
-- =============================================================================

create or replace function public.aprovadores_da_conta(p_client_id uuid)
returns table (user_id uuid, nome text, email text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Só a equipe lê quem aprova pela conta.';
  end if;

  return query
    select p.id, p.nome, p.email
      from public.client_users cu
      join public.profiles p on p.id = cu.user_id
     where cu.client_id = p_client_id
       and p.ativo
     order by p.nome;
end;
$fn$;

revoke all on function public.aprovadores_da_conta(uuid) from public;
revoke all on function public.aprovadores_da_conta(uuid) from anon;
grant execute on function public.aprovadores_da_conta(uuid) to authenticated;

comment on function public.aprovadores_da_conta(uuid) is
  'Quem pode aprovar pela conta: as pessoas ATIVAS com acesso ao portal dela '
  '(0128). Definição única — o gatilho `validar_nova_rodada` confere a '
  'pertinência e o modal de envio lista os nomes.';


-- =============================================================================
-- PASSO 3 — A TRAVA
-- =============================================================================
--
-- A FUNÇÃO É COPIADA INTEIRA, e não remendada. `create or replace function` se
-- reescreve a partir do texto que se escreve AGORA e **não avisa quando o texto
-- novo tem menos coisa que o velho** — a lição da 0030, que perdeu um bloco de
-- carimbos assim e só apareceu na 0052. Esta tem duzentas linhas e quatro
-- ramos; o que a 0128 acrescenta é UM bloco, marcado abaixo.
--
-- **E ELE VEM ANTES DOS TRÊS RAMOS, e não dentro de cada um.** A pergunta é a
-- mesma para subtask, post e deliverable — quem recebe esta peça —, e
-- `cliente_da_rodada()` já responde pelos três desde a 0064. Três cópias seriam
-- três lugares para divergir, e a que divergiria é a do deliverable, que é o
-- caminho menos percorrido.
--
-- **A ORDEM DAS TRÊS RECUSAS FOI ESCOLHIDA, e é a lição da 0088:** "a conta não
-- tem ninguém" vem ANTES de "escolha quem vai aprovar", senão a pessoa lê um
-- pedido para escolher numa lista vazia — uma recusa que ela não tem como
-- satisfazer, que é o que a 0076 recusou no portão do meio.
-- =============================================================================

create or replace function public.validar_nova_rodada()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  alvo  uuid := public.subtask_da_rodada(new.content_type, new.content_id);
  post  uuid := public.post_da_rodada(new.content_type, new.content_id);
  entr  uuid := public.entregavel_da_rodada(new.content_type, new.content_id);
  dono  uuid;
  exige boolean;
  porta public.subtasks;
  conta uuid;
  empresa text;
  quantos integer;
begin
  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Os tipos com regra hoje são subtask, post e deliverable.';
  end if;

  -- ========================================================== QUEM RECEBE (0128)
  -- O ÚNICO BLOCO QUE A 0128 ACRESCENTA A ESTA FUNÇÃO.
  if new.escopo = 'cliente' then
    conta := public.cliente_da_rodada(new.content_type, new.content_id);

    if conta is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Este material não está no nome de nenhuma empresa.',
        hint    = 'Escolha o cliente da demanda antes de enviar.';
    end if;

    select c.nome_empresa into empresa from public.clients c where c.id = conta;

    select count(*)::integer into quantos
      from public.aprovadores_da_conta(conta);

    -- 1. A CONTA NÃO TEM NINGUÉM. Em 27 das 28 contas deste banco é este o
    --    caso, e a recusa diz o que fazer: material enviado para uma conta sem
    --    acesso não chega a pessoa nenhuma.
    if quantos = 0 then
      raise exception using
        errcode = 'check_violation',
        message = format('A %s ainda não tem ninguém com acesso ao portal.', coalesce(empresa, 'empresa')),
        hint    = 'Material enviado para uma conta sem acesso não chega a pessoa nenhuma: ninguém consegue abrir o portal dela. Dê acesso em Gestão de Pessoas › Clientes e envie em seguida.';
    end if;

    -- 2. NINGUÉM FOI NOMEADO.
    if new.aprovador_id is null then
      raise exception using
        errcode = 'check_violation',
        message = 'Escolha quem vai aprovar este material.',
        hint    = 'O envio registra quem recebeu, e o aviso vai para essa pessoa. Qualquer pessoa da empresa continua podendo responder.';
    end if;

    -- 3. FOI NOMEADO QUEM NÃO APROVA POR ESTA CONTA.
    if not exists (
      select 1 from public.aprovadores_da_conta(conta) a
       where a.user_id = new.aprovador_id
    ) then
      raise exception using
        errcode = 'check_violation',
        message = format('Quem você escolheu não aprova pela %s.', coalesce(empresa, 'empresa')),
        hint    = 'O responsável tem de ser uma pessoa ativa com acesso ao portal desta conta.';
    end if;
  end if;
  -- ===========================================================================

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
      -- NOMEIA as pecas que faltam e `o_que_falta_no_portao()`, chamada por
      -- `enviar_mes_ao_cliente()` antes de inserir qualquer rodada: a recusa
      -- que a pessoa le diz quais sao as seis, e esta aqui e o piso para quem
      -- montar o insert a mao.
      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.data_publicacao is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post ainda não tem data de publicação.',
          hint    = 'Escolha o dia antes de enviar: o cliente decide sobre o material e sobre quando ele vai ao ar.';
      end if;

      -- A UNICA LINHA QUE A 0120 MUDA NESTA FUNCAO. Ela perguntava so pelo
      -- `video_url`; hoje pergunta a `post_tem_video()`, que aceita as duas
      -- formas -- o arquivo no bucket e o link de fora. A frase da recusa
      -- passou a nomear as duas saidas, pela decisao da 0023: dizer "ainda
      -- nao tem o link" sobre um post cujo video a pessoa acabou de SUBIR
      -- manda ela procurar um campo que ela nao precisa preencher.
      if coalesce(porta.social_papel, 'entrega') = 'entrega' and exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
      ) and not public.post_tem_video(post) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o vídeo.',
          hint    = 'Suba o arquivo, ou cole o endereço do Drive ou do YouTube.';
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
$fn$;


-- =============================================================================
-- PASSO 4 — O LOTE DO MÊS RECEBE O APROVADOR
-- =============================================================================
--
-- `drop` + `create` E NÃO `create or replace`, porque a LISTA DE ARGUMENTOS
-- muda: `create or replace` não troca a assinatura — ele cria uma SEGUNDA
-- função ao lado, e a chamada antiga vira ambígua. É a lição da 0061, que
-- custou um *"Could not find the function"* ao usuário.
--
-- **O parâmetro tem DEFAULT, e é ele que fecha a janela da 0120.** O PostgREST
-- resolve função por nome mais os nomes dos argumentos informados, então a
-- chamada de três argumentos que a tela no ar faz continua resolvendo para a
-- função de quatro. O que ela passa a levar é a recusa do PASSO 3, que é a
-- trava fazendo o trabalho dela — com a frase dizendo o que falta.
--
-- **A FUNÇÃO É COPIADA INTEIRA**, pela razão do PASSO 3: o que a 0128 muda são
-- duas linhas — o `aprovador_id` de cada rodada e a quem o aviso vai —, e tudo
-- o mais fica palavra por palavra.
--
-- -----------------------------------------------------------------------------
-- O AVISO PASSA A SER DO APROVADOR, e isso é mudança de comportamento.
--
-- Ele percorria `client_users` e tocava o sino de TODA pessoa da empresa. Com
-- um responsável nomeado, o aviso que COBRA vai para ele: se todos continuam
-- sendo cobrados, nomear um não decide nada — que é o pior tipo de campo (0023).
-- Os outros continuam VENDO a peça no portal, porque não há hierarquia do lado
-- do cliente; o que eles deixam de receber é a cobrança.
--
-- **Medido: hoje isto não muda nada.** A única conta com acesso ao portal tem
-- exatamente uma pessoa, então o conjunto "todos" e o conjunto "o aprovador"
-- são o mesmo.
-- =============================================================================

drop function if exists public.enviar_mes_ao_cliente(uuid, uuid, text);

create or replace function public.enviar_mes_ao_cliente(
  p_task_id   uuid,
  p_etapa_id  uuid,
  p_recado    text default null,
  p_aprovador uuid default null
)
returns jsonb
language plpgsql
set search_path = public
as $fn$
declare
  etapa    public.subtasks;
  demanda  public.tasks;
  lote     uuid;
  numero   integer;
  pecas    integer := 0;
  peca     public.posts;
  faltam   text;
  quantas  integer;
  quantos  integer;
  empresa  text;
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

  -- O APROVADOR É CONFERIDO AQUI TAMBÉM, e a razão é a mesma do parágrafo
  -- acima: `validar_nova_rodada` é por LINHA, então sem esta pergunta a
  -- recusa sairia depois do insert do lote e falaria de uma peça só. Aqui ela
  -- sai antes de gravar qualquer coisa, e a frase é a mesma do PASSO 3 — a
  -- lição da 0089, onde a frase da recusa é a mesma nos dois lados.
  -- E A CONTA SEM NINGUÉM NO PORTAL VEM ANTES DA ESCOLHA, pela razão que o
  -- PASSO 3 escreve e que a 0076 pagou: "escolha quem aprova" numa conta onde
  -- não há ninguém para escolher é uma recusa que a pessoa não tem como
  -- satisfazer, e o portão ficaria fechado para sempre. A primeira versão
  -- desta função perguntava na ordem inversa, e um mês de uma conta sem acesso
  -- levava exatamente aquela recusa.
  select count(*)::integer into quantos
    from public.aprovadores_da_conta(demanda.client_id);

  select c.nome_empresa into empresa
    from public.clients c where c.id = demanda.client_id;

  if quantos = 0 then
    raise exception using
      errcode = 'check_violation',
      message = format('A %s ainda não tem ninguém com acesso ao portal.',
                       coalesce(empresa, 'empresa')),
      hint    = 'Material enviado para uma conta sem acesso não chega a pessoa nenhuma: ninguém consegue abrir o portal dela. Dê acesso em Gestão de Pessoas › Clientes e envie em seguida.';
  end if;

  if p_aprovador is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha quem vai aprovar este mês.',
      hint    = 'O envio registra quem recebeu, e o aviso vai para essa pessoa. Qualquer pessoa da empresa continua podendo responder.';
  end if;

  if not exists (
    select 1 from public.aprovadores_da_conta(demanda.client_id) a
     where a.user_id = p_aprovador
  ) then
    raise exception using
      errcode = 'check_violation',
      message = format('Quem você escolheu não aprova pela %s.',
                       coalesce(empresa, 'empresa')),
      hint    = 'O responsável tem de ser uma pessoa ativa com acesso ao portal desta conta.';
  end if;

  -- O NUMERO DO LOTE E A RODADA DAQUELE PORTAO. Ele nao e o
  -- `numero_rodada` das rodadas de aprovacao: aquele e a sequencia de cada
  -- post, e o cabecalho da 0090 explica por que os dois nao podem ser o mesmo
  -- numero.
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
    --
    -- `mensagem` FICA NULA: a mensagem deste envio é `social_lotes.recado`,
    -- uma por envio e não uma por peça (0090).
    insert into public.approval_rounds (
      content_type, content_id, numero_rodada, escopo, solicitado_por, status,
      lote_id, aprovador_id
    ) values (
      'post', peca.id, public.proxima_rodada_do_cliente(peca.id),
      'cliente', (select auth.uid()), 'pendente', lote, p_aprovador
    );

    pecas := pecas + 1;
  end loop;

  -- UM AVISO, E ELE É DO APROVADOR (0128) -- nao um por peca, e nao um por
  -- pessoa da empresa. Dezoito sinos para um envio e o que ensina a ignorar o
  -- sino, e essa parte nao mudou; o que mudou e a quem o sino toca.
  --
  -- `notificar()` nunca avisa quem causou o aviso, nunca avisa quem saiu, e
  -- devolve `null` sem derrubar a escrita quando nao ha a quem avisar -- as
  -- tres recusas sao da 0062 e nao se repetem aqui.
  perform public.notificar(
    p_aprovador, 'aprovacao',
    format('%s está pronta para a sua aprovação', etapa.titulo),
    format('%s %s aguardando a sua decisão em %s.',
           pecas,
           case when pecas = 1 then 'peça' else 'peças' end,
           demanda.titulo),
    '/portal/social-media'
  );

  return jsonb_build_object(
    'lote_id',   lote,
    'portao',    etapa.titulo,
    'rodada',    numero,
    'pecas',     pecas,
    'aprovador', p_aprovador
  );
end;
$fn$;

comment on function public.enviar_mes_ao_cliente(uuid, uuid, text, uuid) is
  'Envia ao cliente, em lote, as peças elegíveis de um portão do mês (0090). '
  'Desde a 0128 o aprovador é obrigatório: ele é quem recebe e quem o sino '
  'avisa. A assinatura ganhou o quarto parâmetro com default, para a chamada '
  'de três argumentos continuar resolvendo.';


-- ESTA FUNCAO FOI APLICADA ERRADA UMA VEZ, E A LICAO E A DA 0030 AO CONTRARIO.
-- Aplicando a correcao da ordem das recusas, eu REDIGITEI o corpo dela na
-- chamada em vez de copiar deste arquivo -- e a versao redigitada inventou um
-- `join public.posts p on p.id = e.id` com `order by p.criado_em`. Aquela
-- coluna NAO EXISTE (e `created_at`), entao o lote passou a estourar em tempo
-- de execucao; e de quebra as frases das recusas, o texto do aviso e as CHAVES
-- do jsonb de retorno sairam diferentes -- e as chaves sao lidas pela action.
--
-- A 0030 diz que `create or replace` nao avisa quando o texto novo tem menos
-- coisa que o velho. Isto e a mesma armadilha pelo outro lado: ele tambem nao
-- avisa quando o texto novo tem coisa que o velho nao tinha, e plpgsql nao
-- valida o corpo na criacao -- a hora de validar e o clique de alguem.
--
-- **A REGRA E: aplicar a partir DO ARQUIVO, nunca de memoria.** A conferencia
-- que pegou foi comparar o corpo de `pg_get_functiondef()` com o do arquivo,
-- com comentario e espaco em branco normalizados; a diferenca que sobra e so a
-- etiqueta do dollar quoting, que o Postgres reescreve com o nome dele.
--
-- A ACL DELA ESTAVA ABERTA, e isto foi MEDIDO e nao suposto: a 0090 tem onze
-- `revoke` e nenhum para esta funcao, entao `public` e `anon` tinham EXECUTE
-- nela desde que ela nasceu. Nao era furo -- ela nao e `security definer`, e a
-- primeira linha do corpo e `is_gestor() or is_atendimento()`, que `anon`
-- reprova --, e era inconsistencia: as outras onze foram fechadas e esta
-- ficou. **E um `drop`+`create` a reabriria de qualquer forma**, porque o
-- `create` devolve a ACL ao padrao, que e EXECUTE para `public`.
revoke all on function public.enviar_mes_ao_cliente(uuid, uuid, text, uuid) from public;
revoke all on function public.enviar_mes_ao_cliente(uuid, uuid, text, uuid) from anon;
grant execute on function public.enviar_mes_ao_cliente(uuid, uuid, text, uuid) to authenticated;

-- =============================================================================
-- PASSO 5 — O AVISO PASSA A SER DO APROVADOR
-- =============================================================================
--
-- `approval_rounds_avisa_o_cliente` (0098) é o gatilho que avisa o cliente em
-- toda rodada de cliente que não veio de um lote — ou seja, nos TRÊS caminhos
-- de material avulso: a etapa de demanda, o post e a peça de campanha. Ele
-- percorria `client_users` e tocava o sino de TODA pessoa da empresa.
--
-- **É AQUI E NÃO NAS TRÊS ACTIONS**, pela razão da 0045 e da 0098: a rodada
-- nasce por mais de um caminho, e um aviso escrito na camada de aplicação
-- registra o que passou pela tela e perde o resto — o `update` colado no SQL
-- Editor, o PATCH montado à mão, o seed. Três cópias seriam, de quebra, três
-- lugares para divergir.
--
-- **E ELE CAI QUANDO NÃO HÁ APROVADOR, em vez de voltar a avisar todo mundo.**
-- Isso só alcança as rodadas anteriores à migration, porque o PASSO 3 recusa a
-- nova sem ele — e um `coalesce` para a lista inteira aqui seria a trava
-- oferecendo o caminho que ela acabou de fechar. `notificar()` devolve `null`
-- sem derrubar a escrita quando não há a quem avisar (0062), então a guarda é
-- economia e não trava.
--
-- A FUNÇÃO É COPIADA INTEIRA, pela razão dos passos 3 e 4.
-- =============================================================================

create or replace function public.approval_rounds_avisa_o_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  empresa uuid;
  nome    text;
  destino text;
begin
  if new.escopo <> 'cliente' or new.status <> 'pendente' then
    return null;
  end if;

  -- O envio em lote manda o aviso dele, no fim da transacao.
  if new.lote_id is not null then
    return null;
  end if;

  -- SEM APROVADOR NOMEADO NAO HA A QUEM AVISAR (0128). So alcanca as rodadas
  -- anteriores a migration: a nova e recusada sem ele.
  if new.aprovador_id is null then
    return null;
  end if;

  empresa := public.cliente_da_rodada(new.content_type::text, new.content_id);
  if empresa is null then
    return null;
  end if;

  -- O NOME DO MATERIAL E O DESTINO SAEM DO TIPO, e sao a unica coisa que
  -- diverge entre os tres. Um aviso que diz so "um material chegou" obriga a
  -- pessoa a abrir para descobrir o que e -- e um que leva a listagem errada
  -- e pior que um que nao leva a lugar nenhum.
  if new.content_type::text = 'post' then
    select p.tema into nome from public.posts p where p.id = new.content_id;
    destino := '/portal/social-media';
  elsif new.content_type::text = 'deliverable' then
    select d.nome into nome from public.deliverables d where d.id = new.content_id;
    destino := '/portal/campanhas';
  else
    select s.titulo into nome from public.subtasks s where s.id = new.content_id;
    destino := '/portal/itens';
  end if;

  -- UM AVISO, E ELE E DO APROVADOR (0128). Os outros continuam VENDO a peca no
  -- portal -- nao ha hierarquia do lado do cliente --; o que eles deixam de
  -- receber e a cobranca. Se todos continuam sendo cobrados, nomear um nao
  -- decide nada, que e o pior tipo de campo (0023).
  perform public.notificar(
    new.aprovador_id, 'aprovacao',
    format('%s está esperando a sua aprovação', coalesce(nome, 'Um material')),
    coalesce(
      nullif(btrim(coalesce(new.mensagem, '')), ''),
      'A Full enviou e está aguardando a sua decisão.'
    ),
    destino
  );

  return null;
end;
$fn$;


-- =============================================================================
-- PASSO 6 — CONFERÊNCIA
-- =============================================================================

do $$
declare
  n_colunas integer;
  n_trava   integer;
  n_lote    integer;
  n_aviso   integer;
begin
  select count(*)::integer into n_colunas
    from information_schema.columns
   where table_schema = 'public' and table_name = 'approval_rounds'
     and column_name in ('aprovador_id', 'mensagem');

  select count(*)::integer into n_trava
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'validar_nova_rodada'
     and position('aprovadores_da_conta' in pg_get_functiondef(p.oid)) > 0;

  select count(*)::integer into n_lote
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'enviar_mes_ao_cliente'
     and p.pronargs = 4;

  select count(*)::integer into n_aviso
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'approval_rounds_avisa_o_cliente'
     and position('new.aprovador_id' in pg_get_functiondef(p.oid)) > 0;

  raise notice '0128: colunas novas = % de 2', n_colunas;
  raise notice '0128: validar_nova_rodada confere o aprovador = %', n_trava = 1;
  raise notice '0128: enviar_mes_ao_cliente com 4 parametros = %', n_lote = 1;
  raise notice '0128: o aviso e do aprovador = %', n_aviso = 1;

  if n_colunas <> 2 or n_trava <> 1 or n_lote <> 1 or n_aviso <> 1 then
    raise exception '0128 nao ficou inteira: colunas=%, trava=%, lote=%, aviso=%',
      n_colunas, n_trava, n_lote, n_aviso;
  end if;
end $$;

-- E AS 18 RODADAS QUE JA EXISTEM ficam com `aprovador_id` nulo, que e a
-- verdade: ninguem foi nomeado nelas. A tela diz isso em vez de inventar um
-- nome, que e a decisao da 0015 -- preencher as antigas com um valor qualquer
-- seria pior, porque alguem leria aquele nome como quem recebeu.
