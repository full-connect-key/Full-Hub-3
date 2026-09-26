import "server-only";

import { createSign } from "node:crypto";

import {
  chavePrivada,
  contaDeServico,
  driveCompartilhado,
  driveConfigurado,
  escaparParaBusca,
  nomeDePasta,
} from "./config";

/**
 * A conversa com o Google Drive (Sprint 16, Parte C).
 *
 * ---------------------------------------------------------------------------
 * **É `fetch` E `node:crypto`, e não o pacote `googleapis`.**
 *
 * O que o produto faz no Drive são três chamadas: pegar um token, procurar
 * uma pasta, criar uma pasta. O `googleapis` traz o cliente de **todas** as
 * APIs do Google para servir isso — dezenas de megabytes de tipos e um ciclo
 * de versão próprio para economizar as quarenta linhas de JWT abaixo.
 *
 * É a terceira vez que o projeto faz essa conta e dá no mesmo: os gráficos
 * são SVG à mão porque toda biblioteca traz a própria paleta, a marca é SVG à
 * mão porque um PNG congelaria a cor, e o Resend é um `fetch` porque a API é
 * um POST com quatro campos.
 * ---------------------------------------------------------------------------
 *
 * **NADA AQUI APAGA, MOVE OU RENOMEIA.** As únicas coisas que este módulo
 * sabe fazer são procurar e criar — e é escolha, não falta de tempo. Uma
 * integração que pode apagar precisa de uma pergunta antes de cada chamada, e
 * o que ela apagaria é o material entregue de um cliente. O caminho para
 * remover uma pasta é o Drive, com o histórico e a lixeira dele.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";
const TIPO_PASTA = "application/vnd.google-apps.folder";

/**
 * O escopo é `drive.file`, e não `drive`.
 *
 * `drive.file` dá acesso **só ao que esta aplicação criou** — ela não enxerga
 * nem toca em nada que já estava no Drive da agência. O escopo largo
 * (`drive`) funcionaria igual para o que o produto faz e entregaria, junto, a
 * chave de tudo o que a agência guarda: contrato, financeiro, o Drive
 * inteiro. É a mesma razão pela qual a chave de serviço do Supabase é lida em
 * um arquivo só.
 *
 * **A consequência aceita:** uma pasta criada à mão no Drive não é encontrada
 * por `acharPasta()`. Na prática isso significa que, para um cliente que já
 * tem pasta, alguém cola o id dela na ficha — que é o campo que já existe
 * desde a 0002 — e o Full Hub passa a criar as demandas lá dentro.
 */
const ESCOPO = "https://www.googleapis.com/auth/drive.file";

const TEMPO_LIMITE_MS = 10000;

/** O token dura uma hora; guardar evita uma ida ao Google por pasta criada. */
let tokenEmCache: { valor: string; expiraEm: number } | null = null;

function base64url(entrada: Buffer | string): string {
  return Buffer.from(entrada)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * O token de acesso, por JWT assinado.
 *
 * A conta de serviço não faz login: ela assina um JWT com a própria chave
 * privada e troca por um token. É o fluxo `urn:ietf:params:oauth:grant-type:jwt-bearer`,
 * e ele existe exatamente para o caso de não haver uma pessoa do outro lado
 * para clicar em "permitir".
 */
async function token(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);

  // 60 segundos de folga: um token que expira no meio da requisição volta
  // como 401, e o erro fala de autorização e não de relógio.
  if (tokenEmCache && tokenEmCache.expiraEm > agora + 60) return tokenEmCache.valor;

  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: contaDeServico(),
      scope: ESCOPO,
      aud: TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    }),
  );

  const assinatura = createSign("RSA-SHA256")
    .update(`${cabecalho}.${corpo}`)
    .sign(chavePrivada());

  const jwt = `${cabecalho}.${corpo}.${base64url(assinatura)}`;

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) {
    throw new Error(
      `Google recusou a conta de serviço: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as { access_token: string; expires_in: number };
  tokenEmCache = { valor: dados.access_token, expiraEm: agora + dados.expires_in };
  return dados.access_token;
}

export type PastaNoDrive = { id: string; url: string };

function urlDaPasta(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/**
 * Procura uma pasta pelo nome, dentro de outra.
 *
 * **`trashed = false` não é detalhe.** Sem ele, uma pasta que alguém mandou
 * para a lixeira continua voltando na busca — e o Full Hub gravaria um
 * endereço que abre em "este item está no lixo". Pior que não achar.
 *
 * **Os três parâmetros de Drive Compartilhado também não são opcionais:** sem
 * `supportsAllDrives` e `includeItemsFromAllDrives`, a API responde como se o
 * Drive Compartilhado não existisse — lista vazia, sem erro nenhum. É o modo
 * de falha de sempre, e aqui ele faria o produto criar uma pasta nova a cada
 * demanda do mesmo cliente.
 */
export async function acharPasta(
  nome: string,
  dentroDe: string,
): Promise<PastaNoDrive | null> {
  const consulta = [
    `name = '${escaparParaBusca(nomeDePasta(nome))}'`,
    `'${escaparParaBusca(dentroDe)}' in parents`,
    `mimeType = '${TIPO_PASTA}'`,
    "trashed = false",
  ].join(" and ");

  const url = new URL(DRIVE_URL);
  url.searchParams.set("q", consulta);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  url.searchParams.set("corpora", "drive");
  url.searchParams.set("driveId", driveCompartilhado());

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${await token()}` },
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) {
    throw new Error(
      `Drive recusou a busca: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as { files?: { id: string }[] };
  const achada = dados.files?.[0];
  return achada ? { id: achada.id, url: urlDaPasta(achada.id) } : null;
}

/** Cria a pasta. Não pergunta se já existe — quem pergunta é quem chama. */
export async function criarPasta(
  nome: string,
  dentroDe: string,
): Promise<PastaNoDrive> {
  const url = new URL(DRIVE_URL);
  url.searchParams.set("fields", "id");
  url.searchParams.set("supportsAllDrives", "true");

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: nomeDePasta(nome),
      mimeType: TIPO_PASTA,
      parents: [dentroDe],
    }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) {
    throw new Error(
      `Drive recusou criar a pasta: HTTP ${resposta.status} ${(await resposta.text()).slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as { id: string };
  return { id: dados.id, url: urlDaPasta(dados.id) };
}

/**
 * Acha ou cria — nesta ordem.
 *
 * **Procurar antes é o que impede a segunda pasta com o mesmo nome.** O Drive
 * aceita duas irmãs homônimas sem reclamar, e o sintoma seria o pior tipo:
 * metade do material de um cliente numa pasta e metade na outra, as duas com
 * o nome certo.
 *
 * **Não é atômico, e o custo está dito.** Dois cliques ao mesmo tempo na
 * mesma demanda passam pelas duas buscas antes de qualquer uma criar — é o
 * furo que a recorrência resolveu com índice único, e que aqui não tem como
 * resolver, porque quem guarda a unicidade é o Drive e ele não oferece uma.
 * O estrago é uma pasta vazia a mais, que alguém apaga; o caminho oposto —
 * criar sem procurar — espalharia o material entre duas.
 */
export async function acharOuCriarPasta(
  nome: string,
  dentroDe: string,
): Promise<PastaNoDrive> {
  if (!driveConfigurado()) {
    throw new Error("Google Drive não configurado.");
  }

  return (await acharPasta(nome, dentroDe)) ?? (await criarPasta(nome, dentroDe));
}
