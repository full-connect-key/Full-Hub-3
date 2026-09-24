-- ---------------------------------------------------------------------------
-- 0033 - Campanhas, entregaveis e os templates
--
-- Sprint 13. O outro fluxo do cliente. O post e uma peca solta com uma data;
-- a campanha e um conjunto com comeco, fim e ESTRUTURA -- entregaveis de topo,
-- alguns deles grupos com sub-itens, cada um decidido por conta propria.
--
-- E O TERCEIRO ATO DA 0030. Ela generalizou a rodada e deixou 'deliverable'
-- recusado, com a frase escrita la: quem acrescentar o tipo acrescenta a regra
-- na mesma migration. A 0032 fez isso para 'post'; esta faz para
-- 'deliverable', e com isso os tres tipos do enum passam a ter dono.
--
-- QUATRO DECISOES QUE VALE LER ANTES DE MEXER:
--
-- 1. O STATUS DO GRUPO E DERIVADO, e nao existe coluna para ele. E a mesma
--    regra que a Task ja segue com as subtarefas e que a etapa segue com as
--    sub-etapas: quem tem filha para de ser unidade de trabalho. Guardar o
--    status do grupo criaria duas verdades sobre o mesmo fato, e a que
--    diverge em silencio e a que o cliente le.
--
--    `status_do_entregavel()` no Postgres e `statusDoEntregavel()` em
--    `lib/dominio/campanhas.ts` fazem a mesma conta nos dois lados, como
--    `situacao_do_lancamento()` no Financeiro: um decide o que contar, o
--    outro o que desenhar.
--
-- 2. A CONTA "X DE Y APROVADOS" OLHA SO AS FOLHAS. Um grupo com quinze
--    sub-itens e uma linha na arvore e quinze entregas no trabalho. Contar o
--    grupo tambem faria "16 de 16" onde ha quinze coisas -- e a barra de
--    progresso andaria sozinha quando o ultimo filho fosse aprovado.
--
-- 3. O CLIENTE SO ENXERGA ENTREGAVEL ENVIADO, pela mesma linha que vale para
--    o post: `enviado_em is not null`, na policy e nao na consulta. Um item
--    em producao nao existe para ele -- nem na arvore, nem pela URL direta,
--    nem pela API chamada a mao. E a campanha inteira ele ve: ela tem nome,
--    periodo e progresso desde o planejamento, e esconde-la ate o primeiro
--    envio faria a conta de "quantas campanhas minhas estao ativas" mentir.
--
-- 4. O TEMPLATE E UMA ARVORE EM `jsonb`, e nao um par de tabelas. A diferenca
--    para o workflow de task -- que TEM tabelas -- e que o workflow guarda
--    funcao, prazo relativo e responsavel por etapa, coisas que se consultam;
--    o template de campanha guarda uma lista de nomes que alguem edita inteira
--    antes de salvar. Normalizar isso seria criar duas tabelas para servir um
--    `select * where id = ?`.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O ciclo de vida da campanha
--
-- Distinto de `content_status`, e de proposito: aquele e o estado de uma PECA
-- no fluxo de aprovacao, este e o da campanha como projeto. "Em aprovacao" nao
-- quer dizer nada sobre uma campanha; "finalizada" nao quer dizer nada sobre
-- um arquivo.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'campaign_status') then
    create type public.campaign_status as enum (
      'planejamento', 'ativa', 'finalizada', 'cancelada'
    );
  end if;
end
$$;

comment on type public.campaign_status is
  'O ciclo de vida da campanha como projeto. Nao se confunde com content_status, que e da peca (0033).';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As tabelas
-- ---------------------------------------------------------------------------

-- `client_id` NULO quer dizer template da casa, que serve a todo cliente. E a
-- razao de a coluna existir: a Wave e um formato da agencia, mas um cliente
-- grande acaba tendo o proprio -- e sem a coluna ele apareceria na lista de
-- todos os outros.
create table if not exists public.campaign_templates (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  descricao      text,
  estrutura_json jsonb not null,
  client_id      uuid references public.clients (id) on delete cascade,
  ativo          boolean not null default true,
  criado_por     uuid references public.profiles (id),
  created_at     timestamptz not null default now()
);

create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  nome            text not null,
  descricao       text,
  data_inicio     date not null,
  data_fim        date not null,
  template_id     uuid references public.campaign_templates (id),
  status          public.campaign_status not null default 'planejamento',
  drive_folder_id text,
  criado_por      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_periodo') then
    alter table public.campaigns
      add constraint campaigns_periodo check (data_fim >= data_inicio);
  end if;
end
$$;

-- `parent_id` da os DOIS NIVEIS, e sao dois e nunca tres -- a mesma razao da
-- sub-etapa e da thread das Recomendacoes: arvore que passa de dois niveis na
-- tela do cliente e arvore que ninguem acompanha, e o recuo deixa de
-- significar alguma coisa. Quem recusa o neto e o trigger, mais abaixo.
create table if not exists public.deliverables (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  parent_id      uuid references public.deliverables (id) on delete cascade,
  -- A etapa que produziu o entregavel. Opcional, como no post: um item pode
  -- nascer direto do template, antes de alguem abrir demanda para ele.
  subtask_id     uuid references public.subtasks (id) on delete set null,
  nome           text not null,
  descricao      text,
  ordem          integer not null default 0,
  status         public.content_status not null default 'aguardando_informacoes',
  prazo          date,
  arte_url       text,
  thumbnail_url  text,
  arquivo_nome   text,
  versao_atual   integer not null default 1,
  responsavel_id uuid references public.profiles (id),
  enviado_em     timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.deliverable_versions (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null references public.deliverables (id) on delete cascade,
  numero_versao   integer not null,
  arte_url        text,
  thumbnail_url   text,
  arquivo_nome    text,
  notas_mudanca   text,
  criado_por      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (deliverable_id, numero_versao)
);

create index if not exists deliverables_arvore_idx
  on public.deliverables (campaign_id, parent_id, ordem);
create index if not exists campaigns_cliente_idx
  on public.campaigns (client_id, data_fim);

comment on table public.campaigns is
  'Uma campanha do cliente, com periodo e estrutura de entregaveis (0033).';
comment on table public.deliverables is
  'Um entregavel da campanha. parent_id nulo = topo. O cliente so ve o que tem enviado_em (0033).';
comment on column public.deliverables.enviado_em is
  'Quando o entregavel foi enviado ao cliente. Nulo = invisivel para ele, pela policy.';
comment on table public.deliverable_versions is
  'O historico de arquivos de um entregavel. Reverter e do painel interno, nunca do portal (0033).';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Dois niveis, e nunca tres
-- ---------------------------------------------------------------------------
create or replace function public.entregavel_sem_neto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  avo_existe boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  avo_existe := (
    select d.parent_id is not null from public.deliverables d where d.id = new.parent_id
  );

  if coalesce(avo_existe, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'A campanha tem dois níveis: entregável e sub-item.',
      hint    = 'Crie o sub-item dentro de um entregável de topo.';
  end if;

  return new;
end;
$$;

drop trigger if exists deliverables_dois_niveis on public.deliverables;
create trigger deliverables_dois_niveis
  before insert or update on public.deliverables
  for each row execute function public.entregavel_sem_neto();


-- ---------------------------------------------------------------------------
-- PASSO 4 - QUEM TEM FILHO E GRUPO, e grupo nao tem status proprio
--
-- Mesma regra da Task com as subtarefas e da etapa com as sub-etapas, um nivel
-- adiante. O status escrito num grupo e DESCARTADO em vez de recusado: quem
-- edita o grupo quase sempre esta mexendo em outra coluna (o nome, a ordem, o
-- prazo), e recusar o update inteiro por causa de um campo que a tela nem
-- mostra seria travar o trabalho para proteger um valor que ninguem le.
-- ---------------------------------------------------------------------------
create or replace function public.entregavel_eh_grupo(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (select 1 from public.deliverables d where d.parent_id = p_id);
end;
$$;

create or replace function public.status_do_entregavel(p_id uuid)
returns public.content_status
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  proprio public.content_status;
begin
  if not public.entregavel_eh_grupo(p_id) then
    select d.status into proprio from public.deliverables d where d.id = p_id;
    return proprio;
  end if;

  -- A PRECEDENCIA, na ordem, e a mesma ideia de recalcular_status_task: o
  -- estado que PEDE ACAO ganha do que nao pede.
  --
  -- `rejeitado` num filho NAO faz o grupo ficar rejeitado, e a escolha e
  -- deliberada. Ninguem recusou o grupo -- recusaram uma peca dentro dele, e
  -- o que o grupo precisa dizer e "tem coisa para refazer aqui". `ajustes` e
  -- exatamente isso, e e o tom de atencao; `rejeitado` e o de erro, e pintaria
  -- de vermelho um grupo em que catorze de quinze itens estao aprovados.
  if exists (select 1 from public.deliverables d
              where d.parent_id = p_id and d.status in ('ajustes', 'rejeitado')) then
    return 'ajustes';
  end if;

  if exists (select 1 from public.deliverables d
              where d.parent_id = p_id and d.status = 'em_aprovacao') then
    return 'em_aprovacao';
  end if;

  if not exists (select 1 from public.deliverables d
                  where d.parent_id = p_id and d.status <> 'aprovado') then
    return 'aprovado';
  end if;

  if exists (select 1 from public.deliverables d
              where d.parent_id = p_id and d.status = 'aguardando_informacoes') then
    return 'aguardando_informacoes';
  end if;

  if exists (select 1 from public.deliverables d
              where d.parent_id = p_id and d.status = 'em_producao') then
    return 'em_producao';
  end if;

  return 'stand_by';
end;
$$;

comment on function public.status_do_entregavel is
  'O status que o grupo MOSTRA, calculado pelos filhos. Nao existe coluna para ele (0033).';


-- ---------------------------------------------------------------------------
-- PASSO 5 - A versao se numera sozinha, como a do post
-- ---------------------------------------------------------------------------
create or replace function public.numerar_versao_do_entregavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.numero_versao := (
    select coalesce(max(v.numero_versao), 0) + 1
      from public.deliverable_versions v where v.deliverable_id = new.deliverable_id
  );
  new.criado_por := coalesce(new.criado_por, (select auth.uid()));
  return new;
end;
$$;

drop trigger if exists deliverable_versions_numera on public.deliverable_versions;
create trigger deliverable_versions_numera
  before insert on public.deliverable_versions
  for each row execute function public.numerar_versao_do_entregavel();

create or replace function public.sincronizar_entregavel_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliverables
     set versao_atual  = new.numero_versao,
         arte_url      = coalesce(new.arte_url, arte_url),
         thumbnail_url = coalesce(new.thumbnail_url, thumbnail_url),
         arquivo_nome  = coalesce(new.arquivo_nome, arquivo_nome)
   where id = new.deliverable_id
     and new.numero_versao >= versao_atual;

  return new;
end;
$$;

drop trigger if exists deliverable_versions_sincroniza on public.deliverable_versions;
create trigger deliverable_versions_sincroniza
  after insert on public.deliverable_versions
  for each row execute function public.sincronizar_entregavel_com_a_versao();


-- ---------------------------------------------------------------------------
-- PASSO 6 - Quem ve o que
-- ---------------------------------------------------------------------------
create or replace function public.entregavel_visivel_ao_cliente(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
      from public.deliverables d
      join public.campaigns c on c.id = d.campaign_id
     where d.id = p_id
       and d.enviado_em is not null
       and c.client_id in (select public.my_client_ids())
  );
end;
$$;

-- Irma de `pode_aprovar_post` e de `pode_aprovar_subtarefa`. As tres sao
-- `is_gestor()` e nada mais desde a 0029; existem separadas para que o dia em
-- que uma delas mudar nao mude as outras por engano.
create or replace function public.pode_aprovar_entregavel(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return public.is_gestor();
end;
$$;

-- A pergunta do comentario aprende o terceiro tipo. 'deliverable' deixa de
-- cair no `false` que a 0032 deixou de proposito.
create or replace function public.conteudo_visivel_ao_cliente(
  p_content_type text,
  p_content_id   uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_content_type = 'post' then
    return public.post_visivel_ao_cliente(p_content_id);
  end if;

  if p_content_type = 'deliverable' then
    return public.entregavel_visivel_ao_cliente(p_content_id);
  end if;

  return false;
end;
$$;


alter table public.campaign_templates   enable row level security;
alter table public.campaigns            enable row level security;
alter table public.deliverables         enable row level security;
alter table public.deliverable_versions enable row level security;

-- campaign_templates --------------------------------------------------------
--
-- O CLIENTE NAO LE TEMPLATE, e a ausencia de policy para ele e a decisao. O
-- template e o formato de trabalho da agencia -- a lista do que ela entrega
-- numa Wave. Para o cliente isso e processo interno, e mostrar a estrutura
-- vazia de uma campanha que ainda nao existe so gera pergunta sobre item que
-- talvez nem entre.
drop policy if exists campaign_templates_select on public.campaign_templates;
drop policy if exists campaign_templates_insert on public.campaign_templates;
drop policy if exists campaign_templates_update on public.campaign_templates;
drop policy if exists campaign_templates_delete on public.campaign_templates;

create policy campaign_templates_select on public.campaign_templates
  for select to authenticated using (public.is_staff());

create policy campaign_templates_insert on public.campaign_templates
  for insert to authenticated with check (public.is_gestor());

create policy campaign_templates_update on public.campaign_templates
  for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

create policy campaign_templates_delete on public.campaign_templates
  for delete to authenticated using (public.is_socio());

-- campaigns -----------------------------------------------------------------
drop policy if exists campaigns_select         on public.campaigns;
drop policy if exists campaigns_select_cliente on public.campaigns;
drop policy if exists campaigns_insert         on public.campaigns;
drop policy if exists campaigns_update         on public.campaigns;
drop policy if exists campaigns_delete         on public.campaigns;

create policy campaigns_select on public.campaigns
  for select to authenticated using (public.is_staff());

-- A CAMPANHA O CLIENTE VE DESDE O PLANEJAMENTO, ao contrario do entregavel.
-- Ela tem nome, periodo e progresso, e e isso que responde "o que a Full esta
-- fazendo para mim este mes". Esconde-la ate o primeiro envio faria a lista de
-- campanhas ativas contar menos do que existe -- e o cliente ja sabe que a
-- campanha existe: foi ele quem pediu.
create policy campaigns_select_cliente on public.campaigns
  for select to authenticated
  using (client_id in (select public.my_client_ids()));

create policy campaigns_insert on public.campaigns
  for insert to authenticated with check (public.is_staff());

create policy campaigns_update on public.campaigns
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy campaigns_delete on public.campaigns
  for delete to authenticated using (public.is_gestor());

-- deliverables --------------------------------------------------------------
drop policy if exists deliverables_select         on public.deliverables;
drop policy if exists deliverables_select_cliente on public.deliverables;
drop policy if exists deliverables_insert         on public.deliverables;
drop policy if exists deliverables_update         on public.deliverables;
drop policy if exists deliverables_delete         on public.deliverables;

create policy deliverables_select on public.deliverables
  for select to authenticated using (public.is_staff());

-- A LINHA QUE SEGURA O SPRINT, e e a mesma do post: `enviado_em is not null`.
-- Entregavel em producao nao existe para o cliente -- nem na arvore, nem pela
-- URL direta, nem pela API com o id na mao. A consulta de
-- `lib/dados/campanhas.ts` nao repete o filtro de proposito.
create policy deliverables_select_cliente on public.deliverables
  for select to authenticated
  using (
    enviado_em is not null
    and campaign_id in (
      select c.id from public.campaigns c
       where c.client_id in (select public.my_client_ids())
    )
  );

-- O cliente NAO edita estrutura, prazo nem arquivo. Ele decide, e decidir
-- passa pelo motor -- que e `security definer` e roda como dono da tabela.
create policy deliverables_insert on public.deliverables
  for insert to authenticated with check (public.is_staff());

create policy deliverables_update on public.deliverables
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy deliverables_delete on public.deliverables
  for delete to authenticated using (public.is_staff());

-- deliverable_versions ------------------------------------------------------
drop policy if exists deliverable_versions_select on public.deliverable_versions;
drop policy if exists deliverable_versions_insert on public.deliverable_versions;
drop policy if exists deliverable_versions_update on public.deliverable_versions;
drop policy if exists deliverable_versions_delete on public.deliverable_versions;

create policy deliverable_versions_select on public.deliverable_versions
  for select to authenticated
  using (public.is_staff() or public.entregavel_visivel_ao_cliente(deliverable_id));

create policy deliverable_versions_insert on public.deliverable_versions
  for insert to authenticated with check (public.is_staff());

create policy deliverable_versions_update on public.deliverable_versions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy deliverable_versions_delete on public.deliverable_versions
  for delete to authenticated using (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 7 - O motor de aprovacao aprende 'deliverable'
--
-- Com isto os TRES tipos do enum tem dono, e a frase que a 0030 deixou --
-- "tipo sem regra e tipo recusado" -- deixa de ter exemplo. Ela fica no lugar
-- assim mesmo: e a regra para o quarto tipo, se um dia existir.
-- ---------------------------------------------------------------------------
create or replace function public.entregavel_da_rodada(p_content_type text, p_content_id uuid)
returns uuid
language plpgsql
immutable
as $$
begin
  return case when p_content_type = 'deliverable' then p_content_id end;
end;
$$;


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

    -- GRUPO NAO VAI PARA APROVACAO, e e a mesma regra da etapa agrupadora: o
    -- status dele e calculado pelos filhos, entao uma rodada dele prometeria
    -- uma decisao que o calculo desfaz no instante seguinte. Quem o cliente
    -- decide e o sub-item.
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

      if new.solicitado_por = dono then
        raise exception using
          errcode = 'check_violation',
          message = 'Ninguém envia ao cliente a própria entrega.',
          hint    = 'Quem aprovou internamente é quem envia.';
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
    dono := (select p.criado_por from public.posts p where p.id = post);

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
      if not public.is_gestor() then
        raise exception using
          errcode = 'check_violation',
          message = 'Enviar para o cliente é do Desenvolvedor.',
          hint    = 'Quem produz o post nunca o envia ao cliente.';
      end if;

      if new.solicitado_por = dono then
        raise exception using
          errcode = 'check_violation',
          message = 'Ninguém envia ao cliente a própria entrega.',
          hint    = 'Quem aprovou internamente é quem envia.';
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

    if new.solicitado_por = dono then
      raise exception using
        errcode = 'check_violation',
        message = 'Ninguém envia ao cliente a própria entrega.',
        hint    = 'Quem aprovou internamente é quem envia.';
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


-- ---------------------------------------------------------------------------
-- PASSO 8 - Enviar continua sendo abrir a rodada
--
-- A 0032 fez isso para o post, com `marcar_post_como_enviado`. A funcao passa
-- a servir os dois e muda de nome: um trigger chamado "marcar post" que
-- carimba entregavel e uma pista falsa para quem for procurar.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_conteudo_como_enviado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.escopo <> 'cliente' then
    return new;
  end if;

  if new.content_type = 'post' then
    update public.posts
       set enviado_em = coalesce(enviado_em, now()),
           status     = 'em_aprovacao'
     where id = new.content_id;
  elsif new.content_type = 'deliverable' then
    update public.deliverables
       set enviado_em = coalesce(enviado_em, now()),
           status     = 'em_aprovacao'
     where id = new.content_id;
  end if;

  return new;
end;
$$;

drop trigger if exists approval_rounds_marca_post     on public.approval_rounds;
drop trigger if exists approval_rounds_marca_conteudo on public.approval_rounds;
create trigger approval_rounds_marca_conteudo
  after insert on public.approval_rounds
  for each row execute function public.marcar_conteudo_como_enviado();

drop function if exists public.marcar_post_como_enviado();


-- ---------------------------------------------------------------------------
-- PASSO 9 - A decisao do cliente aprende o terceiro tipo
--
-- Continua UMA funcao. O que muda por tipo e o efeito: qual tabela recebe o
-- novo status e onde fica o registro.
-- ---------------------------------------------------------------------------
create or replace function public.decidir_rodada_do_cliente(
  p_round_id   uuid,
  p_decisao    public.status_rodada,
  p_comentario text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.approval_rounds%rowtype;
  alvo       uuid;
  post       uuid;
  entr       uuid;
  id_da_task uuid;
  p          public.posts%rowtype;
  d          public.deliverables%rowtype;
  atendente  uuid;
  quem       uuid := (select auth.uid());
  nome_quem  text;
  novo       public.content_status;
  verbo      text;
begin
  r := (select ar from public.approval_rounds ar where ar.id = p_round_id);

  if r.id is null then
    raise exception 'Rodada não encontrada.';
  end if;

  if r.escopo <> 'cliente' then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Esta rodada não é uma aprovação de cliente.';
  end if;

  if r.status <> 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Esta rodada já foi decidida.';
  end if;

  if p_decisao = 'pendente' then
    raise exception using
      errcode = 'check_violation',
      message = 'Decidir é aprovar, rejeitar ou pedir ajustes.';
  end if;

  if p_decisao in ('ajustes_solicitados', 'rejeitada')
     and (p_comentario is null or btrim(p_comentario) = '') then
    raise exception using
      errcode = 'check_violation',
      message = case p_decisao
                  when 'rejeitada' then 'Diga por que o material foi recusado.'
                  else 'Diga o que precisa ser ajustado.'
                end;
  end if;

  alvo := public.subtask_da_rodada(r.content_type, r.content_id);
  post := public.post_da_rodada(r.content_type, r.content_id);
  entr := public.entregavel_da_rodada(r.content_type, r.content_id);

  if alvo is null and post is null and entr is null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = format('Aprovação de "%s" ainda não é decidida por aqui.', r.content_type);
  end if;

  -- O novo status e o mesmo de-para para post e entregavel: os dois usam
  -- `content_status`, e e por isso que o cliente ve a mesma palavra nos dois
  -- modulos.
  novo := (case p_decisao
             when 'aprovada'  then 'aprovado'
             when 'rejeitada' then 'rejeitado'
             else 'ajustes'
           end)::public.content_status;

  verbo := case p_decisao
             when 'aprovada'  then 'aprovou'
             when 'rejeitada' then 'recusou'
             else 'pediu ajustes em'
           end;

  select pr.nome into nome_quem from public.profiles pr where pr.id = quem;

  -- ------------------------------------------------------------- entregavel
  if entr is not null then
    if not public.entregavel_visivel_ao_cliente(entr) then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'Sem acesso a esta aprovação.';
    end if;

    update public.approval_rounds
       set status = p_decisao, decidido_por = quem, decidido_em = now(), comentario = p_comentario
     where id = p_round_id;

    -- SO O ITEM DECIDIDO MUDA. O grupo nao e tocado -- o status dele e
    -- calculado, e aprovar um sub-item nao aprova os irmaos.
    update public.deliverables set status = novo where id = entr;

    d := (select dd from public.deliverables dd where dd.id = entr);

    if p_comentario is not null and btrim(p_comentario) <> '' then
      insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto, interno)
      values ('deliverable', entr, p_round_id, quem, p_comentario, false);
    end if;

    atendente := (
      select c.responsavel_atendimento_id
        from public.campaigns camp
        join public.clients c on c.id = camp.client_id
       where camp.id = d.campaign_id
    );

    perform public.notificar(
      atendente, 'aprovacao',
      format('%s %s "%s"', coalesce(nome_quem, 'O cliente'), verbo, d.nome),
      p_comentario, '/painel/aprovacoes');

    if d.responsavel_id is distinct from atendente then
      perform public.notificar(
        d.responsavel_id, 'aprovacao',
        format('%s %s "%s"', coalesce(nome_quem, 'O cliente'), verbo, d.nome),
        p_comentario, '/painel/aprovacoes');
    end if;

    return;
  end if;

  -- ------------------------------------------------------------------- post
  if post is not null then
    if not public.post_visivel_ao_cliente(post) then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'Sem acesso a esta aprovação.';
    end if;

    update public.approval_rounds
       set status = p_decisao, decidido_por = quem, decidido_em = now(), comentario = p_comentario
     where id = p_round_id;

    update public.posts set status = novo where id = post;

    p := (select ps from public.posts ps where ps.id = post);

    if p_comentario is not null and btrim(p_comentario) <> '' then
      insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto, interno)
      values ('post', post, p_round_id, quem, p_comentario, false);
    end if;

    atendente := (
      select c.responsavel_atendimento_id from public.clients c where c.id = p.client_id
    );

    perform public.notificar(
      atendente, 'aprovacao',
      format('%s %s "%s"', coalesce(nome_quem, 'O cliente'), verbo, p.tema),
      p_comentario, '/painel/gestao-tasks');

    if p.criado_por is distinct from atendente then
      perform public.notificar(
        p.criado_por, 'aprovacao',
        format('%s %s "%s"', coalesce(nome_quem, 'O cliente'), verbo, p.tema),
        p_comentario, '/painel/gestao-tasks');
    end if;

    return;
  end if;

  -- ---------------------------------------------------------------- subtask
  if p_decisao = 'rejeitada' then
    raise exception using
      errcode = 'check_violation',
      message = 'Etapa de demanda não é recusada: ou está aprovada, ou volta para ajustes.',
      hint    = 'Peça ajustes dizendo o que falta.';
  end if;

  if not public.subtask_visivel_ao_cliente(alvo) then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Sem acesso a esta aprovação.';
  end if;

  update public.approval_rounds
     set status = p_decisao, decidido_por = quem, decidido_em = now(), comentario = p_comentario
   where id = p_round_id;

  update public.subtasks
     set status = (case when p_decisao = 'aprovada' then 'concluida' else 'em_ajustes' end)::public.subtask_status
   where id = alvo;

  id_da_task := (select s.task_id from public.subtasks s where s.id = alvo);

  insert into public.task_history (task_id, subtask_id, approval_round_id, acao, para_valor, autor_id)
  values (id_da_task, alvo, p_round_id,
          case when p_decisao = 'aprovada' then 'cliente_aprovou' else 'cliente_pediu_ajustes' end,
          p_decisao::text, quem);

  if p_comentario is not null and btrim(p_comentario) <> '' then
    insert into public.task_comentarios (task_id, subtask_id, approval_round_id, autor_id, texto, interno)
    values (id_da_task, alvo, p_round_id, quem, p_comentario, false);
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- PASSO 10 - O cascade e as policies da rodada
-- ---------------------------------------------------------------------------
create or replace function public.limpar_conteudo_do_entregavel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.approval_rounds where content_type = 'deliverable' and content_id = old.id;
  delete from public.comments        where content_type = 'deliverable' and content_id = old.id;
  return old;
end;
$$;

drop trigger if exists deliverables_limpa_conteudo on public.deliverables;
create trigger deliverables_limpa_conteudo
  after delete on public.deliverables
  for each row execute function public.limpar_conteudo_do_entregavel();

drop policy if exists approval_rounds_select_cliente on public.approval_rounds;
create policy approval_rounds_select_cliente on public.approval_rounds
  for select to authenticated
  using (
    escopo = 'cliente'
    and (
      (content_type = 'subtask'    and public.subtask_visivel_ao_cliente(content_id))
      or (content_type = 'post'    and public.post_visivel_ao_cliente(content_id))
      or (content_type = 'deliverable' and public.entregavel_visivel_ao_cliente(content_id))
    )
  );

drop policy if exists approval_rounds_decide on public.approval_rounds;
create policy approval_rounds_decide on public.approval_rounds
  for update to authenticated
  using (
    (content_type = 'subtask'     and public.pode_aprovar_subtarefa(content_id))
    or (content_type = 'post'     and public.pode_aprovar_post(content_id))
    or (content_type = 'deliverable' and public.pode_aprovar_entregavel(content_id))
  )
  with check (
    (content_type = 'subtask'     and public.pode_aprovar_subtarefa(content_id))
    or (content_type = 'post'     and public.pode_aprovar_post(content_id))
    or (content_type = 'deliverable' and public.pode_aprovar_entregavel(content_id))
  );


-- ---------------------------------------------------------------------------
-- PASSO 11 - O bucket dos arquivos da campanha
--
-- Privado, e com a mesma convencao de caminho do `posts-artes`: a PRIMEIRA
-- PASTA e o id da empresa, porque e o que a policy pergunta para saber de quem
-- e o arquivo sem precisar abrir a tabela.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('campanhas-arquivos', 'campanhas-arquivos', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "campanhas: equipe le" on storage.objects';
  execute 'drop policy if exists "campanhas: cliente le" on storage.objects';
  execute 'drop policy if exists "campanhas: equipe escreve" on storage.objects';
  execute 'drop policy if exists "campanhas: equipe apaga" on storage.objects';

  execute $politica$
    create policy "campanhas: equipe le" on storage.objects
      for select to authenticated
      using (bucket_id = 'campanhas-arquivos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "campanhas: cliente le" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'campanhas-arquivos'
        and (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
      )
  $politica$;

  execute $politica$
    create policy "campanhas: equipe escreve" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'campanhas-arquivos' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "campanhas: equipe apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'campanhas-arquivos' and public.is_staff())
  $politica$;
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 12 - Os templates da casa
--
-- A FORMA DO JSON e uma lista de entregaveis de topo, e quem tem `itens` e
-- grupo:
--
--     [ { "nome": "KV" },
--       { "nome": "Enxoval", "itens": [ { "nome": "lâmina A5" }, ... ] },
--       { "nome": "Feed/Storys", "itens": [], "quantidade": 15 } ]
--
-- `itens` vazio com `quantidade` e o caso do Feed/Storys: quantos sao se
-- decide na criacao da campanha, porque muda a cada mes. A tela le esse numero
-- como sugestao e gera "Feed/Story 1", "Feed/Story 2" -- escrever quinze
-- linhas iguais no template seria fixar um numero que nunca e o mesmo.
--
-- INSERIDOS SO SE NAO EXISTIREM, pelo nome. Apagar e recriar quebraria a chave
-- estrangeira de qualquer campanha que ja aponte para eles -- e o template de
-- uma campanha antiga e o registro do que foi combinado naquele mes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.campaign_templates
                  where nome = 'Wave Outubro Rosa' and client_id is null) then
    insert into public.campaign_templates (nome, descricao, estrutura_json)
    values (
      'Wave Outubro Rosa',
      'A estrutura completa de uma Wave: KV, enxoval de peças, feed, vídeos, tabloide, banners, PMAX e os arquivos do Deskfy.',
      '[
        { "nome": "KV" },
        { "nome": "Enxoval", "itens": [
          { "nome": "Lâmina customizável A5" },
          { "nome": "Precificador editável" },
          { "nome": "Precificador não editável" },
          { "nome": "Banner A5 editável" },
          { "nome": "Banner A5 não editável" },
          { "nome": "Display produto A3" },
          { "nome": "Banner portal do franqueado" },
          { "nome": "Capa YouTube" },
          { "nome": "Capa Facebook" },
          { "nome": "Avatar perfil" },
          { "nome": "Feed/story site" },
          { "nome": "Feed/story iFood" },
          { "nome": "Capa iFood" },
          { "nome": "Banner blog" },
          { "nome": "Adesivo KV A0" },
          { "nome": "Adesivo KV A1" },
          { "nome": "Adesivo vitrine" }
        ] },
        { "nome": "Feed/Storys", "itens": [], "quantidade": 15 },
        { "nome": "Vídeos TV", "itens": [
          { "nome": "Vertical" },
          { "nome": "Horizontal" },
          { "nome": "Tombado" }
        ] },
        { "nome": "Tabloide" },
        { "nome": "Banners Site", "itens": [
          { "nome": "Desktop" },
          { "nome": "Mobile" }
        ] },
        { "nome": "Textos PMAX" },
        { "nome": "Artes PMAX" },
        { "nome": "Arquivos Deskfy", "itens": [
          { "nome": "Adesivo A0" },
          { "nome": "Adesivo A1" },
          { "nome": "Banner A5" },
          { "nome": "Feed/story site" },
          { "nome": "Feed/story iFood" },
          { "nome": "Precificador editável" },
          { "nome": "Display produto A3" },
          { "nome": "Selo campanha" },
          { "nome": "Lâmina A5" }
        ] }
      ]'::jsonb
    );
  end if;

  if not exists (select 1 from public.campaign_templates
                  where nome = 'Social Media Mensal' and client_id is null) then
    insert into public.campaign_templates (nome, descricao, estrutura_json)
    values (
      'Social Media Mensal',
      'O mês de social: a linha editorial, os posts e os stories.',
      '[
        { "nome": "Linha editorial do mês" },
        { "nome": "Posts de feed", "itens": [], "quantidade": 12 },
        { "nome": "Stories", "itens": [], "quantidade": 8 },
        { "nome": "Relatório do mês" }
      ]'::jsonb
    );
  end if;

  -- O VAZIO EXISTE DE PROPOSITO. Sem ele, quem precisa de uma campanha que
  -- nao se parece com nenhum formato teria que escolher um e apagar item por
  -- item -- e o template escolhido ficaria gravado em `template_id`, dizendo
  -- que aquela campanha e uma Wave quando ela nao e.
  if not exists (select 1 from public.campaign_templates
                  where nome = 'Campanha Custom' and client_id is null) then
    insert into public.campaign_templates (nome, descricao, estrutura_json)
    values (
      'Campanha Custom',
      'Começa vazia. Para o que não se parece com nenhum formato da casa.',
      '[]'::jsonb
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
