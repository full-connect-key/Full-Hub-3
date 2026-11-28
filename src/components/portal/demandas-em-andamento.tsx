import Link from "next/link";
import { ArrowRight, Check, Hourglass } from "lucide-react";

import type { DemandaNoPortal } from "@/lib/dados/demandas-do-portal";
import { cn } from "@/lib/utils";

/**
 * O QUE A AGÊNCIA ESTÁ FAZENDO PARA O CLIENTE, demanda por demanda (0160).
 *
 * Pedido do usuário: o box aparece assim que a demanda é aberta para a conta,
 * os passos andam sozinhos, e ele FICA EM DESTAQUE quando há material
 * esperando a aprovação — com o botão que leva até ela.
 */
export function DemandasEmAndamento({
  demandas,
  base,
  comoEquipe,
}: {
  demandas: DemandaNoPortal[];
  base: string;
  comoEquipe: boolean;
}) {
  if (demandas.length === 0) return null;

  return (
    <div data-tour="portal-demandas">
      <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {demandas.map((demanda) => {
          const feitas = demanda.passos.filter(
            (e) => e.estado === "concluida",
          ).length;
          const total = demanda.passos.length;
          const largura = total > 0 ? Math.round((feitas / total) * 100) : 0;

          return (
            <li key={demanda.id}>
              {/* O BOX INTEIRO É O LINK para as entregas do projeto. */}
              <Link
                href={`${base}/aprovacoes?projeto=${demanda.id}`}
                className={cn(
                  "rounded-card shadow-cartao hover:border-accent-strong block space-y-4 border p-5 transition-colors",
                  demanda.esperando
                    ? "bg-action-soft border-action"
                    : "bg-surface-card",
                )}
              >
              {demanda.esperando ? (
                <p className="text-action flex items-center gap-1.5 text-xs font-bold uppercase">
                  <Hourglass aria-hidden className="size-3.5" />
                  {comoEquipe
                    ? "Esperando a aprovação do cliente"
                    : "Tem material para você aprovar"}
                </p>
              ) : null}

              <div>
                <p className="text-base leading-snug font-bold tracking-[-0.015em]">
                  {demanda.titulo}
                </p>
                {total > 0 ? (
                  <p className="text-text-muted mt-1 text-sm">
                    {demanda.concluida
                      ? "Concluído"
                      : `${feitas} de ${total} ${total === 1 ? "passo concluído" : "passos concluídos"}`}
                  </p>
                ) : null}
              </div>

              {total > 0 ? (
                <>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-success h-full rounded-full"
                      style={{ width: `${largura}%` }}
                    />
                  </div>
                  <ol className="space-y-2">
                    {demanda.passos.map((passo, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            passo.estado === "concluida"
                              ? "bg-success text-success-foreground"
                              : passo.estado === "em_andamento"
                                ? "bg-action ring-action-soft ring-4"
                                : "bg-card border-input border-2",
                          )}
                        >
                          {passo.estado === "concluida" ? (
                            <Check aria-hidden className="size-3" />
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            passo.estado === "a_fazer" && "text-text-muted",
                            passo.estado === "em_andamento" && "font-medium",
                          )}
                        >
                          {passo.titulo}
                        </span>
                        {passo.estado === "em_andamento" ? (
                          <span className="text-text-muted ml-auto shrink-0 text-xs">
                            em produção
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium",
                  demanda.esperando
                    ? "bg-action text-action-foreground"
                    : "bg-muted text-text-secondary",
                )}
              >
                {demanda.esperando ? "Ver e aprovar" : "Ver as entregas"}
                <ArrowRight aria-hidden className="size-4" />
              </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
