import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { exigirEquipe } from "@/lib/auth/dal";
import { pedido } from "@/lib/dados/solicitacoes";

import { DetalheDoPedido } from "../../../(meu)/solicitacoes/[id]/detalhe";

export const metadata: Metadata = { title: "Pedido do cliente" };

export default async function Pagina({ params }: PageProps<"/portal/[slug]/solicitacoes/[id]">) {
  const { slug, id } = await params;
  await exigirEquipe();

  const dados = await pedido(id);
  if (!dados) notFound();

  // SOMENTE LEITURA, como toda a visualização administrativa: a faixa de aviso
  // do layout já diz que isto é o portal do cliente visto pela equipe, e
  // escrever daqui seria a agência conversando no lugar dele. Quem responde o
  // pedido responde em `/painel/solicitacoes/{id}`, assinando com o próprio
  // nome.
  return <DetalheDoPedido pedido={dados} base={`/portal/${slug}`} somenteLeitura />;
}
