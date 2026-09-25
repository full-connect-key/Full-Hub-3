"use client";

import { cn } from "@/lib/utils";

/**
 * O carrossel inteiro de uma vez: um slide ao lado do outro.
 *
 * Decisão do usuário: *"deixe no layout de carrossel, um slide ao lado do
 * outro, para o cliente ver a composição total dele. Se for mais de 3 slides,
 * tudo bem ser exibido arrastando para o lado, mas sempre mostrar todas as
 * artes ao mesmo tempo."*
 *
 * **Uma por vez era o erro, e ele tem nome: carrossel não é uma pilha de
 * imagens, é uma composição.** Um bom carrossel de feed é desenhado como uma
 * peça só que o dedo atravessa — a arte vaza de um slide para o outro, e a
 * frase começa no três e termina no quatro. Mostrando um de cada vez, quem
 * aprova decide sobre um quinto do material cinco vezes, e o emendado — que é
 * o que mais sai errado — não aparece em nenhuma das cinco.
 *
 * **E por isso os slides ficam ENCOSTADOS, sem vão entre eles.** Um `gap`
 * quebraria exatamente o que a faixa existe para mostrar: onde a arte de um
 * continua na do outro. A fronteira se lê pelo número em cada slide, não por
 * um espaço.
 *
 * **Três cabem na largura, e o resto rola.** O número é do pedido e é bom: com
 * quatro ou cinco espremidos, cada um fica pequeno demais para julgar o
 * rodapé, que é o pedido de ajuste mais comum. Em 375px cabe um e meio — o
 * meio é o que diz que há mais, e sem ele a faixa pareceria ter acabado.
 */
export function FaixaDaComposicao({
  imagens,
  rotulo,
  atual,
  aoEscolher,
  acao,
}: {
  /** As artes em ordem. `null` é slide sem arquivo legível — o quadro fica
   *  vazio em vez de sumir, senão a contagem passa a mentir. */
  imagens: (string | null)[];
  rotulo: string;
  /** Marcado com anel. Só faz sentido quando há uma ação sobre o escolhido. */
  atual?: number;
  aoEscolher?: (indice: number) => void;
  /** O que fica sobre o slide escolhido — o botão de remover, no editor. */
  acao?: React.ReactNode;
}) {
  if (imagens.length === 0) return null;

  const uma = imagens.length === 1;

  return (
    <div
      className={cn(
        "bg-muted overflow-hidden rounded-lg",
        // ROLA SÓ QUANDO PRECISA. Com uma ou duas artes, a barra de rolagem
        // apareceria sem ter para onde rolar em alguns navegadores.
        imagens.length > 3 ? "overflow-x-auto" : "",
      )}
    >
      <ol className="flex" aria-label={`${rotulo} — ${imagens.length} artes`}>
        {imagens.map((imagem, i) => {
          const escolhido = atual === i;
          const Quadro = aoEscolher ? "button" : "div";
          return (
            <li
              key={`${imagem ?? "vazio"}-${i}`}
              className={cn(
                "relative shrink-0",
                // A LARGURA É FRAÇÃO DA FAIXA, e não pixel fixo: no painel
                // lateral do calendário a coluna é estreita, e um `280px`
                // faria um slide só caber onde deviam caber três.
                uma ? "w-full" : "w-1/3 min-w-[min(38%,180px)]",
              )}
            >
              <Quadro
                type={aoEscolher ? "button" : undefined}
                onClick={aoEscolher ? () => aoEscolher(i) : undefined}
                aria-label={aoEscolher ? `Escolher a arte ${i + 1}` : undefined}
                aria-current={escolhido ? "true" : undefined}
                className={cn(
                  "block w-full",
                  aoEscolher ? "cursor-pointer" : "",
                )}
              >
                <span className="bg-muted block aspect-[4/5] max-h-72 overflow-hidden">
                  {imagem ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagem}
                      alt={`${rotulo} — arte ${i + 1} de ${imagens.length}`}
                      className="size-full object-cover"
                      draggable={false}
                    />
                  ) : null}
                </span>
              </Quadro>

              {!uma ? (
                <span className="bg-brand-navy/80 absolute top-1.5 left-1.5 rounded px-1.5 text-xs font-medium text-white tabular-nums">
                  {i + 1}
                </span>
              ) : null}

              {escolhido ? (
                <>
                  <span
                    aria-hidden
                    className="ring-accent-strong pointer-events-none absolute inset-0 ring-2 ring-inset"
                  />
                  {acao ? (
                    <span className="absolute bottom-1.5 left-1.5">{acao}</span>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
