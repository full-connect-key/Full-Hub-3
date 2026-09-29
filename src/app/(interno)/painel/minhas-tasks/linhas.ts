import { ClipboardList, FolderKanban, Images, type LucideIcon } from "lucide-react";

import type { MinhaSubtarefa, MinhaTask } from "@/lib/dados/minhas-tasks";
import type { Pessoa } from "@/lib/dados/tasks";
import { quemMaisEstaNa } from "@/lib/dominio/tasks";
import { ROTULOS_DE_SUBTAREFA, STATUS_DE_SUBTAREFA } from "@/lib/tasks/state-machine";
import type { SubtaskStatus, TaskStatus } from "@/lib/supabase/database.types";

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
    /**
     * Quem mais está na demanda, uma vez cada.
     *
     * Vem de `task.outrasSubtarefas`, que `carregar()` já traz com a ficha de
     * cada responsável — nenhuma consulta nova. A linhagem responde "por que
     * estou fazendo isto?"; a pilha responde a pergunta seguinte, que é
     * "quem está com o resto?".
     */
    outros: Pessoa[];
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
          outros: quemMaisEstaNa(task.outrasSubtarefas),
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
 * O ÍCONE DE CADA ÁREA, e ele mora aqui pela razão de `FUNCOES`.
 *
 * Eram TRÊS cópias deste mapa na mesma pasta — a faixa das áreas, o cabeçalho
 * de cada seção da Lista e a faixa de novidades —, e **duas já tinham
 * divergido**: o Social aparecia com o ícone de lista numa e com o de imagens
 * nas outras, na mesma tela, a poucos pixels de distância. A quarta cópia
 * seria a que esquecesse uma área nova.
 *
 * **E o ícone passou a carregar mais peso do que carregava.** Enquanto Social
 * Media e Campanhas eram itens da barra lateral, ele era só o eco do ícone de
 * lá — quem reconhecia a área reconhecia pelo menu. As duas entradas saíram
 * da barra por decisão do usuário, e agora este é o único lugar do produto em
 * que aquele desenho aparece ao lado daquele nome. Dois desenhos para a mesma
 * área deixaram de ser inconsistência de estilo e passaram a ser duas áreas.
 */
export const ICONE_DA_AREA: Record<AreaDeTrabalho, LucideIcon> = {
  demandas: ClipboardList,
  campanhas: FolderKanban,
  social: Images,
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

/**
 * ---------------------------------------------------------------------------
 * OS SEIS STATUS DA ETAPA, NA ORDEM EM QUE ELA ANDA
 *
 * Decisão do usuário: *"quero que em minhas tasks, a visualização em lista
 * seja apresentada por status"*. A Lista agrupava por ÁREA; passou a agrupar
 * por status, e o agrupamento por área saiu — dois níveis de cabeçalho sobre
 * oito linhas é moldura, não organização.
 *
 * **O STATUS É O DA ETAPA, E NÃO O DA DEMANDA**, e a razão é mecânica antes
 * de ser conceitual: cada linha da Lista JÁ CARREGA o `StatusBadge` da etapa.
 * Agrupando pelo status da demanda, um cabeçalho "Em andamento" apareceria em
 * cima de uma linha marcada "Concluída" — dois fatos sobre a mesma linha se
 * contradizendo a um centímetro de distância, que é o erro que o produto já
 * pegou no cartão de "11 entregues" com sete na lista embaixo.
 *
 * E é conceitual também: a Lista lista ETAPAS desde o Sprint 10, porque
 * "Conteúdo" e "Layout" da mesma demanda são dois trabalhos meus, com dois
 * prazos. Pelo status da mãe os dois caem no mesmo grupo mesmo com um
 * concluído e o outro sem começar — que é exatamente o que fez o board de
 * demandas sair desta tela.
 *
 * **E ESTA LISTA É A MESMA DO BOARD**, que fica no seletor de visão ao lado.
 * Ela nasceu lá dentro; duas cópias da mesma ordem divergiriam na primeira
 * vez que alguém mexesse numa — é a lição de `ICONE_DA_AREA`, que tinha três
 * cópias e duas já divergidas, e a de `COLUNAS_POR_STATUS` na Gestão de
 * Tasks. Trocar de visão e ver a mesma etapa em dois lugares diferentes da
 * ordem seria a tela desmentindo a si mesma.
 *
 * **São os SEIS da etapa e não os sete da Task**, pela razão que o board já
 * registrava: são enums diferentes no banco, e um de-para entre os dois é o
 * lugar onde as duas verdades começam a divergir.
 * ---------------------------------------------------------------------------
 */
export const STATUS_EM_ORDEM: { status: SubtaskStatus; titulo: string }[] = [
  { status: "nao_iniciada", titulo: ROTULOS_DE_SUBTAREFA.nao_iniciada },
  { status: "em_andamento", titulo: ROTULOS_DE_SUBTAREFA.em_andamento },
  {
    status: "aguardando_informacoes",
    titulo: ROTULOS_DE_SUBTAREFA.aguardando_informacoes,
  },
  {
    status: "enviada_aprovacao",
    titulo: ROTULOS_DE_SUBTAREFA.enviada_aprovacao,
  },
  { status: "em_ajustes", titulo: ROTULOS_DE_SUBTAREFA.em_ajustes },
  { status: "concluida", titulo: ROTULOS_DE_SUBTAREFA.concluida },
];

// A ORDEM PRECISA COBRIR O ENUM INTEIRO, como os grupos do seletor de status
// cobrem o dele. Um valor novo sem lugar aqui some das DUAS visões sem erro e
// sem aviso — a etapa simplesmente não aparece, e só se descobre no dia em que
// alguém for procurar por ela.
//
// A checagem mora aqui e não no board porque a lista mora aqui: deixada lá,
// ela pararia de rodar para quem abrisse a Lista sem nunca abrir o board.
const SEM_LUGAR = STATUS_DE_SUBTAREFA.filter(
  (status) => !STATUS_EM_ORDEM.some((linha) => linha.status === status),
);
if (SEM_LUGAR.length > 0) {
  throw new Error(
    `Status de subtarefa sem lugar em Minhas Tasks: ${SEM_LUGAR.join(", ")}. ` +
      "Toda etapa precisa cair em algum grupo, senão ela some da tela sem avisar.",
  );
}
