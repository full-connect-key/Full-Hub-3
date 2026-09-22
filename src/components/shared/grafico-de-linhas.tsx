"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Duas séries ao longo do tempo.
 *
 * SVG à mão, sem biblioteca de gráfico. Três razões, nesta ordem: a cor tem
 * que sair dos tokens (`npm run check:cores` recusa hex fora de globals.css, e
 * toda lib traz a própria paleta); o gráfico é pequeno e fixo, então o custo
 * de uma lib inteira no bundle não se paga; e assim o tema escuro funciona
 * sozinho, porque `currentColor` e `var()` já mudam com ele.
 *
 * Por que azul e roxo, e não verde e vermelho: o par verde/vermelho dá ΔE 4,2
 * em deuteranopia — as duas linhas ficam idênticas para quem tem daltonismo
 * vermelho-verde. O par usado aqui dá 9,4. Veja o comentário das cores de
 * gráfico em `globals.css`.
 */

export type PontoDaSerie = { rotulo: string; valores: [number, number] };

export function GraficoDeLinhas({
  pontos,
  series,
  formatarValor,
  className,
}: {
  pontos: PontoDaSerie[];
  /** Exatamente duas. A legenda sai daqui, e ela é sempre visível. */
  series: [string, string];
  formatarValor: (valor: number) => string;
  className?: string;
}) {
  const id = useId();
  const [ativo, setAtivo] = useState<number | null>(null);

  if (pontos.length === 0) {
    return (
      <p className="text-text-muted rounded-card border border-dashed p-8 text-center text-sm">
        Sem dados no período.
      </p>
    );
  }

  const A = 240;
  const MARGEM = { topo: 12, direita: 12, baixo: 28, esquerda: 56 };
  const largura = 720;

  const maximo = Math.max(
    1,
    ...pontos.flatMap((p) => p.valores),
  );
  // O eixo sobe para um número redondo: "R$ 47.312" como topo de escala não
  // ajuda ninguém a ler a altura de nada.
  const teto = arredondarParaCima(maximo);

  const larguraUtil = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = A - MARGEM.topo - MARGEM.baixo;

  const x = (i: number) =>
    MARGEM.esquerda + (pontos.length === 1 ? larguraUtil / 2 : (i * larguraUtil) / (pontos.length - 1));
  const y = (valor: number) => MARGEM.topo + alturaUtil - (valor / teto) * alturaUtil;

  const caminho = (indice: 0 | 1) =>
    pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.valores[indice])}`).join(" ");

  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * teto);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Legenda SEMPRE presente com duas séries: identidade nunca pode
          depender só da cor. */}
      <div className="flex flex-wrap items-center gap-4">
        {series.map((nome, i) => (
          <span key={nome} className="text-text-secondary flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className={cn("h-0.5 w-4 rounded-full", i === 0 ? "bg-serie-1" : "bg-serie-2")}
            />
            {nome}
          </span>
        ))}
      </div>

      <div className="relative">
        {/* O rótulo acessível vem de um <span> fora do SVG, e NÃO de um
            <title> dentro dele: o React 19 trata <title> como o título do
            documento e o iça para o <head>, o que faz o HTML do servidor
            divergir do que o navegador monta — hidratação quebrada (erro 418
            do React) em toda tela que tivesse este gráfico. */}
        <span id={`${id}-titulo`} className="sr-only">
          {series[0]} e {series[1]} em {pontos.length} meses. Os valores estão na tabela abaixo.
        </span>

        <svg
          viewBox={`0 0 ${largura} ${A}`}
          className="h-60 w-full"
          role="img"
          aria-labelledby={`${id}-titulo`}
          onMouseLeave={() => setAtivo(null)}
        >
          {/* Grade: hairline sólida, recessiva. Nunca tracejada. */}
          {marcas.map((valor) => (
            <g key={valor}>
              <line
                x1={MARGEM.esquerda}
                x2={largura - MARGEM.direita}
                y1={y(valor)}
                y2={y(valor)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={MARGEM.esquerda - 8}
                y={y(valor) + 4}
                textAnchor="end"
                className="fill-text-muted text-[11px]"
              >
                {formatarValor(valor)}
              </text>
            </g>
          ))}

          {pontos.map((ponto, i) => (
            <text
              key={ponto.rotulo}
              x={x(i)}
              y={A - 8}
              textAnchor="middle"
              className="fill-text-muted text-[11px]"
            >
              {ponto.rotulo}
            </text>
          ))}

          {/* Linhas de 2px, junta e ponta redondas. */}
          <path d={caminho(0)} fill="none" className="stroke-serie-1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={caminho(1)} fill="none" className="stroke-serie-2" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Faixas invisíveis de acerto: a área clicável é bem maior que o
              ponto, senão acertar um círculo de 4px com o mouse é sorte. */}
          {pontos.map((ponto, i) => (
            <rect
              key={`alvo-${ponto.rotulo}`}
              x={x(i) - larguraUtil / (pontos.length * 2)}
              y={MARGEM.topo}
              width={larguraUtil / pontos.length}
              height={alturaUtil}
              fill="transparent"
              onMouseEnter={() => setAtivo(i)}
            />
          ))}

          {ativo !== null ? (
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={MARGEM.topo}
              y2={MARGEM.topo + alturaUtil}
              className="stroke-input"
              strokeWidth={1}
            />
          ) : null}

          {/* O anel na cor da superfície é o que mantém o ponto legível onde
              as duas linhas se cruzam. */}
          {ativo !== null
            ? ([0, 1] as const).map((s) => (
                <circle
                  key={s}
                  cx={x(ativo)}
                  cy={y(pontos[ativo].valores[s])}
                  r={5}
                  className={cn(
                    s === 0 ? "fill-serie-1" : "fill-serie-2",
                    "stroke-surface-card",
                  )}
                  strokeWidth={2}
                />
              ))
            : null}
        </svg>

        {ativo !== null ? (
          <div
            className="bg-surface-card rounded-card pointer-events-none absolute top-2 border px-3 py-2 shadow-sm"
            style={{
              left: `${(x(ativo) / largura) * 100}%`,
              transform: ativo > pontos.length / 2 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <p className="text-text-primary text-xs font-medium">{pontos[ativo].rotulo}</p>
            {series.map((nome, s) => (
              <p key={nome} className="text-text-secondary mt-1 flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", s === 0 ? "bg-serie-1" : "bg-serie-2")}
                />
                {nome}: {formatarValor(pontos[ativo].valores[s])}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 47.312 vira 50.000; 4.731 vira 5.000. Escala redonda se lê de relance. */
function arredondarParaCima(valor: number): number {
  if (valor <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(valor));
  return Math.ceil(valor / (ordem / 2)) * (ordem / 2);
}
