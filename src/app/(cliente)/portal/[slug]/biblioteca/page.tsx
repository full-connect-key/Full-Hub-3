import type { Metadata } from "next";
import { Suspense } from "react";

import { BibliotecaDoPortal } from "@/components/portal/telas/biblioteca-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { lerFiltrosDaBiblioteca } from "@/lib/dominio/biblioteca";

export const metadata: Metadata = { title: "Biblioteca do cliente" };

/**
 * A mesma biblioteca, vista pela equipe.
 *
 * `clienteId` é obrigatório: `is_staff()` enxerga todas as empresas, e sem o
 * filtro a grade de uma mostraria o material de outra.
 */
export default async function BibliotecaDoClienteVistaPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/biblioteca">) {
  const { slug } = await params;
  const [cliente, valores] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
  ]);

  const filtros = lerFiltrosDaBiblioteca(valores);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Biblioteca
        </h1>
        <p className="text-text-muted text-sm">
          Tudo o que o cliente já aprovou, guardado para baixar depois.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <BibliotecaDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
          filtros={filtros}
        />
      </Suspense>
    </div>
  );
}
