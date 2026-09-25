-- ---------------------------------------------------------------------------
-- 0042 - O SOCIAL MEDIA PASSA A TER TELA INTERNA
--
-- Ate aqui o Portal do Cliente estava pronto (Sprint 12) e o lado da agencia
-- nao existia: para um post chegar ao cliente, alguem colava SQL no Supabase
-- por `scripts/enviar-post-a-mao.sql`. Esta migration e o banco do que falta.
--
-- Decisao do usuario, e e ela que organiza o resto: "essa aba de social media
-- tem que ser criada por um desenvolvedor ou socio, liberada para o
-- colaborador que for fazer o conteudo e os layouts, e quando finalizada
-- enviada para o cliente".
--
-- Sao TRES maos, e o produto ja tinha duas delas travadas:
--
--   1. a GESTAO abre o post e define cliente, data, rede e briefing;
--   2. o COLABORADOR liberado produz -- arte, slides, legenda;
--   3. a GESTAO revisa e envia, e quem envia nunca e quem produziu.
--
-- O QUE FALTAVA PARA A PRIMEIRA: `posts_insert` era `is_staff()`, entao
-- qualquer colaborador abria post. Passa a ser `is_gestor()`.
--
-- O QUE FALTAVA PARA A SEGUNDA: nao havia onde gravar "este post e da
-- Marina". Entra `responsavel_id`.
--
-- E A TERCEIRA JA ESTAVA TRAVADA -- MAS ESTE SPRINT A QUEBRARIA.
-- `validar_nova_rodada` recusa desde a 0032 que o dono do post o envie ao
-- cliente, e pergunta quem e o dono olhando `criado_por`. No fluxo novo
-- `criado_por` passa a ser A GESTAO, que abre o briefing, e quem produz e o
-- responsavel. As duas travas ficariam do avesso:
--
--   - "So quem produziu o post envia para aprovacao" olharia a gestao, e o
--     colaborador que fez nao conseguiria pedir o aval interno;
--   - "Ninguem envia ao cliente a propria entrega" compararia com a gestao, e
--     o responsavel que produziu poderia mandar a propria entrega.
--
-- Por isso o PASSO 6 reescreve a funcao: o dono de um post passa a ser
-- `coalesce(responsavel_id, criado_por)`. O `coalesce` e o que mantem de pe o
-- post antigo, aberto antes desta migration, que nao tem responsavel.
--
-- ---------------------------------------------------------------------------
-- A MIDIA, E POR QUE ELA NAO E O `formato`
--
-- O usuario perguntou onde a pessoa escolhe entre video, carrossel, post
-- estatico e stories. Sao DUAS perguntas numa lista so:
--
--   - estatico / carrossel / video  e O QUE A TELA DESENHA;
--   - feed / stories / reels        e ONDE VAI AO AR.
--
-- "Stories" nao e irmao de "carrossel": um story e imagem ou video, e uma
-- sequencia de cinco stories e um carrossel de stories.
--
-- `formato` CONTINUA TEXTO, e a 0032 estava certa -- o comentario dela diz
-- que "feed, story, reels e carrossel mudam de nome a cada temporada de
-- produto das plataformas, e um enum obrigaria uma migration a cada nome
-- novo". Reels e Shorts sao dessa safra.
--
-- `midia` E ENUM, e esses tres nao mudam: ou e uma imagem, ou sao varias em
-- ordem, ou toca. E precisa ser enum e nao texto porque e ele que decide qual
-- editor aparece -- um 'Carrossel' com C maiusculo faria a faixa de slides
-- sumir sem erro nenhum.
--
-- ---------------------------------------------------------------------------
-- VIDEO E POR LINK, E NAO POR UPLOAD (decisao do usuario)
--
-- `video_url` guarda o endereco no Drive ou no YouTube. O visualizador do
-- portal desenha `<img>`, com zoom de roda e pinca; um `.mp4` ali apareceria
-- quebrado. Player, poster e limite de tamanho no bucket sao entrega propria.
--
-- O custo foi dito a quem decidiu: o cliente sai do portal para assistir, e
-- decide longe do botao de aprovar -- que e exatamente o que o Sprint 12
-- evitou ao por a arte grande antes dos botoes. A tela avisa que o link abre
-- fora.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A midia, e o video por link
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_midia') then
    create type public.post_midia as enum ('imagem', 'carrossel', 'video');
  end if;
end;
$$;

alter table public.posts
  add column if not exists midia public.post_midia not null default 'imagem';

alter table public.posts
  add column if not exists video_url text;

comment on column public.posts.midia is
  'O que a tela desenha: uma imagem, varias em ordem, ou um player. NAO e o `formato` -- aquele e onde vai ao ar (Feed, Stories, Reels) e muda de nome a cada temporada.';
comment on column public.posts.video_url is
  'Video e por LINK e nao por upload (0042, decisao do usuario). O visualizador do portal desenha <img>; player e poster sao entrega propria.';

-- O QUE JA ESTAVA GRAVADO, e este passo nao e opcional. Ate aqui `formato`
-- carregava OS DOIS SENTIDOS: ha post com `formato = 'carrossel'` e outro com
-- `formato = 'video'`, escritos quando nao havia onde dizer o que a tela
-- desenha. Sem esta conversao eles nascem `midia = 'imagem'` -- o default --,
-- e um carrossel de cinco slides abriria no editor de arte unica, com quatro
-- arquivos invisiveis.
--
-- REELS E SHORTS SAO VIDEO, e e por isso que a lista tem sinonimos em vez de
-- igualdade: o nome comercial e justamente o que muda, e o que nao muda e que
-- aquilo toca.
--
-- `where midia = 'imagem'` faz a migration rodar duas vezes sem desfazer uma
-- escolha feita a mao depois dela.
update public.posts
   set midia = case
     when lower(coalesce(formato, '')) in ('carrossel', 'carousel') then 'carrossel'
     when lower(coalesce(formato, '')) in ('video', 'vídeo', 'reels', 'reel', 'shorts', 'short') then 'video'
     else 'imagem'
   end::public.post_midia
 where midia = 'imagem';

-- Link quebrado digitado a mao e pior que campo vazio: alguem clica.
alter table public.posts drop constraint if exists posts_video_url_http;
alter table public.posts
  add constraint posts_video_url_http
  check (video_url is null or video_url ~* '^https?://');


-- ---------------------------------------------------------------------------
-- PASSO 2 - Os slides do carrossel
--
-- `arquivos` e JSONB e nao uma tabela, e e o mesmo criterio do template de
-- campanha contra o workflow de task: a versao e escrita de uma vez e lida
-- inteira, nunca consultada slide a slide. Normalizar criaria uma tabela para
-- servir um `select * where version_id = ?`.
--
-- E `posts.arte_url` CONTINUA SENDO A CAPA -- o primeiro slide. E isso que faz
-- nada do que ja existe quebrar: o calendario, o card da lista e a miniatura
-- do portal leem a mesma coluna de sempre.
-- ---------------------------------------------------------------------------

alter table public.post_versions
  add column if not exists arquivos jsonb not null default '[]'::jsonb;

alter table public.post_versions
  add column if not exists video_url text;

comment on column public.post_versions.arquivos is
  'Os slides desta versao, em ordem: [{url, thumbnail_url, nome}]. A capa continua em posts.arte_url.';

alter table public.post_versions drop constraint if exists post_versions_arquivos_lista;
alter table public.post_versions
  add constraint post_versions_arquivos_lista
  check (jsonb_typeof(arquivos) = 'array');


-- ---------------------------------------------------------------------------
-- PASSO 3 - O responsavel
-- ---------------------------------------------------------------------------

alter table public.posts
  add column if not exists responsavel_id uuid references public.profiles (id) on delete set null;

comment on column public.posts.responsavel_id is
  'Para quem a gestao liberou a producao. Nulo = ninguem pegou ainda. Quem ABRE o post e criado_por, e as duas colunas sao pessoas diferentes por desenho.';

create index if not exists posts_responsavel_idx
  on public.posts (responsavel_id, data_publicacao);


-- ---------------------------------------------------------------------------
-- PASSO 4 - Quem abre e quem edita
-- ---------------------------------------------------------------------------

drop policy if exists posts_insert on public.posts;
drop policy if exists posts_update on public.posts;

-- ABRIR O POST E DA GESTAO. Era `is_staff()`, e nao por decisao: a 0032 nao
-- tinha a corrente de maos ainda.
create policy posts_insert on public.posts
  for insert to authenticated with check (public.is_gestor());

-- EDITAR E DA GESTAO OU DE QUEM RECEBEU. O colaborador mexe no que e dele; o
-- que ele NAO pode trocar -- cliente, responsavel, data -- e o trigger do
-- PASSO 5 que segura, porque policy nao limita coluna.
create policy posts_update on public.posts
  for update to authenticated
  using (public.is_gestor() or responsavel_id = (select auth.uid()))
  with check (public.is_gestor() or responsavel_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- PASSO 5 - O que o colaborador NAO troca
--
-- POLICY NAO LIMITA COLUNA, e e a mesma razao de `protect_client_columns` e de
-- `comments_normaliza`: sem o trigger, um PATCH no PostgREST passaria a
-- demanda para outro cliente ou tiraria o post das proprias maos.
--
-- RECUSA EM VEZ DE REESCREVER, ao contrario de `comments_normaliza`. La o
-- campo nem aparece na tela do cliente, entao devolver o valor certo e
-- silencioso e correto. Aqui os campos aparecem: um colaborador que tenta
-- trocar a data precisa ouvir que nao pode, senao ele salva, ve a data antiga
-- voltar e conclui que a tela esta quebrada.
-- ---------------------------------------------------------------------------

create or replace function public.proteger_colunas_do_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_gestor() then
    return new;
  end if;

  -- Sem sessao quem escreve e o seed.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.client_id is distinct from old.client_id then
    raise exception using
      errcode = 'check_violation',
      message = 'Trocar o cliente de um post é da gestão.',
      hint    = 'Peça a quem abriu o post, ou abra um novo para o outro cliente.';
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    raise exception using
      errcode = 'check_violation',
      message = 'Passar o post para outra pessoa é da gestão.',
      hint    = 'Se não é para ser seu, avise quem liberou.';
  end if;

  if new.data_publicacao is distinct from old.data_publicacao then
    raise exception using
      errcode = 'check_violation',
      message = 'A data de publicação é da gestão.',
      hint    = 'Ela foi combinada com o cliente; peça a troca a quem abriu o post.';
  end if;

  -- `enviado_em` nao se escreve a mao NUNCA, nem pela gestao: ele e
  -- consequencia da rodada de escopo cliente, pelo trigger
  -- `approval_rounds_marca_post` da 0032. A gestao passa pelo `return` la em
  -- cima, entao esta checagem e so do colaborador -- a dela mora no trigger
  -- proprio, que ja existe.
  if new.enviado_em is distinct from old.enviado_em then
    raise exception using
      errcode = 'check_violation',
      message = 'O envio ao cliente não se marca à mão.',
      hint    = 'Ele acontece quando a gestão usa a ação Enviar ao cliente.';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_protege_colunas on public.posts;
create trigger posts_protege_colunas
  before update on public.posts
  for each row execute function public.proteger_colunas_do_post();


-- ---------------------------------------------------------------------------
-- PASSO 6 - O DONO DO POST PASSA A SER O RESPONSAVEL
--
-- A correcao que este sprint obriga. Ver o cabecalho: sem ela, "ninguem envia
-- ao cliente a propria entrega" passaria a comparar com a gestao que abriu o
-- briefing, e quem produziu poderia enviar.
--
-- A funcao e reescrita INTEIRA e a partir da versao da 0033, QUE E A ULTIMA.
-- `create or replace` de um corpo montado a partir de uma versao antiga
-- desfaz em silencio o que veio depois -- e eu escrevi esta frase e cai nela
-- na mesma tarde: montei a partir da 0032, que nao conhece `deliverable`, e a
-- bateria estourou com "Post nao encontrado" num cenario de campanha, tres
-- arquivos adiante. `validar_nova_rodada` ja foi reescrita quatro vezes
-- (0007, 0030, 0032, 0033); quem mexer nela de novo, parta da maior.
-- ---------------------------------------------------------------------------

create or replace function public.dono_do_post(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare quem uuid;
begin
  -- `coalesce` e o que mantem de pe o post aberto ANTES desta migration, que
  -- nao tem responsavel: nele quem produziu foi quem criou.
  select coalesce(p.responsavel_id, p.criado_por) into quem
    from public.posts p where p.id = p_post_id;
  return quem;
end;
$$;

comment on function public.dono_do_post is
  'Quem PRODUZIU o post -- o responsavel, ou quem o criou nos posts anteriores a 0042. Nao confundir com criado_por, que depois da 0042 e a gestao que abriu o briefing.';

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
    -- QUEM PRODUZIU, e nao quem abriu (0042). Antes desta linha era
    -- `p.criado_por`, e com a corrente de maos isso passou a apontar para a
    -- gestao que escreveu o briefing -- virando as duas travas abaixo do
    -- avesso. Ver o cabecalho da 0042.
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

      -- VIDEO SEM LINK NAO VAI (0042). O cliente abriria a tela para decidir
      -- sobre uma arte que nao existe -- e decidiria, porque o botao de
      -- aprovar estaria la. A recusa e aqui e nao na tela porque este e o
      -- unico ponto por onde o material sai da agencia.
      if exists (
        select 1 from public.posts p
         where p.id = post and p.midia = 'video'
           and nullif(trim(coalesce(p.video_url, '')), '') is null
      ) then
        raise exception using
          errcode = 'check_violation',
          message = 'Este post é vídeo e ainda não tem o link.',
          hint    = 'Cole o endereço do Drive ou do YouTube antes de enviar.';
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

-- SEM `create trigger` AQUI, e a ausencia custou uma rodada da bateria.
-- O gatilho ja existe desde a 0030, com o nome `approval_rounds_valida_nova`,
-- e um `create or replace function` basta -- ele passa a executar o corpo
-- novo. Eu criei um SEGUNDO gatilho, com outro nome, chamando a mesma funcao:
-- ninguem notou pela mensagem de erro, porque o sintoma apareceu longe --
-- `14_portal_do_cliente.sql` desliga `approval_rounds_valida_nova` por uma
-- linha para semear uma rodada de proposito invalida, e a minha duplicata
-- continuava disparando. Dois gatilhos com o mesmo corpo nao dobram a trava;
-- eles quebram quem sabe desliga-la.


-- ---------------------------------------------------------------------------
-- PASSO 7 - A versao carrega os slides e o link
--
-- `sincronizar_post_com_a_versao` (0032) copiava arte, thumbnail e legenda da
-- versao para o post. Com carrossel e video ela precisa carregar mais duas
-- colunas, e o `coalesce` continua sendo o desenho: versao que nao mexeu num
-- campo nao apaga o que estava la.
--
-- `arte_url` CONTINUA SENDO A CAPA e e alimentada pelo primeiro slide quando
-- a versao traz `arquivos` -- e o que faz o calendario e a miniatura do portal
-- nao saberem que carrossel existe.
-- ---------------------------------------------------------------------------

create or replace function public.sincronizar_post_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  capa  text := new.arte_url;
  miniatura text := new.thumbnail_url;
begin
  -- A CAPA SAI DO PRIMEIRO SLIDE quando a versao e de carrossel e nao trouxe
  -- `arte_url` explicita. Sem isto, subir cinco slides deixaria o card e o
  -- calendario sem imagem nenhuma -- e ninguem ligaria uma coisa a outra.
  if capa is null and jsonb_array_length(coalesce(new.arquivos, '[]'::jsonb)) > 0 then
    capa := new.arquivos->0->>'url';
    miniatura := coalesce(miniatura, new.arquivos->0->>'thumbnail_url');
  end if;

  update public.posts
     set versao_atual  = new.numero_versao,
         arte_url      = coalesce(capa, arte_url),
         thumbnail_url = coalesce(miniatura, thumbnail_url),
         legenda       = coalesce(new.legenda, legenda),
         video_url     = coalesce(new.video_url, video_url),
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


-- ---------------------------------------------------------------------------
-- PASSO 8 - Liberar avisa quem recebeu
--
-- E por TRIGGER e nao pela action, pela mesma razao que a decisao do Full Days
-- mora no banco: liberar e uma escrita so, e um aviso que depende de a tela
-- lembrar de chama-lo e um aviso que some no dia em que alguem gravar por
-- outro caminho.
--
-- `notificar()` nunca avisa quem causou o aviso -- entao a gestao que liberou
-- o post para si mesma nao recebe nada, e esta certo.
-- ---------------------------------------------------------------------------

create or replace function public.avisar_responsavel_do_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  empresa text;
begin
  if new.responsavel_id is null
     or new.responsavel_id is not distinct from old.responsavel_id then
    return new;
  end if;

  select c.nome_empresa into empresa from public.clients c where c.id = new.client_id;

  perform public.notificar(
    new.responsavel_id,
    'task',
    format('%s é seu: %s', new.tema, coalesce(empresa, 'cliente')),
    format('Publica em %s. A arte e a legenda são com você.',
           to_char(new.data_publicacao, 'DD/MM')),
    '/painel/social-media?post=' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists posts_avisa_responsavel on public.posts;
create trigger posts_avisa_responsavel
  after update of responsavel_id on public.posts
  for each row execute function public.avisar_responsavel_do_post();

notify pgrst, 'reload schema';
