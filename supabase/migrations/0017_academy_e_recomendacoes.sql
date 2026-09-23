-- =========================================================================
-- 0017 — Full Academy e Recomendações
--
-- Os dois módulos de conhecimento compartilhado. Eles não são o mesmo tipo de
-- coisa, e o desenho do banco reflete isso:
--
--   ACADEMY é curado. A gestão monta a trilha, ordena os materiais e publica.
--   Quem executa consome e marca o próprio progresso.
--
--   RECOMENDAÇÕES é feed. Qualquer pessoa da equipe posta, curte e comenta.
--   A gestão só entra para moderar.
--
-- A PONTE ENTRE OS DOIS MÓDULOS, E O SPRINT 7
--
--   `academy_materials.skill_id` liga o material a uma skill do catálogo. É
--   por essa coluna que "Recomendadas para você" funciona: as trilhas cujos
--   materiais tocam uma skill que a pessoa marcou como `quer_desenvolver` em
--   `user_skills`.
--
--   Sem ela, o "quero desenvolver" do Sprint 7 continuaria sendo um campo que
--   ninguém lê, e a Academy seria um catálogo que ninguém sabe por onde
--   começar. É uma coluna, e é ela que faz os dois módulos valerem juntos
--   mais do que separados.
--
-- O QUE NÃO ESTÁ AQUI, DE PROPÓSITO
--
--   Não há nota, quiz, certificado nem pontuação. O objetivo é organizar
--   conteúdo, não avaliar pessoas — e a diferença aparece no schema: o que se
--   guarda de cada material é `concluido` e uma anotação pessoal, não um
--   desempenho. Um campo de nota mudaria o que a Academy É, e quem decide
--   isso não é quem escreve a migration.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Os enums
-- -------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'material_tipo') then
    create type public.material_tipo as enum (
      'video', 'artigo', 'pdf', 'curso_externo', 'template', 'aula_interna'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'rec_categoria') then
    create type public.rec_categoria as enum (
      'filme', 'serie', 'livro', 'curso', 'ferramenta', 'podcast',
      'referencia', 'outro'
    );
  end if;
end
$$;

-- O sino ganha os dois tipos novos. `add value if not exists` nao roda dentro
-- de bloco transacional em algumas versoes, entao vai solto e idempotente.
alter type public.notification_tipo add value if not exists 'academy';
alter type public.notification_tipo add value if not exists 'recomendacao';

-- -------------------------------------------------------------------------
-- 2. Academy
-- -------------------------------------------------------------------------

create table if not exists public.academy_tracks (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  -- Texto livre e nao enum: a area aqui e organizacao de conteudo ("Design",
  -- "Atendimento"), e nao a area do contrato de ninguem. Amarrar ao enum de
  -- funcao faria uma trilha de "Processos da casa" nao ter onde morar.
  area        text,
  capa_url    text,
  obrigatoria boolean not null default false,
  publicada   boolean not null default false,
  ordem       integer not null default 0,
  criado_por  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table if not exists public.academy_materials (
  id              uuid primary key default gen_random_uuid(),
  track_id        uuid not null references public.academy_tracks (id) on delete cascade,
  titulo          text not null,
  descricao       text,
  tipo            public.material_tipo not null,
  url             text,
  arquivo_url     text,
  duracao_minutos integer,
  ordem           integer not null default 0,
  -- A ponte com o Sprint 7. `on delete set null`: arquivar uma skill nao pode
  -- levar junto o material que a ensina.
  skill_id        uuid references public.skills (id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.academy_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  material_id  uuid not null references public.academy_materials (id) on delete cascade,
  concluido    boolean not null default false,
  concluido_em timestamptz,
  -- ANOTACAO PESSOAL. Ninguem alem da propria pessoa le -- veja a RLS mais
  -- abaixo. E onde se escreve "nao entendi a parte do briefing", e uma nota
  -- dessas que a gestao pudesse ler nao seria escrita.
  anotacoes    text,
  created_at   timestamptz not null default now(),
  unique (user_id, material_id)
);

-- `concluido_em` e carimbado pelo banco, nao pela tela: a data de conclusao e
-- o unico dado do progresso que alguem poderia querer forjar, e o relogio do
-- navegador nao e prova de nada.
create or replace function public.academy_progress_carimbar()
returns trigger
language plpgsql
as $$
begin
  if new.concluido and (tg_op = 'INSERT' or not old.concluido) then
    new.concluido_em := now();
  elsif not new.concluido then
    new.concluido_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_progress_carimbar on public.academy_progress;
create trigger academy_progress_carimbar
  before insert or update on public.academy_progress
  for each row execute function public.academy_progress_carimbar();

create index if not exists academy_materials_track_idx
  on public.academy_materials (track_id, ordem);
create index if not exists academy_progress_user_idx
  on public.academy_progress (user_id);
create index if not exists academy_materials_skill_idx
  on public.academy_materials (skill_id) where skill_id is not null;

-- -------------------------------------------------------------------------
-- 3. Recomendações
-- -------------------------------------------------------------------------

create table if not exists public.recommendations (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references public.profiles (id) on delete cascade,
  categoria  public.rec_categoria not null,
  titulo     text not null,
  descricao  text,
  url        text,
  imagem_url text,
  tags       text[],
  created_at timestamptz not null default now()
);

-- Tag e etiqueta, nao frase: sem normalizar, "Figma", "figma" e " figma "
-- viram tres nuvens diferentes na mesma tela. A normalizacao e no banco e nao
-- na action porque a nuvem de tags le direto da coluna.
create or replace function public.recomendacoes_normalizar_tags()
returns trigger
language plpgsql
as $$
begin
  if new.tags is not null then
    select array_agg(distinct t)
      into new.tags
      from unnest(new.tags) as t0(t0)
      cross join lateral (select lower(btrim(t0))) as n(t)
     where btrim(t0) <> '';
  end if;
  return new;
end;
$$;

drop trigger if exists recomendacoes_normalizar_tags on public.recommendations;
create trigger recomendacoes_normalizar_tags
  before insert or update of tags on public.recommendations
  for each row execute function public.recomendacoes_normalizar_tags();

create table if not exists public.recommendation_likes (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create table if not exists public.recommendation_comments (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  autor_id          uuid not null references public.profiles (id) on delete cascade,
  texto             text not null,
  resposta_a        uuid references public.recommendation_comments (id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index if not exists recommendations_recentes_idx
  on public.recommendations (created_at desc);
create index if not exists recommendation_likes_post_idx
  on public.recommendation_likes (recommendation_id);
create index if not exists recommendation_comments_post_idx
  on public.recommendation_comments (recommendation_id, created_at);
-- A busca por tag varre um array; sem GIN ela vira varredura de tabela assim
-- que o feed passar de algumas centenas de posts.
create index if not exists recommendations_tags_idx
  on public.recommendations using gin (tags);

-- Resposta a resposta viraria uma arvore sem fundo numa tela que e um feed. A
-- thread tem UM nivel: comentario e resposta ao comentario, e acabou.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rec_comments_um_nivel') then
    alter table public.recommendation_comments
      add constraint rec_comments_um_nivel check (true) not valid;
    alter table public.recommendation_comments drop constraint rec_comments_um_nivel;
  end if;
end
$$;

create or replace function public.rec_comments_um_nivel()
returns trigger
language plpgsql
as $$
begin
  if new.resposta_a is not null and exists (
       select 1 from public.recommendation_comments c
        where c.id = new.resposta_a and c.resposta_a is not null
     ) then
    raise exception using
      errcode = 'check_violation',
      message = 'A thread tem um nivel so: da para responder a um comentario, nao a uma resposta.';
  end if;
  return new;
end;
$$;

drop trigger if exists rec_comments_um_nivel on public.recommendation_comments;
create trigger rec_comments_um_nivel
  before insert or update on public.recommendation_comments
  for each row execute function public.rec_comments_um_nivel();

-- -------------------------------------------------------------------------
-- 4. O sino: curtida e comentario avisam o autor
--
-- Pela funcao `notificar()`, que e a UNICA porta de escrita em
-- `notifications` -- nao existe policy de insert. E ela ja nao avisa quem
-- causou o aviso, entao curtir o proprio post nao gera nada.
-- -------------------------------------------------------------------------

create or replace function public.recomendacao_avisar_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post   public.recommendations%rowtype;
  quem   text;
begin
  select * into post from public.recommendations
   where id = case tg_table_name
                when 'recommendation_likes' then new.recommendation_id
                else new.recommendation_id
              end;

  if not found then
    return new;
  end if;

  select nome into quem from public.profiles where id = (select auth.uid());
  quem := coalesce(quem, 'Alguem da equipe');

  if tg_table_name = 'recommendation_likes' then
    perform public.notificar(
      post.autor_id, 'recomendacao',
      format('%s curtiu sua recomendacao', quem),
      post.titulo,
      '/painel/recomendacoes'
    );
  else
    -- Resposta avisa quem escreveu o comentario respondido, e nao o dono do
    -- post: quem respondeu esta falando com aquela pessoa. Sem isso, uma
    -- conversa de cinco respostas enche o sino de quem so postou o link.
    if new.resposta_a is not null then
      perform public.notificar(
        (select autor_id from public.recommendation_comments where id = new.resposta_a),
        'recomendacao',
        format('%s respondeu voce', quem),
        left(new.texto, 120),
        '/painel/recomendacoes'
      );
    else
      perform public.notificar(
        post.autor_id, 'recomendacao',
        format('%s comentou sua recomendacao', quem),
        left(new.texto, 120),
        '/painel/recomendacoes'
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists recommendation_likes_avisar on public.recommendation_likes;
create trigger recommendation_likes_avisar
  after insert on public.recommendation_likes
  for each row execute function public.recomendacao_avisar_autor();

drop trigger if exists recommendation_comments_avisar on public.recommendation_comments;
create trigger recommendation_comments_avisar
  after insert on public.recommendation_comments
  for each row execute function public.recomendacao_avisar_autor();

-- -------------------------------------------------------------------------
-- 5. RLS
--
-- Obrigatoria em toda tabela nova, na mesma migration que a cria. Sem isso a
-- tabela fica legivel por qualquer pessoa com a chave anon -- e essa chave vai
-- no bundle que o navegador baixa.
--
-- CLIENTE NAO ALCANCA NADA DISTO. Nenhuma policy aqui menciona
-- `my_client_ids()`, e e assim de proposito: Academy e Recomendacoes sao
-- conversa interna da agencia.
-- -------------------------------------------------------------------------

alter table public.academy_tracks          enable row level security;
alter table public.academy_materials       enable row level security;
alter table public.academy_progress        enable row level security;
alter table public.recommendations         enable row level security;
alter table public.recommendation_likes    enable row level security;
alter table public.recommendation_comments enable row level security;

-- --- Trilhas ---------------------------------------------------------------
--
-- TRILHA NAO PUBLICADA NAO EXISTE PARA QUEM NAO E GESTAO, e isso e RLS e nao
-- filtro de consulta. Um `.eq("publicada", true)` esquecido numa tela nova
-- vazaria o rascunho; aqui o banco recusa a linha.

drop policy if exists academy_tracks_select on public.academy_tracks;
create policy academy_tracks_select on public.academy_tracks
  for select to authenticated
  using (public.is_staff() and (publicada or public.is_gestor()));

drop policy if exists academy_tracks_insert on public.academy_tracks;
create policy academy_tracks_insert on public.academy_tracks
  for insert to authenticated
  with check (public.is_gestor() and criado_por = (select auth.uid()));

drop policy if exists academy_tracks_update on public.academy_tracks;
create policy academy_tracks_update on public.academy_tracks
  for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

drop policy if exists academy_tracks_delete on public.academy_tracks;
create policy academy_tracks_delete on public.academy_tracks
  for delete to authenticated
  using (public.is_gestor());

-- --- Materiais -------------------------------------------------------------
--
-- Material segue a trilha: se a trilha nao aparece, o material dela tambem
-- nao. Sem o `exists` aqui, a lista de materiais entregaria o conteudo de um
-- rascunho para quem nao pode ver a trilha.

drop policy if exists academy_materials_select on public.academy_materials;
create policy academy_materials_select on public.academy_materials
  for select to authenticated
  using (
    public.is_staff() and exists (
      select 1 from public.academy_tracks t
       where t.id = track_id and (t.publicada or public.is_gestor())
    )
  );

drop policy if exists academy_materials_insert on public.academy_materials;
create policy academy_materials_insert on public.academy_materials
  for insert to authenticated with check (public.is_gestor());

drop policy if exists academy_materials_update on public.academy_materials;
create policy academy_materials_update on public.academy_materials
  for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

drop policy if exists academy_materials_delete on public.academy_materials;
create policy academy_materials_delete on public.academy_materials
  for delete to authenticated using (public.is_gestor());

-- --- Progresso -------------------------------------------------------------
--
-- A pessoa escreve o proprio progresso, e so o proprio.
--
-- A LEITURA E DIFERENTE DA ESCRITA, e a assimetria e deliberada: a gestao
-- PRECISA ler o progresso para a aba Acompanhamento existir -- e ela existe
-- porque trilha obrigatoria sem quem confira e recado, nao trilha.
--
-- MAS AS ANOTACOES SAO PRIVADAS, e policy nao limita coluna. A separacao mora
-- na view `academy_progresso_da_equipe` mais abaixo, que e por onde a gestao
-- le: ela nao tem a coluna `anotacoes`. Quem chamar a tabela direto como
-- gestor le tudo -- por isso a camada de dados NUNCA consulta
-- `academy_progress` para a tela de acompanhamento, e o teste 09 cobre isso.

drop policy if exists academy_progress_select on public.academy_progress;
create policy academy_progress_select on public.academy_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

drop policy if exists academy_progress_insert on public.academy_progress;
create policy academy_progress_insert on public.academy_progress
  for insert to authenticated
  with check (public.is_staff() and user_id = (select auth.uid()));

drop policy if exists academy_progress_update on public.academy_progress;
create policy academy_progress_update on public.academy_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists academy_progress_delete on public.academy_progress;
create policy academy_progress_delete on public.academy_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- --- Recomendações ---------------------------------------------------------

drop policy if exists recommendations_select on public.recommendations;
create policy recommendations_select on public.recommendations
  for select to authenticated using (public.is_staff());

drop policy if exists recommendations_insert on public.recommendations;
create policy recommendations_insert on public.recommendations
  for insert to authenticated
  with check (public.is_staff() and autor_id = (select auth.uid()));

-- Editar e do AUTOR, e so dele. A gestao modera apagando, nao reescrevendo:
-- gestor que edita o texto de outra pessoa deixa no feed uma frase assinada
-- por quem nao a escreveu.
drop policy if exists recommendations_update on public.recommendations;
create policy recommendations_update on public.recommendations
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

drop policy if exists recommendations_delete on public.recommendations;
create policy recommendations_delete on public.recommendations
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.is_gestor());

-- --- Curtidas --------------------------------------------------------------

drop policy if exists recommendation_likes_select on public.recommendation_likes;
create policy recommendation_likes_select on public.recommendation_likes
  for select to authenticated using (public.is_staff());

drop policy if exists recommendation_likes_insert on public.recommendation_likes;
create policy recommendation_likes_insert on public.recommendation_likes
  for insert to authenticated
  with check (public.is_staff() and user_id = (select auth.uid()));

-- Descurtir e apagar a PROPRIA curtida. Nem a gestao tira a curtida de
-- ninguem: moderar e sobre o que foi publicado, nao sobre quem gostou.
drop policy if exists recommendation_likes_delete on public.recommendation_likes;
create policy recommendation_likes_delete on public.recommendation_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- --- Comentários -----------------------------------------------------------

drop policy if exists recommendation_comments_select on public.recommendation_comments;
create policy recommendation_comments_select on public.recommendation_comments
  for select to authenticated using (public.is_staff());

drop policy if exists recommendation_comments_insert on public.recommendation_comments;
create policy recommendation_comments_insert on public.recommendation_comments
  for insert to authenticated
  with check (public.is_staff() and autor_id = (select auth.uid()));

drop policy if exists recommendation_comments_update on public.recommendation_comments;
create policy recommendation_comments_update on public.recommendation_comments
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

drop policy if exists recommendation_comments_delete on public.recommendation_comments;
create policy recommendation_comments_delete on public.recommendation_comments
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.is_gestor());

-- -------------------------------------------------------------------------
-- 6. A view do acompanhamento
--
-- A gestao precisa saber quem concluiu a trilha obrigatoria. NAO precisa ler
-- a anotacao pessoal de ninguem -- e policy nao limita coluna, entao a
-- separacao tem que ser outra coisa.
--
-- Esta view e essa outra coisa: ela expoe conclusao e data, e NAO expoe
-- `anotacoes`. `security_invoker` mantem a RLS da tabela valendo por baixo,
-- entao ela nao vira um buraco.
-- -------------------------------------------------------------------------

drop view if exists public.academy_progresso_da_equipe;
create view public.academy_progresso_da_equipe
with (security_invoker = true) as
select
  p.user_id,
  m.track_id,
  m.id as material_id,
  p.concluido,
  p.concluido_em
from public.academy_progress p
join public.academy_materials m on m.id = p.material_id;

comment on view public.academy_progresso_da_equipe is
  'Progresso sem a coluna anotacoes. E por aqui que a aba Acompanhamento le -- policy nao limita coluna, e a anotacao e privada.';

-- -------------------------------------------------------------------------
-- 7. Os buckets
-- -------------------------------------------------------------------------

do $$
declare
  balde text;
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  foreach balde in array array['academy-materiais', 'recomendacoes-imagens'] loop
    insert into storage.buckets (id, name, public)
    values (balde, balde, false)
    on conflict (id) do nothing;

    execute format('drop policy if exists %I on storage.objects', balde || ': equipe le');
    execute format('drop policy if exists %I on storage.objects', balde || ': equipe escreve');
    execute format('drop policy if exists %I on storage.objects', balde || ': equipe apaga');

    execute format($politica$
      create policy %I on storage.objects
        for select to authenticated
        using (bucket_id = %L and public.is_staff())
    $politica$, balde || ': equipe le', balde);

    execute format($politica$
      create policy %I on storage.objects
        for insert to authenticated
        with check (bucket_id = %L and public.is_staff())
    $politica$, balde || ': equipe escreve', balde);

    execute format($politica$
      create policy %I on storage.objects
        for delete to authenticated
        using (bucket_id = %L and public.is_staff())
    $politica$, balde || ': equipe apaga', balde);
  end loop;
end
$$;

-- -------------------------------------------------------------------------
-- 8. Comentários de tabela
-- -------------------------------------------------------------------------

comment on table public.academy_tracks is
  'Trilhas da Academy. Nao publicada so aparece para a gestao, por RLS.';
comment on table public.academy_materials is
  'Materiais de uma trilha, em ordem. skill_id e a ponte com o catalogo do Sprint 7.';
comment on table public.academy_progress is
  'Progresso e anotacao de cada pessoa. A anotacao e privada: a gestao le pela view academy_progresso_da_equipe, que nao tem essa coluna.';
comment on table public.recommendations is
  'Feed de indicacoes da equipe. Editar e so do autor; a gestao modera apagando.';
comment on table public.recommendation_likes is
  'Curtidas. Descurtir e apagar a propria -- nem a gestao tira a de outra pessoa.';
comment on table public.recommendation_comments is
  'Comentarios, com um nivel de resposta. Mais que isso vira arvore sem fundo num feed.';
