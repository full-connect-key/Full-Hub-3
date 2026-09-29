-- ---------------------------------------------------------------------------
-- 0075 - Feedback de desenvolvimento assistido por IA
--
-- Sprint 3H. Cada pessoa da equipe recebe, periodicamente, um retrato do
-- proprio trabalho: o que entregou, o que mudou em relacao ao periodo
-- anterior, onde ha espaco para crescer, e o que estudar a seguir. O texto e
-- escrito por IA; TODO numero e calculado aqui.
--
-- ISTO NAO E AVALIACAO DE DESEMPENHO, E A FRASE PRECISA MORAR NO BANCO.
-- Nao e nota, nao e ranking, nao e insumo para decisao sobre promocao,
-- aumento ou desligamento. Se um dia for usado para isso a regra muda
-- inteira e passa pelo juridico antes: a LGPD da a pessoa o direito de pedir
-- revisao de decisao automatizada que a afete (Art. 20), e o modulo foi
-- desenhado justamente para nao produzir uma. E a mesma decisao do
-- vocabulario do Full Days na 0016 e na 0018 -- exposicao juridica se
-- registra no cabecalho da migration, onde nao se perde num refactor de tela.
--
-- TRES REGRAS ATRAVESSAM O MODULO, e as tres tem consequencia de schema:
--
--   1. COMPARACAO SO CONSIGO MESMA, ao longo do tempo. Nunca com colega,
--      nunca com media da equipe, nunca em ranking. Por isso
--      `feedback_metricas()` recebe UMA pessoa e devolve o periodo dela e o
--      anterior dela -- e nao existe funcao neste arquivo que devolva duas
--      pessoas lado a lado. A unica media da agencia que aparece e a de
--      CLIENTE (`clientes_com_retrabalho`), que e sobre a conta e nao sobre
--      gente.
--
--   2. OS NUMEROS CRUS VIAJAM COM O TEXTO. `metricas_json` e
--      `contexto_json` ficam na mesma linha do texto, e a tela da pessoa
--      mostra os dois juntos. Texto sem numero e opiniao de maquina, e a
--      pessoa nao teria como conferir se a IA leu certo.
--
--   3. REVISAO HUMANA ANTES DO ENVIO, por padrao. `feedback_config.exige_revisao`
--      nasce `true`, e a policy de SELECT da pessoa exige `status = 'enviado'`.
--
-- QUATRO DIVERGENCIAS DO TEXTO DO SPRINT, e as quatro sao sobre o produto
-- como ele esta:
--
--   1. `tasks.status = 'rascunho'` NAO EXISTE. O sprint filtra rascunho
--      assim; no produto rascunho e `publicada_em is null` (0028), e
--      `rascunho` nao e valor do enum de proposito. Todo filtro deste arquivo
--      usa `publicada_em is not null`. E o quarto texto de sprint a errar
--      nisso -- a 0035 e a 0055 registraram o mesmo.
--
--   2. `user_skills` NAO EXISTE MAIS. A 0043 apagou a autoavaliacao e o
--      modulo Meu Desenvolvimento inteiro, por decisao do usuario -- entao
--      "skills marcadas como quero desenvolver" nao tem de onde sair, e o
--      bloco 4 do prompt nao pode pedir isso. O que sobrou e verdadeiro e
--      melhor: o que a pessoa ESTUDOU no periodo, por `academy_progress`, e
--      as etiquetas (`skills`, que ficou como vocabulario da Academy) dos
--      materiais que ela concluiu. Interesse declarado virou estudo medido.
--      E a tela da pessoa nao e mais uma aba de Meu Desenvolvimento: e a
--      tela Inicio, por decisao do usuario.
--
--   3. NAO HA EDGE FUNCTIONS NESTE PROJETO. O sprint manda a geracao para
--      uma; aqui o Postgres nao fala HTTP, e a chamada a Anthropic mora no
--      Next, do lado servidor, na forma de `lib/email/`. A consequencia esta
--      dita e nao escondida: a geracao AGENDADA nao entra ainda, porque a
--      rotina do pg_cron nao sabe o endereco do app (a mesma pendencia que
--      deixa o rodape do painel dizendo "versao local"). A geracao e da
--      gestao, por botao, e o dia em que houver a URL e uma linha.
--
--   4. METADE DAS METRICAS JA EXISTE, e este arquivo NAO as reescreve onde
--      elas tem dono. `carga_do_dia()` (0035) e a fonte unica de carga e e
--      CHAMADA aqui; `subtask_eh_agrupadora()` decide o que e folha;
--      `cliente_da_rodada()` traduz a rodada; `dias_uteis()` conta o
--      periodo. O que NAO da para reaproveitar sao `producao_do_periodo()`,
--      `desvio_de_estimativa()` e `qualidade_da_entrega()`: as tres sao da
--      AGENCIA e travam em `is_gestor()` na primeira linha, e a pergunta
--      daqui e de uma pessoa. O que se copia delas e a FORMA de cada conta,
--      linha por linha -- taxa no prazo com o mesmo denominador, desvio em
--      pontos percentuais sobre a estimativa, folha e nunca agrupadora --,
--      porque duas contas com formas diferentes fariam a tela de Metricas e
--      o feedback discordarem sobre a mesma pessoa no mesmo mes.
--
-- SO FOLHA CONTA, como em todo indicador do produto: quem tem filha para de
-- ser unidade de trabalho, e somar a agrupadora contaria o mesmo trabalho
-- duas vezes.
--
-- A TRILHA DA 0058 NAO PEGA ESTAS TABELAS, e a ausencia e decisao. O
-- `audit_log` copia o trecho que mudou, e aqui o trecho E o texto do
-- feedback: a trilha viraria uma segunda copia de cada rascunho descartado,
-- numa tabela que a propria pessoa nao alcanca. Quem revisou, quando, e
-- quando enviou ja moram na propria linha, que e o que uma auditoria de
-- decisao precisa. E a mesma razao pela qual `approval_rounds` ficou de fora
-- da 0058.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 0 - `carga_do_dia()` ganha um terceiro argumento, e nao uma irma
--
-- FOI A BATERIA QUE ACHOU, e o sintoma era uma ressalva falsa em todo
-- feedback. `carga_do_dia()` (0035) conta os minutos das etapas EM ABERTO
-- cujo periodo cobre o dia -- e esta certa, porque a pergunta dela e a do
-- calendario e da Home: "quanto esta comprometido hoje". Num periodo que JA
-- PASSOU toda etapa esta concluida, entao ela devolve zero -- e o contexto
-- do feedback lia 0% da capacidade e emitia a ressalva de ociosidade para
-- quem entregou o mes inteiro.
--
-- E O PIOR TIPO DE ERRO DESTE MODULO: nao estoura, nao aparece no log, e o
-- que chega a pessoa e uma frase dizendo que a entrega baixa dela foi
-- distribuicao de trabalho, num mes em que ela entregou tudo.
--
-- A SAIDA NAO E UMA SEGUNDA FUNCAO DE CARGA. Duas dariam dois numeros para a
-- mesma pessoa no mesmo dia, que e exatamente o que o comentario da 0035
-- existe para impedir -- e a tela de sobrecarga e onde isso vira discussao.
-- O parametro tem default `false`, entao `carga_da_equipe()`, o calendario e a
-- Home continuam chamando com dois argumentos e recebendo a mesma resposta de
-- sempre: nenhum caminho existente muda.
--
-- E O `drop` ANTES E OBRIGATORIO, nao estilo: `create or replace` com uma
-- lista de argumentos diferente cria uma SEGUNDA funcao, e aí toda chamada de
-- dois argumentos fica ambigua -- o Postgres recusaria `carga_da_equipe()` com
-- "function is not unique". O drop vale porque dependencia de funcao para
-- funcao dentro de um corpo `plpgsql` e resolvida em tempo de execucao.
-- ---------------------------------------------------------------------------
drop function if exists public.carga_do_dia(uuid, date);

create or replace function public.carga_do_dia(
  p_user_id uuid,
  p_data    date,
  p_incluir_concluidas boolean default false
)
returns table (
  minutos_comprometidos integer,
  etapas                integer,
  etapas_sem_estimativa integer,
  ausente               boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  with folhas as (
    select s.*
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.responsavel_id = p_user_id
       -- Rascunho fica fora de TODO indicador (0028).
       and t.publicada_em is not null
       and (p_incluir_concluidas or s.status not in ('concluida'))
       and s.prazo is not null
       and p_data between coalesce(s.data_inicio, s.prazo) and s.prazo
       -- Agrupadora nao e unidade de trabalho: quem mede sao as filhas.
       and not public.subtask_eh_agrupadora(s.id)
  )
  select
    coalesce(sum(f.estimativa_minutos), 0)::integer,
    count(*)::integer,
    count(*) filter (where f.estimativa_minutos is null)::integer,
    exists (
      select 1 from public.team_presence tp
       where tp.user_id = p_user_id and tp.data = p_data
         and tp.status in ('ferias', 'licenca', 'ausente', 'folga', 'feriado')
    )
    from folhas f;
end;
$$;

comment on function public.carga_do_dia(uuid, date, boolean) is
  'A carga de uma pessoa num dia: minutos comprometidos pelas etapas cujo periodo cobre o dia. Fonte UNICA de carga do produto (0035). O terceiro argumento (0075) inclui as concluidas, e existe para quem pergunta sobre um periodo que ja passou -- sem ele, um mes fechado responde zero.';

revoke all on function public.carga_do_dia(uuid, date, boolean) from public, anon;
grant execute on function public.carga_do_dia(uuid, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- PASSO 1 - Os dois vocabularios do modulo
--
-- `feedback_status` tem SEIS valores, e dois deles sao desfechos que nao sao
-- erro: `dados_insuficientes` (menos etapas no periodo do que o minimo -- o
-- relatorio existe, dizendo que nao ha o que dizer) e `descartado` (a gestao
-- leu e nao enviou). Sem os dois, a ausencia de relatorio significaria duas
-- coisas diferentes e ninguem saberia qual.
--
-- `gerando` e o estado entre o clique e a resposta da API. Ele existe para o
-- indice unico impedir duas geracoes do mesmo periodo ao mesmo tempo: a
-- linha nasce antes da chamada, que e a decisao da idempotencia da 0040.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_periodicidade') then
    create type public.feedback_periodicidade as enum ('mensal', 'trimestral');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type public.feedback_status as enum (
      'gerando', 'rascunho', 'revisado', 'enviado', 'descartado', 'dados_insuficientes'
    );
  end if;
end;
$bloco$;

alter type public.notification_tipo add value if not exists 'feedback';


-- ---------------------------------------------------------------------------
-- PASSO 2 - A pessoa pode nao querer receber
--
-- `recebe_feedback_ia` mora em `team_members` e nao em `profiles` porque e
-- uma escolha de quem trabalha na agencia, e cliente nao tem ficha aqui. O
-- default e `true`: nascer desligado faria o modulo estrear sem funcionar e
-- a agencia concluir que ele esta quebrado -- a decisao de
-- `aceita_solicitacoes` na 0068.
-- ---------------------------------------------------------------------------
alter table public.team_members
  add column if not exists recebe_feedback_ia boolean not null default true;

comment on column public.team_members.recebe_feedback_ia is
  'Se esta pessoa quer receber o feedback de desenvolvimento (0075). Ela mesma altera, em Meu Perfil, a qualquer momento. Falso = a geracao a pula, sem criar linha.';

-- A tela de transparencia aparece UMA VEZ, antes do primeiro feedback, e
-- para de aparecer quando a pessoa a le. Sem a coluna, "ja vi" viraria
-- localStorage -- e a pessoa veria a tela de novo em cada navegador, o que
-- ensina a fecha-la sem ler.
alter table public.team_members
  add column if not exists feedback_explicado_em timestamptz;

comment on column public.team_members.feedback_explicado_em is
  'Quando esta pessoa leu a tela que explica o feedback de desenvolvimento (0075). Nulo = ainda nao leu, e a tela aparece antes do primeiro relatorio.';


-- ---------------------------------------------------------------------------
-- PASSO 3 - O relatorio
--
-- `unique (user_id, periodo_inicio, periodicidade)` e a trava de duplicata, e
-- nao a consulta que a action faz antes: duas abas clicando em "Gerar" ao
-- mesmo tempo passam pelas duas consultas antes de qualquer uma gravar. E a
-- decisao da 0040, e e por isso que a linha nasce em `gerando` ANTES da
-- chamada a API -- uma chamada de IA leva segundos, que e tempo de sobra.
--
-- `texto_gerado` e `texto_final` sao DUAS colunas, e juntar as duas
-- destruiria a unica coisa que permite auditar a revisao: o que a IA
-- escreveu. Com uma coluna so, editar o texto apagaria a saida do modelo, e
-- "o texto saiu estranho" daqui a tres meses nao teria como ser investigado.
--
-- `modelo_usado` e `prompt_versao` sao por relatorio e nao configuracao
-- global, pela mesma razao: o modelo troca, o prompt e reescrito, e o
-- relatorio de marco precisa continuar dizendo quem o escreveu.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  periodo_inicio  date not null,
  periodo_fim     date not null,
  periodicidade   public.feedback_periodicidade not null default 'mensal',

  -- Os numeros crus, calculados por SQL. A IA os recebe prontos e nao conta
  -- nada: e a regra do modulo, e e o que a verificacao pos-geracao confere.
  metricas_json   jsonb not null,
  -- Ausencia, carga contra capacidade, espera por aprovacao, cliente com
  -- retrabalho. Existe para RELATIVIZAR o volume, nunca para cobrar.
  contexto_json   jsonb not null,

  texto_gerado    text,
  texto_final     text,
  modelo_usado    text,
  prompt_versao   text,

  -- O que a verificacao automatica achou no texto: comparacao com terceiro,
  -- julgamento de carater, numero que nao existe nas metricas. Lista de
  -- frases em portugues, para aparecer em destaque na tela de quem revisa.
  -- NUNCA descarta em silencio -- sinalizar e a decisao.
  alertas_json    jsonb not null default '[]'::jsonb,

  status          public.feedback_status not null default 'gerando',
  revisado_por    uuid references public.profiles (id),
  revisado_em     timestamptz,
  enviado_em      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint feedback_reports_periodo check (periodo_fim >= periodo_inicio),
  constraint feedback_reports_um_por_periodo unique (user_id, periodo_inicio, periodicidade)
);

comment on table public.feedback_reports is
  'O retrato periodico do trabalho de uma pessoa (0075): os numeros calculados por SQL, o texto escrito por IA, e a revisao humana antes do envio. NAO e avaliacao de desempenho -- ver o cabecalho da migration.';

create index if not exists feedback_reports_pessoa_idx
  on public.feedback_reports (user_id, periodo_inicio desc);

create index if not exists feedback_reports_fila_idx
  on public.feedback_reports (periodo_inicio desc, status);


create table if not exists public.feedback_replies (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.feedback_reports (id) on delete cascade,
  autor_id   uuid not null references public.profiles (id),
  texto      text not null,
  created_at timestamptz not null default now(),

  constraint feedback_replies_texto check (length(btrim(texto)) > 0)
);

comment on table public.feedback_replies is
  'A resposta da pessoa ao feedback dela, e a conversa que segue (0075). Feedback sem direito de resposta e comunicado, nao feedback -- por isso a tabela nao e opcional.';

create index if not exists feedback_replies_do_relatorio_idx
  on public.feedback_replies (report_id, created_at);


-- ---------------------------------------------------------------------------
-- PASSO 4 - Os sinais que sao da GESTAO, e nao da pessoa
--
-- E o subproduto mais valioso do modulo, e a razao de ser tabela separada:
-- quando alguem entrega menos, quase sempre o sistema sabe por que -- e a
-- resposta costuma estar na distribuicao de trabalho, nao na pessoa. Um
-- alerta de sobrecarga na tela dela viraria cobranca por uma decisao que nao
-- foi dela.
--
-- O que e DELA chega pelo feedback, relativizado: o contexto entra no prompt
-- justamente para o texto nao cobrar volume de quem recebeu 140% da
-- capacidade.
-- ---------------------------------------------------------------------------
create table if not exists public.workload_alerts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim    date not null,
  -- sobrecarga | ociosidade | gargalo_aprovacao | retrabalho_por_cliente
  tipo           text not null,
  detalhes       jsonb not null,
  resolvido      boolean not null default false,
  created_at     timestamptz not null default now(),

  constraint workload_alerts_tipo check (
    tipo in ('sobrecarga', 'ociosidade', 'gargalo_aprovacao', 'retrabalho_por_cliente')
  ),
  -- Um alerta de cada tipo por pessoa por periodo. Sem isso, clicar em
  -- "Gerar" duas vezes empilharia o mesmo alerta e o Pulso da agencia
  -- mostraria dois numeros para o mesmo fato.
  constraint workload_alerts_um_por_tipo unique (user_id, periodo_inicio, tipo)
);

comment on table public.workload_alerts is
  'Padroes que NAO sao da pessoa e que ela nao deve receber como cobranca (0075): sobrecarga, ociosidade, gargalo de aprovacao, retrabalho por cliente. So a gestao le.';

create index if not exists workload_alerts_abertos_idx
  on public.workload_alerts (periodo_inicio desc, resolvido);


-- ---------------------------------------------------------------------------
-- PASSO 5 - A configuracao, numa linha so
--
-- Uma linha, garantida pelo par check + unique em `unica` -- e nao pela
-- chave primaria, que precisa ser uuid. A primeira versao da 0069 usou
-- `id boolean primary key`, que e engenhoso e quebra `registrar_auditoria()`,
-- que grava o id da linha num uuid: "invalid input syntax for type uuid:
-- true". A licao ficou.
--
-- `exige_revisao` nasce TRUE, e e o default mais importante do arquivo. A
-- tela que o desliga carrega o aviso escrito; desligado, o texto da IA vai
-- direto para a pessoa.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_config (
  id               uuid primary key default gen_random_uuid(),
  unica            boolean not null default true,

  periodicidade    public.feedback_periodicidade not null default 'mensal',
  -- Quem revisa. Nulo = qualquer gestor revisa, que e o estado inicial: um
  -- revisor fixo nao configurado travaria a fila no dia em que ele saisse.
  revisor_id       uuid references public.profiles (id) on delete set null,
  exige_revisao    boolean not null default true,
  minimo_subtarefas integer not null default 5,

  atualizado_por   uuid references public.profiles (id),
  updated_at       timestamptz not null default now(),

  constraint feedback_config_linha_unica check (unica),
  constraint feedback_config_uma_so unique (unica),
  constraint feedback_config_minimo check (minimo_subtarefas between 1 and 100)
);

comment on table public.feedback_config is
  'Como o feedback de desenvolvimento e gerado (0075): periodicidade, quem revisa, se exige revisao humana e o minimo de etapas. Uma linha so; apenas o socio escreve.';

insert into public.feedback_config (unica) values (true)
on conflict (unica) do nothing;


-- ---------------------------------------------------------------------------
-- PASSO 6 - RLS
--
-- UM RASCUNHO VAZADO E PIOR QUE NENHUM FEEDBACK. A policy da pessoa exige
-- `status = 'enviado'` no `using`, e o filtro e explicito de proposito: sem
-- ele, ela leria por um GET no PostgREST o texto que a gestao ainda esta
-- editando -- inclusive um que vai ser descartado por estar errado sobre
-- ela. A tela nao repete o filtro; repetir seria criar o segundo lugar onde
-- a regra pode divergir.
-- ---------------------------------------------------------------------------
alter table public.feedback_reports enable row level security;
alter table public.feedback_replies enable row level security;
alter table public.workload_alerts enable row level security;
alter table public.feedback_config  enable row level security;

drop policy if exists feedback_reports_select on public.feedback_reports;
create policy feedback_reports_select on public.feedback_reports
  for select to authenticated
  using (
    public.is_gestor()
    or (user_id = (select auth.uid()) and status = 'enviado')
  );

-- Quem gera e a gestao, sempre: a linha nasce no clique dela, e a pessoa
-- nao pede o proprio relatorio.
drop policy if exists feedback_reports_insert on public.feedback_reports;
create policy feedback_reports_insert on public.feedback_reports
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists feedback_reports_update on public.feedback_reports;
create policy feedback_reports_update on public.feedback_reports
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- Apagar existe, e e da gestao: um relatorio gerado sobre o periodo errado
-- nao e historico, e lixo. `descartado` e para o que foi lido e recusado.
drop policy if exists feedback_reports_delete on public.feedback_reports;
create policy feedback_reports_delete on public.feedback_reports
  for delete to authenticated
  using (public.is_gestor());


-- A pessoa le e escreve as respostas do relatorio dela -- e o relatorio
-- precisa estar enviado, senao responder seria a porta dos fundos para
-- descobrir que existe um rascunho sobre ela.
drop policy if exists feedback_replies_select on public.feedback_replies;
create policy feedback_replies_select on public.feedback_replies
  for select to authenticated
  using (
    public.is_gestor()
    or exists (
      select 1 from public.feedback_reports r
       where r.id = report_id
         and r.user_id = (select auth.uid())
         and r.status = 'enviado'
    )
  );

drop policy if exists feedback_replies_insert on public.feedback_replies;
create policy feedback_replies_insert on public.feedback_replies
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and (
      public.is_gestor()
      or exists (
        select 1 from public.feedback_reports r
         where r.id = report_id
           and r.user_id = (select auth.uid())
           and r.status = 'enviado'
      )
    )
  );

-- SEM UPDATE NEM DELETE, e a ausencia e a regra do modulo -- a mesma de
-- `request_messages` na 0068. A resposta da pessoa ao feedback dela e o
-- registro de que ela discordou; reescreve-la depois apagaria a discordancia.
-- Nem o socio.


drop policy if exists workload_alerts_select on public.workload_alerts;
create policy workload_alerts_select on public.workload_alerts
  for select to authenticated
  using (public.is_gestor());

drop policy if exists workload_alerts_insert on public.workload_alerts;
create policy workload_alerts_insert on public.workload_alerts
  for insert to authenticated
  with check (public.is_gestor());

drop policy if exists workload_alerts_update on public.workload_alerts;
create policy workload_alerts_update on public.workload_alerts
  for update to authenticated
  using (public.is_gestor())
  with check (public.is_gestor());

-- SEM DELETE: o caminho e marcar resolvido. Um alerta apagado e um padrao
-- que a agencia deixou de ver sem decidir nada sobre ele.


-- A equipe inteira LE a configuracao -- e o que faz a tela da pessoa poder
-- dizer quem revisou e com que periodicidade. Escrever e do socio, pela
-- razao da fila de notas: `exige_revisao` decide se um texto de maquina vai
-- direto para uma pessoa, e isso e decisao de quem responde pela agencia.
drop policy if exists feedback_config_select on public.feedback_config;
create policy feedback_config_select on public.feedback_config
  for select to authenticated
  using (public.is_staff());

drop policy if exists feedback_config_update on public.feedback_config;
create policy feedback_config_update on public.feedback_config
  for update to authenticated
  using (public.is_socio())
  with check (public.is_socio());

-- SEM INSERT NEM DELETE: a linha nasce nesta migration e nao ha uma segunda.


-- ---------------------------------------------------------------------------
-- PASSO 7 - `updated_at` do relatorio
--
-- A tela de revisao salva o texto editado campo a campo, como a de task, e
-- sem isto "editado quando" ficaria parado na criacao.
-- ---------------------------------------------------------------------------
create or replace function public.feedback_reports_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists feedback_reports_touch on public.feedback_reports;
create trigger feedback_reports_touch
  before update on public.feedback_reports
  for each row execute function public.feedback_reports_touch();


-- ---------------------------------------------------------------------------
-- PASSO 8 - AS METRICAS. A IA escreve; quem calcula e o banco.
--
-- Devolve um jsonb com quatro blocos, e cada um responde a uma pergunta que a
-- pessoa faz sobre si mesma:
--
--   entrega            -- o que eu entreguei
--   periodo_anterior   -- mudou o que, em relacao a mim mesma
--   calibracao         -- eu estimo bem?
--   qualidade          -- meu trabalho volta?
--   desenvolvimento    -- o que eu estudei, e o que peguei de novo
--
-- O PERIODO ANTERIOR TEM O MESMO COMPRIMENTO e termina no dia antes do
-- inicio. Comparar um mes com um trimestre daria uma queda de volume que e
-- so aritmetica -- e o texto diria que a pessoa entregou menos.
--
-- A FORMA DE CADA CONTA E A DA 0035, linha por linha. "No prazo" compara
-- `concluida_em` com `prazo` e deixa FORA quem nao tem prazo, que aparece em
-- `sem_prazo`: etapa sem data nao esta no prazo nem fora dele, e somar como
-- acerto inflaria a taxa exatamente onde ninguem combinou nada. O desvio de
-- estimativa vai em pontos percentuais sobre a estimativa, e exige os dois
-- numeros. Duas formas diferentes fariam a tela de Metricas e o feedback
-- discordarem sobre a mesma pessoa no mesmo mes.
--
-- AS PALAVRAS DOS PEDIDOS DE AJUSTE nao sao a IA lendo comentario: e
-- contagem de palavra, feita aqui, com lista de parada e minimo de quatro
-- letras. O sprint pede "motivos agrupados por palavra-chave", e a diferenca
-- entre isso e mandar os comentarios crus para o modelo e que aqui a pessoa
-- pode conferir o numero ao lado da palavra.
-- ---------------------------------------------------------------------------
create or replace function public.feedback_metricas(
  p_user_id uuid,
  p_de      date,
  p_ate     date
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  dias       integer := (p_ate - p_de) + 1;
  ant_de     date;
  ant_ate    date;
  resultado  jsonb;
  -- Palavras que aparecem em todo pedido de ajuste e nao dizem nada sobre o
  -- que foi pedido. Sem a lista, as cinco primeiras seriam "para", "esta",
  -- "favor", "isso" e "pode".
  parada     text[] := array[
    'para', 'esta', 'este', 'essa', 'esse', 'isso', 'aqui', 'favor', 'pode',
    'poderia', 'precisa', 'precisamos', 'fazer', 'ficou', 'ficar', 'mais',
    'menos', 'muito', 'pouco', 'como', 'quando', 'onde', 'porque', 'entao',
    'mesmo', 'ainda', 'tudo', 'nada', 'algum', 'alguma', 'outro', 'outra',
    'obrigado', 'obrigada', 'certo', 'errado', 'acho', 'penso', 'gostaria',
    'seria', 'estava', 'estao', 'sobre', 'apenas', 'tambem', 'depois',
    'antes', 'agora', 'gente', 'coisa', 'parte', 'deixa', 'deixar', 'vamos'
  ];
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'As métricas do feedback são calculadas pela gestão.';
  end if;

  ant_ate := p_de - 1;
  ant_de  := ant_ate - (dias - 1);

  with folhas as (
    -- Rascunho fica fora de TODO calculo (0028), e agrupadora nao e unidade
    -- de trabalho (0022).
    select s.id, s.titulo, s.prazo, s.concluida_em, s.status,
           s.estimativa_minutos, s.tempo_real_minutos,
           t.client_id, t.task_type_id
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.responsavel_id = p_user_id
       and t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
  ),
  no_periodo as (
    select * from folhas where concluida_em::date between p_de and p_ate
  ),
  no_anterior as (
    select * from folhas where concluida_em::date between ant_de and ant_ate
  ),
  conteudos_dela as (
    select 'subtask'::text as tipo, f.id as cid, f.client_id from folhas f
    union all
    select 'post', p.id, p.client_id
      from public.posts p where p.responsavel_id = p_user_id
    union all
    select 'deliverable', d.id, c.client_id
      from public.deliverables d
      join public.campaigns c on c.id = d.campaign_id
     where d.responsavel_id = p_user_id
  ),
  rodadas_dela as (
    select r.*, cd.cid as conteudo, cd.client_id
      from public.approval_rounds r
      join conteudos_dela cd
        on cd.tipo = r.content_type and cd.cid = r.content_id
  ),
  decididos as (
    select rd.content_type, rd.content_id, rd.client_id,
           max(rd.numero_rodada)                                           as rodadas,
           bool_or(rd.status = 'aprovada' and rd.numero_rodada = 1)         as de_prima
      from rodadas_dela rd
     where rd.escopo = 'cliente'
       and rd.decidido_em::date between p_de and p_ate
     group by rd.content_type, rd.content_id, rd.client_id
  ),
  palavras as (
    select lower(public.sem_acento(w)) as palavra, count(*)::integer as vezes
      from rodadas_dela rd
      cross join lateral regexp_split_to_table(
        coalesce(rd.comentario, ''), '[^[:alnum:]áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]+'
      ) as w
     where rd.status in ('ajustes_solicitados', 'rejeitada')
       and rd.decidido_em::date between p_de and p_ate
       and length(w) >= 4
       and not (lower(public.sem_acento(w)) = any (parada))
     group by 1
     having count(*) > 1
     order by count(*) desc, 1
     limit 8
  ),
  estudo as (
    select am.track_id, at2.titulo as trilha,
           count(*) filter (where ap.concluido)::integer as materiais_concluidos,
           min(ap.created_at)::date                      as comecou_em
      from public.academy_progress ap
      join public.academy_materials am on am.id = ap.material_id
      join public.academy_tracks at2  on at2.id = am.track_id
     where ap.user_id = p_user_id
       and (ap.concluido_em::date between p_de and p_ate
            or ap.created_at::date between p_de and p_ate)
     group by am.track_id, at2.titulo
  ),
  etiquetas as (
    select distinct sk.nome
      from public.academy_progress ap
      join public.academy_materials am on am.id = ap.material_id
      join public.skills sk            on sk.id = am.skill_id
     where ap.user_id = p_user_id
       and ap.concluido
       and ap.concluido_em::date between p_de and p_ate
  ),
  -- WORKFLOW NOVO e aquele em que ela NUNCA tinha concluido nada antes do
  -- periodo. E o sinal mais concreto de "peguei um tipo de trabalho novo", e
  -- a alternativa -- contar o que ela pegou no periodo -- marcaria de novo
  -- todo trabalho que ela faz desde sempre.
  workflows_novos as (
    select distinct coalesce(tt.nome, 'Sem workflow') as nome
      from no_periodo np
      left join public.task_types tt on tt.id = np.task_type_id
     where not exists (
       select 1 from folhas f
        where coalesce(f.task_type_id::text, '-') = coalesce(np.task_type_id::text, '-')
          and f.concluida_em::date < p_de
     )
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', p_de, 'fim', p_ate, 'dias', dias
    ),

    'entrega', (
      select jsonb_build_object(
        'concluidas',   count(*),
        'com_prazo',    count(*) filter (where prazo is not null),
        'no_prazo',     count(*) filter (where prazo is not null and concluida_em::date <= prazo),
        'fora_do_prazo',count(*) filter (where prazo is not null and concluida_em::date > prazo),
        'sem_prazo',    count(*) filter (where prazo is null),
        -- NULA e nao zero quando nao ha etapa com prazo: zero e uma
        -- afirmacao sobre a conta, e o que se quer dizer e que nao houve o
        -- que medir. A decisao de `receita_por_hora` na 0035.
        'taxa_no_prazo', case when count(*) filter (where prazo is not null) > 0
          then round(
            count(*) filter (where prazo is not null and concluida_em::date <= prazo)::numeric
            / count(*) filter (where prazo is not null) * 100, 1)
        end,
        'dias_de_atraso_media', round(avg(concluida_em::date - prazo) filter (
          where prazo is not null and concluida_em::date > prazo), 1),
        'minutos_reais', coalesce(sum(tempo_real_minutos), 0)
      ) from no_periodo
    ),

    -- ATRASADAS e medido HOJE, e nao e evento do periodo: e o estado de
    -- agora, como `situacao_do_lancamento()` no Financeiro. Uma coluna
    -- precisaria de rotina noturna para continuar verdadeira.
    'em_aberto_atrasadas', (
      select count(*) from folhas
       where status <> 'concluida' and prazo is not null and prazo < current_date
    ),

    'por_workflow', coalesce((
      select jsonb_agg(x order by x->>'nome') from (
        select jsonb_build_object(
          'nome', coalesce(tt.nome, 'Sem workflow'),
          'concluidas', count(*)
        ) as x
          from no_periodo np
          left join public.task_types tt on tt.id = np.task_type_id
         group by coalesce(tt.nome, 'Sem workflow')
      ) s
    ), '[]'::jsonb),

    'por_cliente', coalesce((
      select jsonb_agg(x order by x->>'nome') from (
        select jsonb_build_object(
          'nome', coalesce(c.nome_empresa, 'Sem cliente'),
          'concluidas', count(*)
        ) as x
          from no_periodo np
          left join public.clients c on c.id = np.client_id
         group by coalesce(c.nome_empresa, 'Sem cliente')
      ) s
    ), '[]'::jsonb),

    -- A UNICA COMPARACAO PERMITIDA: ela com ela mesma, no periodo anterior de
    -- mesmo comprimento.
    'periodo_anterior', (
      select jsonb_build_object(
        'inicio', ant_de, 'fim', ant_ate,
        'concluidas', count(*),
        'com_prazo',  count(*) filter (where prazo is not null),
        'no_prazo',   count(*) filter (where prazo is not null and concluida_em::date <= prazo),
        'taxa_no_prazo', case when count(*) filter (where prazo is not null) > 0
          then round(
            count(*) filter (where prazo is not null and concluida_em::date <= prazo)::numeric
            / count(*) filter (where prazo is not null) * 100, 1)
        end,
        'minutos_reais', coalesce(sum(tempo_real_minutos), 0)
      ) from no_anterior
    ),

    'calibracao', (
      select jsonb_build_object(
        'etapas_medidas',    count(*),
        'minutos_estimados', coalesce(sum(estimativa_minutos), 0),
        'minutos_reais',     coalesce(sum(tempo_real_minutos), 0),
        'desvio_percentual', case when sum(estimativa_minutos) > 0
          then round(((sum(tempo_real_minutos)::numeric
                       / sum(estimativa_minutos)) - 1) * 100, 1)
        end,
        -- A TENDENCIA e a palavra, e nao o sinal do numero: "subestima" e o
        -- que a pessoa le e reconhece. A faixa de 10% no meio existe porque
        -- um desvio de 3% nao e uma tendencia, e chama-lo de uma treinaria a
        -- pessoa a desconfiar do resto.
        'tendencia', case
          when sum(estimativa_minutos) is null or sum(estimativa_minutos) = 0 then null
          when sum(tempo_real_minutos)::numeric / sum(estimativa_minutos) > 1.10 then 'subestima'
          when sum(tempo_real_minutos)::numeric / sum(estimativa_minutos) < 0.90 then 'superestima'
          else 'equilibrada'
        end
      ) from no_periodo
       where estimativa_minutos is not null and tempo_real_minutos is not null
    ),

    'calibracao_por_workflow', coalesce((
      select jsonb_agg(x order by (x->>'desvio_percentual')::numeric desc) from (
        select jsonb_build_object(
          'nome', coalesce(tt.nome, 'Sem workflow'),
          'etapas', count(*),
          'desvio_percentual', round(((sum(np.tempo_real_minutos)::numeric
            / nullif(sum(np.estimativa_minutos), 0)) - 1) * 100, 1)
        ) as x
          from no_periodo np
          left join public.task_types tt on tt.id = np.task_type_id
         where np.estimativa_minutos is not null and np.tempo_real_minutos is not null
         group by coalesce(tt.nome, 'Sem workflow')
        having sum(np.estimativa_minutos) > 0
      ) s
    ), '[]'::jsonb),

    'qualidade', (
      select jsonb_build_object(
        'conteudos_decididos', count(*),
        'aprovados_de_prima',  count(*) filter (where de_prima),
        'taxa_de_prima', case when count(*) > 0
          then round(count(*) filter (where de_prima)::numeric / count(*) * 100, 1)
        end,
        'rodadas_media', round(avg(rodadas), 1)
      ) from decididos
    ),

    'palavras_nos_pedidos_de_ajuste', coalesce((
      select jsonb_agg(jsonb_build_object('palavra', palavra, 'vezes', vezes))
        from palavras
    ), '[]'::jsonb),

    -- DESENVOLVIMENTO. A 0043 apagou `user_skills`, entao aqui nao ha
    -- "interesse declarado": ha o que a pessoa ESTUDOU, que e um fato do
    -- periodo. As etiquetas sao as skills dos materiais concluidos --
    -- `skills` ficou como vocabulario da Academy, e e essa a leitura que
    -- sobrou de pe.
    'desenvolvimento', jsonb_build_object(
      'trilhas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'titulo', trilha,
          'materiais_concluidos', materiais_concluidos
        ) order by trilha) from estudo
      ), '[]'::jsonb),
      'etiquetas_estudadas', coalesce((
        select jsonb_agg(nome order by nome) from etiquetas
      ), '[]'::jsonb),
      'workflows_novos', coalesce((
        select jsonb_agg(nome order by nome) from workflows_novos
      ), '[]'::jsonb)
    )
  ) into resultado;

  return resultado;
end;
$$;

comment on function public.feedback_metricas is
  'Os numeros crus do periodo de UMA pessoa, para o feedback de desenvolvimento (0075). A IA os recebe prontos e nao calcula nada. So a gestao chama; a pessoa le a copia gravada no relatorio enviado.';


-- ---------------------------------------------------------------------------
-- PASSO 9 - O CONTEXTO. E o que impede a leitura errada dos numeros.
--
-- Este bloco e a metade do modulo que evita o dano. Os numeros de entrega,
-- sozinhos, cobram de quem recebeu 140% da capacidade, de quem esteve fora
-- metade do mes e de quem teve a entrega parada dez dias esperando o cliente
-- responder. O prompt recebe isto com instrucao explicita de usar para
-- RELATIVIZAR, nunca para cobrar -- e `ressalvas` e a lista de frases
-- prontas, em portugues, que o modelo pode aproveitar sem inventar nada.
--
-- A CARGA VEM DE `carga_do_dia()`, que e a fonte unica desde a 0035, e nao de
-- uma segunda conta aqui. Uma segunda daria dois numeros para a mesma pessoa
-- no mesmo dia -- e a tela de sobrecarga e exatamente onde isso vira
-- discussao. Nao passa por `carga_da_equipe()` porque aquela tem teto de 62
-- dias, desenhado para o mes visivel do calendario, e um trimestre tem
-- noventa e dois.
--
-- AUSENCIA e `ferias`, `licenca` e `ausente`. `feriado` fica fora porque
-- feriado nao e ausencia de ninguem -- e um fato sobre o dia --, e `folga`
-- (sem alocacao) fica fora porque e o estado padrao de sabado e domingo: com
-- ele na conta, todo periodo apareceria como metade fora.
-- ---------------------------------------------------------------------------
create or replace function public.feedback_contexto(
  p_user_id uuid,
  p_de      date,
  p_ate     date
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uteis        integer := public.dias_uteis(p_de, p_ate);
  capacidade   integer;
  comprometido bigint;
  dias_fora    integer;
  h_interna    numeric;
  h_cliente    numeric;
  pendentes    integer;
  etapas_dia   integer;
  sem_estimativa integer;
  confiavel    boolean;
  ressalvas    jsonb := '[]'::jsonb;
  proporcao    numeric;
  fora_prop    numeric;
  resultado    jsonb;
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'O contexto do feedback é calculado pela gestão.';
  end if;

  select tm.capacidade_minutos_dia into capacidade
    from public.team_members tm where tm.user_id = p_user_id;
  capacidade := coalesce(capacidade, 480);

  -- `true` NO TERCEIRO ARGUMENTO, e ele existe por causa deste chamador. O
  -- PASSO 0 conta por que.
  --
  -- E AS DUAS CONTAGENS VEM JUNTO, porque sem elas a proporcao nao tem como
  -- se declarar incerta. `carga_do_dia()` so conta a etapa que tem
  -- estimativa; etapa sem estimativa entra como zero e aparece na contagem --
  -- honesto, porque ela ocupa a pessoa, so ninguem disse quanto.
  select coalesce(sum(c.minutos_comprometidos), 0),
         coalesce(sum(c.etapas), 0),
         coalesce(sum(c.etapas_sem_estimativa), 0)
    into comprometido, etapas_dia, sem_estimativa
    from generate_series(p_de, p_ate, interval '1 day') as d
    cross join lateral public.carga_do_dia(p_user_id, d::date, true) c
   where extract(isodow from d) < 6;

  select count(*)::integer into dias_fora
    from public.team_presence tp
   where tp.user_id = p_user_id
     and tp.data between p_de and p_ate
     and tp.status in ('ferias', 'licenca', 'ausente');

  -- O TEMPO PARADO ESPERANDO APROVACAO, nos dois escopos separados. Se o
  -- interno for alto, o gargalo e da casa, e nenhuma cobranca a pessoa
  -- resolve -- e a mesma razao pela qual `tempo_de_aprovacao()` separa os
  -- dois desde a 0035. Rodada ainda pendente conta ate agora: e ela que
  -- representa o represamento de hoje.
  with conteudos_dela as (
    select 'subtask'::text as tipo, s.id as cid
      from public.subtasks s
      join public.tasks t on t.id = s.task_id
     where s.responsavel_id = p_user_id
       and t.publicada_em is not null
       and not public.subtask_eh_agrupadora(s.id)
    union all
    select 'post', p.id from public.posts p where p.responsavel_id = p_user_id
    union all
    select 'deliverable', d.id from public.deliverables d
     where d.responsavel_id = p_user_id
  ),
  esperas as (
    select r.escopo,
           extract(epoch from (coalesce(r.decidido_em, now()) - r.solicitado_em)) / 3600 as horas,
           r.status
      from public.approval_rounds r
      join conteudos_dela cd on cd.tipo = r.content_type and cd.cid = r.content_id
     where r.solicitado_em >= p_de
       and r.solicitado_em < (p_ate + 1)
  )
  select round(coalesce(sum(horas) filter (where escopo = 'interna'), 0)::numeric, 1),
         round(coalesce(sum(horas) filter (where escopo = 'cliente'), 0)::numeric, 1),
         count(*) filter (where status = 'pendente')::integer
    into h_interna, h_cliente, pendentes
    from esperas;

  -- A PROPORCAO SE DECLARA INCERTA EM VEZ DE DEVOLVER UM NUMERO BAIXO, e esta
  -- e a trava que evita o pior dano possivel do modulo. Num periodo em que
  -- ninguem estimou, `comprometido` e proximo de zero, a proporcao cai abaixo
  -- de 50% e a ressalva de ociosidade sai dizendo a pessoa que a entrega baixa
  -- dela foi distribuicao de trabalho -- quando a verdade e que a agencia nao
  -- preencheu estimativa. E a mesma regra de `receita_por_hora` na 0035: zero e
  -- uma afirmacao sobre a conta, e o que se quer dizer e que ninguem mediu.
  confiavel := etapas_dia > 0 and sem_estimativa * 2 <= etapas_dia;
  proporcao := case when uteis > 0 and capacidade > 0 and confiavel
    then round(comprometido::numeric / (uteis::numeric * capacidade) * 100, 1) end;
  fora_prop := case when uteis > 0
    then round(dias_fora::numeric / uteis * 100, 1) end;

  -- AS RESSALVAS SAO FRASES PRONTAS, e e de proposito. A alternativa seria
  -- mandar os numeros e confiar que o modelo os interprete na direcao certa;
  -- estas frases dizem a direcao. Elas so nascem quando o fato existe: uma
  -- lista de ressalvas em toda geracao viraria um paragrafo de desculpas em
  -- todo feedback.
  if coalesce(fora_prop, 0) >= 20 then
    ressalvas := ressalvas || to_jsonb(format(
      'Esta pessoa esteve fora %s dos %s dias úteis do período (%s%%). O volume de entrega precisa ser lido com isso em conta.',
      dias_fora, uteis, fora_prop));
  end if;

  if coalesce(proporcao, 0) > 110 then
    ressalvas := ressalvas || to_jsonb(format(
      'A carga atribuída a esta pessoa no período foi de %s%% da capacidade dela. Volume alto não é mérito dela, e volume não entregue não é falha dela.',
      proporcao));
  elsif proporcao is not null and proporcao < 50 then
    ressalvas := ressalvas || to_jsonb(format(
      'A carga atribuída a esta pessoa no período foi de %s%% da capacidade dela. Entrega baixa aqui é distribuição de trabalho, não desempenho.',
      proporcao));
  end if;

  if coalesce(h_cliente, 0) >= 48 then
    ressalvas := ressalvas || to_jsonb(format(
      'As entregas desta pessoa somaram %s horas esperando decisão do cliente. Esse tempo não é atraso dela.',
      round(h_cliente)));
  end if;

  if coalesce(h_interna, 0) >= 48 then
    ressalvas := ressalvas || to_jsonb(format(
      'As entregas desta pessoa somaram %s horas esperando o aval interno da agência. Esse tempo não é atraso dela.',
      round(h_interna)));
  end if;

  select jsonb_build_object(
    'ausencia', jsonb_build_object(
      'dias_fora', dias_fora,
      'dias_uteis_no_periodo', uteis,
      'proporcao_fora', fora_prop,
      -- O `group by` vai num SUBSELECT e nao dentro do `jsonb_agg`: o Postgres
      -- recusa `jsonb_agg(... count(*) ...)` com "aggregate function calls
      -- cannot be nested", e a forma certa e a mesma de `por_workflow`.
      'por_tipo', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'dias', x.dias)
                         order by x.tipo)
          from (
            select tp.status::text as tipo, count(*) as dias
              from public.team_presence tp
             where tp.user_id = p_user_id
               and tp.data between p_de and p_ate
               and tp.status in ('ferias', 'licenca', 'ausente')
             group by tp.status
          ) x
      ), '[]'::jsonb)
    ),
    'carga', jsonb_build_object(
      'minutos_comprometidos', comprometido,
      'capacidade_minutos_dia', capacidade,
      'dias_uteis', uteis,
      'etapas_datadas', etapas_dia,
      'etapas_sem_estimativa', sem_estimativa,
      -- NULA quando nao ha estimativa suficiente para a conta valer. O prompt
      -- recebe o nulo e nao fala de carga -- que e melhor que falar errado.
      'proporcao_da_capacidade', proporcao
    ),
    'espera_por_aprovacao', jsonb_build_object(
      'horas_interna', h_interna,
      'horas_cliente', h_cliente,
      'rodadas_ainda_pendentes', pendentes
    ),
    -- A UNICA MEDIA DA AGENCIA QUE APARECE, e ela e sobre CLIENTE e nao
    -- sobre gente: quantas rodadas a conta costuma pedir, contra a media de
    -- todas as contas. Quem atende uma conta que pede o dobro de rodadas nao
    -- esta entregando pior.
    'clientes_com_retrabalho', coalesce((
      with por_cliente as (
        select public.cliente_da_rodada(r.content_type, r.content_id) as client_id,
               avg(r.numero_rodada) as rodadas
          from public.approval_rounds r
         where r.escopo = 'cliente'
           and r.decidido_em is not null
           and r.decidido_em::date between p_de - 180 and p_ate
         group by 1
      ),
      media as (select avg(rodadas) as m from por_cliente where client_id is not null),
      dela as (
        select distinct t.client_id
          from public.subtasks s
          join public.tasks t on t.id = s.task_id
         where s.responsavel_id = p_user_id
           and t.publicada_em is not null
           and s.concluida_em::date between p_de and p_ate
           and t.client_id is not null
      )
      select jsonb_agg(jsonb_build_object(
        'nome', c.nome_empresa,
        'rodadas_media', round(pc.rodadas, 1),
        'media_das_contas', round((select m from media), 1)
      ) order by pc.rodadas desc)
        from por_cliente pc
        join dela on dela.client_id = pc.client_id
        join public.clients c on c.id = pc.client_id
       where (select m from media) is not null
         and pc.rodadas > (select m from media) * 1.5
    ), '[]'::jsonb),
    'ressalvas', ressalvas
  ) into resultado;

  return resultado;
end;
$$;

comment on function public.feedback_contexto is
  'O que impede a leitura errada dos numeros do feedback (0075): ausencia, carga contra capacidade, tempo parado esperando aprovacao, e cliente que pede mais rodadas que a media das contas. `ressalvas` sao frases prontas para o prompt usar ao RELATIVIZAR -- nunca para cobrar.';


-- ---------------------------------------------------------------------------
-- PASSO 10 - Os alertas de carga, que sao da gestao
--
-- Escritos por SQL e nao pela IA, pela mesma razao que tudo aqui: a IA nao
-- calcula. E escritos por funcao e nao por trigger porque nao ha escrita que
-- os dispare -- eles nascem de uma pergunta sobre um periodo, que alguem faz.
--
-- `sobrecarga` exige DOIS periodos seguidos acima de 110%, e a segunda
-- condicao e o que separa um alerta de um ruido: um mes apertado e normal
-- numa agencia, dois seguidos e uma decisao de distribuicao que ninguem
-- revisou. `ociosidade` nao exige dois: entrega baixa por falta de trabalho
-- atribuido e um problema no primeiro mes.
--
-- `on conflict do nothing` mais o indice unico fazem a funcao poder rodar de
-- novo: gerar o feedback duas vezes nao empilha o mesmo alerta, e o Pulso da
-- agencia nao mostra dois numeros para o mesmo fato.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_alertas_de_carga(
  p_user_id uuid,
  p_de      date,
  p_ate     date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  dias      integer := (p_ate - p_de) + 1;
  ctx       jsonb;
  ctx_ant   jsonb;
  prop      numeric;
  prop_ant  numeric;
  gravados  integer := 0;
  cliente   jsonb;
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Os alertas de carga são da gestão.';
  end if;

  ctx      := public.feedback_contexto(p_user_id, p_de, p_ate);
  ctx_ant  := public.feedback_contexto(p_user_id, p_de - dias, p_de - 1);
  prop     := (ctx     -> 'carga' ->> 'proporcao_da_capacidade')::numeric;
  prop_ant := (ctx_ant -> 'carga' ->> 'proporcao_da_capacidade')::numeric;

  if coalesce(prop, 0) > 110 and coalesce(prop_ant, 0) > 110 then
    insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes)
    values (p_user_id, p_de, p_ate, 'sobrecarga', jsonb_build_object(
      'proporcao', prop, 'proporcao_periodo_anterior', prop_ant))
    on conflict (user_id, periodo_inicio, tipo) do nothing;
    gravados := gravados + 1;
  end if;

  if prop is not null and prop < 50 then
    insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes)
    values (p_user_id, p_de, p_ate, 'ociosidade', jsonb_build_object(
      'proporcao', prop,
      'dias_fora', (ctx -> 'ausencia' ->> 'dias_fora')::integer))
    on conflict (user_id, periodo_inicio, tipo) do nothing;
    gravados := gravados + 1;
  end if;

  -- GARGALO DE APROVACAO: o aval INTERNO, e nao o do cliente. O cliente
  -- demora e a agencia cobra; o interno demora e a agencia e a responsavel --
  -- e este alerta existe para ela ver isso sobre si mesma.
  if coalesce((ctx -> 'espera_por_aprovacao' ->> 'horas_interna')::numeric, 0) >= 96 then
    insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes)
    values (p_user_id, p_de, p_ate, 'gargalo_aprovacao', jsonb_build_object(
      'horas_interna', (ctx -> 'espera_por_aprovacao' ->> 'horas_interna')::numeric,
      'rodadas_ainda_pendentes', (ctx -> 'espera_por_aprovacao' ->> 'rodadas_ainda_pendentes')::integer))
    on conflict (user_id, periodo_inicio, tipo) do nothing;
    gravados := gravados + 1;
  end if;

  cliente := ctx -> 'clientes_com_retrabalho';
  if jsonb_array_length(cliente) > 0 then
    insert into public.workload_alerts (user_id, periodo_inicio, periodo_fim, tipo, detalhes)
    values (p_user_id, p_de, p_ate, 'retrabalho_por_cliente', jsonb_build_object(
      'clientes', cliente))
    on conflict (user_id, periodo_inicio, tipo) do nothing;
    gravados := gravados + 1;
  end if;

  return gravados;
end;
$$;

comment on function public.registrar_alertas_de_carga is
  'Grava os sinais que sao da GESTAO e nao da pessoa (0075): sobrecarga em dois periodos seguidos, ociosidade, gargalo no aval interno e cliente que pede retrabalho acima da media das contas. Idempotente pelo indice unico.';


-- ---------------------------------------------------------------------------
-- PASSO 11 - Quem tem quem quer receber, e quem ja tem relatorio do periodo
--
-- A tela de geracao precisa da lista antes do clique, pela razao do dialogo
-- de "Pedir as notas do mes" (0066): um botao que dispara N chamadas de IA e
-- so depois conta quantas foram e um botao que se aperta com medo. E o medo
-- tem razao -- cada chamada custa, e o relatorio nao se desfaz.
--
-- A CONTAGEM VEM DA MESMA FUNCAO QUE A GERACAO USA, pela razao de
-- `quem_deve_nota()`: duas contas dariam um dialogo prometendo cinco pessoas
-- e uma geracao alcancando quatro.
-- ---------------------------------------------------------------------------
create or replace function public.quem_recebe_feedback(
  p_de           date,
  p_ate          date,
  p_periodicidade public.feedback_periodicidade default 'mensal'
)
returns table (
  user_id        uuid,
  nome           text,
  concluidas     integer,
  ja_tem         boolean,
  status_atual   public.feedback_status
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_gestor() then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'A fila de feedback é da gestão.';
  end if;

  return query
  select p.id,
         p.nome,
         (select count(*)::integer
            from public.subtasks s
            join public.tasks t on t.id = s.task_id
           where s.responsavel_id = p.id
             and t.publicada_em is not null
             and not public.subtask_eh_agrupadora(s.id)
             and s.concluida_em::date between p_de and p_ate),
         exists (select 1 from public.feedback_reports r
                  where r.user_id = p.id
                    and r.periodo_inicio = p_de
                    and r.periodicidade = p_periodicidade),
         (select r.status from public.feedback_reports r
           where r.user_id = p.id
             and r.periodo_inicio = p_de
             and r.periodicidade = p_periodicidade
           limit 1)
    from public.profiles p
    join public.team_members tm on tm.user_id = p.id
   where p.ativo
     and tm.ativo
     -- QUEM OPTOU POR NAO RECEBER NAO APARECE NA FILA, e nao aparece
     -- desligado: uma linha cinza com o nome dela contaria a gestao uma
     -- escolha pessoal que nao decide nada ali.
     and tm.recebe_feedback_ia
   order by p.nome;
end;
$$;

comment on function public.quem_recebe_feedback is
  'Quem entra na geracao de feedback do periodo, com quantas etapas cada pessoa concluiu e se ja tem relatorio (0075). Mesma funcao para o dialogo e para a geracao -- duas contas dariam um dialogo prometendo mais do que a geracao alcanca.';


-- ---------------------------------------------------------------------------
-- PASSO 12 - Quem pode chamar o que
--
-- `revoke ... from public` explicito em cada funcao nova: o Postgres concede
-- `execute` a `public` por padrao, e o PostgREST publica o schema `public`
-- sozinho. E a licao da 0071, onde `limpar_rascunhos_abandonados()` --
-- `security definer`, e que APAGA de `tasks` -- ficou chamavel com a chave
-- anon, que vai no bundle que o navegador baixa.
--
-- As quatro travam em `is_gestor()` na primeira linha, entao o grant a
-- `authenticated` nao abre nada: ele existe para a recusa chegar como a
-- mensagem escrita, e nao como "function does not exist" -- que manda quem
-- leu procurar um bug de schema.
-- ---------------------------------------------------------------------------
-- E O `revoke from public` NAO BASTA, e foi a bateria que mostrou: o Supabase
-- deixa ligado um `alter default privileges ... grant all on functions to anon,
-- authenticated`, que concede por caminho proprio e nao e alcancado por um
-- revoke em `public`. Sem a linha do `anon`, os quatro cenarios de privilegio
-- falham dizendo "anon TEM execute" -- exatamente o que a 0071 registrou.
revoke all on function public.feedback_metricas(uuid, date, date) from public, anon;
revoke all on function public.feedback_contexto(uuid, date, date) from public, anon;
revoke all on function public.registrar_alertas_de_carga(uuid, date, date) from public, anon;
revoke all on function public.quem_recebe_feedback(date, date, public.feedback_periodicidade) from public, anon;

grant execute on function public.feedback_metricas(uuid, date, date) to authenticated;
grant execute on function public.feedback_contexto(uuid, date, date) to authenticated;
grant execute on function public.registrar_alertas_de_carga(uuid, date, date) to authenticated;
grant execute on function public.quem_recebe_feedback(date, date, public.feedback_periodicidade) to authenticated;


-- ---------------------------------------------------------------------------
-- PASSO 13 - As duas coisas que a PESSOA faz, e cada uma escreve uma coluna
--
-- FOI A BATERIA QUE ACHOU, e o cenario que caiu foi "E sai da fila": a pessoa
-- marcava que nao quer receber, o `update` passava sem erro e sem linha, e ela
-- continuava na fila. `team_members_update` e `is_gestor()` desde o Sprint 2 --
-- entao `recebe_feedback_ia` nasceu inalcancavel por quem ela e para.
--
-- E A SAIDA NAO E ABRIR `team_members` PARA A PROPRIA PESSOA. Policy nao
-- limita coluna: com um UPDATE da propria linha, ela passaria a poder escrever
-- `capacidade_minutos_dia`, `dias_ferias_ano`, `max_parcelas_ferias` e
-- `funcao` -- o contrato dela, o saldo de descanso e o oficio. Seria preciso
-- um trigger de protecao de coluna para desfazer o que a policy abriu, que e o
-- caminho de `protect_client_columns` e de `posts_protege_colunas`.
--
-- Aqui a forma certa e a da 0069: sem policy de UPDATE nao ha coluna a
-- proteger. Sao duas funcoes que escrevem UMA coisa cada, como
-- `confirmar_recebimento()` e `reportar_problema_do_comodato()`.
--
-- E AS DUAS SO ESCREVEM A LINHA DE QUEM CHAMA. `security definer` sem essa
-- linha seria a porta que abre tudo: alguem marcaria o colega como "nao
-- recebe" e o feedback dele pararia de ser gerado sem ninguem notar.
-- ---------------------------------------------------------------------------
create or replace function public.escolher_receber_feedback(p_receber boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := (select auth.uid());
begin
  if eu is null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Sem sessão.';
  end if;

  update public.team_members
     set recebe_feedback_ia = p_receber
   where user_id = eu;

  -- SEM FICHA NA EQUIPE NAO HA ESCOLHA A GUARDAR, e a recusa e escrita em vez
  -- de a funcao devolver `false` calada: a tela tem um interruptor, e um
  -- interruptor que volta sozinho sem dizer nada e a tela parecendo quebrada.
  if not found then
    raise exception using
      errcode = 'no_data_found',
      message = 'Esta conta não tem ficha na equipe, então não há feedback para receber.',
      hint = 'Peça à gestão para criar a ficha em Gestão de Pessoas.';
  end if;

  return p_receber;
end;
$$;

comment on function public.escolher_receber_feedback is
  'A pessoa escolhe se quer receber o feedback de desenvolvimento (0075). Escreve UMA coluna da propria linha -- `team_members` nao tem policy de UPDATE para ela, e abrir uma daria junto a capacidade diaria e o saldo de descanso.';


create or replace function public.marcar_feedback_explicado()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  eu    uuid := (select auth.uid());
  agora timestamptz := now();
begin
  if eu is null then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'Sem sessão.';
  end if;

  -- NAO REESCREVE QUEM JA LEU: a data e a primeira vez, e regravar a cada
  -- visita a /painel/feedback/sobre transformaria "quando ela soube" em
  -- "quando ela abriu a pagina pela ultima vez".
  update public.team_members
     set feedback_explicado_em = agora
   where user_id = eu
     and feedback_explicado_em is null;

  select feedback_explicado_em into agora
    from public.team_members where user_id = eu;

  return agora;
end;
$$;

comment on function public.marcar_feedback_explicado is
  'Guarda que esta pessoa leu a explicacao do feedback (0075). So na primeira vez -- a data e quando ela soube, nao quando abriu a pagina pela ultima vez.';

revoke all on function public.escolher_receber_feedback(boolean) from public, anon;
revoke all on function public.marcar_feedback_explicado() from public, anon;
grant execute on function public.escolher_receber_feedback(boolean) to authenticated;
grant execute on function public.marcar_feedback_explicado() to authenticated;
