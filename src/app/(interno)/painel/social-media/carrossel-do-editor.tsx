"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { cn } from "@/lib/utils";

import { removerArquivoDaVersao } from "./acoes";

export type SlideDoEditor = { url: string; assinada: string | null };

/**
 * O carrossel do editor: as artes EM SEQUÊNCIA, e não uma tira de miniaturas.
 *
 * **A tira de 48px não deixava ir de uma imagem para outra**, e era só isso
 * que ela fazia — seis quadradinhos ilegíveis embaixo da capa. Quem produz
 * precisa conferir slide a slide antes de mandar, e o que ele via era o
 * primeiro grande e cinco carimbos.
 *
 * Agora a imagem corrente ocupa o quadro inteiro, as setas andam, e a tira
 * embaixo vira a régua de onde se está — com a atual marcada. Clicar num
 * quadradinho pula direto, que é o caminho de quem quer o slide 5.
 *
 * **Teclado também**: as setas do teclado andam quando o carrossel tem o foco.
 * Um carrossel que só responde ao mouse é um carrossel que metade da equipe
 * não usa.
 *
 * **E cada slide se apaga do próprio quadro.** Remover grava uma VERSÃO NOVA
 * (0048) — a anterior continua no histórico com o arquivo que saiu, que foi o
 * pedido: "sempre registrando no histórico".
 */
export function CarrosselDoEditor({
  postId,
  slides,
  alt,
  podeEditar,
}: {
  postId: string;
  slides: SlideDoEditor[];
  alt: string;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [removendo, remover] = useTransition();

  // O ÍNDICE É GRAMPEADO NA LEITURA, e não num efeito que observa `slides`:
  // remover o último slide deixaria o índice fora da lista por um render, e
  // `slides[3]` de uma lista de 3 é `undefined` — tela branca. Grampear aqui
  // custa uma linha e não dispara renderização em cascata.
  const atual = Math.min(indice, Math.max(0, slides.length - 1));
  const slide = slides[atual];

  function andar(passo: number) {
    if (slides.length === 0) return;
    setIndice((i) => (i + passo + slides.length) % slides.length);
  }

  function apagar(i: number) {
    remover(async () => {
      const r = await chamarAcao(() =>
        removerArquivoDaVersao(postId, slides.length > 1 || i > 0 ? i : null),
      );
      if (r.ok) {
        toast.success(r.mensagem);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (slides.length === 0) {
    return (
      <div className="bg-muted grid aspect-[4/5] max-h-72 place-items-center rounded-lg">
        <span className="text-text-muted text-sm">sem arte ainda</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="group relative"
        tabIndex={0}
        role="group"
        aria-label={`${alt} — slide ${atual + 1} de ${slides.length}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            andar(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            andar(-1);
          }
        }}
      >
        <div className="bg-muted grid aspect-[4/5] max-h-72 place-items-center overflow-hidden rounded-lg">
          {slide?.assinada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.assinada}
              alt={`${alt} — ${atual + 1} de ${slides.length}`}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>

        {slides.length > 1 ? (
          <>
            <Seta lado="esquerda" onClick={() => andar(-1)} />
            <Seta lado="direita" onClick={() => andar(1)} />
            {/* O CONTADOR FICA SEMPRE VISÍVEL, e não só no hover: ele é a
                única coisa que diz que há mais imagens. Escondido, o carrossel
                volta a parecer uma arte só — que é o problema de origem. */}
            <span className="bg-brand-navy/80 absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-medium text-white tabular-nums">
              {atual + 1}/{slides.length}
            </span>
          </>
        ) : null}

        {podeEditar ? (
          <ConfirmDialog
            title={slides.length > 1 ? `Remover o slide ${atual + 1}?` : "Remover a arte?"}
            description="Fica gravado como uma versão nova. A anterior continua no histórico, com o arquivo que saiu."
            confirmLabel="Remover"
            onConfirm={() => apagar(atual)}
            trigger={
              <Button
                variant="outline"
                size="sm"
                disabled={removendo}
                aria-label={
                  slides.length > 1 ? `Remover o slide ${atual + 1}` : "Remover a arte"
                }
                className="absolute bottom-2 left-2"
              >
                <Trash2 aria-hidden className="size-3.5" />
                Remover
              </Button>
            }
          />
        ) : null}
      </div>

      {slides.length > 1 ? (
        <ol className="flex flex-wrap gap-1.5">
          {slides.map((s, i) => (
            <li key={s.url}>
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-current={i === atual ? "true" : undefined}
                aria-label={`Ver o slide ${i + 1}`}
                className={cn(
                  "relative block size-12 overflow-hidden rounded-md transition-all",
                  i === atual
                    ? "ring-accent-strong ring-2 ring-offset-1"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <span className="bg-muted block size-full">
                  {s.assinada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.assinada} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="bg-surface-card text-text-secondary absolute right-0.5 bottom-0.5 rounded px-1 text-[10px]">
                  {i + 1}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Seta({ lado, onClick }: { lado: "esquerda" | "direita"; onClick: () => void }) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "esquerda" ? "Slide anterior" : "Próximo slide"}
      className={cn(
        "bg-surface-card/90 text-text-primary hover:bg-surface-card absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full shadow-sm transition-colors",
        lado === "esquerda" ? "left-2" : "right-2",
      )}
    >
      <Icone aria-hidden className="size-4" />
    </button>
  );
}
