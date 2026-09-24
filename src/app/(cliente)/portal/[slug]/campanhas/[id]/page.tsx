import type { Metadata } from "next";

import { DetalheDaCampanha } from "@/components/portal/telas/detalhe-da-campanha";
import { prazosDoPortal } from "@/lib/dados/portal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Campanha do cliente" };

export default async function CampanhaVistaPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/campanhas/[id]">) {
  const { slug, id } = await params;
  const cliente = await obterClientePeloSlug(slug);

  return (
    <DetalheDaCampanha
      campanhaId={id}
      base={`/portal/${slug}/campanhas`}
      clienteId={cliente?.id ?? ""}
      hoje={prazosDoPortal().hoje}
    />
  );
}
