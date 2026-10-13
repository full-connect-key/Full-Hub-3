import { VERSAO_DO_TOUR, type ProgressoDeTour, type Tour } from "./passos";

/**
 * QUANDO O CONVITE APARECE — e ele é DERIVADO, sem nenhuma coluna a mais.
 *
 * ---------------------------------------------------------------------------
 * **"Pular por agora" NÃO SOME PARA SEMPRE**, e o sprint pede uma coisa
 * específica: *"um lembrete uma única vez no dia seguinte"*. A tentação é uma
 * coluna `lembrete_mostrado_em` — e ela seria a segunda verdade sobre um fato
 * que a linha já carrega.
 *
 * **O "uma única vez" SAI DO TRIGGER DA 0101, e isto é consequência e não
 * coincidência.** `tour_progresso_carimba` só move `finalizado_em` quando o
 * status MUDA: pular de novo escreve `pulado` sobre `pulado`, o ramo
 * `old.status = new.status` devolve a data como estava, e ela continua
 * apontando para o dia do primeiro pulo. Então:
 *
 *   * no dia do pulo, `dias === 0` → nada aparece;
 *   * no dia seguinte, `dias === 1` → o lembrete aparece;
 *   * pulando de novo, a data NÃO anda — e dois dias depois `dias === 2`,
 *     e ele não volta mais.
 *
 * Uma vez, derivado, sem coluna. Se aquele ramo do trigger cair, o lembrete
 * passa a aparecer todo dia — e é por isso que ele tem cenário na bateria.
 * ---------------------------------------------------------------------------
 *
 * **E `hoje` VEM DE FORA**, nunca de `new Date()` aqui: o container roda em UTC
 * e às 21h de São Paulo "hoje" já é amanhã lá, então um lembrete calculado
 * aqui apareceria um dia antes para quem abre o painel à noite. Quem responde
 * é `hojeNaAgencia()`, e ele é o único lugar do produto que responde isso.
 */

export type Convite = "primeiro-acesso" | "lembrete";

export function devoConvidar(
  tourId: string,
  tours: ProgressoDeTour[],
  hoje: string,
): Convite | null {
  const linha = tours.find((t) => t.tourId === tourId);

  // NENHUMA LINHA É O PRIMEIRO ACESSO, e é o caso que o módulo existe para
  // servir. A leitura falha para "nenhuma linha" de propósito (veja
  // `lib/dados/tour.ts`): no pior caso o diálogo volta, que é chato uma vez —
  // o erro contrário esconderia o tutorial de quem acabou de entrar.
  if (!linha) return "primeiro-acesso";

  if (linha.status === "pulado" && linha.finalizadoEm) {
    return diasEntre(linha.finalizadoEm, hoje) === 1 ? "lembrete" : null;
  }

  return null;
}

/**
 * O CONVITE PARA REVER, quando o tour mudou de verdade.
 *
 * **Ele é uma linha no menu de ajuda e nunca o diálogo**, que é o *"aviso
 * leve, nunca forçado"* do sprint: quem já concluiu o tour aprendeu a
 * interface, e pôr um diálogo na frente dela por causa de um passo novo é
 * cobrar atenção por uma mudança que foi nossa.
 *
 * E ele é derivado: `status = 'concluido'` com a versão menor que a de hoje.
 * Uma coluna "precisa rever" envelheceria sozinha no dia em que alguém subisse
 * o número — e a comparação mora aqui porque a versão de agora mora no código,
 * ao lado dos passos.
 */
export function convidaARever(tourId: string, tours: ProgressoDeTour[]): boolean {
  const linha = tours.find((t) => t.tourId === tourId);
  if (!linha || linha.status !== "concluido") return false;
  return linha.versao < (VERSAO_DO_TOUR[tourId] ?? 1);
}

/** Onde a pessoa parou, para o menu de ajuda dizer "retomar" em vez de "fazer". */
export function tourComecado(tourId: string, tours: ProgressoDeTour[]): boolean {
  const linha = tours.find((t) => t.tourId === tourId);
  return Boolean(linha && linha.status === "em_andamento" && linha.passoAtual > 0);
}

/**
 * OS TRÊS CARTÕES DO DIÁLOGO SAEM DOS PASSOS, e não de uma segunda lista.
 *
 * O sprint pede *"três cartões pequenos com o que a pessoa vai aprender,
 * adaptados ao perfil"*. Uma lista própria por perfil seria a segunda verdade
 * sobre o mesmo tour, e a que divergiria é a dos cartões — ninguém a relê ao
 * acrescentar um passo.
 *
 * **O RECORTE É: o primeiro depois do menu, o do meio, e o último.** O
 * primeiro passo é o menu, que é estrutura e não assunto; o ÚLTIMO é o que
 * difere por perfil — "Métricas" para o sócio, "Workflows" para o
 * desenvolvedor, "Seu perfil" para quem só executa —, e é ele que faz os
 * cartões serem adaptados sem nenhuma lista a mais.
 */
export function destaquesDoTour(tour: Tour): string[] {
  const passos = tour.passos;
  if (passos.length < 4) return passos.map((p) => p.titulo);

  const indices = [1, Math.floor(passos.length / 2), passos.length - 1];
  // `Set` porque num tour curto o do meio pode coincidir com o último, e dois
  // cartões iguais lado a lado leem como defeito da tela.
  return [...new Set(indices)].map((i) => passos[i].titulo);
}

/** Dias inteiros entre duas datas em `yyyy-MM-dd`. */
function diasEntre(de: string, ate: string): number {
  const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
