-- =========================================================================
-- 0014 — A exigência de aprovação da demanda, e o link de entrega
--
-- Duas colunas em `tasks`, vindas do formulário de abertura de demanda.
--
-- POR QUE UMA EXIGÊNCIA NO NÍVEL DA TASK, SE A APROVAÇÃO É DA SUBTAREFA
--
--   A subtarefa continua sendo quem tem `requer_aprovacao` e `tipo_aprovacao`
--   — isso não muda. O que faltava era dizer, na abertura, o que a DEMANDA
--   inteira precisa antes de ser dada por entregue. São perguntas diferentes:
--   "esta arte precisa de aval?" é da etapa; "esta campanha pode sair sem o
--   cliente ter visto?" é do job.
--
--   Sem isso, a regra morava só na cabeça de quem abriu a demanda, e o "marcar
--   entregue" aceitava qualquer coisa.
--
-- POR QUE TRÊS VALORES E NÃO QUATRO
--
--   Porque `cliente` JÁ passa pela interna: "toda aprovação abre primeiro uma
--   rodada interna, mesmo quando o tipo é cliente" (0007). Um quarto valor
--   "dupla" seria um segundo botão com o mesmo efeito do terceiro, e dois
--   jeitos de dizer a mesma coisa é como se criam duas verdades.
--
-- POR QUE A TRAVA MORA AQUI, E NÃO NA TELA
--
--   Mesma razão de `subtasks_bloqueia_conclusao_sem_aprovacao`: a tela escreve
--   a mensagem que a pessoa lê, o banco é o que vale. Quem chamar o PostgREST
--   direto encontra a mesma recusa.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. O enum
-- -------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exigencia_aprovacao') then
    create type public.exigencia_aprovacao as enum ('nenhuma', 'interna', 'cliente');
  end if;
end
$$;

comment on type public.exigencia_aprovacao is
  'O que a demanda inteira precisa antes de virar "entregue". `cliente` inclui a interna, porque toda rodada de cliente nasce depois de uma interna aprovada.';

-- -------------------------------------------------------------------------
-- 2. As colunas
-- -------------------------------------------------------------------------

alter table public.tasks
  add column if not exists exigencia_aprovacao public.exigencia_aprovacao not null default 'nenhuma';

alter table public.tasks
  add column if not exists link_entrega text;

comment on column public.tasks.exigencia_aprovacao is
  'Aprovação que a demanda exige para ser encerrada. Travada por tasks_exige_aprovacao_para_entregue.';

comment on column public.tasks.link_entrega is
  'Pasta ou arquivo onde o material final vive (Figma, Drive, pasta compartilhada). Um endereço só, separado das referências de apoio: o que se procura depois de pronto é este.';

-- Endereço tem que ser endereço. Sem isto, um "ver com a Ana" digitado no
-- campo vira um link quebrado na tela de quem for buscar o material.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_link_entrega_http'
  ) then
    alter table public.tasks
      add constraint tasks_link_entrega_http
      check (link_entrega is null or link_entrega ~* '^https?://\S+$');
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- 3. A trava do encerramento
--
-- `entregue` é um dos dois status manuais (o outro é `cancelada`). Marcá-lo
-- diz "o material saiu" — e agora, quando a demanda exige aprovação, só sai
-- depois que ela veio.
--
-- O que conta como aprovação dada: uma rodada APROVADA, no escopo exigido,
-- em qualquer subtarefa desta task. É o registro que já existe e que ninguém
-- reescreve (rodada fechada nunca é sobrescrita), então é ele que responde.
--
-- A mensagem diz o que falta E como resolver. Uma recusa que só diz "não
-- pode" manda a pessoa adivinhar, e neste caso a saída não é óbvia: pode ser
-- que nenhuma subtarefa peça a aprovação que a task exige.
-- -------------------------------------------------------------------------

create or replace function public.tasks_exige_aprovacao_para_entregue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aprovadas integer;
  pedem     integer;
  -- NAO chamar de `escopo`: colide com approval_rounds.escopo no where
  -- abaixo, e o Postgres recusa a consulta por ambiguidade.
  exigido   public.escopo_rodada;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status <> 'entregue' then
    return new;
  end if;
  if new.exigencia_aprovacao = 'nenhuma' then
    return new;
  end if;

  exigido := new.exigencia_aprovacao::text::public.escopo_rodada;

  select count(*) into aprovadas
    from public.approval_rounds r
    join public.subtasks s on s.id = r.subtask_id
   where s.task_id = new.id
     and r.escopo = exigido
     and r.status = 'aprovada';

  if aprovadas > 0 then
    return new;
  end if;

  -- Nenhuma aprovação daquele escopo. A saída depende de existir subtarefa
  -- pedindo: se não existe, o caminho é marcar a etapa que precisa de aval,
  -- e não "aprovar mais rápido".
  select count(*) into pedem
    from public.subtasks s
   where s.task_id = new.id
     and s.requer_aprovacao
     and s.tipo_aprovacao::text = new.exigencia_aprovacao::text;

  if pedem = 0 then
    raise exception using
      errcode = 'check_violation',
      message = format('Esta demanda exige aprovação %s, e nenhuma subtarefa dela pede essa aprovação.',
                       case new.exigencia_aprovacao when 'interna' then 'interna' else 'do cliente' end),
      hint    = 'Marque a etapa que precisa de aval, ou troque a exigência da task. Aprovar mais rápido não resolve: não há o que aprovar.';
  end if;

  raise exception using
    errcode = 'check_violation',
    message = format('Esta demanda exige aprovação %s para ser entregue, e ainda não há nenhuma rodada aprovada.',
                     case new.exigencia_aprovacao when 'interna' then 'interna' else 'do cliente' end),
    hint    = '"Entregue" diz que o material saiu. A aprovação que falta é o que autoriza dizer isso.';
end
$$;

drop trigger if exists tasks_exige_aprovacao_para_entregue on public.tasks;
create trigger tasks_exige_aprovacao_para_entregue
  before update on public.tasks
  for each row
  execute function public.tasks_exige_aprovacao_para_entregue();

comment on function public.tasks_exige_aprovacao_para_entregue() is
  'Recusa "entregue" enquanto a aprovação exigida pela task não tiver uma rodada aprovada. Espelha subtasks_bloqueia_conclusao_sem_aprovacao, um nível acima.';
