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
 * A TINTA DE CADA SITUAÇÃO NO CALENDÁRIO: o chip inteiro, a barra e o rótulo.
 *
 * ---------------------------------------------------------------------------
 * **São QUATRO cores, e as três que o usuário nomeou são estas** — decisão
 * dele: *"Deixe as cores: Concluido em Verde, Em produção azul, e vencido em
 * Vermelho"*, junto com *"mude as cores das legendas do calendário, deixe ele
 * visualmente mais colorido"*.
 *
 * **"Mais colorido" é o CHIP e não a barra.** Ele era um cartão branco com um
 * fio de quatro pixels na esquerda, e quatro fios de quatro pixels numa
 * célula de calendário não se leem de longe — que é a distância de que a
 * grade do mês é olhada. Agora a cor é o fundo do chip, e a barra continua
 * para dar a borda de leitura.
 *
 * **E é PAR NOMEADO, nunca opacidade.** `bg-success/10` dá uma cor que
 * ninguém mediu, e no tema escuro dá outra — a regra do selo de estado,
 * aplicada aqui. Os quatro pares já são medidos pelo `check:cores`; o que
 * entrou na lista com esta mudança foi `--text-primary` e `--text-muted`
 * sobre os quatro fundos tingidos, que é o título e a linhagem do chip.
 * ---------------------------------------------------------------------------
 *
 * **`semana` e `futura` dividem o azul**, e a fusão é o que tira a nota de pé
 * de página que a legenda carregava (*"mais adiante no tempo, a barra usa a
 * cor da prioridade"*). Duas razões:
 *
 * - **"esta semana" é o que a própria grade já diz.** Numa tela em que cada
 *   item mora na célula do dia dele, uma cor que significa "cai nesta semana"
 *   repete a posição — e repetir a posição com cor gasta a cor;
 * - **a cor da prioridade no `futura` era a exceção à regra do próprio
 *   calendário**, que é colorir pela SITUAÇÃO do prazo e não pela
 *   importância. Ela precisava de uma frase de legenda para ser entendida, e
 *   uma legenda com nota de rodapé é uma legenda que não se lê de relance.
 *
 * *O que se perde, e é dito em vez de escondido:* a prioridade sai da cor do
 * calendário. Ela continua no `title` de cada chip e é o que o board e a
 * Lista mostram — e nas duas ela é selo, não cor de fundo.
 *
 * `sem-prazo` fica no mapa por completude do `Record`, e nenhum item do
 * calendário cai nele: item sem data não tem célula onde caber, e as quatro
 * origens filtram a data nula antes de montar a lista.
 */
export const TINTA_DA_SITUACAO: Record<
  SituacaoDePrazo,
  { chip: string; barra: string; rotulo: string }
> = {
  atrasada: { chip: "bg-danger-soft", barra: "bg-danger", rotulo: "text-danger" },
  hoje: { chip: "bg-warning-soft", barra: "bg-warning", rotulo: "text-warning" },
  semana: { chip: "bg-accent", barra: "bg-accent-foreground", rotulo: "text-accent-foreground" },
  futura: { chip: "bg-accent", barra: "bg-accent-foreground", rotulo: "text-accent-foreground" },
  concluida: { chip: "bg-success-soft", barra: "bg-success", rotulo: "text-success" },
  "sem-prazo": { chip: "bg-neutral-soft", barra: "bg-neutral", rotulo: "text-neutral" },
};

/**
 * O que a legenda escreve para cada cor — QUATRO entradas, não seis.
 *
 * `semana` e `futura` dividem a mesma cor, então dividem a mesma linha: duas
 * entradas de legenda com a mesma amostra são piores que uma, porque a pessoa
 * procura a diferença, não acha, e passa a desconfiar do resto. É a decisão da
 * legenda do calendário de Social Media, que agrupa os status que dividem o
 * azul.
 */
export const LEGENDA_DO_CALENDARIO: { situacao: SituacaoDePrazo; rotulo: string }[] = [
  { situacao: "atrasada", rotulo: "Vencido" },
  { situacao: "hoje", rotulo: "Vence hoje" },
  { situacao: "futura", rotulo: "Em produção" },
  { situacao: "concluida", rotulo: "Concluído" },
];

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
/**
 * As quatro origens do calendário de tasks.
 *
 * ---------------------------------------------------------------------------
 * **`"task"` SAIU, e a remoção é decisão do usuário:** *"não considere no
 * calendário a data final da task, apenas o prazo final da última
 * subtarefa"*.
 *
 * **E ela estava certa pela mecânica, não só pelo gosto.**
 * `recalcular_periodo_task()` (0028) escreve `tasks.data_fim` como
 * `max(prazo das FOLHAS)` — então a linha "Demanda" caía exatamente no mesmo
 * dia que a última etapa, com outro rótulo, dizendo o mesmo fato. Era a
 * contagem dobrada que este produto recusa em toda soma, aqui na forma de
 * duas linhas na mesma célula.
 *
 * **Saiu do TIPO, e não só do loop que a produzia** — a decisão da 0023, que
 * apagou `tasks.exigencia_aprovacao` em vez de deixá-la parada: um valor de
 * união que nenhum caminho produz é o que alguém reaproveita errado três
 * sprints depois, achando que ainda significa alguma coisa.
 * ---------------------------------------------------------------------------
 */
export type TipoDeItemDeCalendario =
  | "subtarefa"
  | "post"
  | "campanha"
  | "entregavel";

/**
 * O rótulo de MÓDULO de cada linha — e a etapa não tem nenhum.
 *
 * ---------------------------------------------------------------------------
 * **A palavra "Etapa" saiu, por decisão do usuário:** *"que apareça o nome da
 * task mãe, junto com o nome da Subtarefa, e tirar as palavras Etapa"*.
 *
 * **Ela só existia para se opor a "Demanda"**, que é a linha que saiu junto
 * (veja `TipoDeItemDeCalendario`): com as duas na mesma célula, o rótulo era
 * a única coisa que dizia qual era qual. Sem a Demanda, a etapa é a entidade
 * desta tela — e nomear a entidade da tela dentro de cada linha dela é
 * ocupar a largura do título para repetir onde a pessoa está.
 *
 * **O que entrou no lugar é a LINHAGEM**, que é informação: `Cliente ·
 * Demanda` embaixo do nome da etapa. É a forma que Minhas Tasks já usa desde
 * o Sprint 10, e ela responde a pergunta que o rótulo não respondia — *"de
 * que demanda é este Layout?"*, numa agência com três campanhas correndo.
 *
 * **Post, campanha e entregável FICAM com rótulo**, e a assimetria é o ponto:
 * eles vêm de outro módulo, abrem em outra tela, e o rótulo é o que diz isso
 * sem gastar uma linha. O `Record` continua total sobre a união — e `null`
 * é explícito — justamente para um tipo novo não cair calado no último ramo
 * de um `? :`, que é como "entregável" quase virou "Etapa".
 * ---------------------------------------------------------------------------
 */
export const ROTULO_DO_ITEM_DE_CALENDARIO: Record<
  TipoDeItemDeCalendario,
  string | null
> = {
  subtarefa: null,
  post: "Post",
  campanha: "Campanha",
  entregavel: "Entregável",
};

/**
 * QUEM MAIS ESTÁ NA DEMANDA, uma vez cada.
 *
 * ---------------------------------------------------------------------------
 * **A pilha de avatares da interface "Leve" não custou consulta nenhuma**, e é
 * o que a tornou barata: `carregar()` em `lib/dados/minhas-tasks.ts` já traz as
 * etapas dos outros com `profiles(id, nome, avatar_url)` desde o Sprint 4 —
 * elas são o contexto em cinza do painel lateral. O que faltava era a lista
 * aparecer na LINHA, que é onde a pergunta é feita: *a arte não saiu, quem
 * está com ela?*
 * ---------------------------------------------------------------------------
 *
 * **A dedução é por PESSOA e não por etapa**, e a diferença é visível: a Carla
 * com três etapas na mesma demanda é uma pessoa, e três círculos iguais lado a
 * lado leriam como três pessoas. Quem responde é o `Map` por id — nunca pelo
 * nome, que dois homônimos compartilham.
 *
 * **Etapa sem dono não entra**, e a ausência é a mesma regra de todo lugar:
 * ela não está no "Minhas Tasks" de ninguém, então não há avatar a desenhar —
 * e um círculo genérico ali afirmaria que existe alguém.
 */
export function quemMaisEstaNa<P extends { id: string }>(
  outrasSubtarefas: { responsavel: P | null }[],
): P[] {
  const porPessoa = new Map<string, P>();
  for (const sub of outrasSubtarefas) {
    if (!sub.responsavel) continue;
    if (!porPessoa.has(sub.responsavel.id)) porPessoa.set(sub.responsavel.id, sub.responsavel);
  }
  return [...porPessoa.values()];
}
