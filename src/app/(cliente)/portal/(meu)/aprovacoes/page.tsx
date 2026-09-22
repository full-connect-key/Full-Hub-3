import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { minhasAprovacoes } from "@/lib/dados/portal-aprovacoes";

import { ListaDeAprovacoes } from "./lista";

export const metadata: Metadata = { title: "Aprovações" };

async function Conteudo({ usuarioId }: { usuarioId: string }) {
  const { esperando, decididas } = await minhasAprovacoes(usuarioId);
  return <ListaDeAprovacoes esperando={esperando} decididas={decididas} />;
}

export default async function PaginaDeAprovacoesDoCliente() {
  const sessao = await exigirCliente();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Aprovações"
        description="O que a agência enviou para você olhar. Aprove ou peça ajustes — em qualquer um dos dois, a equipe é avisada na hora."
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo usuarioId={sessao.usuarioId} />
      </Suspense>
    </div>
  );
}
