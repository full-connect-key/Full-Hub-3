/**
 * Os criterios de aceite do Sprint 9 que so aparecem CLICANDO.
 *
 * A bateria de supabase/testes/09_academy_e_recomendacoes.sql prova as regras
 * do banco -- e sao elas que valem. Esta prova as da tela, e pega o erro de
 * runtime que o `npm run build` nao pega: ele compila, e so quebra quando
 * alguem pede a pagina.
 *
 * DOIS criterios NAO passam por aqui, e e de proposito:
 *
 *   - "cliente nao acessa nada disto" -- o prototipo nao tem Supabase atras,
 *     entao a recusa de verdade e a da bateria (os cenarios de `cliente` em
 *     09_). O que esta tela prova e o outro lado: as duas rotas moram em
 *     `(interno)`, e nenhuma entrada do MENU aceita o perfil `cliente`.
 *   - qualquer ESCRITA (marcar visto, curtir, comentar, publicar) -- as
 *     acoes falam com o Supabase, que aqui nao existe. O que da para provar
 *     e que o controle esta na tela, habilitado, e com o texto certo.
 *
 * COMO RODAR
 *   PROTOTIPO_MANTER_COPIA=1 npm run prototipo
 *   cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600 &
 *   node scripts/prototipo-clicavel/verificar-9.mjs
 *
 * Depois derrube o servidor, suba com PROTOTIPO_ROLE=colaborador e rode de
 * novo: a segunda metade muda de resposta, e e essa mudanca que interessa.
 */
import { chromium } from "playwright";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function acharChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && existsSync(base)) {
    for (const pasta of readdirSync(base)) {
      const c = path.join(base, pasta, "chrome-linux", "chrome");
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

const BASE = "http://localhost:3600";
const PAPEL = process.env.PROTOTIPO_ROLE ?? "socio";
const GESTAO = PAPEL === "socio" || PAPEL === "desenvolvedor";

const resultados = [];
const ok = (d, extra = "") => resultados.push(["passou", d, extra]);
const falha = (d, extra = "") => resultados.push(["FALHOU", d, extra]);

const navegador = await chromium.launch({
  executablePath: acharChromium(),
  args: ["--no-sandbox"],
});
const pagina = await navegador.newPage({ viewport: { width: 1700, height: 1300 } });

const erros = [];
pagina.on("pageerror", (e) => erros.push(String(e)));

async function ir(rota) {
  await pagina.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
}

const principal = () => pagina.locator("main").textContent();

console.log(`\n  rodando como ${PAPEL}\n`);

// --- Academy: a grade ------------------------------------------------------

await ir("/painel/academy");
const grade = await principal();

if (grade?.includes("Onboarding da casa")) ok("A grade lista as trilhas publicadas");
else falha("A grade lista as trilhas publicadas");

// Obrigatoria se anuncia no cartao: e a unica informacao da grade que muda o
// que a pessoa faz a seguir.
if (await pagina.locator('main :text-is("Obrigatória")').count()) {
  ok("A trilha obrigatória se anuncia na grade");
} else {
  falha("A trilha obrigatória se anuncia na grade");
}

// O RASCUNHO e o criterio que separa os dois perfis: a gestao enxerga, a
// equipe nao -- nem por endereco direto, mas isso quem prova e a RLS.
const temRascunho = Boolean(grade?.includes("Mídia paga do zero"));
if (GESTAO === temRascunho) {
  ok(
    GESTAO
      ? "A gestão enxerga a trilha em rascunho"
      : "A equipe NÃO enxerga a trilha em rascunho",
  );
} else {
  falha("Rascunho visível para quem deve", `papel=${PAPEL} viu=${temRascunho}`);
}

// A barra de progresso nunca anda sozinha: o numero vai junto, e o leitor de
// tela recebe o texto, nao o percentual.
const barras = pagina.locator('main [role="progressbar"]');
if ((await barras.count()) > 0) {
  const texto = await barras.first().getAttribute("aria-valuetext");
  if (texto && /\d+ de \d+/.test(texto)) ok("A barra de progresso anuncia a contagem", texto);
  else falha("A barra de progresso anuncia a contagem", String(texto));
} else {
  falha("A barra de progresso anuncia a contagem", "nenhuma barra");
}

// "Recomendadas para voce" sai do que a pessoa marcou em Meu Desenvolvimento.
if (grade?.includes("Recomendadas para você")) {
  ok("A vitrine de recomendadas aparece com o filtro em “Todas”");
} else {
  falha("A vitrine de recomendadas aparece com o filtro em “Todas”");
}

// --- Academy: o filtro mora na URL -----------------------------------------

await pagina.locator('main button:has-text("Obrigatórias")').first().click();
await pagina.waitForTimeout(700);

if (pagina.url().includes("filtro=obrigatorias")) {
  ok("O filtro da grade vai para a URL");
} else {
  falha("O filtro da grade vai para a URL", pagina.url());
}

const filtrada = await principal();
if (filtrada?.includes("Onboarding da casa") && !filtrada?.includes("Escrita para redes")) {
  ok("E o filtro filtra de verdade");
} else {
  falha("E o filtro filtra de verdade");
}

// Filtrada, a vitrine sai: "Concluidas" e ainda ver a vitrine de nao
// iniciadas seria a tela contradizendo o proprio filtro.
if (!filtrada?.includes("Recomendadas para você")) {
  ok("Com filtro ativo a vitrine sai da tela");
} else {
  falha("Com filtro ativo a vitrine sai da tela");
}

// Filtro que nao sobra nada diz o que fazer, nao mostra branco.
await ir("/painel/academy?filtro=concluidas");
const vazia = await principal();
if (/Nenhuma trilha/.test(vazia ?? "")) ok("Filtro sem resultado explica a saída");
else falha("Filtro sem resultado explica a saída");

// --- Academy: a trilha e o material ----------------------------------------

await ir("/painel/academy/t1");
const trilha = await principal();

if (trilha?.includes("Materiais")) ok("A trilha lista os materiais");
else falha("A trilha lista os materiais");

// A sanfona: um material por vez, com a anotacao dentro.
await pagina.locator('main button:has-text("Boas-vindas da Ana")').first().click();
await pagina.waitForTimeout(500);

if ((await pagina.locator("main iframe").count()) > 0) {
  ok("Vídeo do YouTube abre incorporado, sem sair da trilha");
} else {
  falha("Vídeo do YouTube abre incorporado, sem sair da trilha");
}

const anotacao = pagina.locator('main textarea[id^="anotacao-"]');
if ((await anotacao.count()) > 0) {
  const escrito = await anotacao.first().inputValue();
  if (escrito.length > 0) ok("A anotação é por material e reabre escrita", escrito);
  else falha("A anotação é por material e reabre escrita", "veio vazia");
} else {
  falha("A anotação é por material e reabre escrita", "sem campo");
}

// E a tela DIZ que ninguem mais le. A regra e da RLS; a frase e o que faz a
// pessoa escrever de verdade.
const aberto = await principal();
if (/Só você lê isto/.test(aberto ?? "")) {
  ok("A tela promete que a anotação é privada");
} else {
  falha("A tela promete que a anotação é privada");
}

// O material sem endereco embutivel cai no link, e avisa ANTES do clique.
await pagina.locator('main button:has-text("O caminho de uma demanda")').first().click();
await pagina.waitForTimeout(500);
const linkExterno = pagina.locator('main a:has-text("Abrir em nova aba")');
if ((await linkExterno.count()) > 0) {
  const alvo = await linkExterno.first().getAttribute("target");
  if (alvo === "_blank") ok("Artigo abre fora, e a tela avisa antes");
  else falha("Artigo abre fora, e a tela avisa antes", `target=${alvo}`);
} else {
  falha("Artigo abre fora, e a tela avisa antes");
}

// --- Academy: NADA de avaliar gente ----------------------------------------
//
// "Nao criar quiz, certificado, nota ou gamificacao" e criterio do sprint, e
// criterio que diz "nao existe" precisa ser conferido toda vez -- e o tipo
// que volta sem ninguem perceber.

const proibidas = ["quiz", "certificado", "pontuação", "ranking", "medalha", "nota final"];
const varrido = `${grade ?? ""} ${trilha ?? ""} ${aberto ?? ""}`.toLowerCase();
const achadas = proibidas.filter((p) => varrido.includes(p));
if (achadas.length === 0) ok("Nenhum quiz, certificado, nota ou gamificação na tela");
else falha("Nenhum quiz, certificado, nota ou gamificação na tela", achadas.join(", "));

// --- Academy: a gestao -----------------------------------------------------

await ir("/painel/academy?aba=gestao");
const gestao = await principal();

if (GESTAO) {
  if (gestao?.includes("Nova trilha")) ok("A gestão cria trilha");
  else falha("A gestão cria trilha");

  if (gestao?.includes("Acompanhamento")) ok("E acompanha quem concluiu o quê");
  else falha("E acompanha quem concluiu o quê");

  if (gestao?.includes("Exportar CSV")) ok("Com CSV do acompanhamento");
  else falha("Com CSV do acompanhamento");

  // O acompanhamento le a VIEW, que nao tem a coluna de anotacao. A tela diz
  // isso em voz alta porque e a promessa que faz a pessoa escrever.
  if (/não aparece aqui/.test(gestao ?? "")) {
    ok("O acompanhamento diz que a anotação não chega ali");
  } else {
    falha("O acompanhamento diz que a anotação não chega ali");
  }

  const anotacoesVazadas = ["Rever a parte de quem aprova"];
  const vazou = anotacoesVazadas.filter((t) => (gestao ?? "").includes(t));
  if (vazou.length === 0) ok("E de fato nenhuma anotação aparece no acompanhamento");
  else falha("E de fato nenhuma anotação aparece no acompanhamento", vazou.join(", "));
} else {
  if (!gestao?.includes("Nova trilha")) ok("A equipe não vê a aba de gestão");
  else falha("A equipe não vê a aba de gestão");
}

// --- Recomendações: o feed -------------------------------------------------

await ir("/painel/recomendacoes");
const feed = await principal();

if (feed?.includes("Figma Slides")) ok("O feed lista as recomendações");
else falha("O feed lista as recomendações");

if (feed?.includes("Em alta este mês")) ok("“Em alta este mês” aparece");
else falha("“Em alta este mês” aparece");

if (feed?.includes("Tags mais usadas")) ok("A nuvem de tags aparece");
else falha("A nuvem de tags aparece");

// A thread tem UM nivel: resposta de resposta vira conversa que ninguem
// acompanha, e a trava mora no trigger `rec_comments_um_nivel`.
const responder = await pagina.locator('main button:has-text("Responder")').count();
const respostas = await pagina.locator('main button:has-text("Responder")').count();
if (responder > 0) ok("Comentário raiz oferece Responder", `${respostas}`);
else falha("Comentário raiz oferece Responder");

// O tempo relativo vem pronto do servidor -- se cada cartao lesse o relogio,
// o fuso do navegador daria outro texto na hidratacao.
if (/há \d+ (min|hora|horas|dias)|agora|ontem/.test(feed ?? "")) {
  ok("O cartão mostra o tempo relativo");
} else {
  falha("O cartão mostra o tempo relativo");
}

// --- Recomendações: os filtros moram na URL --------------------------------

// Os titulos dos CARTOES, nao o texto de `main`: a barra lateral repete o
// titulo em "Em alta este mes", e uma asercao sobre `main` inteiro passaria
// -- ou reprovaria -- pelo motivo errado. Foi o que aconteceu na primeira
// versao desta verificacao.
const titulosDoFeed = () => pagina.locator("main article h3").allTextContents();

await ir("/painel/recomendacoes?categoria=filme");
const soFilme = await titulosDoFeed();
if (soFilme.length === 1 && soFilme[0].includes("Abstract")) {
  ok("O filtro de categoria vem da URL", soFilme.join(" · "));
} else {
  falha("O filtro de categoria vem da URL", soFilme.join(" · "));
}

await ir("/painel/recomendacoes?tag=estrategia");
const porTag = await titulosDoFeed();
if (porTag.length === 2 && porTag.every((t) => /Braincast|Obviously/.test(t))) {
  ok("O filtro de tag vem da URL", porTag.join(" · "));
} else {
  falha("O filtro de tag vem da URL", porTag.join(" · "));
}

// A busca varre TITULO e DESCRICAO, e as duas asercoes provam um lado cada:
// "Braincast" so existe em titulo, "jargao" so em descricao. Um termo que
// caisse nos dois -- foi o caso de "posicionamento", na primeira versao --
// passaria sem dizer qual dos dois campos funciona.
await ir("/painel/recomendacoes?busca=Braincast");
const porTitulo = await titulosDoFeed();
if (porTitulo.length === 1 && porTitulo[0].includes("Braincast")) {
  ok("A busca da URL acha pelo título", porTitulo.join(" · "));
} else {
  falha("A busca da URL acha pelo título", porTitulo.join(" · "));
}

await ir("/painel/recomendacoes?busca=jarg%C3%A3o");
const porDescricao = await titulosDoFeed();
if (porDescricao.length === 1 && porDescricao[0].includes("Obviously Awesome")) {
  ok("E também pela descrição", porDescricao.join(" · "));
} else {
  falha("E também pela descrição", porDescricao.join(" · "));
}

await ir("/painel/recomendacoes?ordem=curtidas");
const ordenado = await titulosDoFeed();
if (ordenado[0]?.includes("Figma Slides")) {
  ok("“Mais curtidas” reordena o feed", ordenado.slice(0, 2).join(" · "));
} else {
  falha("“Mais curtidas” reordena o feed", ordenado.slice(0, 2).join(" · "));
}

// --- Recomendações: quem apaga o quê ---------------------------------------

await ir("/painel/recomendacoes");

// O proprio post: "Apagar", sem motivo. Post dos outros: so a gestao, e com
// motivo obrigatorio.
// No RODAPE do cartao, nao em `main`: cada comentario tambem tem um
// "Apagar", e contar os dois juntos daria um numero que nao prova nada.
const apagar = await pagina.locator('main article > footer button:has-text("Apagar")').count();
const remover = await pagina
  .locator('main article > footer button:has-text("Remover")')
  .count();

if (GESTAO) {
  if (remover > 0) ok("A gestão pode remover post de outra pessoa", `${remover}`);
  else falha("A gestão pode remover post de outra pessoa");

  // O motivo mora DENTRO do dialogo -- um input aberto em cada cartao virava
  // a coisa mais alta de um feed que precisa ser leve.
  const inputSolto = await pagina.locator('main input[placeholder*="Motivo"]').count();
  if (inputSolto === 0) ok("Sem campo de motivo solto no cartão");
  else falha("Sem campo de motivo solto no cartão", `${inputSolto}`);

  await pagina.locator('main button:has-text("Remover")').first().click();
  await pagina.waitForTimeout(600);

  const dialogo = pagina.locator('[role="dialog"]');
  const textoDoDialogo = await dialogo.textContent();
  if (/recebe um aviso com o motivo/.test(textoDoDialogo ?? "")) {
    ok("O diálogo avisa que o autor recebe o motivo");
  } else {
    falha("O diálogo avisa que o autor recebe o motivo", textoDoDialogo ?? "");
  }

  // Motivo vazio nao libera: post que some sem explicacao e o jeito mais
  // rapido de a equipe parar de postar.
  const confirmar = dialogo.locator('button:has-text("Remover e avisar")');
  if (await confirmar.isDisabled()) ok("Sem motivo, o botão de remover não libera");
  else falha("Sem motivo, o botão de remover não libera");

  await dialogo.locator("textarea").fill("Link quebrado.");
  await pagina.waitForTimeout(300);
  if (!(await confirmar.isDisabled())) ok("Com motivo escrito, libera");
  else falha("Com motivo escrito, libera");

  await pagina.keyboard.press("Escape");
} else {
  if (remover === 0) ok("A equipe não remove post de outra pessoa");
  else falha("A equipe não remove post de outra pessoa", `${remover}`);
}

if (apagar > 0) ok("O próprio post tem “Apagar”, sem pedir motivo", `${apagar}`);
else falha("O próprio post tem “Apagar”, sem pedir motivo");

// --- Recomendações: postar -------------------------------------------------

await pagina.locator('main button:has-text("O que você recomenda hoje?")').first().click();
await pagina.waitForTimeout(600);

const formulario = await principal();
for (const campo of ["Categoria", "Título", "Link", "Tags"]) {
  if (formulario?.includes(campo)) ok(`O formulário tem ${campo}`);
  else falha(`O formulário tem ${campo}`);
}

// Qualquer pessoa da equipe posta: nao ha fila, nao ha aprovacao. E o modulo
// mais leve do sistema, e o desenho respeita isso.
//
// O botao nasce travado porque titulo vazio nao e recomendacao -- e essa e a
// UNICA trava. Preencher o titulo libera, sem passar por ninguem.
const publicar = pagina.locator('main button:has-text("Publicar")').first();
if (await publicar.isDisabled()) ok("Sem título, publicar não libera");
else falha("Sem título, publicar não libera");

await pagina.locator("#rec-titulo").fill("Teste de publicação");
await pagina.waitForTimeout(300);
if (!(await publicar.isDisabled())) {
  ok("Com título, qualquer perfil interno publica — sem fila de aprovação");
} else {
  falha("Com título, qualquer perfil interno publica — sem fila de aprovação");
}

// --- O cliente não alcança nada disto --------------------------------------
//
// A recusa de verdade e a da RLS (bateria 09_). O que se confere aqui e o
// outro lado: as rotas sao de `(interno)` e nenhuma entrada do MENU aceita
// `cliente`. Criterio que diz "nao existe" precisa ser verificado toda vez.

const permissoes = readFileSync("src/lib/auth/permissions.ts", "utf8");
for (const rota of ["/painel/academy", "/painel/recomendacoes"]) {
  const bloco = permissoes.slice(
    permissoes.indexOf(`href: "${rota}"`),
    permissoes.indexOf(`href: "${rota}"`) + 200,
  );
  if (bloco && !/cliente/.test(bloco)) ok(`Nenhum perfil cliente em ${rota}`);
  else falha(`Nenhum perfil cliente em ${rota}`, bloco);
}

for (const rota of ["academy", "recomendacoes"]) {
  if (existsSync(`src/app/(interno)/painel/${rota}/page.tsx`)) {
    ok(`${rota} mora em (interno), não em (cliente)`);
  } else {
    falha(`${rota} mora em (interno), não em (cliente)`);
  }
}

// --- Erro de runtime -------------------------------------------------------

if (erros.length === 0) ok("Nenhum erro de runtime nas telas visitadas");
else falha("Nenhum erro de runtime nas telas visitadas", erros[0]);

await navegador.close();

for (const [situacao, descricao, extra] of resultados) {
  const marca = situacao === "passou" ? "  ok " : "  FALHOU ";
  console.log(`${marca} ${descricao}${extra ? ` — ${extra}` : ""}`);
}

const falhou = resultados.filter(([s]) => s !== "passou").length;
console.log(`\n${resultados.length - falhou}/${resultados.length} passaram\n`);
process.exit(falhou > 0 ? 1 : 0);
