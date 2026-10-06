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
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">Campanhas</h1>
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
