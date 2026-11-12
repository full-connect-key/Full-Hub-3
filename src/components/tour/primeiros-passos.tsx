"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Compass, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { dispensarPrimeiroPasso } from "@/app/(interno)/painel/_actions/primeiros-passos";
import { useTour } from "@/components/tour/provedor-do-tour";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
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
 * ---------------------------------------------------------------------------
 * **E DESDE A 0131 O ITEM PENDENTE TEM CAIXA**, por decisão do usuário:
 * *"quero que o tutorial seja possível ticar os itens, caso a pessoa já saiba
 * como fazer, sem precisar fazer o tutorial necessariamente"*.
 *
 * **SÃO TRÊS DESENHOS E NÃO DOIS, e a diferença é O QUE fechou o item:**
 *
 *   * **pendente** → a caixa vazia, clicável, com o título ainda linkado: os
 *     dois controles respondem perguntas diferentes — o link leva à tela para
 *     FAZER, a caixa diz *"já sei"*;
 *   * **dispensado** → a caixa marcada (o clique desfaz) com `· já sei` ao
 *     lado. **É esta linha que mantém a lista honesta:** sem ela, um item
 *     riscado afirmaria que a foto foi subida, e a foto não foi;
 *   * **derivado-feito** → o visto de sempre, e **nenhum controle**. O fato
 *     não se destica — a foto não desaparece porque alguém desmarcou uma
 *     caixa —, e uma caixa que não pode ser desmarcada é um controle que não
 *     responde ao clique. É a decisão da caixinha do post, palavra por
 *     palavra: *"sem a caixa desligada, e isto é regra deste produto"*.
 *
 * **A CAIXA É O `<input type="checkbox">` NATIVO**, que é o que o resto do
 * produto usa: o Radix traria uma dependência inteira para um controle que o
 * navegador já faz bem, e `accent-brand` já o pinta com a cor da marca.
 *
 * **E ELA NÃO É UM `<label>` EM VOLTA DO TÍTULO**, pela razão de cima: no item
 * pendente o título é um LINK, e um label em volta dele faria o clique no link
 * marcar a caixa junto. O nome vai no `aria-label`, como na caixinha do post.
 *
 * **NÃO HÁ "dispensar tudo"**, e a ausência é decisão: a lista tem cinco
 * linhas, e um *"já conheço a plataforma"* seria o único clique do produto que
 * fecha uma lista que ninguém leu — o que se dispensa item a item se lê item a
 * item. Cinco cliques fecham o bloco de vez.
 * ---------------------------------------------------------------------------
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
  const [gravando, comecarTransicao] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);

  // A CAIXA SEGUE O SERVIDOR, e não um estado otimista: é a forma de
  // `corrente-do-post.tsx`, e aqui ela é a honesta — enquanto a escrita não
  // volta, a caixa desligada diz que está gravando, e uma caixa que já virou
  // afirmaria o que o banco ainda não aceitou.
  function dispensar(chave: string, dispensado: boolean) {
    setMexendo(chave);
    comecarTransicao(async () => {
      const r = await chamarAcao(() => dispensarPrimeiroPasso(chave, dispensado));
      setMexendo(null);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.error);
    });
  }

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
            {item.derivado ? (
              /* O ESTADO NO LUGAR DA CAIXA DESLIGADA, e é a forma da caixinha
                 do post palavra por palavra. Ele ocupa os MESMOS 16px da
                 caixa, e é isso que mantém a coluna alinhada: o `Check` solto
                 desenha o traço uns 3px adentro do slot dele, e ao lado de uma
                 caixa com borda a lista saía com a margem esquerda irregular.
                 Foi a imagem ampliada que mostrou. E o par é nomeado e já
                 medido — `--success` sobre `--success-soft`. */
              <span className="bg-success-soft text-success flex size-4 shrink-0 items-center justify-center rounded-md">
                <Check aria-hidden className="size-3" />
              </span>
            ) : (
              <input
                type="checkbox"
                className="accent-brand size-4 shrink-0"
                checked={item.feito}
                disabled={gravando && mexendo === item.chave}
                onChange={(e) => dispensar(item.chave, e.target.checked)}
                aria-label={
                  item.feito
                    ? `Desmarcar "${item.titulo}" e voltar para a lista`
                    : `Marcar "${item.titulo}" como já sei fazer`
                }
              />
            )}

            {/* O FEITO FICA RISCADO E SEM LINK, e não desaparece: a lista é a
                resposta de "o que falta para eu estar em casa aqui", e tirar o
                que já foi feito faria o número do cabeçalho não bater com
                nada que a pessoa vê. E o risco é o sinal, não a opacidade —
                opacidade em texto dá uma cor que ninguém mediu, que é a regra
                que o `DateBadge` já pagou uma vez.

                E O RISCO É O MESMO NOS DOIS CASOS, de propósito: o item está
                fechado, e é o `· já sei` ao lado que diz qual dos dois
                o fechou. Dois riscos diferentes seriam dois jeitos de dizer a
                mesma coisa, com a distinção escrita na cor. */}
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

            {/* `· já sei` SÓ NO DISPENSADO, e é ele que impede a lista de
                afirmar o que não aconteceu: sem a palavra, o item riscado
                diria que a foto foi subida. No derivado-feito ele não entra —
                ali o fato é o fato, e a frase seria ruído em toda linha. */}
            {item.feito && !item.derivado ? (
              <span className="text-text-muted shrink-0 text-xs">· já sei</span>
            ) : null}

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
