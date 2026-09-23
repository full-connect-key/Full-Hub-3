-- ---------------------------------------------------------------------------
-- 0027 - A subtarefa ganha data de inicio
--
-- Pedido do usuario: "na subtarefa so da pra colocar uma data, precisamos da
-- possibilidade de data de inicio e encerramento".
--
-- Ate aqui a etapa tinha `prazo`, e so. Dava para dizer quando a arte tem que
-- estar pronta e nao dava para dizer quando ela comeca -- o que e a metade da
-- informacao que quem monta a agenda da semana precisa: duas etapas com o
-- mesmo prazo podem ser uma de tres dias e uma de tres horas.
--
-- A COLUNA NOVA E `data_inicio`, E O FIM CONTINUA SENDO `prazo`. Nao virou
-- `data_fim` por simetria com `tasks` porque `prazo` e lido em consulta,
-- trigger, tela e relatorio, e renomear coluna em uso e migration arriscada
-- sem nada em troca: o nome ja diz que e a ponta final.
--
-- NULO CONTINUA VALENDO, nos dois. Etapa sem data e caso normal -- quem abre
-- a demanda costuma saber o prazo de entrega e ainda nao saber quando cada
-- etapa comeca. Exigir as duas faria a pessoa inventar uma.
--
-- O QUE NAO MUDA, de proposito:
--
--   * ATRASO continua sendo do `prazo`. Comecar tarde nao e atrasar; entregar
--     tarde e. Uma etapa que comecou depois do previsto e entregou no dia nao
--     e uma etapa atrasada, e marca-la como tal faria o contador de atrasadas
--     perder o sentido.
--   * O CALENDARIO continua mostrando o prazo, e nao os dois. Uma barra por
--     data dobraria os itens do mes; o inicio aparece no detalhe da etapa,
--     que e onde alguem pergunta "quando isso comeca?".
--
-- Roda mais de uma vez sem erro.
-- ---------------------------------------------------------------------------

alter table public.subtasks
  add column if not exists data_inicio date;

comment on column public.subtasks.data_inicio is
  'Quando a etapa comeca. O fim e `prazo`. Os dois sao opcionais: etapa sem data e caso normal.';

comment on column public.subtasks.prazo is
  'Quando a etapa tem que estar pronta -- a ponta final do periodo dela. E ele que define atraso.';

-- Periodo invertido nao e periodo. Sem o check, "de 20/10 a 05/10" entra
-- calado e aparece na tela como um intervalo negativo que ninguem sabe ler.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subtasks_periodo') then
    alter table public.subtasks
      add constraint subtasks_periodo
      check (data_inicio is null or prazo is null or data_inicio <= prazo);
  end if;
end
$$;

-- As etapas que ja existiam ficam com `data_inicio` nulo, e e o certo:
-- preencher com o inicio da Task inventaria uma data que ninguem combinou, e
-- ela apareceria na tela como se fosse decisao de alguem.

notify pgrst, 'reload schema';
