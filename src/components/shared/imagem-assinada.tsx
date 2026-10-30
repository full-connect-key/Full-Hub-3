"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * UMA IMAGEM QUE VEM DE URL ASSINADA.
 *
 * ===========================================================================
 * POR QUE NÃO É `next/image`, E A REGRA JÁ ESTAVA ESCRITA NESTA CASA
 *
 * O comentário de `capa-do-cartao.tsx` diz, desde que ele nasceu:
 *
 *   > `next/image` exigiria declarar o domínio do Supabase em `next.config`,
 *   > e a URL assinada muda de assinatura a cada hora — **o cache dele
 *   > guardaria uma que vence**.
 *
 * `visualizador-de-arte.tsx` escreve a mesma coisa com outras palavras. E
 * **cinco telas do portal não seguiam a regra** — a grade do feed, o card do
 * post, o card da fila de aprovações, a célula do calendário e a grade da
 * Biblioteca —, todas passando uma URL assinada por `next/image`.
 *
 * **O MECANISMO DA FALHA É O QUE O COMENTÁRIO NOMEIA.** O otimizador busca a
 * URL no servidor, guarda a cópia otimizada com a URL inteira como CHAVE, e
 * revalida depois. A assinatura vale uma hora: a chave muda a cada render (o
 * token é novo), então o cache quase nunca acerta, e quando ele acerta ou
 * revalida fora da janela o Storage responde 400 — e o que chega ao navegador
 * é uma imagem quebrada. Intermitente, sem erro em tela nenhuma, e só na
 * tela de quem decide.
 *
 * Com a tag simples o navegador busca o endereço que acabou de ser assinado,
 * dentro da janela, sem intermediário que guarde nada.
 *
 * *O que se perde, e é consequência aceita:* o redimensionamento e o `webp`
 * do otimizador. Para uma miniatura de 64px isso é menos do que custa uma
 * imagem que não aparece — e a arte grande do visualizador já abria mão
 * disso de propósito, para o cliente decidir sobre o pixel original.
 *
 * ===========================================================================
 * E O ARQUIVO AUSENTE DIZ ISSO, em vez do ícone quebrado do navegador
 *
 * É o pedido do item 9: *"caso um arquivo esteja ausente ou danificado,
 * exibir uma mensagem clara"*. O ícone de imagem quebrada não distingue "não
 * existe" de "sua conexão caiu" de "o endereço venceu" — e quem está do lado
 * de fora da agência não tem como saber o que fazer com nenhum dos três.
 */
export function ImagemAssinada({
  src,
  alt,
  className,
  aoFalhar,
}: {
  /** O endereço já assinado. Nulo quando a assinatura não veio. */
  src: string | null;
  alt: string;
  className?: string;
  /** O que desenhar no lugar. Sem ele, o aviso padrão. */
  aoFalhar?: React.ReactNode;
}) {
  const [falhou, setFalhou] = useState(false);

  if (!src || falhou) {
    return (
      aoFalhar ?? (
        <span
          className="bg-neutral-soft text-text-muted absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center"
          role="img"
          aria-label={
            src
              ? "O arquivo não pôde ser carregado"
              : "O arquivo não está disponível"
          }
        >
          <ImageOff aria-hidden className="size-5 shrink-0" />
          {/* A FRASE É TRUNCADA, e não escondida por tamanho de contêiner.
              A primeira versão usava `@[7rem]:block`, que é container query —
              e **nenhum dos cinco pais declara `@container`**, então a regra
              nunca casaria e o aviso sairia só com o ícone em toda parte: uma
              frase que o código promete e a tela nunca mostra.

              Onde ela realmente não cabe — a célula de 28px do calendário —
              quem decide é o CHAMADOR, por `aoFalhar`, que é a prop que
              existe para isso. O rótulo acessível leva o texto inteiro de
              qualquer forma. */}
          <span className="line-clamp-2 text-[11px] leading-tight">
            {src ? "Não foi possível carregar" : "Arquivo indisponível"}
          </span>
        </span>
      )
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFalhou(true)}
      className={cn("absolute inset-0 size-full", className)}
    />
  );
}
