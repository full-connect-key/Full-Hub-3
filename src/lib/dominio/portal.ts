import type {
  ContentStatus,
  StatusRodada,
  TipoDeConteudo,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário do Portal do Cliente.
 *
 * **Nada de jargão interno aqui.** "Task", "subtarefa", "etapa", "workflow" e
 * "sprint" são palavras da agência. O cliente recebe MATERIAL para aprovar, e
 * ele pertence a uma DEMANDA. Este módulo é onde a tradução acontece — e por
 * ser um lugar só, `check:cores` consegue varrer o resto de `(cliente)/` atrás
 * das palavras que não podem aparecer.
 *
 * Função pura, sem banco: a página (servidor) e os filtros (navegador)
 * precisam enxergar o mesmo conjunto sem uma segunda consulta.
 */

export type TipoDeItem = TipoDeConteudo;

/**
 * O rótulo do item na língua do cliente.
 *
 * `subtask` vira "Entregável" porque é o que ele é do lado de lá: um material
 * que a agência produziu e mandou. Post e Campanha chegam com os módulos
 * deles, e os rótulos já estão aqui para a tela não precisar aprender duas
 * vezes.
 */
export const ROTULO_DO_TIPO: Record<TipoDeItem, string> = {
  subtask: "Entregável",
  post: "Post",
  deliverable: "Entregável de campanha",
};

export const TIPOS_DE_ITEM: TipoDeItem[] = ["subtask", "post", "deliverable"];

/** Como o item chega na tela do cliente. */
export type ItemDoPortal = {
  /** A rodada, quando existe uma esperando ou já decidida. */
  rodadaId: string | null;
  tipo: TipoDeItem;
  /** O id do conteúdo — a etapa, o post, o entregável. */
  conteudoId: string;
  titulo: string;
  /** A demanda a que ele pertence. Contexto, nunca o item. */
  demanda: string;
  clienteId: string;
  cliente: string;
  status: ContentStatus;
  prazo: string | null;
  /** Quando foi enviado para decisão. */
  enviadoEm: string | null;
  miniatura: string | null;
};

/**
 * O status que o CLIENTE vê, a partir do que o banco guarda.
 *
 * O produto tem três vocabulários de status — `task_status`,
 * `subtask_status` e `content_status` — e não é descuido: são três perguntas
 * diferentes. "Em ajustes" para a equipe quer dizer que alguém está mexendo;
 * para o cliente quer dizer que o pedido dele foi ouvido. Esta função é a
 * ponte, e é a única.
 *
 * `rejeitado` e `stand_by` não saem daqui hoje: nenhum caminho do produto
 * produz esses dois ainda. Estão no enum porque os Sprints 12 e 13 os usam, e
 * inventar uma tradução agora seria mostrar ao cliente um estado que a agência
 * não tem como alcançar.
 */
export function statusParaOCliente(entrada: {
  rodada: StatusRodada | null;
  etapaConcluida: boolean;
  aguardandoInformacoes: boolean;
}): ContentStatus {
  if (entrada.rodada === "pendente") return "em_aprovacao";
  if (entrada.rodada === "ajustes_solicitados") return "ajustes";
  if (entrada.rodada === "aprovada") return "aprovado";
  // `rejeitada` entrou na 0032 e só nasce em post. Está aqui porque o tipo
  // passou a permiti-la, e um `default` silencioso mostraria "em produção"
  // para um material que o cliente recusou.
  if (entrada.rodada === "rejeitada") return "rejeitado";
  if (entrada.etapaConcluida) return "aprovado";
  if (entrada.aguardandoInformacoes) return "aguardando_informacoes";
  return "em_producao";
}

/** Os três recortes de prazo do filtro. */
export type FocoDePrazo = "urgente" | "semana" | "adiante";

export const ROTULOS_DE_PRAZO: Record<FocoDePrazo, string> = {
  urgente: "Urgente",
  semana: "Esta semana",
  adiante: "Próximas semanas",
};

/**
 * "Urgente" é hoje OU vencido, e os dois no vermelho.
 *
 * Item sem prazo não é urgente — é item que ninguém datou. Ele cai em
 * "próximas semanas", e não no topo: subir ao topo o que não tem data faria o
 * contador de urgentes contar coisa que não vence.
 */
export function focoDoPrazo(
  prazo: string | null,
  hoje: string,
  fimDaSemana: string,
): FocoDePrazo {
  if (!prazo) return "adiante";
  if (prazo <= hoje) return "urgente";
  if (prazo <= fimDaSemana) return "semana";
  return "adiante";
}

export function estaVencendo(prazo: string | null, hoje: string): boolean {
  return prazo !== null && prazo <= hoje;
}

export type FiltrosDoPortal = {
  tipo: TipoDeItem | null;
  status: ContentStatus | null;
  prazo: FocoDePrazo | null;
  busca: string;
};

export const SEM_FILTRO: FiltrosDoPortal = {
  tipo: null,
  status: null,
  prazo: null,
  busca: "",
};

export function temFiltro(f: FiltrosDoPortal): boolean {
  return (
    f.tipo !== null ||
    f.status !== null ||
    f.prazo !== null ||
    f.busca.trim() !== ""
  );
}

/**
 * O filtro, em um lugar só.
 *
 * A lista e o contador chamam a MESMA função — é isso que faz o número do
 * cartão bater com a quantidade de cartões embaixo dele. Duas contagens
 * escritas separado divergem no dia em que alguém acrescenta um filtro.
 */
export function combinaComFiltro(
  item: ItemDoPortal,
  filtros: FiltrosDoPortal,
  hoje: string,
  fimDaSemana: string,
): boolean {
  if (filtros.tipo && item.tipo !== filtros.tipo) return false;
  if (filtros.status && item.status !== filtros.status) return false;
  if (
    filtros.prazo &&
    focoDoPrazo(item.prazo, hoje, fimDaSemana) !== filtros.prazo
  )
    return false;

  const termo = filtros.busca.trim().toLowerCase();
  if (termo) {
    const alvo = `${item.titulo} ${item.demanda} ${item.cliente}`.toLowerCase();
    if (!alvo.includes(termo)) return false;
  }

  return true;
}

/**
 * Mais urgente primeiro.
 *
 * Prazo crescente deixa o vencido no topo por construção. Quem não tem prazo
 * vai para o fim, pela mesma razão de `focoDoPrazo`.
 */
export function ordenarPorUrgencia(a: ItemDoPortal, b: ItemDoPortal): number {
  if (a.prazo !== b.prazo) {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  }
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}
