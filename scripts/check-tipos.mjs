#!/usr/bin/env node
/**
 * O `database.types.ts` acompanha as migrations?
 *
 * ---------------------------------------------------------------------------
 * O CABEÇALHO DO PRÓPRIO ARQUIVO DIZ QUE ELE DEVERIA SER GERADO:
 *
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * E ele nunca foi — a geração pede credencial do projeto, e desde o Sprint 0 o
 * arquivo é escrito à mão, tabela por tabela. Trinta e uma migrations depois,
 * ele cobre setenta tabelas e algumas centenas de colunas mantidas por
 * digitação.
 *
 * **UMA COLUNA QUE EXISTE NO BANCO E NÃO NO TIPO NÃO QUEBRA NADA AQUI.** Ela
 * atravessa o `tsc`, o `lint` e o `build` — porque o tipo é a fonte da verdade
 * para o TypeScript, e o TypeScript não conhece o Postgres. O erro nasce em
 * produção, e sai como *"Could not find the 'x' column of 'y' in the schema
 * cache"* ou, pior, como um `select` que o PostgREST recusa INTEIRO: aí a
 * leitura volta vazia e a tela diz "nenhum resultado" com toda a confiança.
 * Foi assim que uma campanha recém-criada não aparecia em lugar nenhum.
 *
 * **E o caminho contrário é o mais difícil de achar:** uma coluna no tipo que
 * o banco não tem. Ela compila, o editor a autocompleta, e a recusa chega na
 * tela de quem usa o sistema.
 *
 * Esta checagem não gera nada nem consulta banco nenhum. Ela lê as migrations
 * como quem as aplicaria — `create table`, `add column`, `drop column`, `drop
 * table`, `rename` — e confere o resultado contra o tipo. É o que o
 * `check:migrations` faz com o `onde-esta-o-banco.sql`: a resposta certa é
 * conferida toda vez, não uma vez.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;
const MIGRATIONS = join(RAIZ, "supabase/migrations");
const TIPOS = join(RAIZ, "src/lib/supabase/database.types.ts");

let problemas = 0;
const secao = (t) => console.log(`\n${t}\n`);
const ok = (t) => console.log(`  ok      ${t}`);
const isenta = (t) => console.log(`  isenta  ${t}`);
const falha = (t, d) => {
  console.log(`  FALHA   ${t}`);
  if (d) for (const l of d.split("\n")) console.log(`          ${l}`);
  problemas += 1;
};

// ---------------------------------------------------------------------------
// O que as migrations criam, lidas na ordem em que alguém as aplica
//
// TIRAR OS COMENTÁRIOS ANTES É O PASSO QUE NÃO DÁ PARA PULAR. Este repositório
// explica cada decisão dentro do SQL, e vários comentários CITAM o comando que
// discutem -- "a 0023 apagou `tasks.exigencia_aprovacao`", "a 0044 tirou a
// trava". Lidos como SQL, eles apagariam coluna que está de pé e criariam
// tabela que nunca existiu. É a armadilha que a lista de nomes mortos já pagou
// três vezes, do outro lado.
// ---------------------------------------------------------------------------
function semComentarios(sql) {
  // Os blocos `/* */` primeiro, e só depois as linhas `--`: invertido, um `--`
  // dentro de um bloco cortaria a linha e deixaria o `*/` órfão.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((linha) => {
      // Um `--` dentro de string literal não é comentário. Elas são raras em
      // DDL e nenhuma migration deste projeto tem uma, mas a varredura precisa
      // não depender disso: quem conta as aspas é este laço.
      let dentro = null;
      for (let i = 0; i < linha.length; i += 1) {
        const c = linha[i];
        if (dentro) {
          if (c === dentro) dentro = null;
        } else if (c === "'" || c === '"') {
          dentro = c;
        } else if (c === "-" && linha[i + 1] === "-") {
          return linha.slice(0, i);
        }
      }
      return linha;
    })
    .join("\n");
}

/** As colunas de um `create table`, do miolo dos parênteses. */
function colunasDoCorpo(corpo) {
  const colunas = [];
  let nivel = 0;
  let atual = "";
  const pedacos = [];
  for (const c of corpo) {
    if (c === "(") nivel += 1;
    if (c === ")") nivel -= 1;
    if (c === "," && nivel === 0) {
      pedacos.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  pedacos.push(atual);

  for (const bruto of pedacos) {
    const pedaco = bruto.trim().replace(/\s+/g, " ");
    if (!pedaco) continue;
    // Restrição de tabela, e não coluna. `check (...)` sem nome também entra
    // aqui -- por isso `check` está na lista.
    if (/^(constraint|primary key|unique|foreign key|check|exclude)\b/i.test(pedaco)) continue;
    const m = pedaco.match(/^([a-z_][a-z0-9_]*)\s/i);
    if (m) colunas.push(m[1].toLowerCase());
  }
  return colunas;
}

const tabelas = new Map(); // nome -> Set de colunas
const enums = new Set();
const arquivos = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

for (const arquivo of arquivos) {
  const sql = semComentarios(readFileSync(join(MIGRATIONS, arquivo), "utf8"));

  // create table [if not exists] [public.]x ( ... );
  for (const m of sql.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi,
  )) {
    const nome = m[1].toLowerCase();
    // Fecha o parêntese contando níveis: um `check (x in (...))` dentro do
    // corpo faz um `.*?\)` casar no lugar errado, e aí metade das colunas
    // desaparece sem erro nenhum.
    let i = m.index + m[0].length;
    let nivel = 1;
    while (i < sql.length && nivel > 0) {
      if (sql[i] === "(") nivel += 1;
      else if (sql[i] === ")") nivel -= 1;
      i += 1;
    }
    const corpo = sql.slice(m.index + m[0].length, i - 1);
    if (!tabelas.has(nome)) tabelas.set(nome, new Set());
    for (const coluna of colunasDoCorpo(corpo)) tabelas.get(nome).add(coluna);
  }

  // ALTER TABLE x <cláusula>, <cláusula>, ...;
  //
  // UM `alter table` CARREGA VÁRIAS CLÁUSULAS SEPARADAS POR VÍRGULA, e a
  // primeira versão desta varredura só lia a de cima -- a 0070 acrescenta
  // quatro colunas de uma vez e ela viu uma. As três que faltaram apareceram
  // como "declarada no Row e ausente do banco", que é o achado mais grave da
  // lista: eu ia atrás de um furo de produção e o furo era do leitor.
  //
  // Por isso a instrução é cortada inteira, até o `;`, e as cláusulas são lidas
  // uma a uma.
  for (const m of sql.matchAll(
    /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+([\s\S]*?);/gi,
  )) {
    const nome = m[1].toLowerCase();
    const instrucao = m[2];

    // A vírgula de nível zero: `references x (a, b)` e `check (x in (...))`
    // trazem vírgula dentro de parênteses, e cortar por elas partiria a
    // cláusula no meio.
    const clausulas = [];
    let nivel = 0;
    let atual = "";
    for (const c of instrucao) {
      if (c === "(") nivel += 1;
      else if (c === ")") nivel -= 1;
      if (c === "," && nivel === 0) {
        clausulas.push(atual);
        atual = "";
        continue;
      }
      atual += c;
    }
    clausulas.push(atual);

    for (const bruta of clausulas) {
      const clausula = bruta.trim().replace(/\s+/g, " ");

      const add = clausula.match(
        /^add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/i,
      );
      if (add) {
        if (!tabelas.has(nome)) tabelas.set(nome, new Set());
        tabelas.get(nome).add(add[1].toLowerCase());
        continue;
      }

      const drop = clausula.match(
        /^drop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/i,
      );
      if (drop) {
        tabelas.get(nome)?.delete(drop[1].toLowerCase());
        continue;
      }

      const rename = clausula.match(
        /^rename\s+column\s+([a-z_][a-z0-9_]*)\s+to\s+([a-z_][a-z0-9_]*)/i,
      );
      if (rename) {
        const t = tabelas.get(nome);
        if (t) {
          t.delete(rename[1].toLowerCase());
          t.add(rename[2].toLowerCase());
        }
      }
    }
  }

  // drop table [if exists] x
  for (const m of sql.matchAll(
    /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  )) {
    tabelas.delete(m[1].toLowerCase());
  }

  for (const m of sql.matchAll(
    /create\s+type\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+as\s+enum/gi,
  )) {
    enums.add(m[1].toLowerCase());
  }

  // `DROP TYPE`, e ele ACONTECE aqui: a 0023 apagou `exigencia_aprovacao`
  // inteiro, tipo e coluna. É o contrário de `cancelada` e de `pf_tipo`, que
  // ficaram porque `alter type ... drop value` não existe no Postgres -- tipo
  // sem quem o use sai, valor dentro de um tipo em uso não sai. Sem esta linha
  // a varredura cobraria do TypeScript um enum que o banco não tem mais.
  for (const m of sql.matchAll(
    /drop\s+type\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
  )) {
    enums.delete(m[1].toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// O que o database.types.ts declara
// ---------------------------------------------------------------------------
const fonte = readFileSync(TIPOS, "utf8");
const exportados = new Set();

/** O miolo de `chave: {` ... `}`, contando chaves. */
function bloco(texto, chave, desde = 0) {
  const abre = texto.indexOf(`${chave}: {`, desde);
  if (abre === -1) return null;
  let i = texto.indexOf("{", abre);
  let nivel = 0;
  const inicio = i;
  while (i < texto.length) {
    if (texto[i] === "{") nivel += 1;
    else if (texto[i] === "}") {
      nivel -= 1;
      if (nivel === 0) return { corpo: texto.slice(inicio + 1, i), fim: i };
    }
    i += 1;
  }
  return null;
}

/** As chaves do primeiro nível de um bloco, ignorando comentários e aninhados. */
function chavesDoNivel(corpo) {
  const chaves = [];
  let nivel = 0;
  let i = 0;
  let inicioDeLinha = true;
  let atual = "";
  while (i < corpo.length) {
    // Comentário de bloco: os `/** ... */` que explicam cada coluna trariam
    // palavra qualquer como se fosse nome de chave.
    if (corpo.startsWith("/*", i)) {
      const fim = corpo.indexOf("*/", i);
      i = fim === -1 ? corpo.length : fim + 2;
      continue;
    }
    if (corpo.startsWith("//", i)) {
      const fim = corpo.indexOf("\n", i);
      i = fim === -1 ? corpo.length : fim;
      continue;
    }
    const c = corpo[i];
    if (c === "{" || c === "[" || c === "(") nivel += 1;
    else if (c === "}" || c === "]" || c === ")") nivel -= 1;
    else if (nivel === 0) {
      if (c === "\n" || c === ";") {
        inicioDeLinha = true;
        atual = "";
        i += 1;
        continue;
      }
      if (inicioDeLinha && /[a-z_"]/i.test(c)) {
        const m = corpo.slice(i).match(/^"?([a-z_][a-z0-9_]*)"?\s*\??\s*:/i);
        if (m) {
          chaves.push(m[1].toLowerCase());
          inicioDeLinha = false;
          i += m[0].length;
          continue;
        }
        inicioDeLinha = false;
      }
      if (!/\s/.test(c)) inicioDeLinha = false;
    }
    i += 1;
    void atual;
  }
  return chaves;
}

const blocoTabelas = bloco(fonte, "    Tables");
if (!blocoTabelas) {
  falha("não achei o bloco Tables do database.types.ts", "o formato do arquivo mudou");
}
const blocoEnums = bloco(fonte, "    Enums");
const blocoViews = bloco(fonte, "    Views");

const declaradas = new Map(); // tabela -> Set de colunas do Row
if (blocoTabelas) {
  for (const nome of chavesDoNivel(blocoTabelas.corpo)) {
    const b = bloco(blocoTabelas.corpo, `      ${nome}`);
    const row = b ? bloco(b.corpo, "        Row") : null;
    declaradas.set(nome, new Set(row ? chavesDoNivel(row.corpo) : []));
  }
}
const viewsDeclaradas = new Set(blocoViews ? chavesDoNivel(blocoViews.corpo) : []);

// O ENUM É DECLARADO DUAS VEZES NESTE ARQUIVO, e as duas contam. O bloco
// `Enums:` é a forma que o gerador do Supabase produz; o `export type NfStatus =
// ...` no topo é a que este arquivo usa de verdade, porque é o nome que as telas
// importam. Cobrar só o bloco acusaria oito enums que estão todos lá, com outro
// nome -- e a varredura que acusa o que existe é a que a equipe aprende a
// ignorar.
const enumsDeclarados = new Set(blocoEnums ? chavesDoNivel(blocoEnums.corpo) : []);
const pascal = (nome) =>
  nome
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
for (const m of fonte.matchAll(/^export type ([A-Za-z0-9]+)\s*=/gm)) {
  exportados.add(m[1]);
}

// ---------------------------------------------------------------------------
// TABELA QUE O BANCO TEM E O TIPO NÃO
//
// A leitura dela não compila -- `supabase.from("x")` com `x` fora do tipo é
// erro de tipo --, então esta metade não pega bug de produção: ela pega MÓDULO
// QUE NÃO EXISTE. Uma tabela criada por migration que nenhuma tela lê é uma
// ponte construída e nunca atravessada, e este produto já tem NOVE delas
// registradas em CLAUDE.md.
// ---------------------------------------------------------------------------
//
// E UMA TABELA PODE LEGITIMAMENTE NÃO ESTAR NO TIPO: a que só se alcança por
// RPC. Ela precisa de MOTIVO ESCRITO e não de silêncio -- é a decisão do
// `-- SEM LINHA: 0026` no `onde-esta-o-banco.sql`: acrescentar uma tabela aqui
// é uma escolha, esquecê-la não.
const SO_POR_RPC = {
  rate_limits:
    "o contador do limite de tentativas (0056). RLS ligada e NENHUMA policy, de " +
    "propósito: a única porta são `consumir_tentativa()` e `perdoar_tentativas()`, " +
    "chamadas com a chave de serviço. Um tipo aqui ofereceria `from(\"rate_limits\")` " +
    "a quem lê o autocompletar, e o `select` voltaria vazio -- que é " +
    "indistinguível de \"ninguém tentou\".",
};

secao("Tabela criada por migration e ausente do tipo");
{
  const faltando = [...tabelas.keys()]
    .filter((t) => !declaradas.has(t) && !viewsDeclaradas.has(t) && !(t in SO_POR_RPC))
    .sort();
  for (const [tabela, motivo] of Object.entries(SO_POR_RPC)) {
    if (tabelas.has(tabela)) isenta(`${tabela}: ${motivo}`);
  }
  if (faltando.length === 0) {
    ok(`as ${tabelas.size} tabelas das migrations têm entrada no tipo`);
  } else {
    falha(
      `${faltando.length} tabela(s) sem entrada`,
      `${faltando.join(", ")}\n` +
        "Nenhuma tela as lê -- `from(\"x\")` fora do tipo é erro de tipo.\n" +
        "Ou a tabela é uma ponte que ninguém atravessou, ou o tipo ficou atrás.",
    );
  }
}

// ---------------------------------------------------------------------------
// COLUNA QUE O BANCO TEM E O `Row` NÃO
//
// Esta é a que dói. O `select("*")` traz a coluna e o TypeScript não a conhece:
// ninguém a usa, e o campo fica invisível no produto -- foi o caso de
// `clients.logo_url`, doze sprints como campo de anotação.
// ---------------------------------------------------------------------------
secao("Coluna do banco ausente do Row");
{
  const achados = [];
  for (const [tabela, colunas] of tabelas) {
    const row = declaradas.get(tabela);
    if (!row || row.size === 0) continue; // tabela sem entrada: já acusada acima
    for (const coluna of colunas) {
      if (!row.has(coluna)) achados.push(`${tabela}.${coluna}`);
    }
  }
  if (achados.length === 0) {
    ok("todo Row cobre as colunas que as migrations criam");
  } else {
    falha(
      `${achados.length} coluna(s) fora do Row`,
      `${achados.sort().join("\n")}\n` +
        "O `select(\"*\")` traz a coluna e o TypeScript não a conhece: o campo\n" +
        "fica invisível no produto sem nada quebrar.",
    );
  }
}

// ---------------------------------------------------------------------------
// COLUNA QUE O `Row` TEM E O BANCO NÃO
//
// A pior das três, porque compila e o editor a autocompleta: a recusa chega na
// tela de quem usa o sistema, como *"Could not find the 'x' column"* -- ou como
// um `select` recusado INTEIRO, e aí a lista volta vazia e a tela afirma
// "nenhum resultado" com toda a confiança.
// ---------------------------------------------------------------------------
secao("Coluna declarada no Row e ausente do banco");
{
  const achados = [];
  for (const [tabela, row] of declaradas) {
    const colunas = tabelas.get(tabela);
    if (!colunas) continue; // view, ou tabela que a varredura não entendeu
    for (const coluna of row) {
      if (!colunas.has(coluna)) achados.push(`${tabela}.${coluna}`);
    }
  }
  if (achados.length === 0) {
    ok("todo Row só declara coluna que alguma migration cria");
  } else {
    falha(
      `${achados.length} coluna(s) que o banco não tem`,
      `${achados.sort().join("\n")}\n` +
        "Compila, autocompleta, e a recusa chega na tela de quem usa o sistema.",
    );
  }
}

// ---------------------------------------------------------------------------
// ENUM
//
// Só a existência, e não os valores: um valor a mais no enum do banco é caso
// NORMAL neste produto -- `cancelada` em `task_status` e `pf_tipo` continuam lá
// porque `alter type ... drop value` não existe no Postgres, e o TypeScript
// deve mesmo ignorá-los.
// ---------------------------------------------------------------------------
secao("Enum criado por migration e ausente do tipo");
{
  const faltando = [...enums]
    .filter((e) => !enumsDeclarados.has(e) && !exportados.has(pascal(e)))
    .sort();
  if (faltando.length === 0) {
    ok(`os ${enums.size} enums das migrations têm entrada no tipo`);
  } else {
    falha(`${faltando.length} enum(s) sem entrada`, faltando.join(", "));
  }
  isenta("os VALORES de cada enum não são conferidos: valor órfão é normal aqui");
}

// ---------------------------------------------------------------------------
// A TERCEIRA PERGUNTA: O ARGUMENTO DA RPC EXISTE?
//
// As duas seções de cima cuidam de COLUNA. Esta cuida de PARÂMETRO DE FUNÇÃO, e
// ela nasceu de um bug que chegou na tela de quem usa o sistema: a tela de
// Registrar período respondia *"Could not find the function
// public.lancar_periodo(p_ano_referencia, …) in the schema cache"*. A 0039
// tinha tirado `p_ano_referencia` das três funções que o recebiam, o
// `database.types.ts` estava CERTO — quem ficou para trás foi a chamada.
//
// **E o TypeScript não pega, o que é o ponto inteiro desta seção.** A
// assinatura do `rpc` no postgrest-js é
//
//   rpc<FnName, Args extends Schema["Functions"][FnName]["Args"] = never>(
//     fn: FnName, args?: Args, …)
//
// e `args?: Args` é sítio de INFERÊNCIA: o TypeScript lê o tipo do literal que
// foi passado e só confere que ele satisfaz a restrição. Um objeto com uma
// chave A MAIS satisfaz — a checagem de propriedade excedente não vale quando o
// alvo é um parâmetro de tipo nu. Então `npm run typecheck`, `lint` e `build`
// passam os três, e o PostgREST — que resolve função por NOME MAIS NOMES DOS
// ARGUMENTOS — responde que não existe função nenhuma com aquela assinatura.
//
// É o mesmo modo de falha das duas seções acima, um andar abaixo: compila, o
// editor autocompleta, e a recusa é da pessoa que clicou.
//
// As três comparações fecham a corrente migration → tipo → chamada. Quebrar
// qualquer elo cai aqui.
// ---------------------------------------------------------------------------

/** Os parâmetros de cada função viva nas migrations, na ordem de aplicação. */
function assinaturasDasMigrations() {
  const vivas = new Map(); // nome -> [parametros]
  for (const arquivo of arquivos) {
    const sql = semComentarios(readFileSync(join(MIGRATIONS, arquivo), "utf8"));

    // O `drop` vem antes do `create` no mesmo arquivo quando a aridade muda --
    // é o que a 0039 faz de propósito, para não criar uma sobrecarga que a
    // chamada antiga continuaria resolvendo. Então os dois são lidos na ordem
    // em que aparecem, e não em dois passes.
    const eventos = [...sql.matchAll(
      /\b(create\s+(?:or\s+replace\s+)?function|drop\s+function(?:\s+if\s+exists)?)\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi,
    )];

    for (const ev of eventos) {
      const nome = ev[2].toLowerCase();
      const ehDrop = /^drop/i.test(ev[1]);
      // A lista de parâmetros, contando parênteses: um `default` pode trazer
      // chamada de função dentro, e cortar no primeiro `)` partiria a lista.
      let i = ev.index + ev[0].length;
      let nivel = 1;
      const inicio = i;
      while (i < sql.length && nivel > 0) {
        if (sql[i] === "(") nivel += 1;
        else if (sql[i] === ")") nivel -= 1;
        i += 1;
      }
      if (nivel !== 0) continue;
      const lista = sql.slice(inicio, i - 1);

      if (ehDrop) {
        vivas.delete(nome);
        continue;
      }

      // Cada parâmetro é `nome tipo [default ...]`. O `drop` traz só os tipos,
      // e por isso ele não chega aqui.
      const parametros = [];
      let profundidade = 0;
      let atual = "";
      for (const c of lista) {
        if (c === "(") profundidade += 1;
        if (c === ")") profundidade -= 1;
        if (c === "," && profundidade === 0) {
          parametros.push(atual);
          atual = "";
        } else atual += c;
      }
      parametros.push(atual);

      vivas.set(
        nome,
        parametros
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            // `out`/`inout` viriam antes do nome; nenhuma função deste projeto
            // usa, e ignorá-las daria um parâmetro chamado "out".
            const limpo = p.replace(/^(in|out|inout|variadic)\s+/i, "");
            const m = limpo.match(/^([a-z_][a-z0-9_]*)\s+\S/i);
            return m ? m[1].toLowerCase() : null;
          })
          .filter(Boolean),
      );
    }
  }
  return vivas;
}

/** O que o `Functions` do tipo declara: nome -> Set de argumentos. */
function funcoesDoTipo(corpo) {
  const mapa = new Map();
  let i = 0;
  let nivel = 0;
  while (i < corpo.length) {
    if (corpo.startsWith("/*", i)) {
      const fim = corpo.indexOf("*/", i);
      i = fim === -1 ? corpo.length : fim + 2;
      continue;
    }
    if (corpo.startsWith("//", i)) {
      const fim = corpo.indexOf("\n", i);
      i = fim === -1 ? corpo.length : fim;
      continue;
    }
    if (nivel === 0) {
      const m = corpo.slice(i).match(/^([a-z_][a-z0-9_]*)\s*:\s*\{/i);
      if (m) {
        const nome = m[1].toLowerCase();
        const corpoDaFuncao = bloco(corpo, `${m[1]}`, i);
        if (corpoDaFuncao) {
          const dentro = corpoDaFuncao.corpo;
          if (/Args:\s*Record<string,\s*never>/.test(dentro)) {
            mapa.set(nome, new Set());
          } else {
            const args = bloco(dentro, "Args");
            mapa.set(nome, new Set(args ? chavesDoNivel(args.corpo) : []));
          }
          i = corpoDaFuncao.fim + 1;
          continue;
        }
      }
    }
    if (corpo[i] === "{") nivel += 1;
    else if (corpo[i] === "}") nivel -= 1;
    i += 1;
  }
  return mapa;
}

/** Todo `.rpc("nome", { ... })` de `src/`, com as chaves que ele manda. */
function chamadasDeRpc() {
  const achados = [];
  const arquivosTs = [];
  (function andar(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, item.name);
      if (item.isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(item.name)) arquivosTs.push(caminho);
    }
  })(join(RAIZ, "src"));

  for (const caminho of arquivosTs) {
    const texto = readFileSync(caminho, "utf8");
    for (const m of texto.matchAll(/\.rpc\(\s*"([a-z_][a-z0-9_]*)"\s*,\s*\{/gi)) {
      let i = m.index + m[0].length - 1;
      let nivel = 0;
      const inicio = i;
      while (i < texto.length) {
        if (texto[i] === "{") nivel += 1;
        else if (texto[i] === "}") {
          nivel -= 1;
          if (nivel === 0) break;
        }
        i += 1;
      }
      achados.push({
        arquivo: caminho.slice(RAIZ.length),
        linha: texto.slice(0, m.index).split("\n").length,
        nome: m[1].toLowerCase(),
        chaves: chavesDoNivel(texto.slice(inicio + 1, i)),
      });
    }
    // A chamada SEM objeto nenhum -- `rpc("is_staff")` -- não manda chave, e
    // não pode virar "função sem chamada": ela é o caso normal das funções de
    // `Args: Record<string, never>`.
    for (const m of texto.matchAll(/\.rpc\(\s*"([a-z_][a-z0-9_]*)"\s*\)/gi)) {
      achados.push({
        arquivo: caminho.slice(RAIZ.length),
        linha: texto.slice(0, m.index).split("\n").length,
        nome: m[1].toLowerCase(),
        chaves: [],
      });
    }
  }
  return achados;
}

const blocoFuncoes = bloco(fonte, "    Functions");
const funcoesDeclaradas = blocoFuncoes ? funcoesDoTipo(blocoFuncoes.corpo) : new Map();
const funcoesDoBanco = assinaturasDasMigrations();

secao("Argumento declarado no tipo e ausente da função no banco");
if (!blocoFuncoes) {
  falha("não achei o bloco Functions do database.types.ts", "o formato do arquivo mudou");
} else {
  let achou = 0;
  for (const [nome, args] of [...funcoesDeclaradas].sort()) {
    const noBanco = funcoesDoBanco.get(nome);
    // A função que nenhuma migration cria não é conferida aqui: é `auth.uid()`
    // e companhia, e uma checagem que reclama delas vira uma lista que ninguém
    // lê.
    if (!noBanco) continue;
    const sobrando = [...args].filter((a) => !noBanco.includes(a));
    if (sobrando.length) {
      falha(
        `${nome}: ${sobrando.join(", ")}`,
        "o tipo declara, o banco não tem. Compila, autocompleta, e o PostgREST " +
          "recusa a chamada inteira: resolve função por nome MAIS nomes dos argumentos.",
      );
      achou += 1;
    }
  }
  if (achou === 0) ok(`${funcoesDeclaradas.size} função(ões) conferida(s)`);
}

// E UM PARÂMETRO PODE LEGITIMAMENTE FICAR DE FORA DO TIPO: aquele cujo default
// é a única resposta que a tela tem o direito de dar. Ele precisa de MOTIVO
// ESCRITO e não de silêncio -- é a mesma decisão do `SO_POR_RPC` acima e do
// `-- SEM LINHA: 0026` do `onde-esta-o-banco.sql`. Tirar um parâmetro daqui é
// uma escolha; esquecê-lo não é.
const DEFAULT_E_A_RESPOSTA = {
  "lancar_periodo.p_origem":
    "o default é `lancamento_retroativo`, que é o único valor que a tela lança. " +
    "Oferecê-lo no tipo poria `solicitacao` ao alcance de um autocompletar -- e " +
    "a função recusa esse valor na segunda linha, porque pedido normal passa " +
    "pela aba Solicitar. Importar arquivo, se um dia existir, é outro caminho.",
};

secao("Parâmetro da função no banco e ausente do tipo");
{
  let achou = 0;
  for (const [nome, args] of [...funcoesDeclaradas].sort()) {
    const noBanco = funcoesDoBanco.get(nome);
    if (!noBanco) continue;
    for (const p of noBanco) {
      const motivo = DEFAULT_E_A_RESPOSTA[`${nome}.${p}`];
      if (motivo && !args.has(p)) isenta(`${nome}.${p}: ${motivo}`);
    }
    const faltando = noBanco.filter(
      (p) => !args.has(p) && !DEFAULT_E_A_RESPOSTA[`${nome}.${p}`],
    );
    if (faltando.length) {
      falha(
        `${nome}: ${faltando.join(", ")}`,
        "o banco aceita, o tipo não oferece. Nenhuma tela consegue mandá-lo, e " +
          "o parâmetro fica sendo o default da função sem ninguém ver.",
      );
      achou += 1;
    }
  }
  if (achou === 0) ok("nenhum parâmetro invisível ao produto");
}

secao("Chamada que manda argumento que o tipo não declara");
{
  const chamadas = chamadasDeRpc();
  let achou = 0;
  for (const c of chamadas) {
    const args = funcoesDeclaradas.get(c.nome);
    if (!args) {
      falha(
        `${c.arquivo}:${c.linha} chama ${c.nome}`,
        "e o database.types.ts não declara essa função.",
      );
      achou += 1;
      continue;
    }
    const sobrando = c.chaves.filter((k) => !args.has(k));
    if (sobrando.length) {
      falha(
        `${c.arquivo}:${c.linha} ${c.nome}: ${sobrando.join(", ")}`,
        "`args?: Args` é sítio de inferência, então chave a mais NÃO é erro de " +
          "tipo -- passa no typecheck, no lint e no build, e o PostgREST responde " +
          "\"could not find the function ... in the schema cache\".",
      );
      achou += 1;
    }
  }
  if (achou === 0) ok(`${chamadas.length} chamada(s) de RPC conferida(s)`);
}

console.log(problemas === 0 ? "\nTudo certo.\n" : `\n${problemas} problema(s).\n`);
process.exit(problemas === 0 ? 0 : 1);
