"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Qual quadro da composição está em foco, para a tela inteira.
 *
 * ---------------------------------------------------------------------------
 * **POR QUE UM CONTEXTO E NÃO ESTADO LEVANTADO.** O índice do slide nasceu
 * dentro de `VisualizadorDeArte`, que é quem desenha a faixa e o quadro
 * grande. Com a thread passando a ser por card (0126), quem precisa do mesmo
 * índice é a `ThreadDeComentarios` — e entre os dois, na ordem da página,
 * ficam o texto e o histórico de versões.
 *
 * Levantar o estado exigiria que `detalhe-do-conteudo.tsx` o tivesse, e ela é
 * um **componente de SERVIDOR**: estado não mora lá. Envolver a página toda
 * num componente de cliente puxaria o texto e o histórico para o bundle por
 * causa de um número.
 *
 * O contexto resolve as duas coisas: o provedor é cliente, os `children`
 * continuam sendo o RSC renderizado no servidor, e os dois consumidores —
 * que já são de cliente — leem o mesmo número.
 *
 * **DOIS SELETORES INDEPENDENTES SERIAM O ERRO.** O cliente está olhando o
 * terceiro quadro no visualizador; a thread que ele precisa ler é a do
 * terceiro. Com um seletor em cada um, a tela diria duas coisas sobre qual
 * card está em foco — e a que divergiria é a da thread, que é a que decide
 * onde o texto vai ser gravado.
 *
 * **E O HOOK DEVOLVE `null` FORA DO PROVEDOR, em vez de estourar.** A faixa é
 * compartilhada com o editor do social e com o painel lateral do calendário,
 * e nenhum dos dois precisa do foco compartilhado: ali o visualizador cuida do
 * próprio índice, como sempre fez. Um `throw` obrigaria todo chamador a
 * embrulhar a tela para usar um componente que não mudou.
 */
type Foco = {
  /** O quadro em foco, contado de zero. */
  card: number;
  escolher: (indice: number) => void;
};

const ContextoDoCard = createContext<Foco | null>(null);

export function CardSelecionado({ children }: { children: React.ReactNode }) {
  const [card, setCard] = useState(0);

  const valor = useMemo<Foco>(() => ({ card, escolher: setCard }), [card]);

  return (
    <ContextoDoCard.Provider value={valor}>{children}</ContextoDoCard.Provider>
  );
}

/** O foco compartilhado, ou `null` quando a tela não tem provedor. */
export function useCardSelecionado(): Foco | null {
  return useContext(ContextoDoCard);
}
