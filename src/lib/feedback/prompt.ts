import "server-only";

import {
  PROMPT_VERSAO,
  type ContextoDoFeedback,
  type MetricasDoFeedback,
} from "@/lib/dominio/feedback";

/**
 * O PROMPT DO FEEDBACK DE DESENVOLVIMENTO (Sprint 3H).
 *
 * `server-only` porque ele não tem o que fazer no navegador, e porque o texto
 * do sistema é a regra do módulo escrita em português: mandá-lo no bundle
 * entregaria a quem abrir o DevTools a lista exata das frases que a
 * verificação procura.
 *
 * ---------------------------------------------------------------------------
 * A IA ESCREVE. QUEM CALCULA É O BANCO.
 *
 * Nenhuma instrução aqui pede uma conta, e nenhuma deixa o modelo derivar um
 * número: as métricas chegam prontas, em JSON, e a única coisa que ele faz com
 * elas é escrever. É por isso que a verificação pós-geração confere se todo
 * número citado existe nos dados — se um aparecer que não está lá, ele foi
 * calculado, e uma conta feita por um modelo de linguagem não é uma conta.
 * ---------------------------------------------------------------------------
 *
 * **E O PROMPT NÃO É UMA TRAVA.** Ele é um pedido muito bem escrito. Quem
 * confere é `verificarOTexto()` em `lib/dominio/feedback.ts`, e as duas
 * existem de propósito — a mesma decisão da máquina de estados da subtarefa ao
 * lado dos triggers da 0007: uma escreve a instrução, a outra é a que vale.
 *
 * **Suba `PROMPT_VERSAO` sempre que mexer no texto abaixo.** Ela é gravada em
 * cada relatório, e "o texto saiu estranho" chega três meses depois — quando o
 * prompt já foi reescrito duas vezes. Uma versão que não acompanha é pior que
 * versão nenhuma: ela afirma com confiança que o relatório saiu de um texto
 * que não é o que o gerou.
 */

/**
 * O texto do sistema.
 *
 * **O BLOCO 4 NÃO FALA DE "SKILLS QUE ELA QUER DESENVOLVER"**, e a diferença
 * vem do produto: o sprint pede isso, e `user_skills` foi apagada na migration
 * 0043 por decisão do usuário. Interesse declarado não existe mais; o que
 * existe, e é melhor porque é fato, é o que a pessoa ESTUDOU no período — as
 * trilhas do Full Academy que ela tocou e as etiquetas dos materiais que
 * concluiu. Pedir ao modelo para falar de um interesse que o banco não guarda
 * seria pedir para ele inventar um.
 */
export const TEXTO_DO_SISTEMA = `Você escreve feedback de desenvolvimento para pessoas de uma agência de publicidade, a partir de dados do sistema interno dela.

CONTEXTO: este texto é lido pela própria pessoa. Ele serve para ela enxergar padrões no próprio trabalho que não enxergaria sozinha. NÃO é avaliação de desempenho, não gera consequência nenhuma para ela, e não entra em decisão sobre remuneração ou continuidade.

REGRAS ABSOLUTAS
- Fale apenas do que os dados mostram. Não especule sobre motivação, atitude, dedicação, comprometimento ou estado emocional.
- Não compare com colegas, com média da equipe, nem com qualquer outra pessoa. A única comparação permitida é com o período anterior dela, que está nos dados.
- Não atribua a ela atrasos causados por espera de aprovação interna, espera do cliente, ou sobrecarga de atribuição. Esses fatos estão no bloco CONTEXTO e nas RESSALVAS — use-os para RELATIVIZAR, nunca para cobrar.
- Se ela esteve ausente parte do período, mencione isso ao falar de volume, sem transformar em ressalva constrangedora.
- No máximo DOIS pontos de melhoria, concretos e acionáveis, cada um ligado a um dado específico. Nada de lista de defeitos.
- Nada de superlativos, elogio genérico ou frase motivacional. "Excelente trabalho", "continue assim", "você é essencial" e "parabéns" estão proibidos.
- NÃO INVENTE E NÃO CALCULE NÚMERO NENHUM. Use apenas os números que estão nos dados, exatamente como aparecem. Não some, não subtraia, não calcule percentual, não converta unidade — se um número não está lá, não fale dele. Para tempo, os dados vêm em minutos; se preferir escrever em horas, use uma casa decimal.
- Se um campo vier nulo, ele significa que não houve o que medir. Não trate nulo como zero, e não fale do que ele mediria.
- Não dê nota, conceito, estrelas, classificação nem posição em ranking.

ESTRUTURA — quatro blocos curtos, em texto corrido, SEM cabeçalho de seção:
1. O que ela entregou no período, em números concretos.
2. O que mudou em relação ao período anterior dela — para melhor ou para pior, com o número.
3. No máximo dois pontos com espaço para crescer, cada um ligado a um dado específico, com uma sugestão prática.
4. Uma sugestão de desenvolvimento ligada ao que ela estudou no período ou às trilhas do Full Academy que aparecem nos dados. Se não houver nada sobre estudo nos dados, sugira a partir do tipo de trabalho que ela mais fez, sem inventar trilha que não está listada.

TOM: direto, específico, respeitoso. Como um gestor atento que olhou os dados com cuidado e conversa de igual para igual. Português do Brasil. Entre 150 e 250 palavras. Sem emoji. Sem título. Devolva apenas o texto do feedback.`;

/**
 * A mensagem com os dados.
 *
 * O JSON vai inteiro, e não resumido: resumir aqui seria escolher, por ele, o
 * que importa — e a escolha ficaria num terceiro lugar, sem ninguém para
 * conferir. As ressalvas vão SEPARADAS e em português, porque elas são a
 * instrução de como ler o resto: soltas no meio do JSON, seriam mais um campo.
 */
export function mensagemComOsDados(
  nome: string,
  metricas: MetricasDoFeedback,
  contexto: ContextoDoFeedback,
): string {
  const ressalvas = contexto.ressalvas ?? [];

  const partes = [
    `Pessoa: ${nome}`,
    `Período: de ${metricas.periodo?.inicio} a ${metricas.periodo?.fim}`,
    "",
    "MÉTRICAS (números calculados pelo sistema, use exatamente estes):",
    JSON.stringify(metricas, null, 2),
    "",
    "CONTEXTO (o que impede a leitura errada dos números acima):",
    JSON.stringify(contexto, null, 2),
  ];

  if (ressalvas.length > 0) {
    partes.push(
      "",
      "RESSALVAS — estes fatos não são falha dela. Use-os para relativizar o volume, e não os transforme em cobrança:",
      ...ressalvas.map((r) => `- ${r}`),
    );
  }

  return partes.join("\n");
}

/** A versão do par (texto do sistema + montagem da mensagem) deste arquivo. */
export const VERSAO = PROMPT_VERSAO;
