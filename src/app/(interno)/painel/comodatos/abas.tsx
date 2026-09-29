"use client";

import { Boxes, PackageOpen } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

import type { Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof Boxes }> = {
  meus: { rotulo: "Meus equipamentos", Icone: PackageOpen },
  geral: { rotulo: "Visão geral", Icone: Boxes },
};

/**
 * As duas visões da MESMA informação, e é por isso que são seções e não
 * módulos.
 *
 * **Uma seção só não vira barra**, e quem aplica a regra agora é a
 * `BarraDeContexto`: o colaborador vê apenas a dele, e uma navegação de um
 * item é moldura sem função — a mesma razão pela qual as abas do Full Days
 * somem para quem só propõe o próprio período.
 *
 * **E a gestão abre em "Meus equipamentos"**, e não na visão geral. Ela
 * também tem notebook, e a primeira pergunta de quem abre uma tela é sobre
 * si; o panorama é a segunda. É a ordem dos nove blocos da Home.
 */
export function AbasDosComodatos({
  ativa,
  visiveis,
  aceitesPendentes,
  acoes,
}: {
  ativa: Aba;
  visiveis: Aba[];
  /** Quantos recebimentos esperam confirmação. Zero não vira selo. */
  aceitesPendentes: number;
  acoes?: React.ReactNode;
}) {
  const secoes: SecaoDoModulo<Aba>[] = visiveis.map((chave) => ({
    chave,
    ...ROTULOS[chave],
    ...(chave === "geral"
      ? {
          contagem: aceitesPendentes,
          rotuloDaContagem: `${aceitesPendentes} recebimento(s) esperando confirmação`,
        }
      : {}),
  }));

  return (
    <BarraDeContexto
      rotuloAcessivel="Seções dos comodatos"
      titulo="Comodatos"
      atual={ativa}
      secoes={secoes}
      acoes={acoes}
    />
  );
}
