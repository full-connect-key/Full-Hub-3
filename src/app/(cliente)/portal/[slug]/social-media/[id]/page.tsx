import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetalheDoPost } from "@/components/portal/telas/detalhe-do-post";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Material do cliente" };

export default async function PostDoClienteVistoPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/social-media/[id]">) {
  const { slug, id } = await params;
  const cliente = await obterClientePeloSlug(slug);
  if (!cliente) notFound();

  return (
    <DetalheDoPost
      postId={id}
      base={`/portal/${slug}`}
      clienteId={cliente.id}
      comoEquipe
      nomeDaEmpresa={cliente.nome_empresa}
      agora={new Date().toISOString()}
    />
  );
}
