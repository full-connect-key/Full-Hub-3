import { AlertTriangle, BellRing } from "lucide-react";

import { mesPorExtenso, fraseDoPrazo, prazoVencido } from "@/lib/dominio/notas-fiscais";
import type { PedidoDeNota } from "@/lib/dominio/notas-fiscais";

/**
 * "O Financeiro pediu a sua nota" — a faixa do lado de quem deve (0066).
 *
 * ---------------------------------------------------------------------------
 * **O SINO NÃO BASTA, e é a razão desta faixa existir.**
 *
 * O aviso do sino é escrito uma vez e vira lido no primeiro clique da pessoa.
 * Depois disso o pedido não existe em tela nenhuma — e o prazo, que é o mesmo
 * dia, só apareceria para quem tivesse lembrado. A faixa mora na tela onde a
 * nota se manda, e sai sozinha quando a nota chega: é a mesma decisão dos
 * blocos de exceção da Home, que somem quando não têm nada a dizer.
 * ---------------------------------------------------------------------------
 *
 * **O tom é `--warning` e nunca `--danger`, mesmo atrasado.** Vermelho numa
 * tela que a pessoa abre uma vez por mês treina o hábito de ignorar vermelho —
 * a mesma razão do alerta de 7 dias no Portal. E o atraso aqui não é falta
 * grave: é uma nota que ainda entra.
 */
export function FaixaDoPedido({
  pedidos,
  hojeISO,
}: {
  pedidos: PedidoDeNota[];
  hojeISO: string;
}) {
  if (pedidos.length === 0) return null;

  return (
    <div className="space-y-2">
      {pedidos.map((pedido) => {
        const atrasado = prazoVencido(pedido, hojeISO);
        const Icone = atrasado ? AlertTriangle : BellRing;

        return (
          <div
            key={pedido.competencia}
            className="bg-warning-soft text-warning flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm"
          >
            <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              {/* O MÊS VEM PRIMEIRO, porque é o que a pessoa precisa para
                  escolher no seletor logo abaixo. */}
              O Financeiro pediu a sua nota de{" "}
              <strong>{mesPorExtenso(pedido.competencia)}</strong>.{" "}
              {fraseDoPrazo(pedido, hojeISO)}
              {atrasado ? " Pode enviar agora: o atraso não trava a nota." : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}
