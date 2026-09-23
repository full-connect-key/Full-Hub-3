-- ---------------------------------------------------------------------------
-- 0022 - A subtarefa dentro da subtarefa
--
-- Ate aqui eram dois niveis: a Task agrupa, a subtarefa trabalha. Uma campanha
-- com "Arte" dentro so tinha duas saidas -- ou "Arte" era uma etapa so, com um
-- responsavel e um prazo para conceito, KV e adaptacoes juntos, ou as tres
-- viravam etapas soltas no mesmo nivel e ninguem mais via que sao a mesma
-- frente de trabalho. Agora `subtasks.parent_id` da o terceiro nivel.
--
-- SAO TRES NIVEIS E NUNCA QUATRO. Um neto e recusado pelo trigger
-- `subtasks_agrupadora`, pela mesma razao que a thread das Recomendacoes tem
-- um nivel so: arvore de quatro niveis e arvore que ninguem acompanha, e o
-- recuo na tela deixa de significar alguma coisa.
--
-- A DECISAO QUE ORGANIZA TODO O RESTO: QUEM TEM FILHA VIRA AGRUPADORA.
--
-- E a mesma regra que o produto ja aplicou a Task, agora um nivel abaixo. No
-- instante em que uma etapa ganha a primeira sub-etapa, ela para de ser
-- unidade de trabalho e passa a ser o guarda-chuva delas:
--
--   * o relogio dela nao corre -- quem mede sao as sub-etapas;
--   * o status dela e CALCULADO pelas filhas, como o da Task;
--   * ela nao tem exigencia de aprovacao propria -- quem entrega e a folha;
--   * ela nao entra em dependencia, nem abre rodada de aprovacao;
--   * e a soma da Task (estimativa, tempo real, contagem de etapas) passa a
--     contar SO AS FOLHAS.
--
-- Sem essa regra, tudo passaria a contar duas vezes: a mae somaria o tempo
-- das filhas mais o proprio, a Task contaria quatro etapas onde ha tres de
-- trabalho e uma de agrupamento, e "concluidas 2 de 4" deixaria de bater com
-- o que a pessoa ve na tela.
--
-- O QUE NAO E APAGADO, e e escolha: `responsavel_id`, `prazo`,
-- `estimativa_minutos` e `tempo_real_minutos` da mae CONTINUAM gravados. Eles
-- param de contar e somem da tela enquanto ela tiver filha, e voltam se a
-- ultima for embora. Apagar seria destruir dado por causa de um clique que a
-- pessoa pode desfazer em seguida -- e quem adiciona a primeira sub-etapa
-- geralmente esta desdobrando a etapa que ja tinha dono e data, nao
-- descartando-a. A tela avisa no momento do clique, e a primeira sub-etapa
-- nasce com o responsavel e o prazo da mae ja preenchidos.
--
-- A MAE NUNCA FICA EM `enviada_aprovacao` NEM EM `em_ajustes`. Esses dois
-- status afirmam que existe uma rodada daquela subtarefa, e a fila de
-- aprovacoes vai procura-la. Uma agrupadora com filha em aprovacao fica em
-- `em_andamento`, que e verdade: o trabalho esta acontecendo dentro dela.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.subtasks
  add column if not exists parent_id uuid references public.subtasks (id) on delete cascade;

comment on column public.subtasks.parent_id is
  'A etapa de cima. Null = etapa da Task. Preenchido = sub-etapa. Nunca um terceiro nivel.';

-- O indice e para a pergunta que passa a ser feita em toda leitura de task:
-- "esta subtarefa tem filha?".
create index if not exists subtasks_parent_idx on public.subtasks (parent_id);


-- ---------------------------------------------------------------------------
-- Quem tem filha e agrupadora
--
-- Uma funcao so, chamada por todo o resto, para nenhum modulo reescrever a
-- consulta -- e para "e agrupadora" nunca ter duas definicoes.
-- ---------------------------------------------------------------------------
create or replace function public.subtask_eh_agrupadora(p_subtask_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (select 1 from public.subtasks f where f.parent_id = p_subtask_id);
end;
$$;


-- ---------------------------------------------------------------------------
-- O status da agrupadora, calculado
--
-- Mesma precedencia do status da Task, menos os dois que afirmam rodada
-- propria: filha em aprovacao ou em ajustes deixa a mae em `em_andamento`.
-- ---------------------------------------------------------------------------
create or replace function public.status_calculado_da_subtarefa(p_subtask_id uuid)
returns public.subtask_status
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  total      integer;
  concluidas integer;
  andando    integer;
  esperando  integer;
begin
  select
    count(*),
    count(*) filter (where f.status = 'concluida'),
    count(*) filter (where f.status in ('em_andamento', 'enviada_aprovacao', 'em_ajustes')),
    count(*) filter (where f.status = 'aguardando_informacoes')
  into total, concluidas, andando, esperando
  from public.subtasks f where f.parent_id = p_subtask_id;

  -- Sem filha nao ha o que calcular: a subtarefa e folha, e o status e dela.
  if total = 0 then
    return (select s.status from public.subtasks s where s.id = p_subtask_id);
  end if;

  if concluidas = total then
    return 'concluida';
  elsif andando > 0 then
    return 'em_andamento';
  elsif esperando > 0 then
    return 'aguardando_informacoes';
  elsif concluidas > 0 then
    return 'em_andamento';
  else
    return 'nao_iniciada';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- O trigger da agrupadora
--
-- Roda ANTES dos outros tres `before` de subtasks -- o Postgres dispara em
-- ordem alfabetica, e `agrupadora` vem antes de `bloqueia...`, `cronometro` e
-- `updated_at`. E preciso: ele corrige `new.status` da agrupadora antes de
-- `validar_transicao_de_subtarefa` julgar a transicao, e antes de o cronometro
-- decidir se abre uma passagem.
-- ---------------------------------------------------------------------------
create or replace function public.subtasks_agrupadora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mae_task     uuid;
  mae_parent   uuid;
  mae_titulo   text;
  mae_aprova   boolean;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception using
        errcode = 'check_violation',
        message = format('A subtarefa "%s" não pode ser sub-etapa dela mesma.', new.titulo);
    end if;

    select s.task_id, s.parent_id, s.titulo, s.requer_aprovacao
      into mae_task, mae_parent, mae_titulo, mae_aprova
      from public.subtasks s where s.id = new.parent_id;

    if not found then
      raise exception using
        errcode = 'foreign_key_violation',
        message = 'A etapa de cima não existe.';
    end if;

    -- Sub-etapa em outra demanda seria uma etapa que aparece numa task e
    -- conta na soma de outra.
    if mae_task <> new.task_id then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" é de outra demanda.', mae_titulo),
        hint    = 'A sub-etapa mora dentro da mesma Task da etapa de cima.';
    end if;

    -- TRES NIVEIS, NUNCA QUATRO.
    if mae_parent is not null then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" já é uma sub-etapa, e sub-etapa não recebe sub-etapa.',
                         mae_titulo),
        hint    = 'São três níveis: a demanda, a etapa e a sub-etapa. Crie a sub-etapa na etapa de cima.';
    end if;

    -- Quem ja tem filha nao pode virar filha: seria o quarto nivel pelo outro
    -- lado.
    if public.subtask_eh_agrupadora(new.id) then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" já tem sub-etapas e não pode virar sub-etapa de outra.',
                         new.titulo),
        hint    = 'Mova ou apague as sub-etapas dela primeiro.';
    end if;

    -- A mae vai virar agrupadora, e agrupadora nao espera nem entrega: as
    -- duas frases sao sobre unidade de trabalho. Deixar passar travaria a
    -- etapa para sempre -- o status dela passa a ser calculado, e o calculo
    -- bateria na trava de dependencia a cada mexida de filha.
    if exists (select 1 from public.subtask_dependencies d where d.subtask_id = new.parent_id) then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" espera outra etapa e por isso não pode virar agrupadora.',
                         mae_titulo),
        hint    = 'Tire a dependência da etapa e marque-a nas sub-etapas, que são quem espera.';
    end if;

    if mae_aprova then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" exige aprovação e por isso não pode virar agrupadora.',
                         mae_titulo),
        hint    = 'Tire a exigência de aprovação da etapa e marque-a nas sub-etapas, que são quem entrega.';
    end if;
  end if;

  if tg_op = 'UPDATE' and public.subtask_eh_agrupadora(new.id) then
    -- Exigencia de aprovacao na agrupadora nao tem como ser cumprida: a
    -- conclusao dela vem das filhas, e o trigger da aprovacao recusaria.
    if new.requer_aprovacao then
      raise exception using
        errcode = 'check_violation',
        message = format('A etapa "%s" tem sub-etapas, e quem exige aprovação é quem entrega.',
                         new.titulo),
        hint    = 'Marque a exigência nas sub-etapas.';
    end if;

    -- O STATUS DA AGRUPADORA E CALCULADO, e o que vier no pedido e descartado
    -- -- como as duas colunas do cronometro. Sem isto um PATCH no PostgREST
    -- diria que a etapa esta concluida com tres sub-etapas em aberto.
    new.status := public.status_calculado_da_subtarefa(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists subtasks_agrupadora on public.subtasks;
create trigger subtasks_agrupadora
  before insert or update on public.subtasks
  for each row execute function public.subtasks_agrupadora();


-- ---------------------------------------------------------------------------
-- O que acontece na mae quando a filha se mexe
-- ---------------------------------------------------------------------------
-- Recalcula UMA mae, se ela existir. Null nao faz nada: quem chama e um
-- trigger que roda para toda subtarefa, e a maioria e etapa de primeiro nivel.
create or replace function public.tocar_status_da_mae(p_mae uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  novo  public.subtask_status;
  atual public.subtask_status;
begin
  if p_mae is null then
    return;
  end if;

  select s.status into atual from public.subtasks s where s.id = p_mae;
  if not found then
    return;
  end if;

  novo := public.status_calculado_da_subtarefa(p_mae);
  if novo is distinct from atual then
    update public.subtasks set status = novo where id = p_mae;
  end if;
end;
$$;

create or replace function public.recalcular_status_da_mae()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mae_antiga uuid;
  mae_nova   uuid;
begin
  -- OLD nao existe no INSERT e NEW nao existe no DELETE, e ler o campo errado
  -- estoura antes de qualquer `case` decidir. Por isso os dois `if`.
  if tg_op <> 'INSERT' then mae_antiga := old.parent_id; end if;
  if tg_op <> 'DELETE' then mae_nova   := new.parent_id; end if;

  -- Um update pode ter MUDADO a sub-etapa de etapa: as duas recalculam.
  perform public.tocar_status_da_mae(mae_antiga);
  if mae_nova is distinct from mae_antiga then
    perform public.tocar_status_da_mae(mae_nova);
  end if;

  return null;
end;
$$;

drop trigger if exists subtasks_recalcula_mae on public.subtasks;
create trigger subtasks_recalcula_mae
  after insert or update or delete on public.subtasks
  for each row execute function public.recalcular_status_da_mae();


-- ---------------------------------------------------------------------------
-- O cronometro nao corre na agrupadora
--
-- Substitui a versao da 0021. A unica diferenca e o bloco do fim: quem tem
-- filha nao abre passagem, porque quem mede sao elas -- e somar os dois
-- contaria o mesmo trabalho duas vezes no relatorio de rentabilidade.
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
  if tg_op = 'UPDATE' and public.subtask_eh_agrupadora(new.id) then
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


-- ---------------------------------------------------------------------------
-- Os segundos de uma linha: o que ja foi fechado mais a passagem em curso.
-- Uma funcao so porque a conta aparece em tres consultas, e tres copias
-- divergem no dia em que uma delas for ajustada.
-- ---------------------------------------------------------------------------
create or replace function public.segundos_medidos(p_fechados integer, p_desde timestamptz)
returns integer
language plpgsql
stable
as $$
begin
  return coalesce(p_fechados, 0)
       + case when p_desde is null then 0
              else greatest(0, floor(extract(epoch from (now() - p_desde)))::integer)
         end;
end;
$$;


-- ---------------------------------------------------------------------------
-- O tempo medido da agrupadora e a soma das filhas
-- ---------------------------------------------------------------------------
create or replace function public.tempo_medido_da_subtarefa(p_subtask_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  segundos integer;
begin
  -- Subtarefa que nao existe devolve NULL, e nao zero -- como no Financeiro,
  -- zero e uma afirmacao sobre a conta e o que se quer dizer e que nao ha
  -- conta nenhuma.
  if not exists (select 1 from public.subtasks s where s.id = p_subtask_id) then
    return null;
  end if;

  if public.subtask_eh_agrupadora(p_subtask_id) then
    select coalesce(sum(public.segundos_medidos(f.tempo_medido_segundos, f.andando_desde)), 0)
      into segundos
      from public.subtasks f where f.parent_id = p_subtask_id;
  else
    select public.segundos_medidos(f.tempo_medido_segundos, f.andando_desde)
      into segundos
      from public.subtasks f where f.id = p_subtask_id;
  end if;

  return round(coalesce(segundos, 0) / 60.0)::integer;
end;
$$;



-- ---------------------------------------------------------------------------
-- A soma da Task conta SO AS FOLHAS
--
-- Substitui a versao da 0007. A agrupadora nao entra na conta: senao uma task
-- com "Arte" e tres sub-etapas contaria quatro etapas, e "3 de 4 concluidas"
-- ficaria parada para sempre esperando a mae, que so conclui quando as tres
-- concluem.
--
-- A linha de `cancelada` some junto: a 0020 aposentou o valor, e o trigger
-- `tasks_sem_cancelada` ja recusa qualquer escrita com ele.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_status_task(p_task_id uuid)
returns public.task_status
language plpgsql
security definer
set search_path = public
as $$
declare
  total             integer;
  concluidas        integer;
  em_ajustes        integer;
  aguardando        integer;
  andando           integer;
  rodadas_pendentes integer;
  atual             public.task_status;
  manual            boolean;
  novo              public.task_status;
begin
  select t.status, t.status_manual into atual, manual
    from public.tasks t where t.id = p_task_id;

  if not found then
    return null;
  end if;

  select
    count(*),
    count(*) filter (where s.status = 'concluida'),
    count(*) filter (where s.status = 'em_ajustes'),
    count(*) filter (where s.status = 'aguardando_informacoes'),
    count(*) filter (where s.status in ('em_andamento', 'enviada_aprovacao'))
  into total, concluidas, em_ajustes, aguardando, andando
  from public.subtasks s
   where s.task_id = p_task_id
     and not exists (select 1 from public.subtasks f where f.parent_id = s.id);

  select count(*) into rodadas_pendentes
    from public.approval_rounds r
    join public.subtasks s on s.id = r.subtask_id
   where s.task_id = p_task_id and r.status = 'pendente';

  if em_ajustes > 0 then
    novo := 'em_ajustes';
  elsif rodadas_pendentes > 0 then
    novo := 'em_aprovacao';
  elsif total > 0 and concluidas = total then
    novo := 'concluido';
  elsif aguardando > 0 and andando = 0 then
    novo := 'aguardando_informacoes';
  elsif andando > 0 or concluidas > 0 then
    novo := 'em_andamento';
  else
    novo := 'nao_iniciada';
  end if;

  if manual and atual in ('entregue', 'aguardando_informacoes') then
    if novo in ('em_ajustes', 'em_aprovacao', 'concluido') then
      update public.tasks
         set status = novo, status_manual = false,
             concluida_em = case when novo = 'concluido' then now() else null end
       where id = p_task_id;
      return novo;
    end if;
    return atual;
  end if;

  if novo is distinct from atual then
    update public.tasks
       set status = novo,
           status_manual = false,
           concluida_em = case when novo = 'concluido' then coalesce(concluida_em, now()) end
     where id = p_task_id;
  end if;

  return novo;
end;
$$;


-- ---------------------------------------------------------------------------
-- Agrupadora nao entra em dependencia e nao abre rodada
--
-- As duas sao afirmacoes sobre uma unidade de trabalho. "Espere a Arte
-- terminar" e uma frase sobre as folhas; "esta arte precisa de aval" tambem.
-- ---------------------------------------------------------------------------
create or replace function public.recusar_dependencia_de_agrupadora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  if public.subtask_eh_agrupadora(new.subtask_id) then
    select titulo into nome from public.subtasks where id = new.subtask_id;
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" tem sub-etapas e não depende de ninguém por si só.', nome),
      hint    = 'A espera é de cada sub-etapa. Marque a dependência dentro dela.';
  end if;

  if public.subtask_eh_agrupadora(new.depende_de_id) then
    select titulo into nome from public.subtasks where id = new.depende_de_id;
    raise exception using
      errcode = 'check_violation',
      message = format('Não dá para esperar a etapa "%s": ela agrupa sub-etapas.', nome),
      hint    = 'Escolha a sub-etapa que precisa terminar antes.';
  end if;

  return new;
end;
$$;

drop trigger if exists subtask_dependencies_sem_agrupadora on public.subtask_dependencies;
create trigger subtask_dependencies_sem_agrupadora
  before insert or update on public.subtask_dependencies
  for each row execute function public.recusar_dependencia_de_agrupadora();


create or replace function public.recusar_rodada_de_agrupadora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text;
begin
  if public.subtask_eh_agrupadora(new.subtask_id) then
    select titulo into nome from public.subtasks where id = new.subtask_id;
    raise exception using
      errcode = 'check_violation',
      message = format('A etapa "%s" agrupa sub-etapas e não é ela que vai para aprovação.', nome),
      hint    = 'Quem entrega é a sub-etapa. Envie a sub-etapa para aprovação.';
  end if;

  return new;
end;
$$;

drop trigger if exists approval_rounds_sem_agrupadora on public.approval_rounds;
create trigger approval_rounds_sem_agrupadora
  before insert on public.approval_rounds
  for each row execute function public.recusar_rodada_de_agrupadora();


-- ---------------------------------------------------------------------------
-- As linhas que ja existiam continuam validas: `parent_id` nasce nulo, e
-- subtarefa sem filha e folha. Nada a migrar.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
