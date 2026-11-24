import type { JSONContent } from "@tiptap/core";

import { VisualizadorRico } from "@/components/shared/editor-rico";

/**
 * O briefing que o cliente escreveu, do jeito que ele escreveu.
 *
 * ---------------------------------------------------------------------------
 * **ELE EXISTE PORQUE O BRIEFING DO CLIENTE DEIXOU DE SER TEXTO CRU (0148)** —
 * decisão do usuário: *"quero que quando o cliente pede algo, no portal do
 * cliente, ele tenha espaço para escrever o briefing igual o atendimento da
 * agência. com tabelas, grifando"*. Com a tabela e o grifo gravados, desenhar
 * `descricao` num `<p>` mostraria o texto sem nenhuma das duas — ou seja,
 * jogaria fora exatamente o que o pedido acrescentou.
 *
 * **É COMPARTILHADO PORQUE SÃO DUAS TELAS QUE CONCORDAM** — o detalhe do
 * pedido do lado da agência e o do lado do cliente —, que é o critério do
 * `SeletorDeVisao` e a razão de `CampanhaDoPedido` ao lado: as duas querem
 * dizer a mesma coisa sobre a mesma linha, e a cópia que divergiria é a do
 * PORTAL, que a equipe nunca abre.
 *
 * **SÃO DOIS RAMOS E O SEGUNDO NÃO É LEGADO.** `briefing_rico` nasceu na
 * 0148, então todo pedido anterior a ela tem só o `texto` — e `descricao`
 * continua sendo o que a busca e o briefing da demanda leem, nos dois casos.
 * Desenhar o texto com `whitespace-pre-wrap` é o que mantém de pé a quebra de
 * linha de quem escreveu antes; o `VisualizadorRico` desenha o resto.
 *
 * **E ELE NÃO DESENHA NADA QUANDO NÃO HÁ NADA**, que é a regra dos blocos de
 * exceção: o briefing é opcional desde a 0137, e um bloco permanente dizendo
 * "sem briefing" ocuparia a tela de todos para informar em alguns.
 * ---------------------------------------------------------------------------
 */
export function BriefingDoPedido({
  texto,
  rico,
  className,
}: {
  texto: string | null;
  /**
   * O documento do TipTap, como ele vem do banco.
   *
   * O tipo é `unknown` e não `JSONContent` porque a coluna é `jsonb`: o que a
   * leitura devolve é `Json`, e a conversão mora aqui — num lugar só — em vez
   * de nos dois chamadores. É a forma de `composicaoDoPedido()`, que também
   * recebe o `jsonb` cru.
   */
  rico: unknown;
  className?: string;
}) {
  if (!texto?.trim()) return null;

  // O TEXTO DECIDE SE HÁ BRIEFING, e nunca o documento. Um doc do TipTap sem
  // nada dentro ainda é um parágrafo vazio — guardá-lo é guardar o formato do
  // nada —, e é essa a regra do par `descricao_rica`/`descricao_texto` desde
  // o Sprint 3B.
  const doc = rico as { content?: unknown } | null;
  const temRico = Array.isArray(doc?.content) && doc.content.length > 0;

  if (temRico) {
    return (
      <VisualizadorRico conteudo={rico as JSONContent} className={className} />
    );
  }

  return (
    <p className="text-text-secondary text-sm whitespace-pre-wrap">{texto}</p>
  );
}
