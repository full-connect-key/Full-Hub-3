#!/usr/bin/env node
/**
 * Os critérios do Sprint 9 que dizem o que a tela NÃO mostra.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO EXISTE, E POR QUE LÊ HTML E NÃO CÓDIGO-FONTE
 *
 * Metade do que define o Full Academy é uma ausência: **não existe quiz, nota,
 * certificado nem gamificação**. O objetivo é organizar o que a agência já
 * sabe, não medir quem aprendeu — no dia em que a Academy der nota, ninguém
 * mais marca "não vi" e o acompanhamento deixa de dizer a verdade.
 *
 * Ausência não quebra build. Ninguém abre noventa imagens atrás de uma
 * palavra. **Critério que diz "não existe" é o tipo que volta sem ninguém
 * perceber** — e volta pelo caminho mais inocente: alguém acha que um selo de
 * "trilha concluída" anima, e a Academy vira placar.
 *
 * A varredura é do TEXTO RENDERIZADO, não do código. Uma busca no fonte
 * acusaria `DateBadge` por conter "badge" e o comentário que explica a regra
 * por citar as palavras que ela proíbe — é a mesma armadilha que a lista de
 * nomes mortos do `check:cores` já pagou três vezes. O que importa é o que a
 * pessoa lê na tela.
 *
 * ---------------------------------------------------------------------------
 * E ELE RODA NOS DOIS PERFIS, PORQUE UM SÓ PROVARIA MENOS QUE NADA
 *
 * Boa parte destes critérios é sobre o que o COLABORADOR não alcança.
 * Conferindo só como sócio, eles passariam sem nunca ter sido testados — e o
 * relatório diria "ok" justamente sobre a metade que não foi olhada.
 *
 * Por isso as checagens de perfil são de MÃO DUPLA: a aba de gestão tem que
 * estar na tela do sócio **e** faltar na do colaborador. Só a segunda metade
 * passaria numa tela quebrada que não mostra a aba para ninguém.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE NÃO PROVA, e é importante não confundir
 *
 * Os dumps saem do protótipo, que troca `lib/dados/` por dados de exemplo.
 * **Isto não testa RLS** — quem faz isso é `supabase/testes/09_academy_e_
 * recomendacoes.sql`, contra um Postgres de verdade. O que se prova aqui é
 * propriedade de TELA: que vocabulário ela usa, e o que ela oferece a cada
 * perfil. São perguntas diferentes, e as duas precisam de resposta.
 * ---------------------------------------------------------------------------
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DUMPS = path.join(RAIZ, "prototipos", "html");

/**
 * O vocabulário que a Academy não tem.
 *
 * `nota` e `notas` entram com fronteira de palavra: "anotações" — que é
 * justamente o campo privado da Academy — não pode casar, e não casa, porque
 * o "a" antes quebra a fronteira.
 */
const PROIBIDAS = [
  ["quiz", "a Academy não avalia ninguém"],
  ["certificado", "a Academy não emite certificado"],
  ["certificação", "a Academy não emite certificado"],
  ["gamificação", "a Academy organiza conteúdo, não vira placar"],
  ["ranking", "medir quem aprendeu mais é o que faz parar de marcar “não vi”"],
  ["pontuação", "a Academy não dá pontos"],
  ["medalha", "a Academy não premia"],
  ["troféu", "a Academy não premia"],
  ["insígnia", "a Academy não premia"],
  ["nota", "a Academy não dá nota"],
  ["notas", "a Academy não dá nota"],
];

/**
 * O que é da barra lateral e aparece em TODO dump.
 *
 * O HTML é da página inteira, menu incluído, e "Notas Fiscais" é um módulo do
 * produto — a nota que o colaborador manda para a agência pagar, que não tem
 * nada a ver com nota de aluno. Sem esta isenção, toda tela do Full Hub
 * falharia na palavra `notas`, e a checagem viraria ruído no primeiro dia.
 */
const DA_CASCA = ["notas fiscais", "nota fiscal"];

/** As telas do sprint, por perfil de quem as capturou. */
const DO_SPRINT_9 = [
  "80-academy",
  "81-academy-colaborador",
  "82-academy-trilha",
  "83-academy-material-aberto",
  "83b-academy-material-link",
  "84-academy-gestao",
  "85-academy-escuro",
  "86-recomendacoes",
  "86b-recomendacoes-375",
  "86c-recomendacoes-painel",
  "86d-recomendacoes-sem-resultado",
  "86e-recomendacoes-vazio",
  "87-recomendacoes-postar",
  "88-recomendacoes-curtidas",
  "88b-recomendacoes-remover",
  "89-recomendacoes-escuro",
];

/**
 * As checagens de perfil, de mão dupla.
 *
 * `tem` e `naoTem` apontam para a MESMA frase em duas telas: uma onde ela
 * precisa estar, outra onde não pode. Sem o lado positivo, uma tela que
 * parasse de mostrar a aba para todo mundo passaria.
 */
const POR_PERFIL = [
  {
    frase: "Gestão e acompanhamento",
    tem: "80-academy",
    naoTem: "81-academy-colaborador",
    porque:
      "a aba de gestão da Academy é de quem cuida dela; oferecê-la ao colaborador é oferecer um caminho que termina em 403",
  },
  {
    frase: "Só você lê isto",
    tem: "83-academy-material-aberto",
    naoTem: null,
    porque:
      "é a promessa que faz a pessoa escrever de verdade na anotação — sem a frase na tela, ela não tem por que acreditar",
  },
];

/** O texto que a pessoa lê, sem marcação, sem script e sem estilo. */
function textoDe(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casa palavra inteira, com acento, em qualquer sistema.
 *
 * `\b` do JavaScript trata letra acentuada como separador — `\bnota\b` casaria
 * dentro de "anotação" em alguns motores, e "gestão" viraria duas palavras.
 * Por isso a fronteira aqui é explícita: o que cerca a palavra não pode ser
 * letra nem dígito. É o mesmo motivo pelo qual o `check:cores` deixou de usar
 * `grep -i` — comparação de acento não pode depender do ambiente.
 */
function apareceInteira(texto, palavra) {
  const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapada}($|[^\\p{L}\\p{N}])`, "iu").test(texto);
}

const problemas = [];

/** Sai na hora, debaixo do cabeçalho da seção a que pertence. */
function certo(linha) {
  console.log(`  ok      ${linha}`);
}

function relatar() {
  if (problemas.length > 0) {
    console.log("");
    for (const linha of problemas) console.error(`  FALHA   ${linha}`);
    console.error(`\n${problemas.length} problema(s). O Sprint 9 não está de pé.`);
    process.exit(1);
  }
  console.log("\nTudo certo.");
}

// ---------------------------------------------------------------------------
// SEM OS DUMPS, ELE FALHA — nunca passa em branco.
//
// Uma checagem que não encontra o que conferir e termina verde é pior que
// nenhuma: ela afirma. É o mesmo erro do typecheck passando num `.next` velho
// e do `check:cores` passando por causa do locale.
// ---------------------------------------------------------------------------
if (!existsSync(DUMPS)) {
  console.error("\n  FALHA   não há HTML de tela para conferir.\n");
  console.error("  Os dumps saem do gerador de protótipo, e sem eles esta");
  console.error("  checagem não tem o que ler — passar assim seria afirmar");
  console.error("  sobre telas que ninguém olhou.\n");
  console.error("    npm run prototipo\n");
  process.exit(1);
}

console.log("\nVocabulário que o Full Academy não tem\n");

const arquivos = (await readdir(DUMPS)).filter((f) => f.endsWith(".html"));
const faltando = DO_SPRINT_9.filter((t) => !arquivos.includes(`${t}.html`));

if (faltando.length > 0) {
  problemas.push(
    `${faltando.length} tela(s) do sprint sem dump: ${faltando.join(", ")}.\n` +
      "          Rode `npm run prototipo` inteiro — uma rodada parcial deixa esta\n" +
      "          checagem afirmando sobre o que sobrou.",
  );
  relatar();
}

const textos = new Map();
for (const tela of DO_SPRINT_9) {
  textos.set(tela, textoDe(await readFile(path.join(DUMPS, `${tela}.html`), "utf8")));
}

for (const [palavra, porque] of PROIBIDAS) {
  const onde = [];
  for (const [tela, texto] of textos) {
    // A casca sai do texto antes da busca, e não da lista de palavras: tirar
    // `notas` da lista deixaria a Academy livre para dar nota desde que a
    // escrevesse no plural.
    let limpo = texto;
    for (const frase of DA_CASCA) {
      limpo = limpo.replace(new RegExp(frase, "gi"), " ");
    }
    if (apareceInteira(limpo, palavra)) onde.push(tela);
  }

  if (onde.length === 0) {
    certo(`“${palavra}” não aparece em tela nenhuma`);
  } else {
    problemas.push(`“${palavra}” aparece na tela — ${porque}\n          ${onde.join(", ")}`);
  }
}

console.log("\nO que cada perfil alcança\n");

for (const { frase, tem, naoTem, porque } of POR_PERFIL) {
  if (!apareceInteira(textos.get(tem) ?? "", frase)) {
    problemas.push(
      `“${frase}” sumiu de ${tem} — ${porque}.\n` +
        "          Esta é a metade positiva: sem ela, a checagem de ausência\n" +
        "          passaria numa tela que não mostra isso para ninguém.",
    );
  } else if (naoTem && apareceInteira(textos.get(naoTem) ?? "", frase)) {
    problemas.push(`“${frase}” aparece em ${naoTem} — ${porque}`);
  } else {
    certo(
      naoTem
        ? `“${frase}” está em ${tem} e não está em ${naoTem}`
        : `“${frase}” está em ${tem}`,
    );
  }
}

relatar();
