-- ===========================================================================
-- 0011 - Full Days (RH interno) e o sino de notificacoes
--
-- Duas coisas neste arquivo, e a primeira nao estava no Sprint 6:
--
--   `notifications` existia no sprint-05 original, que foi SUBSTITUIDO pelo
--   Sprint 3B. O Sprint 6 pede "notifica todos os socios", entao a tabela
--   nasce aqui. Fica generica de proposito -- os proximos modulos usam a
--   mesma.
--
--   `hr_requests`, `team_presence` e `holidays`: pedir folga, o mapa de quem
--   esta onde, e o calendario que diz o que e dia util.
--
-- REGRA DE FERIAS DA CASA: 15 dias por ano, em ATE DUAS parcelas. Os dois
-- numeros ficam em colunas de `team_members`, e nao constantes no codigo:
-- contrato muda por pessoa, e mudar contrato nao pode exigir deploy.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - Notificacoes
--
-- Uma linha por aviso, por pessoa. `lida_em` nulo e o que o sino conta.
--
-- `link` guarda para onde o clique leva. Sem ele a notificacao vira um aviso
-- que a pessoa le e depois tem que descobrir sozinha onde resolver -- que e o
-- jeito mais rapido de um sino virar ruido que ninguem abre.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_tipo') then
    create type public.notification_tipo as enum (
      'task', 'aprovacao', 'full_days', 'equipe', 'cliente', 'sistema'
    );
  end if;
end;
$$;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tipo       public.notification_tipo not null default 'sistema',
  titulo     text not null,
  corpo      text,
  link       text,
  -- Quem causou o aviso. Serve para a tela dizer "Bruno pediu ferias" em vez
  -- de "uma solicitacao chegou", e para nao notificar a propria pessoa do que
  -- ela mesma fez.
  origem_id  uuid references public.profiles (id) on delete set null,
  lida_em    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Avisos in-app. lida_em nulo e o que o sino conta.';

create index if not exists notifications_pessoa_idx
  on public.notifications (user_id, created_at desc);
-- Indice parcial: a consulta que roda em TODA pagina e "quantas nao lidas eu
-- tenho". Sem o `where`, o indice cresceria com o historico inteiro para
-- responder uma pergunta que so olha para as poucas linhas abertas.
create index if not exists notifications_nao_lidas_idx
  on public.notifications (user_id) where lida_em is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_insert on public.notifications;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- O unico update que a pessoa faz e marcar como lida. A policy nao consegue
-- limitar COLUNA, entao um trigger trava o resto: sem ele, alguem poderia
-- reescrever o titulo do proprio aviso.
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.travar_notificacao()
returns trigger
language plpgsql
as $$
begin
  if new.user_id  is distinct from old.user_id
  or new.tipo     is distinct from old.tipo
  or new.titulo   is distinct from old.titulo
  or new.corpo    is distinct from old.corpo
  or new.link     is distinct from old.link
  or new.origem_id is distinct from old.origem_id then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'De uma notificacao so da para mudar se ela foi lida.';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_travar on public.notifications;
create trigger notifications_travar
  before update on public.notifications
  for each row execute function public.travar_notificacao();

-- SEM policy de INSERT para `authenticated`. Notificacao e criada por funcao
-- `security definer` do proprio banco, chamada de dentro das acoes -- se
-- qualquer usuario pudesse inserir, daria para forjar um aviso no nome de
-- outra pessoa, e um sino em que nao se confia e pior que nenhum sino.

create or replace function public.notificar(
  p_user_id uuid,
  p_tipo    public.notification_tipo,
  p_titulo  text,
  p_corpo   text default null,
  p_link    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := (select auth.uid());
  novo uuid;
begin
  -- Ninguem e avisado do que fez. O sino existe para o que os OUTROS fizeram.
  if p_user_id = quem then
    return null;
  end if;

  insert into public.notifications (user_id, tipo, titulo, corpo, link, origem_id)
  values (p_user_id, p_tipo, p_titulo, p_corpo, p_link, quem)
  returning id into novo;

  return novo;
end;
$$;

comment on function public.notificar is
  'Cria um aviso. Unica porta de escrita em notifications -- nao ha policy de insert.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Ferias no contrato de cada pessoa
--
-- 15 dias por ano, em ate duas parcelas -- e as duas coisas sao COLUNAS, nao
-- constantes no codigo. Contrato muda por pessoa (CLT, PJ, acordo), e mudar
-- contrato nao pode exigir deploy.
-- ---------------------------------------------------------------------------

-- `dias_ferias_ano` EXISTE DESDE A 0003, com padrao 30. `add column if not
-- exists` nao teria feito nada -- nem mudado o padrao, nem tocado nas linhas
-- ja gravadas --, e a regra da casa teria continuado valendo 30 em silencio.
-- O bug apareceu na bateria: um pedido de 16 dias passou.
alter table public.team_members
  add column if not exists dias_ferias_ano     integer not null default 15,
  add column if not exists max_parcelas_ferias integer not null default 2;

alter table public.team_members
  alter column dias_ferias_ano set default 15;

-- Quem ainda esta no padrao antigo passa para o da casa. `where = 30` e nao
-- um update geral: se alguem ja tiver um numero proprio por acordo de
-- contrato, ele fica.
update public.team_members set dias_ferias_ano = 15 where dias_ferias_ano = 30;

comment on column public.team_members.dias_ferias_ano is
  'Dias de ferias por ano desta pessoa. Padrao da casa: 15, em ate 2 parcelas.';
comment on column public.team_members.max_parcelas_ferias is
  'Em quantas vezes as ferias podem ser partidas. Padrao da casa: 2.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Feriados e o que e dia util
-- ---------------------------------------------------------------------------

create table if not exists public.holidays (
  id   uuid primary key default gen_random_uuid(),
  data date not null unique,
  nome text not null
);

comment on table public.holidays is
  'Feriados que nao contam como dia util. Inclui carnaval, que legalmente e ponto facultativo mas na pratica a agencia nao abre.';

alter table public.holidays enable row level security;

drop policy if exists holidays_select on public.holidays;
drop policy if exists holidays_write  on public.holidays;

create policy holidays_select on public.holidays
  for select to authenticated using (true);

create policy holidays_write on public.holidays
  for all to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- Feriados nacionais de 2026 e 2027. As datas moveis saem da Pascoa: 5 de
-- abril de 2026 e 28 de marco de 2027. Carnaval e Pascoa menos 47 dias,
-- Sexta-feira Santa e menos 2, Corpus Christi e mais 60.
insert into public.holidays (data, nome) values
  ('2026-01-01', 'Confraternizacao Universal'),
  ('2026-02-16', 'Carnaval'),
  ('2026-02-17', 'Carnaval'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independencia do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamacao da Republica'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Confraternizacao Universal'),
  ('2027-02-08', 'Carnaval'),
  ('2027-02-09', 'Carnaval'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-21', 'Tiradentes'),
  ('2027-05-01', 'Dia do Trabalho'),
  ('2027-05-27', 'Corpus Christi'),
  ('2027-09-07', 'Independencia do Brasil'),
  ('2027-10-12', 'Nossa Senhora Aparecida'),
  ('2027-11-02', 'Finados'),
  ('2027-11-15', 'Proclamacao da Republica'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciencia Negra'),
  ('2027-12-25', 'Natal')
on conflict (data) do nothing;

/**
 * Dias uteis entre duas datas, inclusive as pontas.
 *
 * Desconta sabado, domingo e feriado. E `stable`, nao `immutable`: o resultado
 * depende da tabela de feriados, que muda -- marcar como immutable deixaria o
 * Postgres guardar um resultado que envelhece no dia em que alguem cadastra um
 * feriado novo.
 */
create or replace function public.dias_uteis(inicio date, fim date)
returns integer
language plpgsql
stable
as $$
declare
  total integer;
begin
  if inicio is null or fim is null or fim < inicio then
    return 0;
  end if;

  select count(*)
    into total
    from generate_series(inicio, fim, interval '1 day') as d(dia)
   where extract(isodow from d.dia) < 6
     and not exists (select 1 from public.holidays h where h.data = d.dia::date);

  return total;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 4 - Solicitacoes e presenca
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'hr_tipo') then
    create type public.hr_tipo as enum ('ferias', 'licenca', 'ausencia');
  end if;
  if not exists (select 1 from pg_type where typname = 'hr_status') then
    create type public.hr_status as enum ('pendente', 'aprovada', 'reprovada', 'cancelada');
  end if;
  if not exists (select 1 from pg_type where typname = 'presenca_status') then
    create type public.presenca_status as enum (
      'presente', 'remoto', 'ferias', 'licenca', 'ausente', 'folga', 'feriado'
    );
  end if;
end;
$$;

create table if not exists public.hr_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  tipo              public.hr_tipo not null,
  data_inicio       date not null,
  data_fim          date not null,
  -- Gravado, e nao calculado na leitura, de proposito: se um feriado for
  -- cadastrado depois, o pedido ja aprovado nao pode mudar de tamanho
  -- retroativamente. O numero e o que valia no dia da decisao.
  dias_uteis        integer not null,
  motivo            text,
  status            public.hr_status not null default 'pendente',
  motivo_reprovacao text,
  aprovado_por      uuid references public.profiles (id),
  decidido_em       timestamptz,
  created_at        timestamptz not null default now(),
  constraint hr_requests_periodo check (data_fim >= data_inicio)
);

comment on table public.hr_requests is
  'Pedidos de ferias, licenca e ausencia. So socio decide.';

create index if not exists hr_requests_pessoa_idx
  on public.hr_requests (user_id, data_inicio desc);
create index if not exists hr_requests_status_idx
  on public.hr_requests (status, data_inicio);
create index if not exists hr_requests_periodo_idx
  on public.hr_requests (data_inicio, data_fim);

create table if not exists public.team_presence (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  data           date not null,
  status         public.presenca_status not null default 'presente',
  observacao     text,
  -- Quando a linha veio de um pedido aprovado, ela aponta para ele. E isso que
  -- impede a matriz de apagar ferias aprovadas com um clique distraido: para
  -- mudar, desfaz-se o pedido.
  hr_request_id  uuid references public.hr_requests (id) on delete set null,
  atualizado_por uuid references public.profiles (id),
  updated_at     timestamptz not null default now(),
  unique (user_id, data)
);

comment on table public.team_presence is
  'Um dia de uma pessoa. Linha com hr_request_id veio de pedido aprovado e nao se edita na mao.';

alter table public.team_presence
  add column if not exists hr_request_id uuid references public.hr_requests (id) on delete set null;

create index if not exists team_presence_data_idx on public.team_presence (data, user_id);

create or replace function public.tocar_team_presence()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists team_presence_tocar on public.team_presence;
create trigger team_presence_tocar
  before update on public.team_presence
  for each row execute function public.tocar_team_presence();


-- ---------------------------------------------------------------------------
-- PASSO 5 - As regras de ferias, no banco
--
-- A tela valida para escrever a frase que a pessoa le. Estes gatilhos valem
-- mesmo para quem chamar a API do Supabase direto.
-- ---------------------------------------------------------------------------

/** Saldo de ferias da pessoa no ano: contratado menos aprovado e pendente. */
create or replace function public.saldo_de_ferias(p_user_id uuid, p_ano integer)
returns integer
language plpgsql
stable
as $$
declare
  contratado integer;
  usado      integer;
begin
  select coalesce(dias_ferias_ano, 15) into contratado
    from public.team_members where user_id = p_user_id;

  if contratado is null then
    contratado := 15;
  end if;

  -- Pendente conta como usado. Nao contar faria a pessoa pedir 15 dias duas
  -- vezes enquanto o primeiro pedido espera decisao, e o socio aprovaria os
  -- dois sem ver o problema.
  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and extract(year from data_inicio) = p_ano;

  return contratado - usado;
end;
$$;

/** Quantas parcelas de ferias a pessoa ja tem no ano (pendentes + aprovadas). */
create or replace function public.parcelas_de_ferias(p_user_id uuid, p_ano integer)
returns integer
language plpgsql
stable
as $$
declare
  quantas integer;
begin
  select count(*) into quantas
    from public.hr_requests
   where user_id = p_user_id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and extract(year from data_inicio) = p_ano;
  return coalesce(quantas, 0);
end;
$$;

create or replace function public.validar_solicitacao()
returns trigger
language plpgsql
as $$
declare
  ano        integer := extract(year from new.data_inicio);
  contratado integer;
  parcelas   integer;
  usado      integer;
  sobrepoe   integer;
begin
  if new.dias_uteis <= 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'O periodo escolhido nao tem nenhum dia util.';
  end if;

  -- Sobreposicao com pedido proprio: vale para os tres tipos. Duas linhas
  -- cobrindo o mesmo dia deixariam a matriz sem saber qual mostrar.
  select count(*) into sobrepoe
    from public.hr_requests r
   where r.user_id = new.user_id
     and r.id is distinct from new.id
     and r.status in ('pendente', 'aprovada')
     and r.data_inicio <= new.data_fim
     and r.data_fim    >= new.data_inicio;

  if sobrepoe > 0 then
    raise exception using
      errcode = 'check_violation',
      message = 'Voce ja tem um pedido cobrindo parte desse periodo.';
  end if;

  if new.tipo <> 'ferias' then
    return new;
  end if;

  -- Ferias atravessando o ano viraria duas contas de saldo diferentes para o
  -- mesmo pedido. Melhor pedir dois.
  if extract(year from new.data_fim) <> ano then
    raise exception using
      errcode = 'check_violation',
      message = 'Ferias que atravessam o ano precisam ser dois pedidos, um em cada ano.';
  end if;

  select coalesce(dias_ferias_ano, 15), coalesce(max_parcelas_ferias, 2)
    into contratado, parcelas
    from public.team_members where user_id = new.user_id;

  contratado := coalesce(contratado, 15);
  parcelas   := coalesce(parcelas, 2);

  select coalesce(sum(dias_uteis), 0) into usado
    from public.hr_requests
   where user_id = new.user_id
     and id is distinct from new.id
     and tipo = 'ferias'
     and status in ('pendente', 'aprovada')
     and extract(year from data_inicio) = ano;

  if usado + new.dias_uteis > contratado then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'Sao %s dias de ferias por ano. Voce ja tem %s comprometidos em %s, entao sobram %s.',
        contratado, usado, ano, contratado - usado
      );
  end if;

  if (select count(*) from public.hr_requests
       where user_id = new.user_id
         and id is distinct from new.id
         and tipo = 'ferias'
         and status in ('pendente', 'aprovada')
         and extract(year from data_inicio) = ano) >= parcelas then
    raise exception using
      errcode = 'check_violation',
      message = format(
        'As ferias podem ser partidas em ate %s vezes por ano, e voce ja usou as %s.',
        parcelas, parcelas
      );
  end if;

  return new;
end;
$$;

drop trigger if exists hr_requests_validar on public.hr_requests;
create trigger hr_requests_validar
  before insert or update of data_inicio, data_fim, dias_uteis, tipo, status
  on public.hr_requests
  for each row
  when (new.status in ('pendente', 'aprovada'))
  execute function public.validar_solicitacao();


-- ---------------------------------------------------------------------------
-- PASSO 6 - A decisao do socio, em uma transacao
--
-- Aprovar faz TRES coisas: muda o status, pinta os dias na matriz e avisa o
-- solicitante. O sprint pede que sejam transacionais -- se a escrita em
-- team_presence falhar, a solicitacao nao muda de status.
--
-- Por isso mora numa funcao do banco, e nao em tres chamadas seguidas da
-- Server Action: tres chamadas pelo PostgREST sao tres transacoes, e a segunda
-- falhando deixaria um pedido "aprovado" sem nenhum dia pintado. Dentro de uma
-- funcao plpgsql e tudo ou nada.
--
-- `security definer` porque a funcao escreve em team_presence no nome de OUTRA
-- pessoa -- a policy de team_presence nao permitiria isso direto. A primeira
-- linha do corpo e a conferencia de que quem chama e socio.
-- ---------------------------------------------------------------------------

create or replace function public.decidir_solicitacao(
  p_request_id uuid,
  p_decisao    public.hr_status,
  p_motivo     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido     public.hr_requests%rowtype;
  quem       uuid := (select auth.uid());
  status_dia public.presenca_status;
  rotulo     text;
begin
  if not public.is_socio() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Aprovar e reprovar Full Days e do socio.';
  end if;

  if p_decisao not in ('aprovada', 'reprovada') then
    raise exception using
      errcode = 'check_violation',
      message = 'A decisao e aprovar ou reprovar.';
  end if;

  select * into pedido from public.hr_requests where id = p_request_id for update;

  if not found then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if pedido.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta solicitacao ja foi decidida.';
  end if;

  update public.hr_requests
     set status            = p_decisao,
         motivo_reprovacao = case when p_decisao = 'reprovada' then p_motivo else null end,
         aprovado_por      = quem,
         decidido_em       = now()
   where id = p_request_id;

  if p_decisao = 'aprovada' then
    status_dia := case pedido.tipo
                    when 'ferias'   then 'ferias'
                    when 'licenca'  then 'licenca'
                    else 'ausente'
                  end::public.presenca_status;

    -- So os dias uteis viram linha. Pintar sabado e feriado de "ferias" na
    -- matriz faria a contagem visual discordar do numero de dias uteis que a
    -- pessoa pediu.
    insert into public.team_presence (user_id, data, status, hr_request_id, atualizado_por)
    select pedido.user_id, d.dia::date, status_dia, pedido.id, quem
      from generate_series(pedido.data_inicio, pedido.data_fim, interval '1 day') as d(dia)
     where extract(isodow from d.dia) < 6
       and not exists (select 1 from public.holidays h where h.data = d.dia::date)
    on conflict (user_id, data) do update
      set status         = excluded.status,
          hr_request_id  = excluded.hr_request_id,
          atualizado_por = excluded.atualizado_por;
  end if;

  rotulo := case pedido.tipo
              when 'ferias'  then 'Ferias'
              when 'licenca' then 'Licenca'
              else 'Ausencia'
            end;

  perform public.notificar(
    pedido.user_id,
    'full_days',
    case when p_decisao = 'aprovada'
      then format('%s aprovada', rotulo)
      else format('%s reprovada', rotulo)
    end,
    case when p_decisao = 'aprovada'
      then format('%s a %s, %s dia(s) util(eis).',
             to_char(pedido.data_inicio, 'DD/MM/YYYY'),
             to_char(pedido.data_fim, 'DD/MM/YYYY'),
             pedido.dias_uteis)
      else coalesce(nullif(btrim(p_motivo), ''), 'Sem motivo registrado.')
    end,
    '/painel/full-days'
  );
end;
$$;

/**
 * Cancelar o proprio pedido.
 *
 * So pendente, e so o dono -- cancelar ferias ja aprovadas e conversa com o
 * socio, nao um botao. Quando um dia isso for permitido, o caminho sera este
 * mesmo, com a limpeza de team_presence junto.
 */
create or replace function public.cancelar_solicitacao(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido public.hr_requests%rowtype;
  quem   uuid := (select auth.uid());
begin
  select * into pedido from public.hr_requests where id = p_request_id for update;

  if not found then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  if pedido.user_id <> quem then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Este pedido nao e seu.';
  end if;

  if pedido.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'So da para cancelar um pedido que ainda espera decisao. Fale com o socio.';
  end if;

  update public.hr_requests set status = 'cancelada' where id = p_request_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 7 - RLS
-- ---------------------------------------------------------------------------

alter table public.hr_requests  enable row level security;
alter table public.team_presence enable row level security;

drop policy if exists hr_requests_select on public.hr_requests;
drop policy if exists hr_requests_insert on public.hr_requests;
drop policy if exists hr_requests_update on public.hr_requests;
drop policy if exists hr_requests_delete on public.hr_requests;

-- Le o proprio, e a gestao le tudo: e ela que precisa ver quem esta fora para
-- decidir e para planejar. O colaborador NAO ve o pedido dos colegas.
create policy hr_requests_select on public.hr_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

-- Cria so para si, e so quem e da equipe. Cliente nao tem Full Days.
create policy hr_requests_insert on public.hr_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff());

-- O UPDATE direto e so do dono e so enquanto pendente: e o que permite
-- corrigir as datas antes de alguem olhar. Aprovar, reprovar e cancelar NAO
-- passam por aqui -- passam pelas funcoes do PASSO 6, que conferem quem e
-- quem. Sem esta restricao a `pendente`, qualquer pessoa marcaria o proprio
-- pedido como 'aprovada' com um update.
create policy hr_requests_update on public.hr_requests
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pendente')
  with check (user_id = (select auth.uid()) and status = 'pendente');

-- Sem DELETE: pedido decidido e historico de RH. Cancelar e um status.

drop policy if exists team_presence_select on public.team_presence;
drop policy if exists team_presence_insert on public.team_presence;
drop policy if exists team_presence_update on public.team_presence;
drop policy if exists team_presence_delete on public.team_presence;

create policy team_presence_select on public.team_presence
  for select to authenticated
  using (public.is_staff());

-- A pessoa marca o PROPRIO dia, e so o de hoje: "trabalhei remoto hoje" e o
-- caso real. Reescrever a semana passada e coisa de gestao, senao a matriz
-- vira ficcao retroativa.
create policy team_presence_insert on public.team_presence
  for insert to authenticated
  with check (
    public.is_gestor()
    or (user_id = (select auth.uid()) and data = current_date and public.is_staff())
  );

create policy team_presence_update on public.team_presence
  for update to authenticated
  using (
    public.is_gestor()
    or (user_id = (select auth.uid()) and data = current_date)
  )
  with check (
    public.is_gestor()
    or (user_id = (select auth.uid()) and data = current_date)
  );

create policy team_presence_delete on public.team_presence
  for delete to authenticated
  using (public.is_gestor());

/**
 * Dia que veio de pedido aprovado nao se edita na mao.
 *
 * Sem isso, um clique na matriz apagaria as ferias de alguem e o pedido
 * continuaria dizendo "aprovada" -- duas verdades sobre o mesmo dia. Para
 * mudar, desfaz-se o pedido.
 */
create or replace function public.proteger_presenca_de_pedido()
returns trigger
language plpgsql
as $$
begin
  if old.hr_request_id is not null
     and new.hr_request_id is not distinct from old.hr_request_id
     and new.status is distinct from old.status then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Este dia veio de uma solicitacao aprovada. Desfaca a solicitacao para mudar.';
  end if;
  return new;
end;
$$;

drop trigger if exists team_presence_proteger on public.team_presence;
create trigger team_presence_proteger
  before update on public.team_presence
  for each row execute function public.proteger_presenca_de_pedido();
