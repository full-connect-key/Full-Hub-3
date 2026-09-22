import type { TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

/**
 * Vocabulário das tasks.
 *
 * As colunas do board saem daqui. No Sprint 5 elas passam a ser as etapas do
 * fluxo de cada cliente — por isso o board recebe a definição de coluna por
 * parâmetro em vez de ler esta lista direto.
 */

export const STATUS_DE_TASK: TaskStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando_aprovacao",
  "concluida",
  "cancelada",
];

export const ROTULOS_DE_STATUS: Record<TaskStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORIDADES: TaskPrioridade[] = ["baixa", "normal", "alta", "urgente"];

export const ROTULOS_DE_PRIORIDADE: Record<TaskPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

/** Ordem de peso, para ordenar listas por urgência. */
export const PESO_DA_PRIORIDADE: Record<TaskPrioridade, number> = {
  baixa: 0,
  normal: 1,
  alta: 2,
  urgente: 3,
};

/** Cor da barra no calendário e da faixa do card. Tokens, não literais. */
export const COR_DA_PRIORIDADE: Record<TaskPrioridade, string> = {
  baixa: "bg-muted-foreground/40",
  normal: "bg-info",
  alta: "bg-warning",
  urgente: "bg-destructive",
};

/**
 * Colunas do board. Cancelada fica de fora por padrão: ela polui a visão do
 * dia a dia, e quem precisa ver o cancelado usa o filtro de status na Lista.
 */
export type ColunaDoBoard = { id: string; titulo: string; status: TaskStatus };

export const COLUNAS_POR_STATUS: ColunaDoBoard[] = [
  { id: "aberta", titulo: "Aberta", status: "aberta" },
  { id: "em_andamento", titulo: "Em andamento", status: "em_andamento" },
  { id: "aguardando_aprovacao", titulo: "Aguardando aprovação", status: "aguardando_aprovacao" },
  { id: "concluida", titulo: "Concluída", status: "concluida" },
];

/** Uma task vencida é a que passou do prazo e ainda não terminou. */
export function estaVencida(prazo: string | null, status: TaskStatus): boolean {
  if (!prazo) return false;
  if (status === "concluida" || status === "cancelada") return false;
  return prazo < new Date().toISOString().slice(0, 10);
}

/**
 * O arquivo dá para mostrar como miniatura?
 *
 * Mora aqui, e não na camada de dados: a camada de dados é "server-only", e
 * uma função não pode ser passada de um Server Component para um Client
 * Component. Assim o componente importa direto.
 */
export function ehImagem(nome: string | null): boolean {
  if (!nome) return false;
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(nome);
}
