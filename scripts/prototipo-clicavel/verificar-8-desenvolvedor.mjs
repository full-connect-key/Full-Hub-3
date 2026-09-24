/**
 * O criterio mais importante do Sprint 8, visto pelo lado de quem NAO pode:
 *
 *   "o desenvolvedor nao ve Financeiro no menu e recebe 403 em
 *    /painel/financeiro; a consulta direta as tabelas tambem e negada."
 *
 * A terceira parte -- a consulta direta -- e provada pela bateria
 * (07_financeiro.sql, doze cenarios rodando como o Diego de verdade), porque
 * e no banco que ela vale. Esta aqui prova as outras duas.
 *
 * Roda com o servidor do prototipo no ar COMO DESENVOLVEDOR:
 *   cd .prototipo && PROTOTIPO_ROLE=desenvolvedor npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-8-desenvolvedor.mjs
 */
const BASE = "http://localhost:3600";
const resultados = [];
const ok = (d, extra = "") => resultados.push(["passou", d, extra]);
const falha = (d, extra = "") => resultados.push(["FALHOU", d, extra]);

const painel = await (await fetch(`${BASE}/painel`)).text();

// Com o Financeiro Pessoal fora do produto, `/painel/financeiro` e o UNICO
// modulo financeiro que existe -- e ele e so do socio. A checagem ficou mais
// simples e mais forte: antes precisava distinguir os dois nomes para nao
// passar pelo motivo errado; agora qualquer link `/painel/financeiro` no menu
// do desenvolvedor e uma falha.
const links = [...painel.matchAll(/href="(\/painel\/financeiro[^"]*)"/g)].map((m) => m[1]);

if (links.length === 0) {
  ok("O desenvolvedor NÃO vê Financeiro no menu");
} else {
  falha("O desenvolvedor NÃO vê Financeiro no menu", links.join(", "));
}

const financeiro = await fetch(`${BASE}/painel/financeiro`, { redirect: "manual" });
if (financeiro.status === 403) {
  ok("E recebe 403 digitando o endereço", `HTTP ${financeiro.status}`);
} else {
  falha("E recebe 403 digitando o endereço", `HTTP ${financeiro.status}`);
}

// Esconder o item nao e protecao, e Notas Fiscais prova o outro lado: ele
// aparece para todo perfil interno e abre normalmente. (Era o Financeiro
// Pessoal que provava isto; ele saiu do produto, e Notas Fiscais e o modulo
// pessoal que ficou.)
const notas = await fetch(`${BASE}/painel/notas-fiscais`, { redirect: "manual" });
if (notas.status === 200) {
  ok("Mas Notas Fiscais abre normalmente para ele");
} else {
  falha("Mas Notas Fiscais abre normalmente para ele", `HTTP ${notas.status}`);
}

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
