#!/usr/bin/env node
/**
 * O que este script impede de voltar.
 *
 * Um `$$` escrito DENTRO de um comentário `--` de uma migration. Para o
 * Postgres não é nada: comentário é comentário. Para quem separa os comandos
 * antes de mandá-los — o SQL Editor do Supabase, um cliente gráfico, um script
 * de deploy — ele é a abertura de uma string, e a partir dali a contagem sai
 * de sincronia: o `as $$` da próxima função vira o FECHAMENTO daquela string,
 * e o corpo dela passa a ser lido como SQL solto.
 *
 * O sintoma não aponta para o comentário. Aponta para dentro da função, três
 * telas abaixo, com mensagens que parecem outra coisa:
 *
 *     ERROR: 42P01: relation "avo" does not exist      (era `select ... into avo`)
 *     ERROR: 42601: syntax error at or near "return"   (era `return old;`)
 *
 * Foi isso que aconteceu com a 0032, e custou três tentativas de aplicar. O
 * `$$` estava num comentário explicando por que um comando NÃO pode ficar
 * dentro de um bloco `do`.
 *
 * A checagem é boba de propósito: procura um marcador de dollar quoting à
 * direita de um `--`. Quem quiser citar um em comentário escreve "bloco do" ou
 * "dollar quoting", que é o que a frase queria dizer de qualquer jeito.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PASTA = path.join(process.cwd(), "supabase", "migrations");
const MARCADOR = /\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$/;

let problemas = 0;

console.log("\nMarcador de dollar quoting dentro de comentário\n");

for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort()) {
  const linhas = readFileSync(path.join(PASTA, arquivo), "utf8").split("\n");

  linhas.forEach((linha, i) => {
    const corte = linha.indexOf("--");
    if (corte === -1) return;
    // Só o que vem DEPOIS do `--`. Um `$$` antes dele é código de verdade.
    if (!MARCADOR.test(linha.slice(corte))) return;

    problemas += 1;
    console.log(`  FALHA   ${arquivo}:${i + 1}`);
    console.log(`          ${linha.trim()}`);
    console.log(
      "          Um `$$` em comentário desalinha quem separa os comandos, e o\n" +
        "          erro aparece dentro da PRÓXIMA função. Escreva \"bloco do\".",
    );
  });
}

if (problemas === 0) {
  console.log("  ok      nenhuma migration cita dollar quoting em comentário");
}

// A paridade, que é a consequência. Conta os marcadores fora de comentário:
// ímpar quer dizer que alguma abertura ficou sem fechamento.
console.log("\nParidade dos marcadores de dollar quoting\n");

for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort()) {
  const texto = readFileSync(path.join(PASTA, arquivo), "utf8");
  const semComentario = texto
    .split("\n")
    .map((linha) => {
      const corte = linha.indexOf("--");
      return corte === -1 ? linha : linha.slice(0, corte);
    })
    .join("\n");

  const marcadores = semComentario.match(/\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$/g) ?? [];
  const porTag = new Map();
  for (const m of marcadores) porTag.set(m, (porTag.get(m) ?? 0) + 1);

  for (const [tag, quantas] of porTag) {
    if (quantas % 2 === 0) continue;
    problemas += 1;
    console.log(`  FALHA   ${arquivo}: ${quantas} ocorrência(s) de ${tag} — ímpar`);
  }
}

if (problemas === 0) console.log("  ok      todo marcador abre e fecha");

console.log(
  problemas === 0
    ? "\nTudo certo.\n"
    : `\n${problemas} problema(s). A migration vai quebrar em quem separa os comandos.\n`,
);

process.exit(problemas === 0 ? 0 : 1);
