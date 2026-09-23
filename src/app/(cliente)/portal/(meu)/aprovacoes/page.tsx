import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { minhasAprovacoes } from "@/lib/dados/portal-aprovacoes";

import { ListaDeAprovacoes } from "./lista";

export const metadata: Metadata = { title: "Aprovações" };

async function Conteudo({ usuarioId }: { usuarioId: string }) {
  const { esperando, decididas } = await minhasAprovacoes(usuarioId);
  return <ListaDeAprovacoes esperando={esperando} decididas={decididas} />;
}

export default async function PaginaDeAprovacoesDoCliente() {
  const sessao = await exigirClienteNaTela();

  return (
    <div className="space-y-8">
      <PageHeader title="Aprovações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo usuarioId={sessao.usuarioId} />
      </Suspense>
    </div>
  );
}
