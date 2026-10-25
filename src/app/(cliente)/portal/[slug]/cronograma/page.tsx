import type { Metadata } from "next";
import { Suspense } from "react";

import { CronogramaDoPortal } from "@/components/portal/telas/cronograma-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Cronograma do cliente" };

/**
 * O mesmo cronograma, visto pela equipe.
 *
 * Mesmo componente, com `clienteId` — obrigatório aqui, porque `is_staff()`
 * enxerga todas as empresas e sem o filtro a grade de uma mostraria o
 * material de outra.
 */
export default async function CronogramaDoClienteVistoPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/cronograma">) {
  const { slug } = await params;
  const [cliente, valores] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
  ]);

  const mes =
    typeof valores.mes === "string" && /^\d{4}-\d{2}$/.test(valores.mes)
      ? valores.mes
      : null;
  const dia =
    typeof valores.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valores.dia)
      ? valores.dia
      : null;
  const frente = typeof valores.frente === "string" ? valores.frente : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Cronograma
        </h1>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <CronogramaDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
          mes={mes}
          frente={frente}
          diaAberto={dia}
        />
      </Suspense>
    </div>
  );
}
