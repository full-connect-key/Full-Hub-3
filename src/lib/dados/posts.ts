import "server-only";

import {
  assinarArquivos,
  nomesDe,
  rodadasDo,
  type RodadaDoConteudo,
  type VersaoDoConteudo,
} from "@/lib/dados/conteudo";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ArquivoDaVersao } from "@/lib/supabase/database.types";
import { deslocarMes, type PostDoPortal } from "@/lib/dominio/posts";

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
const COLUNAS = "id, client_id, tema, legenda, data_publicacao, horario, plataforma, formato, midia, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em";

type LinhaDePost = {
  id: string;
  client_id: string;
  tema: string;
  legenda: string | null;
  data_publicacao: string;
  horario: string | null;
  plataforma: PostDoPortal["plataforma"];
  formato: string | null;
  midia: PostDoPortal["midia"];
  status: PostDoPortal["status"];
  arte_url: string | null;
  thumbnail_url: string | null;
  versao_atual: number;
  prazo_aprovacao: string | null;
  enviado_em: string | null;
};

function montar(
  linha: LinhaDePost,
  rodada: RodadaDoConteudo | undefined,
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
    midia: linha.midia,
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

  const rodadas = await rodadasDo("post", linhas.map((l) => l.id));
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
  const rodadas = await rodadasDo("post", [linha.id]);
  const nomes = await nomesDe([rodadas.get(linha.id)?.decidido_por ?? null]);

  return montar(linha, rodadas.get(linha.id), nomes);
}

/** O histórico de versões, da mais nova para a mais antiga. */
export async function versoesDoPost(
  postId: string,
): Promise<VersaoDoConteudo[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("post_versions")
    .select(
      "id, numero_versao, arte_url, arquivos, legenda, notas_mudanca, criado_por, created_at",
    )
    .eq("post_id", postId)
    .order("numero_versao", { ascending: false });

  const linhas = data ?? [];
  const nomes = await nomesDe(linhas.map((l) => l.criado_por));

  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero_versao,
    arteUrl: l.arte_url,
    // OS SLIDES DA VERSÃO, e não só a capa: é o que permite o cliente andar
    // pelo carrossel em vez de decidir sobre a primeira imagem.
    arquivos: ((l.arquivos ?? []) as ArquivoDaVersao[]).map((a) => a.url),
    texto: l.legenda,
    notas: l.notas_mudanca,
    quando: l.created_at,
    quem: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
  }));
}

/**
 * As artes de post, assinadas.
 *
 * O bucket mora aqui e não na chamada: `posts-artes` é detalhe deste módulo, e
 * uma tela que precisasse saber o nome do bucket saberia uma coisa a mais do
 * que precisa.
 */
export function urlsDasArtes(
  caminhos: (string | null)[],
): Promise<Record<string, string>> {
  return assinarArquivos("posts-artes", caminhos);
}
