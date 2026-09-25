"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type Aba = "clientes" | "equipe";

export const ABAS: Aba[] = ["clientes", "equipe"];

const ROTULOS: Record<Aba, { label: string; icone: typeof Users }> = {
  clientes: { label: "Clientes", icone: Building2 },
  equipe: { label: "Equipe", icone: Users },
};

export function ehAba(valor: unknown): valor is Aba {
  return typeof valor === "string" && (ABAS as string[]).includes(valor);
}

/**
 * As duas abas de Gestão de Pessoas, na URL.
 *
 * **Link e não estado**, como as abas do Full Days e pela mesma razão: "olha a
 * ficha do Mundo Verde" precisa ser um link, e trocar de aba precisa sobreviver
 * ao botão de voltar. Com estado interno, um link colado num grupo cairia
 * sempre na aba padrão.
 *
 * E trocar de aba troca a página no SERVIDOR — cada aba carrega só a própria
 * consulta. Quem abriu para cadastrar um cliente não busca a equipe inteira.
 *
 * O componente é o mesmo desenho de `full-days/abas.tsx`, e as duas cópias
 * existem por ora porque aquela carrega uma regra que esta não tem (sumir com
 * uma aba só, porque lá a lista de abas visíveis muda por perfil). No dia em
 * que uma terceira tela precisar disto, vira `components/shared/`.
 */
export function AbasDePessoas({ atual }: { atual: Aba }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  function href(aba: Aba) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);
    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções de Gestão de Pessoas">
      <ul className="bg-muted inline-flex min-w-max gap-1 overflow-x-auto rounded-xl p-1">
        {ABAS.map((aba) => {
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
