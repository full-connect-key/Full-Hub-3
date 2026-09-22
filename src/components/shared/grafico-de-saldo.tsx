"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Saldo por mês, em colunas que crescem para os dois lados de uma linha zero.
 *
 * O trabalho aqui é POLARIDADE — mês que fechou no azul ou no vermelho —, e é
 * por isso que a forma é coluna divergente e não linha: numa linha, o cruzar
 * do zero é um detalhe fácil de não ver; numa coluna divergente ele é a coisa
 * mais visível do gráfico.
 *
 * As duas cores são os polos de uma escala divergente (frio × quente), e o
 * par foi medido: ΔE 20,5 sob protanopia. Verde e vermelho dariam 4,2 — ou
 * seja, nenhum.
 *
 * O polo quente NÃO é `--danger`. Mês negativo não é erro nem alerta do
 * sistema: é um fato do mês, e pintá-lo com a cor de erro transformaria o
 * gráfico num repreensão.
 */

export type MesDoSaldo = { rotulo: string; valor: number };

export function GraficoDeSaldo({
  meses,
  formatarValor,
  className,
}: {
  meses: MesDoSaldo[];
  formatarValor: (valor: number) => string;
  className?: string;
}) {
  const id = useId();

  if (meses.length === 0) {
    return (
      <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
        Sem lançamentos ainda.
      </p>
    );
  }

  const maximo = Math.max(1, ...meses.map((m) => Math.abs(m.valor)));

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex h-40 items-stretch gap-2"
        role="img"
        aria-labelledby={`${id}-titulo`}
      >
        <span id={`${id}-titulo`} className="sr-only">
          Saldo dos últimos {meses.length} meses.{" "}
          {meses.map((m) => `${m.rotulo}: ${formatarValor(m.valor)}`).join(". ")}
        </span>

        {meses.map((mes) => {
          const proporcao = Math.abs(mes.valor) / maximo;
          const positivo = mes.valor >= 0;
          return (
            <div key={mes.rotulo} className="flex min-w-0 flex-1 flex-col">
              {/* Metade de cima e metade de baixo, com a linha do zero entre
                  elas. A coluna cresce a partir da linha, nunca da borda. */}
              <div className="flex flex-1 flex-col justify-end">
                {positivo ? (
                  <span
                    title={`${mes.rotulo}: ${formatarValor(mes.valor)}`}
                    className="bg-serie-1 mx-auto w-full max-w-6 rounded-t"
                    style={{ height: `${Math.max(proporcao * 100, 2)}%` }}
                  />
                ) : null}
              </div>

              <span aria-hidden className="bg-input h-px w-full" />

              <div className="flex flex-1 flex-col justify-start">
                {!positivo ? (
                  <span
                    title={`${mes.rotulo}: ${formatarValor(mes.valor)}`}
                    className="bg-serie-neg mx-auto w-full max-w-6 rounded-b"
                    style={{ height: `${Math.max(proporcao * 100, 2)}%` }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        {meses.map((mes) => (
          <div key={mes.rotulo} className="min-w-0 flex-1 text-center">
            <p className="text-text-muted truncate text-[11px]">{mes.rotulo}</p>
            {/* O valor fica só no último mês: número em cima de cada coluna
                vira ruído, e a informação continua no title e no rótulo
                acessível. */}
            <p
              className={cn(
                "truncate text-[11px] tabular-nums",
                mes === meses[meses.length - 1]
                  ? "text-text-primary font-medium"
                  : "text-transparent",
              )}
            >
              {formatarValor(mes.valor)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
