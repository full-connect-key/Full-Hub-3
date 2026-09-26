-- ---------------------------------------------------------------------------
-- 0064 - OS PADROES DA CONTA, E A ETAPA QUE APONTA PARA UMA FUNCAO
--
-- Decisao do usuario: a aba "Configuracoes do fluxo" da ficha do cliente
-- continua fazendo sentido, com outro conteudo. No modelo antigo ela guardaria
-- as etapas de aprovacao da conta; no modelo atual o fluxo mora nos workflows,
-- e o que e especifico de cada cliente sao os PADROES da conta: quem faz o que
-- ali, quem aprova, e em quantos dias aquele cliente costuma responder.
--
-- O problema concreto que isto resolve: abrir uma demanda para a Mundo Verde e
-- escolher, na mao, o mesmo social media e o mesmo redator toda vez.
--
-- ---------------------------------------------------------------------------
-- A PONTE JA EXISTIA, E E A SEXTA -- `workflow_steps.funcao_padrao`
--
-- Ela nasceu na **0007**, a 0008 semeia os tres workflows iniciais com ela
-- preenchida, o editor de `/painel/workflows` a grava, `EtapaAplicada` a
-- carrega... e `etapasDoWorkflow` escrevia
--
--     responsavel_id: etapa.responsavel_padrao_id
--
-- ignorando a funcao. Os workflows semeados tem funcao e **nao** tem pessoa,
-- entao TODA aplicacao de workflow criava etapas orfas -- e a regra do proprio
-- produto diz o que isso significa: *"etapa sem dono nao aparece no Minhas
-- Tasks de ninguem: ela existe no board da agencia e mais nada. E o pior tipo
-- de trabalho, o que ninguem sabe que nasceu."*
--
-- Esse e o bug de verdade atras deste sprint, e nao a coluna. E a mesma
-- situacao de `clients.drive_folder_id` antes do Sprint 16, de
-- `deliverables.subtask_id` antes da 0051, de `deliverable_versions` antes da
-- tela de Campanhas, de `posts.subtask_id` antes da 0061 e de
-- `clients.logo_url` antes da 0063. O `add column if not exists` no fim deste
-- arquivo nao acrescenta nada: esta ali para quem aplicar este arquivo num
-- banco anterior a 0007 nao ficar sem ela.
--
-- ---------------------------------------------------------------------------
-- TRES DAS SEIS COLUNAS PEDIDAS JA EXISTEM EM `clients`, E CRIA-LAS DE NOVO
-- SERIA DUAS VERDADES
--
--   * `atendimento_id` e `clients.responsavel_atendimento_id`, que existe
--     desde a 0002 e que a **0062** acabou de tornar critica: e a pessoa que o
--     Portal notifica quando o cliente comenta ou decide. Uma segunda coluna
--     com o mesmo papel divergiria em silencio da que o aviso usa -- e o
--     sintoma seria o comentario do cliente chegando para quem saiu da conta;
--   * `observacoes` e `clients.observacoes`, que a ficha do cliente ja desenha.
--     O que faltava nao era a coluna: era ela APARECER na abertura da demanda,
--     que e onde a particularidade da conta decide alguma coisa;
--   * `pasta_entrega_url` fica, e e diferente de `drive_folder_id`: aquele e o
--     id da pasta-mae do cliente no Drive, de onde o botao "Criar no Drive"
--     pendura a pasta da demanda. Este e um endereco colavel, para a agencia
--     que guarda o material daquele cliente fora do Drive da casa.
--
-- ---------------------------------------------------------------------------
-- E A TABELA E SEPARADA DE `clients` POR UMA RAZAO MELHOR QUE "ela ja e larga"
--
-- **O CLIENTE ESCREVE EM `clients`.** A policy `clients_update_proprio` (0005)
-- deixa a linha inteira passar de proposito, e quem separa o que ele pode do
-- que ele nao pode e o trigger `protect_client_columns` -- que ja esqueceu uma
-- coluna uma vez: o `slug` nasceu na 0009, depois da funcao, e ficou aberto ate
-- a 0031.
--
-- `prazo_aprovacao_cliente_dias` numa coluna de `clients` seria o prazo de
-- resposta do cliente na mao do cliente, e bastaria alguem esquecer a linha no
-- trigger. Aqui ele mora numa tabela em que o perfil `cliente` nao tem policy
-- nenhuma: nao ha o que esquecer.
--
-- ---------------------------------------------------------------------------
-- A ORDEM DO `coalesce` MORA NO BANCO, e e isso que deixa a bateria fixa-la
--
-- `etapas_resolvidas_do_workflow()` resolve
--
--     pessoa explicita na etapa  ->  a pessoa daquela funcao nesta conta  ->  null
--
-- nessa ordem, e o cenario que a inverte e o unico que falha se alguem trocar
-- os lados -- a mesma forma da 0041 com `coalesce(etapa, padrao)`. Em
-- TypeScript `etapasDoWorkflow` passou a CHAMAR esta funcao em vez de resolver
-- em memoria: com a conta de um lado e a de outro, o dia em que as duas
-- divergirem e o dia em que a tela promete um responsavel que o banco nao poe.
--
-- **Nao entra `gerar_ocorrencia()` ainda, e a ausencia e escolha.** A regra de
-- recorrencia guarda as etapas como jsonb em `task_recurrences.modelo`, e esse
-- jsonb **nao carrega a funcao** -- so `responsavel_id`. Ligar a rotina da
-- madrugada exigiria mudar a forma do modelo e a tela que o escreve, e o
-- `coalesce` dela ganharia um quarto nivel (explicito -> funcao da conta ->
-- padrao da regra -> null), que e decisao de produto e nao consequencia desta.
-- Quem for fazer chama esta funcao: e uma linha, e o lugar esta dito.
--
-- ---------------------------------------------------------------------------
-- NAO BLOQUEIA NADA, e e criterio do pedido
--
-- Sem ninguem definido para a funcao, a etapa nasce sem responsavel e a tela
-- avisa com link para a configuracao. Recusar a aplicacao do workflow pararia
-- o trabalho por causa de um cadastro que a pessoa pode fazer depois -- e quem
-- abre a demanda esta com pressa.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - Os padroes da conta
--
-- `client_id` e UNICO: e uma linha por cliente, nao um historico. Quem quer
-- saber quando o prazo mudou tem a trilha de auditoria (0058), e por isso esta
-- tabela entra nela no fim deste arquivo.
-- ---------------------------------------------------------------------------
create table if not exists public.client_flow_defaults (
  id                            uuid primary key default gen_random_uuid(),
  client_id                     uuid not null unique
                                  references public.clients (id) on delete cascade,
  aprovador_interno_id          uuid references public.profiles (id) on delete set null,
  pasta_entrega_url             text,
  prazo_aprovacao_cliente_dias  integer not null default 3,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- O MESMO `check` DA 0014 PARA A PASTA: sem ele, "ver com a Ana" digitado aqui
-- viaja para o campo `link_entrega` de toda demanda daquele cliente, e a 0014
-- recusa a task com uma mensagem sobre http que ninguem ligaria a esta tela.
-- A recusa acontece onde o valor e digitado.
alter table public.client_flow_defaults
  drop constraint if exists client_flow_defaults_pasta_http;
alter table public.client_flow_defaults
  add constraint client_flow_defaults_pasta_http check (
    pasta_entrega_url is null
    or pasta_entrega_url ~* '^https?://'
  );

-- UM DIA NO MINIMO, e teto de um ano.
--
-- Zero faria todo material nascer atrasado no instante do envio, e o alerta do
-- dashboard perderia o sentido: aquilo que esta sempre vermelho nao e alerta.
-- O teto e para o dedo escorregado -- 30 digitado como 300 poria a conta fora
-- de qualquer alerta pelos proximos dez meses, calado.
alter table public.client_flow_defaults
  drop constraint if exists client_flow_defaults_prazo_razoavel;
alter table public.client_flow_defaults
  add constraint client_flow_defaults_prazo_razoavel check (
    prazo_aprovacao_cliente_dias between 1 and 365
  );

comment on table public.client_flow_defaults is
  'Padroes de fluxo de UM cliente (0064): aprovador interno, pasta de entrega e prazo de resposta dele. O atendimento da conta e o texto de particularidades NAO moram aqui -- sao clients.responsavel_atendimento_id e clients.observacoes, que ja existiam.';

comment on column public.client_flow_defaults.prazo_aprovacao_cliente_dias is
  'Em quantos dias este cliente costuma responder. Alimenta o "dias aguardando" e o alerta de atraso em Campanhas -- por conta, e nao um numero fixo global.';


-- ---------------------------------------------------------------------------
-- PASSO 2 - Quem exerce cada funcao nesta conta
--
-- Uma linha por (cliente, funcao). `unique` e o que faz a pergunta "quem e o
-- Redator da Mundo Verde?" ter UMA resposta: sem ele a tela precisaria escolher
-- entre duas, e escolheria pela ordem de insercao.
--
-- E ela e uma TABELA e nao um jsonb em `client_flow_defaults`, ao contrario do
-- template de campanha (0033): aqui se consulta por funcao, uma funcao por vez,
-- de dentro de outra consulta. O criterio e o mesmo que separou o workflow de
-- task do template de campanha -- o que se consulta normaliza, o que se edita
-- inteiro e se le inteiro vira jsonb.
-- ---------------------------------------------------------------------------
create table if not exists public.client_function_defaults (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  funcao     public.team_funcao not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, funcao)
);

comment on table public.client_function_defaults is
  'Quem exerce cada funcao nesta conta (0064). E o que faz um workflow GLOBAL com etapa apontando para "Redator" servir todos os clientes: cada conta resolve as pessoas por si, em vez de o workflow ser duplicado por cliente.';

create index if not exists client_function_defaults_cliente
  on public.client_function_defaults (client_id);


-- ---------------------------------------------------------------------------
-- PASSO 3 - A coluna da 0007, repetida para quem vier de um banco anterior
-- ---------------------------------------------------------------------------
alter table public.workflow_steps
  add column if not exists funcao_padrao public.team_funcao;

comment on column public.workflow_steps.funcao_padrao is
  'A FUNCAO que faz esta etapa, quando nao ha pessoa explicita (0007, atravessada na 0064). Com ela, "Post de feed" e um workflow so para a agencia inteira: quem resolve o Redator de cada conta e client_function_defaults.';


-- ---------------------------------------------------------------------------
-- PASSO 4 - RLS
--
-- Leitura por `is_staff()`: quem produz precisa saber quem aprova nesta conta,
-- e a tela de criacao de demanda le estes padroes para qualquer perfil interno.
--
-- Escrita por `is_gestor() or is_atendimento()` -- a MESMA pergunta que
-- `tasks_insert` faz desde a 0006, e nao uma parecida. Quem distribui o
-- trabalho de uma conta e quem abre a demanda dela.
--
-- **O cliente nao tem policy nenhuma**, e e a diferenca que justifica a tabela
-- separada: nao existe linha para o perfil `cliente`, entao nao existe coluna
-- para alguem esquecer num trigger de protecao.
-- ---------------------------------------------------------------------------
alter table public.client_flow_defaults     enable row level security;
alter table public.client_function_defaults enable row level security;

drop policy if exists client_flow_defaults_select on public.client_flow_defaults;
create policy client_flow_defaults_select on public.client_flow_defaults
  for select using (public.is_staff());

drop policy if exists client_flow_defaults_write on public.client_flow_defaults;
create policy client_flow_defaults_write on public.client_flow_defaults
  for all using (public.is_gestor() or public.is_atendimento())
  with check (public.is_gestor() or public.is_atendimento());

drop policy if exists client_function_defaults_select on public.client_function_defaults;
create policy client_function_defaults_select on public.client_function_defaults
  for select using (public.is_staff());

drop policy if exists client_function_defaults_write on public.client_function_defaults;
create policy client_function_defaults_write on public.client_function_defaults
  for all using (public.is_gestor() or public.is_atendimento())
  with check (public.is_gestor() or public.is_atendimento());


-- ---------------------------------------------------------------------------
-- PASSO 5 - `updated_at` a cada escrita
-- ---------------------------------------------------------------------------
create or replace function public.client_flow_defaults_touch()
returns trigger
language plpgsql
as $func$
begin
  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists client_flow_defaults_touch on public.client_flow_defaults;
create trigger client_flow_defaults_touch
  before update on public.client_flow_defaults
  for each row execute function public.client_flow_defaults_touch();


-- ---------------------------------------------------------------------------
-- PASSO 6 - A RESOLUCAO, num lugar so
--
-- Devolve as etapas do workflow com `responsavel_id` JA RESOLVIDO para aquela
-- conta. O prazo continua sendo calculado por quem chama, a partir do
-- `data_inicio` da demanda -- ele nao e propriedade do workflow.
--
-- A ORDEM E A REGRA:
--
--   1. `responsavel_padrao_id` da etapa, se houver -- quem escreveu o nome na
--      etapa mandou;
--   2. senao, a pessoa daquela funcao NAQUELE cliente;
--   3. senao, nulo, e quem chama avisa.
--
-- Invertendo 1 e 2, encher a tabela de funcoes da conta apagaria a distribuicao
-- que alguem montou etapa por etapa dentro de um workflow especifico daquele
-- cliente. E a mesma armadilha da 0041, e a bateria guarda o cenario que a
-- impede: ele e o unico que falha se os lados trocarem.
--
-- **PESSOA DESLIGADA NAO VIRA RESPONSAVEL**, e a pergunta e a mesma que a 0041
-- faz: `pessoa_desligada()`. Sem ela, quem sai da agencia continua herdando
-- etapa de toda demanda daquela conta, e a etapa nasce no Minhas Tasks de uma
-- conta que ninguem abre mais.
--
-- Nao e `security definer`: quem le `client_function_defaults` continua sendo
-- quem a policy deixa. Esta funcao existe para nomear a ordem, nao para furar
-- a RLS.
-- ---------------------------------------------------------------------------
create or replace function public.etapas_resolvidas_do_workflow(
  p_template_id uuid,
  p_client_id   uuid
)
returns table (
  ordem              integer,
  nome               text,
  responsavel_id     uuid,
  funcao_padrao      public.team_funcao,
  funcao_sem_dono    public.team_funcao,
  prioridade         public.task_prioridade,
  prazo_offset_dias  integer,
  requer_aprovacao   boolean,
  tipo_aprovacao     public.tipo_aprovacao,
  depende_de_ordem   integer
)
language plpgsql
stable
set search_path = public
as $func$
begin
  return query
  select
    s.ordem,
    s.nome,
    -- A ordem do coalesce E a regra. Trocar os dois primeiros e o que a
    -- bateria impede.
    case
      when s.responsavel_padrao_id is not null
           and not public.pessoa_desligada(s.responsavel_padrao_id)
        then s.responsavel_padrao_id
      when d.user_id is not null
           and not public.pessoa_desligada(d.user_id)
        then d.user_id
      else null
    end                                                    as responsavel_id,
    s.funcao_padrao,
    -- A FUNCAO QUE FICOU SEM NINGUEM, para a tela poder dizer QUAL falta.
    --
    -- Sem esta coluna a resposta seria "alguma etapa ficou sem dono", e a
    -- pessoa abriria a configuracao para procurar qual das cinco -- a mesma
    -- diferenca entre uma recusa e uma instrucao que a 0023 paga ao NOMEAR
    -- cada etapa sem aprovacao.
    case
      when s.funcao_padrao is not null
           and s.responsavel_padrao_id is null
           and (d.user_id is null or public.pessoa_desligada(d.user_id))
        then s.funcao_padrao
      else null
    end                                                    as funcao_sem_dono,
    s.prioridade,
    s.prazo_offset_dias,
    s.requer_aprovacao,
    s.tipo_aprovacao,
    s.depende_de_ordem
  from public.workflow_steps s
  left join public.client_function_defaults d
         on d.client_id = p_client_id
        and d.funcao    = s.funcao_padrao
  where s.template_id = p_template_id
  order by s.ordem;
end;
$func$;

comment on function public.etapas_resolvidas_do_workflow(uuid, uuid) is
  'As etapas de um workflow com o responsavel resolvido para uma conta (0064). Ordem: pessoa explicita na etapa, senao a pessoa daquela funcao no cliente, senao nulo. Pessoa desligada nao entra. `funcao_sem_dono` diz QUAL funcao faltou, para a tela nomea-la.';


-- ---------------------------------------------------------------------------
-- PASSO 7 - As duas entram na trilha de auditoria (0058)
--
-- Elas sao configuracao de conta: quem aprova, quem faz o que, e em quantos
-- dias o cliente responde. A trilha guarda "acesso, gente, dinheiro e
-- decisao", e distribuir trabalho de uma conta e as tres primeiras.
--
-- O trigger e o mesmo `registrar_auditoria()`, e ele so grava a coluna que
-- mudou -- entao trocar o redator da conta vira uma linha, nao dois objetos de
-- vinte campos.
-- ---------------------------------------------------------------------------
do $bloco$
begin
  if exists (
    select 1 from pg_proc p
     where p.proname = 'registrar_auditoria'
       and p.pronamespace = 'public'::regnamespace
  ) then
    drop trigger if exists auditoria_client_flow_defaults on public.client_flow_defaults;
    create trigger auditoria_client_flow_defaults
      after insert or update or delete on public.client_flow_defaults
      for each row execute function public.registrar_auditoria();

    drop trigger if exists auditoria_client_function_defaults on public.client_function_defaults;
    create trigger auditoria_client_function_defaults
      after insert or update or delete on public.client_function_defaults
      for each row execute function public.registrar_auditoria();
  end if;
end;
$bloco$;

notify pgrst, 'reload schema';
