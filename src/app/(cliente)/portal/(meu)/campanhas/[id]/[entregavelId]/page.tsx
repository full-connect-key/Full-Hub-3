import type { Metadata } from "next";

import { DetalheDoEntregavel } from "@/components/portal/telas/detalhe-do-entregavel";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";

export const metadata: Metadata = { title: "Material" };

export default async function PaginaDoEntregavel({
  params,
}: PageProps<"/portal/campanhas/[id]/[entregavelId]">) {
  await exigirClienteNaTela();
  const { id, entregavelId } = await params;
  const empresas = await obterMinhasEmpresas();

  return (
    <DetalheDoEntregavel
      entregavelId={entregavelId}
      campanhaId={id}
      base="/portal/campanhas"
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
