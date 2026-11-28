import type { ReactNode } from "react";

import type { ColunaDoQuadro } from "@/lib/dominio/solicitacoes";

/**
 * O quadro das solicitações: uma coluna por estado, com os cards dentro.
 *
 * ---------------------------------------------------------------------------
 * **A CASCA É COMPARTILHADA E O CARD NÃO É**, que é a decisão do detalhe do
 * material no Portal palavra por palavra: *o que se compartilha é a casca,
 * nunca a leitura*. As duas telas desenham colunas iguais — mesmo cabeçalho,
 * mesma contagem, mesmo vazio, mesma grade — e cards diferentes, porque elas
 * respondem a perguntas diferentes: a da agência diz de quem é o pedido e há
 * quanto tempo ele espera, a do cliente diz o que ele pediu e para quando.
 *
 * E ela é um componente porque são DUAS: a segunda cópia de trinta linhas de
 * grade seria a do PORTAL, que a equipe nunca abre — é a história das sete
 * cópias de `abas.tsx` em miniatura.
 * ---------------------------------------------------------------------------
 *
 * **É GRADE E NÃO UMA FAIXA QUE ROLA PARA O LADO.** O board de demandas tem
 * sete colunas e o de etapas tem seis: naquelas larguras não há como não
 * rolar. Cinco cabem — e numa grade a coluna se mede pelo espaço que existe,
 * qualquer que seja ele, em vez de exigir uma largura fixa que o `max-w-6xl`
 * do conteúdo não tem. É a decisão da fila de notas fiscais, com uma coluna a
 * mais.
 *
 * **E A CONTAGEM É POR LARGURA**, como no board de etapas: cinco a partir de
 * 2xl, três no meio e duas no celular. Uma segunda fileira não esconde nada —
 * o que esconde é a barra de rolagem.
 */
/**
 * CADA COLUNA TEM CHÃO E COR. Pedido do usuário: o quadro estava "apagado" —
 * cinco listas soltas no fundo da página. O chão separa as colunas, a pílula
 * dá a cor do estado (os pares cheios de status, já medidos pelo
 * `check:cores`) e os cards ficam brancos em cima.
 */
const PILULA_DA_COLUNA: Record<string, string> = {
  nova: "bg-status-marca text-status-marca-foreground",
  analise: "bg-status-marca text-status-marca-foreground",
  em_analise: "bg-status-atencao text-status-atencao-foreground",
  ajustes: "bg-status-atencao text-status-atencao-foreground",
  em_andamento: "bg-status-laranja text-status-laranja-foreground",
  producao: "bg-status-laranja text-status-laranja-foreground",
  concluida: "bg-status-positivo text-status-positivo-foreground",
  entregue: "bg-status-positivo text-status-positivo-foreground",
  recusada: "bg-status-negativo text-status-negativo-foreground",
  recusado: "bg-status-negativo text-status-negativo-foreground",
};

export function QuadroDePedidos<T>({
  colunas,
  itens,
  colunaDe,
  idDe,
  card,
  teto,
}: {
  colunas: ColunaDoQuadro[];
  itens: T[];
  /** Em que coluna este item cai. */
  colunaDe: (item: T) => string;
  idDe: (item: T) => string;
  card: (item: T) => ReactNode;
  /** Quantos cards uma coluna `encerrada` desenha. */
  teto: number;
}) {
  const porColuna = new Map<string, T[]>(colunas.map((c) => [c.chave, []]));
  for (const item of itens) porColuna.get(colunaDe(item))?.push(item);

  return (
    /*
     * AS CINCO A PARTIR DE `xl`, E ISSO FOI MEDIDO NA IMAGEM.
     *
     * A primeira versão abria as cinco em `2xl` (1536px) e, numa janela de
     * 1500, elas quebravam em DUAS FILEIRAS — com "Concluído" embaixo de
     * "Novo" e a coluna vazia sozinha à direita, que é a leitura "o pedido
     * anda da esquerda para a direita" partida ao meio. O breakpoint do
     * Tailwind é por largura de JANELA e o quadro vive dentro do conteúdo: no
     * painel a barra lateral e o respiro comem uns 400px antes dele.
     *
     * Em `xl` (1280) o conteúdo do painel dá cinco colunas de uns 160px — a
     * largura do board de etapas de Minhas Tasks, onde a conta está escrita —
     * e no portal, que não tem barra lateral, de uns 230px. Abaixo disso são
     * três e depois duas, porque **uma segunda fileira não esconde coisa
     * nenhuma**: o que não se faz é esconder uma coluna atrás de uma barra de
     * rolagem horizontal.
     */
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {colunas.map((coluna) => {
        const todos = porColuna.get(coluna.chave) ?? [];

        // A COLUNA ENCERRADA MOSTRA OS MAIS NOVOS, e é por isso que o teto
        // corta o fim e não o começo: a lista chega na ordem que a tela
        // escolheu, e `encerrada` diz que, nesta coluna, aquela ordem é a
        // inversa da que interessa.
        const ordenados = coluna.encerrada ? [...todos].reverse() : todos;
        const visiveis = coluna.encerrada
          ? ordenados.slice(0, teto)
          : ordenados;
        const cortados = todos.length - visiveis.length;

        return (
          <section
            key={coluna.chave}
            aria-labelledby={`coluna-${coluna.chave}`}
            /* `min-w-0` porque uma célula de grade não encolhe abaixo do
               conteúdo dela por padrão: sem isso, um título comprido num card
               empurra a coluna e desalinha as outras quatro. É a coluna de
               domingo do Cronograma pela enésima vez. */
            className="bg-muted flex min-w-0 flex-col rounded-2xl p-2.5"
          >
            <header className="flex items-center justify-between gap-2 px-0.5 pb-3">
              <h3
                id={`coluna-${coluna.chave}`}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  PILULA_DA_COLUNA[coluna.chave] ?? "bg-card text-text-secondary"
                }`}
              >
                {coluna.titulo}
              </h3>
              {/* A CONTAGEM É DA COLUNA INTEIRA, nunca do que o teto deixou
                  desenhado: ela é o número que a pessoa reconcilia com a
                  lista, e cortá-la junto esconderia o corte. */}
              <span className="bg-card text-text-secondary rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
                {todos.length}
              </span>
            </header>

            <ul className="flex min-w-0 flex-col gap-2.5 px-0.5 pb-1">
              {visiveis.length === 0 ? (
                <li className="text-text-muted bg-card rounded-card border border-dashed px-2 py-5 text-center text-xs font-semibold">
                  {coluna.vazio}
                </li>
              ) : (
                visiveis.map((item) => <li key={idDe(item)}>{card(item)}</li>)
              )}

              {/* O CORTE DIZ QUANTOS FICARAM FORA, que é a regra do Resumo da
                  Agência: cortar calado faz a pessoa concluir que aquilo é
                  tudo. Não é um link porque não há para onde levar — a lista
                  inteira de uma coluna encerrada é o histórico, e ele se lê na
                  conversa com a conta, pelo detalhe de cada pedido. */}
              {cortados > 0 ? (
                <li className="text-text-muted px-1.5 pt-0.5 text-xs font-medium">
                  e mais {cortados}{" "}
                  {cortados === 1 ? "pedido antes" : "pedidos antes"}
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
