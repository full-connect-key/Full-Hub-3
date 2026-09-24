"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeCheck, CalendarRange, ChartColumn, Grid3x3 } from "lucide-react";

import { cn } from "@/lib/utils";

export type Aba = "matriz" | "relatorio" | "solicitar" | "aprovacoes";

/**
 * As CHAVES continuam `solicitar` e `aprovacoes` porque estão na URL, e link
 * antigo que quebra é pior que nome antigo em código. Os RÓTULOS mudaram: a
 * equipe é PJ, e uma aba chamada "Aprovações" contradiria, na mesma tela, o
 * "De acordo" / "Preciso remarcar" dos botões logo abaixo dela.
 */
const ROTULOS: Record<Aba, { label: string; icone: typeof Grid3x3 }> = {
  matriz: { label: "Matriz da Equipe", icone: Grid3x3 },
  relatorio: { label: "Relatório Gerencial", icone: ChartColumn },
  solicitar: { label: "Propor período", icone: CalendarRange },
  aprovacoes: { label: "Pedidos da equipe", icone: BadgeCheck },
};

/**
 * As abas, na URL.
 *
 * Link e não estado: o sócio precisa poder mandar "olha a fila" por mensagem,
 * e a notificação do sino aponta direto para `?aba=aprovacoes`. Com estado
 * interno, os dois links cairiam na aba padrão.
 *
 * Trocar de aba troca a página no servidor, e é por isso que cada aba carrega
 * só a própria consulta — a matriz do mês inteiro não é buscada por quem abriu
 * para combinar um dia fora.
 *
 * Com uma aba só, a barra some: para quem só propõe o próprio período, uma
 * "navegação" de um item é moldura sem função.
 */
export function AbasDoFullDays({
  atual,
  visiveis,
}: {
  atual: Aba;
  visiveis: Aba[];
}) {
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
    // PÍLULA, E NÃO SUBLINHADO. A barra sublinhada é do começo do projeto e
    // funciona quando as abas ficam grudadas no conteúdo delas; aqui elas
    // ficam acima do painel de saldo, que já é um bloco com fundo próprio, e
    // duas linhas horizontais seguidas (a borda da aba e a borda do painel)
    // liam como duas divisões sem nada entre elas.
    <nav aria-label="Seções do Full Days">
      <ul className="bg-muted inline-flex min-w-max gap-1 overflow-x-auto rounded-xl p-1">
        {visiveis.map((aba) => {
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
