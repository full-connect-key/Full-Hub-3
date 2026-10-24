import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import { CampanhasDoPortal } from "@/components/portal/telas/campanhas-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { lerFiltroDeCampanha } from "@/lib/dominio/campanhas";

export const metadata: Metadata = { title: "Campanhas" };

export default async function PaginaDeCampanhas({
  searchParams,
}: PageProps<"/portal/campanhas">) {
  await exigirClienteNaTela();
  const params = await searchParams;
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">Campanhas</h1>

        {/* ------------------------------------------------------------------
            "+ NOVA SOLICITAÇÃO", E NÃO "+ SOLICITAR CAMPANHA".

            A proposta pedia o segundo rótulo, com Tipo = "Campanha" já
            escolhido — e **não existe esse tipo**: os quatro de `request_types`
            são Peça para redes, Material impresso, Vídeo e Outro, e o roteiro
            de briefing de cada um é editável pela gestão sem deploy (0068).
            Inventar o quinto aqui seria eu decidindo o vocabulário de briefing
            da agência, que é decisão dela — e um botão que promete um tipo que
            o seletor não tem é um botão que erra na primeira abertura.

            O que o botão faz é o que ele diz. **Quem liga o pedido à campanha
            é o campo `De que campanha é`** do próprio painel (0112), e dentro
            de uma campanha ele já vem preenchido.
            ------------------------------------------------------------------ */}
        <Button asChild>
          <Link href="/portal/solicitacoes?novo=1">
            <Plus aria-hidden />
            Nova solicitação
          </Link>
        </Button>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={4} />}>
        <CampanhasDoPortal
          base="/portal/campanhas"
          clienteId={empresa}
          filtro={lerFiltroDeCampanha(params.filtro)}
        />
      </Suspense>
    </div>
  );
}
