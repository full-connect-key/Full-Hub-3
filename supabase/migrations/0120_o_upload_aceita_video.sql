-- ---------------------------------------------------------------------------
-- 0120 - O UPLOAD ACEITA VIDEO E ARQUIVO DE CRIACAO
--
-- Decisao do usuario, item 30: "aceitar PDF / PSD, AI / JPG, JPEG, PNG / MP4,
-- MOV, WEBM nas areas de Social, Campanhas, Tasks e Biblioteca (...) limites
-- de tamanho compativeis com video, alem de uploads resumiveis (...)
-- armazenamento seguro com controle de acesso por cliente".
--
-- ===========================================================================
-- A METADE QUE JA ESTAVA PRONTA, E E POR ISSO QUE ESTA MIGRATION E CURTA
--
-- "Armazenamento seguro com controle de acesso por cliente" e o unico pedido
-- do item 30 que o produto JA CUMPRIA, e cumpria bem: os tres buckets sao
-- privados (`public = false`) desde que nasceram, a leitura sai por URL
-- assinada de uma hora, e a PRIMEIRA PASTA do caminho e o id da empresa --
-- `posts-artes/{client_id}/...` (0032) e `campanhas-arquivos/{client_id}/...`
-- (0033) --, que e como a policy pergunta de quem e o arquivo sem abrir a
-- tabela. Em `task-arquivos` a convencao e `entregas/{subtask_id}/...` (0007),
-- e ali quem responde e `subtask_visivel_ao_cliente()`.
--
-- O VIDEO ENTRA PELA MESMA PORTA, no mesmo bucket e com o mesmo caminho --
-- entao nenhuma policy nova nasce aqui. E a diferenca entre acrescentar um
-- tipo de arquivo e acrescentar um tipo de acesso.
--
-- ===========================================================================
-- O QUE A TELA NAO TEM COMO TRAVAR, E E POR ISSO QUE ISTO E MIGRATION
--
-- O `accept=` de um `<input type="file">` e SUGESTAO: todo seletor de arquivo
-- do sistema oferece "Todos os arquivos" ao lado, e arrastar para a janela
-- ignora o atributo. E o `conferirArquivo()` de `lib/dominio/arquivos.ts` vale
-- para quem passa pela tela.
--
-- Quem recusa de verdade sao as duas colunas de `storage.buckets`, que o
-- proprio Storage le antes de gravar um byte:
--
--   * `allowed_mime_types` -- O QUE O STORAGE PODE SERVIR. E esta a razao de
--     ela existir, e nao "so estes nove formatos": um `.html` servido pelo
--     dominio do Storage, por URL assinada, e script rodando num dominio que
--     carrega a sessao de quem abriu. E a mesma decisao que `EH_IMAGEM` toma
--     desde a 0053 ao excluir `svg` -- "SVG de terceiro dentro de `<img>` e
--     vetor de script, e material de campanha vem de fora com frequencia" --,
--     e ate hoje aquela decisao protegia so o caminho do DESENHO: nada
--     impedia o arquivo de subir e ser servido.
--
--   * `file_size_limit` -- o teto por bucket.
--
-- ***E `application/octet-stream` ESTA NA LISTA, o que e o custo desta
-- trava e fica dito em vez de escondido:*** um `.psd` chega como
-- `image/vnd.adobe.photoshop` no Chrome, como `application/octet-stream` em
-- metade dos sistemas e como string vazia no resto; um `.ai` moderno E um PDF
-- e chega como `application/pdf`. Sem o octet-stream, os dois formatos que a
-- agencia mais precisa -- o arquivo aberto de criacao -- seriam recusados de
-- um jeito que ninguem depura: o mesmo arquivo passa na maquina de quem
-- escreveu e falha na de quem usa.
--
-- O que a lista continua garantindo com ele dentro e o que importa: nada que
-- o navegador RENDERIZE entra se nao estiver nomeado. Um HTML declarado como
-- octet-stream sobe, e o Storage o serve como octet-stream -- download, nao
-- pagina.
--
-- ***E O TETO GLOBAL DO PROJETO GANHA DESTE, e isto NAO foi medido aqui:***
-- o Storage aplica `min(file_size_limit do bucket, limite do projeto)`, e o do
-- projeto e configuracao de painel (Storage > Settings > Upload file size
-- limit) -- nao ha SQL que a leia nem que a mude. Com o limite do projeto em
-- 50 MB, estes 500 MB nao valem nada e o vídeo de 400 MB e recusado com
-- "Payload too large". **Quem aplicar esta migration confere aquele numero no
-- painel**, e e a mesma classe de pendencia do `pg_cron`, que se habilita por
-- la e nao por migration.
--
-- ===========================================================================
-- E O VIDEO DO POST PASSA A PODER SER ARQUIVO
--
-- `posts.video_url` guarda o endereco no Drive ou no YouTube desde a 0042, por
-- decisao do usuario, e o cabecalho dela escreveu o custo: *"o cliente sai do
-- portal para assistir, e decide longe do botao de aprovar"*. O item 30 e do
-- mesmo usuario, e e posterior: ele pede MP4, MOV e WEBM. Entao o link nao
-- sai -- ele ganha um irmao.
--
-- **SAO DUAS COLUNAS E NAO UMA, e a razao e o `check` que ja existe:**
-- `posts_video_url_http` cobra `^https?://`, e caminho de bucket nao e
-- endereco. Relaxar aquele check faria `video_url` querer dizer duas coisas, e
-- todo leitor teria que perguntar qual -- que e onde as duas verdades comecam
-- a divergir. `video_caminho` quer dizer "o video esta no Full Hub";
-- `video_url`, "o video esta em outro lugar".
--
-- **E O VIDEO NAO ENTRA EM `post_versions.arquivos`**, que era o caminho mais
-- curto e esta errado: `sincronizar_post_com_a_versao()` escreve
-- `arte_url := arquivos->0->>'url'` -- o PRIMEIRO ARQUIVO e nao a primeira
-- imagem --, entao um video no inicio da lista viraria a CAPA do post, e o
-- card, o calendario e a miniatura do portal sairiam com moldura quebrada. A
-- coluna propria e o que mantem a capa sendo uma imagem.
--
-- **QUEM RESPONDE "ESTE POST TEM VIDEO" E UMA FUNCAO, e e ela que faz a trava
-- do envio caber numa linha.** `validar_nova_rodada` tem duzentas linhas e
-- quatro ramos; `create or replace` reescreve a partir do texto de agora e nao
-- avisa quando o texto novo tem menos coisa que o velho -- a licao da 0030,
-- que perdeu um bloco de carimbos inteiro assim e so apareceu na 0052. Aqui a
-- funcao e COPIADA INTEIRA da 0090 e o diff e UMA condicao, marcada no corpo.
--
-- ===========================================================================
-- ORDEM: as duas colunas nascem antes da funcao que as le, e a funcao antes
-- do gatilho que a chama.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - OS TRES BUCKETS PASSAM A RECUSAR
--
-- SO OS TRES QUE O ITEM 30 NOMEIA. `academy-arquivos` fica de fora de
-- proposito: ele carrega o e-book interativo, que E um HTML servido por URL
-- assinada (0102) -- por desenho, e com o `frame-src` do CSP aberto para o
-- dominio do Storage justamente por causa dele. Uma lista de mimes ali
-- mataria o modulo.
--
-- `avatars` (publico), `notas-fiscais`, `comodatos-fotos`,
-- `solicitacoes-arquivos`, `recomendacoes-capas`, `recomendacoes-imagens`,
-- `academy-capas` e `academy-materiais` tambem ficam como estao: cada um tem
-- a tela dele, com o `accept` dele, e apertar todos de uma vez por causa de
-- um pedido sobre tres seria mexer em oito modulos sem ninguem ter pedido.
-- ---------------------------------------------------------------------------
do $$
declare
  -- A LISTA, e cada grupo tem razao:
  --
  --  * os NOVE do pedido -- jpg/jpeg (`image/jpeg`), png, pdf, psd, ai,
  --    mp4, mov (`video/quicktime`), webm;
  --  * `application/illustrator`, porque e o que alguns sistemas mandam
  --    para `.ai` -- e `application/postscript`, que e o que outros mandam;
  --  * `image/gif`, `image/webp` e `image/avif`, que NAO estao no pedido e
  --    PRECISAM estar aqui: a capa da campanha (0050) e a capa do cliente
  --    (0063) sobem com `accept="image/*"` e `EH_IMAGEM` aceita as tres
  --    desde a 0053. Sem elas, esta migration quebraria um upload que
  --    funciona hoje -- e o sintoma seria uma capa que simplesmente nao
  --    sobe, num modulo que ninguem mexeu;
  --  * `application/zip`, `application/x-zip-compressed`, `image/tiff` e
  --    `application/x-indesign`, que tambem NAO estao no pedido e precisam
  --    estar aqui pela mesma razao: o comentario de `arvore-de-producao.tsx`
  --    diz, desde o Sprint 13, que *"a entrega de campanha e PDF, PSD, AI,
  --    ZIP, INDD"*. O item 30 e um PISO e nao um teto -- ler "aceitar" como
  --    "aceitar so" recusaria o `.zip` de exemplos que a agencia entrega
  --    hoje. E a mesma decisao que criou a familia `outro` em
  --    `lib/dominio/arquivos.ts`;
  --  * `application/octet-stream`, pela razao do cabecalho -- e ele e tambem
  --    o que cobre o formato que a agencia adotar amanha: `.sketch`, `.fig`
  --    e `.indd` chegam assim na maioria dos sistemas.
  --
  -- O QUE FICA DE FORA E A LISTA CURTA QUE IMPORTA: `text/html`,
  -- `image/svg+xml`, `application/xhtml+xml` e qualquer `text/*`.
  --
  -- ***E O RISCO QUE SOBRA FICA DITO:*** um formato novo que chegue declarado
  -- com um tipo RENDERIZAVEL fora desta lista e recusado, e a frase do Storage
  -- ("mime type not supported") aparece crua na tela -- `mensagemDoErro()` em
  -- `enviar-arquivos.tsx` nao a embrulha, de proposito. O conserto e uma linha
  -- aqui, numa migration. O caso provavel nao e esse: e o octet-stream.
  tipos text[] := array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/tiff',
    'application/pdf',
    'image/vnd.adobe.photoshop',
    'application/postscript',
    'application/illustrator',
    'application/x-indesign',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/octet-stream'
  ];
  -- 500 MB, que e `TETO_DO_BUCKET` em `lib/dominio/arquivos.ts` -- o maior
  -- dos quatro tetos de familia. O bucket nao sabe distinguir um JPG de
  -- 100 MB (que a tela recusa) de um PSD de 100 MB (que ela aceita): quem
  -- sabe a diferenca e `TETO_DA_FAMILIA`, e e por isso que a trava da tela
  -- nao e decoracao desta.
  teto bigint := 500 * 1024 * 1024;
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  update storage.buckets
     set allowed_mime_types = tipos,
         file_size_limit    = teto
   where id in ('posts-artes', 'campanhas-arquivos', 'task-arquivos');
end
$$;


-- ---------------------------------------------------------------------------
-- PASSO 2 - O VIDEO DO POST PODE SER ARQUIVO
--
-- As DUAS tabelas, porque o par `video_url` ja e assim desde a 0042: a versao
-- guarda o que mudou e o post guarda o valor corrente. Sem a coluna na versao,
-- trocar o video nao entraria no historico -- e a regra do modulo desde a 0032
-- e que rodada fechada e versao gravada nunca se reescrevem.
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists video_caminho text;

alter table public.post_versions
  add column if not exists video_caminho text;

comment on column public.posts.video_caminho is
  'O video DENTRO do Full Hub: caminho em `posts-artes`, mesma pasta do cliente das artes (0120). O par dele e `video_url`, que e o video em outro lugar (Drive, YouTube) -- sao duas colunas porque `posts_video_url_http` cobra `^https?://` e caminho de bucket nao e endereco.';

comment on column public.post_versions.video_caminho is
  'O caminho do video desta versao (0120). Sem ele, trocar o video nao entraria no historico.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - ESTE POST TEM VIDEO?
--
-- UM LUGAR SO responde, e e o que faz a trava do envio ser uma linha. Sem
-- ela, a pergunta estaria escrita em `validar_nova_rodada`, em
-- `o_que_falta_no_portao()` e em `podeEnviarAoCliente()` -- tres lugares para
-- a mesma condicao, e o terceiro e o que divergiria.
--
-- `stable` e nao `immutable`: ela le tabela.
-- ---------------------------------------------------------------------------
create or replace function public.post_tem_video(p_post uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  achou boolean;
begin
  -- `security definer` PELA RAZAO DE `porta_do_cliente_no_post` (0076): ela e
  -- chamada de dentro de `validar_nova_rodada`, que roda em nome de quem esta
  -- enviando, e tambem do caminho do cliente. Ela devolve um BOOLEANO sobre um
  -- post cujo uuid quem chama ja tem -- nao ha o que vazar.
  select nullif(trim(coalesce(p.video_caminho, '')), '') is not null
      or nullif(trim(coalesce(p.video_url, '')), '')     is not null
    into achou
    from public.posts p
   where p.id = p_post;

  return coalesce(achou, false);
end;
$func$;

comment on function public.post_tem_video(uuid) is
  'O post tem video, por arquivo (`video_caminho`) ou por link (`video_url`)? Um lugar so, para a trava do envio e a tela nao divergirem (0120).';

revoke all    on function public.post_tem_video(uuid) from public;
revoke all    on function public.post_tem_video(uuid) from anon;
grant execute on function public.post_tem_video(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 4 - A VERSAO LEVA O VIDEO PARA O POST
--
-- A funcao e reescrita INTEIRA a partir da versao da 0048, que e a ultima, e
-- o diff e UMA linha de `update`. E a licao da 0030 de novo: o que nao for
-- copiado desaparece em silencio.
-- ---------------------------------------------------------------------------
create or replace function public.sincronizar_post_com_a_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  capa      text := new.arte_url;
  miniatura text := new.thumbnail_url;
  esvaziou  boolean := new.removeu_arquivos;
begin
  -- A CAPA SAI DO PRIMEIRO SLIDE quando a versao e de carrossel e nao trouxe
  -- `arte_url` explicita. Sem isto, subir cinco slides deixaria o card e o
  -- calendario sem imagem nenhuma -- e ninguem ligaria uma coisa a outra.
  --
  -- E VALE TAMBEM QUANDO SE REMOVE O PRIMEIRO: a versao nova chega com quatro
  -- slides e sem `arte_url`, entao a capa passa a ser o que era o segundo.
  --
  -- E O VIDEO NAO ENTRA AQUI (0120): ele tem coluna propria justamente para
  -- nao virar capa. `arquivos->0` e o primeiro ARQUIVO e nao a primeira
  -- imagem, e um MP4 nesta linha deixaria o card com moldura quebrada.
  if capa is null and jsonb_array_length(coalesce(new.arquivos, '[]'::jsonb)) > 0 then
    capa := new.arquivos->0->>'url';
    miniatura := coalesce(miniatura, new.arquivos->0->>'thumbnail_url');
  end if;

  update public.posts
     set versao_atual  = new.numero_versao,
         -- `case` E NAO `coalesce` SOZINHO (0048): o coalesce continua valendo
         -- para quem nao mexeu, e o ramo novo e o unico jeito de uma versao
         -- dizer "nao ha mais arte".
         arte_url      = case when esvaziou then null else coalesce(capa, arte_url) end,
         thumbnail_url = case when esvaziou then null else coalesce(miniatura, thumbnail_url) end,
         legenda       = coalesce(new.legenda, legenda),
         video_url     = coalesce(new.video_url, video_url),
         -- A LINHA DA 0120. `coalesce` e nao `case`: `removeu_arquivos` fala
         -- da ARTE -- ele nasceu na 0048 para uma versao poder dizer "nao ha
         -- mais arte" --, e tirar o video junto seria apagar um fato que a
         -- versao nao mencionou. Quem tira o video manda o caminho em branco.
         video_caminho = coalesce(new.video_caminho, video_caminho),
         updated_at    = now()
   where id = new.post_id
     and new.numero_versao >= versao_atual;

  return new;
end;
$$;

comment on function public.sincronizar_post_com_a_versao is
  'Copia capa, legenda, link e caminho do video da versao para o post. A capa sai do primeiro slide; o video tem coluna propria desde a 0120 para nao virar capa; `removeu_arquivos` (0048) e o unico jeito de uma versao dizer "nao ha mais arte".';


-- ---------------------------------------------------------------------------
-- PASSO 5 - A TRAVA DO ENVIO PERGUNTA PELO VIDEO, E NAO PELO LINK
--
-- A funcao e COPIADA INTEIRA da 0090 -- duzentas linhas, quatro ramos -- e o
-- diff e UMA condicao, marcada no corpo com "A UNICA LINHA QUE A 0120 MUDA".
-- ---------------------------------------------------------------------------
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
  porta public.subtasks;
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
      -- NOMEIA as pecas que faltam e `o_que_falta_no_portao()` no PASSO 6,
      -- chamada por `enviar_mes_ao_cliente()` antes de inserir qualquer
      -- rodada: a recusa que a pessoa le diz quais sao as seis, e esta aqui e
      -- o piso para quem montar o insert a mao.
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
$$;

comment on function public.validar_nova_rodada() is
  'As travas de quem abre rodada. Desde a 0120 o video do post pode ser arquivo do bucket ou link de fora -- quem responde e `post_tem_video()`. O aval interno e do ELO (`social_aval_interno`) desde a 0090, e enviar ao cliente e da gestao ou do Atendimento.';


-- ---------------------------------------------------------------------------
-- PASSO 6 - A LISTA DO QUE FALTA PERGUNTA A MESMA COISA
--
-- `o_que_falta_no_portao()` e quem NOMEIA as pecas que travam o envio do mes,
-- e ela tinha a mesma condicao escrita a mao. Deixa-la para tras daria o pior
-- resultado possivel: a lista em ambar diria "e video e nao tem o link" numa
-- peca cujo video acabou de subir, e o botao ficaria desligado por um motivo
-- que a pessoa nao tem como resolver -- a trava e a tela discordando sobre o
-- mesmo fato, que e a licao da 0029 e da 0060.
--
-- Ela e curta, entao a copia inteira custa pouco; o diff e UMA condicao.
-- ---------------------------------------------------------------------------
create or replace function public.o_que_falta_no_portao(p_task_id uuid, p_etapa_id uuid)
returns table (post_id uuid, tema text, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  etapa public.subtasks;
begin
  -- A GUARDA E ESCRITA A MAO, e e a parte que a bateria mede. `security
  -- definer` nao passa pela RLS de `posts` nem de `subtasks`, entao sem ela
  -- esta funcao responde sobre o mes de QUALQUER empresa para quem tiver o
  -- uuid -- e quem esta logado inclui o cliente. E a forma de
  -- `o_que_o_cliente_decide()` na 0076: definer para devolver o agregado, com
  -- a pergunta de quem pode escrita dentro.
  if not public.is_staff() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Essa consulta é da equipe.';
  end if;

  select s.* into etapa from public.subtasks s where s.id = p_etapa_id;
  if etapa.id is null or etapa.social_papel is null then
    return;
  end if;

  return query
    select p.id, p.tema, m.motivo
      from public.posts_elegiveis_do_portao(p_task_id, p_etapa_id) p
      cross join lateral (
        select case
          -- A ORDEM DOS MOTIVOS E A ORDEM DO TRABALHO, e por isso o `case`
          -- para no primeiro: quem nao terminou a fase nao precisa ouvir que
          -- tambem falta a data. Uma lista de tres motivos para a mesma peca e
          -- um paragrafo onde a pessoa precisa de uma frase.
          when not exists (
            select 1 from public.post_etapa_progresso g
             where g.post_id = p.id and g.subtask_id = p_etapa_id and g.concluido
          -- A CAIXINHA DA ENTREGA FICA FORA, e nao por excecao: ela nao se
          -- marca a mao (0088), porque e consequencia da aprovacao daquela
          -- peca. Exigi-la aqui seria uma recusa que ninguem tem como
          -- satisfazer -- a mesma forma da trava de data no portao do meio.
          ) and etapa.social_papel <> 'entrega'
            then format('a etapa "%s" ainda não está marcada nesta peça', etapa.titulo)

          when coalesce(etapa.social_aval_interno, true)
           and not public.post_tem_aval_interno(p.id)
            then 'falta o aval interno desta versão'

          when etapa.social_papel = 'entrega' and p.data_publicacao is null
            then 'não tem data de publicação'

          -- A LINHA QUE A 0120 MUDA: o video pode ser arquivo do bucket, e
          -- quem responde e `post_tem_video()` -- a mesma funcao que
          -- `validar_nova_rodada` pergunta, para a lista que a pessoa LE e a
          -- recusa que o banco DA nunca discordarem.
          when etapa.social_papel = 'entrega' and p.midia = 'video'
           and not public.post_tem_video(p.id)
            then 'é vídeo e não tem o vídeo'

          else null
        end as motivo
      ) m
     where m.motivo is not null
     order by p.tema;
end;
$$;

comment on function public.o_que_falta_no_portao(uuid, uuid) is
  'As pecas que ainda nao podem ir ao cliente neste portao, com o motivo de cada uma. Desde a 0120 o video e perguntado por `post_tem_video()`, que aceita arquivo ou link.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - CONFERENCIA
--
-- O `select` do fim, para a segunda colagem. Ele responde as quatro coisas
-- que esta migration faz, e a primeira e a que mais erra em silencio: um
-- bucket sem a lista continua aceitando qualquer tipo, e nada na tela diz.
-- ---------------------------------------------------------------------------
select
  'os tres buckets'                                        as o_que,
  count(*) filter (where allowed_mime_types is not null)    as com_lista,
  count(*) filter (where file_size_limit = 500 * 1024 * 1024) as com_teto
  from storage.buckets
 where id in ('posts-artes', 'campanhas-arquivos', 'task-arquivos');

select
  'o video do post'                                       as o_que,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'video_caminho')                   as na_tabela,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'post_versions'
      and column_name = 'video_caminho')                   as na_versao,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'post_tem_video')  as a_funcao;

-- E AS DUAS FUNCOES GRANDES PASSARAM A PERGUNTAR PELA FUNCAO? E a conferencia
-- que importa, porque as duas compilam com a condicao antiga dentro: o corpo
-- de uma funcao plpgsql e texto para o Postgres ate a hora de rodar, e a hora
-- de rodar e o clique de alguem.
select
  'a trava do envio'                                                as o_que,
  (select position('post_tem_video' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'validar_nova_rodada')     as na_rodada,
  (select position('post_tem_video' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'o_que_falta_no_portao')   as no_portao;

notify pgrst, 'reload schema';
