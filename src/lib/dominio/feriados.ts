/**
 * Os feriados: de onde cada um veio, e que emenda ele sugere.
 *
 * Decisão do usuário, item 3: *"no calendário, quero que você puxe sozinho os
 * feriados, e que permita que eu salve feriados pontuais, no caso de algum
 * cliente tiver algum feriado específico, ou emendas de feriado"*.
 *
 * **ESTE MÓDULO É A METADE QUE O BANCO NÃO FAZ.** A 0151 calcula os treze
 * nacionais de qualquer ano e os semeia; o que ela deliberadamente NÃO faz é
 * adivinhar emenda — uma emenda é a agência decidindo fechar, e nenhuma lei a
 * define. O que o produto pode fazer é SUGERIR, e é isso que mora aqui.
 */

import { addDays, format, parseISO } from "date-fns";

/** De onde a linha de `holidays` veio. */
export type OrigemDoFeriado = "nacional" | "agencia";

export const ROTULOS_DE_ORIGEM: Record<OrigemDoFeriado, string> = {
  nacional: "Nacional",
  // "DA AGÊNCIA" e não "Manual" nem "Personalizado": quem lê a lista quer
  // saber de QUEM é a decisão, e não por que caminho a linha entrou. É a
  // mesma régua do selo "à mão" das demandas — a palavra diz a escolha, não o
  // mecanismo.
  agencia: "Da agência",
};

export function ehOrigemDeFeriado(valor: string): valor is OrigemDoFeriado {
  return valor === "nacional" || valor === "agencia";
}

export function rotuloDaOrigem(valor: string): string {
  return ehOrigemDeFeriado(valor) ? ROTULOS_DE_ORIGEM[valor] : valor;
}

/** Uma emenda que o produto sugere, derivada de um feriado que já existe. */
export type EmendaSugerida = {
  /** O dia da emenda, `yyyy-MM-dd`. */
  data: string;
  /** O nome sugerido, já pronto para o campo. */
  nome: string;
  /** O feriado que a motivou — é ele que explica a sugestão. */
  porCausaDe: { data: string; nome: string };
};

/**
 * As emendas que estes feriados sugerem, e que ainda não estão na lista.
 *
 * **A REGRA É A PONTE PARA O FIM DE SEMANA, e são só dois casos:** feriado na
 * TERÇA sugere a segunda anterior, feriado na QUINTA sugere a sexta seguinte.
 * Nos dois, o dia sugerido é o único dia útil entre o feriado e o fim de
 * semana — é o que faz dele uma emenda e não um dia de folga solto.
 *
 * **E SÓ ESSES DOIS, de propósito.** Feriado na segunda ou na sexta já emenda
 * sozinho; na quarta não há emenda possível sem dois dias; e no sábado ou no
 * domingo não há o que emendar. Sugerir fora dos dois casos encheria a tela
 * de sugestões que ninguém usa — e uma sugestão que a pessoa aprende a ignorar
 * é pior que nenhuma.
 *
 * **ELA SUGERE E NUNCA GRAVA**, que é a diferença inteira entre isto e a
 * geração dos nacionais: o nacional é um fato do calendário e nasce sozinho; a
 * emenda é uma escolha da agência, e gravá-la por conta própria faria o produto
 * fechar a casa num dia que ninguém combinou. Cada sugestão é um clique.
 *
 * **O DIA SUGERIDO QUE JÁ ESTÁ NA LISTA NÃO É SUGERIDO DE NOVO**, e é essa
 * linha que faz a seção sumir quando a agência já decidiu tudo — em vez de
 * oferecer para sempre o que ela acabou de gravar.
 */
export function emendasSugeridas(
  feriados: { data: string; nome: string }[],
): EmendaSugerida[] {
  const existentes = new Set(feriados.map((f) => f.data));
  const sugestoes: EmendaSugerida[] = [];
  const vistos = new Set<string>();

  for (const feriado of feriados) {
    const dia = parseISO(feriado.data);
    if (Number.isNaN(dia.getTime())) continue;

    const semana = dia.getDay();
    // Terça → a segunda antes. Quinta → a sexta depois.
    const passo = semana === 2 ? -1 : semana === 4 ? 1 : 0;
    if (passo === 0) continue;

    const alvo = format(addDays(dia, passo), "yyyy-MM-dd");
    if (existentes.has(alvo) || vistos.has(alvo)) continue;
    vistos.add(alvo);

    sugestoes.push({
      data: alvo,
      // O NOME JÁ VEM PRONTO e cita o feriado, porque é ele que explica por
      // que a casa fecha naquele dia. Um "Emenda" sozinho na grade do Day Off,
      // seis meses depois, não diz de quê.
      nome: `Emenda de ${feriado.nome}`,
      porCausaDe: { data: feriado.data, nome: feriado.nome },
    });
  }

  return sugestoes.sort((a, b) => a.data.localeCompare(b.data));
}
