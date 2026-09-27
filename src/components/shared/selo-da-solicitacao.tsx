import { cn } from "@/lib/utils";
import {
  ROTULOS_PARA_A_EQUIPE,
  ROTULOS_PARA_O_CLIENTE,
  TOM_DA_SOLICITACAO,
} from "@/lib/dominio/solicitacoes";
import type { SolicitacaoStatus } from "@/lib/supabase/database.types";

/**
 * O selo de estado de um pedido do cliente (0068).
 *
 * **Ele recebe de que LADO está sendo desenhado**, e é o que permite um
 * componente só para as duas telas: o mesmo valor quer dizer coisas diferentes
 * para quem pediu e para quem atende. `em_andamento` é "virou demanda" na fila
 * do Atendimento e "em produção" no portal.
 *
 * Dois componentes com dois mapas divergiriam na primeira mudança de palavra —
 * e a divergência apareceria no lugar em que ela custa: o cliente lendo um
 * estado que a agência não usa mais.
 *
 * **O par de cor é NOMEADO, nunca opacidade.** Opacidade sobre um fundo
 * qualquer dá uma cor que ninguém mediu, e no tema escuro dá outra.
 */
const CLASSE = {
  neutro: "bg-neutral-soft text-neutral",
  aviso: "bg-warning-soft text-warning",
  ok: "bg-success-soft text-success",
  erro: "bg-danger-soft text-danger",
} as const;

export function SeloDaSolicitacao({
  status,
  lado,
  className,
}: {
  status: SolicitacaoStatus;
  lado: "equipe" | "cliente";
  className?: string;
}) {
  const rotulo =
    lado === "equipe" ? ROTULOS_PARA_A_EQUIPE[status] : ROTULOS_PARA_O_CLIENTE[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CLASSE[TOM_DA_SOLICITACAO[status]],
        className,
      )}
    >
      {rotulo}
    </span>
  );
}
