"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FaixaDaComposicao } from "@/components/shared/faixa-da-composicao";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";

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
      {/* A COMPOSIÇÃO INTEIRA, lado a lado (decisão do usuário). Quem produz
          confere o emendado — a arte que vaza de um slide para o outro, a
          frase que começa no três e termina no quatro —, e isso não aparece
          num slide de cada vez. É a mesma faixa que o cliente vê no portal:
          duas telas com dois desenhos divergiriam, e a divergência apareceria
          no lugar mais caro, que é o que a agência olha antes de mandar. */}
      <FaixaDaComposicao
        imagens={slides.map((s) => s.assinada)}
        rotulo={alt}
        atual={podeEditar ? atual : undefined}
        aoEscolher={podeEditar ? setIndice : undefined}
        acao={
          podeEditar ? (
            <ConfirmDialog
              title={
                slides.length > 1 ? `Remover a arte ${atual + 1}?` : "Remover a arte?"
              }
              description="Fica gravado como uma versão nova. A anterior continua no histórico, com o arquivo que saiu."
              confirmLabel="Remover"
              onConfirm={() => apagar(atual)}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={removendo}
                  aria-label={
                    slides.length > 1
                      ? `Remover a arte ${atual + 1}`
                      : "Remover a arte"
                  }
                >
                  <Trash2 aria-hidden className="size-3.5" />
                  Remover
                </Button>
              }
            />
          ) : null
        }
      />

      {slides.length > 1 ? (
        <p className="text-text-muted text-xs tabular-nums">
          {slides.length} artes · toque numa para escolher
        </p>
      ) : null}
    </div>
  );
}

