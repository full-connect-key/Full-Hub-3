import type { Metadata } from "next";
import { Suspense } from "react";

import { CampanhasDoPortal } from "@/components/portal/telas/campanhas-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { lerFiltroDeCampanha } from "@/lib/dominio/campanhas";

export const metadata: Metadata = { title: "Campanhas" };

export default async function PaginaDeCampanhas({
  searchParams,
}: PageProps<"/portal/campanhas">) {
  await exigirClienteNaTela();
  const params = await searchParams;
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <p className="text-text-muted mt-1">
          As campanhas que a Full está produzindo para você, e o que ainda
          depende da sua decisão.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <CampanhasDoPortal
          base="/portal/campanhas"
          clienteId={empresa}
          filtro={lerFiltroDeCampanha(params.filtro)}
        />
      </Suspense>
    </div>
  );
}
