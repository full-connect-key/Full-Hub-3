/**
 * A prova de que o erro de validação sai legível.
 *
 * O QUE ACONTECEU: a tela mostrou, para quem estava usando o sistema,
 *
 *     Invalid input: expected string, received undefined
 *
 * Texto interno do zod, em inglês, sem dizer qual campo. As actions devolviam
 * `validacao.error.issues[0]?.message` cru, e quando o campo chega FALTANDO o
 * zod não usa a mensagem que escrevemos — a nossa está pendurada no
 * `.min(2, "...")`, que só roda depois de o valor já ser uma string.
 *
 * `recusaDeValidacao()`, em `lib/acoes/validacao.ts`, é o único caminho para a
 * tela. Este script existe porque voltar ao jeito antigo é uma linha, e é
 * exatamente o tipo de linha que passa numa revisão: parece igual.
 *
 * Duas perguntas:
 *
 *   1. Alguma action manda a mensagem crua do zod para a tela?
 *   2. O nome da action no log é o mesmo do `executarAcao` em volta? Log que
 *      aponta a action errada é pior que log nenhum — manda quem investiga
 *      procurar no lugar errado.
 *
 * Roda com: npm run check:mensagens
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Onde a mensagem crua ainda é aceitável, e por quê.
 *
 * Os formulários de autenticação montam o objeto com `String(x ?? "")` antes
 * de validar: campo faltando vira string vazia, e aí quem responde é a nossa
 * mensagem ("Informe seu e-mail."), nunca a do zod. Não há o que traduzir.
 */
const EXCECOES = [
  {
    arquivo: "src/lib/auth/acoes.ts",
    motivo: "coage com String(x ?? '') antes de validar: o zod nunca vê undefined",
  },
  {
    arquivo: "src/app/(auth)/trocar-senha/acoes.ts",
    motivo: "mesma coisa: as duas senhas chegam coagidas",
  },
  {
    arquivo: "src/lib/acoes/validacao.ts",
    motivo: "é o próprio helper",
  },
];

/**
 * `-F`, e não é detalhe: sem ele o grep lê o padrão como expressão regular, e
 * `issues[0]` vira "issues" seguido da classe de caracteres `[0]` — ou seja,
 * casa com `issues0` e NÃO com o texto que se quer achar. A varredura passava
 * verde com a linha proibida no arquivo. Foi o teste desta varredura que
 * mostrou: injetei a linha de volta, e ela não acusou.
 */
function grep(padrao) {
  try {
    return execSync(`grep -rnF --include=*.ts --include=*.tsx -- ${JSON.stringify(padrao)} src/`, {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

let problemas = 0;

console.log("\nMensagem crua do zod chegando à tela\n");

const permitidos = new Set(EXCECOES.map((e) => e.arquivo));
const crus = grep("issues[0]").filter((linha) => {
  const arquivo = linha.split(":")[0];
  return !permitidos.has(arquivo);
});

if (crus.length === 0) {
  console.log("  ok      nenhuma — toda recusa passa por recusaDeValidacao()");
} else {
  problemas += crus.length;
  for (const linha of crus) {
    console.log(`  FALHOU  ${linha.trim()}`);
  }
  console.log(
    "\n  Use recusaDeValidacao(acao, erro, dados, fallback, rotulos) de\n" +
      "  @/lib/acoes/validacao. Ela nomeia o campo, lista TODOS os que\n" +
      "  faltam, e nunca deixa passar o texto em inglês do zod.",
  );
}

for (const { arquivo, motivo } of EXCECOES) {
  console.log(`  exceção ${arquivo}\n          ${motivo}`);
}

console.log("\nO nome da action no log bate com o executarAcao em volta\n");

const arquivos = [...new Set(grep("recusaDeValidacao(").map((l) => l.split(":")[0]))].filter(
  (a) => a !== "src/lib/acoes/validacao.ts",
);

let conferidas = 0;
for (const arquivo of arquivos) {
  const linhas = readFileSync(arquivo, "utf-8").split("\n");
  let atual = null;
  linhas.forEach((linha, i) => {
    const abre = linha.match(/executarAcao\("([^"]+)"/);
    if (abre) atual = abre[1];
    const usa = linha.match(/recusaDeValidacao\("([^"]+)"/);
    if (!usa) return;
    conferidas++;
    if (atual !== usa[1]) {
      problemas++;
      console.log(
        `  FALHOU  ${arquivo}:${i + 1} diz "${usa[1]}" e está dentro de "${atual ?? "nenhuma"}"`,
      );
    }
  });
}

if (conferidas === 0) {
  problemas++;
  console.log("  FALHOU  nenhuma chamada encontrada. Isto é erro, não sucesso.");
} else if (problemas === 0) {
  console.log(`  ok      ${conferidas} chamada(s), todas com o nome da própria action`);
}

console.log("");
if (problemas > 0) {
  console.log(`${problemas} problema(s).\n`);
  process.exit(1);
}
console.log("Tudo certo.\n");
