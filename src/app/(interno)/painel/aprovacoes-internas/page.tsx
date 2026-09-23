import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { filaDeAprovacoes } from "@/lib/dados/aprovacoes";

import { Fila } from "./fila";

export const metadata: Metadata = { title: "Aprovações internas" };

async function Conteudo() {
  const fila = await filaDeAprovacoes();
  return <Fila fila={fila} />;
}

export default async function PaginaDeAprovacoesInternas() {
  await exigirAcessoARota("/painel/aprovacoes-internas");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações internas"
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={5} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
