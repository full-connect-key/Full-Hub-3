/**
 * Os criterios de aceite do Sprint 7 que so aparecem CLICANDO.
 *
 * Mesma divisao de sempre: supabase/testes/ prova as regras do banco, isto
 * prova as da tela. O que ela pega e o erro de runtime que o build nao pega --
 * foi assim que apareceu um `export const` num arquivo "use server".
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-7.mjs
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

// --- Meu Desenvolvimento ---------------------------------------------------

await ir("/painel/meu-desenvolvimento");

const radiogrupos = await pagina.locator('[role="radiogroup"][aria-label^="Nível em"]').count();
if (radiogrupos > 0) ok("Cada skill tem os quatro níveis como radiogroup", `${radiogrupos} skills`);
else falha("Cada skill tem os quatro níveis como radiogroup");

// A rubrica e o que faz "avancado" querer dizer a mesma coisa para duas
// pessoas. Sem ela, cada um calibra a propria regua.
const rubrica = await pagina
  .locator('[role="radio"]')
  .first()
  .getAttribute("aria-label");
if (rubrica && rubrica.includes("—") && rubrica.length > 25) {
  ok("O nível vem com a rubrica, não só o rótulo", rubrica);
} else {
  falha("O nível vem com a rubrica, não só o rótulo", rubrica ?? "sem rótulo");
}

const querDesenvolver = await pagina.locator('button[aria-label^="Quero desenvolver"]').count();
if (querDesenvolver > 0) ok("Dá para marcar uma skill como “quero desenvolver”");
else falha("Dá para marcar uma skill como “quero desenvolver”");

// As observacoes da gestao ficam na MESMA tela, abaixo do perfil, e nao numa
// aba separada: quem abre "Meu Desenvolvimento" quer ver as duas coisas de
// uma vez -- o que ela diz de si e o que disseram dela.
const meuDesenvolvimento = await pagina.locator("main").textContent();
if (
  meuDesenvolvimento?.includes("Observações da gestão") ||
  meuDesenvolvimento?.includes("OBSERVAÇÕES DA GESTÃO")
) {
  ok("As observações da gestão aparecem na mesma tela");
} else {
  falha("As observações da gestão aparecem na mesma tela");
}

if (meuDesenvolvimento?.includes("Júlia Menezes")) {
  ok("A pessoa lê a avaliação com o nome de quem escreveu");
} else {
  falha("A pessoa lê a avaliação com o nome de quem escreveu");
}

// A fileira de controles precisa ser uma COLUNA: "Observação" e mais larga que
// "Anotar", e sem largura fixa a linha que ja tem anotacao puxa tudo para a
// esquerda.
const colunaTorta = await pagina.evaluate(() => {
  const grupos = [...document.querySelectorAll('[role="radiogroup"]')];
  const xs = grupos.map((g) => Math.round(g.getBoundingClientRect().left));
  return new Set(xs).size > 1;
});
if (colunaTorta) falha("Os níveis ficam alinhados em coluna entre as linhas");
else ok("Os níveis ficam alinhados em coluna entre as linhas");

// --- Equipe > Skills -------------------------------------------------------

await ir("/painel/equipe");
await pagina.locator('[role="tab"]:has-text("Skills")').click();
await pagina.waitForTimeout(600);

const campoDeBusca = pagina.locator('input[aria-label="Buscar quem sabe uma skill"]');
if ((await campoDeBusca.count()) > 0) ok("A aba Skills abre com “Quem sabe fazer…?”");
else falha("A aba Skills abre com “Quem sabe fazer…?”");

await campoDeBusca.fill("Motion");
await pagina.waitForTimeout(400);
const achouQuem = await pagina.locator("main").textContent();
if (achouQuem?.includes("Marina Alves")) ok("Buscar uma skill responde quem sabe fazer", "Motion → Marina");
else falha("Buscar uma skill responde quem sabe fazer");

await campoDeBusca.fill("");
await pagina.waitForTimeout(300);

// A celula e um <span role="img"> com rotulo, nao um botao: ela nao faz nada
// ao clique. Contar botoes aqui passava por um Select da barra de filtros --
// um "ok" pelo motivo errado, que e o modo de falha destes testes.
const celulas = await pagina.locator('table td span[role="img"][aria-label]').count();
if (celulas >= 10) ok("A matriz cruza pessoa e skill", `${celulas} células`);
else falha("A matriz cruza pessoa e skill", `${celulas} células`);

// E a celula precisa DIZER o nivel: um quadrado mais claro nao e informacao
// para quem usa leitor de tela.
const rotuloDaCelula = await pagina
  .locator('table td span[role="img"]')
  .first()
  .getAttribute("aria-label");
if (rotuloDaCelula && /: (Iniciante|Intermediário|Avançado|Especialista)$/.test(rotuloDaCelula)) {
  ok("Cada célula diz de quem é, de que skill e em que nível", rotuloDaCelula);
} else {
  falha("Cada célula diz de quem é, de que skill e em que nível", rotuloDaCelula ?? "sem rótulo");
}

const corpo = await pagina.locator("main").textContent();
if (/Lacunas da agência/i.test(corpo ?? "")) ok("A tela mostra as lacunas da agência");
else falha("A tela mostra as lacunas da agência");

// A lacuna precisa APARECER, nao so ter titulo. E ela e sobre quem faz o
// trabalho: SEO tem alguem, mas ninguem avancado -- isso e lacuna. "Analise de
// Dados" nao tem ninguem em nivel nenhum, e por isso NAO entra: e uma linha do
// catalogo que a agencia nao usa, nao uma dependencia perigosa.
if (/Ninguém da casa é avançado nisso/.test(corpo ?? "")) {
  ok("A lacuna diz por extenso o que falta");
} else {
  falha("A lacuna diz por extenso o que falta");
}

const lacunas = await pagina
  .locator('section:has(h2:text-matches("Lacunas", "i")) li, section:has(h2:text-matches("Lacunas", "i")) > div > div')
  .allTextContents();
if (lacunas.some((t) => t.includes("Análise de Dados"))) {
  falha("Skill que ninguém tem fica fora das lacunas", "Análise de Dados listada");
} else {
  ok("Skill que ninguém tem fica fora das lacunas");
}

// A sugestao da equipe tem que chegar a quem decide.
if (/sugest(ão|ões)/i.test(corpo ?? "") && corpo?.includes("Carlos Dias")) {
  ok("A sugestão de skill da equipe espera a gestão no topo do catálogo");
} else {
  falha("A sugestão de skill da equipe espera a gestão no topo do catálogo");
}

// Cabecalho vertical nao pode cortar o nome da skill.
const cortado = await pagina.evaluate(() => {
  const itens = [...document.querySelectorAll("th span")];
  return itens.some((el) => el.scrollHeight > el.clientHeight + 2);
});
if (cortado) falha("Nenhum nome de skill fica cortado no cabeçalho da matriz");
else ok("Nenhum nome de skill fica cortado no cabeçalho da matriz");

// --- A ficha de uma pessoa -------------------------------------------------

// Recarrega a tela: o Radix DESMONTA a aba inativa, entao com a aba Skills
// aberta os links de Pessoas nao existem no DOM.
await ir("/painel/equipe");
const primeiraPessoa = await pagina
  .locator('main a[href^="/painel/equipe/"]')
  .first()
  .getAttribute("href");
await ir(primeiraPessoa ?? "/painel/equipe");

await pagina.locator('[role="tab"]:has-text("Skills")').click();
await pagina.waitForTimeout(500);
const skillsDaPessoa = await pagina.locator('[role="tabpanel"]:visible').textContent();
// A gestao LE as skills de outra pessoa; quem escreve o nivel e so ela.
const editavel = await pagina
  .locator('[role="tabpanel"]:visible [role="radiogroup"] [role="radio"]:not([disabled])')
  .count();
if (skillsDaPessoa && skillsDaPessoa.length > 20 && editavel === 0) {
  ok("A gestão lê as skills da pessoa sem poder mudar o nível");
} else {
  falha("A gestão lê as skills da pessoa sem poder mudar o nível", `${editavel} editáveis`);
}

// Sprint 6 ja foi entregue: a aba nao pode prometer um sprint que ja aconteceu.
await pagina.locator('[role="tab"]:has-text("Full Days")').click();
await pagina.waitForTimeout(400);
const abaFullDays = await pagina.locator('[role="tabpanel"]:visible').textContent();
if (abaFullDays && !/Sprint \d/.test(abaFullDays)) {
  ok("A aba Full Days não promete um sprint já entregue");
} else {
  falha("A aba Full Days não promete um sprint já entregue", abaFullDays?.slice(0, 60) ?? "");
}

const levaAoFullDays = await pagina
  .locator('[role="tabpanel"]:visible a[href^="/painel/full-days"]')
  .count();
if (levaAoFullDays > 0) ok("E leva para onde a informação está");
else falha("E leva para onde a informação está");

// --- Resumo Semanal --------------------------------------------------------

await ir("/painel/resumo-semanal");
await pagina.waitForTimeout(600);

const editor = await pagina.locator(".conteudo-rico").count();
if (editor > 0) ok("A semana tem o campo de texto rico “Como foi a semana”");
else falha("A semana tem o campo de texto rico “Como foi a semana”");

const humores = await pagina.locator('button[aria-pressed]:has-text("Boa")').count();
if (humores > 0) ok("Os chips de humor da semana aparecem");
else falha("Os chips de humor da semana aparecem");

const puxar = await pagina.locator('button:has-text("Puxar minhas entregas")').count();
if (puxar > 0) ok("O botão de puxar as entregas aparece quando há etapa não registrada");
else falha("O botão de puxar as entregas aparece quando há etapa não registrada");

const exportar = await pagina.locator('a:has-text("Exportar")').getAttribute("href");
if (exportar === "/painel/resumo-semanal/exportar") ok("O botão Exportar aponta para a rota de exportação");
else falha("O botão Exportar aponta para a rota de exportação", exportar ?? "sem href");

// A exportacao e um arquivo de texto, baixado -- nao uma aba aberta com o
// registro privado da pessoa.
const resposta = await pagina.request.get(`${BASE}/painel/resumo-semanal/exportar`);
const tipo = resposta.headers()["content-type"] ?? "";
const anexo = resposta.headers()["content-disposition"] ?? "";
if (tipo.startsWith("text/plain") && anexo.startsWith("attachment")) {
  ok("Exportar devolve texto puro como anexo", `${tipo} / ${anexo}`);
} else {
  falha("Exportar devolve texto puro como anexo", `${tipo} / ${anexo}`);
}

const texto = await resposta.text();
if (texto.includes("RESUMO SEMANAL") && texto.includes("campanha de outubro")) {
  ok("O arquivo traz as entregas e o texto da semana");
} else {
  falha("O arquivo traz as entregas e o texto da semana", texto.slice(0, 80));
}

// --- Busca no historico ----------------------------------------------------

const busca = pagina.locator('input[aria-label="Buscar no meu histórico"]');
await busca.fill("campanha");
await pagina.waitForTimeout(1200);

const url = pagina.url();
if (url.includes("busca=campanha")) ok("O termo da busca vai para a URL");
else falha("O termo da busca vai para a URL", url);

const achados = await pagina.locator("main li").count();
if (achados >= 2) ok("A busca varre as entregas e o texto das semanas", `${achados} achados`);
else falha("A busca varre as entregas e o texto das semanas", `${achados}`);

const rotulos = await pagina.locator("main").textContent();
if (rotulos?.includes("Entrega") && rotulos?.includes("Como foi a semana")) {
  ok("Cada achado diz de onde veio");
} else {
  falha("Cada achado diz de onde veio");
}

// Buscando, a semana sai da tela -- senao as duas competem por atencao.
const aindaTemEditor = await pagina.locator(".conteudo-rico").count();
if (aindaTemEditor === 0) ok("Enquanto busca, a semana sai da tela");
else falha("Enquanto busca, a semana sai da tela");

await pagina.locator('button[aria-label="Limpar busca"]').click();
await pagina.waitForTimeout(900);
const voltou = await pagina.locator(".conteudo-rico").count();
if (voltou > 0) ok("Limpar a busca devolve a semana");
else falha("Limpar a busca devolve a semana");

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
