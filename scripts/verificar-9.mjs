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

/**
 * VOCABULÁRIO DE DESENVOLVIMENTO, e esta lista vale em TODA tela.
 *
 * As de cima são sobre um módulo — o Full Academy não dá nota. Esta é sobre o
 * produto inteiro: nenhum texto que a pessoa lê pode citar número de sprint,
 * nome de arquivo do roteiro ou palavra de quem constrói. Espaço reservado se
 * explica em português comum ou não existe.
 *
 * **Ela nasceu de quatro achados de uma varredura só:** a ficha do cliente
 * dizia "Configurado no Sprint 5" e "Preenchido no Sprint 14", a busca da
 * topbar respondia "entra em um sprint futuro", e as Métricas explicavam uma
 * conta "desde o Sprint 3B". Nenhum dos quatro quebrava build, tipo ou lint —
 * e os três primeiros apontavam para coisas que não existem mais.
 *
 * **Por que aqui e não no `check:cores`:** aquele varre o código-fonte, e
 * "sprint" aparece em trinta e cinco comentários que EXPLICAM decisões —
 * inclusive o que explica esta regra. É a armadilha que a lista de nomes
 * mortos já pagou três vezes. Aqui o que se lê é o texto renderizado, então
 * comentário não conta e atributo de tag não conta: só o que sai na tela.
 */
const DE_DESENVOLVIMENTO = [
  ["sprint", "número de sprint não diz nada a quem usa, e envelhece junto com o roteiro"],
  ["placeholder", "é palavra nossa; a tela diz em português o que vai existir"],
  ["backlog", "é palavra nossa"],
  ["em construção", "obra é assunto de quem constrói, não de quem abre a tela"],
  ["lorem ipsum", "texto de exemplo numa tela de verdade é tela que mente"],
];

/**
 * `TODO` e `FIXME` entram SEPARADOS, e é por causa do português.
 *
 * "todo" é palavra comum — "todo mundo", "todo dia", "em todo lugar" — e a
 * varredura de cima ignora caixa de propósito, para pegar "Sprint" e "sprint"
 * de uma vez. Buscando `todo` sem distinguir maiúscula, toda tela do produto
 * falharia, e a checagem viraria ruído no primeiro dia. Aqui a caixa é o que
 * separa o marcador de código da palavra.
 */
const MARCADORES = ["TODO", "FIXME", "XXX", "HACK"];

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
  {
    // A AUDITORIA (Sprint 16, Parte D). O arquivo nasceu para o Sprint 9 e a
    // lista cresce com o produto: o que ele confere é "o que cada perfil
    // alcança", e isso não é de um sprint só.
    //
    // A metade negativa é a que importa aqui. A trilha guarda o valor que
    // mudou no Financeiro, que fecha em `is_socio()` desde a 0013 — o item no
    // menu do desenvolvedor seria a porta dos fundos daquela regra, e um
    // caminho que termina em 403.
    frase: "Auditoria",
    tem: "99e-auditoria-socio",
    naoTem: "99f-painel-desenvolvedor-sem-auditoria",
    porque:
      "a trilha copia o trecho que mudou do Financeiro, e quem lê o log lê o Financeiro",
  },
];

/**
 * A BARRA LATERAL, POR PERFIL — e esta é a única checagem que lê SÓ ela.
 *
 * As de cima leem a página inteira, o menu incluído, e é o que elas precisam:
 * a pergunta é o que a pessoa lê. Aqui a pergunta é outra — **o que a barra
 * lista** —, e a página inteira não sabe responder: "Campanhas ativas" é um
 * cartão do Pulso na tela inicial do sócio, então uma busca no texto todo
 * diria que a entrada continua no menu quando ela não está. Por isso o recorte
 * é o `<nav>` da barra, achado pelo rótulo acessível que ele já carregava.
 *
 * **POR QUE ELA EXISTE:** Social Media e Campanhas saíram da barra por decisão
 * do usuário — *"quero que social media e campanhas saiam da aba lateral, elas
 * devem ficar dentro de minhas tasks para diminuir a quantidade de itens"*. As
 * duas rotas continuam de pé (`hiddenFromMenu` em `lib/auth/permissions.ts`,
 * não linha apagada, senão `canAccess` deixaria de conhecê-las e a rota
 * devolveria 403), e a porta passou a ser a faixa das três áreas em Minhas
 * Tasks.
 *
 * **E É DE MÃO DUPLA COM `A_PORTA`, que é a metade que falta.** Sem ela, a
 * checagem de ausência passaria no dia em que a faixa de Minhas Tasks
 * quebrasse: as duas áreas não estariam na barra nem em lugar nenhum, e o
 * módulo teria sumido do produto em silêncio. Tirar a entrada só foi possível
 * porque a faixa existe, então a checagem confere as duas coisas ou não
 * confere nenhuma.
 *
 * O lado positivo de cada linha existe pela razão de sempre: uma barra que
 * parasse de desenhar QUALQUER item passaria numa checagem que só procura
 * ausência. "Auditoria" fica de fora desta lista de propósito — quem responde
 * por ela é `POR_PERFIL`, e duas checagens dizendo a mesma coisa são o lugar
 * onde as duas começam a discordar.
 */
const MARCA_DA_BARRA = 'aria-label="Módulos do painel"';

const NA_BARRA = [
  {
    tela: "08-painel-colaborador",
    tem: ["Início", "Minhas Tasks", "Solicitações", "Notas Fiscais"],
    naoTem: ["Social Media", "Campanhas", "Gestão de Tasks", "Financeiro"],
    porque:
      "o colaborador vê a Principal e mais nada; as duas áreas que saíram entram por Minhas Tasks",
  },
  {
    tela: "05-painel-socio",
    tem: ["Minhas Tasks", "Gestão de Tasks", "Gestão de Pessoas", "Financeiro"],
    naoTem: ["Social Media", "Campanhas"],
    porque:
      "nem o sócio tem as duas na barra — o item saiu do menu, não do alcance de quem o abria",
  },
  {
    tela: "09-painel-desenvolvedor",
    tem: ["Minhas Tasks", "Gestão de Tasks", "Métricas"],
    naoTem: ["Social Media", "Campanhas", "Financeiro"],
    porque:
      "o desenvolvedor é gestão para o resto do sistema e não para o Financeiro, e as duas áreas saíram para todo mundo",
  },
];

const A_PORTA = {
  tela: "30-minhas-tasks-lista",
  nomes: ["Demandas", "Campanhas", "Social Media"],
  porque:
    "a faixa das três áreas é a porta que substituiu as duas entradas da barra; sem os nomes nela, o módulo sumiu do produto",
};

/**
 * O `<nav>` da barra, recortado da página.
 *
 * O recorte conta a profundidade em vez de procurar o primeiro `</nav>`: a
 * barra tem seções aninhadas, e um `indexOf` fecharia no lugar errado se um
 * dia houver um `<nav>` dentro dela. E devolve TODAS as ocorrências, porque no
 * celular a mesma barra aparece de novo dentro da gaveta — conferir uma só
 * deixaria a outra livre para divergir.
 */
function barrasDe(html) {
  const achados = [];
  let de = 0;
  for (;;) {
    const marca = html.indexOf(MARCA_DA_BARRA, de);
    if (marca === -1) break;
    let i = html.indexOf(">", marca) + 1;
    let fundo = 1;
    while (i < html.length && fundo > 0) {
      const abre = html.indexOf("<nav", i);
      const fecha = html.indexOf("</nav", i);
      if (fecha === -1) break;
      if (abre !== -1 && abre < fecha) {
        fundo += 1;
        i = abre + 4;
      } else {
        fundo -= 1;
        i = fecha + 5;
      }
    }
    achados.push(html.slice(marca, i));
    de = i;
  }
  return achados;
}

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

/** A mesma fronteira, olhando a CAIXA — só para `TODO` e companhia. */
function apareceInteiraComCaixa(texto, palavra) {
  const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapada}($|[^\\p{L}\\p{N}])`, "u").test(texto);
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
// AS TELAS QUE CADA CHECAGEM PRECISA, e não uma lista só.
//
// `DO_SPRINT_9` é a varredura de vocabulário; `POR_PERFIL` cresceu além do
// Sprint 9 e traz telas próprias — a Auditoria entrou no Sprint 16. Sem esta
// união a checagem de perfil lia `undefined` para a tela que não estivesse na
// primeira lista, `?? ""` virava texto vazio, e ela reprovava dizendo que a
// palavra "sumiu da tela" — quando o que faltava era o dump.
//
// **Um erro de diagnóstico é quase tão caro quanto um erro de resultado:** ele
// manda a pessoa procurar no lugar errado. Foi o que aconteceu ao acrescentar
// a Auditoria, e por isso as duas listas se juntam aqui em vez de a segunda
// ser copiada para dentro da primeira — o que poria as telas da Auditoria na
// varredura de palavras do Full Academy, que não é sobre elas.
const NECESSARIAS = [
  ...new Set([
    ...DO_SPRINT_9,
    ...POR_PERFIL.flatMap(({ tem, naoTem }) => (naoTem ? [tem, naoTem] : [tem])),
    ...NA_BARRA.map(({ tela }) => tela),
    A_PORTA.tela,
  ]),
];

const faltando = NECESSARIAS.filter((t) => !arquivos.includes(`${t}.html`));

if (faltando.length > 0) {
  problemas.push(
    `${faltando.length} tela(s) do sprint sem dump: ${faltando.join(", ")}.\n` +
      "          Rode `npm run prototipo` inteiro — uma rodada parcial deixa esta\n" +
      "          checagem afirmando sobre o que sobrou.",
  );
  relatar();
}

const textos = new Map();
for (const tela of NECESSARIAS) {
  textos.set(tela, textoDe(await readFile(path.join(DUMPS, `${tela}.html`), "utf8")));
}

for (const [palavra, porque] of PROIBIDAS) {
  const onde = [];
  // SÓ AS TELAS DO SPRINT 9 na varredura de vocabulário: o que ela procura é o
  // que o Full Academy não tem (quiz, certificado, nota, gamificação), e
  // passar a tela da Auditoria por ela seria perguntar do Academy numa tela
  // que não é dele.
  for (const tela of DO_SPRINT_9) {
    const texto = textos.get(tela) ?? "";
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

// ---------------------------------------------------------------------------
// E AGORA EM TODA TELA, não só nas do Full Academy.
//
// As outras duas seções perguntam sobre um módulo. Esta pergunta sobre o
// produto: em cento e cinquenta telas e seis perfis, nenhuma palavra de quem
// constrói. Por isso ela lê TODOS os dumps, inclusive os que nenhuma outra
// checagem conhece — um espaço reservado esquecido mora justamente na tela que
// ninguém lembra de olhar.
// ---------------------------------------------------------------------------
console.log("\nVocabulário de desenvolvimento, em toda tela\n");

const TODAS = new Map();
for (const arquivo of arquivos) {
  TODAS.set(
    arquivo.replace(/\.html$/, ""),
    textoDe(await readFile(path.join(DUMPS, arquivo), "utf8")),
  );
}

for (const [palavra, porque] of DE_DESENVOLVIMENTO) {
  const onde = [...TODAS].filter(([, texto]) => apareceInteira(texto, palavra)).map(([t]) => t);
  if (onde.length === 0) {
    certo(`“${palavra}” não aparece em tela nenhuma`);
  } else {
    problemas.push(
      `“${palavra}” aparece em ${onde.length} tela(s) — ${porque}\n` +
        `          ${onde.slice(0, 8).join(", ")}${onde.length > 8 ? ", …" : ""}`,
    );
  }
}

for (const marcador of MARCADORES) {
  const onde = [...TODAS]
    .filter(([, texto]) => apareceInteiraComCaixa(texto, marcador))
    .map(([t]) => t);
  if (onde.length === 0) {
    certo(`“${marcador}” não aparece em tela nenhuma`);
  } else {
    problemas.push(
      `“${marcador}” aparece em ${onde.length} tela(s) — marcador de código não é texto de tela\n` +
        `          ${onde.slice(0, 8).join(", ")}${onde.length > 8 ? ", …" : ""}`,
    );
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

console.log("\nO que a barra lateral lista\n");

for (const { tela, tem, naoTem, porque } of NA_BARRA) {
  const barras = barrasDe(await readFile(path.join(DUMPS, `${tela}.html`), "utf8"));

  // SEM A BARRA, ELE FALHA — nunca passa em branco. Um dump em que o recorte
  // não acha o `<nav>` é um dump em que TODA ausência passa: a barra some, e a
  // checagem que devia gritar diz "ok" para as duas linhas de baixo.
  if (barras.length === 0) {
    problemas.push(
      `${tela} não tem a barra lateral no dump — o recorte procura o rótulo
` +
        `          “Módulos do painel”, e sem ele esta checagem afirmaria sobre
` +
        "          uma barra que ninguém leu.",
    );
    continue;
  }

  const texto = barras.map(textoDe).join(" · ");

  const sumiram = tem.filter((rotulo) => !apareceInteira(texto, rotulo));
  const voltaram = naoTem.filter((rotulo) => apareceInteira(texto, rotulo));

  if (sumiram.length > 0) {
    problemas.push(
      `a barra de ${tela} não lista ${sumiram.join(", ")} — ${porque}.\n` +
        "          Esta é a metade positiva: sem ela, a checagem de ausência\n" +
        "          passaria numa barra que parou de desenhar tudo.",
    );
  } else if (voltaram.length > 0) {
    problemas.push(`a barra de ${tela} voltou a listar ${voltaram.join(", ")} — ${porque}`);
  } else {
    certo(`${tela}: ${tem.length} item(ns) de pé, ${naoTem.length} fora`);
  }
}

const daPorta = A_PORTA.nomes.filter(
  (nome) => !apareceInteira(textos.get(A_PORTA.tela) ?? "", nome),
);

if (daPorta.length > 0) {
  problemas.push(
    `${A_PORTA.tela} não nomeia ${daPorta.join(", ")} — ${A_PORTA.porque}`,
  );
} else {
  certo(`${A_PORTA.tela} nomeia as três áreas`);
}

relatar();
