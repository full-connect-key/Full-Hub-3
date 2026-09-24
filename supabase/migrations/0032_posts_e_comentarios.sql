-- ---------------------------------------------------------------------------
-- 0032 - Posts de social media, versoes e comentarios
--
-- Sprint 12. O modulo que substitui a planilha e o quadro externo no fluxo de
-- social: a agencia produz o post, manda para o cliente, e o cliente aprova,
-- rejeita ou pede ajuste -- com comentario e com historico de versoes.
--
-- ESTE ARQUIVO E O SEGUNDO ATO DA 0030. Ela generalizou a rodada para
-- (content_type, content_id) e deixou 'post' e 'deliverable' RECUSADOS de
-- proposito, com a frase escrita la: "quem acrescentar o tipo acrescenta a
-- regra na mesma migration". E o que este arquivo faz para 'post'.
-- 'deliverable' continua recusado, e continua sendo o Sprint 13.
--
-- TRES DECISOES QUE VALE LER ANTES DE MEXER:
--
-- 1. `status_rodada` GANHA UM TERCEIRO DESFECHO: 'rejeitada'. O Portal do
--    cliente tem tres botoes -- Aprovar, Rejeitar, Solicitar ajustes -- e os
--    dois ultimos nao sao a mesma coisa: "ajuste" diz "mude isto e volte",
--    "rejeitado" diz "nao". Reaproveitar 'ajustes_solicitados' para os dois
--    faria a rodada afirmar uma coisa e o post outra, sobre a mesma decisao.
--    Duas verdades sobre o mesmo fato e o erro que este produto evita por
--    desenho.
--
--    O valor entra por `alter type ... add value`, FORA de qualquer bloco: o
--    Postgres recusa esse comando dentro de um `do $$`. E ele nao e USADO em
--    lugar nenhum executado por esta migration -- so dentro de corpo de
--    funcao, que e texto ate alguem chamar --, porque um valor de enum nao
--    pode ser usado na mesma transacao em que nasce, e o SQL Editor do
--    Supabase roda o arquivo colado como uma transacao so.
--
-- 2. O CLIENTE SO ENXERGA POST ENVIADO, e isso mora na POLICY, nao na
--    consulta. `enviado_em is not null` e a linha que impede o post em
--    producao de aparecer -- no calendario, na URL direta e na API do
--    Supabase chamada a mao. Uma consulta que filtrasse esqueceria um dia.
--
-- 3. `comments.interno` E FORCADO POR TRIGGER. Policy nao limita coluna: sem
--    o trigger, um cliente montando o PATCH a mao gravaria `interno = true` e
--    sumiria com o proprio comentario, ou gravaria `interno = false` num
--    comentario da equipe e o entregaria ao cliente. Quem e cliente escreve
--    comentario publico, ponto -- e quem e da equipe escolhe.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - O terceiro desfecho da rodada
--
-- Fora de bloco, e com `if not exists`, que e o que torna o arquivo repetivel.
-- ---------------------------------------------------------------------------
alter type public.status_rodada add value if not exists 'rejeitada';


-- ---------------------------------------------------------------------------
-- PASSO 2 - As redes
--
-- Enum e nao texto livre: o icone, o filtro e o agrupamento do calendario
-- dependem do valor ser um dos sete. "Insta", "instagram" e "Instagram"
-- digitados em telas diferentes viram tres redes no filtro.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'plataforma_social') then
    create type public.plataforma_social as enum (
      'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter', 'pinterest'
    );
  end if;
end
$$;

comment on type public.plataforma_social is
  'As redes em que um post e publicado (0032).';


-- ---------------------------------------------------------------------------
-- PASSO 3 - As tabelas
-- ---------------------------------------------------------------------------

-- `formato` e TEXTO e nao enum, ao contrario da rede: feed, story, reels e
-- carrossel mudam de nome a cada temporada de produto das plataformas, e um
-- enum obrigaria uma migration a cada nome novo. A rede, essa nao muda.
create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete cascade,
  -- A etapa que produziu o post. OPCIONAL de proposito: post avulso existe --
  -- o cliente pediu um story hoje --, e exigir a etapa faria alguem inventar
  -- uma demanda so para conseguir cadastrar. Quando existe, e o que faz a
  -- Gestao de Tasks e o Portal contarem a mesma historia.
  subtask_id       uuid references public.subtasks (id) on delete set null,
  tema             text not null,
  legenda          text,
  data_publicacao  date not null,
  horario          time,
  plataforma       public.plataforma_social not null,
  formato          text,
  status           public.content_status not null default 'em_producao',
  arte_url         text,
  thumbnail_url    text,
  versao_atual     integer not null default 1,
  prazo_aprovacao  date,
  -- O CARIMBO QUE DECIDE A VISIBILIDADE. Nulo = a equipe ainda esta mexendo;
  -- preenchido = o cliente ja viu. A policy le esta coluna e mais nada.
  enviado_em       timestamptz,
  criado_por       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.post_versions (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.posts (id) on delete cascade,
  numero_versao  integer not null,
  arte_url       text,
  thumbnail_url  text,
  legenda        text,
  notas_mudanca  text,
  criado_por     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  unique (post_id, numero_versao)
);

-- O comentario do conteudo, generico pelo mesmo par da rodada.
--
-- POR QUE NAO REAPROVEITAR `task_comentarios`: aquela tabela e ancorada em
-- `task_id` mais `subtask_id`, com chave estrangeira nas duas. Um post pode
-- nao ter etapa nenhuma (veja `subtask_id` acima), entao ele nao tem task --
-- e a coluna e `not null` la. Generalizar aquela tabela significaria afrouxar
-- a ancora que faz o comentario da demanda ser da demanda.
create table if not exists public.comments (
  id                uuid primary key default gen_random_uuid(),
  content_type      text not null,
  content_id        uuid not null,
  approval_round_id uuid references public.approval_rounds (id) on delete set null,
  autor_id          uuid not null references public.profiles (id),
  texto             text not null,
  resposta_a        uuid references public.comments (id) on delete cascade,
  interno           boolean not null default false,
  created_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comments_content_type_valido') then
    alter table public.comments
      add constraint comments_content_type_valido
      check (content_type in ('post', 'deliverable'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comments_texto_nao_vazio') then
    alter table public.comments
      add constraint comments_texto_nao_vazio
      check (btrim(texto) <> '');
  end if;
end
$$;

create index if not exists posts_cliente_data_idx
  on public.posts (client_id, data_publicacao);
create index if not exists posts_subtask_idx
  on public.posts (subtask_id);
create index if not exists comments_conteudo_idx
  on public.comments (content_type, content_id, created_at);

comment on table public.posts is
  'Post de social media. O cliente so enxerga o que tem enviado_em preenchido (0032).';
comment on column public.posts.enviado_em is
  'Quando o post foi enviado ao cliente. Nulo = invisivel para ele, pela policy.';
comment on table public.post_versions is
  'O historico de artes e legendas de um post. Reverter e do painel interno, nunca do portal (0032).';
comment on table public.comments is
  'Comentario de post ou entregavel. interno = true nunca chega ao cliente (0032).';


-- ---------------------------------------------------------------------------
-- PASSO 4 - A thread tem UM NIVEL, como a das Recomendacoes
--
-- Conversa aninhada em tres niveis e conversa que ninguem acompanha, e o
-- recuo na tela deixa de significar alguma coisa -- a mesma razao pela qual a
-- sub-etapa para no terceiro nivel. Resposta de resposta vira resposta da
-- raiz, e nao um erro na cara de quem escreveu.
-- ---------------------------------------------------------------------------
create or replace function public.comentario_de_um_nivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  v_raiz uuid;
begin
  if new.resposta_a is null then
    return new;
  end if;

  -- ATRIBUICAO, E NAO `select ... into`, de proposito.
  --
  -- As duas formas fazem a mesma coisa no plpgsql. A diferenca aparece quando
  -- o corpo da funcao NAO chega inteiro ao servidor: com `select x into y`, o
  -- `y` ocupa a posicao em que um parser espera um nome de tabela, e o erro
  -- que sai e "relation "y" does not exist" -- uma mensagem que aponta para
  -- uma tabela que nunca existiu e manda quem le procurar no lugar errado.
  -- Foi exatamente o que o SQL Editor do Supabase devolveu nesta linha. Com
  -- `y := (select ...)` nao ha essa leitura possivel: ou o corpo chega
  -- inteiro, ou o erro fala da funcao.
  --
  -- E a variavel tem prefixo: `avo` e curto o bastante para colidir com
  -- qualquer coisa que apareca no schema depois.
  v_raiz := (
    select c.resposta_a from public.comments c where c.id = new.resposta_a
  );

  if v_raiz is not null then
    new.resposta_a := v_raiz;
  end if;

  return new;
end;
$corpo$;

drop trigger if exists comments_um_nivel on public.comments;
create trigger comments_um_nivel
  before insert on public.comments
  for each row execute function public.comentario_de_um_nivel();


-- ---------------------------------------------------------------------------
-- PASSO 5 - `interno` nao se escolhe do lado de fora
--
-- Policy nao limita coluna. Quem e cliente escreve comentario publico e
-- pronto; quem e da equipe escolhe. O trigger reescreve, nao recusa: recusar
-- transformaria um campo que a tela do cliente nem mostra numa mensagem de
-- erro que ela nao saberia explicar.
--
-- E o autor tambem e reescrito, pela mesma razao de sempre: sem isso um PATCH
-- a mao assinaria o comentario com o nome de outra pessoa.
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := (select auth.uid());
begin
  -- SEM SESSAO, NAO HA NADA A NORMALIZAR. Quem escreve sem `auth.uid()` e o
  -- seed, uma migration ou a chave de servico -- ninguem que possa estar
  -- forjando autoria, porque nenhum deles passa pelo navegador. Reescrever
  -- aqui apagaria o autor que o seed acabou de informar, e foi o que este
  -- trigger fez na primeira versao: a bateria parou no `not null` de
  -- `autor_id`, que e exatamente onde devia parar.
  if quem is null then
    return new;
  end if;

  new.autor_id := quem;

  if not public.is_staff() then
    new.interno := false;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_normaliza on public.comments;
create trigger comments_normaliza
  before insert on public.comments
  for each row execute function public.normalizar_comentario();


-- ---------------------------------------------------------------------------
-- PASSO 6 - A versao se numera sozinha
--
-- O numero sai do banco e nao da tela: duas abas abertas salvando ao mesmo
-- tempo leriam o mesmo `max + 1` e a segunda bateria no `unique`. Aqui a
-- segunda recebe o numero seguinte.
--
-- E gravar uma versao ATUALIZA o post: a arte que o cliente ve e sempre a da
-- versao mais alta. Sem isso, `posts.arte_url` e `post_versions` seriam duas
-- respostas para "qual e a arte de agora".
-- ---------------------------------------------------------------------------
create or replace function public.numerar_versao_do_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proximo integer;
begin
  select coalesce(max(numero_versao), 0) + 1 into proximo
    from public.post_versions where post_id = new.post_id;

  new.numero_versao := proximo;
  new.criado_por := coalesce(new.criado_por, (select auth.uid()));

  return new;
end;
$$;

drop trigger if exists post_versions_numera on public.post_versions;
create trigger post_versions_numera
  before insert on public.post_versions
  for each row execute function public.numerar_versao_do_post();

create or replace function public.sincronizar_post_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
     set versao_atual  = new.numero_versao,
         arte_url      = coalesce(new.arte_url, arte_url),
         thumbnail_url = coalesce(new.thumbnail_url, thumbnail_url),
         legenda       = coalesce(new.legenda, legenda),
         updated_at    = now()
   where id = new.post_id
     and new.numero_versao >= versao_atual;

  return new;
end;
$$;

drop trigger if exists post_versions_sincroniza on public.post_versions;
create trigger post_versions_sincroniza
  after insert on public.post_versions
  for each row execute function public.sincronizar_post_com_a_versao();

create or replace function public.tocar_updated_at_do_post()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.tocar_updated_at_do_post();


-- ---------------------------------------------------------------------------
-- PASSO 7 - A pergunta que a RLS inteira reusa
--
-- Irma de `subtask_visivel_ao_cliente` (0007/0030), e com a mesma forma: uma
-- funcao `security definer` que responde "este cliente pode ver isto?", para
-- as policies nao repetirem a consulta e nao divergirem.
-- ---------------------------------------------------------------------------
create or replace function public.post_visivel_ao_cliente(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  achou boolean;
begin
  select true into achou
    from public.posts p
   where p.id = p_post_id
     and p.enviado_em is not null
     and p.client_id in (select public.my_client_ids());

  return coalesce(achou, false);
end;
$$;

comment on function public.post_visivel_ao_cliente is
  'O post foi enviado E e de uma empresa de quem pergunta. Unica definicao de "o cliente ve este post" (0032).';

-- Irma de `pode_aprovar_subtarefa`. Hoje as duas sao `is_gestor()` e nada
-- mais -- a 0029 tirou as perguntas sobre quem executou. Existe separada pelo
-- mesmo motivo que aquela: se um dia a regra do post mudar, ha um lugar so
-- para mexer, e a policy nao precisa saber qual e.
create or replace function public.pode_aprovar_post(p_post_id uuid)
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

comment on function public.pode_aprovar_post is
  'Quem decide rodada interna de post: a gestao. O parametro fica para o dia em que a regra olhar o post (0032).';


-- ---------------------------------------------------------------------------
-- PASSO 8 - Quem ve o que
--
-- Uma pergunta so para o comentario, e ela delega: o comentario e visivel ao
-- cliente quando o CONTEUDO dele e. Sem esta funcao a policy de `comments`
-- repetiria a regra de `posts`, e duas copias da mesma pergunta divergem.
-- 'deliverable' devolve false porque a tabela dele nao existe ainda -- falhar
-- fechado, como a 0030 fez com os tipos sem regra.
-- ---------------------------------------------------------------------------
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

  return false;
end;
$$;


alter table public.posts         enable row level security;
alter table public.post_versions enable row level security;
alter table public.comments      enable row level security;

-- posts ---------------------------------------------------------------------
drop policy if exists posts_select         on public.posts;
drop policy if exists posts_select_cliente on public.posts;
drop policy if exists posts_insert         on public.posts;
drop policy if exists posts_update         on public.posts;
drop policy if exists posts_delete         on public.posts;

create policy posts_select on public.posts
  for select to authenticated using (public.is_staff());

-- A LINHA QUE SEGURA O SPRINT INTEIRO.
--
-- `enviado_em is not null` e o que faz um post em producao nao existir para o
-- cliente: nem no calendario, nem abrindo /portal/social-media/{id} com o id
-- na mao, nem chamando a API do Supabase com a chave anon. A tela nao repete
-- este filtro de proposito -- repetir seria criar um segundo lugar onde a
-- regra pode divergir, e o segundo lugar e sempre o que esquece.
create policy posts_select_cliente on public.posts
  for select to authenticated
  using (
    client_id in (select public.my_client_ids())
    and enviado_em is not null
  );

-- O cliente NAO edita post. Ele decide, e decidir passa pelo motor de
-- aprovacao -- que e `security definer` e roda como dono da tabela.
create policy posts_insert on public.posts
  for insert to authenticated with check (public.is_staff());

create policy posts_update on public.posts
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy posts_delete on public.posts
  for delete to authenticated using (public.is_gestor());

-- post_versions -------------------------------------------------------------
drop policy if exists post_versions_select on public.post_versions;
drop policy if exists post_versions_insert on public.post_versions;
drop policy if exists post_versions_update on public.post_versions;
drop policy if exists post_versions_delete on public.post_versions;

-- Mesma visibilidade do post-pai: quem ve o post ve o historico dele. Nao ha
-- versao secreta de um post que o cliente ja recebeu -- foi ele quem pediu os
-- ajustes que geraram a maioria delas.
create policy post_versions_select on public.post_versions
  for select to authenticated
  using (public.is_staff() or public.post_visivel_ao_cliente(post_id));

create policy post_versions_insert on public.post_versions
  for insert to authenticated with check (public.is_staff());

create policy post_versions_update on public.post_versions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy post_versions_delete on public.post_versions
  for delete to authenticated using (public.is_gestor());

-- comments ------------------------------------------------------------------
drop policy if exists comments_select         on public.comments;
drop policy if exists comments_select_cliente on public.comments;
drop policy if exists comments_insert         on public.comments;
drop policy if exists comments_insert_cliente on public.comments;
drop policy if exists comments_delete         on public.comments;

create policy comments_select on public.comments
  for select to authenticated using (public.is_staff());

-- `interno = false` E a parede. O comentario interno da equipe fica do lado
-- de ca dela, como a rodada de escopo interno ja ficava.
create policy comments_select_cliente on public.comments
  for select to authenticated
  using (
    interno = false
    and public.conteudo_visivel_ao_cliente(content_type, content_id)
  );

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (
      public.is_staff()
      or public.conteudo_visivel_ao_cliente(content_type, content_id)
    )
  );

-- SEM POLICY DE UPDATE, e e escolha. Comentario preso a uma rodada e o
-- registro do que foi pedido e do que foi respondido -- a mesma razao pela
-- qual rodada fechada nunca e reescrita. Quem se arrependeu comenta de novo.
create policy comments_delete on public.comments
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 9 - O comentario do cliente avisa a equipe
--
-- Pelo sino, que e a unica porta de escrita em `notifications`. O e-mail e o
-- Sprint 16.
--
-- Quem recebe: o responsavel de atendimento da conta e quem criou o post. Sao
-- duas pessoas e nao "a equipe inteira": aviso que chega para todo mundo nao
-- chega para ninguem. `notificar()` ja engole o caso de a pessoa ser a propria
-- autora.
-- ---------------------------------------------------------------------------
create or replace function public.avisar_comentario_do_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p          public.posts%rowtype;
  atendente  uuid;
  quem       text;
begin
  if new.interno or new.content_type <> 'post' then
    return new;
  end if;

  select * into p from public.posts where id = new.content_id;
  if not found then
    return new;
  end if;

  -- So o comentario de quem esta do lado de la vira aviso. A equipe
  -- conversando entre si no post nao precisa tocar o sino de si mesma.
  if public.is_staff() then
    return new;
  end if;

  select nome into quem from public.profiles where id = new.autor_id;
  select responsavel_atendimento_id into atendente from public.clients where id = p.client_id;

  perform public.notificar(
    atendente, 'cliente',
    format('%s comentou em "%s"', coalesce(quem, 'O cliente'), p.tema),
    left(new.texto, 180),
    format('/painel/gestao-tasks')
  );

  if p.criado_por is distinct from atendente then
    perform public.notificar(
      p.criado_por, 'cliente',
      format('%s comentou em "%s"', coalesce(quem, 'O cliente'), p.tema),
      left(new.texto, 180),
      format('/painel/gestao-tasks')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists comments_avisa_a_equipe on public.comments;
create trigger comments_avisa_a_equipe
  after insert on public.comments
  for each row execute function public.avisar_comentario_do_cliente();


-- ---------------------------------------------------------------------------
-- PASSO 10 - O motor de aprovacao aprende 'post'
--
-- Irma de `subtask_da_rodada`, com a mesma assinatura e o mesmo proposito:
-- devolver o id quando o tipo bate, e null quando nao bate. E o `null` que as
-- funcoes leem para recusar o tipo sem regra.
-- ---------------------------------------------------------------------------
create or replace function public.post_da_rodada(p_content_type text, p_content_id uuid)
returns uuid
language plpgsql
immutable
as $$
begin
  return case when p_content_type = 'post' then p_content_id end;
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
  dono  uuid;
  exige boolean;
begin
  -- TIPO SEM REGRA CONTINUA SENDO TIPO RECUSADO. 'deliverable' entra com a
  -- tabela dele, no Sprint 13, e traz a regra junto -- como 'post' traz aqui.
  if alvo is null and post is null then
    raise exception using
      errcode = 'check_violation',
      message = format('Rodada de aprovação de "%s" ainda não tem regra.', new.content_type),
      hint    = 'Só conteúdo dos tipos subtask e post passa por aqui hoje.';
  end if;

  if post is not null then
    select p.criado_por into dono from public.posts p where p.id = post;

    if not found then
      raise exception using
        errcode = 'check_violation',
        message = 'Post não encontrado.';
    end if;

    -- O POST NAO TEM `requer_aprovacao`, e a ausencia e o desenho: post
    -- existe para ser aprovado. A etapa de demanda tem a coluna porque
    -- "subir a midia" nao precisa do aval de ninguem; nao ha post
    -- equivalente a isso.
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

      -- A mesma trava da etapa, pela mesma razao: aprovar e enviar sao duas
      -- decisoes. A 0029 liberou aprovar o proprio trabalho e NAO liberou
      -- envia-lo.
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

  select s.responsavel_id, s.requer_aprovacao into dono, exige
    from public.subtasks s where s.id = alvo;

  if not coalesce(exige, false) then
    raise exception using
      errcode = 'check_violation',
      message = 'Essa subtarefa não exige aprovação.';
  end if;

  if new.escopo = 'interna' then
    -- quem produziu pede a validacao; a gestao tambem pode, para destravar
    if new.solicitado_por is distinct from dono and not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Só o responsável pela subtarefa envia para aprovação.';
    end if;
  else
    -- escopo cliente: ato deliberado da gestao, e so depois do aval interno
    if not public.is_gestor() then
      raise exception using
        errcode = 'check_violation',
        message = 'Enviar para o cliente é do Desenvolvedor.',
        hint    = 'O responsável pela subtarefa nunca envia material ao cliente.';
    end if;

    -- A 0029 liberou APROVAR o proprio trabalho. ENVIAR ao cliente continua
    -- travado: sao duas decisoes, e o usuario mudou uma.
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
-- PASSO 11 - ENVIAR E ABRIR A RODADA
--
-- `posts.enviado_em` nao e preenchido por quem chama: ele e consequencia de a
-- rodada de escopo cliente existir. Um carimbo escrito a parte seria uma
-- segunda verdade sobre o mesmo fato -- daria para ter rodada de cliente num
-- post que ele nao enxerga (a fila mostraria uma decisao impossivel), e post
-- carimbado sem rodada nenhuma (o cliente veria material sem ter onde
-- decidir). As duas ja aconteceram em produtos parecidos.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_post_como_enviado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content_type <> 'post' or new.escopo <> 'cliente' then
    return new;
  end if;

  update public.posts
     set enviado_em = coalesce(enviado_em, now()),
         status     = 'em_aprovacao'
   where id = new.content_id;

  return new;
end;
$$;

drop trigger if exists approval_rounds_marca_post on public.approval_rounds;
create trigger approval_rounds_marca_post
  after insert on public.approval_rounds
  for each row execute function public.marcar_post_como_enviado();


-- ---------------------------------------------------------------------------
-- PASSO 12 - A decisao do cliente, agora com tres desfechos
--
-- Continua sendo UMA funcao, e nao uma por tipo: quem decide e o cliente, a
-- checagem de a quem o conteudo pertence e a mesma pergunta, e a recusa de
-- rodada ja decidida tambem. O que muda por tipo e o efeito -- qual tabela
-- recebe o novo status e onde fica o registro.
--
-- 'rejeitada' NAO vale para etapa de demanda. O fluxo da etapa tem dois
-- desfechos desde a 0007 (aprovada, ou volta para ajustes) e nao existe
-- `subtask_status` que signifique "recusada" -- inventar um aqui criaria um
-- estado que nenhuma tela sabe desenhar e nenhuma trava sabe conferir.
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
  id_da_task uuid;
  p          public.posts%rowtype;
  atendente  uuid;
  quem       uuid := (select auth.uid());
  nome_quem  text;
begin
  select * into r from public.approval_rounds where id = p_round_id;

  if not found then
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

  -- MOTIVO E OBRIGATORIO NOS DOIS DESFECHOS NEGATIVOS, e a exigencia mora
  -- aqui e nao so na tela: "rejeitado" sem uma linha dizendo por que manda a
  -- equipe adivinhar, e a proxima versao sai igual.
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

  if alvo is null and post is null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = format('Aprovação de "%s" ainda não é decidida por aqui.', r.content_type);
  end if;

  -- ---------------------------------------------------------------- post ---
  if post is not null then
    if not public.post_visivel_ao_cliente(post) then
      raise exception using
        errcode = 'insufficient_privilege',
        message = 'Sem acesso a esta aprovação.';
    end if;

    update public.approval_rounds
       set status = p_decisao,
           decidido_por = quem,
           decidido_em = now(),
           comentario = p_comentario
     where id = p_round_id;

    update public.posts
       set status = (case p_decisao
                       when 'aprovada' then 'aprovado'
                       when 'rejeitada' then 'rejeitado'
                       else 'ajustes'
                     end)::public.content_status
     where id = post
    returning * into p;

    if p_comentario is not null and btrim(p_comentario) <> '' then
      insert into public.comments (content_type, content_id, approval_round_id, autor_id, texto, interno)
      values ('post', post, p_round_id, quem, p_comentario, false);
    end if;

    select nome into nome_quem from public.profiles where id = quem;
    select responsavel_atendimento_id into atendente from public.clients where id = p.client_id;

    perform public.notificar(
      atendente, 'aprovacao',
      format('%s %s "%s"',
             coalesce(nome_quem, 'O cliente'),
             case p_decisao
               when 'aprovada' then 'aprovou'
               when 'rejeitada' then 'recusou'
               else 'pediu ajustes em'
             end,
             p.tema),
      p_comentario,
      '/painel/gestao-tasks'
    );

    if p.criado_por is distinct from atendente then
      perform public.notificar(
        p.criado_por, 'aprovacao',
        format('%s %s "%s"',
               coalesce(nome_quem, 'O cliente'),
               case p_decisao
                 when 'aprovada' then 'aprovou'
                 when 'rejeitada' then 'recusou'
                 else 'pediu ajustes em'
               end,
               p.tema),
        p_comentario,
        '/painel/gestao-tasks'
      );
    end if;

    return;
  end if;

  -- ------------------------------------------------------------- subtask ---
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
     set status = p_decisao,
         decidido_por = quem,
         decidido_em = now(),
         comentario = p_comentario
   where id = p_round_id;

  update public.subtasks
     set status = (case when p_decisao = 'aprovada' then 'concluida' else 'em_ajustes' end)::public.subtask_status
   where id = alvo;

  select task_id into id_da_task from public.subtasks where id = alvo;

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
-- PASSO 13 - O cascade que a chave estrangeira nao faz
--
-- Mesma historia da 0030: `content_id` nao tem `references`, porque aponta
-- para tabelas diferentes conforme o tipo. Apagar um post precisa levar junto
-- as rodadas e os comentarios dele, senao a fila de aprovacoes tenta mostrar
-- um post que nao existe mais.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_conteudo_do_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.approval_rounds where content_type = 'post' and content_id = old.id;
  delete from public.comments        where content_type = 'post' and content_id = old.id;
  return old;
end;
$$;

drop trigger if exists posts_limpa_conteudo on public.posts;
create trigger posts_limpa_conteudo
  after delete on public.posts
  for each row execute function public.limpar_conteudo_do_post();


-- ---------------------------------------------------------------------------
-- PASSO 14 - As policies da rodada aprendem o tipo novo
--
-- A 0030 escreveu `content_type = 'subtask'` nas duas justamente para nao
-- deixar um tipo sem regra passar. Agora 'post' tem regra, entao ele entra --
-- e 'deliverable' continua de fora, pela mesma frase.
-- ---------------------------------------------------------------------------
drop policy if exists approval_rounds_select_cliente on public.approval_rounds;
create policy approval_rounds_select_cliente on public.approval_rounds
  for select to authenticated
  using (
    escopo = 'cliente'
    and (
      (content_type = 'subtask' and public.subtask_visivel_ao_cliente(content_id))
      or (content_type = 'post' and public.post_visivel_ao_cliente(content_id))
    )
  );

drop policy if exists approval_rounds_decide on public.approval_rounds;
create policy approval_rounds_decide on public.approval_rounds
  for update to authenticated
  using (
    (content_type = 'subtask' and public.pode_aprovar_subtarefa(content_id))
    or (content_type = 'post' and public.pode_aprovar_post(content_id))
  )
  with check (
    (content_type = 'subtask' and public.pode_aprovar_subtarefa(content_id))
    or (content_type = 'post' and public.pode_aprovar_post(content_id))
  );


-- ---------------------------------------------------------------------------
-- PASSO 15 - O bucket das artes
--
-- Privado, como todo bucket do produto. A arte de um post nao publicado e
-- material da agencia; URL publica e URL que circula em grupo de WhatsApp
-- antes de o cliente ter decidido.
--
-- O cliente LE, e e a diferenca para `task-arquivos`: ele precisa ver a arte
-- para poder aprova-la. Quem escreve continua sendo so a equipe.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('posts-artes', 'posts-artes', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "posts-artes: equipe le" on storage.objects';
  execute 'drop policy if exists "posts-artes: cliente le" on storage.objects';
  execute 'drop policy if exists "posts-artes: equipe escreve" on storage.objects';
  execute 'drop policy if exists "posts-artes: equipe apaga" on storage.objects';

  execute $politica$
    create policy "posts-artes: equipe le" on storage.objects
      for select to authenticated
      using (bucket_id = 'posts-artes' and public.is_staff())
  $politica$;

  -- A pasta e o id da empresa: `posts-artes/{client_id}/{post_id}/arquivo`.
  -- E assim que a policy consegue perguntar de quem e o arquivo sem abrir
  -- `posts` -- o nome do objeto carrega a resposta.
  execute $politica$
    create policy "posts-artes: cliente le" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'posts-artes'
        and (storage.foldername(name))[1]::uuid in (select public.my_client_ids())
      )
  $politica$;

  execute $politica$
    create policy "posts-artes: equipe escreve" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'posts-artes' and public.is_staff())
  $politica$;

  execute $politica$
    create policy "posts-artes: equipe apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'posts-artes' and public.is_staff())
  $politica$;
end
$$;

notify pgrst, 'reload schema';
