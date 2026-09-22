import { cn } from "@/lib/utils";

/**
 * Traduz um status do banco no selo certo: rótulo em português e cor com
 * significado. Nenhuma tela deve montar isso à mão, senão o mesmo status
 * aparece de um jeito em cada lugar.
 */

/** Os 7 status do fluxo de conteúdo. */
export type StatusConteudo =
  | "aguardando_informacoes"
  | "em_producao"
  | "em_aprovacao"
  | "ajustes"
  | "aprovado"
  | "rejeitado"
  | "stand_by";

/**
 * Status de task. Provisórios: o módulo de tasks é de um sprint futuro e pode
 * ajustar a lista. Mexer aqui é o bastante — nenhuma tela repete esses nomes.
 */
export type StatusTask = "aberta" | "em_andamento" | "em_revisao" | "concluida" | "cancelada";

export type Status = StatusConteudo | StatusTask;

type Tom = "neutro" | "marca" | "info" | "atencao" | "positivo" | "negativo" | "pausado";

const TONS: Record<Tom, string> = {
  neutro: "bg-secondary text-secondary-foreground border-transparent",
  marca: "bg-brand/10 text-brand border-brand/20",
  info: "bg-info/10 text-info border-info/20",
  atencao: "bg-warning/10 text-warning border-warning/25",
  positivo: "bg-success/10 text-success border-success/25",
  negativo: "bg-destructive/10 text-destructive border-destructive/25",
  pausado: "bg-transparent text-muted-foreground border-border border-dashed",
};

const STATUS: Record<Status, { label: string; tom: Tom }> = {
  // Conteúdo
  aguardando_informacoes: { label: "Aguardando informações", tom: "neutro" },
  em_producao: { label: "Em produção", tom: "marca" },
  em_aprovacao: { label: "Em aprovação", tom: "info" },
  ajustes: { label: "Ajustes", tom: "atencao" },
  aprovado: { label: "Aprovado", tom: "positivo" },
  rejeitado: { label: "Rejeitado", tom: "negativo" },
  stand_by: { label: "Stand by", tom: "pausado" },
  // Task
  aberta: { label: "Aberta", tom: "neutro" },
  em_andamento: { label: "Em andamento", tom: "marca" },
  em_revisao: { label: "Em revisão", tom: "info" },
  concluida: { label: "Concluída", tom: "positivo" },
  cancelada: { label: "Cancelada", tom: "pausado" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const definicao = STATUS[status];

  // Status que ainda não conhecemos aparece cru, em vez de sumir da tela: é
  // assim que um valor novo no banco é notado em vez de passar batido.
  if (!definicao) {
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium",
          TONS.neutro,
          className,
        )}
      >
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONS[definicao.tom],
        className,
      )}
    >
      {definicao.label}
    </span>
  );
}

/** Para montar filtros sem repetir a lista de status em cada tela. */
export const STATUS_DE_CONTEUDO: StatusConteudo[] = [
  "aguardando_informacoes",
  "em_producao",
  "em_aprovacao",
  "ajustes",
  "aprovado",
  "rejeitado",
  "stand_by",
];

export const STATUS_DE_TASK: StatusTask[] = [
  "aberta",
  "em_andamento",
  "em_revisao",
  "concluida",
  "cancelada",
];

export function rotuloDoStatus(status: Status): string {
  return STATUS[status]?.label ?? status;
}
