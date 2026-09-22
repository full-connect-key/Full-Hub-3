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

/**
 * Status que contam como "em aberto": o trabalho ainda está com alguém.
 * É o que precisa ser transferido antes de desligar uma pessoa.
 */
export const STATUS_EM_ABERTO: TaskStatus[] = ["aberta", "em_andamento", "aguardando_aprovacao"];

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

/**
 * Situação de um prazo, do ponto de vista de quem entrega.
 *
 * É o vocabulário de Minhas Tasks: os três contadores do cabeçalho, as cores
 * do calendário e o filtro rápido saem todos daqui. Ter um lugar só é o que
 * garante que o número do contador bata com o que a lista mostra — se cada
 * tela calculasse por conta, um dia divergiriam.
 *
 * `hoje` e `fimDaSemana` chegam por parâmetro, em vez de serem lidos do
 * relógio aqui dentro: o servidor calcula uma vez e passa adiante, e assim o
 * navegador do usuário não classifica diferente por estar em outro fuso.
 */
export type SituacaoDePrazo = "concluida" | "atrasada" | "hoje" | "semana" | "futura" | "sem-prazo";

export function situacaoDoPrazo(
  prazo: string | null,
  concluido: boolean,
  hoje: string,
  fimDaSemana: string,
): SituacaoDePrazo {
  if (concluido) return "concluida";
  if (!prazo) return "sem-prazo";
  if (prazo < hoje) return "atrasada";
  if (prazo === hoje) return "hoje";
  if (prazo <= fimDaSemana) return "semana";
  return "futura";
}

/** Os três focos do cabeçalho. "Esta semana" inclui hoje e o que está atrasado. */
export type FocoDoDia = "atrasadas" | "hoje" | "semana";

export function combinaComFoco(situacao: SituacaoDePrazo, foco: FocoDoDia | null): boolean {
  if (!foco) return true;
  if (foco === "atrasadas") return situacao === "atrasada";
  if (foco === "hoje") return situacao === "hoje";
  return situacao === "atrasada" || situacao === "hoje" || situacao === "semana";
}

export const ROTULOS_DE_FOCO: Record<FocoDoDia, string> = {
  atrasadas: "Atrasadas",
  hoje: "Para hoje",
  semana: "Esta semana",
};

/**
 * Cor de cada situação, usada no calendário e na legenda dele.
 *
 * Vencido é vermelho e vence hoje é âmbar mesmo quando a prioridade é baixa:
 * o que aperta é a data, não a importância. Só o que está no futuro usa a cor
 * da prioridade.
 */
export const COR_DA_SITUACAO: Record<Exclude<SituacaoDePrazo, "futura">, string> = {
  atrasada: "bg-destructive",
  hoje: "bg-warning",
  semana: "bg-info",
  concluida: "bg-muted-foreground/40",
  "sem-prazo": "bg-muted-foreground/40",
};

export function corDoPrazo(situacao: SituacaoDePrazo, prioridade: TaskPrioridade): string {
  return situacao === "futura" ? COR_DA_PRIORIDADE[prioridade] : COR_DA_SITUACAO[situacao];
}
