-- ---------------------------------------------------------------------------
-- 0068 - AS SOLICITACOES DO CLIENTE
--
-- Sprint 3E. O cliente pede um trabalho pelo Portal, com anexo e com um
-- roteiro de briefing; o Atendimento le, conversa e converte em demanda num
-- clique.
--
-- ---------------------------------------------------------------------------
-- O QUE ISTO RESOLVE E UM CAMINHO QUE HOJE NAO EXISTE NO PRODUTO.
--
-- O Portal e de mao unica desde o Sprint 12: a agencia envia, o cliente
-- aprova, pede ajustes ou recusa. Nada do que ele escreve ali ABRE trabalho --
-- o comentario de um material vive dentro daquele material, e um pedido novo
-- chega por WhatsApp, some no fim do dia e vira "voce chegou a ver o que eu
-- mandei?". A demanda so nasce quando alguem do Atendimento a digita.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- A CONVERSAO NUNCA E AUTOMATICA, E E A PRIMEIRA REGRA DO SPRINT.
--
-- Um pedido do cliente nao e uma demanda. Ele chega sem prazo combinado, sem
-- responsavel, sem prioridade e as vezes sem ser um trabalho -- e sao
-- exatamente essas quatro coisas que o Atendimento decide. Uma rotina que
-- criasse a task sozinha poria no board da agencia trabalho que ninguem
-- aceitou, e o board e o lugar onde a equipe confia que tudo tem dono.
--
-- Por isso NAO HA TRIGGER que crie task a partir de solicitacao. Quem cria e
-- `converterSolicitacaoEmDemanda`, num clique, e o que ela abre e um RASCUNHO
-- -- a mesma tela de detalhe da 0028, com os campos preenchidos e ninguem
-- avisado ainda. **E o status da solicitacao so anda quando a demanda e
-- PUBLICADA**, que e o instante em que ela passa a existir para a equipe.
-- Andar na criacao do rascunho diria ao cliente "estamos fazendo" sobre um
-- rascunho que pode ser abandonado.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- O PRAZO DESEJADO NAO E COMPROMISSO, e a coluna diz isso no nome.
--
-- `data_desejada` e o que o cliente gostaria; `tasks.data_fim` e o que a
-- agencia assume. Copiar um no outro na conversao transformaria um desejo em
-- contrato sem ninguem ter concordado -- e a tela do portal escreve isso em
-- uma frase embaixo do campo, porque quem digita a data precisa saber o que
-- ela significa antes de digitar.
--
-- E O CLIENTE NAO ESCOLHE prioridade, responsavel nem prazo real. As tres
-- colunas nao existem nesta tabela, o que e mais forte que nao mostra-las na
-- tela: o campo que nao existe nao volta no dia em que alguem copiar o
-- formulario.
-- ---------------------------------------------------------------------------
--
-- Migration idempotente, como todas.


-- ---------------------------------------------------------------------------
-- PASSO 1 - O status da solicitacao
--
-- E UM QUARTO VOCABULARIO, e a razao e a mesma que mantem os tres que ja
-- existem separados (`task_status`, `subtask_status`, `content_status`): esta
-- tabela responde a outra pergunta -- "em que pe esta o meu PEDIDO?" -- e
-- nenhum dos tres a responde. Reaproveitar `task_status` traria sete valores
-- dos quais cinco nao significam nada antes de a demanda existir.
--
-- Cinco valores, e o que NAO esta aqui e decisao:
--   * nao ha `cancelada` -- a 0020 tirou `cancelada` de `task_status` pela
--     razao de que um item parado num estado morto fica para sempre na fila de
--     quem nao quer ve-lo. Aqui o caminho e o mesmo: a agencia recusa com
--     motivo, ou conclui.
--   * nao ha `lida`. "Alguem abriu" nao e um estado do trabalho, e um selo que
--     muda porque uma tela foi aberta ensina o cliente a contar visualizacao.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if not exists (select 1 from pg_type where typname = 'solicitacao_status') then
    create type public.solicitacao_status as enum (
      'nova',         -- chegou, ninguem triou
      'em_analise',   -- o Atendimento pegou: ja ha rascunho, ou ainda ha pergunta
      'em_andamento', -- virou demanda PUBLICADA
      'concluida',    -- a demanda foi entregue
      'recusada'      -- a agencia disse nao, com motivo
    );
  end if;
end;
$bloco$;


-- ---------------------------------------------------------------------------
-- PASSO 1b - O sino ganha um tipo
--
-- `notification_tipo` e um enum, e acrescentar valor a um enum EM USO tem uma
-- regra que ja custou uma migration a este produto: o valor nao pode ser
-- USADO na mesma transacao em que nasce, e o SQL Editor do Supabase roda o
-- arquivo colado como uma transacao so.
--
-- Aqui ele passa porque `'solicitacao'` so aparece DENTRO de corpo de funcao
-- plpgsql -- que o Postgres nao resolve na hora de criar a funcao, e sim na
-- primeira execucao, que acontece depois do commit. Nenhum `insert` nem
-- `check` deste arquivo cita o valor. Foi por esbarrar nessa regra que
-- `rascunho` nao virou valor de `task_status` na 0028.
-- ---------------------------------------------------------------------------
alter type public.notification_tipo add value if not exists 'solicitacao';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A conta aceita pedido?
--
-- `clients.aceita_solicitacoes`, default TRUE.
--
-- O default e ligado de proposito: o contrario faria o modulo nascer invisivel
-- para todo cliente e a agencia concluir que ele nao funciona. Desligar e ato
-- de alguem, conta por conta -- e serve para a conta cujo combinado e que tudo
-- passa pelo Atendimento por telefone.
--
-- Desligado, o botao some do portal E o banco recusa o insert. Sao as duas
-- camadas de sempre, e a que vale e a de baixo.
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists aceita_solicitacoes boolean not null default true;

comment on column public.clients.aceita_solicitacoes is
  'Esta conta abre pedido pelo Portal? Default true; desligado, o botao some e o insert e recusado (0068).';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Os tipos de pedido, com o roteiro de briefing
--
-- "Peca para redes", "Material impresso", "Video", "Outro". Cada um carrega o
-- ROTEIRO das perguntas que aquele tipo de trabalho precisa -- formato, medida,
-- onde vai ao ar --, porque um campo de texto livre chamado "descreva o que
-- voce precisa" devolve "uma arte pro insta" e a primeira mensagem da conversa
-- e sempre a mesma pergunta.
--
-- `campos_json` E UM ARRAY EM JSONB, e nao um par de tabelas como o workflow.
-- A diferenca e o que se faz com cada um: o workflow guarda funcao, prazo
-- relativo e responsavel por etapa, coisas que se consultam; o roteiro e uma
-- lista de perguntas que alguem edita inteira antes de salvar. Normalizar
-- criaria duas tabelas para servir um `select * where id = ?` -- e a decisao ja
-- foi tomada uma vez, no template de campanha da 0033.
--
-- A forma de cada campo:
--   { "chave": "formato", "rotulo": "Formato", "tipo": "texto"|"texto_longo"
--     |"escolha"|"data", "obrigatorio": true, "opcoes": ["Feed","Stories"],
--     "ajuda": "..." }
--
-- `ativo` e como um tipo sai do ar sem sumir do que ja foi pedido com ele --
-- a mesma decisao de `skills.ativa` na 0043.
-- ---------------------------------------------------------------------------
create table if not exists public.request_types (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  icone       text,
  campos_json jsonb not null default '[]'::jsonb,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- O ROTEIRO E UMA LISTA, e o check existe porque um objeto gravado aqui nao
-- quebra nada na hora: ele quebra na tela do cliente, que faz `.map()` no que
-- veio e mostra um formulario sem campo nenhum -- sem erro, sem log.
alter table public.request_types
  drop constraint if exists request_types_campos_lista;
alter table public.request_types
  add constraint request_types_campos_lista check (jsonb_typeof(campos_json) = 'array');

alter table public.request_types
  drop constraint if exists request_types_nome_nao_vazio;
alter table public.request_types
  add constraint request_types_nome_nao_vazio check (length(btrim(nome)) > 0);

comment on table public.request_types is
  'Tipos de pedido do Portal, com o roteiro de briefing em campos_json (0068).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O pedido
--
-- `respostas` guarda o que o cliente respondeu ao roteiro, com a mesma chave
-- que `campos_json` declarou. Elas ficam em jsonb pela razao do roteiro: sao
-- escritas de uma vez e lidas inteiras, nunca consultadas resposta a resposta.
--
-- **E O ROTEIRO NAO E COPIADO PARA CA.** O pedido guarda o id do tipo e as
-- respostas; a pergunta continua no tipo. E o contrario do `workflow_snapshot`
-- da task, e de proposito: la a copia existe porque editar o workflow nao pode
-- mudar demanda nenhuma que ja esta correndo, e a demanda vive meses. O pedido
-- vira demanda em dias, e o que importa dele -- a resposta -- esta aqui. Se um
-- dia o roteiro mudar embaixo de um pedido antigo, o que se perde e o texto da
-- pergunta, nao a resposta; e a tela mostra a chave quando a pergunta sumiu,
-- em vez de esconder a linha.
--
-- `criado_por` e o usuario DO CLIENTE que escreveu. `on delete set null`
-- porque pessoa com historico nao se apaga neste produto -- mas o vinculo dela
-- com a empresa pode ser revogado, e o pedido continua sendo da empresa.
-- ---------------------------------------------------------------------------
create table if not exists public.client_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  request_type_id  uuid references public.request_types (id) on delete set null,
  criado_por       uuid references public.profiles (id) on delete set null,
  titulo           text not null,
  descricao        text,
  respostas        jsonb not null default '{}'::jsonb,
  -- O QUE O CLIENTE GOSTARIA, e nunca o que a agencia assumiu.
  data_desejada    date,
  status           public.solicitacao_status not null default 'nova',
  motivo_recusa    text,
  decidida_em      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.client_requests
  drop constraint if exists client_requests_titulo_nao_vazio;
alter table public.client_requests
  add constraint client_requests_titulo_nao_vazio check (length(btrim(titulo)) >= 3);

-- RECUSAR EXIGE MOTIVO, na acao e aqui.
--
-- E a mesma linha da nota fiscal recusada (0065) e do pedido de ajustes do
-- post (0032): recusa sem motivo manda a pessoa adivinhar, e o proximo pedido
-- volta igual. Com a diferenca de que aqui quem adivinha e o CLIENTE, que nao
-- tem a quem perguntar dentro do produto.
alter table public.client_requests
  drop constraint if exists client_requests_recusa_com_motivo;
alter table public.client_requests
  add constraint client_requests_recusa_com_motivo check (
    status <> 'recusada' or length(btrim(coalesce(motivo_recusa, ''))) >= 5
  );

create index if not exists client_requests_cliente_idx
  on public.client_requests (client_id, created_at desc);

-- O INDICE DA CAIXA DE ENTRADA E POR `created_at` CRESCENTE, e nao decrescente
-- como o do cliente: la a pergunta e "o que eu mandei por ultimo?", aqui e
-- "o que esta esperando ha mais tempo?". Sao as duas pontas da mesma fila.
create index if not exists client_requests_fila_idx
  on public.client_requests (status, created_at);

comment on table public.client_requests is
  'O pedido que o cliente abre pelo Portal (0068). data_desejada e desejo, nunca compromisso.';


-- ---------------------------------------------------------------------------
-- PASSO 5 - Os anexos
--
-- O caminho no bucket privado `solicitacoes-arquivos`, com a pasta da EMPRESA
-- na frente -- `{client_id}/{request_id}/{arquivo}`. E a forma do bucket de
-- campanhas e do de notas, com o recorte que esta area pede: la a pasta e do
-- cliente e quem le e a equipe; aqui a pasta e da empresa, e quem le e a
-- empresa MAIS a equipe.
--
-- `tamanho` e `tipo` sao gravados porque a tela do painel lista o anexo antes
-- de baixa-lo: "referencia.pdf, 2,4 MB" e uma decisao de clicar; um nome
-- sozinho nao e.
-- ---------------------------------------------------------------------------
create table if not exists public.request_attachments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.client_requests (id) on delete cascade,
  caminho     text not null,
  nome        text not null,
  tipo        text,
  tamanho     bigint,
  enviado_por uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists request_attachments_pedido_idx
  on public.request_attachments (request_id, created_at);

comment on table public.request_attachments is
  'Anexos do pedido, no bucket privado solicitacoes-arquivos (0068).';


-- ---------------------------------------------------------------------------
-- PASSO 6 - A conversa
--
-- Um nivel, sem resposta de resposta -- a mesma decisao da thread das
-- Recomendacoes e da do post: conversa aninhada e conversa que ninguem
-- acompanha.
--
-- **NAO EXISTE `interno` AQUI, e a ausencia e a regra deste modulo.** Em
-- `comments` (0032) existe, porque aquela thread fica no material e a equipe
-- precisa de um canto para conversar sobre ele. Aqui a conversa E o pedido
-- sendo esclarecido: tudo o que se escreve e para o cliente ler. Quem precisa
-- falar da agencia para dentro fala em `task_comentarios`, na demanda -- que e
-- outra tabela, em outra tela, e que o cliente nao alcanca.
--
-- Uma coluna `interno` aqui seria o pior dos dois mundos: um campo que a tela
-- do cliente nao mostra e a do painel mostra por engano no dia em que alguem
-- reaproveitar o componente da outra thread.
-- ---------------------------------------------------------------------------
create table if not exists public.request_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.client_requests (id) on delete cascade,
  autor_id   uuid not null references public.profiles (id),
  texto      text not null,
  created_at timestamptz not null default now()
);

alter table public.request_messages
  drop constraint if exists request_messages_texto_nao_vazio;
alter table public.request_messages
  add constraint request_messages_texto_nao_vazio check (length(btrim(texto)) > 0);

create index if not exists request_messages_pedido_idx
  on public.request_messages (request_id, created_at);


-- ---------------------------------------------------------------------------
-- PASSO 7 - A ponte, e ela e UMA coluna
--
-- `tasks.request_id`. `on delete set null` pela razao da recorrencia (0040):
-- a demanda e trabalho de verdade, com comentario, tempo lancado e aprovacao;
-- apagar o pedido nao pode levar a demanda junto.
--
-- Uma coluna e nao duas: daria para pendurar `client_requests.task_id` do
-- outro lado tambem, e ai as duas precisariam concordar. Quem pergunta "esta
-- demanda veio de um pedido?" le a coluna; quem pergunta "meu pedido virou o
-- que?" faz o caminho inverso pelo indice.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists request_id uuid
    references public.client_requests (id) on delete set null;

create unique index if not exists tasks_request_unico_idx
  on public.tasks (request_id) where request_id is not null;

comment on column public.tasks.request_id is
  'O pedido do cliente que virou esta demanda (0068). Unico: um pedido vira uma demanda.';


-- ---------------------------------------------------------------------------
-- PASSO 8 - Os triggers
-- ---------------------------------------------------------------------------

create or replace function public.solicitacoes_touch()
returns trigger language plpgsql as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists request_types_touch on public.request_types;
create trigger request_types_touch before update on public.request_types
  for each row execute function public.solicitacoes_touch();

drop trigger if exists client_requests_touch on public.client_requests;
create trigger client_requests_touch before update on public.client_requests
  for each row execute function public.solicitacoes_touch();


-- O PEDIDO NASCE `nova`, SEMPRE.
--
-- Sem esta linha, uma requisicao montada a mao criaria o pedido ja
-- `em_andamento` -- e a caixa de entrada, que ordena por quem espera ha mais
-- tempo, nunca o mostraria. Um pedido invisivel e pior que um pedido recusado.
--
-- E o cliente NAO escolhe o autor: `criado_por` e reescrito, como em
-- `comments_normaliza` (0032), porque policy nao limita coluna.
create or replace function public.client_requests_normaliza()
returns trigger language plpgsql security definer set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    -- So quando ha sessao: sem `auth.uid()` quem escreve e o seed, e apagar o
    -- autor que ele informou foi o primeiro bug do modulo de posts.
    if (select auth.uid()) is not null and not public.is_staff() then
      new.criado_por := (select auth.uid());
      new.status     := 'nova';
      new.motivo_recusa := null;
      new.decidida_em   := null;
    end if;
  end if;
  return new;
end;
$func$;

drop trigger if exists client_requests_normaliza on public.client_requests;
create trigger client_requests_normaliza before insert on public.client_requests
  for each row execute function public.client_requests_normaliza();


-- O AUTOR DA MENSAGEM E QUEM ESTA LOGADO, dos dois lados.
create or replace function public.request_messages_normaliza()
returns trigger language plpgsql security definer set search_path = public
as $func$
begin
  if (select auth.uid()) is not null then
    new.autor_id := (select auth.uid());
  end if;
  return new;
end;
$func$;

drop trigger if exists request_messages_normaliza on public.request_messages;
create trigger request_messages_normaliza before insert on public.request_messages
  for each row execute function public.request_messages_normaliza();


-- DEZ ANEXOS POR PEDIDO, E O BANCO RECUSA O DECIMO PRIMEIRO.
--
-- O teto RECUSA em vez de cortar, ao contrario do limite por task da
-- recorrencia: la o excesso vem de uma regra de calendario e cortar deixa o
-- mes incompleto e anotado; aqui cada arquivo foi escolhido e enviado por uma
-- pessoa, e descartar o decimo primeiro calado faria o cliente achar que
-- mandou o que nao chegou.
--
-- E a contagem e do BANCO e nao da tela: dez abas somando um arquivo cada
-- passam por dez contagens antes de qualquer uma gravar. E a licao do indice
-- unico da 0040, com a forma que cabe aqui.
create or replace function public.request_attachments_teto()
returns trigger language plpgsql as $func$
declare
  quantos integer;
begin
  select count(*) into quantos
    from public.request_attachments
   where request_id = new.request_id;

  if quantos >= 10 then
    raise exception 'Este pedido ja tem 10 arquivos.'
      using hint = 'Apague um antes de anexar outro, ou mande o resto por uma pasta compartilhada no campo de descricao.';
  end if;

  return new;
end;
$func$;

drop trigger if exists request_attachments_teto on public.request_attachments;
create trigger request_attachments_teto before insert on public.request_attachments
  for each row execute function public.request_attachments_teto();


-- ---------------------------------------------------------------------------
-- O AVISO DE PEDIDO NOVO VAI PARA O ATENDIMENTO DA CONTA
--
-- `clients.responsavel_atendimento_id` desde a 0062, e nao uma coluna nova em
-- `client_flow_defaults`: uma segunda coluna dizendo quem atende esta conta
-- divergiria calada da primeira. E a mesma decisao da 0064.
--
-- **Conta sem atendente nao derruba o pedido**, e e exatamente o bug que a
-- 0062 consertou: `notificar()` devolve null quando nao ha a quem avisar, em
-- vez de estourar o `not null` de `notifications.user_id` e levar junto a
-- escrita que a chamou. O que se perde e o sino; o pedido esta na caixa de
-- entrada, que e onde o Atendimento olha.
-- ---------------------------------------------------------------------------
create or replace function public.client_requests_avisa_atendimento()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_empresa text;
  v_quem    uuid;
begin
  select c.nome_empresa, c.responsavel_atendimento_id
    into v_empresa, v_quem
    from public.clients c
   where c.id = new.client_id;

  perform public.notificar(
    v_quem,
    'solicitacao',
    'Pedido novo de ' || coalesce(v_empresa, 'um cliente'),
    new.titulo,
    '/painel/solicitacoes/' || new.id::text
  );

  return null;
end;
$func$;

drop trigger if exists client_requests_avisa_atendimento on public.client_requests;
create trigger client_requests_avisa_atendimento after insert on public.client_requests
  for each row execute function public.client_requests_avisa_atendimento();


-- ---------------------------------------------------------------------------
-- A MENSAGEM AVISA O OUTRO LADO
--
-- Quem escreveu nunca recebe o proprio aviso -- isso e de `notificar()`, e nao
-- se repete aqui. O que este trigger decide e QUEM e o outro lado, e ele
-- depende de quem escreveu: do cliente para a agencia, e o atendente da conta;
-- da agencia para o cliente, sao todas as pessoas da empresa.
--
-- **E o texto da mensagem NAO vai no aviso**, pela razao do e-mail de
-- comentario: o aviso e lido em qualquer lugar, e o que a conversa diz mora na
-- tela onde ela acontece. O que sai e que ha conversa nova, e onde.
-- ---------------------------------------------------------------------------
create or replace function public.request_messages_avisa()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_cliente  uuid;
  v_titulo   text;
  v_empresa  text;
  v_autor_e_equipe boolean;
  v_pessoa   uuid;
begin
  select r.client_id, r.titulo into v_cliente, v_titulo
    from public.client_requests r where r.id = new.request_id;

  select c.nome_empresa into v_empresa
    from public.clients c where c.id = v_cliente;

  select exists (
    select 1 from public.profiles p
     where p.id = new.autor_id and p.role <> 'cliente'
  ) into v_autor_e_equipe;

  if v_autor_e_equipe then
    for v_pessoa in
      select cu.user_id from public.client_users cu where cu.client_id = v_cliente
    loop
      perform public.notificar(
        v_pessoa, 'solicitacao',
        'Resposta no seu pedido',
        v_titulo,
        '/portal/solicitacoes/' || new.request_id::text
      );
    end loop;
  else
    perform public.notificar(
      (select c.responsavel_atendimento_id from public.clients c where c.id = v_cliente),
      'solicitacao',
      'Mensagem de ' || coalesce(v_empresa, 'um cliente'),
      v_titulo,
      '/painel/solicitacoes/' || new.request_id::text
    );
  end if;

  return null;
end;
$func$;

drop trigger if exists request_messages_avisa on public.request_messages;
create trigger request_messages_avisa after insert on public.request_messages
  for each row execute function public.request_messages_avisa();


-- ---------------------------------------------------------------------------
-- O PEDIDO ANDA QUANDO A DEMANDA ANDA, E O GATILHO MORA EM `tasks`
--
-- Duas transicoes, e so duas:
--
--   * a demanda foi PUBLICADA  -> o pedido vira `em_andamento`;
--   * a demanda foi `entregue` -> o pedido vira `concluida`.
--
-- **A primeira e o coracao do sprint.** Converter abre um RASCUNHO, e rascunho
-- e pensamento pela metade: se o status andasse ali, o cliente leria "estamos
-- fazendo" sobre uma demanda que ninguem da equipe enxerga ainda -- e que pode
-- ser abandonada. Publicar e o instante em que a demanda passa a existir para
-- a equipe, e e o unico instante honesto para dizer isso a ele.
--
-- **A segunda evita a fila que acumula.** Sem ela, todo pedido ja entregue
-- ficaria para sempre na caixa de entrada -- e uma fila que so cresce e uma
-- fila que ninguem abre. `entregue` e honesto para dizer "concluida" porque a
-- 0023 ja recusa marca-lo enquanto alguma etapa que pede aval nao tiver a
-- rodada aprovada dela.
--
-- **E O TRIGGER MORA EM `tasks` E NAO DENTRO DE `publicarTask`**, pela razao
-- da 0045: aquela action ja foi reescrita e vai ser de novo, e cada reescrita
-- e uma chance de o trecho ficar para tras. De quebra, ele pega todo caminho
-- que publica a demanda, nao so o botao.
--
-- Ele NUNCA derruba a escrita da task, que e a licao da 0052: o `update` que
-- ele acompanha e o de quem clicou em "Criar task", e uma falha aqui apareceria
-- para essa pessoa como a publicacao dela sendo recusada, com uma mensagem
-- sobre um pedido do cliente. O pedido fica onde estava, que e a verdade.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_espelha_no_pedido()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_novo    public.solicitacao_status;
  v_titulo  text;
  v_cliente uuid;
  v_pessoa  uuid;
begin
  if new.request_id is null then
    return null;
  end if;

  if old.publicada_em is null and new.publicada_em is not null then
    v_novo := 'em_andamento';
  elsif old.status is distinct from new.status and new.status = 'entregue' then
    v_novo := 'concluida';
  else
    return null;
  end if;

  -- PERGUNTAR ANTES, em vez de embrulhar num `exception when others` que
  -- engole tambem o erro que ninguem previu. E a forma da 0052.
  update public.client_requests
     set status = v_novo
   where id = new.request_id
     and status not in ('recusada', 'concluida')
  returning titulo, client_id into v_titulo, v_cliente;

  if v_titulo is null then
    return null;
  end if;

  for v_pessoa in
    select cu.user_id from public.client_users cu where cu.client_id = v_cliente
  loop
    perform public.notificar(
      v_pessoa, 'solicitacao',
      case when v_novo = 'em_andamento'
        then 'Seu pedido virou trabalho'
        else 'Seu pedido foi concluido' end,
      v_titulo,
      '/portal/solicitacoes/' || new.request_id::text
    );
  end loop;

  return null;
end;
$func$;

drop trigger if exists tasks_espelha_no_pedido on public.tasks;
create trigger tasks_espelha_no_pedido after update on public.tasks
  for each row execute function public.tasks_espelha_no_pedido();


-- A RECUSA CARIMBA A DATA E AVISA, e ela e o unico desfecho que a agencia
-- escreve a mao.
create or replace function public.client_requests_avisa_decisao()
returns trigger language plpgsql security definer set search_path = public
as $func$
declare
  v_pessoa uuid;
begin
  if new.status = 'recusada' and old.status is distinct from 'recusada' then
    for v_pessoa in
      select cu.user_id from public.client_users cu where cu.client_id = new.client_id
    loop
      perform public.notificar(
        v_pessoa, 'solicitacao',
        'Sobre o seu pedido',
        new.titulo || ' — ' || coalesce(new.motivo_recusa, ''),
        '/portal/solicitacoes/' || new.id::text
      );
    end loop;
  end if;
  return null;
end;
$func$;

drop trigger if exists client_requests_avisa_decisao on public.client_requests;
create trigger client_requests_avisa_decisao after update on public.client_requests
  for each row execute function public.client_requests_avisa_decisao();

create or replace function public.client_requests_carimba_decisao()
returns trigger language plpgsql as $func$
begin
  if new.status in ('recusada', 'concluida') and old.status is distinct from new.status then
    new.decidida_em := coalesce(new.decidida_em, now());
  end if;
  return new;
end;
$func$;

drop trigger if exists client_requests_carimba_decisao on public.client_requests;
create trigger client_requests_carimba_decisao before update on public.client_requests
  for each row execute function public.client_requests_carimba_decisao();


-- ---------------------------------------------------------------------------
-- PASSO 9 - RLS
--
-- As tres camadas de sempre, e esta e a terceira -- a que vale. As outras duas
-- (o botao que some quando a conta nao aceita pedido, a rota do painel fechada
-- em `is_atendimento()`) sao conveniencia.
-- ---------------------------------------------------------------------------
alter table public.request_types        enable row level security;
alter table public.client_requests      enable row level security;
alter table public.request_attachments  enable row level security;
alter table public.request_messages     enable row level security;

-- A PERGUNTA "ESTE PEDIDO E MEU?" MORA NUMA FUNCAO SO.
--
-- Ela e feita por quatro policies -- anexo e mensagem, leitura e escrita -- e
-- repetir o `exists` em quatro lugares seria criar quatro lugares para
-- divergir. E a razao pela qual `is_staff()` e `my_client_ids()` existem.
create or replace function public.posso_ver_solicitacao(p_pedido uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $func$
begin
  return exists (
    select 1 from public.client_requests r
     where r.id = p_pedido
       and (public.is_staff() or r.client_id in (select public.my_client_ids()))
  );
end;
$func$;

-- ---------------------------------------------------------------------------
-- Os tipos de pedido
--
-- A EQUIPE LE TODOS; O CLIENTE LE SO OS ATIVOS. E a forma de
-- `academy_tracks_select` com a trilha em rascunho: o tipo que saiu do ar
-- continua existindo para a gestao -- e para os pedidos antigos que o citam --
-- e some do formulario de quem vai abrir um novo.
-- ---------------------------------------------------------------------------
drop policy if exists request_types_select on public.request_types;
create policy request_types_select on public.request_types
  for select to authenticated
  using (public.is_staff() or ativo);

-- QUEM EDITA O ROTEIRO E A GESTAO, e nao `is_atendimento()` como quem abre o
-- pedido: o roteiro vale para TODAS as contas. Abrir uma demanda e trabalho do
-- dia; mudar a pergunta que todo cliente vai responder e configuracao do
-- produto -- a mesma separacao de "o Atendimento abre o mes, a gestao
-- distribui a corrente" (0046).
drop policy if exists request_types_write on public.request_types;
create policy request_types_write on public.request_types
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- ---------------------------------------------------------------------------
-- O pedido
-- ---------------------------------------------------------------------------
drop policy if exists client_requests_select on public.client_requests;
create policy client_requests_select on public.client_requests
  for select to authenticated
  using (public.is_staff() or client_id in (select public.my_client_ids()));

-- QUEM ABRE E O CLIENTE DA CONTA, E SO SE A CONTA ACEITA.
--
-- `aceita_solicitacoes` no `with check` e o que faz o desligamento valer de
-- verdade: sem ele, a trava seria o botao que some -- e botao escondido nao e
-- regra de seguranca neste produto.
--
-- **A equipe tambem abre**, e isso nao e furo: o Atendimento que recebe o
-- pedido por telefone registra ali, e a conversa passa a ter um lugar. Quem
-- escreveu fica em `criado_por`, entao o cliente ve de quem partiu.
drop policy if exists client_requests_insert on public.client_requests;
create policy client_requests_insert on public.client_requests
  for insert to authenticated
  with check (
    public.is_atendimento()
    or (
      client_id in (select public.my_client_ids())
      and exists (
        select 1 from public.clients c
         where c.id = client_id and c.aceita_solicitacoes
      )
    )
  );

-- O CLIENTE NAO MEXE NO PEDIDO DEPOIS DE MANDAR, e a ausencia da policy e a
-- regra. Editar o titulo de um pedido que o Atendimento ja leu -- ou que ja
-- virou demanda -- trocaria o combinado embaixo de quem esta trabalhando nele.
-- O caminho e a conversa: uma mensagem nova, que fica com data e autor.
--
-- E quem tria e `is_atendimento()`, a MESMA funcao que `tasks_insert` usa
-- desde a 0006 -- nao uma parecida. Quem converte o pedido em demanda e quem
-- pode criar a demanda; duas perguntas diferentes dariam a tela que oferece o
-- botao e o banco que recusa o clique.
drop policy if exists client_requests_update on public.client_requests;
create policy client_requests_update on public.client_requests
  for update to authenticated
  using (public.is_atendimento()) with check (public.is_atendimento());

-- APAGAR E DA GESTAO, e existe para o pedido aberto por engano ou em
-- duplicidade -- nao para "limpar a fila": recusar com motivo e o caminho, e
-- ele deixa rastro dos dois lados. O apagamento entra na trilha de auditoria
-- pela 0058, que ja registra o `delete` das tabelas que importam.
drop policy if exists client_requests_delete on public.client_requests;
create policy client_requests_delete on public.client_requests
  for delete to authenticated
  using (public.is_gestor());

-- ---------------------------------------------------------------------------
-- Anexos e mensagens
--
-- Os dois lados leem e escrevem, e a pergunta e uma so: o pedido e meu?
-- ---------------------------------------------------------------------------
drop policy if exists request_attachments_select on public.request_attachments;
create policy request_attachments_select on public.request_attachments
  for select to authenticated
  using (public.posso_ver_solicitacao(request_id));

drop policy if exists request_attachments_insert on public.request_attachments;
create policy request_attachments_insert on public.request_attachments
  for insert to authenticated
  with check (public.posso_ver_solicitacao(request_id));

-- NAO EXISTE UPDATE DE ANEXO, e e a decisao de `post_referencias`: trocar o
-- arquivo por baixo de um nome que alguem ja leu e trocar o destino embaixo de
-- quem o leu. Apaga e poe outro.
drop policy if exists request_attachments_delete on public.request_attachments;
create policy request_attachments_delete on public.request_attachments
  for delete to authenticated
  using (
    public.posso_ver_solicitacao(request_id)
    and (enviado_por = (select auth.uid()) or public.is_gestor())
  );

drop policy if exists request_messages_select on public.request_messages;
create policy request_messages_select on public.request_messages
  for select to authenticated
  using (public.posso_ver_solicitacao(request_id));

drop policy if exists request_messages_insert on public.request_messages;
create policy request_messages_insert on public.request_messages
  for insert to authenticated
  with check (public.posso_ver_solicitacao(request_id));

-- MENSAGEM NAO SE EDITA NEM SE APAGA, dos dois lados.
--
-- E o oposto do feed de Recomendacoes, onde o autor edita: la a frase e uma
-- opiniao dele; aqui ela e o combinado entre duas empresas sobre o que vai ser
-- feito. Reescrever "pode ser azul" depois da peca pronta e reescrever o
-- pedido. E a razao pela qual rodada de aprovacao fechada nunca e reescrita.


-- ---------------------------------------------------------------------------
-- PASSO 10 - O bucket
--
-- Privado, como todos. A pasta e da EMPRESA, e e ela que separa um cliente do
-- outro -- `is_staff() or my_client_ids()` sozinho deixaria o cliente A ler o
-- anexo do cliente B, porque a policy de storage nao enxerga a tabela do
-- pedido sem um join que `storage.foldername()` nao faz.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('solicitacoes-arquivos', 'solicitacoes-arquivos', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "solicitacoes: a empresa e a equipe leem" on storage.objects';
  execute 'drop policy if exists "solicitacoes: a empresa e a equipe escrevem" on storage.objects';
  execute 'drop policy if exists "solicitacoes: quem pos apaga" on storage.objects';

  execute $politica$
    create policy "solicitacoes: a empresa e a equipe leem" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'solicitacoes-arquivos'
        and (
          public.is_staff()
          or (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
        )
      )
  $politica$;

  execute $politica$
    create policy "solicitacoes: a empresa e a equipe escrevem" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'solicitacoes-arquivos'
        and (
          public.is_staff()
          or (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
        )
      )
  $politica$;

  execute $politica$
    create policy "solicitacoes: quem pos apaga" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'solicitacoes-arquivos'
        and (
          public.is_gestor()
          or (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
        )
      )
  $politica$;
end;
$bloco$;


-- ---------------------------------------------------------------------------
-- PASSO 11 - Os quatro tipos de pedido que a agencia ja tem
--
-- ELES NASCEM AQUI, e nao numa tela vazia esperando alguem.
--
-- Um catalogo vazio no primeiro dia faz o modulo estrear sem funcionar: o
-- cliente abre "Novo pedido", encontra um seletor sem opcao e conclui que a
-- area nao esta pronta. E a mesma razao pela qual a 0008 ja veio com os
-- workflows iniciais.
--
-- O roteiro de cada um e SUGESTAO e nao contrato -- a gestao edita na tela, e
-- o que esta aqui e o que a agencia pergunta hoje no WhatsApp.
-- ---------------------------------------------------------------------------
insert into public.request_types (nome, descricao, icone, ordem, campos_json)
select * from (values
  (
    'Peça para redes',
    'Post, story, carrossel ou reels para as suas redes.',
    'Share2', 10,
    '[
      {"chave":"rede","rotulo":"Onde vai ao ar","tipo":"escolha","obrigatorio":true,
       "opcoes":["Instagram","Facebook","LinkedIn","TikTok","Mais de uma"]},
      {"chave":"formato","rotulo":"Formato","tipo":"escolha","obrigatorio":false,
       "opcoes":["Feed","Stories","Reels","Não sei ainda"]},
      {"chave":"mensagem","rotulo":"O que esta peça precisa dizer","tipo":"texto_longo","obrigatorio":true,
       "ajuda":"Em uma ou duas frases. O texto final é com a gente."},
      {"chave":"referencias","rotulo":"Alguma referência?","tipo":"texto","obrigatorio":false}
    ]'::jsonb
  ),
  (
    'Material impresso',
    'Folder, banner, cartão, lâmina — o que vai para a gráfica.',
    'Printer', 20,
    '[
      {"chave":"peca","rotulo":"Que peça é","tipo":"texto","obrigatorio":true,
       "ajuda":"Folder A5, banner de 2x1, cartão de visita…"},
      {"chave":"medida","rotulo":"Medida","tipo":"texto","obrigatorio":false,
       "ajuda":"Se a gráfica já pediu um tamanho, é aqui."},
      {"chave":"quantidade","rotulo":"Quantas","tipo":"texto","obrigatorio":false},
      {"chave":"onde_usa","rotulo":"Onde vai ser usada","tipo":"texto_longo","obrigatorio":false}
    ]'::jsonb
  ),
  (
    'Vídeo',
    'Gravação, edição ou animação.',
    'Video', 30,
    '[
      {"chave":"duracao","rotulo":"Duração aproximada","tipo":"texto","obrigatorio":false},
      {"chave":"onde","rotulo":"Onde vai ao ar","tipo":"texto","obrigatorio":false},
      {"chave":"tem_material","rotulo":"Já existe material gravado?","tipo":"escolha","obrigatorio":false,
       "opcoes":["Sim, vou anexar","Sim, mando depois","Não"]},
      {"chave":"mensagem","rotulo":"O que o vídeo precisa dizer","tipo":"texto_longo","obrigatorio":true}
    ]'::jsonb
  ),
  (
    'Outro',
    'Não se encaixa nos anteriores — conte o que você precisa.',
    'CircleHelp', 40,
    '[
      {"chave":"mensagem","rotulo":"O que você precisa","tipo":"texto_longo","obrigatorio":true}
    ]'::jsonb
  )
) as novo (nome, descricao, icone, ordem, campos_json)
where not exists (select 1 from public.request_types t where t.nome = novo.nome);


-- ---------------------------------------------------------------------------
-- PASSO 12 - Conferencia
-- ---------------------------------------------------------------------------
select
  'tudo pronto'                                                  as situacao,
  (select count(*) from public.request_types)                    as tipos,
  (select count(*) from pg_tables where schemaname = 'public'
     and rowsecurity
     and tablename in ('request_types','client_requests',
                       'request_attachments','request_messages')) as tabelas_com_rls,
  (select count(*) from pg_policies where schemaname = 'public'
     and tablename in ('request_types','client_requests',
                       'request_attachments','request_messages')) as policies;

notify pgrst, 'reload schema';
