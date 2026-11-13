import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange } from "lucide-react";

import {
  ROTULO_DO_TIPO,
  SINGULAR_DO_TIPO,
  composicaoDoPedido,
} from "@/lib/dominio/campanhas";

/**
 * A campanha que o cliente pediu: o período e a lista de materiais.
 *
 * ---------------------------------------------------------------------------
 * **É COMPARTILHADO PORQUE SÃO DUAS TELAS QUE CONCORDAM** — o detalhe do
 * pedido do lado da agência e o do lado do cliente —, que é o critério do
 * `SeletorDeVisao` e não o do `EmptyState`: as duas querem dizer a mesma
 * coisa sobre a mesma linha. Duas cópias divergiriam, e a que divergiria é a
 * do PORTAL, que a equipe nunca abre.
 *
 * **E ELE É SÓ LEITURA.** Quem EDITA a composição é `EditorDaComposicao`, e
 * os dois não se juntam: aqui não há o que decidir — o pedido já foi enviado,
 * e mudar o que o cliente pediu é reescrever o pedido dele, que é a razão
 * pela qual a mensagem da conversa não se edita (0068).
 *
 * **ELE NÃO DESENHA NADA QUANDO NÃO HÁ NADA**, e é a regra dos blocos de
 * exceção: a maioria dos pedidos não é de campanha, e um bloco permanente
 * dizendo "sem período e sem materiais" ocuparia a tela de todos para
 * informar em alguns.
 *
 * **E A LEITURA DO `jsonb` PASSA PELO PARSER DO DOMÍNIO**, nunca por um
 * `as LinhaDaComposicao[]`: o `check` da 0138 garante que a coluna é uma
 * LISTA, e não a forma de cada item — é a decisão de `camposDoRoteiro`.
 * ---------------------------------------------------------------------------
 */
export function CampanhaDoPedido({
  inicio,
  fim,
  composicao,
}: {
  inicio: string | null;
  fim: string | null;
  composicao: unknown;
}) {
  const linhas = composicaoDoPedido(composicao);
  if (!inicio && !fim && linhas.length === 0) return null;

  const total = linhas.reduce((soma, l) => soma + l.quantidade, 0);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">A campanha que ele pediu</h2>

      {inicio || fim ? (
        <p className="text-text-secondary flex items-center gap-2 text-sm">
          <CalendarRange aria-hidden className="size-4 shrink-0" />
          <span className="tabular-nums">
            {inicio ? format(parseISO(inicio), "dd/MM/yyyy", { locale: ptBR }) : "sem início"}
            {" — "}
            {fim ? format(parseISO(fim), "dd/MM/yyyy", { locale: ptBR }) : "sem encerramento"}
          </span>
        </p>
      ) : null}

      {linhas.length > 0 ? (
        <>
          <ul className="divide-y rounded-lg border">
            {linhas.map((l) => (
              <li key={l.tipo} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-3">
                <span className="text-sm font-medium tabular-nums">{l.quantidade}</span>
                {/* O SINGULAR quando é uma peça só, pela razão de
                    `SINGULAR_DO_TIPO` (0122): "1 Outros" é o erro de
                    português que aquele mapa existe para não cometer. */}
                <span className="min-w-0 text-sm">
                  {l.quantidade === 1
                    ? SINGULAR_DO_TIPO[l.tipo]
                    : ROTULO_DO_TIPO[l.tipo]}
                </span>
                {l.formato || l.dimensoes ? (
                  <span className="text-text-muted text-sm">
                    {[l.formato, l.dimensoes].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-text-muted text-sm tabular-nums">
            {total} peça{total === 1 ? "" : "s"} no total.
          </p>
        </>
      ) : null}
    </section>
  );
}
