-- ---------------------------------------------------------------------------
-- 0036 - Apagar um workflow
--
-- Decisao do usuario: da para apagar, e nao so arquivar.
--
-- POR QUE NAO DAVA. `task_types`, `workflow_templates` e `workflow_steps`
-- nasceram na 0007 com policy de select, insert e update -- e nenhuma de
-- delete. Sem policy, a RLS recusa: o botao podia existir na tela que o banco
-- devolveria zero linha, calado. Liberar e acrescentar a policy que faltava.
--
-- QUEM APAGA E `is_gestor()`, o MESMO que ja cria, edita e arquiva.
--
-- Poderia ser so o socio, como o DELETE de `clients` -- e a comparacao e que
-- explica por que nao e. Apagar cliente destroi historico que nao volta:
-- nome, vinculos, tudo o que aponta para ele. Apagar workflow nao destroi
-- nada do trabalho, e o PASSO 2 diz por que. Exigir o socio para desfazer um
-- modelo duplicado seria pedir a uma pessoa so que limpe a bagunca de todo
-- mundo, e o resultado conhecido disso e a lista que ninguem limpa.
--
-- ARQUIVAR CONTINUA SENDO O CAMINHO NORMAL, e a tela diz isso. Apagar e para
-- o modelo que nasceu errado -- o duplicado, o de teste, o com nome trocado.
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- PASSO 1 - As tres policies que faltavam
--
-- `workflow_steps` tem `on delete cascade` para o template, entao apagar o
-- template leva as etapas junto. A policy dela existe assim mesmo: cascade
-- roda como dono e nao passa por RLS, mas apagar UMA etapa solta e operacao
-- de edicao do fluxo, e sem a policy ela tambem era recusada calada.
-- ---------------------------------------------------------------------------
drop policy if exists task_types_delete on public.task_types;
create policy task_types_delete on public.task_types
  for delete to authenticated using (public.is_gestor());

drop policy if exists workflow_templates_delete on public.workflow_templates;
create policy workflow_templates_delete on public.workflow_templates
  for delete to authenticated using (public.is_gestor());

drop policy if exists workflow_steps_delete on public.workflow_steps;
create policy workflow_steps_delete on public.workflow_steps
  for delete to authenticated using (public.is_gestor());


-- ---------------------------------------------------------------------------
-- PASSO 2 - O que acontece com as demandas que usaram o workflow
--
-- NADA SE PERDE, e e por isso que apagar nao precisa ser bloqueado como a
-- exclusao de cliente e.
--
-- Quando um workflow e aplicado, a 0007 faz duas coisas: MATERIALIZA as
-- subtarefas na Task e grava uma copia do fluxo em `tasks.workflow_snapshot`.
-- As etapas viram linhas de verdade em `subtasks`, com responsavel, prazo e
-- tempo -- elas nao dependem do modelo para existir. E o snapshot guarda como
-- o fluxo era NAQUELE dia, que e o que responde "de onde essas etapas
-- sairam" depois.
--
-- `tasks.task_type_id` e `on delete set null` desde a 0007. A demanda perde o
-- rotulo do modelo e mantem o trabalho inteiro.
--
-- Esta funcao existe para a TELA poder dizer isso antes do clique. Uma
-- confirmacao que diz "tem certeza?" sem dizer o que acontece e uma
-- confirmacao que ninguem le.
-- ---------------------------------------------------------------------------
create or replace function public.demandas_do_workflow(p_task_type_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return (
    select count(*)::integer
      from public.tasks t
     where t.task_type_id = p_task_type_id
  );
end;
$$;

comment on function public.demandas_do_workflow is
  'Quantas demandas usaram este workflow. A tela mostra antes de apagar -- elas mantem as etapas e o snapshot (0036).';
