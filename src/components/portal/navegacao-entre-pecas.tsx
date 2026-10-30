"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ← ANTERIOR | 3 de 8 | PRÓXIMA → (item 11).
 *
 * ===========================================================================
 * O CONTADOR É DE PEÇAS, e não de slides
 *
 * O pedido diz *"contador de peças"* e *"desabilitar controles quando não
 * houver peça anterior ou posterior"*. Quem percorre as peças é esta
 * navegação, que já existia — e o que faltava nela era dizer o que ela faz,
 * onde a pessoa está e quantas faltam. **A faixa da composição não muda**: um
 * carrossel continua com todos os slides lado a lado, que é decisão do
 * usuário escrita em "O carrossel é a COMPOSIÇÃO INTEIRA" — lá a frase é
 * *"sempre mostrar todas as artes ao mesmo tempo"*, e pôr setas entre slides
 * seria desfazê-la.
 *
 * ===========================================================================
 * É `<Link>` E NÃO BOTÃO, e o teclado é um atalho por cima
 *
 * Cada peça é uma ROTA — o endereço precisa ser compartilhável ("olha esta
 * peça"), abrir em aba nova com o meio ou com Ctrl, e aparecer na barra de
 * status. Um `<button>` com `router.push` perde os três.
 *
 * As setas do teclado são atalho e não a navegação: elas chamam o mesmo
 * `router.push` e **não roubam a tecla de quem está digitando** — num campo
 * de texto ou numa caixa de comentário a seta move o cursor, que é o que ela
 * tem de fazer. É a mesma guarda do atalho `/` da Gestão de Tasks.
 *
 * **E ela não existe quando não há para onde ir:** com uma peça só, o atalho
 * não é registrado e a navegação inteira não é desenhada — dois discos
 * desligados e um "1 de 1" ocupam a linha para dizer que não há nada a fazer.
 */
export function NavegacaoEntrePecas({
  anterior,
  proximo,
  posicao,
  total,
  rotulo,
}: {
  anterior: string | null;
  proximo: string | null;
  posicao: number | null;
  total: number;
  rotulo: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!anterior && !proximo) return;

    function naTecla(evento: KeyboardEvent) {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      // QUEM ESTÁ DIGITANDO FICA COM A TECLA. `isContentEditable` cobre o
      // editor rico, que não é input nem textarea.
      const alvo = evento.target as HTMLElement | null;
      const digitando =
        alvo?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName ?? "");
      if (digitando) return;

      if (evento.key === "ArrowLeft" && anterior) router.push(anterior);
      if (evento.key === "ArrowRight" && proximo) router.push(proximo);
    }

    window.addEventListener("keydown", naTecla);
    return () => window.removeEventListener("keydown", naTecla);
  }, [anterior, proximo, router]);

  if (!anterior && !proximo) return null;

  return (
    <nav aria-label={rotulo} className="flex items-center gap-1.5">
      <Passo href={anterior} rotulo="Peça anterior" lado="anterior" />

      {/* O NÚMERO SÓ APARECE QUANDO ELE É SABIDO. `posicao` é nula quando a
          peça não está na lista do recorte — um material que chegou por link
          direto e não é do mês aberto —, e "— de 8" não informa nada. */}
      {posicao !== null && total > 1 ? (
        <span className="text-text-muted px-1 text-sm tabular-nums">
          {/* A FRASE INTEIRA VAI NUM `sr-only`, e não num `aria-label` no
              `<span>`: a ARIA proíbe nomear um elemento sem papel, e o axe
              reprova em `aria-prohibited-attr` — o nome seria ignorado por
              parte dos leitores e lido por outros, que é o pior dos dois.
              "3 de 8" sozinho não diz de quê. */}
          <span className="sr-only">
            Peça {posicao} de {total}
          </span>
          <span aria-hidden>
            {posicao} de {total}
          </span>
        </span>
      ) : null}

      <Passo href={proximo} rotulo="Próxima peça" lado="proximo" />
    </nav>
  );
}

function Passo({
  href,
  rotulo,
  lado,
}: {
  href: string | null;
  rotulo: string;
  lado: "anterior" | "proximo";
}) {
  const seta =
    lado === "anterior" ? (
      <ChevronLeft aria-hidden className="size-4 shrink-0" />
    ) : (
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    );

  // A PALAVRA SOME NO CELULAR e a seta fica. Em 375px esta linha divide o
  // espaço com o "voltar" e o título; o rótulo acessível continua inteiro nos
  // dois tamanhos, então quem usa leitor de tela nunca ouve só uma seta.
  const palavra = (
    <span className="hidden sm:inline">
      {lado === "anterior" ? "Anterior" : "Próxima"}
    </span>
  );

  const forma =
    "inline-flex min-h-9 items-center gap-1 rounded-md border px-2.5 text-sm font-medium";

  if (!href) {
    return (
      // RECUA PELO TOM E NÃO POR OPACIDADE: opacidade em texto dá uma cor que
      // ninguém mediu, e no tema escuro dá outra — a regra que o `opacity-80`
      // do `DateBadge` e as células do mês vizinho da faixa de
      // disponibilidade já pagaram duas vezes. `--text-muted` sobre `--muted`
      // está medido.
      //
      // E ele FICA NA TELA desligado, em vez de sumir: um controle que some
      // faz a linha mudar de largura ao andar entre as peças, e a seta que
      // estava sob o dedo passa a ser a outra.
      <span aria-hidden className={cn(forma, "bg-muted text-text-muted")}>
        {lado === "anterior" ? seta : null}
        {palavra}
        {lado === "proximo" ? seta : null}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={rotulo} className={cn(forma, "hover:bg-accent transition-colors")}>
      {lado === "anterior" ? seta : null}
      {palavra}
      {lado === "proximo" ? seta : null}
    </Link>
  );
}
