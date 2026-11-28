import type { Metadata } from "next";
import { Suspense } from "react";

import { RelatorioDoPortal } from "@/components/portal/telas/relatorios-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Relatório do cliente" };

export default async function RelatorioDoClienteVistoPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/relatorios/[id]">) {
  const { slug, id } = await params;
  const [cliente] = await Promise.all([obterClientePeloSlug(slug), exigirEquipe()]);

  return (
    <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
      <RelatorioDoPortal
        base={`/portal/${slug}`}
        id={id}
        clienteId={cliente?.id ?? ""}
      />
    </Suspense>
  );
}
