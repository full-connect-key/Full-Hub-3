"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Boxes, PackageOpen } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { label: string; icone: typeof Boxes }> = {
  meus: { label: "Meus equipamentos", icone: PackageOpen },
  geral: { label: "Visão geral", icone: Boxes },
};

/**
 * As duas visões da MESMA informação, e é por isso que são abas e não módulos.
 *
 * **Uma aba só não vira barra:** o colaborador vê apenas a dele, e uma
 * navegação de um item é moldura sem função — a mesma razão pela qual as abas
 * do Full Days somem para quem só propõe o próprio período.
 *
 * **E a gestão abre em "Meus equipamentos"**, e não na visão geral. Ela
 * também tem notebook, e a primeira pergunta de quem abre uma tela é sobre
 * si; o panorama é a segunda. É a ordem dos nove blocos da Home.
 */
export function AbasDosComodatos({
  ativa,
  visiveis,
  aceitesPendentes,
}: {
  ativa: Aba;
  visiveis: Aba[];
  /** Quantos recebimentos esperam confirmação. Zero não vira selo. */
  aceitesPendentes: number;
}) {
  const caminho = usePathname();
  const parametros = useSearchParams();

  if (visiveis.length < 2) return null;

  return (
    <nav aria-label="Seções dos comodatos" className="-mb-px flex gap-1 overflow-x-auto">
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
            {chave === "geral" && aceitesPendentes > 0 ? (
              <span className="bg-warning-soft text-warning rounded-full px-1.5 text-xs font-medium tabular-nums">
                {aceitesPendentes}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
