import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { listarTiposComFluxo } from "@/lib/dados/workflows";

import { Workflows } from "./workflows";

export const metadata: Metadata = { title: "Workflows" };

async function Conteudo() {
  const [tipos, clientes, equipe] = await Promise.all([
    listarTiposComFluxo(),
    listarClientes(),
    listarEquipeAtiva(),
  ]);

  const ativos = clientes
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }));

  return (
    <Workflows
      tipos={tipos}
      clientes={ativos}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}

export default async function PaginaDeWorkflows() {
  await exigirAcessoARota("/painel/workflows");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
