import type { MinhaSubtarefa, MinhaTask } from "@/lib/dados/minhas-tasks";
import type { Pessoa } from "@/lib/dados/tasks";
import type { SubtaskStatus, TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

/**
 * O achatamento de Minhas Tasks: de tasks para linhas.
 *
 * Desde o Sprint 3B o que é meu são as minhas SUBTAREFAS. A Task entra como
 * cabeçalho — uma vez só, mesmo quando tenho três etapas nela — e serve de
 * contexto: de quem é a demanda, para quando, em que pé está.
 *
 * Abaixo dela vêm, em destaque, as etapas que são minhas; e depois, em cinza,
 * as dos outros. Ver o que o designer ainda não entregou é o que explica por
 * que a minha etapa está parada.
 *
 * Função pura, sem acesso a banco, exatamente para que a página (servidor) e a
 * lista (navegador) enxerguem o mesmo conjunto sem uma segunda consulta.
 */

export type LinhaPessoal =
  | {
      chave: string;
      tipo: "task";
      taskId: string;
      titulo: string;
      cliente: string | null;
      status: TaskStatus;
      prioridade: TaskPrioridade;
      dataInicio: string;
      dataFim: string | null;
      subtarefasTotal: number;
      subtarefasConcluidas: number;
      /** Quantas das etapas desta demanda são minhas. */
      minhasQuantas: number;
    }
  | {
      chave: string;
      tipo: "minha";
      taskId: string;
      cliente: string | null;
      subtarefa: MinhaSubtarefa;
    }
  | {
      chave: string;
      tipo: "outra";
      taskId: string;
      titulo: string;
      status: SubtaskStatus;
      responsavel: Pessoa | null;
    };

/**
 * Prazo crescente deixa o atrasado no topo por construção: data menor vem
 * antes. Quem não tem prazo vai para o fim, e não para o começo.
 */
function ordenarSubtarefas(a: MinhaSubtarefa, b: MinhaSubtarefa): number {
  if (!a.prazo && !b.prazo) return a.ordem - b.ordem;
  if (!a.prazo) return 1;
  if (!b.prazo) return -1;
  if (a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
  return a.ordem - b.ordem;
}

/** O prazo que manda no grupo: o da minha etapa em aberto mais próxima. */
export function meuPrazoNaTask(task: MinhaTask): string | null {
  const prazos = task.minhasSubtarefas
    .filter((s) => s.status !== "concluida" && s.prazo)
    .map((s) => s.prazo as string)
    .sort();
  return prazos[0] ?? null;
}

export function montarLinhas(tasks: MinhaTask[]): LinhaPessoal[] {
  const ordenadas = [...tasks].sort((a, b) => {
    const pa = meuPrazoNaTask(a);
    const pb = meuPrazoNaTask(b);
    if (pa === pb) return a.titulo.localeCompare(b.titulo, "pt-BR");
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.localeCompare(pb);
  });

  return ordenadas.flatMap((task): LinhaPessoal[] => {
    const cliente = task.cliente?.nome_empresa ?? null;

    return [
      {
        chave: `task-${task.id}`,
        tipo: "task",
        taskId: task.id,
        titulo: task.titulo,
        cliente,
        status: task.status,
        prioridade: task.prioridade,
        dataInicio: task.data_inicio,
        dataFim: task.data_fim,
        subtarefasTotal: task.subtarefasTotal,
        subtarefasConcluidas: task.subtarefasConcluidas,
        minhasQuantas: task.minhasSubtarefas.length,
      },
      ...[...task.minhasSubtarefas].sort(ordenarSubtarefas).map(
        (sub): LinhaPessoal => ({
          chave: `minha-${sub.id}`,
          tipo: "minha",
          taskId: task.id,
          cliente,
          subtarefa: sub,
        }),
      ),
      ...task.outrasSubtarefas.map(
        (sub): LinhaPessoal => ({
          chave: `outra-${sub.id}`,
          tipo: "outra",
          taskId: task.id,
          titulo: sub.titulo,
          status: sub.status,
          responsavel: sub.responsavel,
        }),
      ),
    ];
  });
}
