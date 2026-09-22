import type { MinhaTask } from "@/lib/dados/minhas-tasks";
import type { Pessoa } from "@/lib/dados/tasks";
import type { TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

/**
 * O achatamento de Minhas Tasks: de tasks para linhas.
 *
 * A tela pensa em ITENS, não em tasks. Uma task minha é um item; cada
 * subtarefa minha é outro item, com prazo próprio. É o que faz o contador
 * "Para hoje" bater com a lista: os dois contam a mesma coisa.
 *
 * Função pura, sem acesso a banco, exatamente para que a página (servidor) e a
 * lista (navegador) enxerguem o mesmo conjunto sem uma segunda consulta.
 */

export type LinhaPessoal = {
  chave: string;
  tipo: "task" | "subtarefa";
  /** Id da própria linha: da task ou da subtarefa. */
  id: string;
  /** Sempre o id da task-mãe — é o que o painel lateral abre. */
  taskId: string;
  titulo: string;
  /** Preenchido só quando a linha é subtarefa de uma task que não é minha. */
  tituloDaMae: string | null;
  /** Subtarefa listada logo abaixo da própria task-mãe fica recuada. */
  recuada: boolean;
  cliente: string | null;
  prazo: string | null;
  status: TaskStatus;
  prioridade: TaskPrioridade;
  responsavel: Pessoa | null;
  concluida: boolean;
  podeConcluir: boolean;
  subtarefasTotal: number;
  subtarefasConcluidas: number;
  sugestaoDeTempo: number | null;
  origemDaSugestao?: string;
};

function ordenar(a: LinhaPessoal, b: LinhaPessoal): number {
  // Prazo crescente deixa o atrasado no topo por construção: data menor vem
  // antes. Quem não tem prazo vai para o fim, e não para o começo.
  if (!a.prazo && !b.prazo) return a.titulo.localeCompare(b.titulo, "pt-BR");
  if (!a.prazo) return 1;
  if (!b.prazo) return -1;
  if (a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

export function montarLinhas(tasks: MinhaTask[]): LinhaPessoal[] {
  const grupos: LinhaPessoal[][] = [];

  for (const task of tasks) {
    const cliente = task.cliente?.nome_empresa ?? null;
    const grupo: LinhaPessoal[] = [];

    if (task.souResponsavel) {
      grupo.push({
        chave: `task-${task.id}`,
        tipo: "task",
        id: task.id,
        taskId: task.id,
        titulo: task.titulo,
        tituloDaMae: null,
        recuada: false,
        cliente,
        prazo: task.prazo,
        status: task.status,
        prioridade: task.prioridade,
        responsavel: task.responsavel,
        concluida: task.status === "concluida" || task.status === "cancelada",
        podeConcluir: task.status !== "concluida" && task.status !== "cancelada",
        subtarefasTotal: task.subtarefasTotal,
        subtarefasConcluidas: task.subtarefasConcluidas,
        sugestaoDeTempo:
          task.tempo_real_horas ??
          (task.tempoDasSubtarefas > 0 ? task.tempoDasSubtarefas : task.estimativa_horas),
        origemDaSugestao:
          task.tempoDasSubtarefas > 0
            ? `As subtarefas somam ${task.tempoDasSubtarefas}h — é o valor sugerido.`
            : task.estimativa_horas
              ? `A estimativa era de ${task.estimativa_horas}h.`
              : undefined,
      });
    }

    for (const sub of task.minhasSubtarefas) {
      grupo.push({
        chave: `subtarefa-${sub.id}`,
        tipo: "subtarefa",
        id: sub.id,
        taskId: task.id,
        titulo: sub.titulo,
        // Com a task-mãe na tela logo acima, repetir o título dela seria ruído;
        // sem ela, a subtarefa chegaria sem contexto nenhum.
        tituloDaMae: task.souResponsavel ? null : task.titulo,
        recuada: task.souResponsavel,
        cliente,
        prazo: sub.prazo,
        status: task.status,
        prioridade: task.prioridade,
        responsavel: sub.responsavel,
        concluida: sub.concluida,
        podeConcluir: !sub.concluida,
        subtarefasTotal: 0,
        subtarefasConcluidas: 0,
        sugestaoDeTempo: sub.tempo_real_horas ?? sub.estimativa_horas,
        origemDaSugestao: sub.estimativa_horas
          ? `A estimativa era de ${sub.estimativa_horas}h.`
          : undefined,
      });
    }

    if (grupo.length > 0) grupos.push(grupo);
  }

  // Ordena os GRUPOS pela linha mais urgente de cada um, e não as linhas
  // soltas: assim a subtarefa recuada nunca se desgruda da task-mãe dela.
  grupos.sort((a, b) => ordenar([...a].sort(ordenar)[0], [...b].sort(ordenar)[0]));

  return grupos.flatMap((grupo) => {
    const [primeira, ...resto] = grupo;
    // Dentro do grupo, a task-mãe (quando é minha) encabeça e as subtarefas
    // vêm abaixo, em ordem de prazo.
    return primeira.tipo === "task" ? [primeira, ...resto.sort(ordenar)] : grupo.sort(ordenar);
  });
}
