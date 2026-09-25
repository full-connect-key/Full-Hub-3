"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImageOff,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

import { FaixaDaComposicao } from "@/components/shared/faixa-da-composicao";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A arte, do tamanho que dá para decidir.
 *
 * **Zoom de verdade, e não `object-contain` num quadro fixo.** Quem aprova uma
 * peça precisa ler o texto pequeno do rodapé e conferir se o logo ficou
 * pixelado — é literalmente o pedido de ajuste mais comum. Uma imagem
 * encolhida para caber na tela esconde exatamente o que se está procurando.
 *
 * Três entradas para a mesma ação, porque três pessoas diferentes chegam por
 * caminhos diferentes: a roda do mouse no desktop, a pinça no celular, e os
 * botões — que são o caminho de quem usa teclado e de quem tem o trackpad
 * configurado para rolar a página.
 *
 * **A roda só dá zoom com o ponteiro sobre a imagem**, e a página não rola
 * junto: `preventDefault` num listener não-passivo. Sem isso, tentar aproximar
 * a arte rolaria a página inteira e a imagem sairia da tela — o oposto do que
 * a pessoa pediu.
 */

const MINIMO = 1;
const MAXIMO = 6;

export function VisualizadorDeArte({
  imagens,
  alt,
}: {
  /** As artes em ordem. Num carrossel, todas — a faixa abaixo do quadro as
   *  mostra lado a lado, e o quadro é onde se aproxima a escolhida. */
  imagens: string[];
  alt: string;
}) {
  const quadro = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const [escala, setEscala] = useState(1);
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number } | null>(null);
  const pinca = useRef<number | null>(null);

  const reiniciar = useCallback(() => {
    setEscala(1);
    setPosicao({ x: 0, y: 0 });
  }, []);

  // TROCAR DE IMAGEM REENQUADRA, e isso acontece no próprio handler — não num
  // efeito que observa `indice`. Um `setState` dentro de `useEffect` dispara
  // uma segunda renderização a cada troca, e o React 19 acusa isso como erro
  // de lint com razão: o reenquadramento é consequência do clique, não do
  // valor ter mudado.
  const irPara = useCallback(
    (novo: number) => {
      setIndice(novo);
      reiniciar();
    },
    [reiniciar],
  );

  const aproximar = useCallback((passo: number) => {
    setEscala((atual) => {
      const nova = Math.min(MAXIMO, Math.max(MINIMO, atual + passo));
      if (nova === MINIMO) setPosicao({ x: 0, y: 0 });
      return nova;
    });
  }, []);

  useEffect(() => {
    const elemento = quadro.current;
    if (!elemento) return;

    // `passive: false` de propósito: só um listener não-passivo pode chamar
    // `preventDefault`, e sem ele o navegador rola a página antes de nos
    // entregar o evento.
    const naRoda = (evento: WheelEvent) => {
      evento.preventDefault();
      aproximar(evento.deltaY > 0 ? -0.3 : 0.3);
    };

    elemento.addEventListener("wheel", naRoda, { passive: false });
    return () => elemento.removeEventListener("wheel", naRoda);
  }, [aproximar]);

  function distancia(toques: React.TouchList) {
    const [a, b] = [toques[0], toques[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  const atual = imagens[indice] ?? null;

  if (!atual) {
    return (
      <div className="bg-neutral-soft text-text-muted flex aspect-square w-full items-center justify-center rounded-xl border">
        <span className="flex flex-col items-center gap-2 text-sm">
          <ImageOff aria-hidden className="size-6" />
          Este material ainda não tem arte anexada.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={quadro}
        className={cn(
          // A altura é LIMITADA, e a largura não. Um quadrado de largura
          // inteira no desktop dá mais de 900px de altura e empurra as
          // informações e os botões para fora da primeira tela — quem abriu
          // para decidir precisa ver os dois. No celular o teto nem é
          // alcançado: lá o quadrado tem a largura da tela.
          "bg-neutral-soft relative aspect-square max-h-[min(70vh,600px)] w-full touch-none overflow-hidden rounded-xl border select-none",
          escala > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        onDoubleClick={() => (escala > 1 ? reiniciar() : aproximar(1.5))}
        onPointerDown={(evento) => {
          if (escala === 1) return;
          arrasto.current = {
            x: evento.clientX - posicao.x,
            y: evento.clientY - posicao.y,
          };
          evento.currentTarget.setPointerCapture(evento.pointerId);
        }}
        onPointerMove={(evento) => {
          if (!arrasto.current) return;
          setPosicao({
            x: evento.clientX - arrasto.current.x,
            y: evento.clientY - arrasto.current.y,
          });
        }}
        onPointerUp={() => {
          arrasto.current = null;
        }}
        onTouchStart={(evento) => {
          if (evento.touches.length === 2)
            pinca.current = distancia(evento.touches);
        }}
        onTouchMove={(evento) => {
          if (evento.touches.length !== 2 || pinca.current === null) return;
          const agora = distancia(evento.touches);
          aproximar((agora - pinca.current) / 200);
          pinca.current = agora;
        }}
        onTouchEnd={() => {
          pinca.current = null;
        }}
      >
        {/* `<img>` e não `next/image`: a URL é assinada e expira, o tamanho
            real varia por peça, e o que se quer aqui é o pixel original sem
            redimensionamento no meio — que é justamente o que o otimizador
            faria. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={atual}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${posicao.x}px, ${posicao.y}px) scale(${escala})`,
          }}
          className="size-full object-contain transition-transform duration-75"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Afastar"
          onClick={() => aproximar(-0.5)}
          disabled={escala <= MINIMO}
        >
          <Minus aria-hidden />
        </Button>

        <span className="text-text-muted min-w-12 text-center text-sm tabular-nums">
          {Math.round(escala * 100)}%
        </span>

        <Button
          variant="outline"
          size="icon"
          aria-label="Aproximar"
          onClick={() => aproximar(0.5)}
          disabled={escala >= MAXIMO}
        >
          <Plus aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={reiniciar}
          disabled={escala === MINIMO && posicao.x === 0 && posicao.y === 0}
        >
          <RotateCcw aria-hidden className="size-4" />
          Reenquadrar
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => quadro.current?.requestFullscreen?.()}
          className="ml-auto"
        >
          <Maximize2 aria-hidden className="size-4" />
          Tela cheia
        </Button>
      </div>

      {/* A COMPOSIÇÃO INTEIRA, e não um paginador (decisão do usuário).
          Carrossel é uma peça só que o dedo atravessa: a arte vaza de um
          slide para o outro, e a frase começa no três e termina no quatro.
          Com um de cada vez, o cliente decidia sobre um quinto do material
          cinco vezes, e o emendado — que é o que mais sai errado — não
          aparecia em nenhuma das cinco.

          O quadro grande acima continua sendo onde se aproxima: clicar numa
          arte da faixa a leva para lá. Zoom de verdade num slide de um terço
          da largura não serviria para ler o rodapé pequeno, que é o pedido de
          ajuste mais comum. */}
      {imagens.length > 1 ? (
        <FaixaDaComposicao
          imagens={imagens}
          rotulo={alt}
          atual={indice}
          aoEscolher={irPara}
        />
      ) : null}
    </div>
  );
}
