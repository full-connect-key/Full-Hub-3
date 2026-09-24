"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Repeat, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

export type AbaDeWorkflows = "workflows" | "recorrencias";

const ROTULOS: Record<AbaDeWorkflows, { label: string; icone: typeof Workflow }> = {
  workflows: { label: "Workflows", icone: Workflow },
  recorrencias: { label: "Recorrências", icone: Repeat },
};

/**
 * As duas abas de /painel/workflows, na URL.
 *
 * **AS DUAS MORAM NA MESMA TELA, e a proximidade é o argumento.** Um workflow
 * é a cadeia de etapas que toda demanda daquele tipo percorre; uma recorrência
 * é a regra que abre essa demanda sozinha, no dia. Quem configura uma
 * configura a outra — e a recorrência no modo "task por ocorrência" escolhe um
 * workflow como modelo. Em rotas separadas, a pessoa montaria a cadeia num
 * lugar e procuraria onde ligá-la noutro.
 *
 * Link e não estado, como em todo o produto: "olha a regra do Mundo Verde"
 * precisa ser um link, e o selo "Recorrente" da task aponta para
 * `?aba=recorrencias&regra=...`.
 */
export function AbasDeWorkflows({ atual }: { atual: AbaDeWorkflows }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  function href(aba: AbaDeWorkflows) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);
    // Os filtros são da lista de recorrências; levá-los para a aba de
    // workflows deixaria na URL parâmetros que não mudam nada na tela.
    if (aba !== "recorrencias") {
      for (const chave of ["situacao", "cliente", "modo", "regra"]) {
        destino.delete(chave);
      }
    }
    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções de Workflows">
      <ul className="bg-muted inline-flex min-w-max gap-1 overflow-x-auto rounded-xl p-1">
        {(Object.keys(ROTULOS) as AbaDeWorkflows[]).map((aba) => {
          const { label, icone: Icone } = ROTULOS[aba];
          const ativo = aba === atual;
          return (
            <li key={aba}>
              <Link
                href={href(aba)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "bg-surface-card text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
