import type { Metadata } from "next";
import { Suspense } from "react";

import { RelatorioDoPortal } from "@/components/portal/telas/relatorios-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";

export const metadata: Metadata = { title: "Relatório" };

export default async function PaginaDoRelatorio({
  params,
}: PageProps<"/portal/relatorios/[id]">) {
  await exigirClienteNaTela();
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
      <RelatorioDoPortal base="/portal" id={id} />
    </Suspense>
  );
}
