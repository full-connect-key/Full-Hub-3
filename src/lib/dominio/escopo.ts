/**
 * O escopo do contrato mensal de uma conta (migration 0149).
 *
 * Decisão do usuário: *"No portal do cliente, deve aparecer um espaço onde
 * mostra quantos % do escopo do contrato mensal, o cliente já usou. essas
 * quantidades devem ser preenchidas pela agência na parte interna, onde
 * visualiza a conta cliente a cliente. assim, o cliente vai saber quantos
 * posts ele ainda tem direito, e outras informações em aberto"*.
 *
 * ---------------------------------------------------------------------------
 * **O QUE MORA AQUI É A CONTA DOS DOIS NÚMEROS, e ela é a mesma nos dois
 * lados da porta**: a ficha do cliente desenha o que a agência digitou, e o
 * portal desenha o que o cliente usou — se cada tela fizesse a própria
 * divisão, a agência veria uma porcentagem e o cliente veria outra sobre a
 * mesma linha.
 *
 * ---------------------------------------------------------------------------
 * **E O `usado` É DIGITADO, não contado — o que inverte a regra desta casa e
 * por isso precisa estar escrito.** *O que dá para calcular não se guarda*
 * vale para o que o produto SABE derivar: atraso, a mão do post, a fase do
 * pedido. Aqui ele não deriva nada, e isso foi medido antes de a tabela
 * existir: no Postgres de produção são **21 contas ativas, 3 posts, 0 peças
 * de campanha, 0 meses de social e 0 campanhas** — uma porcentagem contada
 * leria **0% em toda conta, todo mês**, e o bloco que o cliente abre para
 * saber quantos posts ele ainda tem diria que ele não usou nada.
 *
 * E contar exigiria um de-para entre três vocabulários que o produto mantém
 * separados de propósito — `posts.midia` (0042), `posts.formato`, que é texto
 * livre desde a 0032, e `deliverables.tipo` (0122) —, ou seja o produto
 * decidindo sozinho o que a agência pode cobrar. Quem decide isso é o
 * contrato, e quem o digita é quem o assinou.
 */

import type { Database } from "@/lib/supabase/database.types";

import { hojeNaAgencia } from "./datas";

export type ItemDoEscopo =
  Database["public"]["Tables"]["client_scope_items"]["Row"];
export type ConsumoDoEscopo =
  Database["public"]["Tables"]["client_scope_usage"]["Row"];

/**
 * O passo entre duas posições, como nas vertentes (0118) e na corrente do
 * social (0045): dez, para inserir um item ENTRE dois sem renumerar o resto.
 */
export const PASSO_DA_ORDEM = 10;

/** Um item do contrato com o que ele consumiu num mês. */
export type LinhaDoEscopo = {
  item: ItemDoEscopo;
  /** Quanto a agência digitou para este mês. Zero quando ninguém digitou nada. */
  usado: number;
  /** A frase daquele mês, quando existe — "3 extras aprovados por e-mail". */
  observacao: string | null;
  /** Já houve escrita para este item neste mês? */
  lancado: boolean;
};

/**
 * A competência de um mês, sempre no dia 1.
 *
 * **É `hojeNaAgencia()` e nunca `new Date().toISOString()`**, que é a regra
 * escrita desta casa: o container roda em UTC, e das 21h à meia-noite do dia
 * 30 o mês já virou lá — o bloco do portal abriria em dezembro no dia 30 de
 * novembro, com zero usado em tudo.
 */
export function competenciaDe(data: string): string {
  return `${data.slice(0, 7)}-01`;
}

/** A competência do mês corrente. */
export function competenciaDeAgora(agora: Date = new Date()): string {
  return competenciaDe(hojeNaAgencia(agora));
}

/** "Novembro de 2026", a partir de uma competência. */
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function rotuloDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : competencia;
}

/**
 * Os doze meses que o seletor da ficha oferece, do corrente para trás.
 *
 * **Doze e não a lista do que já foi lançado**, pela razão de
 * `mesesParaEmitir` nas Notas Fiscais: a lista do que existe não contém o mês
 * que alguém está começando a preencher agora, e um seletor que só mostra o
 * passado não tem como receber o presente. Para trás e não para frente porque
 * consumo é um fato que já aconteceu — digitar o mês que vem é digitar o que
 * ninguém usou ainda.
 */
export function competenciasParaLancar(agora: Date = new Date()): string[] {
  const corrente = competenciaDeAgora(agora);
  const [ano, mes] = corrente.split("-").map(Number);
  const lista: string[] = [];
  for (let i = 0; i < 12; i++) {
    const total = ano * 12 + (mes - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    lista.push(`${a}-${String(m).padStart(2, "0")}-01`);
  }
  return lista;
}

/**
 * A porcentagem usada de um item.
 *
 * **ELA PASSA DE 100, e é o ponto.** Um teto aqui esconderia o mês em que o
 * cliente pediu mais do que contratou — que é justamente a conversa que o
 * bloco existe para abrir —, e o banco também não o impõe: o `check` da 0149
 * só cobra que `usado` não seja negativo.
 */
export function percentualUsado(linha: LinhaDoEscopo): number {
  if (linha.item.quantidade <= 0) return 0;
  return Math.round((linha.usado / linha.item.quantidade) * 100);
}

/** Quanto sobra. Nunca negativo: "sobram −3" não é uma frase. */
export function quantoSobra(linha: LinhaDoEscopo): number {
  return Math.max(0, linha.item.quantidade - linha.usado);
}

export type NivelDoEscopo = "disponivel" | "quase" | "estourado";

/**
 * Em que pé está um item do escopo.
 *
 * ---------------------------------------------------------------------------
 * **NÃO É `nivelDaCarga()`, e a ausência de reuso é dita em vez de
 * escondida.** Aquela escala responde *"a pessoa aguenta mais trabalho neste
 * dia?"* — minutos contra uma capacidade diária —, e ela difere desta em duas
 * coisas que decidem o desenho: lá `vazio` é a ausência de trabalho, e aqui
 * zero usado é o **começo de todo mês**, que é o estado bom; e lá passar de
 * 100% é um aviso para quem distribui, enquanto aqui é um FATO para o
 * cliente, que pode ser perfeitamente normal — extras aprovados por e-mail.
 *
 * **O PAR DE COR É O MESMO de propósito**, e isso não é a segunda escala: o
 * que não pode divergir é o significado de verde, âmbar e vermelho no
 * produto, e os três pares já estão medidos pelo `check:cores`. O que é
 * próprio daqui é onde cada degrau começa, e por quê.
 * ---------------------------------------------------------------------------
 */
export function nivelDoEscopo(linha: LinhaDoEscopo): NivelDoEscopo {
  const pct = percentualUsado(linha);
  if (pct > 100) return "estourado";
  if (pct >= 80) return "quase";
  return "disponivel";
}

/** O chão da barra de cada degrau. Par nomeado, nunca opacidade. */
export const COR_DO_NIVEL_DO_ESCOPO: Record<NivelDoEscopo, string> = {
  disponivel: "bg-success",
  quase: "bg-warning",
  estourado: "bg-danger",
};

/**
 * A frase de um item, para quem lê sem a barra.
 *
 * **O rótulo acessível diz o NÚMERO e não a cor**, que é a regra do chip do
 * calendário: quem usa leitor de tela não tem o verde nem o âmbar.
 */
export function fraseDoItem(linha: LinhaDoEscopo): string {
  // A UNIDADE VEM DEPOIS DO CONTRATADO, nunca depois do usado: "0 horas de 4"
  // lê como se o contrato fosse de quatro de outra coisa. "0 de 4 horas" é a
  // frase que a agência diz em voz alta.
  const { descricao, quantidade, unidade } = linha.item;
  const medida = unidade?.trim() ? ` ${unidade.trim()}` : "";
  if (linha.usado > quantidade) {
    return `${descricao}: ${linha.usado} de ${quantidade}${medida} contratados — ${
      linha.usado - quantidade
    } além do contrato.`;
  }
  return `${descricao}: ${linha.usado} de ${quantidade}${medida}, ${quantoSobra(linha)} em aberto.`;
}

/**
 * Junta o que foi contratado com o que foi usado naquele mês.
 *
 * **O ITEM MANDA, e o consumo é opcional:** um item sem linha de consumo é um
 * item que ninguém lançou — zero usado, que é a verdade do começo do mês. O
 * caminho contrário (partir do consumo) perderia da tela exatamente os itens
 * que ainda estão inteiros, que é o que o cliente abre o bloco para ver.
 */
export function montarLinhas(
  itens: ItemDoEscopo[],
  consumo: ConsumoDoEscopo[],
): LinhaDoEscopo[] {
  const porItem = new Map(consumo.map((c) => [c.item_id, c]));
  return itens.map((item) => {
    const c = porItem.get(item.id);
    return {
      item,
      usado: c?.usado ?? 0,
      observacao: c?.observacao ?? null,
      lancado: Boolean(c),
    };
  });
}

/**
 * As linhas que o PORTAL desenha.
 *
 * **A DESATIVADA FICA DE FORA, e aqui ela sai mesmo tendo consumo:** um item
 * que a agência tirou do contrato não é mais um direito do cliente, e
 * mostrá-lo com "8 de 12" afirmaria que ele ainda tem quatro. Na ficha ela
 * continua, porque é lá que se reativa uma.
 */
export function escopoParaOCliente(linhas: LinhaDoEscopo[]): LinhaDoEscopo[] {
  return linhas.filter((l) => l.item.ativo);
}
