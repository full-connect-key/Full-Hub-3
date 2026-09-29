"use client";

import { FileText, Inbox } from "lucide-react";

import { BarraDeContexto, type SecaoDoModulo } from "@/components/shared/barra-de-contexto";

import type { Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { rotulo: string; Icone: typeof FileText }> = {
  minhas: { rotulo: "Minhas notas", Icone: FileText },
  // "A CONFERIR" e não "Todas": a seção é uma fila de trabalho, não um
  // arquivo. O nome diz o que o sócio vai fazer ali, como "Registrar período"
  // no Full Days diz o que a pessoa faz em vez de nomear a tabela.
  conferir: { rotulo: "A conferir", Icone: Inbox },
};

/**
 * As seções, na URL — como em toda listagem do produto.
 *
 * O sino manda o sócio para `?aba=conferir`, e sem a seção no endereço a
 * notificação cairia na padrão, que é a das notas dele mesmo.
 *
 * **Uma seção só não vira barra**: o colaborador vê só "Minhas notas", e uma
 * navegação de um item é moldura sem função.
 */
export function AbasDaNota({
  ativa,
  visiveis,
  aConferir,
}: {
  ativa: Aba;
  visiveis: Aba[];
  /** Quantas esperam o sócio. Zero não vira selo: só o que pede ação aparece. */
  aConferir: number;
}) {
  const secoes: SecaoDoModulo<Aba>[] = visiveis.map((chave) => ({
    chave,
    ...ROTULOS[chave],
    ...(chave === "conferir"
      ? { contagem: aConferir, rotuloDaContagem: `${aConferir} nota(s) esperando conferência` }
      : {}),
  }));

  return (
    <BarraDeContexto rotuloAcessivel="Seções das notas fiscais"
      titulo="Notas Fiscais" atual={ativa} secoes={secoes} />
  );
}
