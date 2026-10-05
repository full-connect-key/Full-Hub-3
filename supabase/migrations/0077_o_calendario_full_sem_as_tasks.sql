-- ---------------------------------------------------------------------------
-- 0077 - O Calendario Full sem as demandas e sem as etapas
--
-- Decisao do usuario: *"gostaria que voce tirasse as tasks de dentro do
-- calendario Full, quero que elas fiquem apenas dentro do Minhas Tasks"*.
--
-- A `calendar_events` nasceu na 0055 com sete origens e ganhou a oitava na
-- 0059. Duas delas saem aqui -- `task` (a demanda, pelo periodo) e `subtarefa`
-- (a etapa, pelo prazo) --, e a view fica com SEIS: ausencia, evento, post,
-- etapa de post, campanha e entregavel.
--
-- ---------------------------------------------------------------------------
-- POR QUE NA VIEW, E NAO SO DESLIGANDO A CAMADA NA TELA
--
-- As camadas sao interruptores: a tela pede `tipo in (...)` e a view devolve o
-- que foi pedido. Tirar as duas da lista de camadas esconderia as linhas da
-- tela de hoje e deixaria a view produzindo-as -- e o cabecalho da 0055 diz em
-- quantas palavras o que a view e: a VERDADE, de onde a grade, a lista, a
-- linha do tempo e o .ics saem. Uma origem que nenhuma camada liga e uma
-- varredura de duas tabelas grandes por consulta para desenhar linhas que
-- ninguem pede, e e tambem a porta por onde elas voltam: o proximo consumidor
-- da view -- a exportacao, um relatorio, uma tela nova -- as recebe de graca,
-- sem ninguem ter decidido isso.
--
-- E a mesma razao pela qual a 0023 APAGOU `tasks.exigencia_aprovacao` em vez
-- de deixa-la parada, e pela qual a 0034 apagou as tabelas dos dois modulos
-- que sairam do produto.
--
-- ---------------------------------------------------------------------------
-- O QUE A LINHA DO TEMPO *NAO* PERDE, e e o ponto que faz a remocao caber
--
-- A pergunta da Linha do Tempo e "a equipe aguenta?", e a cor de cada celula
-- e OCUPACAO -- ela sai de `carga_da_equipe()`, que percorre e chama
-- `carga_do_dia()` (0035). Nenhuma das duas le esta view: elas leem `subtasks`
-- direto, e continuam contando a etapa em aberto cujo periodo cobre o dia.
--
-- Quer dizer que sai a BARRA da etapa e fica a CARGA dela. E o que o
-- calendario da agencia responde continua de pe: o que acontece nesta semana
-- (feira, convencao, post no ar, campanha fechando, quem esta fora) e quem
-- tem mao livre para fazer.
--
-- ---------------------------------------------------------------------------
-- `security_invoker = true` VAI JUNTO NO `replace`, e e a linha que nao pode
-- cair.
--
-- `create or replace view` NAO herda a clausula do objeto que ele substitui --
-- esta a terceira migration a repeti-la por isso (0055, 0059, 0077). Sem ela a
-- view volta a rodar com os direitos de quem a criou e le as seis tabelas
-- INTEIRAS para qualquer pessoa autenticada, num objeto que o PostgREST
-- publica sozinho. E o furo passa despercebido num banco com um cliente so:
-- ele ve seis campanhas, que e o total, e "seis de seis" tem a mesma cara com
-- a RLS ligada e desligada. A bateria mede com material de DUAS empresas.
--
-- ---------------------------------------------------------------------------
-- AS COLUNAS SAO DECLARADAS NA PRIMEIRA ORIGEM, E ELA MUDOU
--
-- `create or replace view` exige a mesma lista de colunas, na mesma ordem e
-- com os mesmos tipos. Quem dava NOME a cada coluna era a origem 1, que sai;
-- as outras vinham sem `as`, apoiadas nela. Entao a ausencia -- que agora e a
-- primeira -- recebe os dez `as`, e os tipos explicitos (`null::uuid`,
-- `::text`) ficam onde estavam: sem eles o Postgres acusaria mudanca de tipo
-- de coluna e recusaria o `replace`.
-- ---------------------------------------------------------------------------

create or replace view public.calendar_events
with (security_invoker = true) as

  -- 1. QUEM ESTA FORA, e so o que foi combinado.
  --
  -- Pedido pendente NAO entra: ele ainda pode ser remarcado, e pintar o
  -- calendario da agencia com um periodo que o socio nem respondeu faria a
  -- equipe planejar em cima de uma ausencia que talvez nao aconteca.
  --
  -- ELA PASSOU A SER A PRIMEIRA, e por isso carrega os nomes das colunas.
  select
    h.id                                   as id,
    'ausencia'::text                       as tipo,
    h.tipo::text                           as titulo,
    h.data_inicio                          as data_inicio,
    h.data_fim                             as data_fim,
    null::uuid                             as client_id,
    h.user_id                              as user_id,
    null::text                             as prioridade,
    h.status::text                         as status,
    '/painel/full-days'                    as link
  from public.hr_requests h
  where h.status = 'aprovada'

  union all

  -- 2. O QUE ACONTECE.
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

  -- 3. O POST, no dia em que vai ao ar.
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

  -- 4. A CAMPANHA, com o periodo inteiro.
  --
  -- A VIEW CARREGA A VERDADE; quem decide como desenhar e a tela. Na grade do
  -- mes a campanha aparece no ENCERRAMENTO, porque uma Wave de trinta dias
  -- pintaria trinta celulas e empurraria para baixo tudo o que acontece em
  -- cada uma. Na Linha do Tempo ela e a barra longa. Os dois desenhos saem da
  -- mesma linha, e e `diaNaGrade()` em `lib/dominio/calendario.ts` que
  -- escolhe -- um lugar so.
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

  -- 5. A PECA DA CAMPANHA, no prazo dela.
  --
  -- So as FOLHAS: o grupo e uma linha na tela e quinze entregas no trabalho, e
  -- conta-lo tambem faria "16 de 16" onde ha quinze coisas.
  --
  -- ELA FICA, e a peca de campanha E uma subtarefa desde a 0051 -- o que
  -- parece contradizer a remocao das etapas e nao contradiz: o que sai e a
  -- camada que lista TODA etapa de TODA demanda da agencia, que e a pauta
  -- pessoal de cada um. O entregavel e a PECA que o cliente vai decidir, com
  -- data combinada na campanha, e e por isso que ele tem camada propria desde
  -- a 0055 em vez de vir pela de etapa.
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
    )

  union all

  -- 6. A ETAPA DO POST (0059).
  --
  -- O `client_id` vem do POST, e nao da etapa: a etapa nao tem cliente, e sem
  -- o join o filtro de cliente do calendario deixaria estas linhas passar
  -- sempre -- o que parece "sem filtro" e e vazamento de pauta entre contas na
  -- tela de quem filtrou por uma.
  select
    e.id,
    'etapa_de_post',
    e.nome || ' · ' || p.tema,
    e.prazo,
    e.prazo,
    p.client_id,
    e.responsavel_id,
    null::text,
    e.status::text,
    '/painel/social-media?post=' || p.id
  from public.post_etapas e
  join public.posts p on p.id = e.post_id
  where e.prazo is not null;

comment on view public.calendar_events is
  'As SEIS origens do Calendário Full num formato só: ausência, evento, post, '
  'campanha, entregável e etapa de post. A demanda e a etapa saíram na 0077, '
  'por decisão do usuário: elas vivem em Minhas Tasks e em Gestão de Tasks. '
  'security_invoker = true: a RLS de cada tabela de origem continua valendo.';
