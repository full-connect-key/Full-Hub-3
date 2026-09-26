import type { Metadata } from "next";
import { Suspense } from "react";

import {
  lerFiltrosDePost,
  SocialDoPortal,
} from "@/components/portal/telas/social-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { prazosDoPortal } from "@/lib/dados/portal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { mesDe } from "@/lib/dominio/posts";

export const metadata: Metadata = { title: "Social Media do cliente" };

/**
 * O mesmo calendário, visto pela equipe.
 *
 * Mesmo componente do portal do cliente, com `clienteId` — obrigatório aqui,
 * porque `is_staff()` enxerga todas as empresas e sem o filtro o calendário de
 * uma mostraria os posts de outra.
 */
export default async function SocialDoClienteVistaPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/social-media">) {
  const { slug } = await params;
  const [cliente, valores] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
  ]);

  const { hoje } = prazosDoPortal();
  const mes =
    typeof valores.mes === "string" && /^\d{4}-\d{2}$/.test(valores.mes)
      ? valores.mes
      : mesDe(hoje);
  // A VISÃO VEM DA URL, e o que não é uma das três cai no calendário.
  const visao =
    valores.visao === "lista" || valores.visao === "feed"
      ? valores.visao
      : "calendario";
  const dia =
    typeof valores.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valores.dia)
      ? valores.dia
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Social Media</h1>
        <p className="text-text-muted mt-1">
          O calendário que {cliente?.nome_empresa ?? "este cliente"} vê.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <SocialDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
          comoEquipe
          mes={mes}
          visao={visao}
          dia={dia}
          filtros={lerFiltrosDePost(valores)}
        />
      </Suspense>
    </div>
  );
}
