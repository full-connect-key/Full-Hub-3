-- =============================================================================
-- 0150 - O RELATORIO DO SOCIAL: os numeros do mes, preenchidos pela agencia
-- =============================================================================
--
-- Decisao do usuario, item 17: *"gostaria que no Social Media, aparecesse um
-- relatorio preenchido com os dados do social, como visualizacao, curtidas e
-- afins, para o cliente ter essas informacoes o tempo todo (...), isso pode ser
-- preenchido pela social media, ou ser interligado com as redes
-- sociais do cliente para contabilizar automaticamente"*.
--
-- E o item 18, na mesma mensagem: *"podemos passar essa parte de social, para
-- uma aba a parte de relatorios, para permitir que os dados sejam editados pela
-- social. e de preferencia que os dados aparecam sempre quando forem
-- positivos"*.
--
-- -----------------------------------------------------------------------------
-- A SEGUNDA FRASE DO ITEM 17 OFERECE DUAS SAIDAS, E SO UMA CABE HOJE.
--
-- *"pode ser preenchido pela social media, OU ser interligado com as redes
-- sociais do cliente"* -- e o item 18 escolhe por ele, duas frases depois:
-- *"para permitir que os dados sejam editados pela social"*. Entao o que esta
-- migration cria e a tabela que a SOCIAL MEDIA preenche.
--
-- A integracao automatica fica de fora, e e dito em vez de escondido: ela pede
-- um token de OAuth por conta de cliente na Graph API da Meta, renovado a cada
-- sessenta dias, com a pagina do Facebook ligada ao perfil profissional do
-- Instagram -- e nada disso existe no produto. No dia em que existir, ela
-- escreve NESTAS tabelas: e a razao de `fonte` ser coluna desde agora.
--
-- -----------------------------------------------------------------------------
-- `metrica` E ENUM E NAO TEXTO LIVRE, que e o argumento da 0122 e da 0042.
--
-- Ela e a dimensao por onde o relatorio AGRUPA -- e por metrica que a tela soma
-- o alcance de duas redes e compara um mes com o anterior. Com texto livre,
-- "Curtidas" e "curtidas" viram duas linhas do mesmo numero: o total sai
-- plausivel e errado, que e o modo de falha desta casa.
--
-- E SAO DEZ VALORES e nao os tres que ele nomeou, porque os tres que ele nomeia
-- terminam em *"e afins"*: alcance, impressoes e visualizacoes sao tres coisas
-- diferentes que toda rede reporta separadas, e um relatorio que nao as separa
-- soma maca com laranja.
--
-- -----------------------------------------------------------------------------
-- `plataforma` REUSA `plataforma_social` (0032), e a ausencia de enum novo e a
-- decisao: o produto ja tem um vocabulario de rede social, com rotulo, sigla e
-- a lista em `lib/dominio/posts.ts`. Um segundo diria "Instagram" duas vezes, e
-- o que divergiria seria este, que se abre uma vez por mes.
--
-- -----------------------------------------------------------------------------
-- `publicado_em` E O PORTAO, e e a linha que mais importa.
--
-- O relatorio e preenchido metrica por metrica, ao longo do mes, por quem tem a
-- planilha da rede aberta do lado. Sem o carimbo, o cliente abriria o portal no
-- meio do preenchimento e leria "Curtidas: 0" num mes que teve quatro mil --
-- um numero que ninguem digitou ainda, apresentado como se fosse o resultado.
--
-- E a forma de `publicada_em` na 0028 palavra por palavra: *"o default e
-- publicada" nao vale aqui*, e a assimetria e deliberada -- la esquecer o campo
-- cria uma demanda VISIVEL e o erro contrario (uma task que some para a equipe)
-- ninguem descobre; aqui esquecer o carimbo esconde um relatorio que a agencia
-- ve na propria tela, e o erro contrario e mostrar ao cliente um numero pela
-- metade. O lado seguro do erro troca de lado com o leitor.
--
-- -----------------------------------------------------------------------------
-- O VALOR NAO TEM TETO DE CONTRATO, nem conta derivada.
--
-- Nao existe coluna de "taxa de engajamento": cada agencia a calcula de um
-- jeito -- sobre alcance, sobre impressoes, sobre seguidores --, e grava-la
-- seria o produto afirmando uma formula que o cliente pode contestar. O que a
-- tela pode fazer com honestidade e somar o que foi digitado e comparar com o
-- mes anterior, que e exatamente o que o item 18 pede.
--
-- -----------------------------------------------------------------------------
-- QUEM ESCREVE E `is_staff()`, e isto NAO afrouxa nada -- e a 0060.
--
-- O item 18 nomeia quem edita: *"os dados sejam editados pela social"*. A
-- social media e `colaborador`, entao `is_gestor()` esconderia o relatorio
-- exatamente de quem ele e para -- o mesmo erro que a 0042 desfez ao trazer o
-- modulo inteiro para `EQUIPE`, e que a 0110 desfez pelo outro lado.
--
-- E nao ha uma segunda trava so no `publicado_em`: ela precisaria de um trigger
-- para proteger UMA coluna, e o que ela recusaria e justamente a pessoa que o
-- pedido poe no comando. Publicar o relatorio e o fim do trabalho dela.
--
-- -----------------------------------------------------------------------------
-- E O CLIENTE LE SO O PUBLICADO, no `using` da policy e nao numa consulta.
--
-- A regra do produto inteiro: a consulta de `lib/dados/` nao repete o filtro,
-- porque o segundo lugar e sempre o que esquece. Um relatorio em rascunho nao
-- existe para ele -- nem na tela, nem pelo id na mao, nem pela API do Supabase
-- chamada direto.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - O vocabulario das metricas
--
-- SAO DEZ, e cada uma e um numero que as redes reportam separado. As tres que
-- o pedido nomeia estao aqui -- `visualizacoes`, `curtidas` e o `alcance` que
-- toda conversa de social chama de "alcance" --, e as outras sete sao o "e
-- afins" dele: o que uma planilha de relatorio de social tem dentro.
--
-- `seguidores` e a unica de ESTOQUE e nao de fluxo, e a distincao mora no
-- TypeScript e nao aqui: ela decide o DESENHO (um estoque nao se soma entre
-- redes nem entre meses), e uma coluna `eh_estoque` seria a segunda verdade
-- sobre o que uma metrica e -- o que da para calcular da lista nao se guarda.
-- ---------------------------------------------------------------------------
do $cria$
begin
  if not exists (select 1 from pg_type where typname = 'metrica_social') then
    create type public.metrica_social as enum (
      'alcance',
      'impressoes',
      'visualizacoes',
      'curtidas',
      'comentarios',
      'compartilhamentos',
      'salvamentos',
      'cliques',
      'visitas_perfil',
      'seguidores'
    );
  end if;
end
$cria$;

comment on type public.metrica_social is
  'As metricas que um relatorio de social carrega (0150). Enum e nao texto livre porque e a dimensao por onde a tela agrupa e compara -- com texto, "Curtidas" e "curtidas" viram duas linhas do mesmo numero.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - O relatorio: um por conta, por mes
--
-- `unique (client_id, competencia)` e a trava, e e a mesma forma de
-- `(client_id, social_do_mes)` da 0061: dois relatorios de outubro da mesma
-- conta sao dois conjuntos de numeros, e a tela desenharia um deles sem dizer
-- qual.
--
-- `competencia` e sempre o DIA 1, carimbado por gatilho -- a forma de
-- `finance_entries.competencia` (0013) e do escopo do contrato (0149).
--
-- `comentario` e a leitura da agencia sobre o mes, e ela existe porque numero
-- sozinho nao explica queda nem salto: *"o alcance caiu porque pausamos o
-- impulsionamento no dia 12"*. O cliente le.
-- ---------------------------------------------------------------------------
create table if not exists public.social_reports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  competencia   date not null,
  comentario    text,
  publicado_em  timestamptz,
  publicado_por uuid references public.profiles(id) on delete set null,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, competencia)
);

create index if not exists social_reports_por_competencia
  on public.social_reports (competencia desc);

-- O INDICE DO PORTAL E PARCIAL, so entre os PUBLICADOS: e esse o recorte que a
-- policy do cliente faz em toda leitura dele, e o rascunho nunca entra nela.
create index if not exists social_reports_publicados
  on public.social_reports (client_id, competencia desc)
  where publicado_em is not null;

comment on table public.social_reports is
  'O relatorio de social de UMA conta num mes (0150): o conjunto de numeros que a agencia preenche e o cliente le, com a leitura do mes em `comentario`. Um por conta por mes.';
comment on column public.social_reports.publicado_em is
  'O PORTAO. Nulo quer dizer rascunho: a agencia ve, o cliente nao -- e a policy dele exige o carimbo, nao a consulta. Sem ele, o cliente leria "Curtidas: 0" no meio do preenchimento.';
comment on column public.social_reports.comentario is
  'A leitura da agencia sobre o mes. Numero sozinho nao explica queda nem salto, e e o cliente que le esta frase.';
comment on column public.social_reports.criado_por is
  'Quem abriu o relatorio. `on delete set null` porque ninguem com historico e apagado neste produto -- e no dia em que for, o relatorio continua sendo o do mes.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - Os numeros: um por metrica, por rede
--
-- `unique (report_id, plataforma, metrica)` e o que impede dois alcances do
-- Instagram no mesmo mes -- e e por ele que o `upsert` da tela e idempotente:
-- digitar de novo corrige, nunca acrescenta.
--
-- `fonte` existe HOJE para a integracao que o item 17 oferece e que esta
-- migration nao faz: no dia em que um token da Graph API escrever aqui, a
-- tela precisa poder dizer qual numero a rede devolveu e qual alguem digitou
-- -- e sem a coluna desde o inicio, a passada de conversao teria que INVENTAR
-- a procedencia de todo numero que ja estiver gravado.
-- ---------------------------------------------------------------------------
create table if not exists public.social_report_metrics (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.social_reports(id) on delete cascade,
  plataforma  public.plataforma_social not null,
  metrica     public.metrica_social not null,
  valor       integer not null,
  fonte       text not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (report_id, plataforma, metrica)
);

-- NAO NEGATIVO E COM TETO, e o teto e de digitacao e nao de produto: o maior
-- numero que uma conta de agencia alcanca num mes nao chega perto de dois
-- bilhoes, e um zero a mais e erro de digitacao -- a razao do teto de 60 em
-- `abrir_mes_de_social` e do de 200 na 0140.
alter table public.social_report_metrics
  drop constraint if exists social_report_metrics_valor_coerente;
alter table public.social_report_metrics
  add constraint social_report_metrics_valor_coerente
    check (valor >= 0 and valor <= 2000000000);

alter table public.social_report_metrics
  drop constraint if exists social_report_metrics_fonte_coerente;
alter table public.social_report_metrics
  add constraint social_report_metrics_fonte_coerente
    check (fonte in ('manual', 'integracao'));

create index if not exists social_report_metrics_por_relatorio
  on public.social_report_metrics (report_id);

comment on table public.social_report_metrics is
  'Um numero de um relatorio de social (0150): a metrica, a rede e o valor. A chave composta e o que faz o `upsert` da tela corrigir em vez de acrescentar.';
comment on column public.social_report_metrics.fonte is
  'De onde o numero veio: digitado pela agencia ou devolvido pela rede. Existe antes da integracao de proposito -- sem ela desde o inicio, a conversao teria que inventar a procedencia do que ja esta gravado.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - O carimbo da competencia e o `updated_at`
--
-- Dois gatilhos e nao um, e e a decisao de sempre: o que e consequencia nao se
-- escreve duas vezes. Guardar `2026-11-17` faria "novembro" depender de qual
-- dia alguem digitou, e `unique (client_id, competencia)` deixaria de ser um
-- por mes.
-- ---------------------------------------------------------------------------
create or replace function public.carimbar_relatorio_de_social()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  new.updated_at  := now();

  -- QUEM PUBLICOU E CARIMBADO PELO BANCO, nunca digitado: policy nao limita
  -- coluna, e sem isto um PATCH montado a mao assinaria a publicacao com o
  -- nome de outra pessoa -- a razao de `comments_normaliza` (0032) e de
  -- `posts_protege_colunas` (0042).
  -- E A PERGUNTA E `tg_op` E NUNCA `old is null`: num gatilho de INSERT o
  -- registro OLD nao esta atribuido, e ler um campo dele estoura com *"record
  -- old is not assigned yet"* -- o que acontece na primeira publicacao e nao
  -- no caminho que alguem testa primeiro.
  if new.publicado_em is null then
    new.publicado_por := null;
  elsif tg_op = 'INSERT' or old.publicado_em is null then
    new.publicado_por := coalesce(auth.uid(), new.publicado_por);
  else
    new.publicado_por := old.publicado_por;
  end if;

  return new;
end
$fn$;

drop trigger if exists social_reports_carimba on public.social_reports;
create trigger social_reports_carimba
  before insert or update on public.social_reports
  for each row execute function public.carimbar_relatorio_de_social();

comment on function public.carimbar_relatorio_de_social() is
  'Forca a competencia do relatorio para o dia 1 (0150), como a 0013 faz no Financeiro, e carimba QUEM publicou -- policy nao limita coluna, e sem isto um PATCH assinaria a publicacao com o nome de outra pessoa.';

create or replace function public.tocar_metrica_de_social()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists social_report_metrics_toca on public.social_report_metrics;
create trigger social_report_metrics_toca
  before insert or update on public.social_report_metrics
  for each row execute function public.tocar_metrica_de_social();


-- ---------------------------------------------------------------------------
-- PASSO 5 - Quem le e quem escreve
--
-- LER E DE `is_staff()` MAIS A PROPRIA EMPRESA COM O RELATORIO PUBLICADO. O
-- recorte do cliente mora no `using` e nao na consulta, que e a regra deste
-- produto desde `posts_select_cliente` (0032): o segundo lugar e sempre o que
-- esquece.
--
-- ESCREVER E DE `is_staff()`, e e o item 18 em quantas palavras -- *"para
-- permitir que os dados sejam editados pela social"*. A social media e
-- `colaborador`, entao `is_gestor()` esconderia o relatorio de quem ele e
-- para; e uma segunda trava so no `publicado_em` recusaria justamente a pessoa
-- que o pedido poe no comando (0060).
--
-- APAGAR O RELATORIO E DE `is_gestor()` e apagar UM NUMERO e de `is_staff()`,
-- e a assimetria e o que cada um significa: um numero errado se apaga durante
-- o preenchimento, e e parte de preencher; o relatorio inteiro de um mes que o
-- cliente ja leu e um registro, e quem responde por tira-lo do ar e quem
-- responde pela conta.
--
-- E O CLIENTE NAO ESCREVE NADA: o relatorio e o que a agencia afirma ter
-- entregue, e o portal e onde ele LE isso -- a mesma frase do escopo (0149).
-- ---------------------------------------------------------------------------
alter table public.social_reports enable row level security;
alter table public.social_report_metrics enable row level security;

drop policy if exists social_reports_select on public.social_reports;
create policy social_reports_select on public.social_reports
  for select to authenticated
  using (
    public.is_staff()
    or (
      client_id in (select public.my_client_ids())
      and publicado_em is not null
    )
  );

drop policy if exists social_reports_insert on public.social_reports;
create policy social_reports_insert on public.social_reports
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists social_reports_update on public.social_reports;
create policy social_reports_update on public.social_reports
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists social_reports_delete on public.social_reports;
create policy social_reports_delete on public.social_reports
  for delete to authenticated
  using (public.is_gestor());

-- O SELECT DO NUMERO PERGUNTA PELO RELATORIO, e nao por uma coluna `client_id`
-- repetida aqui: uma segunda coluna da conta seria a segunda verdade sobre de
-- quem e aquele numero -- e, pior, ela nao saberia do `publicado_em`, que e o
-- portao inteiro deste modulo.
--
-- E O `exists` HERDA A POLICY DE CIMA, que e o mecanismo e nao um efeito: a RLS
-- vale para toda tabela referenciada numa consulta, inclusive dentro do `using`
-- de outra policy. Entao o numero e visivel exatamente quando o relatorio dele
-- e -- uma regra, num lugar -- e o cliente nao alcanca o numero de um rascunho
-- nem com o uuid na mao. (`social_reports_select` nao cita esta tabela, entao
-- nao ha recursao: e por isso que `my_client_ids()` precisa ser `definer` e
-- isto nao.)
drop policy if exists social_report_metrics_select on public.social_report_metrics;
create policy social_report_metrics_select on public.social_report_metrics
  for select to authenticated
  using (
    exists (
      select 1 from public.social_reports r
       where r.id = social_report_metrics.report_id
    )
  );

drop policy if exists social_report_metrics_insert on public.social_report_metrics;
create policy social_report_metrics_insert on public.social_report_metrics
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists social_report_metrics_update on public.social_report_metrics;
create policy social_report_metrics_update on public.social_report_metrics
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists social_report_metrics_delete on public.social_report_metrics;
create policy social_report_metrics_delete on public.social_report_metrics
  for delete to authenticated
  using (public.is_staff());


-- ---------------------------------------------------------------------------
-- PASSO 6 - A trilha de auditoria
--
-- As duas entram, pela razao da 0058 e a do escopo (0149): o relatorio e o que
-- a agencia AFIRMA ao cliente, e a conversa que ele abre e sobre numero. Quem
-- trocou um alcance de doze mil para dezoito mil precisa estar escrito em
-- algum lugar, e `audit_log` e so do socio.
-- ---------------------------------------------------------------------------
do $audit$
declare
  t text;
begin
  foreach t in array array['social_reports', 'social_report_metrics']
  loop
    execute format('drop trigger if exists auditoria_%1$s on public.%1$s', t);
    execute format(
      'create trigger auditoria_%1$s after insert or update or delete on public.%1$s'
      || ' for each row execute function public.registrar_auditoria()', t);
  end loop;
end
$audit$;


-- ---------------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------------
do $confere$
declare
  n integer;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public'
     and tablename in ('social_reports', 'social_report_metrics');
  if n <> 8 then
    raise exception 'esperava 8 policies no relatorio do social, achei %', n;
  end if;

  select count(*) into n
    from pg_enum e join pg_type t on t.oid = e.enumtypid
   where t.typname = 'metrica_social';
  if n <> 10 then
    raise exception 'esperava 10 metricas no enum metrica_social, achei %', n;
  end if;

  if to_regclass('public.social_reports') is null
     or to_regclass('public.social_report_metrics') is null then
    raise exception 'as tabelas do relatorio do social nao foram criadas';
  end if;

  raise notice '0150 ok: relatorio do social com 8 policies, 10 metricas, carimbo de competencia e auditoria.';
end
$confere$;
