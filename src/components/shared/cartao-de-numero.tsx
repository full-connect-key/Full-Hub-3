import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Um número em destaque, com o rótulo em cima e uma frase de apoio embaixo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE COMPARTILHADO, E POR QUE NÃO REAPROVEITA O CARTÃO DO FINANCEIRO
 *
 * Aquele (`financeiro/visao-geral.tsx`) formata dinheiro dentro de si e tem a
 * barra de proporção contra o previsto — os dois são do módulo dele, e
 * generalizá-los daria um componente com seis props em que quatro são nulas em
 * cada uso. Este carrega o que a Home e as Métricas pedem: um valor já
 * formatado, um tom e, quando há para onde ir, um link.
 *
 * **O tom é o PAR NOMEADO, nunca opacidade** — `bg-danger-soft` com
 * `text-danger`, os dois medidos um contra o outro nos dois temas.
 * `bg-danger/10` daria uma cor que ninguém mediu, e outra no tema escuro. A
 * borda fica a do tema: uma borda colorida por opacidade cairia na mesma
 * armadilha por outro caminho.
 * ---------------------------------------------------------------------------
 *
 * **O cartão inteiro é o alvo quando há `href`**, não só o número: alvo
 * pequeno em tela de celular é erro de clique.
 */
const TONS = {
  neutro: "",
  atencao: "bg-warning-soft",
  alerta: "bg-danger-soft",
  bom: "bg-success-soft",
} as const;

const COR_DO_VALOR = {
  neutro: "text-text-primary",
  atencao: "text-warning",
  alerta: "text-danger",
  bom: "text-success",
} as const;

/**
 * O RÓTULO TAMBÉM MUDA COM O TOM, e antes não mudava.
 *
 * Ele era `--text-muted` nos quatro casos — certo sobre o cartão branco e
 * errado sobre os três fundos tingidos, onde dá 4,42:1, 4,03:1 e 4,49:1 a
 * 12px. O par existia em três combinações que ninguém tinha medido: a lista do
 * `check:cores` tinha `--text-muted` sobre o cartão e sobre a página, e um
 * fundo `*-soft` não é nenhum dos dois.
 *
 * `--text-secondary` passa nos três com folga (5,78 a 6,43) e é o tom certo
 * também por leitura: um cartão tingido já está chamando atenção, e o rótulo
 * dele não é a informação mais apagada da tela.
 *
 * Quem achou foi a varredura de acessibilidade do gerador de protótipo, na
 * mesma rodada em que a assinatura da barra lateral foi corrigida — e só
 * apareceu porque a lista passou a mostrar VÁRIOS exemplos por regra. Com um
 * exemplo só, esta causa ficava escondida atrás da primeira.
 */
const COR_DO_ROTULO = {
  neutro: "text-text-muted",
  atencao: "text-text-secondary",
  alerta: "text-text-secondary",
  bom: "text-text-secondary",
} as const;

export function CartaoDeNumero({
  rotulo,
  valor,
  apoio,
  tom = "neutro",
  href,
}: {
  rotulo: string;
  valor: string | number;
  apoio?: string;
  tom?: keyof typeof TONS;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className={cn("text-xs", COR_DO_ROTULO[tom])}>{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", COR_DO_VALOR[tom])}>{valor}</p>
      {apoio ? <p className={cn("mt-1 text-xs", COR_DO_ROTULO[tom])}>{apoio}</p> : null}
    </>
  );

  const classes = cn("rounded-card block border p-4", TONS[tom] || "bg-surface-card");

  if (!href) return <div className={classes}>{conteudo}</div>;

  return (
    <Link
      href={href}
      className={cn(classes, "hover:border-blue-muted focus-visible:ring-ring/50 transition-colors focus-visible:ring-2 focus-visible:outline-none")}
    >
      {conteudo}
    </Link>
  );
}
