import "server-only";

import { assinarArquivos, nomesDe } from "@/lib/dados/conteudo";
import { deslocarMes, type EtapaDoPost } from "@/lib/dominio/posts";
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
const COLUNAS = "id, client_id, tema, legenda, pauta, data_publicacao, horario, plataforma, formato, midia, video_url, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em, responsavel_id, criado_por, subtask_id";

export type PostDaAgencia = {
  id: string;
  clienteId: string;
  cliente: string;
  tema: string;
  legenda: string | null;
  /** O que o post vai dizer, escrito na etapa Pauta. Conversa interna. */
  pauta: string | null;
  /** NULA enquanto ninguém definiu (0044). O mês abre em branco e quem produz
   *  distribui — e o post sem data aparece na faixa "sem data ainda", não no
   *  calendário, porque não há célula onde ele caiba. */
  dataPublicacao: string | null;
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
  /**
   * O post já foi programado? (decisão do usuário)
   *
   * ---------------------------------------------------------------------
   * **É DERIVADO DA ETAPA "Programar", e não uma coluna nova.**
   *
   * O pedido foi *"que o social media possa marcar em algum lugar dentro da
   * parte interna de social, se o post já foi programado ou não"* — e o
   * lugar já existia desde a 0045: concluir a etapa Programar é exatamente
   * isso. O que faltava era ela ser um FATO VISÍVEL sobre o post, e não uma
   * linha dentro de um painel que só abre quando alguém clica nele.
   *
   * Uma coluna `programado` ao lado da etapa criaria duas verdades sobre o
   * mesmo fato, e elas divergiriam no primeiro pedido de ajustes do cliente
   * — que reabre a corrente e não teria como reabrir a coluna. É a mesma
   * razão pela qual bloqueio de subtarefa não é status, atraso do
   * Financeiro não é coluna e a mão do post não é gravada.
   * ---------------------------------------------------------------------
   */
  programado: boolean;
};

type Linha = {
  id: string;
  client_id: string;
  tema: string;
  legenda: string | null;
  pauta: string | null;
  data_publicacao: string | null;
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

  const [
    { data: clientes },
    nomes,
    assinadas,
    { data: rodadas },
    { data: etapasDeProgramar },
  ] = await Promise.all([
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
    // A ETAPA "Programar" DE TODOS OS POSTS, na mesma ida. Uma consulta por
    // post seria uma por linha do calendário — o mesmo argumento das rodadas
    // logo acima. Só a dela: as outras quatro interessam ao painel do post
    // aberto, e trazer a corrente inteira de trinta posts para desenhar um
    // selo é pagar caro por um booleano.
    supabase
      .from("post_etapas")
      .select("post_id, status")
      .eq("nome", "Programar")
      .in("post_id", ids),
  ]);

  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));
  const programados = new Set(
    (etapasDeProgramar ?? [])
      .filter((e) => e.status === "concluida")
      .map((e) => e.post_id),
  );
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
      pauta: l.pauta,
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
      programado: programados.has(l.id),
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

  // OS SEM DATA ENTRAM NA FILA, e é `or` e não uma segunda consulta: desde a
  // 0044 o mês abre em branco, e o post que ninguém datou é exatamente o que
  // alguém precisa pegar. Deixá-lo de fora faria a lista dizer que não há
  // trabalho no dia seguinte ao de abrir o mês inteiro.
  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .or(
      `and(data_publicacao.gte.${deslocarMes(hoje, -1)}-01,data_publicacao.lt.${deslocarMes(hoje, 3)}-01),data_publicacao.is.null`,
    )
    .order("data_publicacao", { nullsFirst: true })
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
  etapas: EtapaDoPost[];
  referencias: ReferenciaDoPost[];
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
    etapas: await corrente(id),
    referencias: await referenciasDoPost(id),
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


/**
 * A corrente de etapas de um post (0045).
 *
 * Consulta própria e não um `join` no `select` do post: a corrente só é lida
 * no detalhe, e trazê-la no `COLUNAS` faria o calendário do mês carregar seis
 * linhas por post — cento e oitenta linhas para desenhar trinta cartões que
 * não mostram etapa nenhuma.
 */
export async function corrente(postId: string): Promise<EtapaDoPost[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("post_etapas")
    .select("id, ordem, nome, funcao, responsavel_id, status, prazo, concluida_em")
    .eq("post_id", postId)
    .order("ordem");

  const linhas = data ?? [];
  const nomes = await nomesDe(linhas.map((l) => l.responsavel_id));

  return linhas.map((l) => ({
    id: l.id,
    ordem: l.ordem,
    nome: l.nome,
    funcao: l.funcao,
    responsavelId: l.responsavel_id,
    responsavel: l.responsavel_id ? (nomes.get(l.responsavel_id) ?? null) : null,
    status: l.status,
    prazo: l.prazo,
    concluidaEm: l.concluida_em,
  }));
}

/**
 * As etapas de social que são MINHAS, para Minhas Tasks.
 *
 * Elas entram na mesma tela das etapas de demanda porque respondem à mesma
 * pergunta — "o que eu faço agora?" — e o redator, que não é do social, não
 * precisa aprender a abrir outra tela para descobrir que tem texto para
 * escrever. Duas caixas de entrada são uma caixa que alguém deixa de olhar.
 *
 * **Só as que já podem começar, mais as que já começaram.** Uma etapa de
 * Layout de um post cuja Pauta ninguém escreveu ainda não é trabalho meu hoje:
 * ela apareceria no topo da lista de alguém que não tem o que fazer com ela, e
 * o banco recusaria o clique de Iniciar.
 */
export type EtapaDeSocialMinha = EtapaDoPost & {
  postId: string;
  tema: string;
  cliente: string;
  dataPublicacao: string | null;
};

export async function minhasEtapasDeSocial(
  usuarioId: string,
): Promise<EtapaDeSocialMinha[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("post_etapas")
    .select("id, post_id, ordem, nome, funcao, responsavel_id, status, prazo, concluida_em")
    .eq("responsavel_id", usuarioId)
    .neq("status", "concluida")
    .order("prazo", { nullsFirst: false });

  const minhas = data ?? [];
  if (minhas.length === 0) return [];

  const idsDePost = [...new Set(minhas.map((e) => e.post_id))];

  // AS IRMÃS DE CADA ETAPA, para saber se a minha já pode começar. É a mesma
  // conta de `bloqueioDaEtapa`, com a diferença de que aqui ela decide se o
  // item aparece — e não só como ele é desenhado.
  const [{ data: posts }, { data: irmas }] = await Promise.all([
    supabase.from("posts").select("id, tema, client_id, data_publicacao").in("id", idsDePost),
    supabase.from("post_etapas").select("post_id, ordem, status").in("post_id", idsDePost),
  ]);

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .in("id", [...new Set((posts ?? []).map((p) => p.client_id))]);

  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));
  const doPost = new Map((posts ?? []).map((p) => [p.id, p]));
  const nomes = await nomesDe([usuarioId]);

  return minhas
    .filter((e) => {
      if (e.status !== "nao_iniciada") return true;
      return !(irmas ?? []).some(
        (i) => i.post_id === e.post_id && i.ordem < e.ordem && i.status !== "concluida",
      );
    })
    .map((e) => {
      const post = doPost.get(e.post_id);
      return {
        id: e.id,
        postId: e.post_id,
        ordem: e.ordem,
        nome: e.nome,
        funcao: e.funcao,
        responsavelId: e.responsavel_id,
        responsavel: nomes.get(usuarioId) ?? null,
        status: e.status,
        prazo: e.prazo,
        concluidaEm: e.concluida_em,
        tema: post?.tema ?? "—",
        cliente: post ? (nomeDoCliente.get(post.client_id) ?? "—") : "—",
        dataPublicacao: post?.data_publicacao ?? null,
      };
    });
}

/** Os posts que ninguém datou ainda — a faixa ao lado da grade do mês. */
export async function postsSemData(clienteId?: string): Promise<PostDaAgencia[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .is("data_publicacao", null)
    .order("created_at")
    .limit(200);

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const { data } = await consulta;
  return montar((data ?? []) as Linha[]);
}


export type ReferenciaDoPost = {
  id: string;
  url: string;
  titulo: string | null;
  quem: string | null;
  quando: string;
  /** Quem pôs pode apagar, e a gestão também — a mesma regra das
   *  Recomendações: a gestão modera apagando, nunca reescrevendo. */
  minha: boolean;
};

export async function referenciasDoPost(
  postId: string,
  usuarioId?: string,
): Promise<ReferenciaDoPost[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("post_referencias")
    .select("id, url, titulo, adicionado_por, created_at")
    .eq("post_id", postId)
    .order("created_at");

  const linhas = data ?? [];
  const nomes = await nomesDe(linhas.map((l) => l.adicionado_por));

  return linhas.map((l) => ({
    id: l.id,
    url: l.url,
    titulo: l.titulo,
    quem: l.adicionado_por ? (nomes.get(l.adicionado_por) ?? null) : null,
    quando: l.created_at,
    minha: !!usuarioId && l.adicionado_por === usuarioId,
  }));
}
