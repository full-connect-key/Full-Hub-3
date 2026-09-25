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
      <p className="text-text-muted text-xs">{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", COR_DO_VALOR[tom])}>{valor}</p>
      {apoio ? <p className="text-text-muted mt-1 text-xs">{apoio}</p> : null}
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
