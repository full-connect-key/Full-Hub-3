#!/usr/bin/env node
/**
 * O protótipo troca 28 módulos reais por versões de exemplo, e esta checagem
 * confere que as versões de exemplo continuam tendo o que as telas importam.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA EXISTE: o `npm run typecheck` NÃO vê os stubs.
 *
 * Ele checa `src/` contra os módulos de VERDADE. O protótipo faz a troca só
 * dentro da cópia temporária, então um stub sem um export que a tela usa passa
 * no `typecheck`, passa no `lint`, passa no `build` — e só quebra dentro do
 * `npm run prototipo`, **depois de dois minutos compilando**, no fim de uma
 * rodada de quinze.
 *
 * E o protótipo não está na `verificar.yml`. Quer dizer que o defeito espera
 * alguém rodar um script demorado à mão: na prática, três sprints. Foi assim
 * que `VisitaAoPortal` ficou de fora do stub de `acessos.ts` — o produto
 * inteiro verde, e o gerador de imagens morto.
 *
 * É a mesma família de `check:fronteira`: um erro que atravessa build, lint e
 * tipo, e só aparece quando alguém pede a tela.
 * ---------------------------------------------------------------------------
 *
 * **Ela mede o que `src/` IMPORTA, e não o que o módulo real exporta.**
 *
 * A primeira versão comparava os dois conjuntos de exports e acusou dezoito
 * stubs — com o protótipo compilando sem um arranhão. O motivo é que um
 * módulo de dados exporta muito tipo que só ele usa por dentro, e o stub não
 * tem por que carregá-los. Cobrar simetria seria uma regra sobre como
 * escrever exemplo, não uma checagem de defeito.
 *
 * O que quebra a compilação é exatamente um nome que alguma tela pede e o
 * stub não tem. Então o conjunto certo é o dos `import` de `src/` apontando
 * para aquele alias.
 *
 * **Ela compara NOMES, e não tipos.** Conferir assinatura exigiria rodar o
 * compilador com o alias trocado, que é o que custa os dois minutos. Nome que
 * falta é o erro que acontece: o stub é escrito copiando a forma do módulo, e
 * o que se esquece é acrescentar o export novo.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const RAIZ = path.join(import.meta.dirname, "..");

/** Os exports nomeados de um arquivo, lidos por regex e não pelo compilador. */
function exportados(fonte) {
  const nomes = new Set();

  // `export function X`, `export async function X`, `export const X`,
  // `export type X`, `export class X`, `export enum X`.
  for (const m of fonte.matchAll(
    /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    nomes.add(m[1]);
  }

  // `export { A, B as C }` e `export type { A, B }` — o nome que conta é o de
  // fora. O `type` opcional é o que faltava na primeira versão: os stubs
  // reexportam os tipos do módulo real nessa forma, e sem ele a checagem
  // acusou quinze arquivos que estavam certos. Uma checagem que acusa o
  // inocente é desligada na segunda vez que alguém a roda.
  for (const m of fonte.matchAll(/^export\s+type\s*\{([^}]*)\}|^export\s*\{([^}]*)\}/gm)) {
    for (const parte of (m[1] ?? m[2] ?? "").split(",")) {
      const limpo = parte.trim().replace(/^type\s+/, "");
      if (!limpo) continue;
      const alvo = limpo.includes(" as ") ? limpo.split(" as ")[1] : limpo;
      nomes.add(alvo.trim());
    }
  }

  // A forma antiga, mantida para o `export { x }` de uma linha só sem chaves
  // na mesma linha — o regex acima já a cobre, e este laço vazio sairia se
  // alguém o apagasse achando que é duplicata. Ele não é: o de cima consome a
  // linha inteira, e há stubs com `export {` e a lista na linha seguinte.
  for (const m of fonte.matchAll(/^export\s+(?:type\s+)?\{([\s\S]*?)\}/gm)) {
    for (const parte of m[1].split(",")) {
      const limpo = parte.trim().replace(/^type\s+/, "");
      if (!limpo) continue;
      const alvo = limpo.includes(" as ") ? limpo.split(" as ")[1] : limpo;
      nomes.add(alvo.trim());
    }
  }

  return nomes;
}

async function ler(caminho) {
  try {
    return await readFile(path.join(RAIZ, caminho), "utf8");
  } catch {
    return null;
  }
}

const gerador = await ler("scripts/prototipo.mjs");
if (!gerador) {
  console.error("Não achei scripts/prototipo.mjs.");
  process.exit(1);
}

// O MAPA SAI DO PRÓPRIO GERADOR, e não de uma segunda lista aqui: duas listas
// divergem no dia em que alguém acrescenta um módulo — e a que ficasse para
// trás não conferiria o stub novo, em silêncio.
const bloco = gerador.match(/const SUBSTITUICOES = \{([\s\S]*?)\n\};/);
if (!bloco) {
  console.error("Não achei o mapa SUBSTITUICOES em scripts/prototipo.mjs.");
  process.exit(1);
}

const pares = [...bloco[1].matchAll(/"([^"]+)":\s*\["\.\/([^"]+)"\]/g)].map((m) => ({
  alias: m[1],
  stub: m[2],
}));

/**
 * O que `src/` importa de um alias.
 *
 * Varre os arquivos de uma vez e guarda por alias, em vez de reler `src/` a
 * cada módulo: são vinte e oito aliases, e reler seria vinte e oito varreduras
 * da mesma árvore.
 */
const pedidosPorAlias = new Map();

async function varrerSrc() {
  const { readdir } = await import("node:fs/promises");

  async function andar(dir) {
    for (const entrada of await readdir(dir, { withFileTypes: true })) {
      const cheio = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        await andar(cheio);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name)) continue;

      const fonte = await readFile(cheio, "utf8");
      // `import { a, type B } from "@/..."` e `import type { C } from "@/..."`.
      for (const m of fonte.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
      )) {
        const alvo = m[2];
        const conjunto = pedidosPorAlias.get(alvo) ?? new Set();
        for (const parte of m[1].split(",")) {
          const limpo = parte.trim().replace(/^type\s+/, "");
          if (!limpo) continue;
          conjunto.add((limpo.includes(" as ") ? limpo.split(" as ")[0] : limpo).trim());
        }
        pedidosPorAlias.set(alvo, conjunto);
      }
    }
  }

  await andar(path.join(RAIZ, "src"));
}

await varrerSrc();

const importadosPor = (alias) => pedidosPorAlias.get(alias) ?? new Set();

if (pares.length === 0) {
  console.error("O mapa SUBSTITUICOES veio vazio — o formato mudou?");
  process.exit(1);
}

console.log("\nOs stubs do protótipo acompanham os módulos reais\n");

let problemas = 0;

for (const { alias, stub } of pares) {
  // `@/lib/dados/posts` -> `src/lib/dados/posts`
  const base = `src/${alias.replace(/^@\//, "")}`;
  const real =
    (await ler(`${base}.ts`)) ?? (await ler(`${base}.tsx`)) ?? null;
  const exemplo = await ler(stub);

  if (real === null) {
    console.log(`  FALHA   ${alias} — o módulo real não existe mais, e o stub continua`);
    problemas++;
    continue;
  }
  if (exemplo === null) {
    console.log(`  FALHA   ${alias} — o stub ${stub} não existe`);
    problemas++;
    continue;
  }

  const pedidos = importadosPor(alias);
  const temNoStub = exportados(exemplo);
  const temNoReal = exportados(real);

  // O que `src/` pede e o módulo real nem tem é problema do módulo real, e o
  // `typecheck` já o pega. Aqui só interessa o que existe lá e falta aqui.
  const faltando = [...pedidos].filter((n) => temNoReal.has(n) && !temNoStub.has(n));

  if (faltando.length === 0) {
    console.log(`  ok      ${alias} — ${pedidos.size} nome(s) pedido(s) por src/`);
  } else {
    console.log(`  FALHA   ${alias} — o stub não exporta: ${faltando.join(", ")}`);
    console.log(`          ${stub}`);
    problemas++;
  }
}

// ---------------------------------------------------------------------------
// SEGUNDA PARTE: O SELETOR DE CLIQUE QUE APONTA PARA UM TEXTO QUE NÃO EXISTE
//
// Várias telas do protótipo só aparecem depois de um clique, e o seletor é o
// TEXTO de um botão — `button:has-text("Nova subtarefa")`, `[aria-label=
// "Próximo slide"]`. Quando a tela muda de palavra, o seletor morre: a imagem
// sai assim mesmo, com o nome de uma tela que ela não é.
//
// **O gerador AVISA, e o aviso espera meses.** Ele só sabe disso rodando, e a
// rodada completa leva quinze minutos e não está na `verificar.yml` — foi
// assim que três seletores mortos sobreviveram, um deles apontando para as
// setas de um carrossel que o usuário mandou trocar pela composição inteira.
//
// Esta varredura é a metade barata: se o texto do seletor não aparece em
// `src/` **nem** nos exemplos de `scripts/prototipo/`, ele não pode casar com
// nada, e isso se sabe em menos de um segundo — no CI, em todo push.
//
// **Os exemplos entram na busca de propósito:** metade dos seletores aponta
// para dado semeado (`button:has-text("Criar KV")` é o título de uma etapa do
// stub), e procurar só em `src/` acusaria todos eles.
//
// **E ela NÃO prova que o seletor casa.** Texto presente em algum lugar não é
// botão presente naquela rota, e ambiguidade — o mesmo texto duas vezes na
// mesma tela, que é erro estrito no Playwright — ela não vê. Quem prova é a
// rodada. O que ela pega é a classe que apodrece calada: a palavra que saiu
// do produto.
// ---------------------------------------------------------------------------

/** Os textos literais que dá para extrair de um seletor. */
function textosDoSeletor(seletor) {
  const achados = [];
  for (const m of seletor.matchAll(/:has-text\(\s*["']([^"']+)["']\s*\)/g)) achados.push(m[1]);
  for (const m of seletor.matchAll(/\[aria-label[\^$*]?=\s*["']([^"']+)["']\s*\]/g)) {
    achados.push(m[1]);
  }
  return achados;
}

async function textoDaArvore(raiz, aceita) {
  const { readdir } = await import("node:fs/promises");
  let junto = "";
  async function andar(dir) {
    for (const entrada of await readdir(dir, { withFileTypes: true })) {
      const cheio = path.join(dir, entrada.name);
      if (entrada.isDirectory()) await andar(cheio);
      else if (aceita(entrada.name)) junto += await readFile(cheio, "utf8");
    }
  }
  await andar(raiz);
  return junto;
}

console.log("\nOs cliques do protótipo apontam para texto que existe\n");

// Uma linha de `TELAS` por vez: o nome e o `clicar` daquela linha precisam
// andar juntos para a mensagem dizer QUAL tela tem o seletor morto.
const comClique = [...(gerador ?? "").matchAll(/\{\s*nome:\s*"([^"]+)"[^\n]*?clicar:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)];

const fonte =
  (await textoDaArvore(path.join(RAIZ, "src"), (n) => /\.(tsx?|svg)$/.test(n))) +
  (await textoDaArvore(path.join(RAIZ, "scripts/prototipo"), (n) => /\.tsx?$/.test(n)));

let mortos = 0;
let conferidos = 0;

for (const [, nome, bruto] of comClique) {
  for (const m of bruto.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    const seletor = m[1] ?? m[2];
    for (const texto of textosDoSeletor(seletor)) {
      conferidos++;
      if (!fonte.includes(texto)) {
        console.log(`  FALHA   ${nome} — “${texto}” não existe em src/ nem nos exemplos`);
        mortos++;
      }
    }
  }
}

if (mortos === 0) {
  console.log(`  ok      ${conferidos} texto(s) de clique, todos ainda no produto`);
}

if (problemas > 0 || mortos > 0) {
  if (problemas > 0) {
    console.log(
      `\n${problemas} stub(s) para trás do módulo real. O \`npm run prototipo\` ` +
        `quebraria na compilação, depois de dois minutos — e o \`typecheck\` não vê, ` +
        `porque ele checa contra o módulo de verdade.\n`,
    );
  }
  if (mortos > 0) {
    console.log(
      `\n${mortos} seletor(es) de clique apontando para texto que sumiu. A tela sai ` +
        `assim mesmo,\ncom o nome de uma tela que ela não é — e o gerador só ` +
        `descobre isso na rodada\ncompleta, que leva quinze minutos e não está no CI.\n`,
    );
  }
  process.exit(1);
}

console.log("\nTudo certo.\n");
