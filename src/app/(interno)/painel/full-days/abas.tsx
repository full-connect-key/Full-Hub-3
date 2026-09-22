"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeCheck, CalendarRange, ChartColumn, Grid3x3 } from "lucide-react";

import { cn } from "@/lib/utils";

export type Aba = "matriz" | "relatorio" | "solicitar" | "aprovacoes";

const ROTULOS: Record<Aba, { label: string; icone: typeof Grid3x3 }> = {
  matriz: { label: "Matriz da Equipe", icone: Grid3x3 },
  relatorio: { label: "Relatório Gerencial", icone: ChartColumn },
  solicitar: { label: "Solicitar", icone: CalendarRange },
  aprovacoes: { label: "Aprovações", icone: BadgeCheck },
};

/**
 * As abas, na URL.
 *
 * Link e não estado: o sócio precisa poder mandar "olha a fila de aprovações"
 * por mensagem, e a notificação do sino aponta direto para
 * `?aba=aprovacoes`. Com estado interno, os dois links cairiam na aba padrão.
 *
 * Trocar de aba troca a página no servidor, e é por isso que cada aba carrega
 * só a própria consulta — a matriz do mês inteiro não é buscada por quem abriu
 * para pedir um dia de folga.
 *
 * Com uma aba só, a barra some: para o colaborador, que enxerga apenas
 * Solicitar, uma "navegação" de um item é moldura sem função.
 */
export function AbasDoFullDays({ atual, visiveis }: { atual: Aba; visiveis: Aba[] }) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  if (visiveis.length <= 1) return null;

  function href(aba: Aba) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("aba", aba);
    // A fila é da aba de aprovações; carregá-la para a matriz confundiria a
    // leitura da URL sem mudar nada na tela.
    if (aba !== "aprovacoes") destino.delete("fila");
    return `${pathname}?${destino.toString()}`;
  }

  return (
    <nav aria-label="Seções do Full Days" className="border-b">
      <ul className="-mb-px flex min-w-max gap-1 overflow-x-auto">
        {visiveis.map((aba) => {
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
                    ? "border-accent-strong text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
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
