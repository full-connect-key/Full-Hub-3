-- ---------------------------------------------------------------------------
-- 0046 - O CARD DO SOCIAL: PAUTA, REFERENCIAS, E QUEM ABRE O MES
--
-- Decisao do usuario: "a ideia e que os proprios responsaveis pelas etapas do
-- social vao preenchendo o card do social, com referencia, pauta, com a arte e
-- afins. (...) Desenvolvedor E ATENDIMENTO abrem um Social Mensal de um
-- cliente; esse social aparece para os colaboradores como uma task com as
-- subtarefas seguindo o workflow, e ao clicar na sua subtarefa ele e
-- direcionado para a pagina de social para preencher o card."
--
-- A 0045 montou a corrente. O que faltava e o que cada elo dela PREENCHE.
--
-- ---------------------------------------------------------------------------
-- 1. CADA ETAPA TEM UM CAMPO, E O POST NAO TINHA DOIS DELES
--
--   Pauta     -> `posts.pauta`        (nasce aqui)
--   Conteudo  -> `posts.legenda`      (ja existia)
--   Layout    -> a versao, com arte   (ja existia)
--   Envio     -> a acao Enviar        (ja existia)
--   Programar -> data e horario       (ja existia)
--
-- Sem `pauta`, quem pegava a primeira etapa da corrente abria a tela e nao
-- tinha onde escrever nada -- a etapa existia e o trabalho dela nao cabia em
-- lugar nenhum. Escrever a pauta na legenda seria pior: a legenda vai ao
-- cliente e ao ar, a pauta e conversa interna.
--
-- E AS REFERENCIAS SAO TABELA, como `task_referencias` (0004), e nao um campo
-- de texto com links colados: sao varias, cada uma tem quem a pos e quando, e
-- se apagam uma a uma. Um `text` com links separados por linha vira o campo em
-- que ninguem apaga nada com medo de apagar o resto.
--
-- ---------------------------------------------------------------------------
-- 2. O ATENDIMENTO ABRE O MES
--
-- A 0042 pos `posts_insert` em `is_gestor()`, e estava certo para o desenho de
-- entao. Agora o usuario disse quem abre, e sao dois: desenvolvedor e
-- Atendimento. Isso e exatamente `is_atendimento()` -- a mesma funcao que
-- `tasks_insert` usa desde a 0006, verdadeira para quem esta no Atendimento OU
-- para a gestao.
--
-- E E A MESMA PERGUNTA DE PROPOSITO, nao uma parecida: uma segunda funcao
-- dizendo quase isso seria o lugar onde as duas verdades comecam a divergir --
-- e o produto ja escreveu essa frase sobre o botao "Nova task" e a policy
-- `tasks_insert`.
--
-- O QUE NAO MUDA: definir responsavel continua sendo da gestao. Abrir trabalho
-- e distribuir trabalho sao duas decisoes, e o usuario separou as duas na
-- mesma frase.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A pauta
-- ---------------------------------------------------------------------------

alter table public.posts add column if not exists pauta text;

comment on column public.posts.pauta is
  'O que este post vai dizer -- escrito na etapa Pauta, e CONVERSA INTERNA. Nao e a legenda: a legenda vai ao cliente e ao ar.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As referencias de apoio
--
-- Mesma forma de `task_referencias`, e de proposito: quem ja sabe mexer numa
-- sabe mexer na outra. `tipo` fica de fora -- aqui e sempre link, porque a
-- arte tem lugar proprio (a versao) e um arquivo solto no meio das
-- referencias seria uma segunda porta para o material final.
-- ---------------------------------------------------------------------------

create table if not exists public.post_referencias (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts (id) on delete cascade,
  url            text not null,
  titulo         text,
  adicionado_por uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- O MESMO `check` DO `link_entrega` DA TASK (0014): sem ele, "ver com a Ana"
-- digitado aqui vira um link quebrado na tela de quem for buscar.
do $$
begin
  alter table public.post_referencias
    add constraint post_referencias_http
    check (url ~* '^https?://');
exception when duplicate_object then null;
end $$;

create index if not exists post_referencias_post_idx
  on public.post_referencias (post_id, created_at);

alter table public.post_referencias enable row level security;

-- A REFERENCIA E DE QUEM PRODUZ, e por isso a escrita e `is_staff()` e nao
-- `is_gestor()`: o ponto do modulo e que quem pega a etapa preenche o card. O
-- cliente nao tem policy nenhuma aqui -- referencia de apoio e conversa
-- interna, como a corrente.
drop policy if exists post_referencias_select on public.post_referencias;
create policy post_referencias_select on public.post_referencias
  for select to authenticated using (public.is_staff());

drop policy if exists post_referencias_insert on public.post_referencias;
create policy post_referencias_insert on public.post_referencias
  for insert to authenticated with check (public.is_staff());

-- APAGAR E DE QUEM POS, OU DA GESTAO. E a mesma regra das Recomendacoes: a
-- gestao modera apagando, e ninguem apaga a referencia que outra pessoa
-- juntou so por estar na mesma tela.
drop policy if exists post_referencias_delete on public.post_referencias;
create policy post_referencias_delete on public.post_referencias
  for delete to authenticated
  using (public.is_gestor() or adicionado_por = (select auth.uid()));

-- SEM POLICY DE UPDATE, e a ausencia e a regra: uma referencia e um endereco e
-- um titulo. Editar o endereco de uma referencia que alguem ja abriu e trocar
-- o destino embaixo de quem a leu -- apaga e poe outra.

create or replace function public.post_referencias_assina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Policy nao limita coluna: sem isto, um PATCH assinaria a referencia com o
  -- nome de outra pessoa. E `coalesce` porque sem sessao quem escreve e o
  -- seed, e apagar o autor que ele informou foi o primeiro bug de `comments`.
  if (select auth.uid()) is not null then
    new.adicionado_por := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists post_referencias_assina on public.post_referencias;
create trigger post_referencias_assina
  before insert on public.post_referencias
  for each row execute function public.post_referencias_assina();


-- ---------------------------------------------------------------------------
-- PASSO 3 - O Atendimento abre o post
--
-- `is_atendimento()` e a MESMA funcao de `tasks_insert` (0006), e nao uma
-- parecida: perfil de acesso e funcao na agencia sao coisas diferentes, e
-- quem esta no Atendimento abre demanda mesmo sendo `colaborador`.
-- ---------------------------------------------------------------------------

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated with check (public.is_atendimento());

-- A funcao e reescrita INTEIRA a partir da versao da 0045, que e a ultima.
-- Muda UMA linha -- a guarda --, e o resto e igual; montar de uma versao
-- antiga desfaria a distribuicao da corrente que a 0045 acrescentou.
create or replace function public.abrir_mes_de_social(
  p_client_id      uuid,
  p_mes            text,
  p_quantidades    jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis   jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rede      text;
  quantos   integer;
  i         integer;
  novo      uuid;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  empresa   text;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- `is_atendimento()` E NAO `is_gestor()` (0046, decisao do usuario). Mesma
  -- pergunta de `tasks_insert`: uma demanda de social e uma demanda.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
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

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    if quantos < 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'Quantidade negativa não abre post nenhum.';
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

  for rede, quantos in select key, value::integer from jsonb_each_text(p_quantidades)
  loop
    for i in 1..quantos loop
      insert into public.posts (
        client_id, tema, data_publicacao, plataforma, midia,
        criado_por, responsavel_id
      ) values (
        p_client_id,
        format('%s %s de %s · %s/%s', initcap(rede), i, quantos,
               meses[extract(month from primeiro)::integer],
               extract(year from primeiro)::integer),
        null,
        rede::public.plataforma_social,
        'imagem',
        (select auth.uid()),
        p_responsavel_id
      )
      returning id into novo;

      -- DISTRIBUIR A CORRENTE CONTINUA SENDO DA GESTAO, e por isso este
      -- `update` corre dentro de uma funcao `security definer` mesmo quando
      -- quem chamou e do Atendimento: abrir trabalho e distribuir trabalho sao
      -- duas decisoes, e quem abre o mes esta fazendo as duas de uma vez, de
      -- propósito -- e so nesta chamada.
      update public.post_etapas e
         set responsavel_id = nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_responsaveis ->> (e.funcao::text), '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$$;

notify pgrst, 'reload schema';
