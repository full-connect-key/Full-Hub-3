import {
  Circle,
  CircleCheck,
  CircleDot,
  CirclePause,
  CircleQuestionMark,
  CircleSlash,
  CircleX,
  Hourglass,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Traduz um status do banco no selo certo: rótulo em português e cor com
 * significado. Nenhuma tela deve montar isso à mão, senão o mesmo status
 * aparece de um jeito em cada lugar.
 */

/** Os 7 status do fluxo de conteúdo. */
export type StatusConteudo =
  | "aguardando_informacoes"
  | "em_producao"
  | "em_aprovacao"
  | "ajustes"
  | "aprovado"
  | "rejeitado"
  | "stand_by";

/**
 * Status de task e de subtarefa. Espelham os enums `task_status` e
 * `subtask_status` do banco (migration 0007) -- mudar um sem mudar o outro faz
 * o selo aparecer cru na tela.
 *
 * `aguardando_informacoes`, `em_aprovacao` e `em_ajustes` aparecem nas duas
 * listas: o fluxo de conteudo do cliente e o de task usam a mesma palavra para
 * a mesma coisa, e um selo so evita dois vermelhos diferentes na mesma tela.
 */
export type StatusTask =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "entregue"
  | "em_aprovacao"
  | "em_ajustes"
  | "concluido"
  // Saiu do produto na 0020, e o valor continua no enum do Postgres porque
  // apagar valor de enum em uso e migration arriscada. Fica no TIPO e no mapa
  // de rotulos para uma linha antiga renderizar em vez de quebrar a tela --
  // mas nao entra em `STATUS_DE_TASK`, que e o que alimenta selo e filtro.
  | "cancelada";

export type StatusSubtarefa =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "enviada_aprovacao"
  | "em_ajustes"
  | "concluida";

export type Status = StatusConteudo | StatusTask | StatusSubtarefa;

/**
 * OS OITO TONS, e eram sete com um deles duplicado.
 *
 * ---------------------------------------------------------------------------
 * **SETE STATUS DE TASK, SETE CORES** — decisão do usuário, com a paleta por
 * extenso: *"na lista da gestão de task, deixe o a produzir cinza, em produção
 * azul, aguardando informações laranja, aguardando aprovação marrom, ajuste é
 * vermelho, e entregue verde mais claro e concluido verde escuro"*.
 *
 * Os sete mapeavam em CINCO pares, e este produto registrava a dívida em voz
 * alta: *"'Iniciar' e 'Aguardando informações' dividem o cinza, 'Em andamento'
 * e 'Aguardando aprovação' dividem o azul, 'Entregue' e 'Em ajuste' dividem o
 * âmbar"*. Com a caixa colorida no cabeçalho de grupo da Lista, três pares de
 * caixas saíam com o mesmo chão.
 *
 * **`info` SAIU, e ele era `marca` com outro nome:** as duas entradas de
 * `TONS` eram a MESMA string de classes, letra por letra. Dois nomes para uma
 * cor é o que faz alguém "mudar o azul" e mudar metade dos selos — é a decisão
 * da 0023, aplicada a um tom. Quem usava `info` era `em_aprovacao` e
 * `enviada_aprovacao`, e os dois passaram para `marrom`.
 *
 * **E `atencao` FICOU, com um consumidor só:** o "Ajustes" do fluxo do
 * CLIENTE. Ele não vira vermelho junto com o "Em ajuste" da equipe, e a razão
 * é a 0127: no fluxo do cliente, "Ajustes" fica ao lado de "Rejeitado" — os
 * dois desfechos negativos, que *"querem dizer coisas opostas"* e que aquela
 * migration existe para separar. No fluxo da task não há `rejeitado`, então
 * ali o vermelho está livre.
 * ---------------------------------------------------------------------------
 */
type Tom =
  | "neutro"
  | "marca"
  | "laranja"
  | "marrom"
  | "atencao"
  | "positivo"
  | "lima"
  | "negativo"
  | "pausado";

/**
 * Cada tom é um PAR de tokens: fundo suave mais a cor cheia como texto. Os
 * pares vêm prontos do arquivo de identidade e passaram pelo `npm run
 * check:cores` nos dois temas.
 *
 * Nada de `bg-warning/10`: opacidade sobre um fundo qualquer dá uma cor que
 * ninguém mediu, e no tema escuro dá outra. O par nomeado é o que se pode
 * verificar.
 */
/**
 * A bolinha de cor do status, para quando o selo inteiro não cabe.
 *
 * Sai do MESMO `tom` do selo, e não de um mapa paralelo: dois mapas de cor
 * para os mesmos estados divergem na primeira vez que alguém acrescenta um
 * status e só lembra de um deles.
 */
const PONTO: Record<Tom, string> = {
  neutro: "bg-neutral",
  marca: "bg-accent-strong",
  laranja: "bg-laranja",
  marrom: "bg-marrom",
  atencao: "bg-warning",
  positivo: "bg-success",
  lima: "bg-lima",
  negativo: "bg-danger",
  pausado: "bg-neutral",
};

export function corDoPontoDeStatus(status: Status): string {
  return PONTO[STATUS[status]?.tom ?? "neutro"];
}

/**
 * O PAR NOMEADO do status, para quem desenha o próprio chip.
 *
 * Sai do MESMO `TONS` que o selo, pela razão de `corDoPontoDeStatus`: um
 * segundo mapa de cor para os mesmos estados diverge na primeira vez que
 * alguém acrescenta um status e só lembra de um deles. Quem o usa é o
 * cronograma do portal, onde o chip precisa caber numa célula de 90px e o
 * selo inteiro não cabe — mas a cor tem de ser a mesma que ele teria.
 *
 * **E ESTA FRASE VOLTOU A SER VERDADE.** Ela já dizia "quem o usa é o
 * cronograma" quando os dois cabeçalhos de grupo também o usavam: a função
 * ganhou consumidores e o comentário ficou para trás, que é prosa mantida à
 * mão afirmando o que o código não faz. Os cabeçalhos passaram para
 * `classesDaCaixaDeStatus`, logo abaixo, e o cronograma voltou a ser o único.
 */
export function classesDoChipDeStatus(status: Status): string {
  return TONS[STATUS[status]?.tom ?? "neutro"];
}

const TONS: Record<Tom, string> = {
  neutro: "bg-neutral-soft text-neutral border-transparent",
  marca: "bg-accent text-accent-foreground border-blue-muted",
  laranja: "bg-laranja-soft text-laranja border-transparent",
  marrom: "bg-marrom-soft text-marrom border-transparent",
  atencao: "bg-warning-soft text-warning border-transparent",
  positivo: "bg-success-soft text-success border-transparent",
  lima: "bg-lima-soft text-lima border-transparent",
  negativo: "bg-danger-soft text-danger border-transparent",
  pausado: "bg-transparent text-muted-foreground border-border border-dashed",
};

/**
 * O MESMO TOM, CHEIO — para o cabeçalho de grupo, onde a pílula É a peça.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, por referência: a caixa do cabeçalho passou de pastel
 * para **cheia e saturada, com um ícone dentro**.
 *
 * **NÃO É UM SEGUNDO MAPA DE COR, e essa distinção é a que faz ele caber
 * aqui.** O que este arquivo proíbe é um segundo de-para de STATUS para cor —
 * duas listas que divergem na primeira vez que alguém acrescenta um status e
 * só lembra de uma. Aqui o de-para continua sendo um: `STATUS[status].tom`.
 * O que muda é o PAPEL da superfície — lá o tom é a frente sobre um chão
 * suave, aqui ele é o chão com o texto por cima —, e `Record<Tom, string>`
 * obriga os dois mapas a serem totais: um tom novo não compila sem os dois.
 *
 * **`neutro` E `pausado` APONTAM PARA AS MESMAS CLASSES de `TONS`**, e a
 * repetição é a decisão: o status mais comum da lista não pode ser a pílula
 * mais barulhenta da tela, e "Stand by" é a ausência de trabalho, não um
 * estado que grita. Era assim na referência, e é o que mantém as outras sete
 * valendo alguma coisa — sete pílulas cheias e uma clara se leem; oito
 * pílulas cheias se anulam.
 *
 * **O HOVER É `group-hover:` E ISSO É UM CONTRATO:** quem desenha a pílula a
 * envolve num elemento com `group`. A razão é que o alvo do clique quase
 * nunca é a pílula sozinha — no cabeçalho de grupo ela divide o botão com a
 * seta e com a contagem, e um `hover:` só acenderia quando o ponteiro
 * estivesse exatamente em cima dela. **E ele ESCURECE por um token medido,
 * nunca por `brightness`**, que é filtro do Tailwind e não cor nomeada: foi
 * assim que o hover do botão mais clicado do produto passou meses abaixo do
 * mínimo sem a varredura dizer nada (0127).
 * ---------------------------------------------------------------------------
 */
const TONS_CHEIOS: Record<Tom, string> = {
  neutro: TONS.neutro,
  marca:
    "bg-status-marca text-status-marca-foreground group-hover:bg-status-marca-hover",
  laranja:
    "bg-status-laranja text-status-laranja-foreground group-hover:bg-status-laranja-hover",
  marrom:
    "bg-status-marrom text-status-marrom-foreground group-hover:bg-status-marrom-hover",
  atencao:
    "bg-status-atencao text-status-atencao-foreground group-hover:bg-status-atencao-hover",
  positivo:
    "bg-status-positivo text-status-positivo-foreground group-hover:bg-status-positivo-hover",
  lima: "bg-status-lima text-status-lima-foreground group-hover:bg-status-lima-hover",
  negativo:
    "bg-status-negativo text-status-negativo-foreground group-hover:bg-status-negativo-hover",
  pausado: TONS.pausado,
};

/**
 * A FORMA DE CADA STATUS, e ela é o terceiro sinal.
 *
 * ---------------------------------------------------------------------------
 * **ELE É KEYADO POR STATUS E NÃO POR TOM**, ao contrário de tudo o mais
 * neste arquivo, e é a única chave que serve: `negativo` é o tom de
 * `em_ajustes` (a equipe vai refazer) E de `rejeitado` (o cliente disse não)
 * — a cor é a mesma de propósito e a frase não é. Um ícone por tom daria a
 * mesma seta de "volta para mexer" a uma recusa.
 *
 * **E ELE EXISTE POR CAUSA DE UMA MEDIÇÃO, não por enfeite.** Rodando os sete
 * chãos cheios como um grupo de daltonismo, `--status-marrom` fica a **ΔE
 * 1,9** de `--status-negativo` em protanopia e `--status-lima` a **3,4** dele
 * em deuteranopia: para quem não separa vermelho de verde, "Aguardando
 * aprovação", "Em ajuste" e "Entregue" são três pílulas da mesma cor. A regra
 * escrita desta casa é que **a cor nunca é o único sinal**, e até aqui quem a
 * cumpria era o NOME dentro da caixa. A ampulheta, a seta de voltar e o avião
 * de papel são três silhuetas que nada têm em comum — e elas sobrevivem ao
 * tema, ao daltonismo e à distância de que uma lista de quarenta linhas é
 * olhada, que é onde a palavra a 11px já não ajuda.
 *
 * É a decisão do bolo do aniversário no Calendário Full, palavra por palavra.
 * ---------------------------------------------------------------------------
 */
const ICONE: Record<Status, LucideIcon> = {
  // Conteúdo
  aguardando_informacoes: CircleQuestionMark,
  em_producao: CircleDot,
  em_aprovacao: Hourglass,
  ajustes: RotateCcw,
  aprovado: CircleCheck,
  rejeitado: CircleX,
  stand_by: CirclePause,
  // Task
  nao_iniciada: Circle,
  em_andamento: CircleDot,
  entregue: Send,
  em_ajustes: RotateCcw,
  concluido: CircleCheck,
  cancelada: CircleSlash,
  // Subtarefa
  enviada_aprovacao: Hourglass,
  concluida: CircleCheck,
};

export function iconeDoStatus(status: Status): LucideIcon {
  return ICONE[status] ?? Circle;
}

/**
 * O CHÃO CHEIO do status, para o cabeçalho de grupo.
 *
 * Ele é o par de `classesDoChipDeStatus` e não o substitui: aquele serve quem
 * desenha um chip pequeno dentro de conteúdo, este serve quem desenha a peça
 * que NOMEIA um bloco. O hover escurece o chão por um token medido, nunca por
 * `brightness`, que é filtro do Tailwind e não cor nomeada — a lição da 0127.
 */
export function classesDaCaixaDeStatus(status: Status): string {
  return TONS_CHEIOS[STATUS[status]?.tom ?? "neutro"];
}

const STATUS: Record<Status, { label: string; tom: Tom }> = {
  // Conteúdo
  // LARANJA e nao cinza: ele dividia o cinza com o "Stand by", e os dois
  // dizem coisas opostas — um e a Full travada esperando algo, o outro e a
  // peca parada por escolha. No portal, laranja e a cor que diz "a agencia
  // precisa de uma resposta".
  aguardando_informacoes: { label: "Aguardando informações", tom: "laranja" },
  em_producao: { label: "Em produção", tom: "marca" },
  // MARROM e nao azul: ele dividia o azul com "Em producao", e para o cliente
  // esta e a unica linha que quer dizer *esperando VOCE* — era a distincao
  // mais importante do fluxo dele, escondida dentro da cor do trabalho em
  // andamento. Era tambem o unico consumidor do tom `info`.
  em_aprovacao: { label: "Aguardando aprovação", tom: "marrom" },
  ajustes: { label: "Ajustes", tom: "atencao" },
  aprovado: { label: "Aprovado", tom: "positivo" },
  rejeitado: { label: "Rejeitado", tom: "negativo" },
  stand_by: { label: "Stand by", tom: "pausado" },
  // Task
  //
  // "Nao iniciada" e nao "Iniciar": esta chave e a MESMA para a Task e para a
  // subtarefa, e na linha da subtarefa o selo fica ao lado de um botao que se
  // chama exatamente "Iniciar" -- duas vezes a mesma palavra na mesma linha,
  // uma dizendo estado e a outra acao. Foi a imagem do prototipo que mostrou.
  //
  // Onde o produto diz "Iniciar" e no CABECALHO DA COLUNA do board, que sai de
  // `COLUNAS_POR_STATUS` em `lib/dominio/tasks.ts`: la e a coluna de onde a
  // demanda sai, e nao ha botao nenhum concorrendo ao lado.
  nao_iniciada: { label: "Não iniciada", tom: "neutro" },
  em_andamento: { label: "Em andamento", tom: "marca" },
  // "Entregue" e "Aprovado" NAO sao a mesma coisa, e o argumento continua
  // inteiro: o material saiu, ninguem disse que esta certo. O que muda e a
  // cor que diz isso. Era `atencao`, o ambar — e ambar dividia com "Em
  // ajuste", ou seja o material entregue tinha a cor de material devolvido.
  //
  // Agora e o LIMA: verde, porque entregar e um passo adiante, e mais claro
  // que o verde escuro do concluido, porque falta o aval. "verde mais claro"
  // foi a palavra do usuario, e a matiz e o que a entrega — lima-700 sobre
  // lima-100 le amarelado ao lado do verde, e um verde-600 sobre verde-50
  // daria 3,0:1, abaixo do minimo.
  entregue: { label: "Entregue", tom: "lima" },
  // VERMELHO, e aqui ele esta livre: `rejeitado` so existe no fluxo do
  // cliente, entao no fluxo da task o vermelho nao concorre com nada. Era
  // ambar, dividido com "Entregue".
  em_ajustes: { label: "Em ajuste", tom: "negativo" },
  concluido: { label: "Concluído", tom: "positivo" },
  cancelada: { label: "Cancelada", tom: "pausado" },
  // Subtarefa
  //
  // MARROM, junto com `em_aprovacao`: as duas dizem a mesma coisa num nivel
  // diferente — o material esta esperando uma decisao. Deixar uma marrom e a
  // outra azul seria a divergencia que este arquivo existe para nao ter.
  enviada_aprovacao: { label: "Enviada para aprovação", tom: "marrom" },
  concluida: { label: "Concluída", tom: "positivo" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const definicao = STATUS[status];

  // Status que ainda não conhecemos aparece cru, em vez de sumir da tela: é
  // assim que um valor novo no banco é notado em vez de passar batido.
  if (!definicao) {
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium",
          TONS.neutro,
          className,
        )}
      >
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONS[definicao.tom],
        className,
      )}
    >
      {definicao.label}
    </span>
  );
}

/** Para montar filtros sem repetir a lista de status em cada tela. */
export const STATUS_DE_CONTEUDO: StatusConteudo[] = [
  "aguardando_informacoes",
  "em_producao",
  "em_aprovacao",
  "ajustes",
  "aprovado",
  "rejeitado",
  "stand_by",
];

// A LISTA dos status da Task NAO mora aqui, e nem a da subtarefa.
//
// Havia uma copia de cada neste arquivo, e elas envelheceram: a de Task ficou
// numa ordem diferente da que o board e o filtro usam, e ninguem tinha como
// notar, porque so a vitrine de componentes lia esta. Duas listas com o mesmo
// nome e ordens diferentes e como nascem duas verdades sobre a mesma coisa.
//
// Quem tem a lista e quem tem a ordem:
//   Task       -> `STATUS_DE_TASK` em `lib/dominio/tasks.ts`
//   subtarefa  -> `STATUS_DE_SUBTAREFA` em `lib/tasks/state-machine.ts`
//
// Aqui fica so o mapa de rotulo e tom, que e o trabalho do selo.

export function rotuloDoStatus(status: Status): string {
  return STATUS[status]?.label ?? status;
}
