import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { minhasAprovacoes } from "@/lib/dados/portal-aprovacoes";

import { ListaDeAprovacoes } from "./lista";
import { doProjeto } from "./do-projeto";

export const metadata: Metadata = { title: "Aprovações" };

async function Conteudo({
  usuarioId,
  projeto,
}: {
  usuarioId: string;
  projeto: string | null;
}) {
  const { esperando, decididas } = await minhasAprovacoes(usuarioId);
  return (
    <ListaDeAprovacoes
      esperando={doProjeto(esperando, projeto)}
      decididas={doProjeto(decididas, projeto)}
      projeto={projeto}
    />
  );
}

export default async function PaginaDeAprovacoesDoCliente({
  searchParams,
}: PageProps<"/portal/aprovacoes">) {
  const sessao = await exigirClienteNaTela();
  const params = await searchParams;
  const projeto = typeof params.projeto === "string" ? params.projeto : null;

  return (
    <div className="space-y-8">
      <PageHeader title="Aprovações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo usuarioId={sessao.usuarioId} projeto={projeto} />
      </Suspense>
    </div>
  );
}
