import type { Metadata } from "next";
import { Suspense } from "react";

import { ListaDeRelatoriosDoPortal } from "@/components/portal/telas/relatorios-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Relatórios do cliente" };

export default async function RelatoriosDoClienteVistosPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/relatorios">) {
  const { slug } = await params;
  const [cliente] = await Promise.all([obterClientePeloSlug(slug), exigirEquipe()]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">Relatórios</h1>
        <p className="text-text-muted text-sm">
          O que o cliente vê: só os relatórios já publicados.
        </p>
      </div>
      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <ListaDeRelatoriosDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
        />
      </Suspense>
    </div>
  );
}
