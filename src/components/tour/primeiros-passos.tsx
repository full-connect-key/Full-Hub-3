"use client";

import Link from "next/link";
import { Check, Circle, Compass, PartyPopper } from "lucide-react";

import { useTour } from "@/components/tour/provedor-do-tour";
import { Button } from "@/components/ui/button";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";
import type { PrimeirosPassos as Dados } from "@/lib/dados/primeiros-passos";
import type { Tour } from "@/lib/tour/passos";

/**
 * A LISTA DE PRIMEIROS PASSOS, na tela Início.
 *
 * ---------------------------------------------------------------------------
 * **CADA ITEM É DERIVADO**, e a conta inteira está em
 * `lib/dados/primeiros-passos.ts`. Aqui só se desenha.
 *
 * **O BLOCO SOME, e as três situações são diferentes:**
 *
 *   * há pendência → a lista aparece, com os feitos riscados;
 *   * tudo feito e a pessoa é recém-chegada → a linha de parabéns;
 *   * tudo feito e ela está aqui há mais de duas semanas → nada.
 *
 * É a regra dos blocos de exceção da Home: uma caixa dizendo "nada aqui"
 * ocupa todo dia, na primeira tela de todo mundo, o lugar de uma informação
 * que interessa em alguns dias.
 *
 * *O que fica dito em vez de escondido:* o sprint pede a linha de parabéns
 * *"por um dia"*, e aqui ela vale pela janela de boas-vindas inteira. Saber
 * QUANDO o último item foi riscado exigiria um carimbo — e não há nenhum, de
 * propósito: os itens são derivados, e nenhum deles é um clique nesta tela.
 * A janela que já existe é a da admissão, e é ela que fecha o bloco.
 * ---------------------------------------------------------------------------
 */
export function PrimeirosPassos({ dados, tour }: { dados: Dados; tour: Tour }) {
  const { comecar, andando } = useTour();

  if (dados.pendentes === 0 && !dados.recemChegada) return null;

  if (dados.pendentes === 0) {
    return (
      <section
        aria-labelledby="primeiros-passos"
        className="bg-success-soft rounded-card shadow-cartao flex items-start gap-3 border border-transparent p-4"
        {...ancora(ANCORAS.primeirosPassos)}
      >
        <PartyPopper aria-hidden className="text-success mt-0.5 size-5 shrink-0" />
        <div>
          <h2 id="primeiros-passos" className="font-medium">
            Primeiros passos, todos feitos.
          </h2>
          <p className="text-text-muted mt-1 text-sm">
            Bem-vindo de verdade. Daqui para a frente esta tela é o que está te
            esperando.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="primeiros-passos"
      className="bg-card rounded-card shadow-cartao border p-4"
      {...ancora(ANCORAS.primeirosPassos)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="primeiros-passos" className="font-semibold">
          Primeiros passos
        </h2>
        {/* A CONTAGEM FICA NO CABEÇALHO, como em todo grupo deste produto: ela
            é o que diz o tamanho do que falta antes de a pessoa ler a lista. */}
        <p className="text-text-muted text-sm tabular-nums">
          {dados.itens.length - dados.pendentes} de {dados.itens.length}
        </p>
      </div>

      <ul className="mt-3 space-y-1">
        {dados.itens.map((item) => (
          <li key={item.chave} className="flex items-center gap-2.5 text-sm">
            {item.feito ? (
              <Check aria-hidden className="text-success size-4 shrink-0" />
            ) : (
              <Circle aria-hidden className="text-text-muted size-4 shrink-0" />
            )}

            {/* O FEITO FICA RISCADO E SEM LINK, e não desaparece: a lista é a
                resposta de "o que falta para eu estar em casa aqui", e tirar o
                que já foi feito faria o número do cabeçalho não bater com
                nada que a pessoa vê. E o risco é o sinal, não a opacidade —
                opacidade em texto dá uma cor que ninguém mediu, que é a regra
                que o `DateBadge` já pagou uma vez. */}
            {item.feito ? (
              <span className="text-text-muted line-through">{item.titulo}</span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-text-primary hover:text-accent-strong hover:underline"
              >
                {item.titulo}
              </Link>
            ) : (
              <span className="text-text-primary">{item.titulo}</span>
            )}

            {/* O ÚNICO ITEM COM BOTÃO é o do tour, porque ele não é uma tela:
                um link para uma rota qualquer não começaria tour nenhum. */}
            {item.chave === "tour" && !item.feito ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={andando}
                onClick={() => comecar(tour)}
              >
                <Compass aria-hidden />
                Começar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
