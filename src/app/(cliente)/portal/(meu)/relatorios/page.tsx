import type { Metadata } from "next";
import { Suspense } from "react";

import { ListaDeRelatoriosDoPortal } from "@/components/portal/telas/relatorios-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";

export const metadata: Metadata = { title: "Relatórios" };

export default async function PaginaDeRelatorios() {
  await exigirClienteNaTela();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">Relatórios</h1>
        <p className="text-text-muted text-sm">
          Os resultados de cada período, com a leitura da agência.
        </p>
      </div>
      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <ListaDeRelatoriosDoPortal base="/portal" />
      </Suspense>
    </div>
  );
}
