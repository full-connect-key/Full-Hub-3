import type { Metadata } from "next";
import { Suspense } from "react";

import {
  lerFiltrosDoPortal,
  MateriaisDoPortal,
} from "@/components/portal/telas/materiais-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";

export const metadata: Metadata = { title: "Materiais" };

export default async function PaginaDeItensDoPortal({
  searchParams,
}: PageProps<"/portal/itens">) {
  await exigirClienteNaTela();
  const params = await searchParams;
  const filtros = lerFiltrosDoPortal(params);
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Materiais</h1>
        <p className="text-text-muted mt-1">
          Tudo que a Full enviou para você, do mais urgente ao que pode esperar.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <MateriaisDoPortal
          filtros={filtros}
          clienteId={empresa}
          comoEquipe={false}
          base="/portal"
        />
      </Suspense>
    </div>
  );
}
