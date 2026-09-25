import Link from "next/link";
import { ArrowRight, HandHelping } from "lucide-react";

import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O que está parado esperando esta pessoa.
 *
 * ---------------------------------------------------------------------------
 * SÃO TRÊS ITENS E NÃO QUATRO, e a ausência do quarto é registro, não descuido.
 *
 * O sprint pede também as notas fiscais recusadas. A tabela não existe: a
 * agência emitir nota ficou fora do produto por decisão do usuário, e o módulo
 * da pessoa é tela de espera até hoje. O bloco entrega os três que têm dado —
 * inventar o quarto com outra fonte seria mostrar um número que não responde à
 * pergunta que o rótulo faz.
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
export function PrecisaDeMim({ dados }: { dados: ResumoDaHome["precisa_de_mim"] }) {
  const linhas = [
    {
      quantos: dados?.aprovacoes ?? 0,
      href: "/painel/aprovacoes-internas",
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
