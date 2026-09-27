"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { label: string; icone: typeof FileText }> = {
  minhas: { label: "Minhas notas", icone: FileText },
  // "A CONFERIR" e não "Todas": a aba é uma fila de trabalho, não um arquivo.
  // O nome diz o que o sócio vai fazer ali, como "Registrar período" no Full
  // Days diz o que a pessoa faz em vez de nomear a tabela.
  conferir: { label: "A conferir", icone: Inbox },
};

/**
 * As abas, na URL — como em toda listagem do produto.
 *
 * O sino manda o sócio para `?aba=conferir`, e sem a aba no endereço a
 * notificação cairia na aba padrão, que é a das notas dele mesmo.
 *
 * **Uma aba só não vira barra**: o colaborador vê só "Minhas notas", e uma
 * navegação de um item é moldura sem função — a mesma razão pela qual as abas
 * do Full Days somem para quem só propõe o próprio período.
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
  const caminho = usePathname();
  const parametros = useSearchParams();

  if (visiveis.length < 2) return null;

  return (
    <nav aria-label="Seções das notas fiscais" className="-mb-px flex gap-1 overflow-x-auto">
      {visiveis.map((chave) => {
        const { label, icone: Icone } = ROTULOS[chave];
        const busca = new URLSearchParams(parametros);
        busca.set("aba", chave);

        return (
          <Link
            key={chave}
            href={`${caminho}?${busca}`}
            aria-current={chave === ativa ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors",
              chave === ativa
                ? "border-accent-strong text-accent-strong font-medium"
                : "text-text-secondary hover:text-text-primary border-transparent",
            )}
          >
            <Icone aria-hidden className="size-4" />
            {label}
            {chave === "conferir" && aConferir > 0 ? (
              <span className="bg-warning-soft text-warning rounded-full px-1.5 text-xs font-medium tabular-nums">
                {aConferir}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
