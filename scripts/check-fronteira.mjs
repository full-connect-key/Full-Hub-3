/**
 * A fronteira servidor/cliente: quem chama o quê.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA VARREDURA PROCURA, E POR QUE ELA PRECISA EXISTIR
 *
 * **Valor exportado de arquivo `"use client"` não vale no servidor.** O que o
 * Next entrega a um Server Component não é a função nem o array: é uma
 * referência de cliente. Chamá-la estoura em tempo de REQUISIÇÃO, com
 *
 *     Attempted to call ehAba() from the server but ehAba is on the client.
 *
 * e a página inteira devolve 500.
 *
 * **E nada disso aparece antes.** `npm run build`, `npm run lint` e
 * `npx tsc --noEmit` passam os três: o tipo está certo, o import existe, o
 * módulo resolve. O erro só nasce quando alguém PEDE a página. Foi assim que
 * Gestão de Pessoas ficou fora do ar — quem encontrou foi o usuário, clicando
 * no menu, e a imagem do protótipo mostrava a mesma tela de erro sem dizer a
 * causa, porque o log do servidor ia para /dev/null.
 *
 * ---------------------------------------------------------------------------
 * O CRITÉRIO: COMPONENTE SIM, VALOR NÃO
 *
 * Importar um COMPONENTE cliente num Server Component é o padrão certo e o
 * projeto faz isso em toda página — o servidor não o chama, ele o renderiza.
 * O que quebra é o servidor CHAMAR uma função ou LER uma constante.
 *
 * A varredura separa os dois pela convenção de nome, que neste projeto é
 * firme: componente começa com maiúscula (`AbasDePessoas`), função e
 * constante não (`ehAba`, `ABAS` — que é maiúscula inteira, e é por isso que
 * a regra olha SÓ a primeira letra contra a segunda).
 *
 * `import type` e membros `type X` não contam: tipo é apagado na compilação.
 *
 * A saída é mover o valor para um módulo SEM DIRETIVA NENHUMA, ao lado dos
 * dois — `financeiro/vocabulario.ts` e `pessoas/vocabulario.ts` são os
 * exemplos. Tipo pode continuar no arquivo cliente.
 *
 * ---------------------------------------------------------------------------
 * E HÁ O SENTIDO CONTRÁRIO, que esta varredura passou doze sprints sem olhar
 *
 * **Valor de módulo `server-only` importado por arquivo `"use client"` não
 * compila.** Um `import type` é apagado e atravessa; um VALOR arrasta o módulo
 * inteiro — com o `import "server-only"` dentro — para o bundle do navegador, e
 * aí o `npm run build` recusa:
 *
 *     You're importing a module that depends on "server-only". This API is
 *     only available in Server Components in the App Router.
 *
 * **Então por que uma varredura, se o build pega?** Porque o build é o ÚLTIMO
 * passo do `verificar.yml` e leva um minuto e meio — e quem trabalha numa tela
 * roda os `check:` e o `tsc`, que passam os três. Foi assim que a pauta da
 * equipe (0147) subiu com o build quebrado: `MINIMO_DA_BUSCA` era uma segunda
 * cópia do piso de duas letras, declarada em `lib/dados/` em vez de
 * `lib/dominio/busca.ts`, onde o número já morava — a tela importou o valor, o
 * CI ficou vermelho, e com `needs: verificar` o deploy parou de sair: **sete
 * builds seguidos falharam na Hostinger e o site passou dois dias servindo uma
 * versão velha.**
 *
 * O critério deste lado é mais simples que o de cima: **componente também não
 * passa.** Um Server Component importado por um arquivo cliente é o mesmo
 * problema — o que decide é o módulo entrar no bundle, não o que se faz com o
 * que veio dele. A saída é a mesma: o valor desce para `lib/dominio/`, e o tipo
 * fica onde está, com `import type`.
 *
 * E uma Server Action (`"use server"`) NÃO é server-only: a tela a importa
 * normalmente, porque o que o navegador recebe é uma referência. Quem esta
 * metade olha são os módulos que carregam `import "server-only"` — hoje
 * `lib/dados/`, `lib/supabase/admin.ts` e os vizinhos deles.
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const RAIZ = path.resolve(import.meta.dirname, "..");

const arquivos = execSync("find src -name '*.ts' -o -name '*.tsx'", {
  cwd: RAIZ,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

/**
 * Um arquivo é "de cliente" quando a primeira linha útil é a diretiva, e é
 * "de servidor só" quando ele importa `server-only` — os dois lados da
 * fronteira, lidos numa passada.
 */
const ehCliente = new Map();
const ehServerOnly = new Map();
for (const f of arquivos) {
  const texto = readFileSync(path.join(RAIZ, f), "utf8");
  ehCliente.set(f, /^\s*["']use client["']/.test(texto));
  ehServerOnly.set(f, /^\s*import\s+["']server-only["']/m.test(texto));
}

function resolver(de, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(de), spec));
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (ehCliente.has(base + ext)) return base + ext;
  }
  // O caminho SEM extensão também resolve quando ele é um arquivo listado.
  if (ehCliente.has(base)) return base;
  return null;
}

/**
 * Componente, pela convenção de nome.
 *
 * `AbasDePessoas` é componente; `ehAba` e `ABAS` não são. A distinção olha a
 * PRIMEIRA letra contra a SEGUNDA porque `ABAS` também começa com maiúscula —
 * um nome todo em caixa alta é constante, nunca componente.
 */
function ehComponente(nome) {
  const limpo = nome.split(/\s+as\s+/)[0].trim();
  if (!/^[A-Z]/.test(limpo)) return false;
  return limpo.length === 1 || limpo[1] !== limpo[1].toUpperCase() || /[a-z]/.test(limpo);
}

const RE_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gs;

const achados = [];
for (const f of arquivos) {
  if (ehCliente.get(f)) continue; // um arquivo cliente pode importar à vontade
  const texto = readFileSync(path.join(RAIZ, f), "utf8");
  for (const m of texto.matchAll(RE_IMPORT)) {
    if (m[1]) continue; // import type { ... }
    const alvo = resolver(f, m[3]);
    if (!alvo || !ehCliente.get(alvo)) continue;

    const valores = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !s.startsWith("type "))
      .filter((s) => !ehComponente(s));

    if (valores.length) achados.push({ de: f, alvo, valores });
  }
}

/**
 * O SEGUNDO SENTIDO: arquivo cliente lendo valor de módulo `server-only`.
 *
 * Aqui não há a distinção componente/valor do laço de cima: qualquer import
 * que não seja `type` arrasta o módulo para o bundle, e um Server Component
 * importado pelo cliente é o mesmo problema.
 */
const noCliente = [];
for (const f of arquivos) {
  if (!ehCliente.get(f)) continue;
  const texto = readFileSync(path.join(RAIZ, f), "utf8");
  for (const m of texto.matchAll(RE_IMPORT)) {
    if (m[1]) continue; // import type { ... }
    const alvo = resolver(f, m[3]);
    if (!alvo || !ehServerOnly.get(alvo)) continue;

    const valores = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !s.startsWith("type "));

    if (valores.length) noCliente.push({ de: f, alvo, valores });
  }
}

console.log("\nValor de arquivo cliente importado por arquivo de servidor\n");

if (achados.length === 0) {
  console.log("  ok      nenhum — o servidor só importa COMPONENTES dos arquivos cliente\n");
} else {
  for (const a of achados) {
    console.error(`  FALHA   ${a.de}`);
    console.error(`          importa ${a.valores.join(", ")} de ${a.alvo}`);
  }
  console.error(
    "\n  Isso passa no build, no lint e no tsc, e estoura quando alguém pede a\n" +
      "  página: o servidor recebe uma referência de cliente, não o valor.\n" +
      "  Mova o valor para um módulo sem diretiva ao lado dos dois — veja\n" +
      "  src/app/(interno)/painel/pessoas/vocabulario.ts.\n",
  );
}

console.log("Valor de módulo server-only importado por arquivo cliente\n");

if (noCliente.length === 0) {
  console.log("  ok      nenhum — a tela só importa TIPO dos módulos server-only\n");
} else {
  for (const a of noCliente) {
    console.error(`  FALHA   ${a.de}`);
    console.error(`          importa ${a.valores.join(", ")} de ${a.alvo} (server-only)`);
  }
  console.error(
    "\n  Isso derruba o `npm run build`, que é o último passo do verificar.yml —\n" +
      "  e com `needs: verificar` o deploy para de sair. Um `import type` é\n" +
      "  apagado e atravessa; um VALOR arrasta o módulo inteiro para o bundle.\n" +
      "  Mova o valor para lib/dominio/ e deixe o tipo onde está, com\n" +
      "  `import type` — veja lib/dominio/busca.ts.\n",
  );
}

if (achados.length === 0 && noCliente.length === 0) {
  console.log("Tudo certo.\n");
  process.exit(0);
}
process.exit(1);
