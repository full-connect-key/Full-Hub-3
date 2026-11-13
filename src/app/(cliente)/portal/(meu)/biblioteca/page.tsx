import type { Metadata } from "next";
import { Suspense } from "react";

import { BibliotecaDoPortal } from "@/components/portal/telas/biblioteca-do-portal";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirClienteNaTela } from "@/lib/auth/portal-administrativo";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import { lerFiltrosDaBiblioteca } from "@/lib/dominio/biblioteca";
import {
  lerSecaoDaBiblioteca,
  subtituloDaBiblioteca,
} from "@/lib/dominio/biblioteca-de-marca";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function PaginaDaBiblioteca({
  searchParams,
}: PageProps<"/portal/biblioteca">) {
  await exigirClienteNaTela();
  const params = await searchParams;

  const empresa = typeof params.empresa === "string" ? params.empresa : null;
  const filtros = lerFiltrosDaBiblioteca(params);
  const secao = lerSecaoDaBiblioteca(params.secao);

  /* ---------------------------------------------- a conta do acervo de marca --
     A EMPRESA ESCOLHIDA, OU A ÚNICA DE QUEM ESTÁ OLHANDO.

     **A leitura só acontece na seção do acervo**, e só quando ninguém escolheu
     empresa: na grade de materiais ela não decide nada, e uma ida ao banco por
     visita para responder uma pergunta que a tela não faz é o que
     `empresaUnicaDoAcervo()` existe para evitar do outro lado.

     **E ela não serve para a grade de materiais**, que continua derivando a
     empresa do próprio acervo: aqui a resposta tem de existir numa conta nova,
     com o logo guardado e nada aprovado ainda. */
  const contaDoAcervo =
    secao === "marca" && !empresa
      ? ((await obterMinhasEmpresas())[0]?.id ?? null)
      : empresa;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[clamp(24px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.045em] text-balance">
          Biblioteca
        </h1>
        <p className="text-text-muted text-sm">
          {subtituloDaBiblioteca(secao, false)}
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <BibliotecaDoPortal
          base="/portal"
          clienteId={empresa}
          filtros={filtros}
          secao={secao}
          contaDoAcervo={contaDoAcervo}
          /* O CLIENTE SÓ LÊ, e a ausência é a regra do Portal: quem monta o
             acervo é a agência, como quem entra e quem sai. */
          podeEditarOAcervo={false}
        />
      </Suspense>
    </div>
  );
}
