import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ClipboardCheck,
  MessageSquare,
  Receipt,
  Sun,
  type LucideIcon,
} from "lucide-react";

import type { ResumoDaHome } from "@/lib/dados/home";

/**
 * O que está parado esperando esta pessoa.
 *
 * ---------------------------------------------------------------------------
 * ELE É O CONTEÚDO DA TELA, E NÃO O QUARTO BLOCO DELA.
 *
 * Minhas Tasks responde "o que eu faço agora" e lista ETAPAS. O Início
 * responde "o que está me esperando" — e a resposta quase nunca é uma etapa:
 * é um aval, um comentário sem resposta, uma nota que voltou. Por isso ele
 * abre a coluna da esquerda, e por isso cada linha virou CARTÃO SOLTO com
 * ladrilho de ícone: é o mesmo argumento da lista de Minhas Tasks contra o
 * contêiner com fios — num bloco único o que se lê primeiro é a CAIXA, e aqui
 * cada linha é uma decisão separada, em um módulo diferente.
 *
 * **A COR DO LADRILHO É A DO MÓDULO, e nunca urgência.** As seis linhas viviam
 * com o mesmo selo `--warning`, o que dizia que todas cobram a mesma coisa com
 * a mesma pressa — e um aval interno de hoje não é a nota fiscal do mês que
 * vem. Par nomeado sempre, nunca opacidade.
 * ---------------------------------------------------------------------------
 *
 * SÃO CINCO ITENS, E O QUARTO ESPEROU A TABELA EXISTIR.
 *
 * Este comentário dizia "são três e não quatro", e explicava: o sprint pedia
 * as notas fiscais recusadas, e o módulo da pessoa era tela de espera. A 0065
 * criou `team_invoices`, então o quarto entrou — e com ele o quinto, que o
 * sprint não pedia: a fila do sócio.
 *
 * **Os dois são lados opostos do mesmo módulo**, e por isso nunca aparecem
 * juntos para a mesma pessoa: o colaborador vê a nota dele que voltou, o sócio
 * vê as que esperam a conferência dele. O RLS é que separa — para quem não é
 * sócio a contagem da fila é zero porque a policy não devolve as linhas, e não
 * porque um `if` a escondeu.
 *
 * **O bloco some quando não há nada**, como o aviso dos rascunhos. Uma caixa
 * fixa dizendo "nada esperando você" ocupa todo dia, na primeira tela de todo
 * mundo, o lugar de uma informação que interessa em alguns dias.
 *
 * **E a linha que dá zero também some.** O colaborador não decide rodada nem
 * responde pedido de Full Days, então para ele os dois números são zero — e
 * não porque um `if` os escondeu, mas porque a policy não devolve as linhas.
 * Desenhar "0 aprovações" seria ensinar que existe uma fila dele ali.
 */
export function PrecisaDeMim({
  dados,
  notasRecusadas,
  notasEsperandoOSocio,
  notasPedidas,
}: {
  dados: ResumoDaHome["precisa_de_mim"];
  /** As minhas notas que voltaram e cujo mês ainda não tem nota nova. */
  notasRecusadas: number;
  /** Quantas esperam a conferência — zero para quem não é sócio. */
  notasEsperandoOSocio: number;
  /**
   * Meses em que o Financeiro pediu a minha nota e eu ainda não mandei (0066).
   *
   * Aqui e não só no sino: o aviso vira lido no primeiro clique, e depois o
   * pedido não existe em tela nenhuma até a pessoa abrir Notas Fiscais por
   * conta própria. É exatamente "o que está parado me esperando", que é a
   * pergunta deste bloco.
   */
  notasPedidas: number;
}) {
  const linhas = linhasDoPrecisaDeMim({
    dados,
    notasRecusadas,
    notasEsperandoOSocio,
    notasPedidas,
  });

  if (linhas.length === 0) return null;

  return (
    <section id="precisa-de-mim" className="space-y-2.5">
      <h2 className="text-text-secondary text-xs font-bold tracking-wider uppercase">
        Precisa de mim
      </h2>

      <ul className="flex flex-col gap-2">
        {linhas.map((linha) => (
          <li key={linha.href}>
            <Link
              href={linha.href}
              className="group bg-card rounded-card shadow-cartao hover:border-action/40 flex items-center gap-3 border p-3.5 transition-colors"
            >
              <span
                aria-hidden
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${linha.tom}`}
              >
                <linha.Icone className="size-[18px]" />
              </span>
              <span className="text-text-primary text-lg font-bold tabular-nums">
                {linha.quantos}
              </span>
              <span className="text-text-secondary min-w-0 flex-1 text-sm font-semibold">
                {linha.quantos === 1 ? linha.singular : linha.plural}
              </span>
              <ArrowRight
                aria-hidden
                className="text-text-muted group-hover:text-action-text size-4 shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * As linhas, fora do componente porque a tela inicial também PRECISA CONTÁ-LAS.
 *
 * O subtítulo do cabeçalho diz "N coisas esperando você" e leva até aqui, e o
 * número tem que ser exatamente o tamanho desta lista: dois lugares somando
 * por conta própria é o cartão de "11 entregues" com sete na lista embaixo, que
 * o Resumo da Agência já pagou uma vez.
 */
export function linhasDoPrecisaDeMim({
  dados,
  notasRecusadas,
  notasEsperandoOSocio,
  notasPedidas,
}: {
  dados: ResumoDaHome["precisa_de_mim"];
  notasRecusadas: number;
  notasEsperandoOSocio: number;
  notasPedidas: number;
}): {
  quantos: number;
  href: string;
  singular: string;
  plural: string;
  Icone: LucideIcon;
  tom: string;
}[] {
  return [
    {
      quantos: dados?.aprovacoes ?? 0,
      href: "/painel/gestao-tasks?aba=aprovacoes-internas",
      singular: "entrega esperando o seu aval interno",
      plural: "entregas esperando o seu aval interno",
      Icone: ClipboardCheck,
      tom: "bg-action-soft text-action-text",
    },
    {
      quantos: dados?.comentarios ?? 0,
      href: "/painel/social-media",
      singular: "comentário de cliente sem resposta",
      plural: "comentários de cliente sem resposta",
      Icone: MessageSquare,
      tom: "bg-ferias-soft text-ferias",
    },
    {
      quantos: dados?.pedidos_rh ?? 0,
      href: "/painel/full-days?aba=aprovacoes",
      singular: "pedido de Full Days esperando você",
      plural: "pedidos de Full Days esperando você",
      Icone: Sun,
      tom: "bg-warning-soft text-warning",
    },
    {
      quantos: notasRecusadas,
      href: "/painel/notas-fiscais",
      singular: "nota fiscal sua para reenviar",
      plural: "notas fiscais suas para reenviar",
      Icone: Receipt,
      tom: "bg-danger-soft text-danger",
    },
    {
      quantos: notasEsperandoOSocio,
      href: "/painel/notas-fiscais?aba=conferir",
      singular: "nota fiscal da equipe esperando você",
      plural: "notas fiscais da equipe esperando você",
      Icone: Banknote,
      tom: "bg-success-soft text-success",
    },
    {
      quantos: notasPedidas,
      href: "/painel/notas-fiscais",
      singular: "nota fiscal que o Financeiro pediu e você não mandou",
      plural: "notas fiscais que o Financeiro pediu e você não mandou",
      Icone: Receipt,
      tom: "bg-neutral-soft text-neutral",
    },
  ].filter((linha) => linha.quantos > 0);
}
