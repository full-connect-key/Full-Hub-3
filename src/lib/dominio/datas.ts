/**
 * O HOJE DA AGÊNCIA, e ele é um só.
 *
 * ---------------------------------------------------------------------------
 * **O produto tinha QUINZE definições de "hoje", em DOIS sabores que não
 * concordam entre si.**
 *
 * `new Date().toISOString().slice(0, 10)` devolve a data em **UTC**, sempre.
 * `format(new Date(), "yyyy-MM-dd")` devolve a data no fuso do **processo** —
 * que numa hospedagem qualquer é UTC, e na máquina de quem desenvolve é o
 * fuso dele. Os dois estavam espalhados por tela, camada de dados e domínio,
 * e às vezes na mesma pergunta: o board da Gestão de Tasks decidia atraso
 * pelo primeiro e o contador de Minhas Tasks pelo segundo.
 *
 * **O sintoma é um número que mente por três horas todo dia.** A agência está
 * em UTC−3. Das 21h à meia-noite, para um servidor em UTC, "hoje" já é
 * amanhã — e toda etapa que vence HOJE passa a ler `prazo < hoje`, ou seja,
 * **atrasada**. O contador diz "1 atrasada", a pessoa abre a lista, vê uma
 * etapa que vence hoje, e conclui com razão que não há nada atrasado ali. De
 * manhã o número some sozinho, o que é o pior jeito de um bug se apresentar:
 * ele não é reprodutível no horário em que alguém vai procurá-lo.
 *
 * **A regra do produto já dizia metade disto** — *"hoje e fim da semana são
 * calculados no servidor e passados adiante"* — e o que faltava era dizer em
 * QUE fuso. Calcular no servidor não resolve nada se o servidor não sabe onde
 * a agência fica.
 * ---------------------------------------------------------------------------
 *
 * **Não é `process.env.TZ` nem configuração**, e a escolha é deliberada: a
 * Full Connect Key trabalha num fuso só, e uma variável de ambiente a mais é
 * mais um jeito de a hospedagem seguinte nascer errada — sem nada na tela
 * dizendo. Se um dia houver escritório em dois fusos, isto vira coluna de
 * `profiles` e esta função ganha um parâmetro; até lá, o valor literal é o
 * que faz a resposta não depender de onde o processo roda.
 *
 * **E ela é pura e sem diretiva**, então serve aos dois lados — que é o outro
 * ganho: hoje um componente de cliente calculava UTC e o servidor calculava
 * local, e os dois desenhavam a mesma etapa de dois jeitos.
 */
export const FUSO_DA_AGENCIA = "America/Sao_Paulo";

/**
 * A data de hoje na agência, em `yyyy-mm-dd`.
 *
 * `en-CA` é o truque: é o único locale comum cujo formato curto já é
 * `YYYY-MM-DD`, então não há remontagem de partes para errar. O `timeZone` é
 * o que faz o `Intl` responder pelo calendário de lá, e não pelo do processo.
 */
export function hojeNaAgencia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_AGENCIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * O domingo que fecha a semana de `hoje` — a semana começa na segunda.
 *
 * **A conta é feita em UTC sobre uma data SIMPLES**, e não com `endOfWeek` do
 * date-fns: aquele opera no fuso do processo, e reintroduziria pela porta dos
 * fundos exatamente o que `hojeNaAgencia()` acabou de fechar. Aqui não há
 * instante nenhum envolvido — só um dia do calendário andando para a frente.
 */
export function fimDaSemanaNaAgencia(agora: Date = new Date()): string {
  const base = new Date(`${hojeNaAgencia(agora)}T00:00:00Z`);
  const diaDaSemana = base.getUTCDay(); // 0 = domingo
  base.setUTCDate(base.getUTCDate() + (diaDaSemana === 0 ? 0 : 7 - diaDaSemana));
  return base.toISOString().slice(0, 10);
}

/**
 * "Bom dia", "Boa tarde" ou "Boa noite" — a saudação de DUAS telas.
 *
 * **Ela nasceu dentro de `minhas-tasks/page.tsx` e saiu de lá quando o Início
 * passou a saudar também.** Duas cópias de uma conta de relógio divergem no
 * dia em que alguém mexer numa: abrir as duas telas às sete da noite e ler
 * "Boa tarde" numa e "Boa noite" na outra é a plataforma desmentindo a si
 * mesma a um clique de distância — a decisão de `STATUS_EM_ORDEM` e de
 * `ICONE_DA_AREA`.
 *
 * **E a hora é a DA AGÊNCIA, não a do processo**, pela razão inteira deste
 * arquivo. O container roda em UTC; às 12h30 de lá são 9h30 em São Paulo, e a
 * versão que lia `new Date().getHours()` desejava boa tarde a quem tinha
 * acabado de chegar. O erro é o mesmo do contador de atrasadas, só que ele
 * aparece na primeira linha da primeira tela.
 */
export function saudacaoDaAgencia(agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: FUSO_DA_AGENCIA,
      hour: "2-digit",
      hour12: false,
    }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
