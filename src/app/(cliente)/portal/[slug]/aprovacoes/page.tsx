import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { minhasAprovacoes } from "@/lib/dados/portal-aprovacoes";

import { doProjeto } from "../../(meu)/aprovacoes/do-projeto";
import { ListaDeAprovacoes } from "../../(meu)/aprovacoes/lista";

export const metadata: Metadata = { title: "Aprovações do cliente" };

async function Conteudo({
  usuarioId,
  clienteId,
  base,
  projeto,
}: {
  usuarioId: string;
  clienteId: string;
  base: string;
  projeto: string | null;
}) {
  // O clienteId é obrigatório aqui. Quem é da equipe enxerga todos os clientes
  // pelo RLS, e sem o filtro o portal de uma empresa mostraria as aprovações
  // de outra.
  const { esperando, decididas } = await minhasAprovacoes(usuarioId, clienteId);
  return (
    <ListaDeAprovacoes
      esperando={doProjeto(esperando, projeto)}
      decididas={doProjeto(decididas, projeto)}
      projeto={projeto}
      base={base}
      somenteLeitura
    />
  );
}

export default async function AprovacoesDoClienteVistasPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/aprovacoes">) {
  const valores = await searchParams;
  const projeto = typeof valores.projeto === "string" ? valores.projeto : null;
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
        <Conteudo
          usuarioId={sessao.usuarioId}
          clienteId={cliente?.id ?? ""}
          base={`/portal/${slug}`}
          projeto={projeto}
        />
      </Suspense>
    </div>
  );
}
