-- ---------------------------------------------------------------------------
-- 0028 - A task nasce como RASCUNHO, na tela inteira
--
-- Pedido do usuario (Ajustes 02). Hoje "+ Nova Task" abre um formulario
-- reduzido, e briefing, subtarefas, referencias e pasta de entrega so
-- aparecem depois de salvar. Isso inverte o trabalho real: quem abre uma
-- demanda e o Atendimento montando o briefing inteiro de uma vez.
--
-- A partir daqui "+ Nova Task" CRIA a task no banco na hora e abre a tela de
-- detalhe de verdade. Subtarefa, referencia e comentario precisam de um
-- `task_id` para existir; sem a linha no banco, a tela de criacao teria que
-- guardar tudo em memoria e reimplementar cada comportamento -- e nunca
-- ficaria identica a de edicao, que e justamente o que se quer.
--
-- RASCUNHO E `publicada_em is null`, E NAO UM VALOR DE ENUM. O pedido trazia
-- `alter type task_status add value 'rascunho'`. Nao foi por ai, por tres
-- razoes, e a troca e reversivel:
--
--   1. `alter type ... add value` nao pode ter o valor USADO na mesma
--      transacao, e o SQL Editor do Supabase roda o arquivo colado como uma
--      transacao so. A migration falharia na hora de aplicar -- que e
--      exatamente onde ninguem quer descobrir isso.
--   2. `rascunho` nao e um estado do trabalho, e um estado do ciclo de vida.
--      Como enum ele entraria no seletor dos sete status, viraria coluna no
--      board, e `recalcular_status_task()` teria que abrir excecao para ele
--      em todo calculo.
--   3. `publicada_em` ja estava no pedido, e ela responde as duas perguntas
--      de uma vez: "e rascunho?" e "desde quando existe para a equipe?".
--
-- CLIENTE PASSA A ACEITAR NULO. O rascunho nasce sem cliente -- a pessoa
-- escolhe na tela --, e a trava passa a ser na PUBLICACAO. Enquanto era
-- `not null`, criar o rascunho exigiria escolher um cliente antes de a tela
-- abrir, que e a etapa a mais que este sprint existe para eliminar.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

-- O DEFAULT E "PUBLICADA", e a direcao importa. Quem quer rascunho diz
-- `publicada_em: null` explicitamente; todo o resto -- seed, bateria, a
-- proxima action que alguem escrever -- continua criando demanda visivel.
--
-- E o erro seguro dos dois: esquecer o campo publica uma demanda que alguem
-- ia publicar de qualquer jeito. O contrario -- default nulo -- faria
-- qualquer insert distraido criar uma task que some para a equipe inteira,
-- e ninguem descobre uma coisa que nao aparece.
-- A COLUNA E O PREENCHIMENTO ANDAM JUNTOS, e o `if` em volta e o que faz
-- esta migration poder rodar de novo. Com `add column if not exists` seguido
-- de `update ... where publicada_em is null`, a segunda execucao publicaria
-- todos os rascunhos que existissem naquele momento -- e a trava da
-- publicacao recusaria o lote inteiro no primeiro sem cliente. Foi assim que
-- a primeira versao falhou na segunda rodada.
--
-- Dentro do `if`, o preenchimento acontece UMA vez: quando a coluna nasce.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tasks' and column_name = 'publicada_em'
  ) then
    alter table public.tasks add column publicada_em timestamptz default now();

    -- Tudo que ja existia esta publicado. Datar em `created_at` e o unico
    -- valor verdadeiro que ha: elas nasceram visiveis para todo mundo.
    update public.tasks set publicada_em = created_at;
  end if;
end
$$;

comment on column public.tasks.publicada_em is
  'Quando a demanda passou a existir para a equipe. NULO = rascunho: so quem criou enxerga, e nada dela conta em lista, contador, notificacao ou portal.';

alter table public.tasks alter column client_id drop not null;

create index if not exists tasks_rascunho_idx
  on public.tasks (criado_por) where publicada_em is null;


-- ---------------------------------------------------------------------------
-- "Este rascunho e de outra pessoa?"
--
-- Uma funcao so, chamada por toda policy do modulo de tasks. `security
-- definer` porque ela precisa ler `tasks` sem passar pela policy que ela
-- mesma ajuda a montar.
-- ---------------------------------------------------------------------------
create or replace function public.rascunho_alheio(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.tasks t
     where t.id = p_task_id
       and t.publicada_em is null
       and t.criado_por is distinct from (select auth.uid())
  );
end;
$$;

comment on function public.rascunho_alheio(uuid) is
  'Verdadeiro quando a task e um rascunho de outra pessoa. E a pergunta que todas as policies do modulo fazem para o rascunho nao vazar nem pela API.';


-- ---------------------------------------------------------------------------
-- As policies: uma regra RESTRITIVA por tabela
--
-- O rascunho tem que sumir na RLS, e nao so no filtro da tela: o criterio do
-- sprint e "nem na lista, nem por URL direta, nem pela API".
--
-- E `restrictive`, e nao mais uma policy permissiva ao lado das outras. A
-- diferenca nao e estilo:
--
--   * policy permissiva e OR. Acrescentar uma que esconde rascunho ao lado de
--     uma que mostra tudo nao esconde nada -- basta a outra dizer sim.
--   * `task_referencias_write` e `for all`, com USING proprio. Um DELETE passa
--     por ELA, nao pela policy de SELECT. Foi assim que a primeira versao
--     desta migration deixou o desenvolvedor apagar a referencia de um
--     rascunho que ele nao conseguia nem enxergar -- e quem mostrou foi a
--     bateria.
--
-- Restritiva e AND com tudo o que ja existe, em todos os comandos. E uma
-- linha por tabela, e a regra fica escrita UMA vez: nada que pertenca a um
-- rascunho de outra pessoa.
-- ---------------------------------------------------------------------------

-- Na propria `tasks` a condicao sai das colunas da linha, sem consultar nada:
-- no INSERT a linha ainda nao esta visivel para uma subconsulta, e uma regra
-- que depende disso passaria por acidente.
drop policy if exists tasks_sem_rascunho_alheio on public.tasks;
create policy tasks_sem_rascunho_alheio on public.tasks
  as restrictive for all to authenticated
  using (publicada_em is not null or criado_por = (select auth.uid()))
  with check (publicada_em is not null or criado_por = (select auth.uid()));

do $$
declare
  tabela text;
begin
  foreach tabela in array array['subtasks', 'task_referencias', 'task_comentarios',
                                'task_history']
  loop
    execute format('drop policy if exists %I_sem_rascunho_alheio on public.%I', tabela, tabela);
    execute format($sql$
      create policy %I_sem_rascunho_alheio on public.%I
        as restrictive for all to authenticated
        using (not public.rascunho_alheio(task_id))
        with check (not public.rascunho_alheio(task_id))
    $sql$, tabela, tabela);
  end loop;
end
$$;

-- As tabelas que nao tem `task_id` chegam na task pela subtarefa.
do $$
declare
  tabela text;
begin
  foreach tabela in array array['approval_rounds', 'subtask_entregas', 'subtask_dependencies']
  loop
    execute format('drop policy if exists %I_sem_rascunho_alheio on public.%I', tabela, tabela);
    execute format($sql$
      create policy %I_sem_rascunho_alheio on public.%I
        as restrictive for all to authenticated
        using (not exists (select 1 from public.subtasks s
                            where s.id = subtask_id and public.rascunho_alheio(s.task_id)))
        with check (not exists (select 1 from public.subtasks s
                                 where s.id = subtask_id and public.rascunho_alheio(s.task_id)))
    $sql$, tabela, tabela);
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- O QUE A PUBLICACAO EXIGE: titulo, cliente e pasta de entrega
--
-- Sao os tres sem os quais a demanda nao diz o que e, de quem e, nem onde o
-- material vai parar. A 0015 cobrava a pasta no INSERT, e com razao -- o
-- campo vira aquele que ninguem preenche. Mas o rascunho nasce vazio por
-- definicao, e cobrar no insert impediria o rascunho de existir.
--
-- A regra nao afrouxou, mudou de porta: nenhuma demanda passa a existir para
-- a equipe sem os tres. Vale para o insert que ja nasce publicado e para o
-- update que publica o rascunho -- sao os dois caminhos, e os dois passam
-- por aqui.
--
-- SUBTAREFA NAO ENTRA. O sprint e explicito: publicar sem etapa AVISA e deixa
-- seguir. Uma demanda pode nascer antes de alguem saber como ela se divide.
--
-- E a mensagem da pasta e a MESMA da 0015, palavra por palavra: quem ja
-- conhecia a recusa nao precisa aprender outra frase para o mesmo "nao".
-- ---------------------------------------------------------------------------
create or replace function public.tasks_publicar_exige_minimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.publicada_em is null then
    return new;
  end if;

  -- No update, so a TRANSICAO para publicada e cobrada. Corrigir o titulo de
  -- uma demanda ja publicada nao passa por aqui de novo.
  if tg_op = 'UPDATE' and old.publicada_em is not null then
    return new;
  end if;

  if new.titulo is null or btrim(new.titulo) = '' then
    raise exception using
      errcode = 'check_violation',
      message = 'A demanda precisa de um título para existir para a equipe.',
      hint    = 'O rascunho continua salvo — é só dar um nome a ele.';
  end if;

  if new.client_id is null then
    raise exception using
      errcode = 'check_violation',
      message = 'Escolha o cliente antes de criar a demanda.',
      hint    = 'O rascunho continua salvo. Sem cliente, ela não aparece para ninguém da conta.';
  end if;

  if new.link_entrega is null or btrim(new.link_entrega) = '' then
    raise exception using
      errcode = 'check_violation',
      message = 'Toda demanda precisa da pasta de entrega: onde o material final vai ficar.',
      hint    = 'Cole o endereço da pasta no Figma, no Drive ou onde o material for ficar. Começa com http:// ou https://.';
  end if;

  return new;
end
$$;

drop trigger if exists tasks_publicar_exige_minimo on public.tasks;
create trigger tasks_publicar_exige_minimo
  before insert or update of publicada_em on public.tasks
  for each row execute function public.tasks_publicar_exige_minimo();


-- ---------------------------------------------------------------------------
-- E a pasta de quem ja tem continua sem se apagar
--
-- Esta funcao PERDEU a cobranca do insert -- ela agora mora na de cima, junto
-- com as outras duas exigencias da publicacao. Sobrou a regra que so ela
-- sabe fazer: apagar o endereco de uma demanda em andamento deixa o material
-- sem paradeiro conhecido, e e o tipo de perda que so aparece quando alguem
-- vai procurar.
--
-- Duas travas dizendo "precisa da pasta" seriam duas verdades esperando
-- divergir no dia em que alguem ajustasse uma delas.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_exige_pasta_de_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.link_entrega is not null
     and (new.link_entrega is null or btrim(new.link_entrega) = '') then
    raise exception using
      errcode = 'check_violation',
      message = 'A pasta de entrega não se apaga.',
      hint    = 'Dá para trocar por outro endereço, mas não para deixar a demanda sem paradeiro do material.';
  end if;

  return new;
end
$$;

comment on function public.tasks_exige_pasta_de_entrega() is
  'A pasta de quem ja tem nao se apaga. A cobranca na criacao mudou para tasks_publicar_exige_minimo na 0028.';


-- ---------------------------------------------------------------------------
-- O PERIODO DA TASK PASSA A SER DERIVADO DAS ETAPAS
--
-- Pedido do sprint: "Periodo -- somente leitura, calculado pelas subtarefas".
-- Ele era dois campos de data editaveis, e isso criava duas verdades sobre a
-- mesma demanda -- a que a pessoa digitou no topo e a que as etapas dizem.
--
-- As colunas CONTINUAM existindo e passam a ser escritas por trigger, como o
-- status. Poderiam ser apagadas e calculadas na leitura; ficam porque
-- calendario, filtro de periodo e indice leem `data_inicio`/`data_fim`
-- direto, e trocar tudo isso por um calculo em toda consulta seria pagar caro
-- para guardar de menos.
--
-- Conta so as FOLHAS, como todo o resto: a agrupadora nao e unidade de
-- trabalho, e o periodo dela e o das filhas.
--
-- Sem nenhuma etapa com data, `data_fim` fica nula e `data_inicio` fica como
-- estava -- a tela mostra "Definido pelas subtarefas" em vez de inventar um
-- intervalo.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_periodo_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio date;
  fim    date;
  atual  record;
begin
  select min(least(coalesce(s.data_inicio, s.prazo), coalesce(s.prazo, s.data_inicio))),
         max(greatest(coalesce(s.prazo, s.data_inicio), coalesce(s.data_inicio, s.prazo)))
    into inicio, fim
    from public.subtasks s
   where s.task_id = p_task_id
     and not exists (select 1 from public.subtasks f where f.parent_id = s.id);

  select t.data_inicio, t.data_fim into atual from public.tasks t where t.id = p_task_id;
  if not found then
    return;
  end if;

  if inicio is null then
    -- Nenhuma etapa tem data. `data_inicio` e `not null`, entao fica como
    -- esta; `data_fim` volta a ser nula para a tela nao mostrar uma ponta
    -- final que ninguem combinou.
    if atual.data_fim is not null then
      update public.tasks set data_fim = null where id = p_task_id;
    end if;
    return;
  end if;

  if atual.data_inicio is distinct from inicio or atual.data_fim is distinct from fim then
    update public.tasks set data_inicio = inicio, data_fim = fim where id = p_task_id;
  end if;
end;
$$;

create or replace function public.subtasks_recalcula_periodo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_periodo_task(old.task_id);
  else
    perform public.recalcular_periodo_task(new.task_id);
  end if;
  return null;
end;
$$;

drop trigger if exists subtasks_recalcula_periodo on public.subtasks;
create trigger subtasks_recalcula_periodo
  after insert or update or delete on public.subtasks
  for each row execute function public.subtasks_recalcula_periodo();


-- ---------------------------------------------------------------------------
-- Rascunho abandonado se apaga sozinho
--
-- Sete dias sem alteracao. Nao e limpeza de disco: e a lista de rascunhos
-- continuar sendo uma lista de trabalho em curso. Cinco rascunhos vazios de
-- meses atras fazem a pessoa parar de abrir o grupo, e o unico que importava
-- se perde junto.
--
-- NAO RODA SOZINHA. Nao existe `pg_cron` garantido aqui, e uma rotina que
-- apaga sem ninguem ter mandado e o tipo de coisa que se descobre pelo
-- prejuizo. Quem agenda e o Sprint 16, junto com as outras; ate la, chamar a
-- funcao e um ato de alguem.
--
-- O AVISO VEM ANTES: `rascunhos_a_expirar()` devolve os que estao no sexto
-- dia, e e ela que a Home consulta. Apagar sem avisar seria apagar de surpresa.
-- ---------------------------------------------------------------------------
create or replace function public.limpar_rascunhos_abandonados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  quantos integer;
begin
  with apagados as (
    delete from public.tasks
     where publicada_em is null
       and updated_at < now() - interval '7 days'
    returning 1
  )
  select count(*) into quantos from apagados;

  return quantos;
end;
$$;

comment on function public.limpar_rascunhos_abandonados() is
  'Apaga rascunhos sem alteracao ha mais de 7 dias. NAO roda sozinha: o agendamento e do Sprint 16.';

create or replace function public.rascunhos_a_expirar()
returns table (id uuid, titulo text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select t.id, t.titulo, t.updated_at
      from public.tasks t
     where t.publicada_em is null
       and t.criado_por = (select auth.uid())
       and t.updated_at < now() - interval '6 days'
     order by t.updated_at;
end;
$$;

comment on function public.rascunhos_a_expirar() is
  'Os rascunhos DE QUEM ESTA LOGADO que somem amanha. E o aviso que a Home mostra no sexto dia.';

notify pgrst, 'reload schema';
