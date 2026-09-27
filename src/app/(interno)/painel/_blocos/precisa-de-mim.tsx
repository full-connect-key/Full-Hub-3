import Link from "next/link";
import { ArrowRight, HandHelping } from "lucide-react";

import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O que está parado esperando esta pessoa.
 *
 * ---------------------------------------------------------------------------
 * SÃO CINCO ITENS, E O QUARTO ESPEROU A TABELA EXISTIR.
 *
 * Este comentário dizia "são três e não quatro", e explicava: o sprint pedia
 * as notas fiscais recusadas, e o módulo da pessoa era tela de espera. A 0065
 * criou `team_invoices`, então o quarto entrou — e com ele o quinto, que o
 * sprint não pedia: a fila do sócio.
 *
 * **Os dois são lados opostos do mesmo módulo**, e por isso nunca aparecem
 * juntos para a mesma pessoa: o colaborador vê a nota dele que voltou, o sócio
 * vê as que esperam a conferência dele. O RLS é que separa — para quem não é
 * sócio a contagem da fila é zero porque a policy não devolve as linhas, e não
 * porque um `if` a escondeu.
 * ---------------------------------------------------------------------------
 *
 * **O bloco some quando não há nada**, como o aviso dos rascunhos. Uma caixa
 * fixa dizendo "nada esperando você" ocupa todo dia, na primeira tela de todo
 * mundo, o lugar de uma informação que interessa em alguns dias.
 *
 * **E a linha que dá zero também some.** O colaborador não decide rodada nem
 * responde pedido de Full Days, então para ele os dois números são zero — e
 * não porque um `if` os escondeu, mas porque a policy não devolve as linhas.
 * Desenhar "0 aprovações" seria ensinar que existe uma fila dele ali.
 */
export function PrecisaDeMim({
  dados,
  notasRecusadas,
  notasEsperandoOSocio,
  notasPedidas,
}: {
  dados: ResumoDaHome["precisa_de_mim"];
  /** As minhas notas que voltaram e cujo mês ainda não tem nota nova. */
  notasRecusadas: number;
  /** Quantas esperam a conferência — zero para quem não é sócio. */
  notasEsperandoOSocio: number;
  /**
   * Meses em que o Financeiro pediu a minha nota e eu ainda não mandei (0066).
   *
   * Aqui e não só no sino: o aviso vira lido no primeiro clique, e depois o
   * pedido não existe em tela nenhuma até a pessoa abrir Notas Fiscais por
   * conta própria. É exatamente "o que está parado me esperando", que é a
   * pergunta deste bloco.
   */
  notasPedidas: number;
}) {
  const linhas = [
    {
      quantos: dados?.aprovacoes ?? 0,
      href: "/painel/gestao-tasks?aba=aprovacoes-internas",
      singular: "entrega esperando seu aval interno",
      plural: "entregas esperando seu aval interno",
    },
    {
      quantos: dados?.comentarios ?? 0,
      href: "/painel/social-media",
      singular: "comentário de cliente sem resposta",
      plural: "comentários de cliente sem resposta",
    },
    {
      quantos: dados?.pedidos_rh ?? 0,
      href: "/painel/full-days?aba=aprovacoes",
      singular: "pedido de Full Days esperando você",
      plural: "pedidos de Full Days esperando você",
    },
    {
      quantos: notasRecusadas,
      href: "/painel/notas-fiscais",
      singular: "nota fiscal sua para reenviar",
      plural: "notas fiscais suas para reenviar",
    },
    {
      quantos: notasEsperandoOSocio,
      href: "/painel/notas-fiscais?aba=conferir",
      singular: "nota fiscal da equipe esperando você",
      plural: "notas fiscais da equipe esperando você",
    },
    {
      quantos: notasPedidas,
      href: "/painel/notas-fiscais",
      singular: "nota fiscal que o Financeiro pediu e você não mandou",
      plural: "notas fiscais que o Financeiro pediu e você não mandou",
    },
  ].filter((linha) => linha.quantos > 0);

  if (linhas.length === 0) return null;

  return (
    <section className="bg-surface-card rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <HandHelping aria-hidden className="size-4" />
        Precisa de mim
      </h2>

      <ul className="mt-3 divide-y">
        {linhas.map((linha) => (
          <li key={linha.href}>
            <Link
              href={linha.href}
              className="group hover:text-accent-strong flex items-center gap-2 py-2 text-sm"
            >
              <span className="bg-warning-soft text-warning rounded px-2 py-0.5 text-xs font-semibold tabular-nums">
                {linha.quantos}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {linha.quantos === 1 ? linha.singular : linha.plural}
              </span>
              <ArrowRight
                aria-hidden
                className="text-text-muted group-hover:text-accent-strong size-4 shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
