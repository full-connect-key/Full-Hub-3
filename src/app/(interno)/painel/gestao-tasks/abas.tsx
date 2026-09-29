"use client";

import { BadgeCheck, ClipboardList, Repeat, Workflow } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

import { ABAS, type Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof Workflow }> = {
  demandas: { rotulo: "Demandas", Icone: ClipboardList },
  workflows: { rotulo: "Workflows", Icone: Workflow },
  recorrencias: { rotulo: "Recorrências", Icone: Repeat },
  "aprovacoes-internas": { rotulo: "Aprovações internas", Icone: BadgeCheck },
};

/**
 * CADA SEÇÃO CARREGA OS FILTROS DELA, e trocar de seção não leva os da
 * anterior: `cliente` existe nas três primeiras querendo dizer coisas
 * parecidas, mas `situacao`, `modo` e `regra` são da lista de recorrências, e
 * `status`, `prioridade` e `atrasadas` são do board. Levar tudo junto deixaria
 * na URL parâmetros que não mudam nada na tela — e pior, um `?status=entregue`
 * sobrevivendo até a volta para Demandas, onde ele filtra de verdade.
 */
const SO_DA_LISTA = ["situacao", "modo", "regra", "deTask"];
const SO_DO_BOARD = [
  "cliente",
  "tipo",
  "responsavel",
  "prioridade",
  "status",
  "de",
  "ate",
  "atrasadas",
  "visao",
  "task",
];

/**
 * As quatro seções de Gestão de Tasks (decisão do usuário).
 *
 * ---------------------------------------------------------------------------
 * **ERAM TRÊS ITENS DO MENU, e viraram um.** Gestão de Tasks, Workflows e
 * Aprovações Internas respondiam à mesma pergunta em três endereços: *o
 * trabalho da agência*. A demanda é o trabalho; o workflow é a cadeia que ela
 * percorre; a recorrência é a regra que a abre na data; a fila é onde ela
 * espera o aval antes de sair. Quem monta a cadeia é quem distribui a demanda,
 * e quem distribui é quem aprova — a mesma pessoa, em três lugares do menu.
 *
 * É a decisão da Gestão de Pessoas, que juntou Equipe e Clientes pela mesma
 * razão: a tela reflete que são o mesmo assunto, e o banco continua com as
 * tabelas separadas porque elas são coisas separadas.
 * ---------------------------------------------------------------------------
 *
 * **A HIERARQUIA FOI ACHATADA, e não aninhada.** Recorrências era sub-aba de
 * Workflows; com o nível de cima nascendo, ela viraria aba dentro de aba —
 * duas barras empilhadas, e a de baixo mudando de conteúdo conforme a de cima.
 * A proximidade que justificava o par continua inteira: elas são vizinhas na
 * mesma barra, e a recorrência no modo "task por ocorrência" escolhe um
 * workflow que está a um clique.
 *
 * **Os quatro perfis que alcançam o módulo alcançam as quatro seções**, então
 * não há `QUEM_VE` aqui — as três rotas eram `GESTAO` antes e continuam sendo.
 * Uma checagem por seção num conjunto em que todas respondem igual é uma
 * segunda pergunta embaixo de uma primeira que já barra todo mundo, que é a
 * lição da 0060.
 *
 * **O CONTADOR SÓ APARECE QUANDO HÁ FILA**, e é o que substitui o item de menu
 * que sumiu: antes a pessoa via "Aprovações Internas" na barra lateral todo
 * dia e clicava para descobrir se havia algo. Um selo com zero seria a mesma
 * coisa com um número a mais — a ausência é a resposta, como na matriz do Full
 * Days, que pinta só a exceção. Quem aplica a regra agora é a
 * `BarraDeContexto`, para as sete barras do produto não divergirem nela.
 */
export function AbasDeGestaoDeTasks({ atual, aguardando }: { atual: Aba; aguardando: number }) {
  const secoes: SecaoDoModulo<Aba>[] = ABAS.map((aba) => ({
    chave: aba,
    ...ROTULOS[aba],
    ...(aba === "aprovacoes-internas"
      ? { contagem: aguardando, rotuloDaContagem: `${aguardando} esperando aval` }
      : {}),
  }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções de Gestão de Tasks"
      titulo="Gestão de Tasks"
      atual={atual}
      secoes={secoes}
      limparAoSair={(destino) => [
        ...(destino === "recorrencias" ? SO_DO_BOARD : SO_DA_LISTA),
        ...(destino === "demandas" ? [] : SO_DO_BOARD),
      ]}
    />
  );
}
