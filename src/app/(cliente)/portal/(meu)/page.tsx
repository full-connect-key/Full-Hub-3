import type { Metadata } from "next";
import { Home } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente, primeiroNome } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Início" };

export default async function PaginaInicialDoPortal() {
  const { profile } = await exigirCliente();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${primeiroNome(profile.nome)}`}
      />
      <EmptyState
        icon={Home}
        title="Seu acompanhamento aparece aqui"
        description="Conteúdos para aprovar, campanhas em andamento e os resultados do período. As áreas entram nos próximos sprints."
      />
    </div>
  );
}
