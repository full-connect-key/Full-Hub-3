import type { Metadata } from "next";
import { Suspense } from "react";

import {
  lerFiltrosDePost,
  SocialDoPortal,
} from "@/components/portal/telas/social-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { prazosDoPortal } from "@/lib/dados/portal";
import { mesDe } from "@/lib/dominio/posts";

export const metadata: Metadata = { title: "Social Media" };

/**
 * O calendário de social do cliente.
 *
 * **Mês, visão, dia e filtros moram todos na URL.** É o que faz "olha o dia
 * 15" ser um link, e é o que permite a tela inteira ser renderizada no
 * servidor — nenhum estado sobra para o navegador guardar.
 */
export default async function PaginaDeSocialDoPortal({
  searchParams,
}: PageProps<"/portal/social-media">) {
  await exigirClienteNaTela();
  const params = await searchParams;

  const { hoje } = prazosDoPortal();
  const mes =
    typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes)
      ? params.mes
      : mesDe(hoje);
  const visao = params.visao === "lista" ? "lista" : "calendario";
  const dia =
    typeof params.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dia)
      ? params.dia
      : null;
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Social Media</h1>
        <p className="text-text-muted mt-1">
          O que a Full preparou para as suas redes, mês por mês.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <SocialDoPortal
          base="/portal"
          clienteId={empresa}
          comoEquipe={false}
          mes={mes}
          visao={visao}
          dia={dia}
          filtros={lerFiltrosDePost(params)}
        />
      </Suspense>
    </div>
  );
}
