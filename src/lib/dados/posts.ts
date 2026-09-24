import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import { deslocarMes, type PostDoPortal } from "@/lib/dominio/posts";
import type { StatusRodada } from "@/lib/supabase/database.types";

/**
 * Os posts que o cliente enxerga.
 *
 * **O ISOLAMENTO NÃO MORA AQUI, e é a mesma decisão de `lib/dados/portal.ts`.**
 * `posts_select_cliente` (migration 0032) já recusa o que é de outra empresa e
 * o que ainda não foi enviado — mesmo que esta consulta esqueça o filtro,
 * mesmo que alguém chame a API do Supabase direto com o id na mão. Aqui só
 * montamos o que passou.
 *
 * `clienteId` existe para a visualização administrativa em `/portal/{slug}`.
 * Para a pessoa cliente ele é dispensável; para quem é da equipe NÃO É:
 * `is_staff()` enxerga todos os clientes, e sem ele o portal de uma empresa
 * mostraria o material de outra.
 */

// Uma string literal, e nao uma concatenacao: o supabase-js tipa o retorno a
// partir do TEXTO do select, e um `+` no meio apaga esse tipo.
// prettier-ignore
const COLUNAS = "id, client_id, tema, legenda, data_publicacao, horario, plataforma, formato, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em";

type LinhaDePost = {
  id: string;
  client_id: string;
  tema: string;
  legenda: string | null;
  data_publicacao: string;
  horario: string | null;
  plataforma: PostDoPortal["plataforma"];
  formato: string | null;
  status: PostDoPortal["status"];
  arte_url: string | null;
  thumbnail_url: string | null;
  versao_atual: number;
  prazo_aprovacao: string | null;
  enviado_em: string | null;
};

type LinhaDeRodada = {
  id: string;
  content_id: string;
  status: StatusRodada;
  numero_rodada: number;
  decidido_por: string | null;
  decidido_em: string | null;
};

/**
 * As rodadas de escopo cliente dos posts pedidos, a mais recente de cada um.
 *
 * Uma consulta para todos os posts da tela, e não uma por cartão: o calendário
 * mostra trinta, e trinta idas ao banco por causa de um selo é o tipo de conta
 * que só aparece quando o mês está cheio.
 */
async function rodadasDosPosts(
  ids: string[],
): Promise<Map<string, LinhaDeRodada>> {
  if (ids.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("approval_rounds")
    .select("id, content_id, status, numero_rodada, decidido_por, decidido_em")
    .eq("content_type", "post")
    .eq("escopo", "cliente")
    .in("content_id", ids)
    .order("numero_rodada", { ascending: false });

  const mapa = new Map<string, LinhaDeRodada>();
  for (const linha of (data ?? []) as LinhaDeRodada[]) {
    // A de maior número é a que vale; as anteriores são o histórico de um
    // ciclo que já fechou.
    if (!mapa.has(linha.content_id)) mapa.set(linha.content_id, linha);
  }
  return mapa;
}

function montar(
  linha: LinhaDePost,
  rodada: LinhaDeRodada | undefined,
  nomes: Map<string, string>,
): PostDoPortal {
  return {
    id: linha.id,
    clienteId: linha.client_id,
    tema: linha.tema,
    legenda: linha.legenda,
    dataPublicacao: linha.data_publicacao,
    horario: linha.horario ? linha.horario.slice(0, 5) : null,
    plataforma: linha.plataforma,
    formato: linha.formato,
    status: linha.status,
    arteUrl: linha.arte_url,
    thumbnailUrl: linha.thumbnail_url ?? linha.arte_url,
    versaoAtual: linha.versao_atual,
    prazoAprovacao: linha.prazo_aprovacao,
    rodadaPendenteId: rodada?.status === "pendente" ? rodada.id : null,
    decididoPor: rodada?.decidido_por
      ? (nomes.get(rodada.decidido_por) ?? null)
      : null,
    decididoEm: rodada?.decidido_em ?? null,
  };
}

async function nomesDe(ids: (string | null)[]): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter(Boolean))] as string[];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", limpos);

  return new Map((data ?? []).map((p) => [p.id, p.nome]));
}

/** Os posts de um mês. `mes` é `AAAA-MM`. */
export async function postsDoMes(
  mes: string,
  clienteId?: string,
): Promise<PostDoPortal[]> {
  const supabase = await criarClienteServidor();

  // O intervalo fecha no primeiro dia do mês seguinte, exclusivo: `lt` em vez
  // de `lte` no último dia evita a conta de quantos dias tem fevereiro.
  const inicio = `${mes}-01`;
  const fim = `${deslocarMes(mes, 1)}-01`;

  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .gte("data_publicacao", inicio)
    .lt("data_publicacao", fim)
    .order("data_publicacao");

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const { data } = await consulta;
  const linhas = (data ?? []) as LinhaDePost[];
  if (linhas.length === 0) return [];

  const rodadas = await rodadasDosPosts(linhas.map((l) => l.id));
  const nomes = await nomesDe([...rodadas.values()].map((r) => r.decidido_por));

  return linhas.map((linha) => montar(linha, rodadas.get(linha.id), nomes));
}

/** Um post, ou null quando o RLS não deixa ver. */
export async function obterPost(
  id: string,
  clienteId?: string,
): Promise<PostDoPortal | null> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("posts").select(COLUNAS).eq("id", id);
  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const { data } = await consulta.maybeSingle();
  if (!data) return null;

  const linha = data as LinhaDePost;
  const rodadas = await rodadasDosPosts([linha.id]);
  const nomes = await nomesDe([rodadas.get(linha.id)?.decidido_por ?? null]);

  return montar(linha, rodadas.get(linha.id), nomes);
}

/** O histórico de versões, da mais nova para a mais antiga. */
export type VersaoDoPost = {
  id: string;
  numero: number;
  arteUrl: string | null;
  legenda: string | null;
  notas: string | null;
  quando: string;
  quem: string | null;
};

export async function versoesDoPost(postId: string): Promise<VersaoDoPost[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("post_versions")
    .select(
      "id, numero_versao, arte_url, legenda, notas_mudanca, criado_por, created_at",
    )
    .eq("post_id", postId)
    .order("numero_versao", { ascending: false });

  const linhas = data ?? [];
  const nomes = await nomesDe(linhas.map((l) => l.criado_por));

  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero_versao,
    arteUrl: l.arte_url,
    legenda: l.legenda,
    notas: l.notas_mudanca,
    quando: l.created_at,
    quem: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
  }));
}

/**
 * A conversa do post.
 *
 * **O comentário interno não é filtrado aqui**, e é de propósito: quem o
 * esconde é `comments_select_cliente`, que exige `interno = false`. Repetir o
 * filtro criaria um segundo lugar onde a regra pode divergir — e para a
 * equipe, que lê os dois, a consulta é a mesma.
 */
export type ComentarioDoPost = {
  id: string;
  texto: string;
  quando: string;
  autorId: string;
  autor: string;
  daAgencia: boolean;
  interno: boolean;
  respostaA: string | null;
};

export async function comentariosDoPost(
  postId: string,
): Promise<ComentarioDoPost[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("comments")
    .select("id, texto, created_at, autor_id, interno, resposta_a")
    .eq("content_type", "post")
    .eq("content_id", postId)
    .order("created_at");

  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const { data: pessoas } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("id", [...new Set(linhas.map((l) => l.autor_id))]);

  const porId = new Map((pessoas ?? []).map((p) => [p.id, p]));

  return linhas.map((l) => {
    const pessoa = porId.get(l.autor_id);
    return {
      id: l.id,
      texto: l.texto,
      quando: l.created_at,
      autorId: l.autor_id,
      autor: pessoa?.nome ?? "Alguém",
      // Quem não é cliente é da agência. A identificação na thread é essa, e
      // não o cargo: o cliente não precisa saber quem é desenvolvedor.
      daAgencia: pessoa?.role !== "cliente",
      interno: l.interno,
      respostaA: l.resposta_a,
    };
  });
}

/**
 * As artes, assinadas.
 *
 * O bucket é privado — arte de post não publicado é material da agência, e
 * URL pública é URL que circula antes de o cliente ter decidido. As assinadas
 * valem uma hora e saem sob a sessão de quem pediu, então o RLS do Storage
 * continua valendo.
 *
 * Um endereço que já começa com `http` passa direto: nem toda arte mora no
 * bucket — algumas são link de Drive ou de Figma, e assinar um endereço que
 * não é do Storage devolveria erro e apagaria a imagem da tela.
 */
export async function urlsDasArtes(
  caminhos: (string | null)[],
): Promise<Record<string, string>> {
  const doBucket = [
    ...new Set(
      caminhos.filter(
        (c): c is string => Boolean(c) && !/^https?:\/\//i.test(c!),
      ),
    ),
  ];
  if (doBucket.length === 0) return {};

  const supabase = await criarClienteServidor();
  const { data } = await supabase.storage
    .from("posts-artes")
    .createSignedUrls(doBucket, 3600);

  const mapa: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  }
  return mapa;
}

/** O endereço final de uma arte: o assinado quando existe, o cru quando é link. */
export function enderecoDaArte(
  caminho: string | null,
  assinadas: Record<string, string>,
): string | null {
  if (!caminho) return null;
  return assinadas[caminho] ?? caminho;
}
