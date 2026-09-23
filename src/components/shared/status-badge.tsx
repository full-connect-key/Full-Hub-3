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

type Tom = "neutro" | "marca" | "info" | "atencao" | "positivo" | "negativo" | "pausado";

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
  info: "bg-accent-strong",
  atencao: "bg-warning",
  positivo: "bg-success",
  negativo: "bg-danger",
  pausado: "bg-neutral",
};

export function corDoPontoDeStatus(status: Status): string {
  return PONTO[STATUS[status]?.tom ?? "neutro"];
}

const TONS: Record<Tom, string> = {
  neutro: "bg-neutral-soft text-neutral border-transparent",
  marca: "bg-accent text-accent-foreground border-blue-muted",
  info: "bg-accent text-accent-foreground border-blue-muted",
  atencao: "bg-warning-soft text-warning border-transparent",
  positivo: "bg-success-soft text-success border-transparent",
  negativo: "bg-danger-soft text-danger border-transparent",
  pausado: "bg-transparent text-muted-foreground border-border border-dashed",
};

const STATUS: Record<Status, { label: string; tom: Tom }> = {
  // Conteúdo
  aguardando_informacoes: { label: "Aguardando informações", tom: "neutro" },
  em_producao: { label: "Em produção", tom: "marca" },
  em_aprovacao: { label: "Aguardando aprovação", tom: "info" },
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
  // "Entregue" e "Aprovado" nao sao a mesma coisa: o material saiu, ninguem
  // disse que esta certo. Por isso tom de atencao, e nao o verde de aprovado.
  entregue: { label: "Entregue", tom: "atencao" },
  em_ajustes: { label: "Em ajuste", tom: "atencao" },
  concluido: { label: "Concluído", tom: "positivo" },
  cancelada: { label: "Cancelada", tom: "pausado" },
  // Subtarefa
  enviada_aprovacao: { label: "Enviada para aprovação", tom: "info" },
  concluida: { label: "Concluída", tom: "positivo" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
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
