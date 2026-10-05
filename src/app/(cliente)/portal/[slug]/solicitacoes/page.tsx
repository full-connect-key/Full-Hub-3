import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirEquipe } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { meusPedidos } from "@/lib/dados/solicitacoes";
import { ehFaseDoPedido, type FaseDoPedido } from "@/lib/dominio/solicitacoes";

import { ListaDePedidos } from "../../(meu)/solicitacoes/lista";

export const metadata: Metadata = { title: "Pedidos do cliente" };

/**
 * A mesma tela, com outro parâmetro — como Início e Materiais.
 *
 * **`clienteId` é obrigatório aqui**, porque quem é da equipe enxerga todos os
 * clientes pelo RLS: sem o filtro, o portal de uma empresa mostraria os
 * pedidos de outra. É a mesma linha das outras telas de `[slug]`.
 *
 * **E `somenteLeitura` desliga o botão de abrir pedido**, porque abrir um
 * pedido em nome do cliente pela tela DELE seria a agência escrevendo como se
 * fosse ele. O caminho para registrar o que chegou por telefone é a fila do
 * painel, onde o pedido nasce assinado por quem o registrou — a policy de
 * INSERT aceita `is_atendimento()` justamente para isso.
 */
async function Conteudo({
  clienteId,
  base,
  fase,
}: {
  clienteId: string;
  base: string;
  fase: FaseDoPedido | null;
}) {
  const pedidos = await meusPedidos(clienteId);
  return (
    <ListaDePedidos
      pedidos={pedidos}
      base={base}
      podeAbrir={false}
      somenteLeitura
      fase={fase}
    />
  );
}

export default async function Pagina({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/solicitacoes">) {
  // A guarda e o registro da visita estão no layout de /portal/[slug].
  const { slug } = await params;
  const [, cliente, parametros] = await Promise.all([
    exigirEquipe(),
    obterClientePeloSlug(slug),
    searchParams,
  ]);

  const pedida =
    typeof parametros.fase === "string" ? parametros.fase : undefined;
  const fase = ehFaseDoPedido(pedida) ? pedida : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" />

      <Suspense
        key={fase ?? "todos"}
        fallback={<LoadingSkeleton variant="table" rows={4} />}
      >
        <Conteudo
          clienteId={cliente?.id ?? ""}
          base={`/portal/${slug}`}
          fase={fase}
        />
      </Suspense>
    </div>
  );
}
