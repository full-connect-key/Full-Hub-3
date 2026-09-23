/**
 * O formulário de abertura de demanda, verificado CLICANDO.
 *
 * O que ele precisa carregar saiu do desenho que o usuario mandou: seis
 * secoes numeradas, e nenhum campo daquela lista faltando. Uma conferencia a
 * olho passa batido justamente no campo que sumiu, porque o que se ve e o que
 * esta la -- nao o que nao esta.
 *
 * A trava de verdade (nao encerrar sem a aprovacao exigida) NAO e provada
 * aqui: ela e do banco, e quem prova sao os dezenove cenarios de
 * supabase/testes/08_exigencia_de_aprovacao.sql. Esta tela prova o outro lado
 * do mesmo criterio -- que a pessoa consegue declarar a exigencia na abertura,
 * e que a tela diz o que cada opcao significa.
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-formulario-de-task.mjs
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

function acharChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && existsSync(base)) {
    for (const pasta of readdirSync(base)) {
      const c = path.join(base, pasta, "chrome-linux", "chrome");
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

const BASE = "http://localhost:3600";
const resultados = [];
const ok = (d, extra = "") => resultados.push(["passou", d, extra]);
const falha = (d, extra = "") => resultados.push(["FALHOU", d, extra]);

const navegador = await chromium.launch({
  executablePath: acharChromium(),
  args: ["--no-sandbox"],
  env: { ...process.env, LANG: "pt_BR.UTF-8", LC_ALL: "pt_BR.UTF-8" },
});
const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1200 } });

const erros = [];
pagina.on("pageerror", (e) => erros.push(String(e)));

await pagina.goto(`${BASE}/painel/gestao-tasks`, { waitUntil: "networkidle" });
await pagina.click('button:has-text("Nova task")');
await pagina.waitForSelector('[role="dialog"]');

const dialogo = pagina.locator('[role="dialog"]');
const texto = (await dialogo.textContent()) ?? "";

// --- As cinco secoes, na ordem ---------------------------------------------
//
// Eram seis ate a migration 0023, quando a exigencia de aprovacao saiu da
// demanda e passou a ser de cada etapa. E a quarta se chamava "Tipo de
// tarefa" ate o Sprint 9 -- esta lista estava DESATUALIZADA nos dois pontos,
// e so apareceu quando alguem foi rodar a verificacao de novo.
const SECOES = [
  "Informações gerais da demanda",
  "Período e prioridade",
  "Workflow (opcional)",
  "Subtarefas e entregas",
  "Materiais e links",
];

let anterior = -1;
let emOrdem = true;
for (const [indice, secao] of SECOES.entries()) {
  const onde = texto.indexOf(secao);
  if (onde < 0) {
    falha(`Seção ${indice + 1}: “${secao}”`);
    emOrdem = false;
    continue;
  }
  ok(`Seção ${indice + 1}: “${secao}”`);
  if (onde < anterior) emOrdem = false;
  anterior = onde;
}
if (emOrdem) ok("As cinco seções aparecem na ordem numerada");
else falha("As cinco seções aparecem na ordem numerada");

// --- Os campos que o desenho pedia ------------------------------------------

const CAMPOS = [
  ["Nome da Task", '#task-titulo'],
  ["Cliente", '#task-cliente'],
  ["Data de início", '#task-inicio'],
  ["Data de encerramento", '#task-fim'],
  ["Prioridade geral", '#task-prioridade'],
  ["Tipo de tarefa", '#task-tipo'],
  ["Link de entrega", '#task-link-entrega'],
];

for (const [rotulo, seletor] of CAMPOS) {
  const quantos = await dialogo.locator(seletor).count();
  if (quantos === 1) ok(`Campo “${rotulo}”`);
  else falha(`Campo “${rotulo}”`, `${quantos} elemento(s) para ${seletor}`);
}

// O briefing e o editor rico, nao um textarea solto.
if ((await dialogo.locator(".ProseMirror").count()) === 1) ok("Briefing com editor rico");
else falha("Briefing com editor rico");

// --- A exigencia: tres opcoes, nunca quatro ---------------------------------

const opcoes = dialogo.locator('[role="radiogroup"] [role="radio"]');
const quantas = await opcoes.count();
if (quantas === 3) ok("A exigência de aprovação tem três opções");
else falha("A exigência de aprovação tem três opções", `achei ${quantas}`);

const rotulos = (await opcoes.allTextContents()).map((t) => t.trim());
for (const esperado of ["Sem aprovação", "Interna", "Do cliente"]) {
  if (rotulos.includes(esperado)) ok(`Opção “${esperado}”`);
  else falha(`Opção “${esperado}”`, rotulos.join(" / "));
}
// "Dupla" e exatamente o que NAO pode existir: seria um segundo botao com o
// efeito do terceiro.
if (!/dupla/i.test(texto)) ok("Não existe opção “Dupla” (seria igual a “Do cliente”)");
else falha("Não existe opção “Dupla” (seria igual a “Do cliente”)");

// Nasce em "Sem aprovacao", que e o default do banco.
const marcadaInicial = await opcoes.evaluateAll((nodes) =>
  nodes.filter((n) => n.getAttribute("aria-checked") === "true").map((n) => n.textContent?.trim()),
);
if (marcadaInicial.length === 1 && marcadaInicial[0] === "Sem aprovação") {
  ok("A demanda nasce sem exigir aprovação");
} else {
  falha("A demanda nasce sem exigir aprovação", marcadaInicial.join("/"));
}

// Escolher "Do cliente" troca a explicacao, e ela diz que a interna vem antes
// -- que e a parte que faz a opcao ser entendida em vez de decorada.
await dialogo.locator('[role="radio"]:has-text("Do cliente")').click();
const depois = (await dialogo.textContent()) ?? "";
if (/inclui a validação interna/i.test(depois)) {
  ok("A explicação de “Do cliente” diz que a interna vem antes");
} else {
  falha("A explicação de “Do cliente” diz que a interna vem antes");
}

// --- Nada de "Status Geral" -------------------------------------------------
//
// O status da Task e calculado; um seletor aqui seria desfeito pelo recalculo
// um milissegundo depois de salvar.
if (!/Status Geral/i.test(texto)) ok("Não existe seletor de “Status Geral”");
else falha("Não existe seletor de “Status Geral”");

// --- A subtarefa carrega tudo o que e dela -----------------------------------

await dialogo.locator('button:has-text("Subtarefa")').click();

const DA_ETAPA = [
  ["Responsável", 'Responsável'],
  ["Data de entrega", 'Data de entrega'],
  ["Estimativa de tempo", 'Estimativa de tempo'],
  ["Prioridade da subtarefa", 'Prioridade da subtarefa'],
  ["Aprovação", 'Aprovação'],
  ["Depende de", 'Depende de'],
];
for (const [rotulo, aria] of DA_ETAPA) {
  const quantos = await dialogo.locator(`[aria-label="${aria}"]`).count();
  if (quantos === 1) ok(`A etapa tem “${rotulo}”`);
  else falha(`A etapa tem “${rotulo}”`, `${quantos} elemento(s)`);
}

// A estimativa existia no estado e ia para a action, mas nao tinha input
// nenhum: campo morto. Aqui a prova de que ela aceita o formato flexivel.
const estimativa = dialogo.locator('[aria-label="Estimativa de tempo"]');
await estimativa.fill("2h30");
if ((await estimativa.inputValue()) === "2h30") ok("A estimativa aceita “2h30”");
else falha("A estimativa aceita “2h30”");

// --- Referencia por campo, nao por window.prompt -----------------------------
//
// O prompt do navegador nao da para colar no teclado do celular, some ao
// clicar fora e em alguns navegadores nem abre. Se ele voltasse, este clique
// travaria esperando um dialogo nativo que o Playwright nao responde.
let houvePrompt = false;
pagina.on("dialog", async (d) => {
  houvePrompt = true;
  await d.dismiss();
});

await dialogo.locator('[aria-label="Endereço da referência"]').fill("https://figma.com/arquivo");
await dialogo.locator('[aria-label="Nome da referência"]').fill("KV aprovado");
await dialogo.locator('button:has-text("Adicionar")').click();
await pagina.waitForTimeout(300);

if (!houvePrompt) ok("Adicionar referência não abre window.prompt");
else falha("Adicionar referência não abre window.prompt");

const comReferencia = (await dialogo.textContent()) ?? "";
if (comReferencia.includes("KV aprovado")) ok("A referência entra na lista");
else falha("A referência entra na lista");

// --- Erro de runtime ---------------------------------------------------------

if (erros.length === 0) ok("Nenhum erro de runtime no formulário");
else falha("Nenhum erro de runtime no formulário", erros[0]);

await navegador.close();

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
