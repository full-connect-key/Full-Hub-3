import "server-only";

import { assinarArquivos, nomesDe, rodadasDo } from "@/lib/dados/conteudo";
import { deslocarMes } from "@/lib/dominio/posts";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ArquivoDaVersao,
  ContentStatus,
  PlataformaSocial,
  PostMidia,
} from "@/lib/supabase/database.types";

/**
 * O Social Media do lado da AGÊNCIA.
 *
 * **Arquivo separado de `lib/dados/posts.ts`, e a separação é o ponto.** Aquele
 * monta o que o cliente enxerga e nunca traz post em produção; este monta o
 * que a equipe vê, que é tudo. Compartilhar a consulta levaria a um `if` no
 * meio de cada `select`, e o `if` errado ali é material da agência aparecendo
 * na tela de quem não devia ver — o erro mais caro que este produto pode ter.
 *
 * **Nenhuma consulta repete filtro de permissão.** `posts_select` fecha em
 * `is_staff()` desde a 0032. Repetir aqui criaria o segundo lugar onde a regra
 * pode divergir, e é sempre o segundo que esquece.
 */

const BUCKET = "posts-artes";

// String literal, e nao concatenacao: o supabase-js tipa o retorno a partir do
// TEXTO do select, e um `+` no meio apaga esse tipo.
// prettier-ignore
const COLUNAS = "id, client_id, tema, legenda, data_publicacao, horario, plataforma, formato, midia, video_url, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em, responsavel_id, criado_por, subtask_id";

export type PostDaAgencia = {
  id: string;
  clienteId: string;
  cliente: string;
  tema: string;
  legenda: string | null;
  dataPublicacao: string;
  horario: string | null;
  plataforma: PlataformaSocial;
  formato: string | null;
  midia: PostMidia;
  videoUrl: string | null;
  status: ContentStatus;
  /** A CAPA — num carrossel, o primeiro slide. Já assinada para a tela. */
  arteUrl: string | null;
  thumbnailUrl: string | null;
  versaoAtual: number;
  enviadoEm: string | null;
  responsavelId: string | null;
  responsavel: string | null;
  criadoPor: string | null;
  criadorNome: string | null;
  /** Há rodada interna aprovada na versão corrente. */
  avalInterno: boolean;
  /** Há rodada de cliente esperando decisão. */
  esperandoCliente: boolean;
};

type Linha = {
  id: string;
  client_id: string;
  tema: string;
  legenda: string | null;
  data_publicacao: string;
  horario: string | null;
  plataforma: PlataformaSocial;
  formato: string | null;
  midia: PostMidia;
  video_url: string | null;
  status: ContentStatus;
  arte_url: string | null;
  thumbnail_url: string | null;
  versao_atual: number;
  prazo_aprovacao: string | null;
  enviado_em: string | null;
  responsavel_id: string | null;
  criado_por: string | null;
  subtask_id: string | null;
};

async function montar(linhas: Linha[]): Promise<PostDaAgencia[]> {
  if (linhas.length === 0) return [];

  const supabase = await criarClienteServidor();
  const ids = linhas.map((l) => l.id);

  const [{ data: clientes }, nomes, assinadas, { data: rodadas }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nome_empresa")
      .in("id", [...new Set(linhas.map((l) => l.client_id))]),
    nomesDe([
      ...linhas.map((l) => l.responsavel_id),
      ...linhas.map((l) => l.criado_por),
    ]),
    assinarArquivos(BUCKET, linhas.map((l) => l.thumbnail_url ?? l.arte_url)),
    // AS RODADAS DE TODOS OS POSTS NUMA CONSULTA SÓ. Uma por post seria uma
    // consulta por linha do calendário — e o mês cheio tem trinta.
    supabase
      .from("approval_rounds")
      .select("content_id, escopo, status, numero_rodada")
      .eq("content_type", "post")
      .in("content_id", ids),
  ]);

  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));
  const porPost = new Map<string, { escopo: string; status: string; numero_rodada: number }[]>();
  for (const r of rodadas ?? []) {
    const atual = porPost.get(r.content_id) ?? [];
    atual.push(r);
    porPost.set(r.content_id, atual);
  }

  return linhas.map((l) => {
    const minhas = porPost.get(l.id) ?? [];
    const caminho = l.thumbnail_url ?? l.arte_url;
    return {
      id: l.id,
      clienteId: l.client_id,
      cliente: nomeDoCliente.get(l.client_id) ?? "—",
      tema: l.tema,
      legenda: l.legenda,
      dataPublicacao: l.data_publicacao,
      horario: l.horario ? l.horario.slice(0, 5) : null,
      plataforma: l.plataforma,
      formato: l.formato,
      midia: l.midia,
      videoUrl: l.video_url,
      status: l.status,
      arteUrl: l.arte_url,
      // O bucket é privado de propósito: arte de post não publicado é material
      // da agência. A URL assinada vale uma hora.
      thumbnailUrl: caminho ? (assinadas[caminho] ?? null) : null,
      versaoAtual: l.versao_atual,
      enviadoEm: l.enviado_em,
      responsavelId: l.responsavel_id,
      responsavel: l.responsavel_id ? (nomes.get(l.responsavel_id) ?? null) : null,
      criadoPor: l.criado_por,
      criadorNome: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
      avalInterno: minhas.some(
        (r) =>
          r.escopo === "interna" &&
          r.status === "aprovada" &&
          r.numero_rodada >= l.versao_atual,
      ),
      esperandoCliente: minhas.some(
        (r) => r.escopo === "cliente" && r.status === "pendente",
      ),
    };
  });
}

export type FiltrosDaAgencia = {
  /** `AAAA-MM`. Sem ele, a lista traz o mês corrente e os dois seguintes. */
  mes?: string;
  clienteId?: string;
  /** `meus` filtra por responsável; `sem_dono` pelos que ninguém pegou. */
  foco?: "todos" | "meus" | "sem_dono";
  usuarioId?: string;
};

/** Os posts do mês, para o calendário. */
export async function postsDoMesDaAgencia(
  mes: string,
  filtros: Omit<FiltrosDaAgencia, "mes"> = {},
): Promise<PostDaAgencia[]> {
  const supabase = await criarClienteServidor();

  // O intervalo fecha no primeiro dia do mês seguinte, exclusivo: `lt` evita a
  // conta de quantos dias tem fevereiro.
  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .gte("data_publicacao", `${mes}-01`)
    .lt("data_publicacao", `${deslocarMes(mes, 1)}-01`)
    .order("data_publicacao")
    .order("horario", { nullsFirst: true });

  if (filtros.clienteId) consulta = consulta.eq("client_id", filtros.clienteId);
  if (filtros.foco === "meus" && filtros.usuarioId) {
    consulta = consulta.eq("responsavel_id", filtros.usuarioId);
  }
  if (filtros.foco === "sem_dono") consulta = consulta.is("responsavel_id", null);

  const { data } = await consulta;
  return montar((data ?? []) as Linha[]);
}

/**
 * A fila da lista, ordenada por data.
 *
 * **Traz três meses e não o mês corrente**, ao contrário do calendário: quem
 * abre a lista está procurando trabalho, e o que ele tem para fazer hoje quase
 * sempre publica no mês que vem. Um recorte mensal aqui esconderia metade da
 * fila no dia 28.
 */
export async function filaDaAgencia(
  filtros: FiltrosDaAgencia = {},
): Promise<PostDaAgencia[]> {
  const supabase = await criarClienteServidor();
  const hoje = new Date().toISOString().slice(0, 7);

  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .gte("data_publicacao", `${deslocarMes(hoje, -1)}-01`)
    .lt("data_publicacao", `${deslocarMes(hoje, 3)}-01`)
    .order("data_publicacao")
    .limit(200);

  if (filtros.clienteId) consulta = consulta.eq("client_id", filtros.clienteId);
  if (filtros.foco === "meus" && filtros.usuarioId) {
    consulta = consulta.eq("responsavel_id", filtros.usuarioId);
  }
  if (filtros.foco === "sem_dono") consulta = consulta.is("responsavel_id", null);

  const { data } = await consulta;
  return montar((data ?? []) as Linha[]);
}

export type VersaoDoPost = {
  id: string;
  numero: number;
  legenda: string | null;
  notas: string | null;
  autor: string | null;
  quando: string;
  /** Os slides, já com URL assinada. Vazio quando a versão é de imagem única. */
  arquivos: (ArquivoDaVersao & { assinada: string | null })[];
  arteUrl: string | null;
  arteAssinada: string | null;
  videoUrl: string | null;
};

/** Um post com o histórico, para o editor. */
export async function obterPostDaAgencia(id: string): Promise<{
  post: PostDaAgencia;
  versoes: VersaoDoPost[];
} | null> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase.from("posts").select(COLUNAS).eq("id", id).maybeSingle();
  if (!data) return null;

  const [post] = await montar([data as Linha]);

  const { data: linhas } = await supabase
    .from("post_versions")
    .select("*")
    .eq("post_id", id)
    .order("numero_versao", { ascending: false });

  const versoes = linhas ?? [];
  const caminhos = versoes.flatMap((v) => [
    v.arte_url,
    ...((v.arquivos ?? []) as ArquivoDaVersao[]).flatMap((a) => [
      a.url,
      a.thumbnail_url ?? null,
    ]),
  ]);
  const assinadas = await assinarArquivos(BUCKET, caminhos);
  const nomes = await nomesDe(versoes.map((v) => v.criado_por));

  return {
    post,
    versoes: versoes.map((v) => ({
      id: v.id,
      numero: v.numero_versao,
      legenda: v.legenda,
      notas: v.notas_mudanca,
      autor: v.criado_por ? (nomes.get(v.criado_por) ?? null) : null,
      quando: v.created_at,
      arquivos: ((v.arquivos ?? []) as ArquivoDaVersao[]).map((a) => ({
        ...a,
        assinada: assinadas[a.thumbnail_url ?? a.url] ?? assinadas[a.url] ?? null,
      })),
      arteUrl: v.arte_url,
      arteAssinada: v.arte_url ? (assinadas[v.arte_url] ?? null) : null,
      videoUrl: v.video_url,
    })),
  };
}
