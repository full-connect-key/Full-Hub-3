import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * Os clientes com trabalho parado há mais de três dias.
 *
 * **"Parado" é a ETAPA em aberto cujo prazo já passou desse tanto**, e não a
 * demanda: a Task não tem responsável nem prazo desde o Sprint 3B, então
 * perguntar a ela há quanto tempo está parada não tem resposta. A etapa tem as
 * duas coisas.
 *
 * **É `--warning` e nunca `--danger`.** Vermelho na primeira tela que a gestão
 * abre todo dia treina o hábito de ignorar vermelho — é a mesma decisão do
 * alerta de 7 dias do Portal. O que precisa de vermelho é o cartão "Atrasadas"
 * do Pulso, que é um número, não uma lista de nomes.
 *
 * **Some quando não há nenhum**, que é o estado bom: uma caixa dizendo
 * "nenhum cliente em atenção" ocupa todo dia o lugar de outra coisa.
 */
export function ClientesEmAtencao({ clientes }: { clientes: ResumoDaHome["clientes_em_atencao"] }) {
  if (!clientes || clientes.length === 0) return null;

  return (
    <section className="bg-warning-soft rounded-card border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle aria-hidden className="size-4" />
        {clientes.length === 1
          ? "Um cliente com trabalho parado"
          : `${clientes.length} clientes com trabalho parado`}
      </h2>

      <p className="text-text-secondary mt-1 text-sm">
        Etapa em aberto que passou do prazo há mais de três dias.
      </p>

      <ul className="mt-3 space-y-1">
        {clientes.map((cliente) => (
          <li key={cliente.cliente_id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link
              href={`/painel/gestao-tasks?cliente=${cliente.cliente_id}`}
              className="text-accent-strong font-medium hover:underline"
            >
              {cliente.cliente}
            </Link>
            <span className="text-text-secondary">
              {cliente.paradas} etapa{cliente.paradas === 1 ? "" : "s"} parada
              {cliente.paradas === 1 ? "" : "s"}
            </span>
            {/*
              `secondary` E NÃO `muted`: este bloco tem fundo `--warning-soft`,
              e o par apagado sobre ele dá 4,42:1 a 12px. É o mesmo caso do
              rótulo do cartão de número — um fundo tingido não é o cartão nem
              a página, que eram os dois únicos pares medidos.
            */}
            <span className="text-text-secondary text-xs tabular-nums">
              a mais antiga há {cliente.dias} dias
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
