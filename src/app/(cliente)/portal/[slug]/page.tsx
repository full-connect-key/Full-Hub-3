import type { Metadata } from "next";
import { Suspense } from "react";

import { InicioDoPortal } from "@/components/portal/telas/inicio-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";

export const metadata: Metadata = { title: "Portal do cliente" };

/**
 * A tela inicial do portal de um cliente, vista pela equipe.
 *
 * **É o mesmo componente que o cliente vê**, com outro parâmetro — não uma
 * versão parecida. Uma segunda tela "equivalente" divergiria na primeira
 * mudança, e a visualização existe justamente para conferir o que ele enxerga
 * antes de uma reunião.
 *
 * A guarda e o registro da visita estão no layout de /portal/[slug]: chegar
 * aqui já significa ter passado por eles.
 */
export default async function PaginaDoPortalDoCliente({
  params,
}: PageProps<"/portal/[slug]">) {
  const { slug } = await params;
  const cliente = await obterClientePeloSlug(slug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {cliente?.nome_empresa ?? "Portal do cliente"}
        </h1>
        <p className="text-text-muted mt-1">
          O que este cliente vê ao entrar no portal.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={5} />}>
        <InicioDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
          comoEquipe
          nome=""
        />
      </Suspense>
    </div>
  );
}
