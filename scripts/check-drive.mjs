#!/usr/bin/env node
/**
 * O nome que a pessoa digitou continua sem conseguir mexer na consulta do
 * Drive?
 *
 * `files.list` do Google recebe um `q` que é uma LINGUAGEM DE CONSULTA:
 * `name = 'Mundo Verde' and '<id>' in parents and trashed = false`. O nome da
 * empresa e o título da demanda vêm de campos que alguém digita, e vão para
 * dentro daquelas aspas.
 *
 * ---------------------------------------------------------------------------
 * **O CASO BENIGNO JÁ BASTA PARA DOER, E ELE É COMUM.** Um cliente chamado
 * `Bar do Zé's` quebra a consulta: o Drive responde 400, o botão devolve um
 * erro sobre sintaxe, e ninguém liga uma coisa à outra.
 *
 * O caso maligno é o mesmo mecanismo com intenção: um nome montado para
 * fechar a aspa e acrescentar cláusula faz a busca procurar outra coisa. A
 * resposta é uma lista de arquivos de outro lugar do Drive — e o produto
 * grava o id do primeiro como se fosse a pasta daquele cliente.
 *
 * **E nada disso quebra o build.** É a mesma família de `check-preview` e
 * `check-email`: uma trava que, quando some, faz o programa continuar
 * funcionando para todo nome sem aspa — que são quase todos.
 * ---------------------------------------------------------------------------
 *
 * São DUAS travas independentes, e esta checagem mede as duas:
 *   1. `nomeDePasta()` tira a aspa do nome ANTES de ele virar pasta;
 *   2. `escaparParaBusca()` escapa o que sobrar, na hora de montar o `q`.
 *
 * A primeira sozinha não bastaria: `escaparParaBusca()` também recebe o id da
 * pasta-mãe, que não passa por `nomeDePasta()`.
 */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fonte = await readFile("src/lib/drive/config.ts", "utf8");
const pasta = await mkdtemp(join(tmpdir(), "fh-drive-"));
const copia = join(pasta, "config.ts");
await writeFile(copia, fonte.replace(/^import "server-only";\n/, ""));

let falhas = 0;

function confere(certo, frase, detalhe) {
  if (!certo) falhas++;
  console.log(`  ${certo ? "ok     " : "FALHA  "} ${frase}` + (certo || !detalhe ? "" : `\n          ${detalhe}`));
}

try {
  const { nomeDePasta, escaparParaBusca } = await import(pathToFileURL(copia).href);

  console.log("\nO nome digitado não mexe na consulta do Drive\n");

  // ---- 1. o escape da linguagem de consulta
  const comAspa = escaparParaBusca("Bar do Zé's");
  confere(
    comAspa === "Bar do Zé\\'s",
    "a aspa simples é escapada",
    `veio ${JSON.stringify(comAspa)}`,
  );

  const comBarra = escaparParaBusca("a\\b");
  confere(
    comBarra === "a\\\\b",
    "a contrabarra é escapada",
    `veio ${JSON.stringify(comBarra)}`,
  );

  // A ORDEM: contrabarra primeiro, aspa depois. Invertida, o escape da aspa
  // seria escapado de novo e a aspa voltaria a fechar a string -- que é
  // exatamente o furo, com o escape parecendo estar lá.
  const escapeDoEscape = escaparParaBusca("a\\'b");
  confere(
    escapeDoEscape === "a\\\\\\'b",
    "contrabarra ANTES de aspa — invertido, a aspa volta a fechar a string",
    `veio ${JSON.stringify(escapeDoEscape)}`,
  );

  // A prova de que a consulta montada continua com uma string só. Contar
  // aspas não escapadas é o que separa "escapou" de "parece que escapou".
  const malicioso = "x' or name != '";
  const q = `name = '${escaparParaBusca(nomeDePasta(malicioso))}' and trashed = false`;
  const aspasSoltas = (q.match(/(^|[^\\])'/g) ?? []).length;
  confere(
    aspasSoltas === 2,
    "um nome montado para fechar a aspa não abre cláusula nova",
    `a consulta ficou com ${aspasSoltas} aspas soltas: ${q}`,
  );

  // ---- 2. a trava de baixo, no nome da pasta
  confere(!nomeDePasta("Bar do Zé's").includes("'"), "o nome da pasta sai sem aspa simples");
  confere(!nomeDePasta('Campanha "Verão"').includes('"'), "o nome da pasta sai sem aspa dupla");
  confere(
    nomeDePasta("Feed/story site") === "Feed-story site",
    "a barra vira hífen — no Drive ela se lê como um nível que não existe",
    `veio ${JSON.stringify(nomeDePasta("Feed/story site"))}`,
  );
  confere(
    nomeDePasta("a\\b") === "a-b",
    "a contrabarra também",
    `veio ${JSON.stringify(nomeDePasta("a\\b"))}`,
  );
  confere(nomeDePasta("   ") === "Sem nome", "nome vazio vira 'Sem nome', e não uma pasta sem título");
  confere(nomeDePasta("a".repeat(400)).length <= 120, "o nome é cortado — 400 caracteres não cabem em tela nenhuma");
  confere(
    nomeDePasta("Campanha\tde\nVerão") === "Campanha de Verão",
    "caractere de controle vira espaço",
    `veio ${JSON.stringify(nomeDePasta("Campanha\tde\nVerão"))}`,
  );
} finally {
  await rm(pasta, { recursive: true, force: true });
}

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} caso(s) em que o nome digitado alcançou a consulta.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
