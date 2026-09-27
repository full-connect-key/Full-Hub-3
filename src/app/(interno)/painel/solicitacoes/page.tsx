import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { caixaDeEntrada } from "@/lib/dados/solicitacoes";
import { ehStatusDeSolicitacao } from "@/lib/dominio/solicitacoes";

import { CaixaDeEntrada } from "./caixa-de-entrada";

export const metadata: Metadata = { title: "Solicitações" };

/**
 * A caixa de entrada dos pedidos do cliente (0068).
 *
 * ---------------------------------------------------------------------------
 * **A TELA É DE `is_atendimento()`, e não de `is_gestor()`.**
 *
 * É a mesma função que `tasks_insert` usa desde a 0006, e a razão é direta:
 * converter um pedido em demanda É criar a demanda. Uma segunda pergunta aqui
 * — "e também precisa ser gestão" — não barraria ninguém que a policy já não
 * barre, e barraria a pessoa do Atendimento que o produto diz que é a dona
 * desta fila. É a lição da 0060, e a da 0059 com `abrirMesDeSocial`.
 *
 * Quem decide de verdade é `client_requests_update` no banco. O `MENU` esconde
 * a entrada de quem não alcança, e `exigirAcessoARota` devolve 403 para quem
 * digitar o endereço.
 * ---------------------------------------------------------------------------
 */
async function Conteudo({ status }: { status: string | undefined }) {
  const pedidos = await caixaDeEntrada({
    status: ehStatusDeSolicitacao(status) ? status : null,
  });

  // HOJE SAI DO SERVIDOR e desce pronto: se a idade de cada pedido fosse
  // calculada no navegador, quem estivesse num fuso à frente veria um destaque
  // diferente do colega ao lado — e é a idade que decide o destaque.
  const hojeISO = new Date().toISOString();

  return <CaixaDeEntrada pedidos={pedidos} hojeISO={hojeISO} statusAtivo={status ?? null} />;
}

export default async function Pagina({ searchParams }: PageProps<"/painel/solicitacoes">) {
  await exigirAcessoARota("/painel/solicitacoes");
  const parametros = await searchParams;
  const status = typeof parametros.status === "string" ? parametros.status : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Solicitações" />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo status={status} />
      </Suspense>
    </div>
  );
}
