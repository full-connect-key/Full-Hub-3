import type { Metadata } from "next";
import { Suspense } from "react";

import { BibliotecaDoPortal } from "@/components/portal/telas/biblioteca-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirEquipe } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { lerFiltrosDaBiblioteca } from "@/lib/dominio/biblioteca";
import {
  lerSecaoDaBiblioteca,
  subtituloDaBiblioteca,
} from "@/lib/dominio/biblioteca-de-marca";

export const metadata: Metadata = { title: "Biblioteca do cliente" };

/**
 * A mesma biblioteca, vista pela equipe.
 *
 * `clienteId` é obrigatório: `is_staff()` enxerga todas as empresas, e sem o
 * filtro a grade de uma mostraria o material de outra.
 */
export default async function BibliotecaDoClienteVistaPelaEquipe({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/biblioteca">) {
  const { slug } = await params;
  /* `exigirEquipe()` E NUNCA `exigirVisualizacaoDoPortal()` AQUI: aquela
     REGISTRA a visita, e chamá-la de novo na página gravaria duas linhas por
     abertura — o layout já a chamou. Esta é `cache`ada e só devolve o perfil. */
  const [cliente, valores, { profile }] = await Promise.all([
    obterClientePeloSlug(slug),
    searchParams,
    exigirEquipe(),
  ]);

  const filtros = lerFiltrosDaBiblioteca(valores);
  const secao = lerSecaoDaBiblioteca(valores.secao);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Biblioteca
        </h1>
        <p className="text-text-muted text-sm">
          {subtituloDaBiblioteca(secao, true)}
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <BibliotecaDoPortal
          base={`/portal/${slug}`}
          clienteId={cliente?.id ?? ""}
          filtros={filtros}
          secao={secao}
          contaDoAcervo={cliente?.id ?? null}
          /* QUEM MONTA O ACERVO É `is_gestor()`, que é a frase do usuário —
             *"desenvolvedores e sócios"*. Esconder o botão nunca foi a
             proteção: quem recusa são as policies da 0139 e as do bucket. */
          podeEditarOAcervo={ehGestor(profile.role)}
        />
      </Suspense>
    </div>
  );
}
