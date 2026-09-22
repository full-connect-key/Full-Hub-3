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

// --- Financeiro Pessoal ----------------------------------------------------

await ir("/painel/financeiro-pessoal");
const pessoal = await pagina.locator("main").textContent();

for (const rotulo of ["Entradas", "Saídas", "Saldo do mês"]) {
  if (pessoal?.includes(rotulo)) ok(`Cartão “${rotulo}” do pessoal`);
  else falha(`Cartão “${rotulo}” do pessoal`);
}

// A adicao rapida numa linha so: dialogo para cada gasto mata o habito.
const linhaRapida = await pagina.locator('#pf-descricao').count();
if (linhaRapida > 0) ok("A adição rápida fica numa linha só, sempre visível");
else falha("A adição rápida fica numa linha só, sempre visível");

if (/Repetir \d+ no mês seguinte/.test(pessoal ?? "")) {
  ok("Dá para repetir os recorrentes no mês seguinte");
} else {
  falha("Dá para repetir os recorrentes no mês seguinte");
}

if (/Saldo dos últimos 6 meses/.test(pessoal ?? "")) ok("O gráfico de saldo de 6 meses aparece");
else falha("O gráfico de saldo de 6 meses aparece");

if (/Saídas por categoria/.test(pessoal ?? "")) ok("E a divisão das saídas por categoria");
else falha("E a divisão das saídas por categoria");

// A saida do modulo, em DUAS etapas.
await pagina.locator('button:has-text("Quero sair deste módulo")').click();
await pagina.waitForTimeout(300);
const zona = await pagina.locator("main").textContent();
if (/Apagar todos os meus dados/.test(zona ?? "")) {
  ok("“Apagar todos os meus dados” é a segunda etapa, não a primeira");
} else {
  falha("“Apagar todos os meus dados” é a segunda etapa, não a primeira");
}

await pagina.locator('button:has-text("Apagar tudo")').first().click();
await pagina.waitForTimeout(500);
const confirmacao = await pagina.locator('[role="alertdialog"], [role="dialog"]').textContent();
if (/Não existe desfazer|não existe desfazer/i.test(confirmacao ?? "")) {
  ok("E a confirmação diz que não há desfazer");
} else {
  falha("E a confirmação diz que não há desfazer", (confirmacao ?? "").slice(0, 80));
}
await pagina.keyboard.press("Escape");

// --- O menu ----------------------------------------------------------------
//
// Medido de OUTRA tela de proposito: item discreto ATIVO volta ao peso cheio,
// por desenho -- quem esta nele precisa ver que esta. Medir estando no proprio
// Financeiro Pessoal daria 16px nos dois e o teste passaria pelo motivo
// errado, que e o modo de falha destes scripts.
await ir("/painel");

const itensDoMenu = await pagina
  .locator('nav[aria-label="Módulos do painel"] a')
  .allTextContents();

const posicao = itensDoMenu.findIndex((t) => /Financeiro Pessoal/.test(t));
if (posicao >= 0) ok("Financeiro Pessoal está no menu");
else falha("Financeiro Pessoal está no menu");

// Ele tem que ser o ULTIMO da secao Principal.
const posicaoDoPerfil = itensDoMenu.findIndex((t) => /Meu Perfil/.test(t));
if (posicao > posicaoDoPerfil && posicaoDoPerfil >= 0) {
  ok("E é o último da seção Principal, depois de Meu Perfil");
} else {
  falha("E é o último da seção Principal", `pessoal ${posicao}, perfil ${posicaoDoPerfil}`);
}

// Peso visual reduzido: icone menor que o dos outros.
const tamanhos = await pagina.evaluate(() => {
  const links = [...document.querySelectorAll('nav[aria-label="Módulos do painel"] a')];
  const achar = (texto) => links.find((l) => l.textContent.includes(texto));
  const icone = (el) => el?.querySelector("svg")?.getBoundingClientRect().width ?? 0;
  return {
    pessoal: icone(achar("Financeiro Pessoal")),
    tasks: icone(achar("Minhas Tasks")),
  };
});
if (tamanhos.pessoal > 0 && tamanhos.pessoal < tamanhos.tasks) {
  ok("Com peso visual reduzido", `${tamanhos.pessoal}px contra ${tamanhos.tasks}px`);
} else {
  falha("Com peso visual reduzido", JSON.stringify(tamanhos));
}

// Nenhum item cortado, inclusive os novos.
const cortado = await pagina.evaluate(() => {
  const itens = [...document.querySelectorAll('nav[aria-label="Módulos do painel"] a span')];
  return itens.some((el) => el.scrollWidth > el.clientWidth + 1);
});
if (cortado) falha("Nenhum item do menu fica cortado");
else ok("Nenhum item do menu fica cortado");

// --- Fora da Home ----------------------------------------------------------

await ir("/painel");
const home = await pagina.locator("main").textContent();
if (!/Financeiro Pessoal/.test(home ?? "")) {
  ok("O Financeiro Pessoal NÃO aparece na tela inicial");
} else {
  falha("O Financeiro Pessoal NÃO aparece na tela inicial");
}

// --- Erro de runtime -------------------------------------------------------

if (erros.length === 0) ok("Nenhum erro de runtime nas telas visitadas");
else falha("Nenhum erro de runtime nas telas visitadas", erros[0]);

await navegador.close();

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
