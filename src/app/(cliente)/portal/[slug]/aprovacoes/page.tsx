import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { minhasAprovacoes } from "@/lib/dados/portal-aprovacoes";

import { ListaDeAprovacoes } from "../../(meu)/aprovacoes/lista";

export const metadata: Metadata = { title: "Aprovações do cliente" };

async function Conteudo({
  usuarioId,
  clienteId,
}: {
  usuarioId: string;
  clienteId: string;
}) {
  // O clienteId é obrigatório aqui. Quem é da equipe enxerga todos os clientes
  // pelo RLS, e sem o filtro o portal de uma empresa mostraria as aprovações
  // de outra.
  const { esperando, decididas } = await minhasAprovacoes(usuarioId, clienteId);
  return (
    <ListaDeAprovacoes
      esperando={esperando}
      decididas={decididas}
      somenteLeitura
    />
  );
}

export default async function AprovacoesDoClienteVistasPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/aprovacoes">) {
  // A guarda e o registro da visita estão no layout de /portal/[slug]: ele
  // envolve esta página, então chegar aqui já significa ter passado por eles.
  const { slug } = await params;
  const [sessao, cliente] = await Promise.all([
    exigirEquipe(),
    obterClientePeloSlug(slug),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Aprovações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <Conteudo usuarioId={sessao.usuarioId} clienteId={cliente?.id ?? ""} />
      </Suspense>
    </div>
  );
}
