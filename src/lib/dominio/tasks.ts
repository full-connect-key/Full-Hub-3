import type {
  ExigenciaAprovacao,
  SubtaskStatus,
  TaskPrioridade,
  TaskStatus,
} from "@/lib/supabase/database.types";

/**
 * Vocabulário das tasks.
 *
 * A Task é o agrupador da demanda: ela tem período, prioridade e um status
 * que ninguém digita — é calculado a partir das subtarefas e das rodadas de
 * aprovação. Quem tem dono, prazo e tempo é a SUBTAREFA.
 *
 * As regras de transição não moram aqui: ficam em `lib/tasks/state-machine.ts`
 * (e, a que vale de verdade, nos triggers da migration 0007). Aqui é só o
 * vocabulário — rótulo, ordem, cor.
 */

export const STATUS_DE_TASK: TaskStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "entregue",
  "em_aprovacao",
  "em_ajustes",
  "concluido",
  "cancelada",
];

export const ROTULOS_DE_STATUS: Record<TaskStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  aguardando_informacoes: "Aguardando informações",
  entregue: "Entregue",
  em_aprovacao: "Em aprovação",
  em_ajustes: "Em ajustes",
  concluido: "Concluído",
  cancelada: "Cancelada",
};

/**
 * O que a demanda inteira exige antes de ser dada por entregue.
 *
 * TRÊS OPÇÕES, NÃO QUATRO. "Cliente" já passa pela interna — é a regra "toda
 * aprovação abre primeiro uma rodada interna, mesmo quando o tipo é cliente".
 * Uma quarta opção "dupla" seria um segundo botão com exatamente o mesmo
 * efeito do terceiro, e é assim que nascem duas verdades sobre a mesma coisa.
 *
 * Quem recusa o encerramento sem a aprovação é o trigger
 * `tasks_exige_aprovacao_para_entregue` (migration 0014). Isto aqui é o
 * vocabulário que a tela lê.
 */
export const EXIGENCIAS_DE_APROVACAO: ExigenciaAprovacao[] = ["nenhuma", "interna", "cliente"];

export const ROTULOS_DE_EXIGENCIA: Record<ExigenciaAprovacao, string> = {
  nenhuma: "Sem aprovação",
  interna: "Interna",
  cliente: "Do cliente",
};

/** O que cada escolha significa, por extenso. Vai embaixo dos botões: sem
 *  isso, "Interna" e "Do cliente" parecem alternativas quando uma contém a
 *  outra. */
export const EXPLICACAO_DA_EXIGENCIA: Record<ExigenciaAprovacao, string> = {
  nenhuma: "A demanda encerra quando o Atendimento disser que encerrou. Serve para o que não passa por validação — subida de mídia, relatório interno.",
  interna:
    "A gestão precisa ter aprovado alguma etapa desta demanda antes de ela virar “entregue”. O cliente não é consultado.",
  cliente:
    "O cliente precisa ter aprovado. E isso já inclui a validação interna: nenhuma peça vai ao cliente sem alguém da casa ter olhado antes.",
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
 * Colunas do board da Gestão de Tasks.
 *
 * Cancelada fica de fora: ela polui a visão do dia a dia, e quem precisa ver
 * o cancelado usa o filtro de status na Lista.
 */
export type ColunaDoBoard = { id: string; titulo: string; status: TaskStatus };

export const COLUNAS_POR_STATUS: ColunaDoBoard[] = [
  { id: "nao_iniciada", titulo: "Não iniciada", status: "nao_iniciada" },
  { id: "em_andamento", titulo: "Em andamento", status: "em_andamento" },
  { id: "aguardando_informacoes", titulo: "Aguardando informações", status: "aguardando_informacoes" },
  { id: "em_aprovacao", titulo: "Em aprovação", status: "em_aprovacao" },
  { id: "em_ajustes", titulo: "Em ajustes", status: "em_ajustes" },
  { id: "entregue", titulo: "Entregue", status: "entregue" },
  { id: "concluido", titulo: "Concluído", status: "concluido" },
];

/**
 * Status que contam como "em aberto": o trabalho ainda está com alguém.
 * É o que precisa ser transferido antes de desligar uma pessoa.
 */
export const STATUS_EM_ABERTO: TaskStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "entregue",
  "em_aprovacao",
  "em_ajustes",
];

/** O mesmo, do lado da subtarefa — e é por ela que a transferência passa. */
export const SUBTAREFAS_EM_ABERTO: SubtaskStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "enviada_aprovacao",
  "em_ajustes",
];

/** Uma subtarefa vencida é a que passou do prazo e ainda não terminou. */
export function estaVencida(prazo: string | null, status: SubtaskStatus): boolean {
  if (!prazo) return false;
  if (status === "concluida") return false;
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
