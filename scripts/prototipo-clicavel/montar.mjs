/**
 * Junta a captura num unico pacote: CSS, telas inteiras e miolo de cada
 * modulo. Saida: pacote.json, que o gerar.mjs transforma na pagina final.
 *
 *   node scripts/prototipo-clicavel/montar.mjs <pasta-da-captura> <pacote.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const DIR = process.argv[2];
const ler = (n) => readFileSync(`${DIR}/${n}.html`, "utf8");

function corpo(nome) {
  const s = ler(nome);
  const i = s.indexOf("<body");
  const j = s.lastIndexOf("</body>");
  return s
    .slice(s.indexOf(">", i) + 1, j)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div hidden=""><!--\$--><!--\/\$--><\/div>/g, "")
    .trim();
}

/** Só o miolo do <main>, para trocar o conteúdo sem redesenhar o menu. */
function miolo(nome) {
  const s = corpo(nome);
  const i = s.indexOf("<main");
  const j = s.lastIndexOf("</main>");
  if (i === -1 || j === -1) return s;
  return s.slice(s.indexOf(">", i) + 1, j);
}

/**
 * Telas com <Suspense> tiveram o DOM final capturado pelo navegador: o HTML
 * inicial delas traz o esqueleto de carregamento, e o conteudo chega depois.
 */
const pelaPagina = JSON.parse(readFileSync(`${DIR}/mains.json`, "utf8"));

let css = readFileSync(`${DIR}/app.css`, "utf8");

function removerFontFacesLocais(texto) {
  let saida = "";
  let i = 0;
  while (i < texto.length) {
    const inicio = texto.indexOf("@font-face", i);
    if (inicio === -1) { saida += texto.slice(i); break; }
    const abre = texto.indexOf("{", inicio);
    let nivel = 0, fim = abre;
    for (let k = abre; k < texto.length; k++) {
      if (texto[k] === "{") nivel++;
      else if (texto[k] === "}") { nivel--; if (nivel === 0) { fim = k; break; } }
    }
    const bloco = texto.slice(inicio, fim + 1);
    saida += texto.slice(i, inicio);
    if (!bloco.includes("../media")) saida += bloco;
    i = fim + 1;
  }
  return saida;
}
css = removerFontFacesLocais(css);
const blocoEscuro = [...css.matchAll(/\.dark\{([^}]*)\}/g)].map((m) => m[1]).join(";");

const TELAS = {
  login: corpo("login"),
  "login-expirado": corpo("login-expirado"),
  esqueci: corpo("esqueci"),
  redefinir: corpo("redefinir"),
  negado: corpo("negado"),
  status: corpo("status"),
  portal: corpo("portal"),
  "portal-aprovacoes": corpo("portal-aprovacoes"),
  "portal-social-media": corpo("portal-social"),
  "portal-campanhas": corpo("portal-campanhas"),
  "portal-configuracoes": corpo("portal-config"),
  "painel-socio": corpo("shell-socio"),
  "painel-desenvolvedor": corpo("shell-desenvolvedor"),
  "painel-colaborador": corpo("shell-colaborador"),
};

const MODULOS = {
  "/painel": miolo("modulo-home"),
  "/painel/minhas-tasks": pelaPagina["modulo-minhas-tasks"],
  "/painel/gestao-tasks": pelaPagina["modulo-gestao-tasks"],
  "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111": pelaPagina["modulo-gestao-tasks-detalhe"],
  "/painel/calendario": miolo("modulo-calendario"),
  "/painel/aprovacoes-internas": pelaPagina["modulo-aprovacoes-internas"],
  "/painel/workflows": pelaPagina["modulo-workflows"],
  "/painel/aprovacoes": miolo("modulo-aprovacoes"),
  "/painel/clientes": miolo("modulo-clientes"),
  "/painel/clientes/c0000000-0000-0000-0000-00000000000a": miolo("modulo-clientes-detalhe"),
  "/painel/equipe": miolo("modulo-equipe"),
  "/painel/equipe/a0000000-0000-0000-0000-000000000003": miolo("modulo-equipe-detalhe"),
  "/painel/full-days": pelaPagina["modulo-full-days"],
  "/painel/full-days?aba=matriz": pelaPagina["full-days-matriz"],
  "/painel/full-days?aba=relatorio": pelaPagina["full-days-relatorio"],
  "/painel/full-days?aba=aprovacoes": pelaPagina["full-days-aprovacoes"],
  "/painel/financeiro": miolo("modulo-financeiro"),
  "/painel/meu-desenvolvimento": miolo("modulo-meu-desenvolvimento"),
  "/painel/resumo-semanal": pelaPagina["modulo-resumo-semanal"],
  "/painel/notas-fiscais": pelaPagina["modulo-notas-fiscais"],
  "/painel/academy": miolo("modulo-academy"),
  "/painel/recomendacoes": miolo("modulo-recomendacoes"),
  "/painel/financeiro-pessoal": miolo("modulo-financeiro-pessoal"),
  "/painel/perfil": miolo("modulo-perfil"),
  "/painel/dev/componentes": miolo("modulo-dev-componentes"),
  "/portal/mundo-verde": pelaPagina["portal-do-cliente-pela-equipe"],
};

const telasHtml = Object.entries(TELAS)
  .map(([nome, html]) => `<div class="tela" data-tela="${nome}" hidden>${html}</div>`)
  .join("\n");

// As tres visualizacoes de tasks sao trocadas por botao, nao por link: cada
// uma foi capturada na propria URL e entra no mesmo mecanismo das abas.
const VISOES = {
  "/painel/minhas-tasks": {
    Board: pelaPagina["minhas-visao-board"],
    Lista: pelaPagina["modulo-minhas-tasks"],
    "Calendário": pelaPagina["minhas-visao-calendario"],
  },
  "/painel/gestao-tasks": {
    Board: pelaPagina["modulo-gestao-tasks"],
    Lista: pelaPagina["visao-lista"],
    "Calendário": pelaPagina["visao-calendario"],
  },
};

writeFileSync(
  process.argv[3],
  JSON.stringify({ css, blocoEscuro, telasHtml, modulos: MODULOS, visoes: VISOES }),
);
console.log(
  "css:", css.length,
  "| telas:", Object.keys(TELAS).length,
  "| modulos:", Object.keys(MODULOS).length,
);
