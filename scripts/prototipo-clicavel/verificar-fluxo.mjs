/**
 * Os criterios de aceite que so aparecem CLICANDO.
 *
 * A bateria de supabase/testes/ prova as regras do banco. Esta aqui prova as
 * da tela: que escolher um tipo de tarefa traz as etapas daquele fluxo, que o
 * formulario nao tem responsavel da task, que uma etapa com aprovacao nao
 * oferece "Concluir", que a bloqueada por dependencia nao inicia, e que as
 * rodadas anteriores continuam no acordeao.
 *
 * Rodando contra o prototipo, ela tambem pega erro de runtime que o build nao
 * pega -- foi assim que apareceu um `export const` num arquivo "use server",
 * que derrubava todas as actions da Gestao de Tasks.
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-fluxo.mjs
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
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1100 } });

async function ir(rota) {
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
}

// --- 1. Tipo de tarefa gera as etapas do fluxo -----------------------------
await ir("/painel/gestao-tasks");
await pagina.click('button:has-text("Nova task")');
await pagina.waitForTimeout(400);
await pagina.fill("#task-titulo", "Post de teste");
await pagina.click("#task-cliente");
await pagina.waitForTimeout(250);
await pagina.click('[role="option"]:has-text("Mundo Verde")');
await pagina.waitForTimeout(250);
await pagina.click("#task-tipo");
await pagina.waitForTimeout(250);
await pagina.click('[role="option"]:has-text("Post de feed")');
await pagina.waitForTimeout(1200);

const etapas = await pagina.locator('input[placeholder="Título da subtarefa"]').count();
if (etapas === 4) ok("Escolher o tipo gera as 4 etapas do fluxo", `${etapas} etapas`);
else falha("Escolher o tipo gera as 4 etapas do fluxo", `vieram ${etapas}`);

const primeiro = await pagina.locator('input[placeholder="Título da subtarefa"]').first().inputValue();
if (primeiro === "Pauta") ok("A primeira etapa e a Pauta");
else falha("A primeira etapa e a Pauta", primeiro);

const prazos = pagina.locator('input[aria-label="Prazo da subtarefa"]');
const prazo1 = await prazos.nth(0).inputValue();
const prazo3 = await prazos.nth(2).inputValue();
if (prazo1 && prazo3 && prazo3 > prazo1) ok("Os prazos saem escalonados do inicio da task", `${prazo1} → ${prazo3}`);
else falha("Os prazos saem escalonados do inicio da task", `${prazo1} / ${prazo3}`);

// Dá para acrescentar e remover antes de salvar
await pagina.click('button:has-text("Subtarefa")');
await pagina.waitForTimeout(300);
const depois = await pagina.locator('input[placeholder="Título da subtarefa"]').count();
if (depois === 5) ok("Da para acrescentar etapa depois de aplicar o tipo");
else falha("Da para acrescentar etapa depois de aplicar o tipo", String(depois));

await pagina.locator('button[aria-label="Remover subtarefa"]').last().click();
await pagina.waitForTimeout(300);
const removida = await pagina.locator('input[placeholder="Título da subtarefa"]').count();
if (removida === 4) ok("Da para remover etapa antes de salvar");
else falha("Da para remover etapa antes de salvar", String(removida));

// Nao existe campo de responsavel DA TASK
const rotulos = await pagina.locator("label").allInnerTexts();
if (rotulos.some((r) => r.trim() === "Responsável")) falha("O formulario nao tem responsavel da task", rotulos.join(" | "));
else ok("O formulario nao tem responsavel da task");

await pagina.keyboard.press("Escape");
await pagina.waitForTimeout(300);

// --- 2. O responsavel nao ve Concluir numa etapa com aprovacao -------------
await ir("/painel/gestao-tasks/11111111-1111-1111-1111-111111111111");
const linhaKV = pagina.locator("li", { hasText: "Criar KV" }).first();
const textoKV = await linhaKV.innerText();
if (textoKV.includes("Concluir")) falha("Etapa com aprovacao nao oferece Concluir", textoKV.replace(/\n/g, " "));
else ok("Etapa com aprovacao nao oferece Concluir");

// --- 3. Subtarefa bloqueada tem o botao desabilitado -----------------------
const linhaAdapt = pagina.locator("li", { hasText: "Adaptar formatos" }).first();
const iniciar = linhaAdapt.locator('button:has-text("Iniciar")');
if ((await iniciar.isDisabled())) ok("Etapa bloqueada por dependencia nao inicia");
else falha("Etapa bloqueada por dependencia nao inicia");

// --- 4. O painel da subtarefa abre com as rodadas --------------------------
await pagina.click('button:has-text("Criar KV")');
await pagina.waitForTimeout(600);
const painel = await pagina.locator('[role="dialog"]').innerText();
if (painel.includes("Rodada 2") && painel.includes("Rodada 1")) ok("O painel mostra as duas rodadas, sem apagar a primeira");
else falha("O painel mostra as duas rodadas", painel.slice(0, 160).replace(/\n/g, " "));
if (painel.includes("Requer aprovação: Cliente")) ok("O painel destaca que a aprovacao e do cliente");
else falha("O painel destaca que a aprovacao e do cliente");
if (painel.includes("Trocar a cor do fundo")) ok("O comentario da rodada 1 continua la");
else falha("O comentario da rodada 1 continua la");

await navegador.close();

const passaram = resultados.filter((r) => r[0] === "passou").length;
for (const [situacao, descricao, extra] of resultados) {
  console.log(`${situacao === "passou" ? "  ok " : "FALHA"} ${descricao}${extra ? ` — ${extra}` : ""}`);
}
console.log(`\n${passaram}/${resultados.length} passaram`);
process.exit(passaram === resultados.length ? 0 : 1);
