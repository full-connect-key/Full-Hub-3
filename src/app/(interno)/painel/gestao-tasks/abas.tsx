"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeCheck, ClipboardList, Repeat, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

import { ABAS, type Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { label: string; icone: typeof Workflow }> = {
  demandas: { label: "Demandas", icone: ClipboardList },
  workflows: { label: "Workflows", icone: Workflow },
  recorrencias: { label: "Recorrências", icone: Repeat },
  "aprovacoes-internas": { label: "Aprovações internas", icone: BadgeCheck },
};

/**
 * As quatro abas de Gestão de Tasks (decisão do usuário).
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
 * **Os quatro perfis que alcançam o módulo alcançam as quatro abas**, então
 * não há `QUEM_VE` aqui — as três rotas eram `GESTAO` antes e continuam sendo.
 * Uma checagem por aba num conjunto em que todas respondem igual é uma segunda
 * pergunta embaixo de uma primeira que já barra todo mundo, que é a lição da
 * 0060.
 *
 * Link e não estado, como em toda listagem do produto: "olha a regra do Mundo
 * Verde" precisa ser um link, e o selo "Recorrente" da task aponta para
 * `?aba=recorrencias&regra=...`.
 */
export function AbasDeGestaoDeTasks({ atual, aguardando }: { atual: Aba; aguardando: number }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  function href(aba: Aba) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);

    // CADA ABA CARREGA OS FILTROS DELA, e trocar de aba não leva os da
    // anterior: `cliente` existe nas três primeiras querendo dizer coisas
    // parecidas, mas `situacao`, `modo` e `regra` são da lista de
    // recorrências, e `status`, `prioridade` e `atrasadas` são do board. Levar
    // tudo junto deixaria na URL parâmetros que não mudam nada na tela — e
    // pior, um `?status=entregue` sobrevivendo até a volta para Demandas, onde
    // ele filtra de verdade.
    const soDaLista = ["situacao", "modo", "regra", "deTask"];
    const soDoBoard = [
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
    for (const chave of aba === "recorrencias" ? soDoBoard : soDaLista) destino.delete(chave);
    if (aba !== "demandas") for (const chave of soDoBoard) destino.delete(chave);

    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções de Gestão de Tasks" className="overflow-x-auto">
      <ul className="bg-muted inline-flex min-w-max gap-1 rounded-xl p-1">
        {ABAS.map((aba) => {
          const { label, icone: Icone } = ROTULOS[aba];
          const ativo = aba === atual;
          return (
            <li key={aba}>
              <Link
                href={href(aba)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "bg-surface-card text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {label}
                {/* O CONTADOR SÓ APARECE QUANDO HÁ FILA, e é o que substitui o
                    item de menu que sumiu: antes a pessoa via "Aprovações
                    Internas" na barra lateral todo dia e clicava para
                    descobrir se havia algo. Um selo com zero seria a mesma
                    coisa com um número a mais — a ausência é a resposta, como
                    na matriz do Full Days, que pinta só a exceção. */}
                {aba === "aprovacoes-internas" && aguardando > 0 ? (
                  <span
                    className="bg-warning-soft text-warning rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums"
                    aria-label={`${aguardando} esperando aval`}
                  >
                    {aguardando}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
