/**
 * Captura tudo que a versao clicavel do prototipo precisa, a partir do
 * servidor do prototipo rodando em http://localhost:3600.
 *
 *   node scripts/prototipo-clicavel/capturar.mjs <pasta-de-saida> <perfil>
 *
 * O perfil e o PROTOTIPO_ROLE com que o servidor subiu. Rode uma vez para
 * cada perfil: so o "casco" do painel muda entre eles, e o resto e capturado
 * apenas na passada do socio.
 *
 * Por que nao basta baixar o HTML de cada rota:
 *   - telas com <Suspense> chegam como esqueleto de carregamento;
 *   - as abas do Radix desmontam o conteudo inativo;
 *   - um dialogo so existe no DOM depois de aberto;
 *   - as opcoes de um <Select> so existem depois do clique.
 * Por isso essas quatro coisas sao capturadas com um navegador de verdade.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "http://localhost:3600";
const SAIDA = process.argv[2];
const PERFIL = process.argv[3] || "socio";

if (!SAIDA) {
  console.error("uso: node capturar.mjs <pasta-de-saida> [perfil]");
  process.exit(1);
}

const CLIENTE = "/painel/clientes/c0000000-0000-0000-0000-00000000000a";
const PESSOA = "/painel/equipe/a0000000-0000-0000-0000-000000000003";
const TASK = "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111";

/** Rotas cujo HTML inicial ja vem completo. */
const PAGINAS = {
  login: "/login",
  "login-expirado": "/login?motivo=inatividade",
  esqueci: "/esqueci-senha",
  redefinir: "/redefinir-senha",
  negado: "/403-exemplo",
  status: "/status",
  portal: "/portal",
  "portal-social": "/portal/social-media",
  "portal-campanhas": "/portal/campanhas",
  "portal-config": "/portal/configuracoes",
  "modulo-home": "/painel",
  "modulo-minhas-tasks": "/painel/minhas-tasks",
  "modulo-calendario": "/painel/calendario",
  "modulo-aprovacoes": "/painel/aprovacoes",
  "modulo-clientes": "/painel/clientes",
  "modulo-clientes-detalhe": CLIENTE,
  "modulo-equipe": "/painel/equipe",
  "modulo-equipe-detalhe": PESSOA,
  "modulo-full-days": "/painel/full-days",
  "modulo-financeiro": "/painel/financeiro",
  "modulo-minhas-skills": "/painel/minhas-skills",
  "modulo-diario": "/painel/diario",
  "modulo-academy": "/painel/academy",
  "modulo-recomendacoes": "/painel/recomendacoes",
  "modulo-financeiro-pessoal": "/painel/financeiro-pessoal",
  "modulo-perfil": "/painel/perfil",
  "modulo-dev-componentes": "/painel/dev/componentes",
};

/** Telas com <Suspense>: precisam do DOM final, nao do HTML inicial. */
const COM_SUSPENSE = {
  "modulo-gestao-tasks": "/painel/gestao-tasks",
  "visao-lista": "/painel/gestao-tasks?visao=lista",
  "visao-calendario": "/painel/gestao-tasks?visao=calendario",
  "modulo-gestao-tasks-detalhe": TASK,
};

const ABAS = [
  { rota: CLIENTE, abas: ["Dados", "Usuários com acesso", "Configurações do fluxo", "Atividade"] },
  { rota: PESSOA, abas: ["Dados", "Skills", "Full Days"] },
];

const DIALOGOS = [
  { nome: "colaborador-novo", rota: "/painel/equipe", passos: ['button:has-text("Adicionar colaborador")'] },
  { nome: "cliente-novo", rota: "/painel/clientes", passos: ['button:has-text("Novo cliente")'] },
  { nome: "cliente-editar", rota: CLIENTE, passos: ['button:has-text("Editar")'] },
  { nome: "cliente-desativar", rota: CLIENTE, passos: ['button:has-text("Desativar cliente")'] },
  { nome: "cliente-excluir", rota: CLIENTE, passos: ['button:has-text("Excluir definitivamente")'] },
  {
    nome: "usuario-convidar",
    rota: CLIENTE,
    passos: ['[role="tab"]:has-text("Usuários com acesso")', 'button:has-text("Convidar usuário")'],
  },
  { nome: "pessoa-desativar", rota: PESSOA, passos: ['button:has-text("Desativar acesso")'] },
  { nome: "pessoa-desligar", rota: PESSOA, passos: ['button:has-text("Desligar da equipe")'] },
  {
    nome: "pessoa-desligar-2",
    rota: PESSOA,
    passos: [
      'button:has-text("Desligar da equipe")',
      "#destino-da-transferencia",
      '[role="option"]:has-text("Diego Reis")',
      'button:has-text("Continuar")',
    ],
  },
  { nome: "task-nova", rota: "/painel/gestao-tasks", passos: ['button:has-text("Nova task")'] },
];

await mkdir(SAIDA, { recursive: true });
const gravar = (nome, texto) => writeFile(path.join(SAIDA, nome), texto);
const gravarJson = (nome, valor) => gravar(nome, JSON.stringify(valor));

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
const pagina = await navegador.newPage({ viewport: { width: 1500, height: 1000 }, locale: "pt-BR" });
pagina.setDefaultTimeout(10000);

const ir = async (rota) => {
  await pagina.goto(BASE + rota, { waitUntil: "networkidle" });
  await pagina.waitForTimeout(350);
};

// ---------------------------------------------------------------- o casco
await ir("/painel");
await gravar(`shell-${PERFIL}.html`, await pagina.content());
console.log(`  shell-${PERFIL}.html`);

if (PERFIL !== "socio") {
  await navegador.close();
  process.exit(0);
}

// ------------------------------------------------- paginas e folha de estilo
for (const [nome, rota] of Object.entries(PAGINAS)) {
  await ir(rota);
  await gravar(`${nome}.html`, await pagina.content());
}
console.log(`  ${Object.keys(PAGINAS).length} páginas`);

await ir("/painel");
const folha = await pagina.$eval('link[rel="stylesheet"][href*="/_next/"]', (el) => el.getAttribute("href"));
await gravar("app.css", await (await fetch(BASE + folha)).text());
console.log("  app.css");

// ------------------------------------------------------------ com <Suspense>
const mains = {};
for (const [nome, rota] of Object.entries(COM_SUSPENSE)) {
  await ir(rota);
  mains[nome] = await pagina.$eval("main", (el) => el.innerHTML);
}
await gravarJson("mains.json", mains);
console.log(`  ${Object.keys(mains).length} telas com Suspense`);

// ------------------------------------------------------------------- abas
const abas = {};
for (const alvo of ABAS) {
  abas[alvo.rota] = {};
  for (const aba of alvo.abas) {
    await ir(alvo.rota);
    if (aba !== alvo.abas[0]) {
      await pagina.click(`[role="tab"]:has-text("${aba}")`);
      await pagina.waitForTimeout(350);
    }
    abas[alvo.rota][aba] = await pagina.$eval("main", (el) => el.innerHTML);
  }
}
await gravarJson("abas.json", abas);
console.log(`  ${ABAS.reduce((total, a) => total + a.abas.length, 0)} abas`);

// -------------------------------------------------------- diálogos e selects
const dialogos = {};
const opcoes = {};
for (const alvo of DIALOGOS) {
  await ir(alvo.rota);
  try {
    for (const passo of alvo.passos) {
      await pagina.click(passo);
      await pagina.waitForTimeout(400);
    }
    await pagina.waitForSelector('[role="dialog"]');
    dialogos[alvo.nome] = await pagina.$eval('[role="dialog"]', (el) => el.outerHTML);

    const ids = await pagina.$$eval('[role="dialog"] [data-slot="select-trigger"]', (els) =>
      els.map((e) => e.id).filter(Boolean),
    );
    if (ids.length) opcoes[alvo.nome] = {};
    for (const id of ids) {
      await pagina.click("#" + id);
      await pagina.waitForTimeout(350);
      opcoes[alvo.nome][id] = await pagina.$$eval('[role="option"]', (els) =>
        els.map((e) => e.textContent.trim()),
      );
      await pagina.keyboard.press("Escape");
      await pagina.waitForTimeout(250);
    }
    console.log(`  diálogo ${alvo.nome}`);
  } catch (erro) {
    console.log(`  FALHOU ${alvo.nome}: ${String(erro).split("\n")[0].slice(0, 80)}`);
  }
}
await gravarJson("dialogos.json", dialogos);
await gravarJson("opcoes.json", opcoes);

await navegador.close();
console.log("\n  Captura pronta em", SAIDA);
