import type {
  FeedbackPeriodicidade,
  FeedbackStatus,
} from "@/lib/supabase/database.types";

/**
 * O FEEDBACK DE DESENVOLVIMENTO (Sprint 3H, migration 0075).
 *
 * Módulo de domínio, sem diretiva nenhuma: os dois lados precisam dele. O
 * servidor monta o prompt e confere a saída; a tela desenha os números crus ao
 * lado do texto e escreve os rótulos.
 *
 * ---------------------------------------------------------------------------
 * ISTO NÃO É AVALIAÇÃO DE DESEMPENHO.
 *
 * Não é nota, não é ranking, não é insumo para decisão sobre promoção, aumento
 * ou desligamento. Se um dia for usado para isso, a regra muda inteira e passa
 * pelo jurídico antes — a LGPD dá à pessoa o direito de pedir revisão de
 * decisão automatizada que a afete (Art. 20), e este módulo foi desenhado
 * justamente para não produzir uma. A frase está no cabeçalho da 0075 também,
 * de propósito: exposição jurídica se registra nos dois lugares, porque um
 * refactor de tela não alcança o banco e uma migration não é lida por quem
 * mexe na tela.
 * ---------------------------------------------------------------------------
 *
 * **A verificação pós-geração vive aqui, e não no prompt.** O prompt pede; a
 * verificação confere. As duas existem de propósito, como a máquina de estados
 * da subtarefa e os triggers da 0007: a primeira escreve a instrução que o
 * modelo lê, a segunda é a que vale. Um prompt não é uma trava — ele é um
 * pedido muito bem escrito.
 */

// ---------------------------------------------------------------------------
// A forma do que o banco devolve
//
// `feedback_metricas()` e `feedback_contexto()` devolvem `jsonb`, então do lado
// de cá eles chegam como `unknown`. Estes tipos são a leitura que a tela e o
// prompt fazem dele — e a conversão passa por `lerMetricas()`, que tolera
// campo ausente em vez de estourar: um relatório gerado por uma versão
// anterior da função continua abrindo.
// ---------------------------------------------------------------------------

export type EntregaDoPeriodo = {
  concluidas: number;
  com_prazo: number;
  no_prazo: number;
  fora_do_prazo: number;
  sem_prazo: number;
  taxa_no_prazo: number | null;
  dias_de_atraso_media: number | null;
  minutos_reais: number;
};

export type PeriodoAnterior = {
  inicio: string;
  fim: string;
  concluidas: number;
  com_prazo: number;
  no_prazo: number;
  taxa_no_prazo: number | null;
  minutos_reais: number;
};

export type Calibracao = {
  etapas_medidas: number;
  minutos_estimados: number;
  minutos_reais: number;
  desvio_percentual: number | null;
  tendencia: "subestima" | "superestima" | "equilibrada" | null;
};

export type Qualidade = {
  conteudos_decididos: number;
  aprovados_de_prima: number;
  taxa_de_prima: number | null;
  rodadas_media: number | null;
};

export type PorNome = { nome: string; concluidas: number };
export type PalavraDoAjuste = { palavra: string; vezes: number };

export type MetricasDoFeedback = {
  periodo: { inicio: string; fim: string; dias: number };
  entrega: EntregaDoPeriodo;
  em_aberto_atrasadas: number;
  por_workflow: PorNome[];
  por_cliente: PorNome[];
  periodo_anterior: PeriodoAnterior;
  calibracao: Calibracao;
  calibracao_por_workflow: {
    nome: string;
    etapas: number;
    desvio_percentual: number | null;
  }[];
  qualidade: Qualidade;
  palavras_nos_pedidos_de_ajuste: PalavraDoAjuste[];
  desenvolvimento: {
    trilhas: { titulo: string; materiais_concluidos: number }[];
    etiquetas_estudadas: string[];
    workflows_novos: string[];
  };
};

export type ContextoDoFeedback = {
  ausencia: {
    dias_fora: number;
    dias_uteis_no_periodo: number;
    proporcao_fora: number | null;
    por_tipo: { tipo: string; dias: number }[];
  };
  carga: {
    minutos_comprometidos: number;
    capacidade_minutos_dia: number;
    dias_uteis: number;
    etapas_datadas: number;
    etapas_sem_estimativa: number;
    /** NULA quando não há estimativa suficiente para a conta valer. */
    proporcao_da_capacidade: number | null;
  };
  espera_por_aprovacao: {
    horas_interna: number;
    horas_cliente: number;
    rodadas_ainda_pendentes: number;
  };
  clientes_com_retrabalho: {
    nome: string;
    rodadas_media: number;
    media_das_contas: number;
  }[];
  /** Frases prontas, em português, para o prompt usar ao RELATIVIZAR. */
  ressalvas: string[];
};

/**
 * A versão do prompt, gravada em cada relatório.
 *
 * Ela existe porque "o texto saiu estranho" chega três meses depois, e a essa
 * altura o prompt já foi reescrito duas vezes. **Suba o número sempre que
 * mexer no texto do sistema** — um prompt novo com a versão antiga é pior que
 * versão nenhuma, porque afirma com confiança que o relatório saiu de um texto
 * que não é o que o gerou.
 */
export const PROMPT_VERSAO = "3h.1";

/**
 * O modelo, escrito por extenso e num lugar só.
 *
 * Fica em domínio e não numa variável de ambiente porque não é credencial nem
 * escolha de operação: é uma decisão de produto, e uma variável de ambiente
 * faria a próxima hospedagem nascer chamando outro modelo sem nada na tela
 * dizendo. É a decisão de `hojeNaAgencia()` não ser variável de ambiente.
 */
export const MODELO_PADRAO = "claude-opus-5-5";

export const ROTULOS_DE_STATUS: Record<FeedbackStatus, string> = {
  gerando: "Gerando",
  rascunho: "Rascunho",
  revisado: "Revisado",
  enviado: "Enviado",
  descartado: "Descartado",
  dados_insuficientes: "Sem dados suficientes",
};

export const ROTULOS_DE_PERIODICIDADE: Record<FeedbackPeriodicidade, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
};

export const ROTULOS_DE_ALERTA_DE_CARGA: Record<string, string> = {
  sobrecarga: "Sobrecarga",
  ociosidade: "Carga baixa",
  gargalo_aprovacao: "Gargalo no aval interno",
  retrabalho_por_cliente: "Retrabalho por cliente",
};

/**
 * O QUE CADA ALERTA QUER DIZER, em uma frase.
 *
 * O nome do tipo não basta: "Carga baixa" ao lado do nome de alguém lê como
 * cobrança, e o alerta existe justamente para dizer o contrário — que o
 * problema está na distribuição de trabalho. A frase é o que separa um sinal
 * de uma acusação.
 */
export const EXPLICACAO_DO_ALERTA: Record<string, string> = {
  sobrecarga:
    "Recebeu mais trabalho do que a capacidade em dois períodos seguidos. Volume não entregue aqui não é falha de quem recebeu.",
  ociosidade:
    "Recebeu menos da metade da capacidade. Entrega baixa aqui é distribuição de trabalho.",
  gargalo_aprovacao:
    "As entregas ficaram muito tempo esperando o aval interno da agência. Esse tempo não é atraso de quem produziu.",
  retrabalho_por_cliente:
    "Esta conta pede bem mais rodadas que a média. Quem a atende não está entregando pior.",
};

// ---------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------

/**
 * O período fechado ANTERIOR ao dia de referência, mensal ou trimestral.
 *
 * **É o anterior e nunca o corrente**, e a escolha é a mesma do limite por
 * task da recorrência: um feedback do mês em curso mede metade do mês e mostra
 * um número que parece medição e é ruído. No dia 2, "este mês" são duas etapas.
 *
 * `hoje` entra como parâmetro e não sai de `new Date()` aqui: quem responde por
 * "hoje" neste produto é `hojeNaAgencia()`, e o motivo está lá — num servidor
 * em UTC, das 21h à meia-noite o dia já virou e o período sairia errado.
 */
export function periodoFechadoAnterior(
  hoje: string,
  periodicidade: FeedbackPeriodicidade,
): { inicio: string; fim: string } {
  const [ano, mes] = hoje.split("-").map(Number);

  if (periodicidade === "mensal") {
    const anoAnterior = mes === 1 ? ano - 1 : ano;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    return {
      inicio: `${anoAnterior}-${dois(mesAnterior)}-01`,
      fim: ultimoDia(anoAnterior, mesAnterior),
    };
  }

  // O trimestre civil em que o dia de hoje NÃO está: 1-3, 4-6, 7-9, 10-12.
  const trimestreAtual = Math.floor((mes - 1) / 3);
  const anoDoAnterior = trimestreAtual === 0 ? ano - 1 : ano;
  const trimestreAnterior = trimestreAtual === 0 ? 3 : trimestreAtual - 1;
  const primeiroMes = trimestreAnterior * 3 + 1;
  const ultimoMes = primeiroMes + 2;
  return {
    inicio: `${anoDoAnterior}-${dois(primeiroMes)}-01`,
    fim: ultimoDia(anoDoAnterior, ultimoMes),
  };
}

function dois(n: number) {
  return String(n).padStart(2, "0");
}

function ultimoDia(ano: number, mes: number) {
  // Dia 0 do mês seguinte é o último do mês pedido, e `Date.UTC` evita o fuso
  // do processo mexer na virada.
  const d = new Date(Date.UTC(ano, mes, 0));
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
}

// ---------------------------------------------------------------------------
// A VERIFICAÇÃO PÓS-GERAÇÃO
//
// O prompt não basta, e o sprint diz isso em uma linha. Aqui estão as quatro
// famílias que dá para conferir por máquina — e a quinta, "no máximo dois
// pontos de melhoria", NÃO está, de propósito: não existe jeito honesto de
// contá-los num texto corrido sem cabeçalho de seção, e uma checagem que
// acerta às vezes treina quem revisa a ignorar os alertas todos. Essa fica
// para quem lê, que é o papel da revisão humana.
//
// NADA AQUI DESCARTA. Todo achado vira uma frase em `alertas_json`, o
// relatório fica marcado para revisão obrigatória, e quem revisa decide. Um
// descarte silencioso gastaria uma chamada de IA e não deixaria nada para
// investigar.
// ---------------------------------------------------------------------------

/**
 * Comparação com terceiros. A única comparação permitida é com o período
 * anterior da própria pessoa.
 *
 * As formas com "equipe", "colega" e "média" são as diretas; "acima da média"
 * e "em relação aos outros" são as que o modelo escreve quando está tentando
 * elogiar. As duas famílias custam o mesmo alerta.
 */
const COMPARACAO_COM_TERCEIROS = [
  "da equipe",
  "do time",
  "que a equipe",
  "que o time",
  "colega",
  "colegas",
  "média da equipe",
  "media da equipe",
  "acima da média",
  "acima da media",
  "abaixo da média",
  "abaixo da media",
  "melhor que",
  "melhor do que",
  "pior que",
  "pior do que",
  "mais que os outros",
  "em relação aos outros",
  "em relacao aos outros",
  "comparado aos",
  "comparada aos",
  "entre os que",
  "ranking",
  "primeiro lugar",
  "destaque do mês",
  "destaque do mes",
];

/**
 * Julgamento de caráter. Os dados mostram o que aconteceu; eles não dizem nada
 * sobre motivação, atitude ou dedicação — e um texto que afirma isso a partir
 * de contagem de etapas afirma o que não mediu.
 */
const JULGAMENTO_DE_CARATER = [
  "dedicada",
  "dedicado",
  "dedicação",
  "dedicacao",
  "comprometida",
  "comprometido",
  "comprometimento",
  "desmotivada",
  "desmotivado",
  "desmotivação",
  "desmotivacao",
  "preguiçosa",
  "preguicosa",
  "preguiçoso",
  "preguicoso",
  "proativa",
  "proativo",
  "proatividade",
  "esforçada",
  "esforcada",
  "esforçado",
  "esforcado",
  "engajada",
  "engajado",
  "engajamento",
  "atitude",
  "postura",
  "força de vontade",
  "forca de vontade",
  "descuido",
  "desleixo",
  "relapsa",
  "relapso",
];

/**
 * Superlativo, elogio genérico e frase motivacional. Eles não informam nada e
 * gastam a credibilidade do resto do texto — e "continue assim" num feedback
 * que aponta dois pontos de melhoria é a tela desmentindo a si mesma.
 */
const ELOGIO_VAZIO = [
  "excelente trabalho",
  "ótimo trabalho",
  "otimo trabalho",
  "continue assim",
  "você é essencial",
  "voce e essencial",
  "você é fundamental",
  "voce e fundamental",
  "parabéns",
  "parabens",
  "impecável",
  "impecavel",
  "sensacional",
  "incrível",
  "incrivel",
  "sem palavras",
  "orgulho da equipe",
];

/**
 * Nota, conceito, estrela e classificação. Nenhum deles existe no módulo, e o
 * texto não pode inventar um: "desempenho 7 de 10" é exatamente a coisa que o
 * sprint proíbe em todas as telas.
 */
const NOTA_OU_CONCEITO = [
  "nota ",
  "sua nota",
  "conceito ",
  "estrela",
  "classificação",
  "classificacao",
  "avaliação de desempenho",
  "avaliacao de desempenho",
  "de 10",
  "★",
];

export type AlertaDoTexto = {
  /** `comparacao` | `carater` | `elogio` | `nota` | `numero` | `tamanho` */
  tipo: string;
  /** A frase que quem revisa lê, em português, nomeando o que foi achado. */
  frase: string;
};

/**
 * Confere o texto que a IA escreveu contra as regras do módulo e contra os
 * números que ela recebeu.
 *
 * Devolve a lista de achados. Lista vazia é o caminho normal; qualquer coisa
 * dentro dela marca o relatório para revisão obrigatória e aparece em destaque
 * na tela de quem revisa.
 */
export function verificarOTexto(
  texto: string,
  metricas: unknown,
  contexto: unknown,
): AlertaDoTexto[] {
  const achados: AlertaDoTexto[] = [];
  const baixo = semAcentoEBaixo(texto);

  const familias: [string, string[], (t: string) => string][] = [
    [
      "comparacao",
      COMPARACAO_COM_TERCEIROS,
      (t) =>
        `O texto compara esta pessoa com outras ("${t}"). A única comparação permitida é com o período anterior dela.`,
    ],
    [
      "carater",
      JULGAMENTO_DE_CARATER,
      (t) =>
        `O texto julga atitude ou motivação ("${t}"). Os dados mostram o que aconteceu, não por quê.`,
    ],
    [
      "elogio",
      ELOGIO_VAZIO,
      (t) => `O texto traz elogio genérico ou frase motivacional ("${t}").`,
    ],
    [
      "nota",
      NOTA_OU_CONCEITO,
      (t) =>
        `O texto parece dar nota, conceito ou classificação ("${t}"). Isto não existe no módulo.`,
    ],
  ];

  for (const [tipo, termos, frase] of familias) {
    for (const termo of termos) {
      if (baixo.includes(semAcentoEBaixo(termo))) {
        achados.push({ tipo, frase: frase(termo.trim()) });
      }
    }
  }

  // TODO NÚMERO CITADO PRECISA EXISTIR NOS DADOS. É a checagem que separa um
  // texto escrito a partir das métricas de um texto que soa como se fosse.
  const permitidos = numerosPermitidos(metricas, contexto);
  for (const n of numerosDoTexto(texto)) {
    if (!permitidos.has(chaveDoNumero(n))) {
      achados.push({
        tipo: "numero",
        frase: `O texto cita o número ${n}, que não está nas métricas. Confira se ele foi inventado ou calculado pela IA.`,
      });
    }
  }

  // O tamanho é regra do prompt, e vale conferir porque as duas pontas doem:
  // um texto de 60 palavras não olhou os dados, e um de 500 não vai ser lido.
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  if (palavras > 0 && (palavras < 120 || palavras > 320)) {
    achados.push({
      tipo: "tamanho",
      frase: `O texto tem ${palavras} palavras, fora da faixa de 150 a 250 que o prompt pede.`,
    });
  }

  return achados;
}

/**
 * Os números que aparecem no texto.
 *
 * Aceita `1.234`, `12,5`, `12.5` e `2400`, e descarta o que está colado em
 * letra — `h1` e `A4` não são números citados. A vírgula decimal do português e
 * o ponto de milhar convivem, então a normalização olha o tamanho do grupo
 * depois do separador: três dígitos é milhar, um ou dois é decimal.
 *
 * **A PARTE INTEIRA É `\d+` E NÃO `\d{1,3}`**, e a primeira versão usava o
 * segundo — o que parece certo, porque o milhar vem com ponto. O `check:feedback`
 * mostrou o furo: com o teto de três dígitos, `2400` não casava com nada, e a
 * checagem mais valiosa da lista — "todo número citado existe nos dados" —
 * ficava cega justamente para os números de minuto, que são os maiores que o
 * texto cita. Um "4800 minutos" inventado passava limpo.
 */
export function numerosDoTexto(texto: string): number[] {
  const achados: number[] = [];
  // Sem o `(?<![\w])`, "A4" e "h2" viram números; sem o `(?![\w])`, "3x" vira.
  const re = /(?<![\w.,])\d+(?:[.,]\d+)*(?![\w])/g;
  for (const m of texto.matchAll(re)) {
    const n = normalizarNumero(m[0]);
    if (n !== null) achados.push(n);
  }
  return achados;
}

function normalizarNumero(bruto: string): number | null {
  // `1.234` e `1,234` são mil duzentos e trinta e quatro; `12,5` é doze e meio.
  const partes = bruto.split(/[.,]/);
  let texto: string;
  if (partes.length === 1) {
    texto = partes[0];
  } else {
    const ultima = partes[partes.length - 1];
    texto =
      ultima.length === 3
        ? partes.join("")
        : `${partes.slice(0, -1).join("")}.${ultima}`;
  }
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tudo o que o texto pode citar.
 *
 * Os números do JSON, mais quatro derivações que o prompt autoriza e que
 * seriam falso positivo sem elas: a conversão de minutos para horas (o texto
 * fala em horas, os dados vêm em minutos), o arredondamento de uma porcentagem
 * para inteiro, e o ano, o mês e o dia das datas do período — que o texto cita
 * ao dizer de que período está falando.
 *
 * **A lista é generosa de propósito.** Um falso positivo aqui custa um alerta
 * que quem revisa vai ler e descartar, e alerta descartado repetidamente
 * ensina a ignorar os alertas todos — a mesma razão pela qual o produto não
 * pinta três selos de vermelho.
 */
function numerosPermitidos(metricas: unknown, contexto: unknown): Set<string> {
  const permitidos = new Set<string>();

  const guardar = (n: number) => {
    permitidos.add(chaveDoNumero(n));
    permitidos.add(chaveDoNumero(Math.round(n)));
    permitidos.add(chaveDoNumero(Math.round(n * 10) / 10));
  };

  const andar = (v: unknown): void => {
    if (typeof v === "number") {
      guardar(v);
      // Minutos viram horas: o texto fala "2h 30min" ou "2,5 horas", e os
      // dados vêm em minutos desde o Sprint 3B.
      if (Number.isInteger(v) && v >= 60) {
        guardar(v / 60);
        guardar(Math.floor(v / 60));
        guardar(v % 60);
      }
      return;
    }
    if (typeof v === "string") {
      // As datas do período: `2027-04-01` autoriza 2027, 4, 1, 04 e 01.
      for (const m of v.matchAll(/\d+/g)) guardar(Number(m[0]));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) andar(item);
      return;
    }
    if (v && typeof v === "object") {
      for (const item of Object.values(v)) andar(item);
    }
  };

  andar(metricas);
  andar(contexto);
  return permitidos;
}

function chaveDoNumero(n: number) {
  // Uma casa decimal é a precisão que as métricas usam, e comparar por string
  // evita a surpresa de `0.1 + 0.2` no meio de um `Set` de números.
  return (Math.round(n * 10) / 10).toFixed(1);
}

/**
 * Dobra caixa e acento sem depender de locale.
 *
 * `toLowerCase()` do JavaScript dobra acento pelo Unicode em qualquer sistema,
 * e é por isso que a busca de nome morto do `check:cores` parou de usar
 * `grep -i`: com `LC_CTYPE=POSIX` ele dobra só ASCII, e a varredura dizia "ok"
 * numa máquina e falhava no CI para o mesmo commit.
 */
function semAcentoEBaixo(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Leitura tolerante do `jsonb` que o banco devolve.
 *
 * Campo ausente vira zero ou nulo em vez de estourar, e a razão é concreta: um
 * relatório gravado por uma versão anterior de `feedback_metricas()` continua
 * abrindo. O contrário faria a tela de um feedback de três meses atrás
 * responder erro de servidor — e o histórico é navegável de propósito.
 */
export function lerMetricas(bruto: unknown): MetricasDoFeedback | null {
  if (!bruto || typeof bruto !== "object") return null;
  return bruto as MetricasDoFeedback;
}

export function lerContexto(bruto: unknown): ContextoDoFeedback | null {
  if (!bruto || typeof bruto !== "object") return null;
  return bruto as ContextoDoFeedback;
}

export function lerAlertas(bruto: unknown): AlertaDoTexto[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (a): a is AlertaDoTexto =>
      !!a && typeof a === "object" && typeof (a as AlertaDoTexto).frase === "string",
  );
}

/**
 * A variação entre dois números, para a tela escrever "+4" ou "−2".
 *
 * Devolve `null` quando não há o que comparar — e a tela mostra "sem
 * comparação" em vez de zero, pela regra que o produto já segue com
 * `receita_por_hora`: zero é uma afirmação sobre a conta, e o que se quer
 * dizer é que não havia período anterior.
 */
export function variacao(agora: number | null, antes: number | null) {
  if (agora === null || antes === null) return null;
  return Math.round((agora - antes) * 10) / 10;
}
