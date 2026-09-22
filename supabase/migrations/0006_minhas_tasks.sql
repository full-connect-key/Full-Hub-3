-- ===========================================================================
-- 0006 - Minhas Tasks
--
-- COMO APLICAR
--   Supabase > SQL Editor > New query > cole ESTE ARQUIVO INTEIRO > Run.
--   Nao deixe texto selecionado: o editor roda so a selecao quando existe uma.
--
--   Pela CLI:  npx supabase db push
--
-- Pode ser executado mais de uma vez sem problema.
--
-- O QUE ELE MUDA
--   1. Criar task passa a ser exclusividade de quem faz Atendimento.
--   2. Quem e responsavel por uma SUBTAREFA passa a poder atualizar a dela,
--      mesmo quando a task-mae e de outra pessoa.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- PASSO 1 - So o Atendimento cria task
--
-- A REGRA DO NEGOCIO, por extenso:
--
--   Funcao e perfil de acesso sao coisas diferentes. O perfil (`role`) diz o
--   que a pessoa alcanca na plataforma; a funcao (`team_members.funcao`) diz o
--   que ela faz na agencia. Quem esta no Atendimento abre e distribui demanda
--   -- e isso continua verdade mesmo que o perfil dela seja apenas
--   `colaborador`.
--
--   `is_atendimento()` ja traduz isso: verdadeira para quem tem
--   funcao = 'Atendimento' e para a gestao (desenvolvedor e socio).
--
-- O QUE MUDA em relacao a 0004:
--   a policy anterior tambem aceitava `responsavel_id = auth.uid()`, o que
--   deixava qualquer colaborador criar task para si mesmo. Nao e o desenho:
--   quem nao e do Atendimento recebe demanda, nao abre. Quem nao e Atendimento
--   continua podendo criar SUBTAREFA dentro de uma task que e dele, comentar e
--   atualizar o proprio progresso -- e isso vale pelas policies de subtasks,
--   logo abaixo.
--
-- Esconder o botao na tela nao basta: e esta policy que recusa um pedido
-- montado a mao contra a API do Supabase.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_insert on public.tasks;

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.is_atendimento());


-- ---------------------------------------------------------------------------
-- PASSO 2 - A subtarefa e de quem a executa
--
-- Ate aqui, subtasks tinha uma unica policy `for all` presa a
-- `pode_editar_task(task_id)`: valia quem e do Atendimento ou responsavel pela
-- TASK-MAE. Isso deixava de fora justamente o caso que o modulo existe para
-- atender -- o redator que tem uma subtarefa dentro de uma task do social
-- media nao conseguia marcar a propria subtarefa como concluida nem registrar
-- o tempo dela.
--
-- Agora:
--   criar e apagar subtarefa  -> quem manda na task-mae (pode_editar_task)
--   atualizar uma subtarefa   -> o mesmo, MAIS o responsavel por ela
--
-- O `with check` repete a condicao de proposito: sem ele, daria para pegar uma
-- subtarefa que e sua e reatribui-la a outra pessoa, saindo da regra na mesma
-- gravacao.
-- ---------------------------------------------------------------------------
drop policy if exists subtasks_write  on public.subtasks;
drop policy if exists subtasks_insert on public.subtasks;
drop policy if exists subtasks_update on public.subtasks;
drop policy if exists subtasks_delete on public.subtasks;

create policy subtasks_insert on public.subtasks
  for insert to authenticated
  with check (public.pode_editar_task(task_id));

create policy subtasks_update on public.subtasks
  for update to authenticated
  using (
    public.pode_editar_task(task_id)
    or responsavel_id = (select auth.uid())
  )
  with check (
    public.pode_editar_task(task_id)
    or responsavel_id = (select auth.uid())
  );

create policy subtasks_delete on public.subtasks
  for delete to authenticated
  using (public.pode_editar_task(task_id));


-- ---------------------------------------------------------------------------
-- PASSO 3 - Indices que a tela Minhas Tasks usa
--
-- A consulta pessoal cruza duas perguntas: "quais tasks sao minhas" e "quais
-- subtarefas sao minhas". A segunda filtra por responsavel e por prazo ao
-- mesmo tempo, e o indice composto evita varrer a tabela inteira.
-- ---------------------------------------------------------------------------
create index if not exists subtasks_responsavel_prazo_idx
  on public.subtasks (responsavel_id, prazo);

create index if not exists tasks_responsavel_prazo_idx
  on public.tasks (responsavel_id, prazo);


-- ---------------------------------------------------------------------------
-- PASSO 4 - Conferencia
-- ---------------------------------------------------------------------------
do $$
declare
  faltando text;
begin
  select string_agg(alvo, ', ')
    into faltando
  from (
    select 'subtasks/' || c.cmd as alvo
    from (values ('INSERT'), ('UPDATE'), ('DELETE')) as c(cmd)
    where not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = 'subtasks' and p.cmd = c.cmd
    )
  ) pendentes;

  if faltando is not null then
    raise exception 'Faltou policy de escrita para: %', faltando;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tasks' and cmd = 'INSERT'
      and qual is null and with_check like '%responsavel_id%'
  ) then
    raise exception 'tasks_insert ainda aceita o proprio responsavel -- rode o PASSO 1 de novo.';
  end if;
end
$$;

select
  'tudo pronto' as situacao,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'subtasks')            as policies_de_subtask,
  (select with_check from pg_policies
    where schemaname = 'public' and tablename = 'tasks'
      and policyname = 'tasks_insert')                                 as regra_para_criar_task,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('subtasks_responsavel_prazo_idx', 'tasks_responsavel_prazo_idx')) as indices_novos;
