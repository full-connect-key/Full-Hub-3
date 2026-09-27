import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { exigirCliente } from "@/lib/auth/dal";
import { materiaisDaDemanda, prazosDoPortal } from "@/lib/dados/portal";
import { pedido } from "@/lib/dados/solicitacoes";

import { DetalheDoPedido } from "./detalhe";

export const metadata: Metadata = { title: "Pedido" };

export default async function Pagina({ params }: PageProps<"/portal/solicitacoes/[id]">) {
  await exigirCliente();
  const { id } = await params;

  const dados = await pedido(id);
  // Sem linha é a RLS dizendo "este pedido não é da sua empresa", e 404 é a
  // resposta certa. O erro do `select` já estourou dentro de `pedido()`.
  if (!dados) notFound();

  // A DEMANDA SÓ É LEGÍVEL PARA ELE QUANDO ALGO DELA FOI ENVIADO —
  // `tasks_select_cliente` exige uma rodada de escopo cliente. Então
  // `dados.demanda` nulo já quer dizer "nada chegou", e a lista sai vazia
  // pelos dois caminhos, que é coerente: a tela desenha o vazio a partir do
  // estado do pedido, nunca da ausência da demanda.
  const { hoje } = prazosDoPortal();
  const materiais = dados.demanda
    ? await materiaisDaDemanda(dados.client_id, dados.demanda.id)
    : [];

  return <DetalheDoPedido pedido={dados} base="/portal" hoje={hoje} materiais={materiais} />;
}
