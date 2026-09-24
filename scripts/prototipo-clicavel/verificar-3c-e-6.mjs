/**
 * Os criterios de aceite dos Sprints 3C e 6 que so aparecem CLICANDO.
 *
 * A bateria de supabase/testes/ prova as regras do banco; esta prova as da
 * tela. O que ela pega e o erro de runtime que o build nao pega -- foi assim
 * que apareceu um `export const` num arquivo "use server" no Sprint 3B.
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-3c-e-6.mjs
 *
 * O perfil importa: os dois ultimos blocos so valem rodando como socio.
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
const pagina = await navegador.newPage({ viewport: { width: 1700, height: 1100 } });

// Erro de runtime vira falha, em vez de passar batido como tela vazia.
const erros = [];
pagina.on("pageerror", (e) => erros.push(String(e)));

async function ir(rota) {
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
}

// --- A tela inicial --------------------------------------------------------

await ir("/painel");

const saudacao = await pagina.locator("h1").first().textContent();
if (saudacao?.includes("Olá,")) ok("A tela inicial saúda pelo primeiro nome", saudacao.trim());
else falha("A tela inicial saúda pelo primeiro nome", saudacao ?? "sem h1");

const atalhos = await pagina.locator('a[href^="/painel/"]:has-text("Minhas Tasks")').count();
if (atalhos > 0) ok("Acesso Rápido leva a Minhas Tasks");
else falha("Acesso Rápido leva a Minhas Tasks");

const portais = await pagina.locator('a:has-text("Abrir Portal")').count();
if (portais >= 2) ok("A grade de Portais de Clientes lista os clientes ativos", `${portais} portais`);
else falha("A grade de Portais de Clientes lista os clientes ativos", `${portais}`);

const abreEmAba = await pagina
  .locator('a:has-text("Abrir Portal")')
  .first()
  .getAttribute("target");
if (abreEmAba === "_blank") ok("Abrir Portal abre em aba nova");
else falha("Abrir Portal abre em aba nova", `target=${abreEmAba}`);

// --- O menu ----------------------------------------------------------------

const selo = await pagina.locator('nav:has-text("Gestão") >> text=Admin').count();
if (selo > 0) ok("A seção Gestão tem o selo Admin");
else falha("A seção Gestão tem o selo Admin");

const cortado = await pagina.evaluate(() => {
  const itens = [...document.querySelectorAll('nav[aria-label="Módulos do painel"] a span')];
  return itens.some((el) => el.scrollWidth > el.clientWidth + 1);
});
if (cortado) falha("Nenhum item do menu fica cortado");
else ok("Nenhum item do menu fica cortado");

// --- O sino ----------------------------------------------------------------

await pagina.locator('button[aria-label^="Notificações"]').click();
await pagina.waitForTimeout(400);
const avisos = await pagina.locator('[data-slot="popover-content"] li').count();
if (avisos > 0) ok("O sino abre a lista de notificações", `${avisos} avisos`);
else falha("O sino abre a lista de notificações");
await pagina.keyboard.press("Escape");

// --- Full Days -------------------------------------------------------------

await ir("/painel/full-days?aba=matriz");

const roxos = await pagina.locator("td .bg-ferias").count();
if (roxos > 0) ok("A matriz mostra o período aprovado em roxo", `${roxos} dias`);
else falha("A matriz mostra o período aprovado em roxo", "nenhum dia roxo");

const mes = await pagina.locator("main p.first-letter\\:uppercase").first().textContent();
if (mes && !/ De /.test(mes)) ok("O mês não sai com “De” maiúsculo", mes.trim());
else falha("O mês não sai com “De” maiúsculo", mes ?? "");

// Dia que veio de pedido aprovado nao pode abrir menu de edicao.
const feriasEditavel = await pagina
  .locator("td button .bg-ferias")
  .count();
if (feriasEditavel === 0) ok("Dia de férias aprovado não abre menu na matriz");
else falha("Dia de férias aprovado não abre menu na matriz", `${feriasEditavel} clicáveis`);

await ir("/painel/full-days?aba=relatorio");
const alerta = await pagina.locator("text=Férias vencendo").count();
if (alerta > 0) ok("O relatório destaca quem está com férias vencendo");
else falha("O relatório destaca quem está com férias vencendo");

await ir("/painel/full-days?aba=aprovacoes");
const contexto = await pagina.locator("text=Da mesma área").count();
if (contexto > 0) ok("A fila mostra quem mais da área está fora no período");
else falha("A fila mostra quem mais da área está fora no período");

await ir("/painel/full-days");
const bloqueados = await pagina.locator("button[disabled].bg-danger-soft").count();
if (bloqueados > 0) ok("O calendário bloqueia os dias de colega da mesma área", `${bloqueados} dias`);
else falha("O calendário bloqueia os dias de colega da mesma área");

const comNome = await pagina
  .locator('button[aria-label*="fora"]')
  .first()
  .getAttribute("aria-label");
if (comNome && /Marina/.test(comNome)) ok("E diz de quem é o bloqueio", comNome);
else falha("E diz de quem é o bloqueio", comNome ?? "sem rótulo");

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
