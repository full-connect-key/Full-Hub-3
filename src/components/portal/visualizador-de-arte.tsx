"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImageOff,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

import { useCardSelecionado } from "@/components/portal/card-selecionado";
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
  marcadores,
}: {
  /** As artes em ordem. Num carrossel, todas — a faixa abaixo do quadro as
   *  mostra lado a lado, e o quadro é onde se aproxima a escolhida. */
  imagens: string[];
  alt: string;
  /** Quantos comentários tem cada quadro — o indicador por card (0126). */
  marcadores?: (number | undefined)[];
}) {
  const quadro = useRef<HTMLDivElement>(null);

  // O FOCO É COMPARTILHADO QUANDO A TELA TEM PROVEDOR, e local quando não tem.
  //
  // Com provedor, quem mais lê o mesmo número é a thread por card: o cliente
  // está olhando o terceiro quadro, e a conversa que ele precisa ler é a do
  // terceiro. Sem ele — o painel lateral do calendário, por exemplo —, o
  // visualizador continua cuidando do próprio índice, como sempre fez.
  const foco = useCardSelecionado();
  const [indiceLocal, setIndiceLocal] = useState(0);
  const indice = foco ? foco.card : indiceLocal;
  const setIndice = foco ? foco.escolher : setIndiceLocal;
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
    [reiniciar, setIndice],
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
          // SEM MOLDURA, E NA PROPORÇÃO DA ARTE (item 10).
          //
          // Era `aspect-square ... rounded-xl border` com fundo próprio: um
          // quadro QUADRADO para qualquer peça. Com `object-contain` dentro
          // dele, um Reels 9:16 saía com duas tarjas cinzas largas nos lados e
          // um banner 16:9 com duas em cima e embaixo — a "moldura" e as
          // "margens artificiais" do pedido, e a razão pela qual a arte
          // parecia errada mesmo estando inteira.
          //
          // **A CAIXA PASSOU A SER DO TAMANHO DA IMAGEM** (`w-fit`), então
          // quadrado sai quadrado, vertical sai vertical e horizontal sai
          // horizontal — sem recorte, sem distorção e sem tarja. Some a borda,
          // some o fundo e some o arredondamento: canto arredondado num quadro
          // que agora encosta na arte corta a própria arte.
          //
          // A ALTURA CONTINUA LIMITADA, e por quê não mudou: um quadrado de
          // largura inteira no desktop dá mais de 900px e empurra as
          // informações e os botões para fora da primeira tela — quem abriu
          // para decidir precisa ver os dois.
          //
          // **`items-center` NÃO É CENTRALIZAÇÃO AQUI, e é a linha que a caixa
          // nova não pode perder.** Item de flex nasce com
          // `align-self: stretch`, e stretch vale para elemento substituído:
          // sem ela a imagem é esticada até a altura da linha — a distorção
          // que este trecho existe para impedir, criada justamente por ter
          // trocado a caixa fixa por uma que se mede pela arte. Com ela a
          // imagem guarda a própria proporção, e a caixa fica do tamanho dela.
          //
          // **E o arquivo precisa ter tamanho**, o que nenhuma peça do produto
          // deixa de ter: a caixa se mede pela imagem, então um arquivo sem
          // dimensão intrínseca colapsa. É o caso do SVG com `viewBox` e nada
          // mais — que o bucket recusa desde a 0120 e que `EH_IMAGEM` já
          // excluía desde a 0053 ("SVG de terceiro dentro de `<img>` é vetor
          // de script"). As artes de exemplo do protótipo ganharam `width` e
          // `height` por isso: sem elas a imagem mostrava o produto num estado
          // que ele não tem — ao contrário.
          "relative mx-auto flex max-h-[min(70vh,600px)] w-fit max-w-full items-center justify-center touch-none overflow-hidden select-none",
          foco?.marcando
            ? "cursor-crosshair"
            : escala > 1
              ? "cursor-grab active:cursor-grabbing"
              : "cursor-zoom-in",
        )}
        onClick={(evento) => {
          // MARCAR UM PONTO (0164): o clique vira uma proporção sobre a
          // IMAGEM, e não um pixel — a arte muda de tamanho em cada tela.
          if (!foco?.marcando) return;
          const img = evento.currentTarget.querySelector("img");
          if (!img) return;
          const r = img.getBoundingClientRect();
          const x = (evento.clientX - r.left) / r.width;
          const y = (evento.clientY - r.top) / r.height;
          if (x < 0 || x > 1 || y < 0 || y > 1) return;
          foco.definirPonto({ x, y, card: indice });
          foco.marcar(false);
          const campo = document.getElementById("comentar-no-material");
          campo?.scrollIntoView({ behavior: "smooth", block: "center" });
          campo?.focus({ preventScroll: true });
        }}
        onDoubleClick={() => {
          if (foco?.marcando) return;
          if (escala > 1) reiniciar();
          else aproximar(1.5);
        }}
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
        {/* É A IMAGEM QUE DÁ O TAMANHO DA CAIXA, e não o contrário: com
            `max-h` e `w-auto` ela chega na altura que couber e a largura sai
            da proporção dela. `object-contain` dentro de uma caixa fixa fazia
            o oposto — cabia a imagem no quadro e sobrava quadro. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={atual}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${posicao.x}px, ${posicao.y}px) scale(${escala})`,
          }}
          className="max-h-[min(70vh,600px)] w-auto max-w-full transition-transform duration-75"
        />

        {/* OS PONTOS JÁ MARCADOS, e o que está sendo marcado agora. Só com a
            arte enquadrada: com zoom a proporção deixa de bater com a tela. */}
        {escala === 1
          ? (foco?.pinos ?? [])
              .filter((p) => p.card === indice)
              .map((p) => (
                <span
                  key={p.numero}
                  aria-label={`Ponto ${p.numero}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  className="bg-action text-action-foreground border-card pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-md"
                >
                  {p.numero}
                </span>
              ))
          : null}
        {escala === 1 && foco?.ponto && foco.ponto.card === indice ? (
          <span
            aria-label="Ponto que você está marcando"
            style={{
              left: `${foco.ponto.x * 100}%`,
              top: `${foco.ponto.y * 100}%`,
            }}
            className="bg-status-atencao text-status-atencao-foreground border-card pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-md"
          >
            +
          </span>
        ) : null}
      </div>

      {foco?.marcando ? (
        <p className="bg-action-soft text-action rounded-lg px-3 py-2 text-sm font-medium">
          Clique no ponto da arte que você quer comentar.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {foco ? (
          <Button
            variant={foco.marcando ? "default" : "outline"}
            size="sm"
            onClick={() => {
              reiniciar();
              foco.marcar(!foco.marcando);
            }}
          >
            <MapPin aria-hidden className="size-4" />
            {foco.marcando ? "Cancelar" : "Marcar na arte"}
          </Button>
        ) : null}
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
          marcadores={marcadores}
        />
      ) : null}
    </div>
  );
}
