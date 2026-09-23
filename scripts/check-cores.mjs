/**
 * A prova da identidade visual.
 *
 * Duas perguntas, e as duas com resposta objetiva:
 *
 *   1. Existe cor literal fora do arquivo de tokens?
 *      O critério de aceite do sprint é textual: procurar por #7FCFF5, #545960
 *      ou qualquer hex fora de globals.css tem que voltar vazio.
 *
 *   2. Todo par texto/fundo é legível?
 *      Mínimo 4.5:1 para texto normal, 3:1 para texto grande e para elemento
 *      de interface (borda, ícone sozinho). A paleta tem um azul muito claro,
 *      e azul claro convida ao erro de pôr texto branco em cima — 1.7:1. Este
 *      script é o que impede isso de entrar sem ninguém ver.
 *
 * Roda com: npm run check:cores
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const CSS = "src/app/globals.css";

/* As exceções, cada uma com motivo. Nenhuma delas é cor de interface. */
const EXCECOES = [
  {
    arquivo: "src/components/shared/editor-rico.tsx",
    motivo:
      "paleta de texto do editor rico: a cor escolhida é gravada DENTRO do documento " +
      "do TipTap. Uma var() ali viajaria junto com o conteúdo e apareceria crua em " +
      "qualquer lugar que renderize o documento fora deste app.",
  },
  {
    arquivo: "src/app/layout.tsx",
    motivo:
      "theme-color do navegador: vai numa meta tag, que só aceita cor literal — " +
      "var() não resolve lá.",
  },
];

// --- leitura dos tokens ----------------------------------------------------

function blocos(css) {
  const pegar = (seletor) => {
    const i = css.indexOf(`${seletor} {`);
    if (i < 0) throw new Error(`Bloco ${seletor} não encontrado em ${CSS}`);
    const abre = css.indexOf("{", i);
    const fecha = css.indexOf("\n}", abre);
    return css.slice(abre + 1, fecha);
  };
  return { claro: pegar(":root"), escuro: pegar(".dark") };
}

function declaracoes(texto) {
  const mapa = new Map();
  for (const linha of texto.split("\n")) {
    const limpa = linha.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const m = limpa.match(/^(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) mapa.set(m[1], m[2].trim());
  }
  return mapa;
}

/** Resolve var(--x) até chegar num hex. Herda do claro no tema escuro. */
function resolver(nome, tema, base, vistos = new Set()) {
  if (vistos.has(nome)) throw new Error(`Ciclo em ${nome}`);
  vistos.add(nome);

  const valor = tema.get(nome) ?? base.get(nome);
  if (!valor) throw new Error(`Token ${nome} não existe`);

  const v = valor.trim();
  if (v.startsWith("#")) return v;

  const m = v.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (m) return resolver(m[1], tema, base, vistos);

  throw new Error(`Token ${nome} não é hex nem var(): ${v}`);
}

// --- contraste -------------------------------------------------------------

function canais(hex) {
  const h = hex.replace("#", "");
  const largo = h.length <= 4;
  const ler = (i) =>
    largo ? parseInt(h[i] + h[i], 16) : parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return [ler(0), ler(1), ler(2)];
}

function luminancia(hex) {
  const [r, g, b] = canais(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- os pares que a interface realmente usa --------------------------------

const NORMAL = 4.5;
const GRANDE = 3;

const PARES = [
  // Texto sobre as superfícies.
  ["--text-primary", "--surface-page", NORMAL, "texto principal na página"],
  ["--text-primary", "--surface-card", NORMAL, "texto principal no cartão"],
  ["--text-secondary", "--surface-page", NORMAL, "texto de apoio na página"],
  ["--text-secondary", "--surface-card", NORMAL, "texto de apoio no cartão"],
  ["--text-muted", "--surface-card", GRANDE, "texto discreto (rótulo, legenda)"],
  ["--text-muted", "--surface-page", GRANDE, "texto discreto na página"],

  // A regra da casa: azul claro pede texto escuro.
  ["--primary-foreground", "--primary", NORMAL, "BOTÃO PRIMÁRIO — a regra da casa"],
  ["--brand-foreground", "--brand", NORMAL, "texto sobre a cor da marca"],

  // O azul legível.
  ["--accent-strong", "--surface-card", NORMAL, "link no cartão"],
  ["--accent-strong", "--surface-page", NORMAL, "link na página"],
  ["--accent-foreground", "--accent", NORMAL, "ícone no quadrado azul claro"],
  ["--info-foreground", "--info", NORMAL, "texto sobre o azul de informação"],

  // A barra lateral escura.
  ["--text-on-dark", "--surface-sidebar", NORMAL, "nome do item no menu"],
  ["--text-on-dark", "--surface-sidebar-2", NORMAL, "item do menu em destaque"],
  ["--brand-blue", "--surface-sidebar", NORMAL, "ITEM ATIVO do menu"],
  ["--brand-blue", "--surface-sidebar-2", NORMAL, "item ativo com fundo próprio"],
  ["--text-muted", "--surface-sidebar", GRANDE, "cargo no rodapé do menu"],
  // O item de menu de módulo OPCIONAL. Ele é mais apagado de propósito, e
  // por isso precisa ser MEDIDO: o primeiro valor tentado foi
  // `text-on-dark/45`, que dava 4,05:1 — abaixo do mínimo para texto. Este
  // par é o motivo de o token existir em vez da opacidade.
  ["--text-on-dark-muted", "--surface-sidebar", NORMAL, "item discreto do menu"],
  ["--text-on-dark-muted", "--surface-sidebar-2", NORMAL, "item discreto sobre hover"],

  // Estados: cor cheia com texto por cima, e fundo suave com a cor como texto.
  ["--success-foreground", "--success", NORMAL, "texto sobre verde"],
  ["--warning-foreground", "--warning", NORMAL, "texto sobre âmbar"],
  ["--destructive-foreground", "--destructive", NORMAL, "texto sobre vermelho"],
  ["--success", "--success-soft", NORMAL, "selo de sucesso"],
  ["--warning", "--warning-soft", NORMAL, "selo de atenção"],
  ["--danger", "--danger-soft", NORMAL, "selo de erro"],
  ["--neutral", "--neutral-soft", NORMAL, "selo neutro (prioridade Normal)"],
  ["--ferias", "--ferias-soft", NORMAL, "selo de férias"],
  // Na matriz o quadrado de férias é só cor, sem texto: vale a régua de
  // elemento de interface.
  ["--ferias", "--surface-card", GRANDE, "quadrado de férias na matriz"],

  // Elemento de interface: 3:1.
  //
  // --border NÃO entra aqui. Ela separa blocos e desenha o contorno do
  // cartão: some sem prejuízo, e o padrão cobra os 3:1 do que identifica um
  // controle, não de divisória. Exigir 3:1 dela daria um traço pesado em
  // volta de cada cartão — o oposto da tela que o sprint descreve.
  //
  // --input entra: é a borda do CAMPO, o que diz onde se clica para digitar.
  ["--input", "--surface-card", GRANDE, "borda do campo de formulário"],
  ["--input", "--surface-page", GRANDE, "borda do campo sobre a página"],
  ["--ring", "--surface-card", GRANDE, "anel de foco"],

  // As cores de gráfico. Régua de ELEMENTO DE INTERFACE (3:1): uma linha ou
  // uma barra não é texto, e o que o padrão cobra dela é ser distinguível do
  // fundo.
  //
  // O contraste contra o fundo é só metade do problema, e a outra metade
  // nenhuma conta de luminância pega: o par precisa ser distinguível para
  // quem tem daltonismo. Isso foi medido à parte, com o validador de paleta
  // do skill de visualização — receita/despesa em verde e vermelho dava
  // ΔE 4,2 em deuteranopia, ou seja, duas linhas idênticas. O par azul/roxo
  // dá 9,4, e o eixo azul/laranja do saldo dá 20,5.
  ["--serie-1", "--surface-card", GRANDE, "linha e barra da série 1"],
  ["--serie-2", "--surface-card", GRANDE, "linha e barra da série 2"],
  ["--serie-neg", "--surface-card", GRANDE, "coluna de saldo negativo"],
];

// --- nomes que saíram do produto -------------------------------------------
//
// Um critério de aceite do Sprint 8 diz que "Mês a Mês" não existe mais em
// lugar nenhum. Um critério assim não se verifica uma vez: ele se verifica
// toda vez, senão o nome volta num texto de ajuda três sprints depois e
// ninguém percebe.
//
// Eles moram aqui, e não num script próprio, porque este já é o verificador
// que varre o projeto inteiro atrás de coisa que não devia estar lá.

const NOMES_MORTOS = [
  // O nome antigo do Financeiro Pessoal, varrido do projeto INTEIRO: ele não
  // pode sobreviver nem numa migration nem num comentário.
  { nome: "Mês a Mês", onde: "src/ scripts/ supabase/ *.md", porque: "o Financeiro Pessoal se chamou assim até o Sprint 8" },
  { nome: "Mes a Mes", onde: "src/ scripts/ supabase/ *.md", porque: "a mesma coisa, sem acento" },
  { nome: "mes-a-mes", onde: "src/ scripts/ supabase/ *.md", porque: "a rota antiga" },

  // A regra-mestra do produto: o Full Hub é o sistema único da agência, e
  // nunca cita ferramenta externa NA INTERFACE.
  //
  // Só `src/` de propósito. O CLAUDE.md precisa nomear as ferramentas para
  // poder proibi-las — varrer a documentação junto faria a verificação
  // acusar a própria regra, que foi exatamente o que ela fez na primeira
  // versão.
  // "Tipo de tarefa" e "workflow" eram dois nomes para a MESMA coisa, e o
  // produto falava os dois: o menu e a rota diziam Workflows, o formulário de
  // abertura e a tela de gestão diziam tipo de tarefa. Quem usava tinha que
  // descobrir sozinho que era a mesma coisa. Ficou Workflow.
  //
  // Só `src/`, pela razão de sempre: o CLAUDE.md precisa nomear o nome antigo
  // para registrar por que ele saiu.
  // VOCABULÁRIO TRABALHISTA. A equipe é toda PJ, e palavra de direito
  // trabalhista num sistema da própria empresa não é impropriedade de
  // linguagem: é prova documental num pedido de reconhecimento de vínculo.
  //
  // SÓ AS FORMAS ACENTUADAS, e a escolha é o que faz esta varredura valer
  // alguma coisa. `ferias`, `licenca` e `folga` sem acento continuam no
  // projeto de propósito: são valor de enum (`hr_tipo`, `presenca_status`) e
  // nome de token de cor, que ninguém que usa o sistema vê e que o usuário
  // decidiu manter. Varrer os dois juntos acusaria essas linhas toda vez, e um
  // alarme que sempre toca é um alarme que ninguém escuta.
  //
  // O que a pessoa LÊ passa por `ROTULOS_DE_TIPO` e `ROTULOS_DE_PRESENCA`, e
  // lá está escrito recesso, indisponibilidade e "sem alocação".
  //
  // E SEM EXCEÇÃO DE ARQUIVO. A primeira versão isentava o módulo de
  // vocabulário, que precisava nomear as palavras para proibi-las — a mesma
  // situação do Trello logo abaixo. Só que o `--exclude` do grep não filtrou
  // nada aqui, e a varredura acusava a si mesma. A saída foi melhor que a
  // exceção: a regra saiu de `src/` e foi para o CLAUDE.md e para o cabeçalho
  // da migration 0016, que é onde ela já devia estar. `src/` ficou limpo de
  // verdade, e a varredura não precisa acreditar em ninguém.
  //
  // "feriado" NÃO entra: é data do calendário nacional, um fato sobre o dia, e
  // não direito concedido a ninguém.
  { nome: "férias", onde: "src/", porque: "vocabulário da CLT — a equipe é PJ; use recesso" },
  { nome: "licença", onde: "src/", porque: "vocabulário da CLT; use indisponibilidade" },

  { nome: "tipo de tarefa", onde: "src/", porque: "virou Workflow — um nome só para a mesma coisa" },
  { nome: "tipos de tarefa", onde: "src/", porque: "virou Workflows" },

  { nome: "Trello", onde: "src/", porque: "ferramenta externa citada na interface" },
  { nome: "ClickUp", onde: "src/", porque: "ferramenta externa citada na interface" },
  { nome: "Asana", onde: "src/", porque: "ferramenta externa citada na interface" },
];

// --- execução --------------------------------------------------------------

const css = readFileSync(CSS, "utf8");
const { claro, escuro } = blocos(css);
const base = declaracoes(claro);
const dark = declaracoes(escuro);

let falhas = 0;
let avisos = 0;

console.log("\nNomes que saíram do produto\n");

for (const { nome, onde, porque } of NOMES_MORTOS) {
  let achados = "";
  try {
    achados = execSync(
      `grep -rniF ${JSON.stringify(nome)} ${onde} --include=*.ts --include=*.tsx --include=*.mjs --include=*.sql --include=*.md 2>/dev/null || true`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    achados = "";
  }
  // O próprio check-cores.mjs cita os nomes na lista acima: ignorar este
  // arquivo é o que impede a verificação de acusar a si mesma.
  const linhas = achados
    .split("\n")
    .filter((l) => l && !l.startsWith("scripts/check-cores.mjs"));

  if (linhas.length === 0) {
    console.log(`  ok      “${nome}” não aparece em lugar nenhum`);
  } else {
    falhas++;
    console.log(`  FALHA   “${nome}” ainda aparece — ${porque}`);
    for (const linha of linhas.slice(0, 5)) console.log(`          ${linha}`);
  }
}

console.log("\nContraste — tema CLARO e tema ESCURO\n");

for (const [frente, fundo, minimo, descricao] of PARES) {
  const linha = [];
  let ruim = false;

  for (const [nome, tema] of [
    ["claro", new Map()],
    ["escuro", dark],
  ]) {
    const f = resolver(frente, tema, base);
    const b = resolver(fundo, tema, base);
    const razao = contraste(f, b);
    if (razao < minimo) ruim = true;
    linha.push(`${nome} ${razao.toFixed(2)}:1`);
  }

  if (ruim) {
    falhas++;
    console.log(`  FALHOU  ${descricao}`);
    console.log(`          ${frente} sobre ${fundo} — ${linha.join("   ")} (mínimo ${minimo})`);
  } else {
    console.log(`  ok      ${descricao.padEnd(38)} ${linha.join("   ")}`);
  }
}

// --- opacidade em cor de ESTADO ---------------------------------------------
//
// A regra do produto: selo de estado usa o PAR NOMEADO (`bg-warning-soft
// text-warning`), nunca `bg-warning/10`. Opacidade sobre um fundo qualquer dá
// uma cor que ninguém mediu -- e no tema escuro dá outra, porque o fundo é
// outro.
//
// A regra estava escrita no CLAUDE.md e em dois comentários de código, e
// nunca tinha sido VERIFICADA. No Sprint 9 eu mesmo escrevi `bg-info/10` num
// selo de categoria e passei por esta varredura sem um aviso: ela só conferia
// se a classe existia, e `bg-info/10` existe.
//
// Só os tokens de estado que TÊM par suave entram. `bg-muted/40` e
// `bg-primary/90` são do shadcn e não são selo de estado -- varrê-los daria
// um alarme que toca sempre, e alarme que toca sempre ninguém escuta.

console.log("\nOpacidade onde o par nomeado é a regra\n");

const COM_PAR_SUAVE = ["warning", "success", "danger", "neutral", "ferias", "info", "brand"];

{
  let achados = "";
  try {
    const alvo = COM_PAR_SUAVE.map((t) => `(bg|text|border)-${t}/[0-9]`).join("|");
    achados = execSync(
      `grep -rnE ${JSON.stringify(alvo)} src/ --include=*.ts --include=*.tsx | grep -v "^[^:]*:[0-9]*: *\\*" | grep -v "nunca" || true`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    achados = "";
  }

  if (achados) {
    falhas++;
    console.log("  FALHA   opacidade num token de estado — use o par nomeado");
    for (const linha of achados.split("\n").slice(0, 10)) {
      console.log(`          ${linha.trim()}`);
    }
  } else {
    console.log("  ok      nenhum token de estado usado com opacidade");
  }
}

// --- hex fora do arquivo de tokens -----------------------------------------

console.log("\nCor literal fora de globals.css\n");

const permitidos = new Set(EXCECOES.map((e) => e.arquivo));
let saida = "";
try {
  saida = execSync(
    `grep -rnoiE '#[0-9a-f]{3,8}\\b' src/ --include=*.tsx --include=*.ts --include=*.css || true`,
    { encoding: "utf8" },
  );
} catch {
  saida = "";
}

const achados = saida
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [arquivo, linha, ...resto] = l.split(":");
    return { arquivo, linha, cor: resto.join(":") };
  })
  .filter((a) => a.arquivo !== CSS);

const proibidos = achados.filter((a) => !permitidos.has(a.arquivo));

for (const a of proibidos) {
  falhas++;
  console.log(`  FALHOU  ${a.arquivo}:${a.linha} — ${a.cor}`);
  console.log(`          Cor de interface mora em ${CSS}, e só lá.`);
}

if (proibidos.length === 0) {
  console.log("  ok      nenhuma — toda cor de interface vem dos tokens");
}

for (const e of EXCECOES) {
  const quantos = achados.filter((a) => a.arquivo === e.arquivo).length;
  if (quantos === 0) {
    avisos++;
    console.log(`  aviso   ${e.arquivo} não tem mais cor literal — a exceção pode sair daqui.`);
  } else {
    console.log(`  exceção ${e.arquivo} (${quantos})`);
    console.log(`          ${e.motivo}`);
  }
}

// --- classe de cor que nao existe ------------------------------------------
//
// No Tailwind v4, utilitario desconhecido nao da erro: ele simplesmente nao
// gera CSS. `text-acent-strong` com um "c" a menos some da folha de estilo e a
// tela fica com a cor herdada, sem ninguem notar. Aqui cada classe de cor
// usada no projeto e conferida contra os nomes declarados no @theme inline.

console.log("\nClasse de cor que o Tailwind não conhece\n");

const temaInline = (() => {
  const i = css.indexOf("@theme inline {");
  const fecha = css.indexOf("\n}", i);
  return new Set(
    [...css.slice(i, fecha).matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
})();

/**
 * Os prefixos que quase sempre levam cor. `divide-`, `outline-` e afins ficam
 * de fora: o ganho é pequeno e a lista de exceções cresce demais.
 */
const PREFIXOS = ["bg", "text", "border", "ring", "fill", "stroke"];

/** Nomes que o Tailwind já traz de fábrica e não precisam estar no @theme. */
const DE_FABRICA =
  /^(inherit|current|transparent|black|white|auto|none|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})$/;

/**
 * O que esses mesmos prefixos levam quando NÃO é cor.
 *
 * Esta lista existe para que a conferência possa ser pela negativa: tudo que
 * não é cor conhecida nem valor conhecido é suspeito. Ao contrário, tentar
 * adivinhar "parece uma cor nossa?" deixa passar justamente o erro que
 * interessa — `text-acent-strong`, com um "c" a menos, não parece nada.
 */
const NAO_E_COR = new Set([
  // tamanho e alinhamento de texto
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  "left", "center", "right", "justify", "start", "end",
  "balance", "pretty", "nowrap", "ellipsis", "clip", "wrap", "style",
  // borda
  "t", "r", "b", "l", "x", "y", "s", "e",
  "solid", "dashed", "dotted", "double", "hidden", "collapse", "separate",
  "spacing",   // border-spacing-*, de tabela
  "reveal",    // text-reveal-*
  // fundo
  "fixed", "local", "scroll", "clip-text", "clip-border", "clip-padding", "clip-content",
  "cover", "contain", "repeat", "no-repeat", "repeat-x", "repeat-y", "repeat-round",
  "repeat-space", "origin-border", "origin-padding", "origin-content", "bottom", "top",
  "blend-normal", "blend-multiply", "blend-screen", "blend-overlay",
  // ring e offset
  "inset", "offset",
]);

/** `border-b-2`, `bg-gradient-to-br`, `ring-offset-2` — sufixo com número ou direção. */
function valorConhecido(nome) {
  if (NAO_E_COR.has(nome)) return true;
  const primeiro = nome.split("-")[0];
  if (NAO_E_COR.has(primeiro)) return true;
  if (/^\d/.test(nome)) return true;           // border-2, ring-4
  if (nome.startsWith("gradient-")) return true;
  if (nome.startsWith("linear-") || nome.startsWith("radial-") || nome.startsWith("conic-")) return true;
  return false;
}

// O ponto antes do \\b captura UM caractere de contexto. Sem ele,
// `[text-orientation:mixed]` -- propriedade CSS arbitrária do Tailwind --
// entrega `text-orientation` ao detector, que reclama de um utilitário que
// nunca existiu. Com o contexto dá para descartar o que vem logo depois de
// `[`, `-` ou `:`.
let classes = "";
try {
  classes = execSync(
    `grep -rhoE '.?\\b(${PREFIXOS.join("|")})-[a-z][a-z0-9-]*' src/ --include=*.tsx --include=*.ts || true`,
    { encoding: "utf8" },
  );
} catch {
  classes = "";
}

const desconhecidas = new Map();
for (const comContexto of new Set(classes.split("\n").filter(Boolean))) {
  // Descarta o que estava dentro de um valor arbitrário ou colado noutra
  // palavra: `[text-orientation:…]`, `--text-sm`, `algo:text-xs` já tratado
  // pelo prefixo de variante.
  const anterior = comContexto.length > 0 && !/^[a-z]/.test(comContexto[0])
    ? comContexto[0]
    : "";
  if (anterior === "[" || anterior === "-") continue;

  const bruta = anterior ? comContexto.slice(1) : comContexto;
  const corte = bruta.indexOf("-");
  const prefixo = bruta.slice(0, corte);
  const nome = bruta.slice(corte + 1);

  if (DE_FABRICA.test(nome)) continue;
  if (temaInline.has(nome)) continue;
  if (valorConhecido(nome)) continue;

  desconhecidas.set(bruta, `${prefixo}-${nome}`);
}

if (desconhecidas.size === 0) {
  console.log("  ok      toda classe de cor usada existe no @theme inline");
} else {
  for (const classe of desconhecidas.keys()) {
    falhas++;
    console.log(`  FALHOU  ${classe} — não há --color-* com esse nome em ${CSS}`);
    console.log(`          O Tailwind não emite nada para ela, e a tela fica sem a cor.`);
  }
}

console.log("");
if (falhas > 0) {
  console.log(`${falhas} problema(s). A interface não está pronta.\n`);
  process.exit(1);
}
console.log(`Tudo certo${avisos ? ` (${avisos} aviso)` : ""}.\n`);
