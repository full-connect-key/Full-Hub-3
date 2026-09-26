-- ---------------------------------------------------------------------------
-- 0061 - O MES DE SOCIAL E UMA DEMANDA, E CADA POST E UMA ETAPA DELA
--
-- Decisao do usuario: *"atualmente quando abro o mes de social, ele abre tasks
-- individuais, quero que mude o fluxo para Uma task do Social do mes em
-- questao, e uma subtarefa, para cada um dos posts. Ou seja, se for o social
-- de outubro com 20 tasks, vao ser Uma task, do social de Outubro, mais 20
-- subtarefas, uma para post"*.
--
-- ---------------------------------------------------------------------------
-- A PONTE JA EXISTIA, E NINGUEM A ATRAVESSAVA -- a quarta do produto
--
-- `posts.subtask_id` nasceu na **0032**, com o comentario dizendo em quantas
-- palavras o que ela e para: *"A etapa que produziu o post. OPCIONAL de
-- proposito (...) Quando existe, e o que faz a Gestao de Tasks e o Portal
-- contarem a mesma historia"*. Em cinco migrations de social nenhuma linha a
-- escreveu. E a mesma situacao de `clients.drive_folder_id` antes do Sprint
-- 16, de `deliverables.subtask_id` antes da 0051 e de `deliverable_versions`
-- antes da tela de Campanhas.
--
-- Por isso a coluna nova aqui e UMA: `tasks.social_do_mes`. O resto e ligar o
-- que estava construido.
--
-- ---------------------------------------------------------------------------
-- E UMA DEMANDA POR CLIENTE-MES, E ISSO E O MODO `mensal_agrupada` DE NOVO
--
-- A 0040 ja tinha essa conta escrita, para a recorrencia: *"sem ele o board da
-- agencia teria vinte e duas linhas do mesmo trabalho por mes, por cliente --
-- e o andamento de 'stories de outubro' nao caberia em nenhuma delas"*. E a
-- 0045 recusou ser um `workflow_template` com metade do mesmo argumento: *"o
-- board da agencia ganharia cento e vinte linhas mensais"*.
--
-- O que muda e que agora ele ganha DOZE linhas dentro de UMA, que e onde o
-- andamento de "Social de Outubro" cabe: o status da Task e calculado pelas
-- folhas desde a 0007, entao a demanda do mes anda sozinha conforme os posts
-- andam.
--
-- ---------------------------------------------------------------------------
-- A SUBTAREFA DO POST E AGRUPADORA EM TUDO, MENOS NO `parent_id`
--
-- Ela e o post no board da agencia, e nada mais. Por isso:
--
--   * **nao tem responsavel.** O trabalho de um post tem CINCO donos -- Pauta,
--     Conteudo, Layout, Envio e Programar --, e as cinco etapas ja aparecem em
--     Minhas Tasks, em bloco proprio, desde que a corrente entrou lá. Escrever
--     um dos cinco aqui poria o mesmo trabalho duas vezes na mesma lista, numa
--     linha cujo dono seria um dos cinco escolhido a esmo.
--
--   * **nao tem prazo.** O dia do post ja aparece duas vezes no calendario: a
--     sexta origem da `calendar_events` (o post, no dia em que vai ao ar) e a
--     oitava (a etapa, no dia em que o trabalho precisa estar pronto, 0059).
--     Uma terceira linha no mesmo dia e a conta que o produto ja recusou duas
--     vezes -- *"uma barra por data dobraria os itens do mes"*. E o resumo da
--     semana ganharia cinquenta linhas dizendo "sem responsavel".
--
--   * **o relogio dela nao corre.** Quem mede sao as etapas da corrente, e
--     somar os dois contaria o mesmo trabalho duas vezes na rentabilidade. E a
--     linha que a 0022 escreveu para a agrupadora, palavra por palavra.
--
--   * **o status dela e CALCULADO pela corrente**, nunca escrito a mao.
--
-- O que ela NAO herda da agrupadora e a contagem: ela CONTA como folha na soma
-- da Task, porque ela e o post -- e o progresso do mes e quantos posts
-- andaram. Uma agrupadora de verdade sai da soma; esta e a unidade.
--
-- A pergunta mora num lugar so, `subtarefa_de_post()`, como
-- `subtask_eh_agrupadora()`. Duas consultas dizendo quase isso seriam o lugar
-- onde as duas verdades comecam a divergir.
--
-- ---------------------------------------------------------------------------
-- O MIRROR DA CORRENTE NAO TEM DE-PARA, E E POR ISSO QUE ELE PODE EXISTIR
--
-- `post_etapas.status` e `subtask_status` desde a 0045, e a razao escrita lá
-- foi exatamente esta: *"esta tabela responde a MESMA pergunta que a etapa de
-- demanda"*. Entao o mirror copia valor para valor, sem traducao -- e um
-- de-para entre dois enums seria o lugar onde as duas verdades divergem, que e
-- a razao pela qual o board de etapas de Minhas Tasks tem seis colunas e nao
-- sete.
--
-- **Menos em dois casos, e eles sao a regra da agrupadora de novo.** A mae
-- nunca fica em `enviada_aprovacao` nem em `em_ajustes`: os dois afirmam que
-- existe uma rodada DELA, e a fila de aprovacoes iria procurá-la. Com a
-- corrente em aprovacao a subtarefa do post fica em `em_andamento`, que e
-- verdade -- o trabalho esta acontecendo dentro dela.
--
-- E o mirror NAO precisa de saida de emergencia, ao contrario da 0045 e da
-- 0059: ele escreve pelo caminho normal e as tres travas de
-- `validar_transicao_de_subtarefa` deixam passar -- a subtarefa nao exige
-- aprovacao, nao tem dependencia, e os dois status que pedem rodada sao
-- justamente os dois que ele nao escreve. E a forma de
-- `etapa_acompanha_o_entregavel` (0052): perguntar antes, em vez de embrulhar
-- num `exception when others` que engole tambem o erro que ninguem previu.
--
-- ---------------------------------------------------------------------------
-- A PASTA DE ENTREGA E OBRIGATORIA, E NAO DA PARA CONTORNAR AQUI
--
-- `tasks_exige_pasta_de_entrega` (0015) recusa demanda nova sem ela, e o
-- cabecalho daquela migration diz por que: *"quem abre a demanda esta com
-- pressa, quem procura o material esta semanas depois, e as duas pessoas
-- raramente sao a mesma"*. Nao ha excecao a abrir aqui -- uma trava com
-- excecao para o modulo que abre sessenta demandas por mes e uma trava
-- desligada.
--
-- Entao `abrir_mes_de_social()` recebe `p_link_entrega`, o dialogo passou a
-- pedir a pasta, e o botao "Criar no Drive" do Sprint 16 a cria com o nome do
-- mes. E ela e pedida **so quando a demanda do mes nasce**: abrir o mes em
-- duas vezes -- doze no Instagram hoje, quatro no LinkedIn amanha --
-- acrescenta etapas a demanda que ja existe, e trocar a pasta dela nao e
-- trabalho desta tela.
--
-- ---------------------------------------------------------------------------
-- A IDEMPOTENCIA E O INDICE UNICO, como na 0040
--
-- `(client_id, social_do_mes)` e unico. Duas abas clicando em "Abrir o mes"
-- passariam pelas duas consultas antes de qualquer uma gravar, e o resultado
-- seriam duas demandas "Social de Outubro" para o mesmo cliente -- com os
-- posts espalhados entre as duas e nenhum lugar mostrando o mes inteiro.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - A coluna que diz "esta demanda e o social de um mes"
--
-- Ela e DATE e nao texto, gravada sempre no dia 1 -- a mesma escolha de
-- `finance_entries.competencia`, e pelo mesmo motivo: guardar '2026-10' como
-- texto faria a comparacao depender do formato, e guardar o dia em que alguem
-- abriu faria "outubro" depender de quando se clicou.
--
-- Fica FORA de Insert e de Update em `database.types.ts`: quem a preenche e
-- `abrir_mes_de_social()`, e uma demanda marcada a mao como o social de um mes
-- mentiria no selo que a tela mostra -- a mesma decisao de `recurrence_id`
-- (0040).
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists social_do_mes date;

comment on column public.tasks.social_do_mes is
  'O mes de social que esta demanda agrupa, sempre no dia 1. Nulo = demanda '
  'comum. Escrito por `abrir_mes_de_social()` e por mais ninguem (0061).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_social_do_mes_dia_1') then
    alter table public.tasks
      add constraint tasks_social_do_mes_dia_1
      check (social_do_mes is null or extract(day from social_do_mes) = 1);
  end if;
end
$$;

-- UMA DEMANDA POR CLIENTE-MES. Parcial porque quase toda task tem a coluna
-- nula, e um unico sobre nulos nao restringe nada no Postgres -- mas o indice
-- inteiro carregaria todas as linhas da tabela para servir um modulo.
create unique index if not exists tasks_social_do_mes_unico
  on public.tasks (client_id, social_do_mes)
  where social_do_mes is not null;


-- ---------------------------------------------------------------------------
-- PASSO 2 - A pergunta, num lugar so
--
-- O gemeo de `subtask_eh_agrupadora()`. Quem a faz: o cronometro (para nao
-- correr) e, do lado de fora, a tela -- que precisa saber que aquela linha nao
-- e para clicar em "Concluir".
-- ---------------------------------------------------------------------------
create or replace function public.subtarefa_de_post(p_subtask_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_subtask_id is null then
    return false;
  end if;
  return exists (select 1 from public.posts p where p.subtask_id = p_subtask_id);
end;
$$;

comment on function public.subtarefa_de_post(uuid) is
  'Esta etapa e o agrupador de um post de social? Se sim: sem dono, sem prazo, '
  'relogio parado e status calculado pela corrente (0061).';


-- ---------------------------------------------------------------------------
-- PASSO 3 - O relogio nao corre na subtarefa de post
--
-- Reconstruida a partir da versao da 0022 -- a MAIS NOVA --, e a unica
-- diferenca e o `or` do bloco do fim. `create or replace function` reescreve a
-- partir do que se digita, e o que nao for copiado se perde: foi assim que a
-- 0030 perdeu o bloco de carimbos da 0007 e nenhuma subtarefa teve
-- `concluida_em` por duas migrations, sem ninguem notar, porque uma tela le a
-- coluna e o que ela devolve e um numero.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_cronometro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estava_andando boolean;
  vai_andar      boolean;
  base           integer;
  desde          timestamptz;
begin
  vai_andar := new.status = 'em_andamento';

  if tg_op = 'INSERT' then
    estava_andando := false;
    base           := 0;
    desde          := null;
  else
    estava_andando := old.status = 'em_andamento';
    base           := coalesce(old.tempo_medido_segundos, 0);
    desde          := old.andando_desde;
  end if;

  if estava_andando and not vai_andar then
    if desde is not null then
      base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
    end if;
    desde := null;
  elsif vai_andar and not estava_andando then
    desde := now();
  elsif vai_andar then
    desde := coalesce(desde, now());
  end if;

  -- A agrupadora nao tem relogio proprio. Fecha a passagem que estiver aberta
  -- -- a etapa que ganhou a primeira sub-etapa no meio do trabalho nao perde o
  -- que ja tinha medido, so para de contar daqui.
  --
  -- E A SUBTAREFA DE POST TAMBEM NAO (0061). Sem esta metade, a linha do post
  -- entraria em `em_andamento` pelo mirror da corrente e ficaria andando o mes
  -- inteiro: o detalhe da demanda mostraria "720h" numa etapa em que ninguem
  -- trabalhou, e a soma da Task cobraria em dobro o que as cinco etapas da
  -- corrente ja mediram.
  if tg_op = 'UPDATE'
     and (public.subtask_eh_agrupadora(new.id) or public.subtarefa_de_post(new.id)) then
    if desde is not null then
      base := base + greatest(0, floor(extract(epoch from (now() - desde)))::integer);
      desde := null;
    end if;
  end if;

  new.tempo_medido_segundos := base;
  new.andando_desde         := desde;

  return new;
end;
$$;

drop trigger if exists subtasks_cronometro on public.subtasks;
create trigger subtasks_cronometro
  before insert or update on public.subtasks
  for each row execute function public.subtasks_cronometro();


-- ---------------------------------------------------------------------------
-- PASSO 4 - O status da subtarefa do post sai da corrente
--
-- A precedencia e a de `recalcular_status_task()` (0030), com os mesmos nomes
-- dos dois lados -- `post_etapas.status` e `subtasks.status` sao o MESMO enum
-- desde a 0045. Os dois que pedem rodada viram `em_andamento`, que e a regra
-- da agrupadora da 0022.
--
-- A etapa "Ajustes" da 0045 entra na conta como qualquer outra: ela e trabalho
-- de verdade, criada porque o cliente pediu, e ignorá-la faria o post parecer
-- concluido com um ajuste em aberto dentro dele.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_status_da_subtarefa_do_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo       uuid;
  total      integer;
  concluidas integer;
  aguardando integer;
  andando    integer;
  atual      public.subtask_status;
  novo       public.subtask_status;
begin
  select p.subtask_id into alvo from public.posts p where p.id = p_post_id;
  if alvo is null then
    return;
  end if;

  select s.status into atual from public.subtasks s where s.id = alvo;
  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where e.status = 'concluida'),
    count(*) filter (where e.status = 'aguardando_informacoes'),
    count(*) filter (where e.status in ('em_andamento', 'enviada_aprovacao', 'em_ajustes'))
  into total, concluidas, aguardando, andando
  from public.post_etapas e
   where e.post_id = p_post_id;

  if total > 0 and concluidas = total then
    novo := 'concluida';
  elsif andando > 0 then
    novo := 'em_andamento';
  elsif aguardando > 0 then
    novo := 'aguardando_informacoes';
  elsif concluidas > 0 then
    novo := 'em_andamento';
  else
    novo := 'nao_iniciada';
  end if;

  if novo is distinct from atual then
    update public.subtasks set status = novo where id = alvo;
  end if;
end;
$$;

comment on function public.recalcular_status_da_subtarefa_do_post(uuid) is
  'O status da linha do post no board sai da corrente dele. Nunca '
  '`enviada_aprovacao` nem `em_ajustes`: os dois afirmam uma rodada da propria '
  'linha, e a fila de aprovacoes iria procurá-la (0061).';


create or replace function public.post_etapas_toca_a_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_status_da_subtarefa_do_post(old.post_id);
    return old;
  end if;

  perform public.recalcular_status_da_subtarefa_do_post(new.post_id);
  return new;
end;
$$;

-- SEM `update of status`, de proposito: a etapa de Ajustes NASCE no meio da
-- corrente (0045), e um `insert` precisa recalcular tanto quanto um `update`
-- -- um post que estava com tudo concluido volta a andar quando ela aparece.
drop trigger if exists post_etapas_toca_a_subtarefa on public.post_etapas;
create trigger post_etapas_toca_a_subtarefa
  after insert or update or delete on public.post_etapas
  for each row execute function public.post_etapas_toca_a_subtarefa();


-- ---------------------------------------------------------------------------
-- PASSO 5 - O titulo da linha acompanha o tema, e a linha some com o post
--
-- O tema nasce como "Instagram 1 de 12 · Outubro/2026" (0044) e quem pega a
-- Pauta o reescreve. Sem este trigger o board da agencia mostraria o nome
-- provisorio para sempre -- e a demanda do mes seria doze linhas com o mesmo
-- titulo de fabrica, que e a tela que a 0040 evitou no board da recorrencia.
--
-- E apagar o post apaga a linha dele: `posts.subtask_id` e
-- `on delete set null` no sentido contrario (a etapa saiu, o post fica), mas
-- deste lado nao existe chave -- sem o trigger, a demanda do mes continuaria
-- contando um post que nao existe mais, e "11 de 12" nunca fecharia.
-- ---------------------------------------------------------------------------
create or replace function public.posts_sincroniza_a_subtarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.subtask_id is not null then
      delete from public.subtasks where id = old.subtask_id;
    end if;
    return old;
  end if;

  if new.subtask_id is not null and new.tema is distinct from old.tema then
    update public.subtasks set titulo = new.tema where id = new.subtask_id;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_sincroniza_a_subtarefa on public.posts;
create trigger posts_sincroniza_a_subtarefa
  after update of tema on public.posts
  for each row execute function public.posts_sincroniza_a_subtarefa();

drop trigger if exists posts_apaga_a_subtarefa on public.posts;
create trigger posts_apaga_a_subtarefa
  after delete on public.posts
  for each row execute function public.posts_sincroniza_a_subtarefa();


-- ---------------------------------------------------------------------------
-- PASSO 6 - `abrir_mes_de_social()` abre a DEMANDA junto
--
-- Reconstruida a partir da versao da 0059 -- a MAIS NOVA --, com tres coisas a
-- mais: o parametro da pasta, a demanda do mes e a etapa por post. Tudo o que
-- a 0059 fazia continua palavra por palavra, inclusive as duas recusas de
-- prazo e a frase da 0046 que a bateria confere letra por letra.
--
-- CONTINUA SENDO UMA TRANSACAO SO, e agora ela vale mais: vinte posts, vinte
-- etapas de demanda, cem etapas de corrente e uma task. Pelo PostgREST seriam
-- cento e quarenta e uma escritas, e a que falhasse no meio deixaria um mes
-- aberto pela metade que ninguem sabe se abriu.
--
-- `security definer` CONTINUA, e a guarda de cima continua sendo a mesma
-- funcao que `tasks_insert` usa desde a 0006 -- `is_atendimento()`. Nao ha
-- porta nova: quem pode abrir o mes e exatamente quem poderia abrir a demanda
-- do mes a mao.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_mes_de_social(
  p_client_id     uuid,
  p_mes           text,
  p_quantidades   jsonb,
  p_responsavel_id uuid default null,
  p_responsaveis  jsonb default '{}'::jsonb,
  p_prazos        jsonb default '{}'::jsonb,
  p_link_entrega  text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rede      text;
  quantos   integer;
  i         integer;
  criados   integer := 0;
  total     integer := 0;
  primeiro  date;
  ultimo    date;
  empresa   text;
  novo      uuid;
  chave     text;
  valor     integer;
  anterior  integer;
  etapa     record;
  demanda   uuid;
  proxima   integer;
  etiqueta  text;
  nova_sub  uuid;
  meses     text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  -- O ATENDIMENTO ABRE O MES (0046): a mesma funcao que `tasks_insert` usa
  -- desde a 0006, e nao uma parecida.
  if not public.is_atendimento() then
    raise exception using
      errcode = 'check_violation',
      -- A FRASE E A DA 0046, PALAVRA POR PALAVRA, e a bateria pegou quando eu
      -- a reescrevi: dois cenarios conferem o texto da recusa, e uma trava que
      -- recusa com outra frase e uma trava que ninguem sabe mais se é a mesma.
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

  ultimo := (primeiro + interval '1 month' - interval '1 day')::date;

  select c.nome_empresa into empresa from public.clients c where c.id = p_client_id;
  if empresa is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Cliente não encontrado.';
  end if;

  -- OS OFFSETS SAO CONFERIDOS ANTES DE ABRIR POST NENHUM. A funcao e
  -- transacional, entao recusar no meio tambem desfaria tudo -- mas a
  -- mensagem sairia depois de sessenta inserts, e o custo de conferir cinco
  -- numeros primeiro e zero.
  for chave, valor in select key, value::integer from jsonb_each_text(p_prazos)
  loop
    if not exists (select 1 from public.etapas_padrao_do_social() e where e.nome = chave) then
      raise exception using
        errcode = 'check_violation',
        message = format('A corrente do social não tem etapa chamada "%s".', chave),
        hint    = 'As etapas são Pauta, Conteúdo, Layout, Envio e Programar.';
    end if;
    if valor < -60 or valor > 60 then
      raise exception using
        errcode = 'check_violation',
        message = format('O prazo da etapa "%s" está a %s dias da publicação.', chave, valor),
        hint    = 'O limite é 60 dias para cada lado. Fora disso é erro de digitação, não planejamento.';
    end if;
  end loop;

  -- A CORRENTE NAO PODE VENCER DE TRAS PARA A FRENTE.
  anterior := null;
  for etapa in select e.ordem, e.nome from public.etapas_padrao_do_social() e order by e.ordem
  loop
    valor := nullif(p_prazos ->> etapa.nome, '')::integer;
    if valor is not null then
      if anterior is not null and valor < anterior then
        raise exception using
          errcode = 'check_violation',
          message = format('"%s" venceria antes da etapa anterior da corrente.', etapa.nome),
          hint    = 'A ordem é Pauta, Conteúdo, Layout, Envio e Programar — os dias precisam andar na mesma direção.';
      end if;
      anterior := valor;
    end if;
  end loop;

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

  -- ------------------------------------------------------------------------
  -- A DEMANDA DO MES: achada ou criada, nunca duplicada
  --
  -- Achar antes de criar tem o mesmo furo de toda busca-antes-de-escrever, e
  -- aqui ele esta fechado: quem garante a unicidade e o indice
  -- `tasks_social_do_mes_unico`, e nao este `select`. Duas abas clicando ao
  -- mesmo tempo passam pelas duas consultas, e a segunda leva a recusa do
  -- indice em vez de abrir a demanda gemea -- e a mesma decisao de
  -- `gerar_ocorrencia()` (0040), onde a idempotencia e o indice e nunca a
  -- consulta.
  -- ------------------------------------------------------------------------
  select t.id into demanda
    from public.tasks t
   where t.client_id = p_client_id
     and t.social_do_mes = primeiro;

  if demanda is null then
    if p_link_entrega is null or btrim(p_link_entrega) = '' then
      raise exception using
        errcode = 'check_violation',
        message = 'A demanda do mês precisa da pasta de entrega.',
        -- A FRASE DIZ POR QUE, e nao so que falta: a 0015 exige a pasta de
        -- toda demanda, e quem abre o mes de social costuma nao saber que
        -- esta abrindo uma demanda.
        hint    = 'O mês de social é uma demanda só, com um post em cada etapa — e toda demanda precisa da pasta onde o material vai ficar. O botão "Criar no Drive" cria a do mês.';
    end if;

    etiqueta := format('Social · %s/%s de %s',
                       meses[extract(month from primeiro)::integer],
                       extract(year from primeiro)::integer,
                       empresa);

    -- NASCE PUBLICADA, e nao como rascunho: a tela de task abre um rascunho no
    -- clique (0028) porque a pessoa vai digitar o titulo ali dentro; aqui ela
    -- preencheu tudo antes, e rascunho e de quem o criou -- esconderia da
    -- equipe os doze posts que ela acabou de abrir. E a mesma decisao da 0051.
    insert into public.tasks (
      client_id, titulo, data_inicio, data_fim, link_entrega,
      social_do_mes, criado_por, publicada_em
    ) values (
      p_client_id, etiqueta, primeiro, ultimo, btrim(p_link_entrega),
      primeiro, (select auth.uid()), now()
    )
    returning id into demanda;
  end if;

  -- A ORDEM CONTINUA DE ONDE PAROU. Abrir o mes em duas vezes -- doze no
  -- Instagram hoje, quatro no LinkedIn amanha -- acrescenta a lista em vez de
  -- reiniciá-la em 1, que poria dois posts na mesma posicao.
  select coalesce(max(s.ordem), 0) into proxima
    from public.subtasks s where s.task_id = demanda;

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

      -- A ETAPA DO POST NA DEMANDA DO MES.
      --
      -- SEM RESPONSAVEL E SEM PRAZO, e as duas ausencias sao a decisao: o
      -- trabalho do post sao as cinco etapas da corrente, que tem cinco donos
      -- e cinco dias. Ver o cabecalho.
      proxima := proxima + 10;
      insert into public.subtasks (task_id, titulo, ordem)
      values (demanda, (select p.tema from public.posts p where p.id = novo), proxima)
      returning id into nova_sub;

      update public.posts set subtask_id = nova_sub where id = novo;

      -- DISTRIBUIR A CORRENTE CONTINUA SENDO DA GESTAO, e por isso este
      -- `update` corre dentro de uma funcao `security definer` mesmo quando
      -- quem chamou e do Atendimento.
      update public.post_etapas e
         set responsavel_id = nullif(p_responsaveis ->> (e.funcao::text), '')::uuid,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_responsaveis ->> (e.funcao::text), '') is not null;

      -- A REGRA DE DATA, gravada mesmo sem o post ter data ainda (0059).
      update public.post_etapas e
         set prazo_offset_dias = nullif(p_prazos ->> e.nome, '')::integer,
             updated_at = now()
       where e.post_id = novo
         and nullif(p_prazos ->> e.nome, '') is not null;

      criados := criados + 1;
    end loop;
  end loop;

  return criados;
end;
$fn$;

-- A ASSINATURA GANHOU UM PARAMETRO, e o Postgres trata isso como uma funcao
-- NOVA: a de seis argumentos continua existindo, e o PostgREST escolheria uma
-- das duas conforme o corpo do pedido. Duas versoes da mesma funcao e o lugar
-- onde as duas verdades comecam a divergir -- e foi este exato descuido que
-- deu ao usuario o *"Could not find the function ... in the schema cache"* do
-- Sprint 16, quando a tela passou a mandar `p_prazos` e o banco so tinha a de
-- cinco.
drop function if exists public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb);

comment on function public.abrir_mes_de_social(uuid, text, jsonb, uuid, jsonb, jsonb, text) is
  'Abre o mes de social de um cliente: UMA demanda do mes, um post por rede e '
  'quantidade, uma etapa da demanda por post e a corrente de cinco dentro de '
  'cada um. Transacional. A pasta de entrega e pedida so quando a demanda do '
  'mes nasce (0061).';
