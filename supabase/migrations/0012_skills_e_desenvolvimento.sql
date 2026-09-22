-- ===========================================================================
-- 0012 - Skills e desenvolvimento
--
-- O que cada pessoa sabe, o que quer aprender, e a reflexao dela sobre a
-- semana.
--
-- DUAS DECISOES QUE VALEM EXPLICAR
--
-- 1. O sprint pedia `diary_entries`, um registro por DIA com texto rico e
--    humor. Ela NAO e criada: o Sprint 3C ja tinha transformado o Diario em
--    Resumo Semanal, e ninguem abre o sistema todo dia para escrever uma
--    linha. O que o Sprint 7 trazia de bom entra na semana: `weekly_notes`
--    guarda o texto rico e o "como foi a semana" que o campo humor seria.
--
-- 2. `weekly_notes.semana` GRAVA a data da segunda-feira, e isso nao
--    contradiz a regra do 3C ("a semana sai da data por calculo, nunca e
--    gravada"). La existe uma data da entrega, e a semana e derivada dela --
--    guardar as duas seria criar dois lugares para a mesma verdade. Aqui nao
--    ha outra data: a semana E a identidade do registro.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O catalogo
--
-- Compartilhado de proposito. Se cada um escrevesse o nome da propria skill,
-- a agencia teria "After Effects", "AfterEffects" e "AE" como tres coisas
-- diferentes, e a pergunta que este modulo existe para responder -- "quem sabe
-- fazer X?" -- nao teria resposta.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'skill_nivel') then
    create type public.skill_nivel as enum (
      'iniciante', 'intermediario', 'avancado', 'especialista'
    );
  end if;
end;
$$;

create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  categoria  text,
  descricao  text,
  -- `ativa = false` tem DOIS significados, e o `sugerida_por` distingue:
  -- skill arquivada pela gestao (sugerida_por nulo) e skill sugerida por
  -- alguem da equipe, esperando aprovacao (sugerida_por preenchido). Sem essa
  -- coluna, a fila de aprovacao se misturaria com o arquivo morto.
  ativa      boolean not null default true,
  sugerida_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.skills
  add column if not exists sugerida_por uuid references public.profiles (id) on delete set null;

comment on table public.skills is
  'Catalogo compartilhado. Nome unico para "quem sabe fazer X?" ter resposta.';
comment on column public.skills.sugerida_por is
  'Preenchido enquanto a skill espera aprovacao da gestao. Nulo em skill do catalogo.';

create index if not exists skills_categoria_idx on public.skills (categoria, nome);

alter table public.skills enable row level security;

drop policy if exists skills_select on public.skills;
drop policy if exists skills_insert on public.skills;
drop policy if exists skills_update on public.skills;
drop policy if exists skills_delete on public.skills;

create policy skills_select on public.skills
  for select to authenticated using (public.is_staff());

-- Qualquer pessoa da equipe SUGERE, e a sugestao nasce inativa e com o nome
-- de quem sugeriu. A gestao cria direto. Sem o primeiro caso, quem descobre
-- que falta uma skill no catalogo teria que pedir para alguem por fora do
-- sistema -- e nao pediria.
create policy skills_insert on public.skills
  for insert to authenticated
  with check (
    public.is_gestor()
    or (
      public.is_staff()
      and ativa = false
      and sugerida_por = (select auth.uid())
    )
  );

create policy skills_update on public.skills
  for update to authenticated
  using (public.is_gestor()) with check (public.is_gestor());

-- Sem DELETE: skill citada no perfil de alguem vira historico. Arquivar e
-- `ativa = false`.


-- ---------------------------------------------------------------------------
-- PASSO 2 - O perfil de cada pessoa
-- ---------------------------------------------------------------------------

create table if not exists public.user_skills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  skill_id         uuid not null references public.skills (id) on delete cascade,
  nivel            public.skill_nivel not null default 'iniciante',
  quer_desenvolver boolean not null default false,
  anos_experiencia numeric(4,1),
  observacao       text,
  atualizado_em    timestamptz not null default now(),
  unique (user_id, skill_id)
);

comment on table public.user_skills is
  'O que cada pessoa sabe. Escrita so pela propria pessoa; a gestao le todas.';

create index if not exists user_skills_skill_idx on public.user_skills (skill_id, nivel);

create or replace function public.tocar_user_skills()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists user_skills_tocar on public.user_skills;
create trigger user_skills_tocar
  before update on public.user_skills
  for each row execute function public.tocar_user_skills();

alter table public.user_skills enable row level security;

drop policy if exists user_skills_select on public.user_skills;
drop policy if exists user_skills_insert on public.user_skills;
drop policy if exists user_skills_update on public.user_skills;
drop policy if exists user_skills_delete on public.user_skills;

-- A gestao le TODAS: e o que faz a matriz e o "quem sabe fazer X?"
-- funcionarem. O colaborador le so as proprias -- ver o nivel que o colega
-- se atribuiu nao ajuda ninguem a trabalhar e convida a comparacao.
create policy user_skills_select on public.user_skills
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

-- Escrita SO da propria pessoa, inclusive para a gestao. Nivel de skill e
-- autoavaliacao: se o gestor pudesse escrever, o numero deixaria de dizer "o
-- que eu acho que sei" e passaria a dizer duas coisas ao mesmo tempo. A
-- opiniao da gestao tem lugar proprio, em skill_avaliacoes.
create policy user_skills_insert on public.user_skills
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff());

create policy user_skills_update on public.user_skills
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_skills_delete on public.user_skills
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 3 - A observacao da gestao
--
-- Separada de `user_skills` porque e outra voz. O nivel e a autoavaliacao da
-- pessoa; isto aqui e o que a gestao registra sobre o desenvolvimento dela.
--
-- E VISIVEL PARA A PROPRIA PESSOA, e isso e uma decisao, nao um descuido:
-- avaliacao que o avaliado nao pode ler nao e avaliacao, e feedback pelas
-- costas. Quem escreve sabe que vai ser lido, e escreve melhor por isso.
-- ---------------------------------------------------------------------------

create table if not exists public.skill_avaliacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  autor_id   uuid not null references public.profiles (id) on delete set null,
  texto      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.skill_avaliacoes is
  'Observacao da gestao sobre o desenvolvimento de alguem. A propria pessoa le.';

create index if not exists skill_avaliacoes_pessoa_idx
  on public.skill_avaliacoes (user_id, created_at desc);

create or replace function public.tocar_skill_avaliacoes()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists skill_avaliacoes_tocar on public.skill_avaliacoes;
create trigger skill_avaliacoes_tocar
  before update on public.skill_avaliacoes
  for each row execute function public.tocar_skill_avaliacoes();

alter table public.skill_avaliacoes enable row level security;

drop policy if exists skill_avaliacoes_select on public.skill_avaliacoes;
drop policy if exists skill_avaliacoes_insert on public.skill_avaliacoes;
drop policy if exists skill_avaliacoes_update on public.skill_avaliacoes;
drop policy if exists skill_avaliacoes_delete on public.skill_avaliacoes;

create policy skill_avaliacoes_select on public.skill_avaliacoes
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_gestor());

create policy skill_avaliacoes_insert on public.skill_avaliacoes
  for insert to authenticated
  with check (public.is_gestor() and autor_id = (select auth.uid()));

-- So quem escreveu corrige o proprio texto. Um gestor reescrevendo a
-- observacao de outro apagaria de quem era a opiniao.
create policy skill_avaliacoes_update on public.skill_avaliacoes
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy skill_avaliacoes_delete on public.skill_avaliacoes
  for delete to authenticated
  using (autor_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 4 - A reflexao da semana
--
-- O Sprint 7 pedia texto rico e humor por DIA. Aqui eles sao da SEMANA, pelo
-- mesmo motivo que o Diario virou Resumo Semanal no 3C: ninguem abre o
-- sistema todo dia para escrever uma linha, e uma semana tem forma que um dia
-- solto nao tem.
--
-- Tabela separada de `weekly_entries` porque sao coisas diferentes: la e uma
-- linha por ENTREGA, aqui e um texto por SEMANA. Uma coluna de texto rico em
-- weekly_entries obrigaria a escolher em qual das entregas escrever a
-- reflexao sobre a semana inteira.
--
-- Privada, como weekly_entries: nem o socio le. Veja o comentario da 0010.
-- ---------------------------------------------------------------------------

create table if not exists public.weekly_notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  -- A segunda-feira da semana. E a identidade do registro, e nao uma copia
  -- derivada de outra data -- por isso e gravada.
  semana          date not null,
  conteudo_rico   jsonb,
  -- O mesmo texto sem formatacao, para a busca. O JSON do TipTap nao e
  -- pesquisavel com `ilike` sem virar uma consulta que ninguem entende.
  conteudo_texto  text,
  -- Como foi a semana. Opcional de proposito: obrigar a responder produz
  -- resposta automatica, que nao diz nada.
  humor           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, semana),
  constraint weekly_notes_humor check (
    humor is null or humor in ('otimo', 'bom', 'neutro', 'dificil')
  ),
  -- Segunda-feira, sempre. Sem isso, duas telas com ideias diferentes de onde
  -- a semana comeca criariam dois registros para a mesma semana, e o `unique`
  -- nao pegaria.
  constraint weekly_notes_segunda check (extract(isodow from semana) = 1)
);

comment on table public.weekly_notes is
  'Texto livre sobre a semana. Privado: so o dono le e escreve.';

create index if not exists weekly_notes_pessoa_idx
  on public.weekly_notes (user_id, semana desc);

create or replace function public.tocar_weekly_notes()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weekly_notes_tocar on public.weekly_notes;
create trigger weekly_notes_tocar
  before update on public.weekly_notes
  for each row execute function public.tocar_weekly_notes();

alter table public.weekly_notes enable row level security;

drop policy if exists weekly_notes_select on public.weekly_notes;
drop policy if exists weekly_notes_insert on public.weekly_notes;
drop policy if exists weekly_notes_update on public.weekly_notes;
drop policy if exists weekly_notes_delete on public.weekly_notes;

create policy weekly_notes_select on public.weekly_notes
  for select to authenticated using (user_id = (select auth.uid()));

create policy weekly_notes_insert on public.weekly_notes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff());

create policy weekly_notes_update on public.weekly_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy weekly_notes_delete on public.weekly_notes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Semana futura nao se escreve. O `weekly_entries` ja recusa data futura pelo
-- bom senso da tela; aqui e no banco, porque o registro do que ainda nao
-- aconteceu nao e registro, e ficção.
create or replace function public.recusar_semana_futura()
returns trigger
language plpgsql
as $$
begin
  if new.semana > date_trunc('week', current_date)::date then
    raise exception using
      errcode = 'check_violation',
      message = 'Ainda nao da para escrever sobre uma semana que nao comecou.';
  end if;
  return new;
end;
$$;

drop trigger if exists weekly_notes_sem_futuro on public.weekly_notes;
create trigger weekly_notes_sem_futuro
  before insert or update of semana on public.weekly_notes
  for each row execute function public.recusar_semana_futura();

-- A mesma trava para as entregas: `weekly_entries.data` no futuro e registro
-- de coisa que nao aconteceu.
create or replace function public.recusar_entrega_futura()
returns trigger
language plpgsql
as $$
begin
  if new.data > current_date then
    raise exception using
      errcode = 'check_violation',
      message = 'Nao da para registrar uma entrega com data futura.';
  end if;
  return new;
end;
$$;

drop trigger if exists weekly_entries_sem_futuro on public.weekly_entries;
create trigger weekly_entries_sem_futuro
  before insert or update of data on public.weekly_entries
  for each row execute function public.recusar_entrega_futura();


-- ---------------------------------------------------------------------------
-- PASSO 5 - O catalogo inicial
--
-- Vinte skills de uma agencia de verdade, com categoria. Catalogo vazio faria
-- a primeira pessoa a abrir a tela ter que inventar o vocabulario da casa
-- sozinha -- e o vocabulario inventado por um nao serve para os outros.
-- ---------------------------------------------------------------------------

insert into public.skills (nome, categoria, descricao) values
  ('Design Gráfico',        'Design',     'Peças gráficas, identidade e aplicação de marca.'),
  ('Motion',                'Design',     'Animação de peças e aberturas.'),
  ('Edição de Vídeo',       'Audiovisual','Corte, ritmo e finalização.'),
  ('Fotografia',            'Audiovisual','Captação e tratamento de imagem.'),
  ('Copywriting',           'Conteúdo',   'Texto que vende, com foco em conversão.'),
  ('Redação Publicitária',  'Conteúdo',   'Conceito e texto de campanha.'),
  ('Social Media',          'Conteúdo',   'Planejamento e produção para redes.'),
  ('Tráfego Pago',          'Mídia',      'Compra e otimização de mídia.'),
  ('SEO',                   'Mídia',      'Busca orgânica: técnica e conteúdo.'),
  ('Branding',              'Design',     'Posicionamento e sistema de marca.'),
  ('Atendimento',           'Gestão',     'Relação com o cliente e leitura de briefing.'),
  ('Gestão de Projetos',    'Gestão',     'Prazo, escopo e coordenação de equipe.'),
  ('Figma',                 'Ferramenta', 'Interface, protótipo e design system.'),
  ('Photoshop',             'Ferramenta', 'Tratamento e composição de imagem.'),
  ('Illustrator',           'Ferramenta', 'Vetor, ilustração e logotipo.'),
  ('After Effects',         'Ferramenta', 'Animação e efeitos.'),
  ('Premiere',              'Ferramenta', 'Edição e montagem.'),
  ('Meta Ads',              'Mídia',      'Campanhas no Facebook e Instagram.'),
  ('Google Ads',            'Mídia',      'Rede de busca, display e YouTube.'),
  ('Analytics',             'Mídia',      'Medição, eventos e leitura de dados.')
on conflict (nome) do nothing;
