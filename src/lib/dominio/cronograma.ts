import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * O CRONOGRAMA DO CLIENTE — o que acontece quando, nas três frentes.
 *
 * ---------------------------------------------------------------------------
 * **Isto roça numa decisão do usuário, e a diferença é dita em vez de
 * escondida.** A migration 0105 fechou o Calendário Full da agência em
 * eventos, com a frase *"nada de outros abas"*: lá o calendário tinha virado
 * o segundo lugar onde se lia o que já se lê no módulo de origem, e a agência
 * tem quinze módulos para ler.
 *
 * **O lado do cliente é o caso contrário, e é por isso que ele existe.** Ele
 * tem três seções e NENHUM board: o post aparece no calendário do Social, a
 * peça de campanha aparece na árvore da campanha, e o material de uma demanda
 * aparece numa lista — então *"o que acontece esta semana"* é a única
 * pergunta da conta dele que não tem resposta em lugar nenhum. O que o mantém
 * do lado certo da 0105 é que ele é **só leitura e só link**: nada nasce
 * aqui, e cada chip leva ao módulo onde aquilo se decide.
 * ---------------------------------------------------------------------------
 */

/**
 * De onde cada linha vem — e o que a DATA dela quer dizer.
 *
 * **As três datas não são a mesma coisa, e a tela diz qual é qual.** O post
 * carrega o dia em que ele VAI AO AR; a peça de campanha e o material de uma
 * demanda carregam o dia em que eles VENCEM. Misturar "sai" com "vence" numa
 * grade sem dizer qual é qual seria a tela afirmando o que não aconteceu —
 * então cada chip leva a palavra no rótulo acessível, e a legenda diz as duas.
 */
export type FrenteDoCronograma = "social" | "campanha" | "demanda";

export const ROTULO_DA_FRENTE: Record<FrenteDoCronograma, string> = {
  social: "Social Media",
  campanha: "Campanhas",
  demanda: "Demandas",
};

/** O que a data daquela frente significa, em português de cliente. */
export const SENTIDO_DA_DATA: Record<FrenteDoCronograma, string> = {
  social: "vai ao ar",
  campanha: "prazo",
  demanda: "prazo",
};

export type ItemDoCronograma = {
  id: string;
  frente: FrenteDoCronograma;
  titulo: string;
  /** O contexto: a campanha, a demanda, o mês de social. */
  contexto: string | null;
  /** `yyyy-mm-dd`. Sem data o item não entra — não há célula para ele. */
  dia: string;
  status: ContentStatus;
  /** Para onde o chip leva. Relativo à base do portal, como `ItemDoPortal`. */
  caminho: string | null;
};

/**
 * AS ABAS, e por que não são as do roteiro.
 *
 * O roteiro pede *Tudo / Campanhas / Social / Site*. "Site" não existe neste
 * produto — não há módulo, tabela nem material de site —, e uma aba que nunca
 * tem nada dentro é pior que uma aba a menos: a pessoa clica, não acha nada, e
 * passa a desconfiar das outras três. No lugar dela entra **Demandas**, que é
 * a terceira frente de verdade: o material que veio de um pedido ou de uma
 * demanda da agência.
 */
export const FRENTES_DO_CRONOGRAMA: FrenteDoCronograma[] = [
  "social",
  "campanha",
  "demanda",
];

export function ehFrenteDoCronograma(
  valor: string | null | undefined,
): valor is FrenteDoCronograma {
  return (
    valor === "social" || valor === "campanha" || valor === "demanda"
  );
}

/**
 * Os itens de cada dia, prontos para a grade.
 *
 * `Map` e não um objeto: a chave é uma data, e um objeto com chave de data
 * ordena as chaves numéricas primeiro em alguns motores — o que aqui não
 * morde, porque a grade pede dia a dia, mas é a forma que `porDia()` do social
 * já usa e duas formas para o mesmo agrupamento é onde elas divergem.
 */
export function porDiaDoCronograma(
  itens: ItemDoCronograma[],
): Map<string, ItemDoCronograma[]> {
  const mapa = new Map<string, ItemDoCronograma[]>();
  for (const item of itens) {
    const lista = mapa.get(item.dia);
    if (lista) lista.push(item);
    else mapa.set(item.dia, [item]);
  }
  // DENTRO DO DIA, A ORDEM É A DA FRENTE e depois a do título: sem ela a
  // ordem é a das três consultas, que muda conforme qual respondeu primeiro —
  // e a mesma célula sairia em ordens diferentes a cada carregamento.
  for (const lista of mapa.values()) {
    lista.sort(
      (a, b) =>
        FRENTES_DO_CRONOGRAMA.indexOf(a.frente) -
          FRENTES_DO_CRONOGRAMA.indexOf(b.frente) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
  }
  return mapa;
}

/** Quantos de cada frente, para a contagem das abas. */
export function contarPorFrente(
  itens: ItemDoCronograma[],
): Record<FrenteDoCronograma, number> {
  const conta: Record<FrenteDoCronograma, number> = {
    social: 0,
    campanha: 0,
    demanda: 0,
  };
  for (const item of itens) conta[item.frente] += 1;
  return conta;
}
