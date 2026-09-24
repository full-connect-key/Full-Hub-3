import type { Metadata } from "next";

import { DetalheDoEntregavel } from "@/components/portal/telas/detalhe-do-entregavel";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Material do cliente" };

/**
 * O mesmo detalhe, em modo leitura.
 *
 * `comoEquipe` desliga os botões e troca as frases. A recusa de verdade
 * continua sendo `decidir_rodada_do_cliente` no Postgres, que recusa quem não
 * é o cliente daquela rodada — montar a chamada à mão não adianta.
 */
export default async function EntregavelVistoPelaEquipe({
  params,
}: PageProps<"/portal/[slug]/campanhas/[id]/[entregavelId]">) {
  const { slug, id, entregavelId } = await params;
  const cliente = await obterClientePeloSlug(slug);

  return (
    <DetalheDoEntregavel
      entregavelId={entregavelId}
      campanhaId={id}
      base={`/portal/${slug}/campanhas`}
      clienteId={cliente?.id ?? ""}
      comoEquipe
      nomeDaEmpresa={cliente?.nome_empresa ?? "O cliente"}
      agora={new Date().toISOString()}
    />
  );
}
