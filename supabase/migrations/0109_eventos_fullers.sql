-- ===========================================================================
-- 0109 - "EVENTOS FULLERS" ENTRA NO CALENDARIO, E O AZUL PASSA A SER DELE
--
-- Decisao do usuario, palavra por palavra:
--
--   "inclua uma categoria de eventos para o calendario da Full, que seja
--    'Eventos Fullers' e coloque uma cor tipo azul, sendo assim mudar a cor
--    da categoria 'Convencao e feira' pra outra cor tipo um roxinho"
--
-- O Calendario Full e SO DE EVENTOS desde a 0105 -- *"ele deve ser apenas
-- para eventos que serao lancados nele, nada de outros abas"*. Com uma origem
-- so, o que distingue uma linha da outra na grade do mes e o que o evento E,
-- e a cor sai de `events.tipo`. Faltava a categoria do que e da CASA.
--
-- ---------------------------------------------------------------------------
-- O QUE A MIGRATION FAZ, E E UMA LINHA
--
-- Um valor no enum. A cor, o rotulo e a legenda sao da tela, e saem do mesmo
-- mapa que desenha o chip -- `COR_DO_TIPO_DE_EVENTO` em
-- `lib/dominio/calendario.ts`. A 0105 deixou isso escrito: *"o que a mantem
-- honesta e a cor sair do MESMO mapa que desenha o chip"*.
--
-- ---------------------------------------------------------------------------
-- E ELA NAO USA O VALOR QUE ACABA DE CRIAR, de proposito.
--
-- O SQL Editor do Supabase roda o arquivo colado como UMA transacao, e o
-- Postgres recusa usar um valor de enum na mesma transacao em que ele nasce
-- ("unsafe use of new value of enum type"). E a razao escrita na 0028 para
-- `rascunho` nao ter virado valor de enum, e aqui ela vira uma regra sobre o
-- arquivo: nao ha `check`, nao ha `update`, e **nao ha o `select` de
-- conferencia no fim** que as outras migrations costumam trazer. Quem quiser
-- conferir roda, DEPOIS, numa segunda colagem:
--
--   select unnest(enum_range(null::public.evento_tipo));
--
-- ---------------------------------------------------------------------------
-- O VALOR ENTRA NO FIM DA LISTA, e nao antes de `convencao`.
--
-- `add value ... before` existe e nao serve a nada aqui: nada no produto
-- ordena por este enum -- a ordem do seletor e a de `TIPOS_DE_EVENTO`, em
-- TypeScript, e a da legenda e escrita a mao. Appendar e a forma que roda de
-- novo sem erro e sem depender de outro valor continuar onde esta.
--
-- Roda mais de uma vez sem erro.
-- ===========================================================================

alter type public.evento_tipo add value if not exists 'evento_fullers';

comment on type public.evento_tipo is
  'O que o evento e, e e dele que sai a cor do chip no mes (0105). '
  '`evento_fullers` e o da propria agencia, e carrega o azul (0109).';
