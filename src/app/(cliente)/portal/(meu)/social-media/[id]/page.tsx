import type { Metadata } from "next";

import { DetalheDoPost } from "@/components/portal/telas/detalhe-do-post";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

export const metadata: Metadata = { title: "Material" };

export default async function PaginaDePost({
  params,
}: PageProps<"/portal/social-media/[id]">) {
  await exigirClienteNaTela();
  const { id } = await params;
  const empresas = await obterMinhasEmpresas();

  return (
    <DetalheDoPost
      postId={id}
      base="/portal"
      clienteId={null}
      comoEquipe={false}
      nomeDaEmpresa={empresas[0]?.nome_empresa ?? "Sua empresa"}
      // O "agora" desce do servidor: se o navegador lesse o relógio, o tempo
      // relativo do comentário renderizado no servidor divergiria do que ele
      // calcula na hidratação, e o React acusaria.
      agora={new Date().toISOString()}
    />
  );
}
