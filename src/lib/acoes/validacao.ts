import "server-only";

import type { ZodError, ZodIssue } from "zod";

/**
 * A mensagem que a pessoa lê quando o zod recusa os dados.
 *
 * POR QUE ISTO EXISTE: as actions devolviam `error.issues[0].message` cru, e
 * quando o campo chega FALTANDO o zod não usa a mensagem que escrevemos — a
 * nossa está pendurada no `.min(2, "Informe o título da task.")`, que é uma
 * refinação, e refinação só roda depois de o valor já ser uma string. Sem o
 * valor, o que sai é o texto interno do zod, em inglês:
 *
 *     Invalid input: expected string, received undefined
 *
 * Isso não diz qual campo, não diz o que fazer, e não está em português. Foi
 * o que apareceu na tela para quem estava usando o sistema. E é o caso mais
 * comum de todos: campo em branco é o erro que as pessoas cometem.
 *
 * TRÊS REGRAS:
 *
 *   1. campo faltando vira uma frase em português que NOMEIA o campo — e
 *      nomeia TODOS de uma vez, não um por envio. Devolver um de cada vez faz
 *      a pessoa preencher, mandar, descobrir o próximo, e repetir;
 *   2. qualquer outro problema mantém a mensagem que escrevemos;
 *   3. se mesmo assim escapar texto interno do zod, ele é trocado antes de
 *      chegar à tela.
 *
 * O erro completo vai sempre para o log do servidor.
 */

/** O rótulo de cada campo, como a tela o chama. Mora junto do esquema. */
export type RotulosDeCampo = Record<string, string>;

/**
 * O texto que o zod gera sozinho, em inglês. Se um destes chegar à tela é
 * porque escapou — e aí a frase genérica é melhor, porque ao menos está no
 * idioma de quem lê.
 */
const PARECE_DO_ZOD = /^(Invalid|Too (small|big)|Unrecognized|Required|Expected)\b/;

function caminho(issue: ZodIssue): string {
  return issue.path.map((p) => String(p)).join(".");
}

/** "link_entrega" → "link entrega". Último recurso, quando não há rótulo. */
function legivel(chave: string): string {
  return chave.replace(/[._]/g, " ").trim();
}

/**
 * O nome do campo, como a pessoa o vê na tela.
 *
 * CAMPO DE DENTRO DE LISTA NÃO EMPRESTA O RÓTULO DE CIMA. `subtarefas.0.titulo`
 * e `titulo` são campos diferentes — o primeiro é o título de uma etapa, o
 * segundo é o da demanda. Cair no rótulo do último pedaço fazia a recusa de
 * uma subtarefa vazia dizer "Faltou preencher: título da task", que manda a
 * pessoa conferir um campo que estava certo. Foi o teste do helper que
 * mostrou.
 *
 * Por isso o aninhado só aceita rótulo do caminho INTEIRO, e carrega a
 * posição junto: "titulo (subtarefas 1)" diz onde olhar sem inventar nome.
 */
function rotuloDe(issue: ZodIssue, rotulos: RotulosDeCampo): string {
  if (issue.path.length === 0) return "";

  const ultima = String(issue.path[issue.path.length - 1]);

  if (issue.path.length === 1) return rotulos[ultima] ?? legivel(ultima);

  // Duas chaves possíveis, e a útil é a segunda: o caminho real traz o índice
  // (`subtarefas.0.titulo`), e um mapa com uma entrada por posição seria um
  // mapa infinito. `subtarefas.titulo` é o que alguém escreve à mão.
  const semIndices = issue.path.filter((p) => typeof p !== "number").join(".");
  const base = rotulos[caminho(issue)] ?? rotulos[semIndices] ?? legivel(ultima);

  // A posição na lista, contada de 1 — ninguém chama a primeira de "zero".
  const indice = issue.path.findIndex((p) => typeof p === "number");
  if (indice <= 0) return base;

  const lista = String(issue.path[indice - 1]);
  const numero = Number(issue.path[indice]) + 1;
  return `${base} (${rotulos[lista] ?? legivel(lista)} ${numero})`;
}

/**
 * O valor que a action recebeu naquele caminho.
 *
 * NÃO dá para perguntar ao `issue`: neste zod, `issue.input` vem `undefined`
 * até quando o valor existia — conferido com o zod que está instalado. Um
 * "faltou preencher" baseado nele acusaria campo cheio de faltando. O único
 * jeito exato é olhar o dado que foi validado.
 */
function valorEm(dados: unknown, issue: ZodIssue): unknown {
  let atual: unknown = dados;
  for (const parte of issue.path) {
    if (atual === null || atual === undefined) return undefined;
    if (typeof atual !== "object") return undefined;
    atual = (atual as Record<string | number, unknown>)[parte as string | number];
  }
  return atual;
}

/** O campo não estava lá. String vazia NÃO conta: aí a nossa mensagem serve. */
function ehCampoFaltando(dados: unknown, issue: ZodIssue): boolean {
  if (issue.code !== "invalid_type") return false;
  const valor = valorEm(dados, issue);
  return valor === undefined || valor === null;
}

export function mensagemDeValidacao(
  erro: ZodError,
  dados: unknown,
  fallback: string,
  rotulos: RotulosDeCampo = {},
): string {
  const faltando = erro.issues.filter((i) => ehCampoFaltando(dados, i));

  if (faltando.length > 0) {
    const nomes = [...new Set(faltando.map((i) => rotuloDe(i, rotulos)).filter(Boolean))];
    if (nomes.length === 1) return `Faltou preencher: ${nomes[0]}.`;
    if (nomes.length > 1) {
      const ultimo = nomes.pop();
      return `Faltou preencher: ${nomes.join(", ")} e ${ultimo}.`;
    }
  }

  const issue = erro.issues[0];
  if (!issue) return fallback;

  if (issue.message && !PARECE_DO_ZOD.test(issue.message)) return issue.message;

  // Sobrou texto interno do zod. Não vai para a tela.
  const rotulo = rotuloDe(issue, rotulos);
  return rotulo ? `${fallback} Confira o campo: ${rotulo}.` : fallback;
}

/**
 * O mesmo, e mais o log.
 *
 * `acao` é o nome da action, como em `executarAcao`. No log vai o erro
 * inteiro — todos os campos recusados —, porque quem for investigar precisa
 * ver o conjunto, e quem está na tela precisa de uma frase.
 */
export function recusaDeValidacao(
  acao: string,
  erro: ZodError,
  dados: unknown,
  fallback: string,
  rotulos: RotulosDeCampo = {},
): string {
  console.error(
    `[acao:${acao}] dados recusados pela validacao:`,
    erro.issues.map((i) => ({ campo: caminho(i), code: i.code, message: i.message })),
  );
  return mensagemDeValidacao(erro, dados, fallback, rotulos);
}
