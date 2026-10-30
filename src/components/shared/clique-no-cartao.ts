"use client";

import { useRef } from "react";

/**
 * Os elementos que já respondem ao clique por conta própria.
 *
 * `[data-radix-collection-item]` entra porque o item de um `Select` aberto
 * vive num portal, e `closest` não acha botão nenhum acima dele.
 */
const INTERATIVOS =
  'a,button,input,select,textarea,label,[role="button"],[role="combobox"],[role="menuitem"],[role="option"],[data-radix-collection-item]';

/** O mesmo 6px da restrição de ativação do `PointerSensor` dos dois boards. */
const ARRASTO_MINIMO = 6;

/**
 * O CARTÃO INTEIRO ABRE OS DETALHES, sem virar um botão gigante.
 *
 * Decisão do usuário: *"toda a superfície do card deve abrir os detalhes,
 * preservando os botões, menus internos e o arrastar e soltar"*. A saída
 * óbvia — `role="button"` mais `tabIndex` no contêiner — é a que o axe
 * reprova: um botão com botões dentro é `nested-interactive`, e na prática
 * são duas paradas de Tab para a mesma coisa. **Este produto já pagou isso
 * uma vez**, no cartão do board que recebia os `attributes` do dnd-kit.
 *
 * Então o clique é do CONTÊINER e o foco continua no NOME, que já é um botão
 * de verdade: o mouse ganha a superfície inteira, o teclado continua com uma
 * parada só, e nada muda na árvore de acessibilidade.
 *
 * **TRÊS COISAS ELE NÃO ROUBA:**
 *
 * - clique em qualquer coisa que já responde — o seletor acima;
 * - clique que terminou uma SELEÇÃO de texto: quem arrastou o cursor para
 *   copiar o nome de uma etapa não está pedindo para abrir nada;
 * - **o fim de um ARRASTO.** O `PointerSensor` do dnd-kit começa o arrasto
 *   depois de 6px, e quando ele termina o navegador ainda dispara o `click`
 *   no elemento — sem esta guarda, soltar um card numa coluna abriria o
 *   painel por cima do board que a pessoa acabou de reorganizar. A conta é a
 *   mesma dos 6px: abaixo disso não foi arrasto, foi clique.
 */
export function useCliqueNoCartao(abrir: () => void) {
  const inicio = useRef<{ x: number; y: number } | null>(null);

  return {
    // `Capture` de propósito: os `listeners` do dnd-kit também escutam
    // `onPointerDown`, e um deles chama `stopPropagation` no bloco das ações.
    // Na fase de captura o evento desce antes de qualquer um deles parar.
    onPointerDownCapture: (evento: React.PointerEvent<HTMLElement>) => {
      inicio.current = { x: evento.clientX, y: evento.clientY };
    },
    onClick: (evento: React.MouseEvent<HTMLElement>) => {
      const partiu = inicio.current;
      inicio.current = null;
      if (partiu) {
        const andou = Math.hypot(evento.clientX - partiu.x, evento.clientY - partiu.y);
        if (andou >= ARRASTO_MINIMO) return;
      }

      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest(INTERATIVOS)) return;
      if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
      abrir();
    },
  };
}
