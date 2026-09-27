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

/**
 * ---------------------------------------------------------------------------
 * AS TRÊS ÁREAS DE MINHAS TASKS
 *
 * Decisão do usuário, e ela corrige uma leitura minha: *"Social Media e
 * Campanhas ainda não está dentro de Minhas Tasks"*.
 *
 * **Elas estavam, e é justamente esse o problema.** A peça de campanha é uma
 * subtarefa desde a 0051, então ela já aparecia — como mais uma linha no meio
 * das outras, com um selo pequeno. E a etapa de social tinha um bloco chamado
 * "Social", sem contagem, que some quando não há nenhuma. Estar na tela e ser
 * VISÍVEL na tela são duas coisas diferentes, e quem abre procurando a área
 * pelo nome não achava nem uma nem outra.
 *
 * O que muda: as três áreas passam a ter **nome, contagem e seção própria**.
 * O que NÃO muda: cada trabalho continua aparecendo UMA vez só. Um bloco
 * "Campanhas" ao lado da lista geral poria a mesma etapa duas vezes na mesma
 * tela — que é a conta que a 0061 recusou para a subtarefa do post. Por isso
 * é AGRUPAMENTO e não bloco novo: a linha sai da lista geral e entra na seção
 * da área dela.
 * ---------------------------------------------------------------------------
 */
export const AREAS = ["demandas", "campanhas", "social"] as const;
export type AreaDeTrabalho = (typeof AREAS)[number];

export const ROTULOS_DE_AREA: Record<AreaDeTrabalho, string> = {
  demandas: "Demandas",
  campanhas: "Campanhas",
  social: "Social Media",
};

/** Para onde a seção manda quem quiser ver a área inteira. */
export const ROTA_DA_AREA: Record<AreaDeTrabalho, string> = {
  demandas: "/painel/gestao-tasks",
  campanhas: "/painel/aprovacoes",
  social: "/painel/social-media",
};

/**
 * De que área é esta etapa.
 *
 * **A pergunta é `subtarefa.campanha`, e não o caminho longo pela demanda.**
 * `deliverables.subtask_id` é a ponte que a 0033 criou e a 0051 passou a
 * escrever; indo por `task → campaign`, a etapa de uma campanha aberta sem
 * entregável responderia "campanha" — e ela não é peça de nada.
 *
 * A etapa de social não passa por aqui: ela é outro tipo, com outra lista.
 */
export function areaDaLinha(linha: LinhaPessoal): AreaDeTrabalho {
  return linha.subtarefa.campanha ? "campanhas" : "demandas";
}

export function ehArea(valor: string | undefined): valor is AreaDeTrabalho {
  return Boolean(valor) && (AREAS as readonly string[]).includes(valor as string);
}
