import type {
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

/**
 * Os status que o produto usa, na ordem em que a demanda anda.
 *
 * **`cancelada` NÃO está aqui, e a ausência é deliberada.** Ela saiu do
 * produto por decisão do usuário; o valor continua no enum do Postgres porque
 * apagar valor de enum em uso é migration arriscada, e um trigger (migration
 * 0020) recusa quem tentar gravá-lo. É o mesmo arranjo do `atrasado` no
 * Financeiro: existe no tipo, nenhuma linha o carrega.
 *
 * Demanda que morreu se apaga — e apagar leva junto as subtarefas, as rodadas
 * e o histórico. Se um dia isso doer, o caminho é um "Arquivada" novo, não
 * ressuscitar este.
 */
export const STATUS_DE_TASK: TaskStatus[] = [
  "nao_iniciada",
  "em_andamento",
  "aguardando_informacoes",
  "em_aprovacao",
  "em_ajustes",
  "entregue",
  "concluido",
];

/**
 * O rótulo de cada status.
 *
 * `cancelada` continua no mapa porque o tipo vem do enum do banco e o
 * `Record` exige a chave — não porque a tela a mostre. Nenhuma lista do
 * produto a inclui, e o trigger da 0020 recusa gravá-la. Se uma linha antiga
 * aparecer com ela, o rótulo evita a tela mostrar a chave crua.
 */
export const ROTULOS_DE_STATUS: Record<TaskStatus, string> = {
  // "Iniciar", e não "Não iniciada": este mapa alimenta o CABEÇALHO DA COLUNA
  // do board e o filtro de status, onde a palavra nomeia a coluna de onde a
  // demanda sai. O SELO da linha (`StatusBadge`) diz "Não iniciada", porque
  // lá ele fica ao lado de um botão chamado "Iniciar" — e a mesma palavra
  // duas vezes na mesma linha, uma como estado e outra como ação, foi o que
  // a imagem do protótipo mostrou.
  nao_iniciada: "Iniciar",
  em_andamento: "Em andamento",
  aguardando_informacoes: "Aguardando informações",
  em_aprovacao: "Aguardando aprovação",
  em_ajustes: "Em ajuste",
  entregue: "Entregue",
  concluido: "Concluído",
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
 * Colunas do board da Gestão de Tasks — uma por status, na ordem em que a
 * demanda anda.
 */
export type ColunaDoBoard = { id: string; titulo: string; status: TaskStatus };

export const COLUNAS_POR_STATUS: ColunaDoBoard[] = [
  { id: "nao_iniciada", titulo: "Iniciar", status: "nao_iniciada" },
  { id: "em_andamento", titulo: "Em andamento", status: "em_andamento" },
  { id: "aguardando_informacoes", titulo: "Aguardando informações", status: "aguardando_informacoes" },
  { id: "em_aprovacao", titulo: "Aguardando aprovação", status: "em_aprovacao" },
  { id: "em_ajustes", titulo: "Em ajuste", status: "em_ajustes" },
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

// ---------------------------------------------------------------------------
// Os três níveis: demanda → etapa → sub-etapa (migration 0022)
// ---------------------------------------------------------------------------

/** O mínimo que estas funções precisam saber de uma subtarefa. */
type ComPai = { id: string; parent_id: string | null };

/**
 * Quais etapas têm sub-etapa dentro.
 *
 * **QUEM TEM FILHA É AGRUPADORA**, e agrupadora não é unidade de trabalho — é
 * a mesma regra que a Task já seguia, um nível abaixo. Ela não mede tempo, não
 * tem status próprio, não exige aval e **não entra em nenhuma soma**: quem
 * soma é a folha.
 *
 * Existe aqui, em `lib/dominio/`, porque os dois lados perguntam a mesma
 * coisa — a tela para decidir o que desenhar, o servidor para decidir o que
 * contar. No Postgres o par é `subtask_eh_agrupadora()`, como
 * `situacaoDoLancamento()` no Financeiro.
 */
export function agrupadoras(subtarefas: ComPai[]): Set<string> {
  const comFilha = new Set<string>();
  for (const sub of subtarefas) {
    if (sub.parent_id) comFilha.add(sub.parent_id);
  }
  return comFilha;
}

/**
 * Só as folhas — o que de fato é trabalho.
 *
 * É o filtro que impede a contagem dobrada: sem ele, uma demanda com "Arte" e
 * três sub-etapas contaria quatro etapas, somaria o tempo da mãe mais o das
 * filhas, e "3 de 4 concluídas" ficaria parada para sempre esperando a mãe —
 * que só conclui depois das três.
 */
export function folhas<T extends ComPai>(subtarefas: T[]): T[] {
  const mae = agrupadoras(subtarefas);
  return subtarefas.filter((sub) => !mae.has(sub.id));
}

/** Uma etapa de primeiro nível com as sub-etapas dela, na ordem. */
export type EtapaComFilhas<T> = { etapa: T; filhas: T[] };

/**
 * A lista plana vira a árvore que a tela desenha.
 *
 * Sub-etapa órfã — cuja mãe não veio na consulta — sobe para o primeiro
 * nível em vez de sumir. Some seria pior: a etapa existe, tem responsável e
 * prazo, e desaparecer da tela é o jeito mais silencioso de perder trabalho.
 */
export function emArvore<T extends ComPai & { ordem: number }>(
  subtarefas: T[],
): EtapaComFilhas<T>[] {
  const existe = new Set(subtarefas.map((s) => s.id));
  const porOrdem = (a: T, b: T) => a.ordem - b.ordem;

  const raizes = subtarefas
    .filter((s) => !s.parent_id || !existe.has(s.parent_id))
    .sort(porOrdem);

  return raizes.map((etapa) => ({
    etapa,
    filhas: subtarefas.filter((s) => s.parent_id === etapa.id).sort(porOrdem),
  }));
}

/**
 * O que pode ocupar um dia no calendário da agência.
 *
 * **Está aqui, e não em `lib/dados/tasks.ts`, por causa do rótulo.** O tipo
 * mora junto do mapa que o traduz, e o mapa é um `Record` sobre a união — um
 * valor novo sem rótulo vira erro de tipo no `npm run build`, em vez de
 * aparecer na tela como o último ramo de um `? :` aninhado. Foi assim que
 * `entregavel` quase renderizou como "Etapa".
 */
export type TipoDeItemDeCalendario =
  | "task"
  | "subtarefa"
  | "post"
  | "campanha"
  | "entregavel";

/**
 * Cada linha marca uma coisa diferente, e o rótulo diz qual.
 *
 * A da Task marca o fim do período da demanda; a da subtarefa, o prazo de uma
 * etapa; a do post, o dia em que ele vai ao ar; a da campanha, o dia em que
 * ela fecha; a do entregável, o prazo daquela peça. Sem o rótulo, cinco
 * significados dividiriam a mesma célula sem nada que os separasse.
 */
export const ROTULO_DO_ITEM_DE_CALENDARIO: Record<
  TipoDeItemDeCalendario,
  string
> = {
  task: "Demanda",
  subtarefa: "Etapa",
  post: "Post",
  campanha: "Campanha",
  entregavel: "Entregável",
};
