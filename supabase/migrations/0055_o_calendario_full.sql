-- ---------------------------------------------------------------------------
-- 0055 - O Calendario Full: eventos, e a view que junta tudo num formato so
--
-- Sprint 10. Ate aqui o produto tinha DOIS calendarios parciais -- o de Gestao
-- de Tasks (prazo de demanda e de etapa, post e campanha) e o do Full Days
-- (quem esta fora) --, e nenhum dos dois respondia a pergunta que a agencia
-- faz toda segunda: "o que acontece nesta semana, e quem esta disponivel para
-- fazer?". Este sprint junta as duas metades e acrescenta a terceira, que nao
-- existia em lugar nenhum: o que ACONTECE -- convencao, feira, lancamento,
-- reuniao, feriado de um cliente.
--
-- ---------------------------------------------------------------------------
-- QUATRO COISAS QUE O SPRINT PRESSUPOE E QUE NAO SAO ASSIM NESTE PROJETO
--
--   1. `t.status not in ('rascunho', 'cancelada')` -- a view do sprint filtra
--      os rascunhos assim, e NENHUM DOS DOIS VALORES EXISTE.
--
--      `rascunho` nunca foi valor do enum, de proposito (0028): rascunho e
--      `publicada_em is null`. E nao e so um filtro que nao pega nada -- o
--      Postgres RECUSA a comparacao, porque `'rascunho'` nao e entrada valida
--      de `task_status`. A view nao seria criada, e o erro falaria de enum,
--      nao de rascunho.
--
--      `cancelada` saiu na 0020. O valor continua no enum -- `alter type ...
--      drop value` nao existe --, mas o trigger `tasks_sem_cancelada` recusa
--      qualquer escrita com ele, entao nenhuma linha o carrega. Filtrar por
--      ele seria codigo morto que sugere um estado que o produto nao tem.
--
--      Aqui o filtro e `t.publicada_em is not null`, que e a verdade do banco.
--      **E ele existe nos DOIS lugares**, como manda a regra do rascunho: a
--      RLS restritiva ja esconde o rascunho dos outros, e este filtro esconde
--      o MEU -- senao o calendario da agencia mostraria para mim as demandas
--      que eu ainda nem publiquei.
--
--   2. `carga_do_dia(user_id, data)` -- o sprint manda usar "o componente que
--      ja existe". Ele existe mesmo, desde a 0035, e e a fonte UNICA de carga
--      do produto. Nada aqui recalcula.
--
--   3. `team_members.capacidade_minutos_dia` -- o sprint le a capacidade
--      diaria da pessoa nesta coluna, que NAO existia. Ela nasce aqui, com
--      default de 480 minutos (8h) e por pessoa, pela mesma razao de
--      `dias_ferias_ano`: contrato muda por pessoa, e mudar contrato nao pode
--      exigir deploy.
--
--   4. "Nao incluir posts e campanhas ainda; a view e estendida nos Sprints 12
--      e 13" -- os dois ja aconteceram. Post, campanha e entregavel entram
--      agora, por decisao do usuario. Deixa-los de fora criaria um calendario
--      que diz "nada acontece dia 12" num dia com seis posts agendados.
--
-- ---------------------------------------------------------------------------
-- A COISA MAIS IMPORTANTE DESTE ARQUIVO: `security_invoker = true`
--
-- O sprint diz "a view herda as politicas das tabelas de origem". **Isso so e
-- verdade com `security_invoker`.** Uma view comum no Postgres roda com os
-- direitos de QUEM A CRIOU, e o dono aqui e o superusuario da migration: sem
-- essa clausula a `calendar_events` LE TUDO, para qualquer pessoa autenticada,
-- furando a RLS de sete tabelas de uma vez -- e o cliente de uma empresa veria
-- a agenda inteira da agencia, com o nome das demandas de todos os outros
-- clientes.
--
-- Nao seria um furo discreto: seria o maior do produto, num objeto que o
-- PostgREST publica automaticamente. E ele NAO APARECE EM TESTE DE TELA, porque
-- a tela filtra por perfil antes de desenhar. A bateria confere isso com o
-- comando cru, como cliente.
-- ---------------------------------------------------------------------------

-- Roda mais de uma vez sem erro.


-- ---------------------------------------------------------------------------
-- PASSO 1 - Eventos
--
-- O calendario nao e so o que a equipe produz e quem esta fora. Uma convencao
-- de tres dias, a feira do cliente, o lancamento -- sao fatos que mudam o que
-- da para prometer, e ate aqui viviam no WhatsApp.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'evento_tipo'
  ) then
    create type public.evento_tipo as enum (
      'convencao', 'feira', 'lancamento', 'reuniao',
      'treinamento', 'feriado_cliente', 'outro'
    );
  end if;
end
$$;

comment on type public.evento_tipo is
  'O que o evento e. Decide a cor quando `events.cor` nao diz outra coisa.';

create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  descricao       text,
  tipo            public.evento_tipo not null default 'outro',
  -- NULO = evento da agencia inteira. E por isso que a coluna aceita nulo em
  -- vez de exigir um cliente: reuniao de equipe e treinamento interno nao
  -- pertencem a conta nenhuma.
  client_id       uuid references public.clients(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date not null,
  dia_inteiro     boolean not null default true,
  hora_inicio     time,
  hora_fim        time,
  local           text,
  link            text,
  cor             text,
  -- Quando marcado, os dias do evento aparecem BLOQUEADOS no calendario de
  -- propor periodo do Full Days. E o que impede alguem marcar descanso na
  -- semana da convencao.
  bloqueia_ferias boolean not null default false,
  criado_por      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  constraint events_periodo check (data_fim >= data_inicio),
  -- Com horario, a ordem tambem precisa fazer sentido. Sem esta linha, um
  -- evento das 18h as 9h passa e a tela desenha uma faixa de altura negativa.
  constraint events_horario check (
    dia_inteiro
    or hora_inicio is null
    or hora_fim is null
    or hora_fim >= hora_inicio
  )
);

comment on table public.events is
  'Convencoes, feiras, lancamentos, reunioes e feriados de cliente. Sem participante, vale para a agencia inteira (0055).';

comment on column public.events.bloqueia_ferias is
  'Marcado, os dias do evento ficam bloqueados no calendario de propor periodo do Full Days.';

create table if not exists public.event_participants (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  unique (event_id, user_id)
);

comment on table public.event_participants is
  'Quem vai. VAZIO QUER DIZER TODO MUNDO -- e nao "ninguem": um evento da agencia nao lista as dez pessoas uma a uma (0055).';

create index if not exists events_periodo_idx  on public.events (data_inicio, data_fim);
create index if not exists events_cliente_idx  on public.events (client_id);
create index if not exists event_participants_user_idx on public.event_participants (user_id);

alter table public.events             enable row level security;
alter table public.event_participants enable row level security;

-- LEITURA DE TODA A EQUIPE, escrita de quem abre trabalho.
--
-- `is_atendimento()` e nao `is_gestor()`, e e a mesma funcao que `tasks_insert`
-- usa desde a 0006 e que `campaigns_insert` passou a usar na 0054: quem abre a
-- demanda de hoje e quem sabe que a feira e semana que vem. Uma segunda funcao
-- dizendo quase isso seria o lugar onde as duas verdades comecam a divergir.
--
-- Cliente nao alcanca evento nenhum, nem o da propria empresa: o Portal mostra
-- material enviado, nao a agenda interna da agencia.
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (public.is_staff());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (public.is_atendimento() and criado_por = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (public.is_atendimento()) with check (public.is_atendimento());

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete using (public.is_atendimento());

drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants
  for select using (public.is_staff());

-- A LISTA DE PARTICIPANTES E DE QUEM MANDA NO EVENTO, e nao de quem participa:
-- sem isto, qualquer pessoa da equipe se tiraria da convencao apagando a
-- propria linha, e o evento passaria a valer so para os que sobraram. Quem nao
-- vai avisa quem organiza.
drop policy if exists event_participants_write on public.event_participants;
create policy event_participants_write on public.event_participants
  for all using (public.is_atendimento()) with check (public.is_atendimento());


-- ---------------------------------------------------------------------------
-- PASSO 2 - A capacidade diaria da pessoa
--
-- O indicador de carga da Linha do Tempo compara os minutos comprometidos com
-- o que a pessoa tem de dia. `carga_do_dia()` ja devolve o primeiro numero
-- desde a 0035; faltava o segundo.
--
-- POR PESSOA E NAO CONSTANTE, pela mesma razao de `dias_ferias_ano`: meio
-- periodo, estagio e contrato reduzido existem, e mudar contrato nao pode
-- exigir deploy.
-- ---------------------------------------------------------------------------
alter table public.team_members
  add column if not exists capacidade_minutos_dia integer not null default 480;

comment on column public.team_members.capacidade_minutos_dia is
  'Minutos de trabalho por dia util desta pessoa. 480 = 8h. Comparado com carga_do_dia() para acender a sobrecarga (0055).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_members_capacidade_positiva'
  ) then
    alter table public.team_members
      add constraint team_members_capacidade_positiva
      check (capacidade_minutos_dia > 0 and capacidade_minutos_dia <= 1440);
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 3 - A view
--
-- Sete origens, um formato so. Acrescentar a oitava e acrescentar um `union
-- all` -- e e por isso que todas devolvem as mesmas dez colunas na mesma
-- ordem, mesmo quando metade delas e nula para aquela origem.
--
-- NENHUMA TABELA NOVA DE EVENTO AGREGADO, e o sprint tem razao no ponto: uma
-- tabela que copia prazo de etapa, data de post e periodo de campanha precisa
-- ser reescrita por sete caminhos para continuar verdadeira, e no dia em que
-- um deles falhar o calendario mente sem avisar. E a mesma razao pela qual
-- bloqueio de subtarefa nao e status e atraso do Financeiro nao e coluna.
-- ---------------------------------------------------------------------------
drop view if exists public.calendar_events;

create view public.calendar_events
with (security_invoker = true) as

  -- 1. A DEMANDA, pelo periodo dela.
  --
  -- O periodo e derivado das etapas desde a 0028, entao a barra da Task e a
  -- soma do que ha dentro -- ela nao precisa ser mantida, ela ja e o resumo.
  select
    t.id                                   as id,
    'task'::text                           as tipo,
    t.titulo                               as titulo,
    t.data_inicio                          as data_inicio,
    coalesce(t.data_fim, t.data_inicio)    as data_fim,
    t.client_id                            as client_id,
    null::uuid                             as user_id,
    t.prioridade::text                     as prioridade,
    t.status::text                         as status,
    '/painel/gestao-tasks/' || t.id        as link
  from public.tasks t
  where t.publicada_em is not null
    and t.data_inicio is not null

  union all

  -- 2. A ETAPA, no prazo dela e com o responsavel dela.
  --
  -- SO AS FOLHAS. A agrupadora deixa de ser unidade de trabalho no instante em
  -- que ganha a primeira filha (0022), e o prazo que sobrou nela e o de quando
  -- ela ainda era folha: mostrar os dois poria a mesma entrega duas vezes no
  -- mesmo mes, uma delas numa data que ninguem mais usa.
  --
  -- E NO PRAZO, nao no periodo, ainda que a etapa tenha `data_inicio` desde a
  -- 0027. E decisao registrada do produto: comecar tarde nao e atrasar, e uma
  -- barra por data dobraria os itens do mes. O inicio aparece no detalhe.
  select
    s.id,
    'subtarefa',
    s.titulo,
    s.prazo,
    s.prazo,
    t.client_id,
    s.responsavel_id,
    s.prioridade::text,
    s.status::text,
    '/painel/gestao-tasks/' || t.id || '?sub=' || s.id
  from public.subtasks s
  join public.tasks t on t.id = s.task_id
  where s.prazo is not null
    and t.publicada_em is not null
    and not exists (
      select 1 from public.subtasks f where f.parent_id = s.id
    )

  union all

  -- 3. QUEM ESTA FORA, e so o que foi combinado.
  --
  -- Pedido pendente NAO entra: ele ainda pode ser remarcado, e pintar o
  -- calendario da agencia com um periodo que o socio nem respondeu faria a
  -- equipe planejar em cima de uma ausencia que talvez nao aconteca.
  select
    h.id,
    'ausencia',
    h.tipo::text,
    h.data_inicio,
    h.data_fim,
    null::uuid,
    h.user_id,
    null::text,
    h.status::text,
    '/painel/full-days'
  from public.hr_requests h
  where h.status = 'aprovada'

  union all

  -- 4. O QUE ACONTECE.
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

  -- 5. O POST, no dia em que vai ao ar.
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

  -- 6. A CAMPANHA, com o periodo inteiro.
  --
  -- A VIEW CARREGA A VERDADE; quem decide como desenhar e a tela. Na grade do
  -- mes a campanha aparece no ENCERRAMENTO, porque uma Wave de trinta dias
  -- pintaria trinta celulas e empurraria para baixo tudo o que acontece em
  -- cada uma -- decisao ja registrada do produto. Na Linha do Tempo ela e a
  -- barra longa que o sprint pede. Os dois desenhos saem da mesma linha, e e
  -- `diaNaGrade()` em `lib/dominio/calendario.ts` que escolhe -- um lugar so.
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

  -- 7. A PECA DA CAMPANHA, no prazo dela.
  --
  -- So as FOLHAS, pela mesma razao da etapa: o grupo e uma linha na tela e
  -- quinze entregas no trabalho, e conta-lo tambem faria "16 de 16" onde ha
  -- quinze coisas.
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
    );

comment on view public.calendar_events is
  'Tudo o que tem data, num formato so: demanda, etapa, ausencia, evento, post, campanha e entregavel. security_invoker: a RLS de cada tabela de origem continua valendo (0055).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - Os indices que a view pede
--
-- Ela e sempre consultada por FAIXA DE DATA -- o mes visivel, com uma semana
-- de folga em cada ponta. Sem indice, cada troca de mes vira sete varreduras
-- sequenciais.
-- ---------------------------------------------------------------------------
create index if not exists subtasks_prazo_idx        on public.subtasks (prazo)        where prazo is not null;
create index if not exists hr_requests_periodo_idx   on public.hr_requests (data_inicio, data_fim);
create index if not exists posts_publicacao_idx      on public.posts (data_publicacao) where data_publicacao is not null;
create index if not exists deliverables_prazo_idx    on public.deliverables (prazo)    where prazo is not null;
create index if not exists campaigns_periodo_idx     on public.campaigns (data_inicio, data_fim);


-- ---------------------------------------------------------------------------
-- PASSO 5 - O evento que bloqueia o periodo, no Full Days
--
-- O calendario de propor periodo ja bloqueia o dia em que um colega da mesma
-- area esta fora, e diz o nome de quem esta. Evento com `bloqueia_ferias`
-- entra pela MESMA porta, devolvendo a mesma forma -- dia e nome --, porque
-- duas listas de bloqueio com dois formatos dariam duas frases de recusa
-- diferentes para a mesma tela.
--
-- QUEM E BLOQUEADO: os participantes, quando o evento tem participantes; todo
-- mundo, quando nao tem. E a mesma regra que decide o destaque na tela, e ela
-- mora aqui para nao ser reimplementada la.
--
-- `security definer` NAO: a funcao le `events`, cuja policy de leitura ja e
-- `is_staff()`. Furar a RLS para ler o que a pessoa ja pode ler seria abrir
-- uma porta sem ter fechado nenhuma.
-- ---------------------------------------------------------------------------
create or replace function public.eventos_que_bloqueiam(
  p_user_id uuid,
  p_inicio  date,
  p_fim     date
)
returns table (dia date, nome text)
language plpgsql
stable
set search_path = public
as $funcao$
begin
  return query
  select d::date, e.nome
    from public.events e
    cross join lateral generate_series(
      greatest(e.data_inicio, p_inicio),
      least(e.data_fim, p_fim),
      interval '1 day'
    ) as d
   where e.bloqueia_ferias
     and e.data_inicio <= p_fim
     and e.data_fim    >= p_inicio
     and (
       not exists (select 1 from public.event_participants ep where ep.event_id = e.id)
       or exists (
         select 1 from public.event_participants ep
          where ep.event_id = e.id and ep.user_id = p_user_id
       )
     );
end
$funcao$;

comment on function public.eventos_que_bloqueiam is
  'Dias em que um evento com bloqueia_ferias atinge esta pessoa, com o nome do evento. Sem participantes, o evento vale para todo mundo (0055).';


-- ---------------------------------------------------------------------------
-- PASSO 6 - Quem recebe o aviso de um evento
--
-- O SINO GANHA UM TIPO, e vale dizer por que aqui isso e seguro quando a 0028
-- recusou exatamente a mesma operacao. La o pedido era `alter type task_status
-- add value 'rascunho'` e a migration USAVA o valor logo em seguida, num
-- default e num filtro -- e um valor de enum nao pode ser usado na mesma
-- transacao em que nasce, entao o arquivo colado no SQL Editor falharia na
-- hora de aplicar. Aqui o valor novo aparece SO dentro do corpo de uma funcao
-- plpgsql, que nao e executado durante a migration: quando o primeiro aviso
-- de evento for gravado, a transacao que criou o valor ja fechou ha muito.
-- ---------------------------------------------------------------------------
alter type public.notification_tipo add value if not exists 'evento';


--
-- `notificar()` nunca avisa quem causou o aviso, entao quem cria o evento nao
-- recebe nada -- e esta certo. Sem participantes o evento e da agencia, e
-- avisar a equipe inteira sobre toda reuniao de duas pessoas transformaria o
-- sino em ruido: o aviso sai SO quando ha participantes nomeados.
-- ---------------------------------------------------------------------------
create or replace function public.evento_avisa_participante()
returns trigger
language plpgsql
security definer
set search_path = public
as $funcao$
declare
  evento public.events%rowtype;
begin
  select * into evento from public.events where id = new.event_id;
  if not found then
    return new;
  end if;

  perform public.notificar(
    new.user_id,
    'evento',
    'Você entrou em ' || evento.nome,
    to_char(evento.data_inicio, 'DD/MM')
      || case when evento.data_fim > evento.data_inicio
              then ' a ' || to_char(evento.data_fim, 'DD/MM') else '' end,
    '/painel/calendario?evento=' || evento.id
  );

  return new;
end
$funcao$;

drop trigger if exists event_participants_avisa on public.event_participants;
create trigger event_participants_avisa
  after insert on public.event_participants
  for each row execute function public.evento_avisa_participante();


-- ---------------------------------------------------------------------------
-- PASSO 7 - A carga da equipe inteira, no periodo inteiro
--
-- A Linha do Tempo desenha uma linha por pessoa e uma celula por dia: com dez
-- pessoas e um mes, sao trezentas perguntas. Uma chamada de `carga_do_dia()`
-- por celula seria trezentas idas ao banco para montar uma tela.
--
-- ESTA FUNCAO NAO RECALCULA NADA. Ela percorre e CHAMA `carga_do_dia()`, que
-- e a fonte unica de carga do produto desde a 0035. Reescrever a conta aqui
-- daria dois numeros para a mesma pessoa no mesmo dia -- e a tela de
-- sobrecarga e exatamente onde isso vira discussao.
--
-- SO DIA UTIL. Sabado e domingo nao tem capacidade para comparar, e pintar a
-- celula do fim de semana de "vazio" faria a barra de ocupacao da semana
-- parecer sempre folgada.
-- ---------------------------------------------------------------------------
create or replace function public.carga_da_equipe(p_inicio date, p_fim date)
returns table (
  user_id               uuid,
  dia                   date,
  minutos_comprometidos integer,
  etapas                integer,
  etapas_sem_estimativa integer,
  ausente               boolean
)
language plpgsql
stable
set search_path = public
as $funcao$
begin
  -- O TETO DE 62 DIAS e proposital: a tela busca o mes visivel com uma semana
  -- de folga em cada ponta, e nunca o ano. Sem o teto, um parametro errado na
  -- URL viraria uma varredura de trezentos e sessenta e cinco dias por pessoa.
  if p_fim - p_inicio > 62 then
    raise exception 'Período longo demais para a carga: % dias.', p_fim - p_inicio
      using hint = 'O calendário busca o mês visível, com uma semana de folga em cada ponta.';
  end if;

  return query
  select
    p.id,
    d::date,
    c.minutos_comprometidos,
    c.etapas,
    c.etapas_sem_estimativa,
    c.ausente
  from public.profiles p
  join public.team_members tm on tm.user_id = p.id
  cross join generate_series(p_inicio, p_fim, interval '1 day') as d
  cross join lateral public.carga_do_dia(p.id, d::date) c
  where p.ativo
    and tm.ativo
    and extract(isodow from d) < 6;
end
$funcao$;

comment on function public.carga_da_equipe is
  'A carga de cada pessoa ativa em cada dia util do periodo. Percorre e CHAMA carga_do_dia() -- nao recalcula (0055).';
