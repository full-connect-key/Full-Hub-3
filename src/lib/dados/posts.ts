import "server-only";

import {
  assinarArquivos,
  nomesDe,
  rodadasDo,
  type RodadaDoConteudo,
  type VersaoDoConteudo,
} from "@/lib/dados/conteudo";
import { ouFalha } from "./consulta";
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
  /**
   * O portão do meio da corrente (0076), quando a tela o pediu.
   *
   * **Nulo na listagem do mês, e é decisão.** A grade e o calendário mostram
   * uma miniatura e um selo por post — a etapa que está esperando o cliente não
   * muda nenhum dos dois, e perguntá-la ali seria uma chamada por post para
   * desenhar o que já está desenhado. Quem precisa dela é a tela de decisão,
   * que é de um post só.
   */
  portao?: { etapa: string; texto: string | null } | null,
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
    portaoDoCliente: portao?.etapa ?? null,
    textoDoPortao: portao?.texto ?? null,
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

  const linhas = (ouFalha("os posts do mês", await consulta) ??
    []) as LinhaDePost[];
  if (linhas.length === 0) return [];

  const rodadas = await rodadasDo(
    "post",
    linhas.map((l) => l.id),
  );
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

  // `ouFalha` E DEPOIS `if (!data)`: as duas respostas são diferentes e a
  // primeira versão as confundia. Sem linha é a RLS dizendo "este post não é
  // seu", e a tela mostra 404 — que é o certo. Erro é o `select` recusado
  // inteiro, e antes ele virava o mesmo 404: o cliente via "não encontrado"
  // para um post que existe.
  const data = ouFalha("o post", await consulta.maybeSingle());
  if (!data) return null;

  const linha = data as LinhaDePost;
  const rodadas = await rodadasDo("post", [linha.id]);
  const nomes = await nomesDe([rodadas.get(linha.id)?.decidido_por ?? null]);

  return montar(linha, rodadas.get(linha.id), nomes, await portaoDoPost(supabase, linha.id));
}

/**
 * Qual etapa da corrente está esperando o cliente, e o texto dela (0076).
 *
 * ---------------------------------------------------------------------------
 * **ELA NÃO USA `ouFalha()`, e a exceção tem motivo.** A tela de decisão
 * funciona inteira sem esta resposta — ela é o caminho de sempre, o do Envio, em
 * que não há portão do meio nenhum. Derrubar a tela em que o cliente aprova por
 * causa de uma linha que quase sempre vem vazia seria trocar uma imprecisão por
 * uma falha total, que é a decisão da faixa de novidades de Minhas Tasks.
 *
 * O que ela NÃO pode fazer é falhar calada do outro lado: o erro vai para o log
 * do servidor, senão um portão que parasse de aparecer para todos os clientes
 * seria descoberto por alguém aprovando uma pauta sem saber que era uma pauta.
 * ---------------------------------------------------------------------------
 */
async function portaoDoPost(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  postId: string,
): Promise<{ etapa: string; texto: string | null } | null> {
  const { data, error } = await supabase.rpc("o_que_o_cliente_decide", {
    p_post_id: postId,
  });

  if (error) {
    console.error("[consulta:o portão do cliente no post]", error);
    return null;
  }

  const primeiro = data?.[0];
  if (!primeiro) return null;
  return { etapa: primeiro.etapa, texto: primeiro.texto };
}

/** O histórico de versões, da mais nova para a mais antiga. */
export async function versoesDoPost(
  postId: string,
): Promise<VersaoDoConteudo[]> {
  const supabase = await criarClienteServidor();

  const linhas =
    ouFalha(
      "as versões do post",
      await supabase
        .from("post_versions")
        .select(
          "id, numero_versao, arte_url, arquivos, legenda, notas_mudanca, criado_por, created_at",
        )
        .eq("post_id", postId)
        .order("numero_versao", { ascending: false }),
    ) ?? [];
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
