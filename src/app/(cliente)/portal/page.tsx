import type { Metadata } from "next";
import { Home } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente, primeiroNome } from "@/lib/auth/dal";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

export const metadata: Metadata = { title: "Início" };

export default async function PaginaInicialDoPortal() {
  const { profile } = await exigirCliente();
  const empresas = await obterMinhasEmpresas();

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${primeiroNome(profile.nome)}`}
        description={
          empresas.length > 0
            ? `Acompanhamento de ${empresas.map((e) => e.nome_empresa).join(", ")}.`
            : "Seu acesso ao portal da Full Connect Key."
        }
      />
      <EmptyState
        icon={Home}
        title="Seu acompanhamento aparece aqui"
        description="Conteúdos para aprovar, campanhas em andamento e os resultados do período. As áreas entram nos próximos sprints."
      />
    </div>
  );
}
