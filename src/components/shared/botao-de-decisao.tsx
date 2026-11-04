"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DECISOES, type Decisao } from "@/lib/aprovacoes/decisoes";
import { cn } from "@/lib/utils";

/**
 * O botão de uma das três decisões, com a cor, a palavra e o ícone dela.
 *
 * **O que ele centraliza é o DESENHO e o MECANISMO**, e a lista também — pela
 * razão escrita em `lib/aprovacoes/decisoes.ts`: são sempre as mesmas três
 * decisões, em todo módulo, e era a palavra que estava divergindo.
 *
 * **O QUE FICA EM CADA CHAMADOR é o que é da tela dele:** o tamanho (a fila
 * usa `sm`, o detalhe do material usa o normal), a posição na linha, e o
 * `rotulo` quando a frase é outra — no rodapé de um diálogo o botão não diz
 * "Solicitar ajustes" de novo, ele diz o que o clique faz. O que some é a
 * decisão de qual verde, qual ícone e qual palavra.
 *
 * **O ÍCONE VIRA O RELÓGIO ENQUANTO CARREGA, e não entra ao lado dele.** Dois
 * glifos num botão de oito caracteres empurram o rótulo para fora, e foi a
 * imagem que mostrou isso na fila — onde o botão tem `size="sm"`.
 */
export function BotaoDeDecisao({
  decisao,
  rotulo,
  size = "default",
  carregando = false,
  disabled = false,
  className,
  onClick,
  ...resto
}: {
  decisao: Decisao;
  /** Outra frase, quando o botão confirma em vez de oferecer. */
  rotulo?: string;
  size?: "sm" | "default";
  carregando?: boolean;
} & Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const { rotulo: padrao, Icone, variant } = DECISOES[decisao];

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || carregando}
      className={className}
      onClick={onClick}
      {...resto}
    >
      {carregando ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : (
        <Icone aria-hidden />
      )}
      {rotulo ?? padrao}
    </Button>
  );
}

/**
 * A mesma decisão onde ela não cabe como botão cheio: um item de menu.
 *
 * **A COR É DO TEXTO e não do fundo**, e a troca é deliberada: um fundo verde
 * ocupando a linha inteira de um `DropdownMenuItem` se lê como "selecionado",
 * que é o que o `focus` daquele item já faz — e aí a cor passaria a dizer
 * duas coisas. Os três pares de texto sobre o cartão estão medidos em
 * `check:cores` (`--popover` aponta para `--surface-card`), e o pior deles é
 * 5,02:1.
 *
 * O ícone vem junto, pela regra de sempre: a cor nunca é o único sinal.
 */
export function ConteudoDaDecisao({
  decisao,
  rotulo,
}: {
  decisao: Decisao;
  rotulo?: string;
}) {
  const { rotulo: padrao, Icone, classeDeTexto } = DECISOES[decisao];
  return (
    <span className={cn("inline-flex items-center gap-2", classeDeTexto)}>
      <Icone aria-hidden className="size-4" />
      {rotulo ?? padrao}
    </span>
  );
}
