import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * A coluna de clientes das Campanhas — decisão do usuário.
 *
 * ---------------------------------------------------------------------------
 * **É UM ÍNDICE, e por isso ela fica à ESQUERDA.**
 *
 * A regra do produto é que a coluna estreita muda de lado conforme o que ela
 * é: em Minhas Tasks, no Início e no Full Days os 306px ficam à direita,
 * porque ali são um RESUMO que acompanha o que a pessoa veio fazer. No Social
 * Media ela fica à esquerda, porque é por onde se entra. Esta é a segunda do
 * segundo tipo: escolher o cliente é o primeiro movimento de quem abre esta
 * tela com dez contas correndo.
 * ---------------------------------------------------------------------------
 *
 * **SÃO LINKS, e não botões.** Eles trocam a consulta do servidor — é trocar
 * de recorte, não de desenho —, e é a distinção que separa a
 * `BarraDeContexto` do seletor de visão. Com estado interno, "olha as
 * campanhas da Mundo Verde" deixaria de ser um link.
 *
 * **A CONTAGEM FICA SEMPRE, inclusive o zero**, e é o que faz a coluna
 * responder antes do clique. É a decisão da faixa de áreas de Minhas Tasks:
 * ali o zero fica porque a linha RESPONDE onde o trabalho está, e "nenhuma" é
 * resposta — justamente o caso de quem procurava a conta e não a encontrava.
 * Esconder o cliente sem campanha faria a coluna deixar de ser "todos os
 * clientes" e passar a ser "os que já têm", que é outra pergunta.
 *
 * **Em 375px ela vira uma faixa que rola de lado**, e o scroll é do `nav`
 * com `min-w-max` no `ul` — as duas coisas na mesma tag não fazem nada, e foi
 * assim que a barra de abas empurrou a página inteira para os lados no Full
 * Days desde o Sprint 6. Empilhada como lista, dez contas poriam a grade de
 * campanhas abaixo de dez linhas que ninguém veio ler.
 */
export function ClientesDasCampanhas({
  clientes,
  total,
  escolhido,
}: {
  clientes: { id: string; nome: string; quantas: number }[];
  /** O total da agência, para a linha "Todas". */
  total: number;
  escolhido: string | null;
}) {
  const classe = (ativo: boolean) =>
    cn(
      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
      ativo
        ? "bg-action-soft text-action-text font-semibold"
        : "text-text-secondary hover:bg-muted",
    );

  return (
    <nav
      aria-label="Campanhas por cliente"
      className="-mx-1 overflow-x-auto px-1 lg:mx-0 lg:px-0"
    >
      <ul className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-0.5">
        <li>
          <Link
            href="/painel/aprovacoes"
            className={classe(escolhido === null)}
          >
            <span>Todas</span>
            <span className="text-text-muted tabular-nums">{total}</span>
          </Link>
        </li>

        {clientes.map((c) => (
          <li key={c.id}>
            <Link
              href={`/painel/aprovacoes?cliente=${c.id}`}
              className={classe(escolhido === c.id)}
              aria-current={escolhido === c.id ? "page" : undefined}
            >
              <span className="truncate">{c.nome}</span>
              <span className="text-text-muted tabular-nums">{c.quantas}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
