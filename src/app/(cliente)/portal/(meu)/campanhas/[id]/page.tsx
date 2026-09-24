import type { Metadata } from "next";

import { DetalheDaCampanha } from "@/components/portal/telas/detalhe-da-campanha";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { prazosDoPortal } from "@/lib/dados/portal";

export const metadata: Metadata = { title: "Campanha" };

export default async function PaginaDaCampanha({
  params,
}: PageProps<"/portal/campanhas/[id]">) {
  await exigirClienteNaTela();
  const { id } = await params;

  return (
    <DetalheDaCampanha
      campanhaId={id}
      base="/portal/campanhas"
      clienteId={null}
      // Hoje desce do SERVIDOR: se cada tela lesse o relógio, o navegador em
      // outro fuso classificaria "faltam 7 dias" de um jeito e o alerta de
      // outro.
      hoje={prazosDoPortal().hoje}
    />
  );
}
