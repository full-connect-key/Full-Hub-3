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
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

/**
 * O nome pode estar na linha de baixo, e essa foi a falha desta varredura.
 *
 * A versão anterior lia linha a linha, com /recusaDeValidacao\("([^"]+)"/. Um
 * formatador que quebrasse a chamada em várias linhas --
 *
 *     recusaDeValidacao(
 *       "criarCampanha",
 *
 * -- deixava o nome fora da linha do `(`, e aí a chamada não era contada: não
 * dava FALHOU, dava silêncio. Uma action podia registrar o nome errado no log
 * e passar verde aqui, que é exatamente o que esta varredura existe para
 * impedir. Por isso agora ela varre o ARQUIVO inteiro, por posição, e o nome é
 * a primeira string depois do parêntese, esteja ela onde estiver.
 */
function chamadas(texto, funcao) {
  const achados = [];
  const marca = `${funcao}(`;

  for (let i = texto.indexOf(marca); i !== -1; i = texto.indexOf(marca, i + 1)) {
    // A primeira aspa depois do parêntese, pulando espaço e quebra de linha.
    const resto = texto.slice(i + marca.length);
    const nome = resto.match(/^\s*"([^"]*)"/);
    achados.push({
      pos: i,
      nome: nome ? nome[1] : null,
      linha: texto.slice(0, i).split("\n").length,
    });
  }

  return achados;
}

let conferidas = 0;
for (const arquivo of arquivos) {
  const texto = readFileSync(arquivo, "utf-8");
  const aberturas = chamadas(texto, "executarAcao");

  for (const usa of chamadas(texto, "recusaDeValidacao")) {
    conferidas++;

    // Sem nome literal, não há como conferir -- e um nome montado por variável
    // é justamente o que faz o log apontar para a action errada.
    if (usa.nome === null) {
      problemas++;
      console.log(
        `  FALHOU  ${arquivo}:${usa.linha} não passa o nome da action como texto literal`,
      );
      continue;
    }

    const dentroDe = aberturas.filter((a) => a.pos < usa.pos).pop();
    if (dentroDe?.nome !== usa.nome) {
      problemas++;
      console.log(
        `  FALHOU  ${arquivo}:${usa.linha} diz "${usa.nome}" e está dentro de "${dentroDe?.nome ?? "nenhuma"}"`,
      );
    }
  }
}

if (conferidas === 0) {
  problemas++;
  console.log("  FALHOU  nenhuma chamada encontrada. Isto é erro, não sucesso.");
} else if (problemas === 0) {
  console.log(`  ok      ${conferidas} chamada(s), todas com o nome da própria action`);
}

// ---------------------------------------------------------------------------
// A TRADUCAO DE "SCHEMA DESATUALIZADO" NAO PODE ENGOLIR RECUSA DE VERDADE
//
// `falha()` passou a trocar a mensagem do PostgREST -- "Could not find the
// function ... in the schema cache" -- por uma frase que diz que a migration
// nao rodou. A mensagem crua e exata e inutil, e foi o que o usuario leu
// tentando abrir um mes de social.
//
// O risco nao e ela deixar de casar: aí a pessoa volta a ver o texto em
// ingles, que e ruim e visivel. O risco e ela casar DEMAIS -- e aí uma recusa
// de verdade ("esta demanda tem etapa sem aprovacao", que carrega os nomes que
// o `hint` do banco escreveu) some e vira "rode uma migration". Uma tela que
// manda a pessoa mexer no banco por causa de uma regra de negocio e pior que
// uma mensagem em ingles.
//
// Por isso os dois sentidos, e por isso as recusas de verdade sao as REAIS,
// copiadas das travas do produto.
// ---------------------------------------------------------------------------
console.log("\nA traducao de schema desatualizado casa com o certo, e so com ele\n");

const fonteDaTraducao = await readFile("src/lib/acoes/migration-pendente.ts", "utf8");
const pastaT = await mkdtemp(join(tmpdir(), "fh-mig-"));
const copiaT = join(pastaT, "mp.ts");
await writeFile(copiaT, fonteDaTraducao.replace(/^import "server-only";\n/, ""));

try {
  const { ehMigrationPendente } = await import(pathToFileURL(copiaT).href);

  const TEM_QUE_CASAR = [
    "Could not find the function public.abrir_mes_de_social(p_client_id, p_mes, p_prazos, p_quantidades, p_responsaveis, p_responsavel_id) in the schema cache",
    "Could not find the 'prazo_offset_dias' column of 'post_etapas' in the schema cache",
  ];

  const NAO_PODE_CASAR = [
    "Esta demanda tem 3 etapas sem aprovação: Conceito, Layout, Revisão.",
    "Ninguém envia ao cliente a própria entrega.",
    "A rodada é criada pela ação Enviar para aprovação",
    "Task não encontrada.",
    "new row violates row-level security policy for table \"tasks\"",
    "Cliente não encontrado.",
    // O CASO QUE SEPARA AS DUAS METADES DO MATCHER: fala de cache e nao e
    // schema desatualizado. So "schema cache" casaria; so "could not find"
    // tambem.
    "Não foi possível limpar o cache desta tela.",
    "Could not find the client in the list.",
  ];

  for (const m of TEM_QUE_CASAR) {
    const certo = ehMigrationPendente(m);
    if (!certo) problemas++;
    console.log(`  ${certo ? "ok     " : "FALHOU "} casa: ${m.slice(0, 70)}…`);
  }
  for (const m of NAO_PODE_CASAR) {
    const certo = !ehMigrationPendente(m);
    if (!certo) problemas++;
    console.log(`  ${certo ? "ok     " : "FALHOU "} NAO casa: ${m.slice(0, 70)}`);
  }
} finally {
  await rm(pastaT, { recursive: true, force: true });
}

console.log("");
if (problemas > 0) {
  console.log(`${problemas} problema(s).\n`);
  process.exit(1);
}
console.log("Tudo certo.\n");
