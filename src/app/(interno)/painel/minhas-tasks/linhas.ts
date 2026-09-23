import type { MinhaSubtarefa, MinhaTask } from "@/lib/dados/minhas-tasks";
import type { TaskStatus } from "@/lib/supabase/database.types";

/**
 * O achatamento de Minhas Tasks: de tasks para ETAPAS.
 *
 * **Cada etapa minha é um item por si.** Se a demanda "Post de lançamento"
 * tem Conteúdo e Layout e as duas são minhas, a lista mostra duas linhas —
 * porque são dois trabalhos, com dois prazos, que eu faço em dois momentos.
 * Uma única linha "Post de lançamento" obrigava a abrir para descobrir o que
 * havia dentro, e o prazo que ela mostrava era o mais apertado dos dois: o
 * outro simplesmente não aparecia.
 *
 * A demanda não some — vira a LINHAGEM do item: `Cliente · Demanda`, e mais
 * `› Etapa de cima` quando a minha é uma sub-etapa. É o que responde "por que
 * estou fazendo isto?" sem gastar uma linha inteira da lista, e clicar abre o
 * painel com a demanda completa, onde se vê que Conteúdo e Layout são da
 * mesma mãe e o que as outras pessoas estão fazendo nela.
 *
 * A ORDEM É GLOBAL, e é o ponto de listar por etapa: o que vence amanhã fica
 * no topo mesmo que a demanda dele comece semana que vem. Agrupado por
 * demanda, uma etapa atrasada podia estar em qualquer lugar da rolagem.
 *
 * Função pura, sem acesso a banco, exatamente para que a página (servidor) e a
 * lista (navegador) enxerguem o mesmo conjunto sem uma segunda consulta.
 */

export type LinhaPessoal = {
  chave: string;
  taskId: string;
  /** A demanda a que a etapa pertence — o contexto, nunca o item. */
  demanda: {
    titulo: string;
    cliente: string | null;
    status: TaskStatus;
    /** Quantas etapas a demanda tem ao todo, e quantas delas são minhas. */
    total: number;
    minhas: number;
  };
  subtarefa: MinhaSubtarefa;
};

/**
 * Prazo crescente deixa o atrasado no topo por construção: data menor vem
 * antes. Quem não tem prazo vai para o fim, e não para o começo — etapa sem
 * data não é etapa urgente, é etapa que ninguém marcou.
 */
function ordenar(a: LinhaPessoal, b: LinhaPessoal): number {
  const pa = a.subtarefa.prazo;
  const pb = b.subtarefa.prazo;
  if (pa !== pb) {
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.localeCompare(pb);
  }
  const demandas = a.demanda.titulo.localeCompare(b.demanda.titulo, "pt-BR");
  if (demandas !== 0) return demandas;
  return a.subtarefa.ordem - b.subtarefa.ordem;
}

/** O prazo que manda na demanda: o da minha etapa em aberto mais próxima. */
export function meuPrazoNaTask(task: MinhaTask): string | null {
  const prazos = task.minhasSubtarefas
    .filter((s) => s.status !== "concluida" && s.prazo)
    .map((s) => s.prazo as string)
    .sort();
  return prazos[0] ?? null;
}

export function montarLinhas(tasks: MinhaTask[]): LinhaPessoal[] {
  return tasks
    .flatMap((task): LinhaPessoal[] =>
      task.minhasSubtarefas.map((sub) => ({
        chave: `etapa-${sub.id}`,
        taskId: task.id,
        demanda: {
          titulo: task.titulo,
          cliente: task.cliente?.nome_empresa ?? null,
          status: task.status,
          total: task.subtarefasTotal,
          minhas: task.minhasSubtarefas.length,
        },
        subtarefa: sub,
      })),
    )
    .sort(ordenar);
}
