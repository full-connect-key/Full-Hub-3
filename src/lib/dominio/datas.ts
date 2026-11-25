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
 * A HORA de um instante, no relógio da agência — `14:32`.
 *
 * ---------------------------------------------------------------------------
 * **`format(parseISO(x), "HH:mm")` responde pelo fuso do PROCESSO**, e o
 * container roda em UTC: um evento das 11h32 em São Paulo sai como `14:32` na
 * tela de quem o viveu. É o mesmo furo que `hojeNaAgencia()` fechou para o
 * DIA, um nível abaixo — e ele é mais traiçoeiro, porque três horas de erro
 * numa hora do dia continuam parecendo uma hora do dia.
 *
 * ***O que isto NÃO conserta, e é dito em vez de escondido:*** o resto do
 * produto continua escrevendo hora com `format(..., "HH:mm")` — a conversa do
 * pedido, o histórico de aprovações, o feed. Trocar as trinta ocorrências é
 * uma passada própria; o que esta função faz é existir, para a próxima tela
 * não nascer errada.
 * ---------------------------------------------------------------------------
 */
export function horaNaAgencia(instante: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_DA_AGENCIA,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instante);
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

/**
 * A SEGUNDA-FEIRA DA SEMANA DE `data`, e o dia a N dias dela.
 *
 * ---------------------------------------------------------------------------
 * **ERAM DUAS CÓPIAS, e elas já eram idênticas** — uma em
 * `lib/reports/weekly.ts` e uma em `painel/calendario/periodo.ts`. A terceira
 * seria a que divergiria: a pauta da equipe precisa dos cinco dias úteis
 * desta semana, e dois cálculos de *que semana é esta* fariam a grade
 * desenhar um dia que a consulta não trouxe. Os dois módulos REEXPORTAM estas
 * duas, então nenhuma chamada precisou mudar — é a história das sete cópias
 * de `abas.tsx` resolvida antes de a terceira existir.
 *
 * **É MEIO-DIA UTC e não meia-noite**, e a razão está escrita nas duas de
 * origem: com meia-noite, um fuso a oeste volta ao dia anterior.
 *
 * E a semana da agência começa na SEGUNDA, que é a pergunta que ela faz toda
 * segunda-feira — *o que acontece nesta semana?*
 * ---------------------------------------------------------------------------
 */
export function somarDias(data: string, quantos: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + quantos);
  return d.toISOString().slice(0, 10);
}

export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * O VOCABULÁRIO DE MÊS, e ele passou a ter um dono.
 *
 * ---------------------------------------------------------------------------
 * **ERAM TRÊS CÓPIAS DO MESMO ARRAY DE MESES**, em três módulos de domínio —
 * `notas-fiscais.ts` (`mesPorExtenso`), `escopo.ts` (`rotuloDaCompetencia`) e
 * `posts.ts` (dentro de `nomeDaPastaDoMes`) —, e as duas primeiras eram a
 * MESMA FUNÇÃO com dois nomes: as duas recebem o `date` do Postgres e
 * devolvem "Setembro de 2027". A quarta cópia seria a que divergiria, que é a
 * história de `ICONE_DA_AREA` — ele tinha três cópias e duas já tinham
 * divergido.
 *
 * **Os dois módulos REEXPORTAM, então nenhuma chamada mudou**, que é a
 * decisão de `somarDias` e `segundaDaSemana` logo acima: `mesPorExtenso` tem
 * oito chamadores em Notas Fiscais e no Financeiro, e trocar oito importações
 * para mover uma linha de texto é churn sem nada em troca. O que se ganha é
 * um lugar para olhar.
 *
 * **E O TEXTO É MONTADO DO TEXTO, nunca por `new Date(iso)`** — a razão está
 * escrita na origem: aquilo interpreta a string como UTC e, em qualquer fuso
 * a oeste, devolve o mês ANTERIOR. "Agosto" numa nota de setembro, que é a
 * mesma família do contador de atrasadas que abre este arquivo.
 *
 * ***O que isto NÃO alcança, e é dito em vez de escondido:*** o array dentro
 * de `nomeDaPastaDoMes` em `posts.ts` continua lá. Aquela função monta outra
 * frase — `Social · Outubro de 2026`, sem barra, porque `/` é legal num nome
 * de pasta do Drive —, então ela não é esta com outro nome; o que ela poderia
 * reusar é o NOME do mês, e isso é uma passada própria.
 * ---------------------------------------------------------------------------
 */
export const MESES_POR_EXTENSO = [
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

/** `2027-09-01` → "Setembro de 2027". Aceita `2027-09` também. */
export function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES_POR_EXTENSO[Number(mes) - 1] ?? mes} de ${ano}`;
}

/** "2027-09" → o primeiro dia, que é como a competência é gravada. */
export function competenciaDoMes(mes: string): string {
  return `${mes}-01`;
}

/** "2027-09-01" → "2027-09". O inverso de `competenciaDoMes`. */
export function mesDaCompetencia(competencia: string): string {
  return competencia.slice(0, 7);
}
