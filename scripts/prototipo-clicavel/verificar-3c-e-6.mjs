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
saudacao?.includes("Olá,")
  ? ok("A tela inicial saúda pelo primeiro nome", saudacao.trim())
  : falha("A tela inicial saúda pelo primeiro nome", saudacao ?? "sem h1");

const atalhos = await pagina.locator('a[href^="/painel/"]:has-text("Minhas Tasks")').count();
atalhos > 0
  ? ok("Acesso Rápido leva a Minhas Tasks")
  : falha("Acesso Rápido leva a Minhas Tasks");

const portais = await pagina.locator('a:has-text("Abrir Portal")').count();
portais >= 2
  ? ok("A grade de Portais de Clientes lista os clientes ativos", `${portais} portais`)
  : falha("A grade de Portais de Clientes lista os clientes ativos", `${portais}`);

const abreEmAba = await pagina
  .locator('a:has-text("Abrir Portal")')
  .first()
  .getAttribute("target");
abreEmAba === "_blank"
  ? ok("Abrir Portal abre em aba nova")
  : falha("Abrir Portal abre em aba nova", `target=${abreEmAba}`);

// --- O menu ----------------------------------------------------------------

const selo = await pagina.locator('nav:has-text("Gestão") >> text=Admin').count();
selo > 0 ? ok("A seção Gestão tem o selo Admin") : falha("A seção Gestão tem o selo Admin");

const cortado = await pagina.evaluate(() => {
  const itens = [...document.querySelectorAll('nav[aria-label="Módulos do painel"] a span')];
  return itens.some((el) => el.scrollWidth > el.clientWidth + 1);
});
cortado
  ? falha("Nenhum item do menu fica cortado")
  : ok("Nenhum item do menu fica cortado");

// --- O sino ----------------------------------------------------------------

await pagina.locator('button[aria-label^="Notificações"]').click();
await pagina.waitForTimeout(400);
const avisos = await pagina.locator('[data-slot="popover-content"] li').count();
avisos > 0
  ? ok("O sino abre a lista de notificações", `${avisos} avisos`)
  : falha("O sino abre a lista de notificações");
await pagina.keyboard.press("Escape");

// --- Resumo Semanal --------------------------------------------------------

await ir("/painel/resumo-semanal");
const entregas = await pagina.locator("main li").count();
entregas > 0
  ? ok("O Resumo Semanal abre na semana corrente com entregas", `${entregas}`)
  : falha("O Resumo Semanal abre na semana corrente com entregas");

await ir("/painel/resumo-semanal?nova=1");
await pagina.waitForTimeout(500);
const dialogoAberto = await pagina.locator('[role="dialog"]').count();
dialogoAberto > 0
  ? ok("O botão da tela inicial já abre o formulário de entrega")
  : falha("O botão da tela inicial já abre o formulário de entrega");

// --- Full Days -------------------------------------------------------------

await ir("/painel/full-days?aba=matriz");

const roxos = await pagina.locator("td .bg-ferias").count();
roxos > 0
  ? ok("A matriz mostra o período aprovado em roxo", `${roxos} dias`)
  : falha("A matriz mostra o período aprovado em roxo", "nenhum dia roxo");

const mes = await pagina.locator("main p.first-letter\\:uppercase").first().textContent();
mes && !/ De /.test(mes)
  ? ok("O mês não sai com “De” maiúsculo", mes.trim())
  : falha("O mês não sai com “De” maiúsculo", mes ?? "");

// Dia que veio de pedido aprovado nao pode abrir menu de edicao.
const feriasEditavel = await pagina
  .locator("td button .bg-ferias")
  .count();
feriasEditavel === 0
  ? ok("Dia de férias aprovado não abre menu na matriz")
  : falha("Dia de férias aprovado não abre menu na matriz", `${feriasEditavel} clicáveis`);

await ir("/painel/full-days?aba=relatorio");
const alerta = await pagina.locator("text=Férias vencendo").count();
alerta > 0
  ? ok("O relatório destaca quem está com férias vencendo")
  : falha("O relatório destaca quem está com férias vencendo");

await ir("/painel/full-days?aba=aprovacoes");
const contexto = await pagina.locator("text=Da mesma área").count();
contexto > 0
  ? ok("A fila mostra quem mais da área está fora no período")
  : falha("A fila mostra quem mais da área está fora no período");

await ir("/painel/full-days");
const bloqueados = await pagina.locator("button[disabled].bg-danger-soft").count();
bloqueados > 0
  ? ok("O calendário bloqueia os dias de colega da mesma área", `${bloqueados} dias`)
  : falha("O calendário bloqueia os dias de colega da mesma área");

const comNome = await pagina
  .locator('button[aria-label*="fora"]')
  .first()
  .getAttribute("aria-label");
comNome && /Marina/.test(comNome)
  ? ok("E diz de quem é o bloqueio", comNome)
  : falha("E diz de quem é o bloqueio", comNome ?? "sem rótulo");

// --- Erro de runtime -------------------------------------------------------

erros.length === 0
  ? ok("Nenhum erro de runtime nas telas visitadas")
  : falha("Nenhum erro de runtime nas telas visitadas", erros[0]);

await navegador.close();

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
