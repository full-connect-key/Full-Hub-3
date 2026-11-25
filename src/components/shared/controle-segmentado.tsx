"use client";

import type { LucideIcon } from "lucide-react";

import { ancora, type Ancora } from "@/lib/tour/ancoras";
import { cn } from "@/lib/utils";

export type OpcaoSegmentada<T extends string> = {
  chave: T;
  rotulo: string;
  /** Opcional: o recorte do Acervo não tem ícone, e isso é escolha — não há
   *  desenho óbvio para "Para você", e quatro ícones inventados numa linha de
   *  quatro gomos são ruído onde a palavra já responde. */
  Icone?: LucideIcon;
};

/**
 * UMA CAIXA, N GOMOS, UM ACESO — e a FORMA é que diz "escolha um".
 *
 * ---------------------------------------------------------------------------
 * **ERAM TRÊS CÓPIAS, e é por isso que ele existe.** A casca vivia escrita à
 * mão em `SeletorDeVisao` e em `comodatos/visao-geral.tsx` — com o comentário
 * de lá admitindo a cópia e dizendo que ela **já tinha divergido** (a caixa
 * era opacidade sobre um fundo qualquer, e o item ativo separava por SOMBRA o
 * que o outro separava por COR) —, e o recorte do Acervo seria a terceira.
 *
 * Três é exatamente o limiar de `ICONE_DA_AREA`: três cópias, duas delas já
 * divergidas. Este arquivo é o lugar único, e as três telas o chamam.
 *
 * **O QUE ELE CENTRALIZA É A CASCA, nunca a lista.** Cada tela diz quais são
 * os gomos dela, qual está aceso e o que fazer no clique — é a decisão da
 * `BarraDeContexto` palavra por palavra. O que some é a terceira cópia das
 * oito classes.
 * ---------------------------------------------------------------------------
 * **E ele NÃO é a `BarraDeContexto`.** Aquela navega entre SEÇÕES do módulo:
 * cada uma carrega outra consulta, outro conteúdo, e trocar é trocar de página
 * no servidor. Isto troca o RECORTE ou o DESENHO do mesmo conteúdo. Por isso
 * ele é menor — `p-0.5` contra `p-1`, sem `rounded-xl`: a hierarquia é a
 * informação, e com o mesmo peso a pessoa leria as duas como duas metades da
 * mesma escolha.
 *
 * **Botão com `aria-pressed`, e não um `radiogroup` à mão.** O papel de rádio
 * do ARIA pede navegação por seta escrita no componente, e um grupo de botões
 * dá a cada gomo uma parada de Tab e um estado que o leitor de tela anuncia
 * sem nada a mais. É a forma que as duas cópias já tinham.
 *
 * **`rotuloAcessivel` é obrigatório**, e é a única coisa que ele ganhou em
 * relação às cópias: uma caixa de botões sem nome é um grupo que o leitor
 * anuncia sem dizer de quê — o achado que os 52 `SelectTrigger` do produto já
 * pagaram uma vez.
 */
export function ControleSegmentado<T extends string>({
  opcoes,
  atual,
  aoTrocar,
  rotuloAcessivel,
  ancoraDoTour,
  className,
}: {
  opcoes: readonly OpcaoSegmentada<T>[];
  atual: T;
  aoTrocar: (chave: T) => void;
  rotuloAcessivel: string;
  /** O nome sai de `ANCORAS`, nunca uma string escrita aqui: é o que faz o
   *  typo passar pelo compilador em vez de virar um passo de tour apontando
   *  para o nada. */
  ancoraDoTour?: Ancora;
  className?: string;
}) {
  return (
    // -----------------------------------------------------------------------
    // O par nomeado, e nunca opacidade: a caixa é branca como todo contêiner
    // de conteúdo, e o item ativo usa `--action-soft` com `--action-text` —
    // o mesmo par do item ativo da barra lateral, medido pelo `check:cores`.
    // -----------------------------------------------------------------------
    <div
      role="group"
      aria-label={rotuloAcessivel}
      className={cn(
        "bg-card shadow-cartao inline-flex rounded-lg border p-0.5",
        className,
      )}
      {...(ancoraDoTour ? ancora(ancoraDoTour) : {})}
    >
      {opcoes.map(({ chave, rotulo, Icone }) => (
        <button
          key={chave}
          type="button"
          onClick={() => aoTrocar(chave)}
          aria-pressed={atual === chave}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
            atual === chave
              ? "bg-action-soft text-action-text font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icone ? <Icone aria-hidden className="size-4" /> : null}
          {rotulo}
        </button>
      ))}
    </div>
  );
}
