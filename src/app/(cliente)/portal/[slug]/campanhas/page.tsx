import type { Metadata } from "next";
import { Suspense } from "react";

import { CampanhasDoPortal } from "@/components/portal/telas/campanhas-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { lerFiltroDeCampanha } from "@/lib/dominio/campanhas";

export const metadata: Metadata = { title: "Campanhas do cliente" };

/**
 * A mesma listagem, vista pela equipe.
 *
 * Mesmo componente do portal do cliente, com `clienteId` — obrigatório aqui,
 * porque `is_staff()` enxerga todas as empresas e sem o filtro a lista de uma
 * mostraria as campanhas de outra.
 */
export default async function CampanhasDoClienteVistasPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/campanhas">) {
  const { slug } = await params;
  const [cliente, valores] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">Campanhas</h1>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <CampanhasDoPortal
          base={`/portal/${slug}/campanhas`}
          clienteId={cliente?.id ?? ""}
          filtro={lerFiltroDeCampanha(valores.filtro)}
        />
      </Suspense>
    </div>
  );
}
