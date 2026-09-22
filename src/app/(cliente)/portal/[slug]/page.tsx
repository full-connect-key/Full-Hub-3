import type { Metadata } from "next";
import { Home } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Portal do cliente" };

/**
 * A tela inicial do portal de um cliente, vista pela equipe.
 *
 * Mostra o que o cliente vê. Quando as áreas do portal entrarem (Sprints
 * 11–13), esta página passa a reaproveitar os mesmos blocos da tela do cliente
 * em vez de ter conteúdo próprio — é o único jeito de a visualização continuar
 * fiel ao que ele enxerga.
 */
export default async function PaginaDoPortalDoCliente({
  params,
}: PageProps<"/portal/[slug]">) {
  const { slug } = await params;
  const cliente = await obterClientePeloSlug(slug);

  return (
    <div className="space-y-8">
      <PageHeader
        title={cliente?.nome_empresa ?? "Portal do cliente"}
        description="Esta é a tela que o cliente vê ao entrar no portal."
      />
      <EmptyState
        icon={Home}
        title="O acompanhamento do cliente aparece aqui"
        description="Conteúdos para aprovar, campanhas em andamento e os resultados do período. As áreas entram nos próximos sprints."
      />
    </div>
  );
}
