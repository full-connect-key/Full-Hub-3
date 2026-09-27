import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { exigirCliente } from "@/lib/auth/dal";
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

  return <DetalheDoPedido pedido={dados} base="/portal" />;
}
