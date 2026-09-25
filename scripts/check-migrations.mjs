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

/**
 * A TERCEIRA CHECAGEM, e ela nasceu de um bug em producao.
 *
 * `scripts/onde-esta-o-banco.sql` e o script que responde "em que migration
 * este banco esta" -- o que se cola no SQL Editor ANTES de aplicar qualquer
 * coisa. A lista dele e escrita a mao, uma linha por migration, e nada
 * conferia que ela acompanhava a pasta.
 *
 * Ela parou na 0054. A 0055 (o Calendario Full) ficou sem linha, entao o
 * script respondia "ok" nas trinta e duas que conhecia -- e um banco parado na
 * 0054 lia como um banco em dia. O sintoma foi `/painel/calendario` devolvendo
 * erro de servidor: a view `calendar_events` nao existia, e quem rodasse o
 * script para descobrir por que iria procurar o problema no codigo.
 *
 * E o modo de falha de sempre neste projeto: uma checagem que so sabe dizer
 * "ok" nao verifica nada. A lista comeca na 0022 de proposito -- o corte e a
 * MENOR migration listada, e dali para a frente nenhuma pode faltar.
 */
console.log("\nCobertura de scripts/onde-esta-o-banco.sql\n");

const ESTADO = path.join(process.cwd(), "scripts", "onde-esta-o-banco.sql");
const textoDoEstado = readFileSync(ESTADO, "utf8");

// So as linhas de dado: `('0055', 'view calendar_events', 'tabela', ...)`.
const listadas = new Set(
  [...textoDoEstado.matchAll(/^\s*\('(\d{4})',/gm)].map((m) => m[1]),
);

const naPasta = readdirSync(PASTA)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .map((f) => f.slice(0, 4))
  .sort();

if (listadas.size === 0) {
  problemas += 1;
  console.log("  FALHA   nao encontrei nenhuma linha de migration no script.");
  console.log("          O formato mudou, e a checagem passou a nao conferir nada.");
} else {
  // A EXCECAO PRECISA SER ESCRITA, e escrita NO SCRIPT -- nunca numa lista
  // aqui dentro. Existe migration que nao deixa rastro (a 0026 foi desfeita
  // pela 0029: nao sobra objeto nem trecho de corpo que diga se ela passou).
  // Para essas, a linha honesta e nenhuma linha; o que nao pode e a ausencia
  // ser silenciosa. O formato cobra o motivo junto -- `-- SEM LINHA: 0026 -
  // porque ...` --, entao quem acrescentar a 0056 ou escreve a linha dela ou
  // escreve por que ela nao da para conferir. As duas sao decisao; esquecer
  // nao e.
  const isentas = new Map(
    [...textoDoEstado.matchAll(/^\s*--\s*SEM LINHA:\s*(\d{4})\s*[-–—]\s*(\S.*)$/gm)]
      .map((m) => [m[1], m[2].trim()]),
  );

  const corte = [...listadas].sort()[0];
  const faltando = naPasta.filter(
    (n) => n >= corte && !listadas.has(n) && !isentas.has(n),
  );

  for (const n of faltando) {
    problemas += 1;
    console.log(`  FALHA   a migration ${n} nao tem linha em onde-esta-o-banco.sql`);
    console.log(
      "          Um banco parado nela leria como um banco em dia. Acrescente a\n" +
        "          linha com uma coisa que SO ela cria.",
    );
  }

  if (faltando.length === 0) {
    console.log(
      `  ok      da ${corte} a ${naPasta[naPasta.length - 1]}, toda migration tem linha`,
    );
    for (const [n, motivo] of isentas) {
      console.log(`  isenta  ${n}: ${motivo}`);
    }
  }
}

console.log(
  problemas === 0
    ? "\nTudo certo.\n"
    : `\n${problemas} problema(s).\n`,
);

process.exit(problemas === 0 ? 0 : 1);
