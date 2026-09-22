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

// O modulo da agencia chama-se "Financeiro". O pessoal chama-se "Financeiro
// Pessoal" e ESSE ele ve -- e de todo mundo. A busca precisa distinguir os
// dois, senao passa pelo motivo errado.
const links = [...painel.matchAll(/href="(\/painel\/financeiro[^"]*)"/g)].map((m) => m[1]);
const soPessoal = links.every((l) => l.startsWith("/painel/financeiro-pessoal"));

if (links.length > 0 && soPessoal) {
  ok("O desenvolvedor NÃO vê Financeiro no menu", `só ${[...new Set(links)].join(", ")}`);
} else {
  falha("O desenvolvedor NÃO vê Financeiro no menu", links.join(", ") || "nenhum link");
}

const financeiro = await fetch(`${BASE}/painel/financeiro`, { redirect: "manual" });
if (financeiro.status === 403) {
  ok("E recebe 403 digitando o endereço", `HTTP ${financeiro.status}`);
} else {
  falha("E recebe 403 digitando o endereço", `HTTP ${financeiro.status}`);
}

// Esconder o item nao e protecao, e o Financeiro Pessoal prova o outro lado:
// ele aparece para todo perfil interno e abre normalmente.
const pessoal = await fetch(`${BASE}/painel/financeiro-pessoal`, { redirect: "manual" });
if (pessoal.status === 200) {
  ok("Mas o Financeiro Pessoal abre normalmente para ele");
} else {
  falha("Mas o Financeiro Pessoal abre normalmente para ele", `HTTP ${pessoal.status}`);
}

// O peso visual reduzido chega no HTML servido, e nao so depois da hidratacao.
if (/text-text-on-dark-muted[^"]*"[^>]*href="\/painel\/financeiro-pessoal"/.test(painel)) {
  ok("E o item já chega discreto no HTML do servidor");
} else {
  falha("E o item já chega discreto no HTML do servidor");
}

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
