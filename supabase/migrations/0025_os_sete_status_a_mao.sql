-- ---------------------------------------------------------------------------
-- 0025 - Os sete status da Task podem ser marcados a mao
--
-- Decisao do usuario: "todos os status devem ser possiveis de se colocar
-- manualmente". Ate aqui so `entregue` e `aguardando_informacoes` eram
-- manuais, e a tela recusava os outros cinco com a frase "os outros vem das
-- subtarefas -- mova as etapas e a Task acompanha".
--
-- TIRAR A FRASE NAO BASTARIA, e e por isso que esta migration existe. O
-- recalculo roda por trigger a cada escrita em `subtasks` e em
-- `approval_rounds`; sem mexer nele, liberar os sete na tela daria o pior dos
-- dois mundos: o clique passaria e a escolha sumiria um instante depois,
-- quando alguem mexesse numa etapa. Recusar com explicacao e ruim; aceitar e
-- desfazer calado e pior.
--
-- A REGRA NOVA, e ela e simples de dizer: **o status da Task e calculado ate
-- alguem pegar o volante.** Marcou a mao, fica -- `status_manual` passa a
-- travar o recalculo inteiro, e nao so os dois casos de antes.
--
-- E o volante SE DEVOLVE. O seletor tem "deixar o Full Hub calcular", que
-- limpa `status_manual`; o trigger `tasks_volta_a_calcular` percebe a
-- transicao e recalcula na hora, senao a Task ficaria parada no ultimo valor
-- ate a proxima mexida numa etapa -- e a pessoa concluiria que o botao nao
-- funcionou.
--
-- O QUE NAO MUDA: `tasks_entregue_exige_cada_etapa` (0023) continua de pe.
-- Marcar `entregue` a mao segue exigindo que toda etapa que pede aval tenha a
-- rodada aprovada dela. Poder escolher o status nao e poder afirmar que o
-- cliente aprovou.
--
-- E `tasks_sem_cancelada` (0020) tambem: sao sete status, e `cancelada` nao e
-- um deles.
--
-- Roda mais de uma vez sem erro.
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

  -- MARCADO A MAO E MARCADO A MAO. Antes este desvio valia so para `entregue`
  -- e `aguardando_informacoes`, e ajuste, rodada pendente ou conclusao
  -- reassumiam o controle. Agora vale para os sete e nao ha reassumir: quem
  -- marcou decide quando devolver, pelo proprio seletor.
  if manual then
    return atual;
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

comment on function public.recalcular_status_task(uuid) is
  'Calcula o status da Task pelas FOLHAS das subtarefas. Nao mexe em task marcada a mao: status_manual trava o calculo inteiro (0025).';


-- ---------------------------------------------------------------------------
-- Devolver o volante recalcula na hora
--
-- Sem isto, limpar `status_manual` deixaria a Task parada no ultimo valor ate
-- alguem mexer numa etapa -- e quem clicou em "deixar o Full Hub calcular"
-- veria o status continuar igual e concluiria que o botao nao faz nada.
--
-- AFTER, e nao BEFORE: o recalculo le as subtarefas e escreve na propria
-- tabela, e para isso a linha ja precisa estar com `status_manual = false`.
-- Nao ha recursao: a escrita que ele faz vai de `false` para `false`, e a
-- condicao de entrada e a transicao true -> false.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_volta_a_calcular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status_manual and not new.status_manual then
    perform public.recalcular_status_task(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists tasks_volta_a_calcular on public.tasks;
create trigger tasks_volta_a_calcular
  after update of status_manual on public.tasks
  for each row execute function public.tasks_volta_a_calcular();

notify pgrst, 'reload schema';
