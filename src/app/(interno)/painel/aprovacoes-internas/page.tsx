import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { filaDeAprovacoes } from "@/lib/dados/aprovacoes";

import { Fila } from "./fila";

export const metadata: Metadata = { title: "Aprovações internas" };

async function Conteudo({ usuarioId }: { usuarioId: string }) {
  const fila = await filaDeAprovacoes(usuarioId);
  return <Fila fila={fila} />;
}

export default async function PaginaDeAprovacoesInternas() {
  const sessao = await exigirAcessoARota("/painel/aprovacoes-internas");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações internas"
        description="O que a equipe produziu e está esperando validação — e o que já tem aval para ir ao cliente."
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={5} />}>
        <Conteudo usuarioId={sessao.usuarioId} />
      </Suspense>
    </div>
  );
}
