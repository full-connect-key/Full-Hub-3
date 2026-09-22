"use client";

import { cn } from "@/lib/utils";

/**
 * Magnitude por identidade, em barras horizontais.
 *
 * HORIZONTAL e não vertical porque os rótulos são nomes de empresa e de
 * categoria — "Ferramentas e software" deitado numa coluna vira texto girado
 * ou cortado, e os dois são piores que ocupar altura.
 *
 * UMA COR SÓ. A barra já codifica a grandeza pelo comprimento; pintar cada
 * cliente de um tom diferente daria oito cores que não querem dizer nada e
 * ainda esconderia qual é a maior. Isso é trabalho de escala sequencial, não
 * de paleta categórica.
 *
 * Sem legenda: com uma série só, o título já diz o que está plotado, e uma
 * caixinha com um quadrado repetiria o título.
 */

export type BarraDoGrafico = { nome: string; valor: number };

export function GraficoDeBarras({
  barras,
  formatarValor,
  cor = "serie-1",
  /** Acima disso, o resto vira "Outras" — mais de sete classes pede tabela. */
  maximoDeBarras = 7,
  className,
}: {
  barras: BarraDoGrafico[];
  formatarValor: (valor: number) => string;
  cor?: "serie-1" | "serie-2";
  maximoDeBarras?: number;
  className?: string;
}) {
  if (barras.length === 0) {
    return (
      <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
        Sem dados no período.
      </p>
    );
  }

  const ordenadas = [...barras].sort((a, b) => b.valor - a.valor);
  const visiveis = ordenadas.slice(0, maximoDeBarras);
  const resto = ordenadas.slice(maximoDeBarras);
  const lista =
    resto.length > 0
      ? [
          ...visiveis,
          { nome: `Outras (${resto.length})`, valor: resto.reduce((t, b) => t + b.valor, 0) },
        ]
      : visiveis;

  const maximo = Math.max(1, ...lista.map((b) => Math.abs(b.valor)));

  return (
    <ul className={cn("space-y-2.5", className)}>
      {lista.map((barra) => {
        const proporcao = Math.abs(barra.valor) / maximo;
        return (
          <li key={barra.nome} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
            <span className="text-text-secondary truncate text-xs" title={barra.nome}>
              {barra.nome}
            </span>

            {/* Trilho na cor da superfície: ele diz onde acaba a escala, e sem
                ele uma barra curta parece um erro de renderização. */}
            <span className="bg-neutral-soft h-3 w-full overflow-hidden rounded-full">
              <span
                className={cn(
                  "block h-full rounded-full",
                  cor === "serie-1" ? "bg-serie-1" : "bg-serie-2",
                )}
                // A largura é a única coisa que sai de dado, então ela é a
                // única coisa em style. Cor nenhuma passa por aqui.
                style={{ width: `${Math.max(proporcao * 100, 1.5)}%` }}
              />
            </span>

            <span className="text-text-primary text-right text-xs tabular-nums">
              {formatarValor(barra.valor)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
