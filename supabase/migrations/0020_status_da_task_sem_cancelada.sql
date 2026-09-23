-- ===========================================================================
-- 0020 — "Cancelada" sai do produto
--
-- Decisao do usuario: os status da Task passam a ser sete --
--
--   Iniciar, Em andamento, Aguardando informacoes, Aguardando aprovacao,
--   Em ajuste, Entregue, Concluido
--
-- "Cancelada" sai. A consequencia aceita, dita antes da decisao: `entregue`
-- vira o UNICO status manual, e uma demanda que morre passa a ser apagada --
-- o que leva as subtarefas, as rodadas e o historico junto.
--
-- O VALOR CONTINUA NO ENUM, e isso nao e desleixo. `alter type ... drop
-- value` nao existe no Postgres; o caminho seria recriar o tipo, o que exige
-- reescrever toda coluna que o usa, em producao, numa migration que nao tem
-- como ser testada em nenhum outro lugar. E o mesmo arranjo do `atrasado` no
-- Financeiro: existe no tipo, nenhuma linha o carrega.
--
-- Duas coisas fazem esse arranjo valer:
--   1. as linhas que ja tinham `cancelada` sao convertidas;
--   2. um trigger recusa quem tentar gravar dali em diante.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. As linhas que ja existiam
--
-- Vao para `nao_iniciada` com `status_manual = false` -- e nao para um status
-- escolhido a dedo. `status_manual` e um BOOLEANO ("alguem marcou a mao"), e
-- desliga-lo devolve a Task ao recalculo: dali em diante ela passa a ser
-- descrita pelas proprias subtarefas, que e a unica coisa verdadeira que da
-- para dizer sobre ela. Escolher `concluido` seria afirmar que o trabalho
-- saiu, e `entregue` que o material foi entregue.
--
-- `nao_iniciada` e so o ponto de partida: o proximo recalculo escreve por
-- cima com o que as subtarefas disserem.
-- ---------------------------------------------------------------------------
update public.tasks
   set status = 'nao_iniciada',
       status_manual = false
 where status = 'cancelada';

-- ---------------------------------------------------------------------------
-- 2. A porta fechada
--
-- Trigger e nao `check`: um `check` seria avaliado tambem nas linhas antigas
-- em qualquer UPDATE, e o texto que ele devolve nao diz o que fazer. Aqui a
-- mensagem aponta a saida.
-- ---------------------------------------------------------------------------
create or replace function public.tasks_sem_cancelada()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelada' then
    raise exception
      'Cancelada saiu dos status da Task.'
      using hint = 'Uma demanda que nao vai mais acontecer se apaga, em Gestao de Tasks. Se ela precisa continuar no historico, deixe o status que as subtarefas calcularem.';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sem_cancelada on public.tasks;
create trigger tasks_sem_cancelada
  before insert or update of status on public.tasks
  for each row execute function public.tasks_sem_cancelada();

comment on function public.tasks_sem_cancelada is
  'Cancelada saiu do produto na 0020. O valor continua no enum porque apagar valor de enum em uso obrigaria a recriar o tipo; este trigger e o que garante que nenhuma linha o carregue.';
