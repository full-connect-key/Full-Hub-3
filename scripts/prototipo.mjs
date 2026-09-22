#!/usr/bin/env node
/**
 * Gera imagens das telas para validacao visual, sem precisar de Supabase,
 * sem login e sem subir nada:
 *
 *   npm run prototipo
 *
 * As imagens saem em prototipos/.
 *
 * COMO FUNCIONA
 *   O projeto e copiado para uma pasta temporaria. So nessa copia, quatro
 *   modulos sao trocados por versoes de exemplo (scripts/prototipo/), usando
 *   apelidos de caminho do TypeScript -- nenhum arquivo de src/ e alterado.
 *
 *   Por isso o codigo que pula o login NAO existe no app publicado: ele vive
 *   apenas dentro da copia temporaria, que e apagada no fim.
 *
 * A CADA SPRINT
 *   1. acrescente os dados ficticios em scripts/prototipo/dados-exemplo.ts
 *   2. acrescente a tela nova na lista TELAS logo abaixo
 */

import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Telas capturadas. Acrescente uma linha por pagina nova.
// ---------------------------------------------------------------------------
const TELAS = [
  { nome: "login", rota: "/login", largura: 900, altura: 700 },
  { nome: "dashboard", rota: "/dashboard", largura: 1440, altura: 1000 },
  { nome: "configuracoes", rota: "/configuracoes", largura: 1440, altura: 900 },
  { nome: "status", rota: "/status", largura: 1000, altura: 900 },
  { nome: "dashboard-celular", rota: "/dashboard", largura: 390, altura: 844 },
];

const PORTA = 3100;
const RAIZ = path.resolve(import.meta.dirname, "..");
const SAIDA = path.join(RAIZ, "prototipos");

// A copia fica DENTRO do projeto, e nao em /tmp, por um motivo pratico: assim
// o Node acha node_modules subindo um nivel, do jeito que ele sempre resolve
// dependencias. Um link simbolico apontando para fora da raiz e recusado pelo
// compilador. A pasta e apagada no fim, e esta no .gitignore.
const COPIA = path.join(RAIZ, ".prototipo");

// Modulos reais -> versoes de exemplo, aplicados so na copia temporaria.
const SUBSTITUICOES = {
  "@/lib/auth/dal": ["./scripts/prototipo/dal.ts"],
  "@/lib/supabase/diagnostico": ["./scripts/prototipo/diagnostico.ts"],
  "@/lib/supabase/proxy": ["./scripts/prototipo/proxy-supabase.ts"],
};

const log = (msg) => console.log(`  ${msg}`);

function executar(comando, args, opcoes = {}) {
  return new Promise((ok, falhou) => {
    const p = spawn(comando, args, { stdio: "pipe", ...opcoes });
    let saida = "";
    p.stdout?.on("data", (d) => (saida += d));
    p.stderr?.on("data", (d) => (saida += d));
    p.on("close", (codigo) =>
      codigo === 0 ? ok(saida) : falhou(new Error(`${comando} falhou:\n${saida.slice(-2500)}`)),
    );
  });
}

async function esperarNoAr(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.status < 500) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`O servidor nao respondeu em ${url}`);
}

/**
 * Acha o Chromium. O launch() padrao do Playwright resolve na maioria das
 * maquinas; em ambientes com PLAYWRIGHT_BROWSERS_PATH proprio, procuramos o
 * executavel na mao.
 */
async function abrirNavegador(chromium) {
  try {
    return await chromium.launch();
  } catch (erro) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (base && existsSync(base)) {
      for (const pasta of readdirSync(base)) {
        const candidato = path.join(base, pasta, "chrome-linux", "chrome");
        if (existsSync(candidato)) return chromium.launch({ executablePath: candidato });
      }
    }
    throw new Error(
      `Nao foi possivel abrir o Chromium. Instale com: npx playwright install chromium\n\n${erro.message}`,
    );
  }
}

// ---------------------------------------------------------------------------

let temporaria;
let servidor;

try {
  const { chromium } = await import("playwright");

  log("preparando a copia temporaria do projeto...");
  await rm(COPIA, { recursive: true, force: true });
  await mkdir(COPIA, { recursive: true });
  temporaria = COPIA;

  for (const item of ["src", "public", "scripts", "next.config.ts", "postcss.config.mjs", "package.json"]) {
    await cp(path.join(RAIZ, item), path.join(temporaria, item), { recursive: true });
  }

  // As substituicoes entram como apelidos de caminho do TypeScript.
  const tsconfig = JSON.parse(await readFile(path.join(RAIZ, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = { ...SUBSTITUICOES, ...tsconfig.compilerOptions.paths };
  await writeFile(path.join(temporaria, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  // Credenciais de fachada: nada aqui chega a falar com o Supabase.
  await writeFile(
    path.join(temporaria, ".env.local"),
    'NEXT_PUBLIC_SUPABASE_URL="https://exemplo.supabase.co"\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY="chave-de-exemplo"\n',
  );

  log("compilando...");
  await executar("npx", ["next", "build"], { cwd: temporaria });

  log(`subindo o servidor na porta ${PORTA}...`);
  servidor = spawn("npx", ["next", "start", "--port", String(PORTA)], {
    cwd: temporaria,
    stdio: "ignore",
    detached: true,
  });
  await esperarNoAr(`http://localhost:${PORTA}/login`);

  log("capturando as telas...");
  await rm(SAIDA, { recursive: true, force: true });
  const navegador = await abrirNavegador(chromium);

  for (const { nome, rota, largura, altura } of TELAS) {
    const pagina = await navegador.newPage({
      viewport: { width: largura, height: altura },
      deviceScaleFactor: 2,
    });
    await pagina.goto(`http://localhost:${PORTA}${rota}`, { waitUntil: "networkidle" });
    await pagina.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: true });
    await pagina.close();
    log(`  ${nome}.png`);
  }

  await navegador.close();
  console.log(`\n  Pronto. As imagens estao em prototipos/\n`);
} catch (erro) {
  console.error(`\n  Falhou: ${erro.message}\n`);
  process.exitCode = 1;
} finally {
  if (servidor?.pid) {
    try {
      process.kill(-servidor.pid);
    } catch {
      /* ja encerrou */
    }
  }
  if (temporaria) await rm(temporaria, { recursive: true, force: true });
}
