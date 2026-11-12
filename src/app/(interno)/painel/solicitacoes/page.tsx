import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { caixaDeEntrada } from "@/lib/dados/solicitacoes";
import {
  ehStatusDeSolicitacao,
} from "@/lib/dominio/solicitacoes";

import { CaixaDeEntrada } from "./caixa-de-entrada";

export const metadata: Metadata = { title: "Solicitações" };

async function Conteudo({
  status,
  cliente,
}: {
  status: string | undefined;
  cliente: string | undefined;
}) {
  // A FILA DESCE INTEIRA e quem recorta é a tela (0134): as opções de cada
  // dimensão saem do TODO, e não do que sobrou da outra.
  const pedidos = await caixaDeEntrada();

  // HOJE SAI DO SERVIDOR e desce pronto: se a idade de cada pedido fosse
  // calculada no navegador, quem estivesse num fuso à frente veria um destaque
  // diferente do colega ao lado — e é a idade que decide o destaque.
  const hojeISO = new Date().toISOString();

  return (
    <CaixaDeEntrada
      pedidos={pedidos}
      hojeISO={hojeISO}
      statusAtivo={ehStatusDeSolicitacao(status) ? status : null}
      clienteAtivo={cliente ?? null}
    />
  );
}

export default async function Pagina({
  searchParams,
}: PageProps<"/painel/solicitacoes">) {
  await exigirAcessoARota("/painel/solicitacoes");
  if (!(await souDoAtendimento())) forbidden();

  const parametros = await searchParams;
  const status =
    typeof parametros.status === "string" ? parametros.status : undefined;
  const cliente =
    typeof parametros.cliente === "string" ? parametros.cliente : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo status={status} cliente={cliente} />
      </Suspense>
    </div>
  );
}
