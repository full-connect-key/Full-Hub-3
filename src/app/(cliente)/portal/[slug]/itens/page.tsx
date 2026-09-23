import type { Metadata } from "next";
import { Suspense } from "react";

import {
  lerFiltrosDoPortal,
  MateriaisDoPortal,
} from "@/components/portal/telas/materiais-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Materiais do cliente" };

/**
 * A lista de materiais de um cliente, vista pela equipe.
 *
 * O `clienteId` é obrigatório aqui, e não é detalhe: quem é da equipe enxerga
 * todos os clientes pelo RLS, e sem o filtro o portal da Mundo Verde mostraria
 * o material da Óptica Visão.
 */
export default async function MateriaisDoClienteVistosPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/itens">) {
  const { slug } = await params;
  const [cliente, valores] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
  ]);
  const filtros = lerFiltrosDoPortal(valores);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Materiais</h1>
        <p className="text-text-muted mt-1">
          Tudo que a Full enviou para este cliente, do mais urgente ao que pode
          esperar.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <MateriaisDoPortal
          filtros={filtros}
          clienteId={cliente?.id ?? ""}
          comoEquipe
        />
      </Suspense>
    </div>
  );
}
