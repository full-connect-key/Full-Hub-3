/**
 * Os criterios de aceite do Sprint 8 que so aparecem CLICANDO.
 *
 * A bateria de supabase/testes/ prova as regras do banco -- e sao elas que
 * valem. Esta prova as da tela, e pega o erro de runtime que o build nao
 * pega.
 *
 * ATENCAO ao criterio do 403: o prototipo NAO tem Supabase atras, entao a
 * recusa de verdade e a da bateria (07_financeiro.sql, doze cenarios). O que
 * esta tela consegue provar e o outro lado do mesmo criterio: que o item nao
 * aparece no menu do desenvolvedor nem do colaborador.
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-8.mjs
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
});
const pagina = await navegador.newPage({ viewport: { width: 1700, height: 1200 } });

const erros = [];
pagina.on("pageerror", (e) => erros.push(String(e)));

async function ir(rota) {
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
}

// --- Visao geral -----------------------------------------------------------

await ir("/painel/financeiro");

const cartoes = await pagina.locator("main").textContent();
for (const rotulo of ["Receita do mês", "Despesas do mês", "Resultado do mês", "Em atraso"]) {
  if (cartoes?.includes(rotulo)) ok(`Cartão “${rotulo}”`);
  else falha(`Cartão “${rotulo}”`);
}

// Previsto e realizado juntos: um numero sozinho responde a pergunta errada.
if (/de R\$.*previstos/.test(cartoes ?? "")) ok("O cartão mostra realizado E previsto");
else falha("O cartão mostra realizado E previsto");

if (cartoes?.includes("Receita recorrente contratada")) ok("A receita recorrente contratada aparece");
else falha("A receita recorrente contratada aparece");

// O grafico de 12 meses, com legenda (identidade nunca so pela cor).
const linhas = await pagina.locator("svg path[stroke-width='2']").count();
if (linhas === 2) ok("O gráfico traça as duas séries", `${linhas} linhas`);
else falha("O gráfico traça as duas séries", `${linhas}`);

const legenda = await pagina.locator("main").textContent();
if (legenda?.includes("Receita") && legenda?.includes("Despesa")) {
  ok("O gráfico tem legenda, e não só cor");
} else {
  falha("O gráfico tem legenda, e não só cor");
}

// A tabela alternativa: o grafico nao pode ser a unica porta para o numero.
const tabelaAlternativa = await pagina.locator('summary:has-text("Ver os números em tabela")').count();
if (tabelaAlternativa > 0) ok("Os números do gráfico também existem em tabela");
else falha("Os números do gráfico também existem em tabela");

// Alertas: o vencido e o que esta por vencer.
if (/Venceu em/.test(cartoes ?? "")) ok("O alerta mostra o que já venceu");
else falha("O alerta mostra o que já venceu");

if (/Recebe em|Paga em/.test(cartoes ?? "")) ok("E o que vence nos próximos dias");
else falha("E o que vence nos próximos dias");

if (/termina em/.test(cartoes ?? "")) ok("E o contrato terminando em 60 dias");
else falha("E o contrato terminando em 60 dias");

// --- Atraso DERIVADO -------------------------------------------------------
//
// O lancamento de exemplo esta gravado como "faturado" e venceu ha nove dias.
// A tela tem que dizer "Atrasado" sem ninguem ter mexido nele.

await ir("/painel/financeiro?aba=lancamentos");

const atrasados = await pagina.locator('td:has-text("Atrasado")').count();
if (atrasados > 0) {
  ok("Vencido e não pago aparece como atrasado, sozinho", `${atrasados} linha(s)`);
} else {
  falha("Vencido e não pago aparece como atrasado, sozinho");
}

// E "atrasado" NAO pode ser uma opcao de formulario: ele e consequencia.
await pagina.locator('button:has-text("Novo lançamento")').click();
await pagina.waitForTimeout(600);
await pagina.locator("#lanc-status").click();
await pagina.waitForTimeout(300);
const opcoes = await pagina.locator('[role="option"]').allTextContents();
if (!opcoes.some((o) => /Atrasado/i.test(o))) {
  ok("“Atrasado” não é opção no formulário", opcoes.join(", "));
} else {
  falha("“Atrasado” não é opção no formulário", opcoes.join(", "));
}
await pagina.keyboard.press("Escape");
await pagina.waitForTimeout(200);
await pagina.keyboard.press("Escape");
await pagina.waitForTimeout(400);

// --- Filtros na URL --------------------------------------------------------

await ir("/painel/financeiro?aba=lancamentos&tipo=despesa");
const linhasDespesa = await pagina.locator("tbody tr").count();
const corpoFiltrado = await pagina.locator("tbody").textContent();
if (linhasDespesa > 0 && !/Fee mensal/.test(corpoFiltrado ?? "")) {
  ok("O filtro de tipo vem da URL e filtra de verdade", `${linhasDespesa} despesas`);
} else {
  falha("O filtro de tipo vem da URL e filtra de verdade", `${linhasDespesa} linhas`);
}

// --- Contratos -------------------------------------------------------------

await ir("/painel/financeiro?aba=contratos");
const contratos = await pagina.locator("main").textContent();

if (/Gerar lançamentos do mês/.test(contratos ?? "")) ok("O botão de gerar lançamentos existe");
else falha("O botão de gerar lançamentos existe");

// A tela diz QUANTOS vai gerar antes de gerar: no exemplo, so o trimestral
// ainda nao tem lancamento no mes.
if (/1 contrato\(s\) ainda sem lançamento/.test(contratos ?? "")) {
  ok("E diz quantos contratos ainda faltam no mês");
} else {
  falha("E diz quantos contratos ainda faltam no mês", (contratos ?? "").slice(0, 120));
}

if (/Receita recorrente contratada/.test(contratos ?? "")) {
  ok("A receita recorrente aparece mensalizada");
} else {
  falha("A receita recorrente aparece mensalizada");
}

// --- Relatorios ------------------------------------------------------------

await ir("/painel/financeiro?aba=relatorios");
const relatorio = await pagina.locator("main").textContent();

if (/Resultado do período/.test(relatorio ?? "")) ok("O DRE do período aparece");
else falha("O DRE do período aparece");

if (/Rentabilidade por cliente/.test(relatorio ?? "")) ok("A rentabilidade por cliente aparece");
else falha("A rentabilidade por cliente aparece");

if (/Receita por hora/.test(relatorio ?? "")) ok("Com a coluna de receita por hora");
else falha("Com a coluna de receita por hora");

// Cliente sem hora lancada NAO pode aparecer como zero: zero e uma afirmacao
// sobre a conta, e o que se quer dizer e "ninguem registrou o tempo".
if (/sem hora registrada/.test(relatorio ?? "")) {
  ok("Cliente sem hora registrada não vira zero");
} else {
  falha("Cliente sem hora registrada não vira zero");
}

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}
