import { cn } from "@/lib/utils";

/**
 * Prioridade de uma task. Quatro níveis fixos, sempre com a mesma cor —
 * urgente precisa saltar aos olhos em qualquer lista.
 *
 * NORMAL É CINZA, e isso é deliberado. Era azul, e azul numa tela cujo
 * destaque é azul fazia a prioridade mais comum de todas competir com Alta e
 * Urgente pela atenção — justamente o caso que, por definição, não tem nada de
 * especial. Cinza devolve o destaque para onde ele serve.
 */
export type Prioridade = "baixa" | "normal" | "alta" | "urgente";

const PRIORIDADES: Record<Prioridade, { label: string; classe: string }> = {
  baixa: { label: "Baixa", classe: "bg-neutral-soft text-muted-foreground border-transparent" },
  normal: { label: "Normal", classe: "bg-neutral-soft text-neutral border-transparent" },
  alta: { label: "Alta", classe: "bg-warning-soft text-warning border-transparent" },
  urgente: {
    label: "Urgente",
    classe: "bg-destructive text-destructive-foreground border-transparent",
  },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Prioridade;
  className?: string;
}) {
  const definicao = PRIORIDADES[priority] ?? PRIORIDADES.normal;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        definicao.classe,
        className,
      )}
    >
      {definicao.label}
    </span>
  );
}

export const PRIORIDADES_DISPONIVEIS: Prioridade[] = ["baixa", "normal", "alta", "urgente"];

export function rotuloDaPrioridade(prioridade: Prioridade): string {
  return PRIORIDADES[prioridade]?.label ?? prioridade;
}
