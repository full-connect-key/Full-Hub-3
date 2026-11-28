import type { AprovacaoDoCliente } from "@/lib/dados/portal-aprovacoes";

/**
 * `?projeto=<id>` estreita a fila às entregas de UM projeto — é para onde o
 * box do início do portal leva. Sem o parâmetro, a fila inteira.
 */
export function doProjeto(
  itens: AprovacaoDoCliente[],
  projeto: string | null,
): AprovacaoDoCliente[] {
  return projeto ? itens.filter((i) => i.taskId === projeto) : itens;
}
