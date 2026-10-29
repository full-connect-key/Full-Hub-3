import type { Metadata } from "next";
import { Suspense } from "react";

import { BibliotecaDoPortal } from "@/components/portal/telas/biblioteca-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { lerFiltrosDaBiblioteca } from "@/lib/dominio/biblioteca";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function PaginaDaBiblioteca({
  searchParams,
}: PageProps<"/portal/biblioteca">) {
  await exigirClienteNaTela();
  const params = await searchParams;

  const empresa = typeof params.empresa === "string" ? params.empresa : null;
  const filtros = lerFiltrosDaBiblioteca(params);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Biblioteca
        </h1>
        <p className="text-text-muted text-sm">
          Tudo o que você já aprovou, guardado para baixar depois.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <BibliotecaDoPortal
          base="/portal"
          clienteId={empresa}
          filtros={filtros}
        />
      </Suspense>
    </div>
  );
}
