import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

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

  /* O DESENHO NOVO, a pedido do usuário: a faixa amarela inteira lia como um
     erro do sistema. Agora é um cartão branco como os outros, o amarelo fica
     no ícone e no selo de dias — que é o dado que pede ação —, e a linha
     inteira é o link para as demandas da conta. */
  return (
    <section className="bg-surface-card rounded-card shadow-cartao border p-5">
      <h2 className="flex items-center gap-3 text-base font-bold">
        <span className="bg-warning-soft text-warning flex size-9 shrink-0 items-center justify-center rounded-full">
          <AlertTriangle aria-hidden className="size-4.5" />
        </span>
        {clientes.length === 1
          ? "Um cliente com trabalho parado"
          : `${clientes.length} clientes com trabalho parado`}
      </h2>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {clientes.map((cliente) => (
          <li key={cliente.cliente_id}>
            <Link
              href={`/painel/gestao-tasks?cliente=${cliente.cliente_id}`}
              className="bg-muted hover:bg-accent group flex items-center gap-3 rounded-xl p-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {cliente.cliente}
                </span>
                <span className="text-text-secondary block text-sm">
                  {cliente.paradas} etapa{cliente.paradas === 1 ? "" : "s"}{" "}
                  parada{cliente.paradas === 1 ? "" : "s"}
                </span>
              </span>
              <span className="bg-warning-soft text-warning shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums">
                há {cliente.dias} dias
              </span>
              <ArrowRight
                aria-hidden
                className="text-text-muted size-4 shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
