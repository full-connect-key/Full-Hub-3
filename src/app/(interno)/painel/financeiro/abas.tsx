"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChartColumn, FileSignature, LayoutDashboard, ListOrdered } from "lucide-react";

import { cn } from "@/lib/utils";

import { ABAS, type Aba } from "./vocabulario";

const ROTULOS: Record<Aba, { label: string; icone: typeof ChartColumn }> = {
  "visao-geral": { label: "Visão Geral", icone: LayoutDashboard },
  lancamentos: { label: "Lançamentos", icone: ListOrdered },
  contratos: { label: "Contratos", icone: FileSignature },
  relatorios: { label: "Relatórios", icone: ChartColumn },
};

/**
 * As abas do financeiro, na URL.
 *
 * Trocar de aba troca a página no servidor, e é por isso que cada aba carrega
 * só a própria consulta: quem abriu para lançar uma despesa não paga pela
 * série de doze meses da visão geral.
 *
 * Os filtros da lista ficam para trás ao sair dela — `tipo=despesa` numa URL
 * de Contratos não significa nada e só atrapalharia quem lê o endereço.
 */
export function AbasDoFinanceiro({ atual }: { atual: Aba }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  function href(aba: Aba) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);
    if (aba !== "lancamentos") {
      for (const chave of ["tipo", "cliente", "categoria", "situacao"]) destino.delete(chave);
    }
    if (aba !== "relatorios") {
      for (const chave of ["de", "ate"]) destino.delete(chave);
    }
    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções do Financeiro" className="border-b">
      <ul className="-mb-px flex min-w-max gap-1 overflow-x-auto">
        {ABAS.map((aba) => {
          const { label, icone: Icone } = ROTULOS[aba];
          const ativo = aba === atual;
          return (
            <li key={aba}>
              <Link
                href={href(aba)}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
                  ativo
                    ? "border-accent-strong text-accent-strong font-medium"
                    : "text-text-secondary hover:text-text-primary border-transparent",
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
