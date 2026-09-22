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
 *   O projeto e copiado para .prototipo/. So nessa copia, alguns modulos sao
 *   trocados por versoes de exemplo (scripts/prototipo/) usando apelidos de
 *   caminho do TypeScript, e o proxy vira um que deixa tudo passar. Nenhum
 *   arquivo de src/ e alterado, e a copia e apagada no fim.
 *
 *   Por isso o codigo que pula o login NAO existe no app publicado: ele vive
 *   apenas dentro da copia temporaria.
 *
 *   O perfil vem de PROTOTIPO_ROLE, entao o mesmo build mostra o painel como
 *   colaborador, desenvolvedor ou socio -- o servidor e reiniciado a cada
 *   perfil.
 *
 * A CADA SPRINT
 *   1. acrescente os dados ficticios em scripts/prototipo/dados-exemplo.ts
 *   2. acrescente a tela nova na lista TELAS logo abaixo
 *   3. se a tela so existe para o prototipo (como a de 403), crie a rota em
 *      scripts/prototipo/extras/ -- ela e copiada para dentro de src/app/ da
 *      copia e nunca vai para o app publicado
 */

import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Telas capturadas.
//   role  -> perfil usado (padrao: socio). Telas do portal ignoram.
//   tema  -> "escuro" para capturar no modo escuro.
//   menu  -> "recolhido" para capturar com o menu lateral fechado.
// ---------------------------------------------------------------------------
const TELAS = [
  { nome: "01-login", rota: "/login", largura: 900, altura: 760 },
  { nome: "02-login-escuro", rota: "/login", largura: 900, altura: 760, tema: "escuro" },
  { nome: "03-login-sessao-expirada", rota: "/login?motivo=inatividade", largura: 900, altura: 800 },
  { nome: "04-esqueci-senha", rota: "/esqueci-senha", largura: 900, altura: 760 },

  { nome: "05-painel-socio", rota: "/painel", largura: 1440, altura: 860, role: "socio" },
  { nome: "06-painel-socio-escuro", rota: "/painel", largura: 1440, altura: 860, role: "socio", tema: "escuro" },
  { nome: "07-painel-menu-recolhido", rota: "/painel", largura: 1440, altura: 860, role: "socio", menu: "recolhido" },
  { nome: "08-painel-colaborador", rota: "/painel", largura: 1440, altura: 860, role: "colaborador" },
  { nome: "09-painel-desenvolvedor", rota: "/painel", largura: 1440, altura: 860, role: "desenvolvedor" },

  { nome: "10-clientes-lista", rota: "/painel/clientes", largura: 1440, altura: 900, role: "socio" },
  { nome: "10b-clientes-novo", rota: "/painel/clientes", largura: 1440, altura: 1000, role: "socio", clicar: 'button:has-text("Novo cliente")' },
  { nome: "10c-cliente-dados", rota: "/painel/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 1000, role: "socio" },
  { nome: "10d-cliente-usuarios", rota: "/painel/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 800, role: "socio", clicar: 'button:has-text("Usuários com acesso")' },
  { nome: "10e-equipe-lista", rota: "/painel/equipe", largura: 1440, altura: 900, role: "socio" },
  { nome: "10f-colaborador-dados", rota: "/painel/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 1400, role: "socio" },
  { nome: "10g-desligamento", rota: "/painel/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 1000, role: "socio", clicar: 'button:has-text("Desligar da equipe")' },
  { nome: "10j-colaborador-desativar", rota: "/painel/equipe/a0000000-0000-0000-0000-000000000003", largura: 1440, altura: 900, role: "desenvolvedor", clicar: 'button:has-text("Desativar acesso")' },
  { nome: "10k-cliente-exclusao-barrada", rota: "/painel/clientes/c0000000-0000-0000-0000-00000000000a", largura: 1440, altura: 900, role: "socio", clicar: 'button:has-text("Excluir definitivamente")' },
  { nome: "10h-meu-perfil", rota: "/painel/perfil", largura: 1440, altura: 1000, role: "socio" },
  { nome: "10i-equipe-desenvolvedor", rota: "/painel/equipe", largura: 1440, altura: 900, role: "desenvolvedor", clicar: 'button:has-text("Adicionar colaborador")' },

  { nome: "20-tasks-board", rota: "/painel/gestao-tasks", largura: 1600, altura: 1000, role: "socio" },
  { nome: "21-tasks-board-escuro", rota: "/painel/gestao-tasks", largura: 1600, altura: 1000, role: "socio", tema: "escuro" },
  { nome: "22-tasks-lista", rota: "/painel/gestao-tasks?visao=lista", largura: 1600, altura: 900, role: "socio" },
  { nome: "23-tasks-calendario", rota: "/painel/gestao-tasks?visao=calendario", largura: 1600, altura: 1100, role: "socio" },
  { nome: "24-tasks-nova", rota: "/painel/gestao-tasks", largura: 1400, altura: 1200, role: "socio", clicar: 'button:has-text("Nova task")' },
  { nome: "25-task-detalhe", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 1400, role: "socio" },
  { nome: "26-tasks-so-atrasadas", rota: "/painel/gestao-tasks?visao=lista&atrasadas=1", largura: 1600, altura: 800, role: "socio" },
  { nome: "30-minhas-tasks-lista", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio" },
  { nome: "31-minhas-tasks-board", rota: "/painel/minhas-tasks?visao=board", largura: 1600, altura: 1100, role: "socio" },
  { nome: "32-minhas-tasks-calendario", rota: "/painel/minhas-tasks?visao=calendario", largura: 1600, altura: 1300, role: "socio" },
  { nome: "33-minhas-tasks-atrasadas", rota: "/painel/minhas-tasks?foco=atrasadas", largura: 1600, altura: 1000, role: "socio" },
  { nome: "34-minhas-tasks-escuro", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio", tema: "escuro" },
  { nome: "35-minhas-tasks-detalhe", rota: "/painel/minhas-tasks", largura: 1600, altura: 1200, role: "socio", clicar: 'button:has-text("Revisar o manual")' },
  { nome: "36-minhas-tasks-atendimento", rota: "/painel/minhas-tasks", largura: 1600, altura: 900, role: "colaborador" },
  { nome: "37-minhas-tasks-sem-criar", rota: "/painel/minhas-tasks", largura: 1600, altura: 900, role: "colaborador-social" },
  { nome: "38-concluir-pede-tempo", rota: "/painel/minhas-tasks", largura: 1400, altura: 900, role: "socio", clicar: 'button:has-text("Concluir")' },

  { nome: "40-aprovacoes-internas", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 1000, role: "desenvolvedor" },
  { nome: "41-aprovacoes-internas-socio", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 1000, role: "socio" },
  { nome: "42-aprovacoes-ajustes", rota: "/painel/aprovacoes-internas", largura: 1200, altura: 800, role: "socio", clicar: 'button:has-text("Solicitar ajustes")' },
  { nome: "43-tipos-de-tarefa", rota: "/painel/workflows", largura: 1440, altura: 1000, role: "socio" },
  { nome: "45-tipo-de-tarefa-editor", rota: "/painel/workflows", largura: 1440, altura: 1300, role: "socio", clicar: 'button:has-text("Novo tipo de tarefa")' },
  { nome: "48-enviar-aprovacao", rota: "/painel/minhas-tasks", largura: 1400, altura: 900, role: "colaborador-social", clicar: 'button:has-text("Enviar para aprovação")' },
  { nome: "49-aprovacao-propria", rota: "/painel/aprovacoes-internas", largura: 1440, altura: 900, role: "desenvolvedor" },
  { nome: "46-subtarefa-painel", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 1300, role: "socio", clicar: 'button:has-text("Criar KV")' },
  { nome: "47-task-historico", rota: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111", largura: 1600, altura: 900, role: "socio", clicar: '[role="tab"]:has-text("Histórico")' },

  // --- Sprint 3C: identidade, tela inicial e portais de clientes ---------
  { nome: "50-inicio-socio", rota: "/painel", largura: 1600, altura: 1100, role: "socio" },
  { nome: "51-inicio-colaborador", rota: "/painel", largura: 1600, altura: 900, role: "colaborador" },
  { nome: "52-inicio-escuro", rota: "/painel", largura: 1600, altura: 1100, role: "socio", tema: "escuro" },
  { nome: "53-inicio-celular", rota: "/painel", largura: 390, altura: 1100, role: "socio" },
  { nome: "54-sino", rota: "/painel", largura: 1600, altura: 900, role: "socio", clicar: 'button[aria-label^="Notificações"]' },
  { nome: "55-resumo-semanal", rota: "/painel/resumo-semanal", largura: 1440, altura: 900, role: "socio" },
  { nome: "56-resumo-nova-entrega", rota: "/painel/resumo-semanal", largura: 1200, altura: 900, role: "socio", clicar: 'button:has-text("Adicionar Entrega")' },
  { nome: "57-notas-fiscais", rota: "/painel/notas-fiscais", largura: 1440, altura: 700, role: "colaborador" },
  { nome: "58-perfil-financeiro", rota: "/painel/perfil", largura: 1440, altura: 900, role: "socio", clicar: '[role="tab"]:has-text("Financeiro Pessoal")' },
  { nome: "59-portal-do-cliente-pela-equipe", rota: "/portal/mundo-verde", largura: 1400, altura: 1000, role: "socio" },

  // --- Sprint 6: Full Days -----------------------------------------------
  { nome: "60-full-days-solicitar", rota: "/painel/full-days", largura: 1600, altura: 1200, role: "socio" },
  { nome: "61-full-days-matriz", rota: "/painel/full-days?aba=matriz", largura: 1700, altura: 900, role: "socio" },
  { nome: "62-full-days-relatorio", rota: "/painel/full-days?aba=relatorio", largura: 1600, altura: 1300, role: "socio" },
  { nome: "63-full-days-aprovacoes", rota: "/painel/full-days?aba=aprovacoes", largura: 1500, altura: 900, role: "socio" },
  { nome: "64-full-days-reprovar", rota: "/painel/full-days?aba=aprovacoes", largura: 1200, altura: 800, role: "socio", clicar: 'button:has-text("Reprovar")' },
  { nome: "65-full-days-colaborador", rota: "/painel/full-days", largura: 1600, altura: 1200, role: "colaborador" },
  { nome: "66-full-days-matriz-escuro", rota: "/painel/full-days?aba=matriz", largura: 1700, altura: 900, role: "socio", tema: "escuro" },

  // --- Sprint 7: Desenvolvimento e Skills --------------------------------
  { nome: "67-meu-desenvolvimento", rota: "/painel/meu-desenvolvimento", largura: 1500, altura: 1300, role: "colaborador" },
  { nome: "68-equipe-skills", rota: "/painel/equipe", largura: 1700, altura: 1200, role: "socio", clicar: '[role="tab"]:has-text("Skills")' },
  { nome: "69-resumo-semanal-nota", rota: "/painel/resumo-semanal", largura: 1440, altura: 1200, role: "socio" },
  { nome: "70-resumo-semanal-busca", rota: "/painel/resumo-semanal?busca=campanha", largura: 1440, altura: 900, role: "socio" },
  { nome: "71-meu-desenvolvimento-escuro", rota: "/painel/meu-desenvolvimento", largura: 1500, altura: 1300, role: "colaborador", tema: "escuro" },

  // --- Sprint 8: Financeiro ----------------------------------------------
  { nome: "72-financeiro-visao-geral", rota: "/painel/financeiro", largura: 1700, altura: 1500, role: "socio" },
  { nome: "73-financeiro-lancamentos", rota: "/painel/financeiro?aba=lancamentos", largura: 1700, altura: 1100, role: "socio" },
  { nome: "74-financeiro-novo-lancamento", rota: "/painel/financeiro?aba=lancamentos", largura: 1300, altura: 1100, role: "socio", clicar: 'button:has-text("Novo lançamento")' },
  { nome: "75-financeiro-contratos", rota: "/painel/financeiro?aba=contratos", largura: 1700, altura: 800, role: "socio" },
  { nome: "76-financeiro-relatorios", rota: "/painel/financeiro?aba=relatorios", largura: 1700, altura: 1400, role: "socio" },
  { nome: "77-financeiro-visao-geral-escuro", rota: "/painel/financeiro", largura: 1700, altura: 1500, role: "socio", tema: "escuro" },
  { nome: "78-financeiro-pessoal", rota: "/painel/financeiro-pessoal", largura: 1600, altura: 1400, role: "colaborador" },
  { nome: "79-financeiro-pessoal-escuro", rota: "/painel/financeiro-pessoal", largura: 1600, altura: 1400, role: "colaborador", tema: "escuro" },

  { nome: "11-componentes", rota: "/painel/dev/componentes", largura: 1440, altura: 1200, role: "socio" },
  { nome: "12-componentes-escuro", rota: "/painel/dev/componentes", largura: 1440, altura: 1200, role: "socio", tema: "escuro" },

  { nome: "13-acesso-negado-403", rota: "/403-exemplo", largura: 900, altura: 700 },
  { nome: "14-status-da-conexao", rota: "/status", largura: 1000, altura: 1000 },

  { nome: "15-portal", rota: "/portal", largura: 1280, altura: 800 },
  { nome: "16-portal-social-media", rota: "/portal/social-media", largura: 1280, altura: 700 },
  { nome: "16b-portal-aprovacoes", rota: "/portal/aprovacoes", largura: 1280, altura: 1000 },
  { nome: "16c-portal-pedir-ajustes", rota: "/portal/aprovacoes", largura: 1100, altura: 800, clicar: 'button:has-text("Solicitar ajustes")' },
  { nome: "17-portal-escuro", rota: "/portal", largura: 1280, altura: 800, tema: "escuro" },

  { nome: "18-painel-celular", rota: "/painel", largura: 390, altura: 844, role: "socio" },
  { nome: "19-portal-celular", rota: "/portal", largura: 390, altura: 844 },
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
  "@/lib/dados/clientes": ["./scripts/prototipo/clientes.ts"],
  "@/lib/dados/equipe": ["./scripts/prototipo/equipe.ts"],
  "@/lib/dados/acessos": ["./scripts/prototipo/acessos.ts"],
  "@/lib/dados/tasks": ["./scripts/prototipo/tasks.ts"],
  "@/lib/dados/minhas-tasks": ["./scripts/prototipo/minhas-tasks.ts"],
  "@/lib/dados/workflows": ["./scripts/prototipo/workflows.ts"],
  "@/lib/dados/aprovacoes": ["./scripts/prototipo/aprovacoes.ts"],
  "@/lib/dados/portal-aprovacoes": ["./scripts/prototipo/portal-aprovacoes.ts"],
  "@/lib/dados/notificacoes": ["./scripts/prototipo/notificacoes.ts"],
  "@/lib/dados/portais-de-clientes": ["./scripts/prototipo/portais-de-clientes.ts"],
  "@/lib/dados/resumo-semanal": ["./scripts/prototipo/resumo-semanal.ts"],
  "@/lib/dados/full-days": ["./scripts/prototipo/full-days.ts"],
  "@/lib/dados/skills": ["./scripts/prototipo/skills.ts"],
  "@/lib/dados/financeiro": ["./scripts/prototipo/financeiro.ts"],
  "@/lib/dados/financeiro-pessoal": ["./scripts/prototipo/financeiro-pessoal.ts"],
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

/**
 * Perfis usados nas capturas.
 *
 * `funcao` existe porque perfil de acesso e funcao na agencia sao coisas
 * separadas, e o produto depende disso: um colaborador do Atendimento cria
 * task, um de Social Media nao. Sem os dois, nao daria para mostrar a
 * diferenca em imagem.
 */
const PERFIS = {
  socio: { role: "socio" },
  desenvolvedor: { role: "desenvolvedor" },
  colaborador: { role: "colaborador", funcao: "Atendimento" },
  "colaborador-social": { role: "colaborador", funcao: "Social Media" },
};

function subirServidor(perfil) {
  const { role, funcao } = PERFIS[perfil] ?? PERFIS.socio;
  return spawn("npx", ["next", "start", "--port", String(PORTA)], {
    cwd: COPIA,
    stdio: "ignore",
    detached: true,
    env: { ...process.env, PROTOTIPO_ROLE: role, PROTOTIPO_FUNCAO: funcao ?? "" },
  });
}

function encerrar(servidor) {
  if (!servidor?.pid) return;
  try {
    process.kill(-servidor.pid);
  } catch {
    /* ja encerrou */
  }
}

// ---------------------------------------------------------------------------

let servidor;

try {
  const { chromium } = await import("playwright");

  log("preparando a copia temporaria do projeto...");
  await rm(COPIA, { recursive: true, force: true });
  await mkdir(COPIA, { recursive: true });

  for (const item of ["src", "public", "scripts", "next.config.ts", "postcss.config.mjs", "package.json"]) {
    await cp(path.join(RAIZ, item), path.join(COPIA, item), { recursive: true });
  }

  // Rotas que existem so no prototipo, como a que dispara a tela de 403.
  await cp(path.join(RAIZ, "scripts", "prototipo", "extras"), path.join(COPIA, "src", "app"), {
    recursive: true,
  });

  // O proxy e carregado pelo Next por caminho fixo, e nao por apelido, entao a
  // substituicao dele e uma copia por cima. Sem isso /login redirecionaria
  // para /painel e as telas publicas nao dariam para fotografar.
  await cp(
    path.join(RAIZ, "scripts", "prototipo", "proxy-raiz.ts"),
    path.join(COPIA, "src", "proxy.ts"),
  );

  const tsconfig = JSON.parse(await readFile(path.join(RAIZ, "tsconfig.json"), "utf8"));
  tsconfig.compilerOptions.paths = { ...SUBSTITUICOES, ...tsconfig.compilerOptions.paths };
  await writeFile(path.join(COPIA, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  // O dominio .invalid nunca resolve, e de proposito: as poucas consultas que
  // escapam das substituicoes falham na hora, em vez de segurar a captura
  // esperando um servidor que nao existe.
  await writeFile(
    path.join(COPIA, ".env.local"),
    'NEXT_PUBLIC_SUPABASE_URL="https://exemplo.invalid"\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY="chave-de-exemplo"\n',
  );

  log("compilando...");
  await executar("npx", ["next", "build"], { cwd: COPIA });

  await rm(SAIDA, { recursive: true, force: true });
  const navegador = await abrirNavegador(chromium);

  // Agrupa por perfil para reiniciar o servidor o mínimo possível.
  const perfis = [...new Set(TELAS.map((tela) => tela.role ?? "socio"))];

  for (const perfil of perfis) {
    log(`subindo o servidor como ${perfil}...`);
    servidor = subirServidor(perfil);
    await esperarNoAr(`http://localhost:${PORTA}/login`);

    for (const tela of TELAS.filter((t) => (t.role ?? "socio") === perfil)) {
      const pagina = await navegador.newPage({
        viewport: { width: tela.largura, height: tela.altura },
        deviceScaleFactor: 2,
        colorScheme: tela.tema === "escuro" ? "dark" : "light",
        locale: "pt-BR",
      });

      if (tela.menu) {
        await pagina.addInitScript(
          (estado) => localStorage.setItem("full-hub:menu", estado),
          tela.menu,
        );
      }

      await pagina.goto(`http://localhost:${PORTA}${tela.rota}`, { waitUntil: "networkidle" });

      // Algumas telas só aparecem depois de um clique -- uma aba, um diálogo.
      // O app roda de verdade aqui, então o Radix responde normalmente.
      let faltou = null;
      if (tela.clicar) {
        // Uma lista de seletores quando a tela precisa de mais de um clique --
        // abrir a aba antes do dialogo, por exemplo.
        //
        // Um seletor que nao casa NAO derruba a geracao inteira: ele espera 8
        // segundos, avisa e a tela sai sem o clique. Uma rodada completa leva
        // dez minutos, e perde-la por causa de um nome de botao que mudou
        // custa caro demais.
        for (const passo of Array.isArray(tela.clicar) ? tela.clicar : [tela.clicar]) {
          try {
            await pagina.click(passo, { timeout: 8000 });
            await pagina.waitForTimeout(250);
          } catch {
            faltou = passo;
            break;
          }
        }
        await pagina.waitForTimeout(400);
      }

      await pagina.screenshot({ path: path.join(SAIDA, `${tela.nome}.png`), fullPage: true });
      await pagina.close();
      log(faltou ? `  ${tela.nome}.png  (sem o clique: ${faltou})` : `  ${tela.nome}.png`);
    }

    encerrar(servidor);
    servidor = undefined;
  }

  await navegador.close();
  console.log(`\n  Pronto. As imagens estao em prototipos/\n`);
} catch (erro) {
  console.error(`\n  Falhou: ${erro.message}\n`);
  process.exitCode = 1;
} finally {
  encerrar(servidor);
  // PROTOTIPO_MANTER_COPIA=1 preserva .prototipo/ para capturar o HTML das
  // telas (e montar a versao clicavel). Fora disso a copia sempre some.
  if (!process.env.PROTOTIPO_MANTER_COPIA) {
    await rm(COPIA, { recursive: true, force: true });
  } else {
    console.log(`  Copia preservada em ${COPIA} (PROTOTIPO_MANTER_COPIA).`);
  }
}
