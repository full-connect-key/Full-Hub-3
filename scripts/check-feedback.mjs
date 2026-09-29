#!/usr/bin/env node
/**
 * A verificação do texto do feedback continua pegando o que não pode passar?
 *
 * `verificarOTexto()` em `src/lib/dominio/feedback.ts` é a única coisa entre o
 * que um modelo de linguagem escreveu e o que uma pessoa da agência vai ler
 * sobre si mesma. O prompt pede; ela confere.
 *
 * ---------------------------------------------------------------------------
 * **ELA NÃO QUEBRA COM ERRO. ELA PASSA A DEIXAR TUDO PASSAR.**
 *
 * É a família do `check:email` e do `check:preview`, e é por isso que os três
 * existem: uma trava que, quando some, faz o programa fazer MAIS coisas não
 * derruba `build`, não derruba `typecheck`, não derruba a bateria de SQL e não
 * aparece em imagem de protótipo. Tirando uma família de termos daqui, tudo
 * continua verde — e a primeira notícia é alguém lendo, sobre si mesma, que
 * entregou menos que a equipe.
 *
 * E o estrago não se desfaz: feedback enviado foi lido.
 * ---------------------------------------------------------------------------
 *
 * **E ELA MEDE OS DOIS SENTIDOS.** Só a metade "pegou" passaria numa função
 * que acusa SEMPRE — que não é a trava certa, é uma trava quebrada: aí todo
 * relatório nasceria marcado para revisão obrigatória, quem revisa aprenderia
 * a ignorar a faixa de alertas, e o alerta de verdade passaria no meio. Por
 * isso o primeiro caso é um texto limpo, e ele tem que sair com ZERO achados.
 */
import { verificarOTexto, numerosDoTexto, periodoFechadoAnterior } from "../src/lib/dominio/feedback.ts";

/**
 * As métricas de mentira, com os números que o texto limpo cita. Elas existem
 * para a checagem de "todo número citado existe nos dados" ter dados.
 */
const METRICAS = {
  periodo: { inicio: "2027-04-01", fim: "2027-04-30", dias: 30 },
  entrega: {
    concluidas: 14,
    com_prazo: 12,
    no_prazo: 10,
    fora_do_prazo: 2,
    sem_prazo: 2,
    taxa_no_prazo: 83.3,
    dias_de_atraso_media: 2.5,
    minutos_reais: 2400,
  },
  periodo_anterior: {
    inicio: "2027-03-02",
    fim: "2027-03-31",
    concluidas: 9,
    com_prazo: 8,
    no_prazo: 5,
    taxa_no_prazo: 62.5,
    minutos_reais: 1800,
  },
  calibracao: {
    etapas_medidas: 12,
    minutos_estimados: 1800,
    minutos_reais: 2400,
    desvio_percentual: 33.3,
    tendencia: "subestima",
  },
  qualidade: {
    conteudos_decididos: 7,
    aprovados_de_prima: 5,
    taxa_de_prima: 71.4,
    rodadas_media: 1.4,
  },
  desenvolvimento: {
    trilhas: [{ titulo: "Redação para redes", materiais_concluidos: 3 }],
    etiquetas_estudadas: ["Copywriting"],
    workflows_novos: ["Campanha"],
  },
};

const CONTEXTO = {
  ausencia: { dias_fora: 3, dias_uteis_no_periodo: 21, proporcao_fora: 14.3, por_tipo: [] },
  carga: {
    minutos_comprometidos: 8400,
    capacidade_minutos_dia: 480,
    dias_uteis: 21,
    etapas_datadas: 12,
    etapas_sem_estimativa: 0,
    proporcao_da_capacidade: 83.3,
  },
  espera_por_aprovacao: { horas_interna: 12, horas_cliente: 40, rodadas_ainda_pendentes: 1 },
  clientes_com_retrabalho: [],
  ressalvas: [],
};

/**
 * O TEXTO LIMPO. Ele é o caso que importa mais, e é o mais fácil de esquecer:
 * uma função que acusa sempre passaria em todos os outros.
 *
 * Todo número aqui está nas métricas acima, e as duas horas ("40 horas", "2,5
 * dias") existem para provar as derivações que a função autoriza de propósito:
 * minutos para horas, e uma casa decimal.
 */
const LIMPO = `Em abril você fechou 14 etapas, 12 delas com prazo combinado, e 10 saíram dentro da data. Foram 2400 minutos de trabalho registrado, com 3 dias fora no período.

Comparando com o seu período anterior, a entrega subiu de 9 para 14 etapas e a taxa dentro do prazo passou de 62.5 para 83.3. As duas que saíram fora vencerem em média 2.5 dias depois da data.

Duas coisas com espaço para crescer. A primeira é a estimativa: nas 12 etapas em que havia estimativa e tempo medido, a soma estimada foi de 1800 minutos contra 2400 de tempo real, um desvio de 33.3 para cima. Vale reservar uma folga ao datar as etapas de campanha. A segunda é o retorno do cliente: das 7 peças decididas, 5 passaram de primeira, e as outras somaram 40 horas de espera do lado dele.

Como você concluiu 3 materiais da trilha Redação para redes neste período, o caminho natural é fechá-la antes de pegar a próxima.`;

/**
 * Cada caso é [nome, texto, tipos que TÊM que aparecer].
 *
 * O texto de cada violação é curto de propósito: ele não precisa ser um
 * feedback plausível, precisa carregar exatamente uma coisa proibida — senão a
 * checagem passaria por causa de outro achado, e diria que pegou o que não
 * pegou. Por isso o terceiro elemento é a lista dos tipos esperados, e não só
 * "achou algo".
 */
const CASOS = [
  ["texto limpo", LIMPO, []],
  [
    "comparação com a equipe",
    "Você fechou 14 etapas, acima da média da equipe neste período.",
    ["comparacao"],
  ],
  [
    "comparação com colegas",
    "Você fechou 14 etapas, mais que os seus colegas de área.",
    ["comparacao"],
  ],
  [
    "julgamento de atitude",
    "Você fechou 14 etapas, o que mostra bastante dedicação e comprometimento.",
    ["carater"],
  ],
  [
    "julgamento de desmotivação",
    "A queda para 9 etapas sugere desmotivação com o trabalho.",
    ["carater"],
  ],
  [
    "elogio genérico",
    "Você fechou 14 etapas em abril. Excelente trabalho, continue assim.",
    ["elogio"],
  ],
  [
    "nota e conceito",
    "Considerando as 14 etapas, sua nota no período foi 8 de 10.",
    ["nota"],
  ],
  [
    "número que não existe nos dados",
    "Em abril você fechou 14 etapas, uma média de 4.7 por semana.",
    ["numero"],
  ],
  [
    "texto curto demais",
    "Você fechou 14 etapas em abril e 9 no período anterior.",
    ["tamanho"],
  ],
];

let falhas = 0;
const dizer = (ok, texto) => {
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok    " : "FALHA "} ${texto}`);
};

console.log("\nA verificação do texto gerado\n");

for (const [nome, texto, esperados] of CASOS) {
  const achados = verificarOTexto(texto, METRICAS, CONTEXTO);
  const tipos = [...new Set(achados.map((a) => a.tipo))];

  if (esperados.length === 0) {
    dizer(
      achados.length === 0,
      achados.length === 0
        ? `${nome}: passa sem nenhum alerta`
        : `${nome}: devia passar limpo e saiu com ${achados.length} alerta(s) — ${achados.map((a) => a.frase).join(" | ")}`,
    );
    continue;
  }

  const faltando = esperados.filter((t) => !tipos.includes(t));
  dizer(
    faltando.length === 0,
    faltando.length === 0
      ? `${nome}: pega, e diz o que achou (${tipos.join(", ")})`
      : `${nome}: NÃO foi pego — esperava ${faltando.join(", ")}, achou ${tipos.join(", ") || "nada"}`,
  );
}

// ---------------------------------------------------------------------------
// A leitura de número, que é a parte que erra em silêncio
//
// Ela decide a checagem mais valiosa da lista -- "todo número citado existe nos
// dados" --, e erra para os dois lados: lendo `A4` como 4, ela acusa um número
// que ninguém citou; perdendo `83.3`, ela deixa passar um número inventado.
// ---------------------------------------------------------------------------
console.log("\nA leitura dos números do texto\n");

const NUMEROS = [
  ["inteiro solto", "foram 14 etapas", [14]],
  ["decimal com ponto", "a taxa foi 83.3", [83.3]],
  ["decimal com vírgula", "a taxa foi 83,3", [83.3]],
  ["milhar com ponto", "somaram 2.400 minutos", [2400]],
  // O FURO QUE ESTE CASO ACHOU: com a parte inteira limitada a tres digitos,
  // `2400` nao casava com nada, e a checagem de "todo numero citado existe nos
  // dados" ficava cega para os numeros de minuto -- os maiores que o texto cita.
  ["quatro digitos sem separador", "somaram 2400 minutos", [2400]],
  ["dois na mesma frase", "de 9 para 14", [9, 14]],
  ["formato de papel não é número", "a peça saiu em A4", []],
  ["unidade colada não é número", "levou 3h no total", []],
  ["data inteira", "no período de 2027-04-01", [2027, 4, 1]],
];

for (const [nome, texto, esperado] of NUMEROS) {
  const achado = numerosDoTexto(texto);
  const igual =
    achado.length === esperado.length && achado.every((n, i) => n === esperado[i]);
  dizer(igual, igual ? `${nome}: ${JSON.stringify(achado)}` : `${nome}: esperava ${JSON.stringify(esperado)}, achou ${JSON.stringify(achado)}`);
}

// ---------------------------------------------------------------------------
// O período fechado ANTERIOR
//
// Ele é o que decide de que mês o feedback fala, e a virada de ano é onde uma
// conta de mês erra sem avisar: em janeiro, "o mês anterior" é dezembro DO ANO
// PASSADO, e um `mes - 1` cru devolve o mês zero.
// ---------------------------------------------------------------------------
console.log("\nO período fechado anterior\n");

const PERIODOS = [
  ["mensal, no meio do ano", "2027-05-14", "mensal", "2027-04-01", "2027-04-30"],
  ["mensal, em janeiro, vira dezembro do ano passado", "2027-01-09", "mensal", "2026-12-01", "2026-12-31"],
  ["mensal, em março, pega fevereiro de 28", "2027-03-02", "mensal", "2027-02-01", "2027-02-28"],
  ["mensal, em março de ano bissexto, pega 29", "2028-03-02", "mensal", "2028-02-01", "2028-02-29"],
  ["trimestral, no segundo trimestre", "2027-05-14", "trimestral", "2027-01-01", "2027-03-31"],
  ["trimestral, no primeiro, vira o quarto do ano passado", "2027-02-10", "trimestral", "2026-10-01", "2026-12-31"],
  ["trimestral, no quarto", "2027-11-30", "trimestral", "2027-07-01", "2027-09-30"],
];

for (const [nome, hoje, periodicidade, inicio, fim] of PERIODOS) {
  const p = periodoFechadoAnterior(hoje, periodicidade);
  const igual = p.inicio === inicio && p.fim === fim;
  dizer(igual, igual ? `${nome}: ${p.inicio} a ${p.fim}` : `${nome}: esperava ${inicio} a ${fim}, achou ${p.inicio} a ${p.fim}`);
}

console.log(
  falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} problema(s).\n`,
);
process.exit(falhas === 0 ? 0 : 1);
