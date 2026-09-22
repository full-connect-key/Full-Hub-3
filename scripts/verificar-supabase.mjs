#!/usr/bin/env node
/**
 * Verifica a conexao com o Supabase direto do terminal:
 *
 *   npm run check:supabase
 *
 * Roda sem subir o Next e sem dependencia extra. Serve tanto na maquina de
 * desenvolvimento quanto na VPS, antes do primeiro deploy -- que e justamente
 * quando ainda nao ha dominio nem navegador para testar.
 *
 * Sai com codigo 1 se algo essencial falhar, entao tambem pode ser usado em
 * pipeline de deploy.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VERDE = "\x1b[32m";
const AMARELO = "\x1b[33m";
const VERMELHO = "\x1b[31m";
const CINZA = "\x1b[90m";
const RESET = "\x1b[0m";

/** Le um .env simples: CHAVE=valor, com ou sem aspas, ignorando comentarios. */
function lerArquivoEnv(caminho) {
  try {
    const conteudo = readFileSync(resolve(process.cwd(), caminho), "utf8");
    const valores = {};
    for (const linha of conteudo.split("\n")) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const separador = limpa.indexOf("=");
      if (separador === -1) continue;
      const chave = limpa.slice(0, separador).trim();
      const valor = limpa
        .slice(separador + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      valores[chave] = valor;
    }
    return valores;
  } catch {
    return null;
  }
}

// Precedencia: o que ja esta no ambiente real ganha do arquivo (na VPS as
// variaveis costumam vir do PM2 ou do systemd, nao de um .env).
const doArquivo = lerArquivoEnv(".env.local") ?? lerArquivoEnv(".env") ?? {};
const env = { ...doArquivo, ...process.env };

const URL_SUPABASE = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const CHAVE_ANON = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const CHAVE_SERVICO = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

let houveFalha = false;

function ok(titulo, detalhe = "") {
  console.log(`${VERDE}  ok ${RESET} ${titulo}${detalhe ? ` ${CINZA}${detalhe}${RESET}` : ""}`);
}
function alerta(titulo, detalhe = "") {
  console.log(`${AMARELO}  !  ${RESET} ${titulo}${detalhe ? ` ${CINZA}${detalhe}${RESET}` : ""}`);
}
function falha(titulo, comoResolver = "") {
  houveFalha = true;
  console.log(`${VERMELHO}  x  ${RESET} ${titulo}`);
  if (comoResolver) console.log(`       ${CINZA}${comoResolver}${RESET}`);
}

console.log("\nVerificando a conexao com o Supabase\n");

// 1. Variaveis -------------------------------------------------------------
const faltando = [];
if (!URL_SUPABASE) faltando.push("NEXT_PUBLIC_SUPABASE_URL");
if (!CHAVE_ANON) faltando.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (faltando.length > 0) {
  falha(
    `Variaveis faltando: ${faltando.join(", ")}`,
    "Rode `cp .env.local.example .env.local` e preencha com os dados do projeto no painel do Supabase.",
  );
  console.log("");
  process.exit(1);
}
ok("Variaveis de ambiente", new URL(URL_SUPABASE).host);

// 2. O servidor responde? --------------------------------------------------
try {
  const resposta = await fetch(`${URL_SUPABASE}/auth/v1/health`, {
    headers: { apikey: CHAVE_ANON },
    signal: AbortSignal.timeout(8000),
  });

  if (resposta.ok) {
    ok("Servico de autenticacao", `HTTP ${resposta.status}`);
  } else if (resposta.status === 401) {
    falha(
      "O projeto recusou a chave anon (HTTP 401)",
      "A URL e a chave precisam ser do mesmo projeto. Confira em Project Settings > API Keys.",
    );
  } else {
    falha(
      `Resposta inesperada do Supabase (HTTP ${resposta.status})`,
      "Verifique se o projeto esta ativo -- projetos no plano gratuito hibernam apos um periodo sem uso.",
    );
  }
} catch (erro) {
  falha(
    `Nao foi possivel alcancar ${URL_SUPABASE}`,
    `${erro.message}. Confira a URL e a saida de internet desta maquina.`,
  );
}

// 3. A migration foi aplicada? --------------------------------------------
try {
  const resposta = await fetch(`${URL_SUPABASE}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: CHAVE_ANON, Authorization: `Bearer ${CHAVE_ANON}` },
    signal: AbortSignal.timeout(8000),
  });

  if (resposta.ok) {
    ok("Tabela public.profiles", "encontrada, com RLS ativo");
  } else if (resposta.status === 404) {
    alerta(
      "Tabela public.profiles ainda nao existe",
      "Cole supabase/migrations/0002_estrutura_base.sql no SQL Editor do Supabase e clique em Run.",
    );
  } else {
    const corpo = await resposta.text();
    alerta(`Tabela public.profiles respondeu HTTP ${resposta.status}`, corpo.slice(0, 160));
  }
} catch (erro) {
  alerta("Nao foi possivel checar a tabela profiles", erro.message);
}

// 4. Chave de servico (opcional) ------------------------------------------
if (CHAVE_SERVICO) {
  ok("Chave de servico", "configurada (somente servidor)");
} else {
  alerta(
    "SUPABASE_SERVICE_ROLE_KEY nao configurada",
    "Opcional: so e necessaria para rotinas administrativas.",
  );
}

console.log("");
if (houveFalha) {
  console.log(`${VERMELHO}Conexao com problema.${RESET} Resolva os itens marcados com x e rode de novo.\n`);
  process.exit(1);
}
console.log(`${VERDE}Conexao com o Supabase funcionando.${RESET}\n`);
