import { cn } from "@/lib/utils";

/**
 * Prioridade de uma task. Quatro níveis fixos, sempre com a mesma cor —
 * urgente precisa saltar aos olhos em qualquer lista.
 */
export type Prioridade = "baixa" | "normal" | "alta" | "urgente";

const PRIORIDADES: Record<Prioridade, { label: string; classe: string }> = {
  baixa: { label: "Baixa", classe: "bg-secondary text-secondary-foreground border-transparent" },
  normal: { label: "Normal", classe: "bg-info/10 text-info border-info/20" },
  alta: { label: "Alta", classe: "bg-warning/10 text-warning border-warning/25" },
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
