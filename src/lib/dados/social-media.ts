import "server-only";

import { assinarArquivos, nomesDe } from "@/lib/dados/conteudo";
import {
  deslocarMes,
  type CaixinhaDoPost,
  type EtapaDoMes,
} from "@/lib/dominio/posts";
import { ouFalha } from "./consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ArquivoDaVersao,
  ContentStatus,
  PlataformaSocial,
  PostMidia,
  SocialFlowPapel,
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
const COLUNAS = "id, client_id, tema, legenda, pauta, data_publicacao, horario, plataformas, formato, midia, video_url, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em, responsavel_id, criado_por, social_task_id";

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
  plataformas: PlataformaSocial[];
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
   * A DEMANDA DO MÊS DE SOCIAL deste post (0088).
   *
   * Nula no post avulso, e é caso normal: quem clica em "Novo post" não passa
   * por `abrir_mes_de_social()`, então não há mês a nomear nem corrente a
   * carregar — ele volta a se comportar como um post anterior à 0045.
   */
  socialTaskId: string | null;
  /**
   * O post já foi programado? (decisão do usuário)
   *
   * ---------------------------------------------------------------------
   * **É DERIVADO DA CAIXINHA DA ÚLTIMA ETAPA, e não uma coluna nova.**
   *
   * O pedido foi *"que o social media possa marcar em algum lugar dentro da
   * parte interna de social, se o post já foi programado ou não"* — e o
   * lugar já existia desde a 0045: fechar o último elo da corrente é
   * exatamente isso. O que faltava era ele ser um FATO VISÍVEL sobre o post,
   * e não uma linha dentro de um painel que só abre quando alguém clica
   * nele.
   *
   * Uma coluna `programado` ao lado criaria duas verdades sobre o mesmo
   * fato, e elas divergiriam no primeiro pedido de ajustes do cliente — que
   * desmarca a caixinha e não teria como desmarcar a coluna. É a mesma razão
   * pela qual bloqueio de subtarefa não é status, atraso do Financeiro não é
   * coluna e a mão do post não é gravada.
   *
   * **A pergunta é pelo PAPEL `pos_entrega`, nunca pelo nome "Programar"**
   * (0087): a corrente é editável por conta, e um fluxo que chame esse elo
   * de "Agendar na rede" deixaria o selo apagado para sempre — sem erro em
   * lugar nenhum, que é o modo de falha desta casa.
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
  plataformas: PlataformaSocial[];
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
  social_task_id: string | null;
};

async function montar(linhas: Linha[]): Promise<PostDaAgencia[]> {
  if (linhas.length === 0) return [];

  const supabase = await criarClienteServidor();
  const ids = linhas.map((l) => l.id);

  // AS ETAPAS `pos_entrega` DOS MESES DESTES POSTS, para o selo "Programado".
  //
  // Duas idas e nunca um embutido: o PostgREST recusa o `select` INTEIRO
  // quando não resolve a relação pelo nome escrito, e foi assim que uma
  // campanha recém-criada não apareceu em lugar nenhum. É a mesma decisão do
  // nome da campanha na faixa de novidades.
  //
  // E só a `pos_entrega`: as outras interessam ao painel do post aberto, e
  // trazer a corrente inteira de dez meses para desenhar um selo é pagar caro
  // por um booleano.
  const mesesDosPosts = [
    ...new Set(
      linhas.map((l) => l.social_task_id).filter((i): i is string => !!i),
    ),
  ];
  const ultimasEtapas = mesesDosPosts.length
    ? ouFalha(
        "a última etapa dos meses de social",
        await supabase
          .from("subtasks")
          .select("id")
          .in("task_id", mesesDosPosts)
          .eq("social_papel", "pos_entrega"),
      )
    : [];

  const [{ data: clientes }, nomes, assinadas, { data: rodadas }, marcadas] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, nome_empresa")
        .in("id", [...new Set(linhas.map((l) => l.client_id))]),
      nomesDe([
        ...linhas.map((l) => l.responsavel_id),
        ...linhas.map((l) => l.criado_por),
      ]),
      assinarArquivos(
        BUCKET,
        linhas.map((l) => l.thumbnail_url ?? l.arte_url),
      ),
      // AS RODADAS DE TODOS OS POSTS NUMA CONSULTA SÓ. Uma por post seria uma
      // consulta por linha do calendário — e o mês cheio tem trinta.
      supabase
        .from("approval_rounds")
        .select("content_id, escopo, status, numero_rodada")
        .eq("content_type", "post")
        .in("content_id", ids),
      ultimasEtapas.length
        ? supabase
            .from("post_etapa_progresso")
            .select("post_id")
            .in("post_id", ids)
            .in(
              "subtask_id",
              ultimasEtapas.map((e) => e.id),
            )
            .eq("concluido", true)
        : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
    ]);

  const nomeDoCliente = new Map(
    (clientes ?? []).map((c) => [c.id, c.nome_empresa]),
  );
  const programados = new Set(
    (marcadas.data ?? []).map((m) => m.post_id),
  );
  const porPost = new Map<
    string,
    { escopo: string; status: string; numero_rodada: number }[]
  >();
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
      plataformas: l.plataformas,
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
      responsavel: l.responsavel_id
        ? (nomes.get(l.responsavel_id) ?? null)
        : null,
      criadoPor: l.criado_por,
      criadorNome: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
      socialTaskId: l.social_task_id,
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
  if (filtros.foco === "sem_dono")
    consulta = consulta.is("responsavel_id", null);

  const data = ouFalha("os posts do social", await consulta);
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
  if (filtros.foco === "sem_dono")
    consulta = consulta.is("responsavel_id", null);

  const data = ouFalha("os posts do mês no social", await consulta);
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
  /** As etapas do MÊS deste post. Vazio no post avulso, que não tem mês. */
  etapas: EtapaDoMes[];
  /** As caixinhas DESTE post, uma por etapa do mês. */
  caixinhas: CaixinhaDoPost[];
  /**
   * Quantas rodadas de cliente deste post já foram APROVADAS.
   *
   * É o `k` de `portaoDoPost()` — pendente, recusada e rejeitada não contam,
   * que é a regra da 0023: pedir aprovação não é ter aprovação. Sai das
   * rodadas que `montar()` já leu, sem consulta nova.
   */
  aprovacoesDoCliente: number;
  referencias: ReferenciaDoPost[];
  /**
   * O portão da vez do MÊS, as peças do próximo lote e o que falta.
   *
   * Nulo no post avulso, que não tem mês — e é por isso que ele é lido aqui e
   * não na página: o editor abre um post, e quem sabe se ele pertence a um mês
   * é esta consulta. Pedir na página obrigaria a tela a perguntar duas vezes
   * qual é a demanda dele.
   */
  portao: PortaoDoMes | null;
} | null> {
  const supabase = await criarClienteServidor();

  // A ORDEM IMPORTA: `ouFalha` primeiro, `if (!data)` depois. Sem linha é a
  // RLS dizendo "este post não é seu" e a tela responde 404; erro é o `select`
  // recusado, que virava o mesmo 404 — e aí "post não encontrado" aparecia
  // para um post que existe.
  const data = ouFalha(
    "o post do social",
    await supabase.from("posts").select(COLUNAS).eq("id", id).maybeSingle(),
  );
  if (!data) return null;

  const linha = data as Linha;
  const [post] = await montar([linha]);

  // As rodadas de cliente já aprovadas: a conta de `portaoDoPost()`. Consulta
  // própria e não um campo em `montar()` — o calendário do mês desenha trinta
  // cartões e nenhum deles pergunta em que portão cada post está.
  const aprovadas = ouFalha(
    "as rodadas de cliente do post",
    await supabase
      .from("approval_rounds")
      .select("id")
      .eq("content_type", "post")
      .eq("content_id", id)
      .eq("escopo", "cliente")
      .eq("status", "aprovada"),
  );

  const [corrente, portao] = linha.social_task_id
    ? await Promise.all([
        correnteDoMes(linha.social_task_id),
        portaoDoMes(linha.social_task_id),
      ])
    : [{ etapas: [], caixinhas: [] }, null];

  const versoes = ouFalha(
    "as versões do post",
    await supabase
      .from("post_versions")
      .select("*")
      .eq("post_id", id)
      .order("numero_versao", { ascending: false }),
  );
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
    etapas: corrente.etapas,
    caixinhas: corrente.caixinhas.filter((c) => c.postId === id),
    aprovacoesDoCliente: aprovadas.length,
    referencias: await referenciasDoPost(id),
    portao,
    versoes: versoes.map((v) => ({
      id: v.id,
      numero: v.numero_versao,
      legenda: v.legenda,
      notas: v.notas_mudanca,
      autor: v.criado_por ? (nomes.get(v.criado_por) ?? null) : null,
      quando: v.created_at,
      arquivos: ((v.arquivos ?? []) as ArquivoDaVersao[]).map((a) => ({
        ...a,
        assinada:
          assinadas[a.thumbnail_url ?? a.url] ?? assinadas[a.url] ?? null,
      })),
      arteUrl: v.arte_url,
      arteAssinada: v.arte_url ? (assinadas[v.arte_url] ?? null) : null,
      videoUrl: v.video_url,
    })),
  };
}

/**
 * A CORRENTE DO MÊS: as etapas, e as caixinhas de todos os posts dele.
 *
 * -------------------------------------------------------------------------
 * **UMA FUNÇÃO E NÃO DUAS**, e as duas leituras saem da mesma ida ao banco.
 *
 * `etapasDoMes()` e `caixinhasDoMes()` separadas liam a MESMA tabela duas
 * vezes — o "12 de 18" de cada etapa é a contagem das caixinhas dela. Duas
 * consultas dariam dois números para o mesmo fato no instante em que alguém
 * marcasse uma caixa entre elas, que é a razão de `carga_do_dia()` ser a
 * fonte única desde a 0035.
 *
 * A contagem é feita AQUI e não por `progresso_da_etapa()`: aquela função
 * existe para o SQL perguntar de dentro de um trigger, e uma chamada por
 * etapa seriam cinco idas ao banco para somar linhas que esta consulta já
 * trouxe inteiras.
 * -------------------------------------------------------------------------
 *
 * Consulta própria e não um `join` no `select` do post: a corrente só é lida
 * no detalhe, e trazê-la no `COLUNAS` faria o calendário do mês carregar
 * cinco etapas e trinta caixinhas por post — para desenhar cartões que não
 * mostram etapa nenhuma.
 */
export async function correnteDoMes(taskId: string): Promise<{
  etapas: EtapaDoMes[];
  caixinhas: CaixinhaDoPost[];
}> {
  const supabase = await criarClienteServidor();

  // AS ETAPAS SÃO AS SUBTAREFAS COM `social_papel` PREENCHIDO, e a pergunta é
  // essa e não "as subtarefas do mês": uma demanda de social pode ganhar uma
  // etapa à mão como qualquer outra — alguém acrescenta "Conferir os direitos
  // de imagem" —, e ela não é elo da corrente. Sem o filtro ela ganharia
  // caixinha por post e entraria no "3 de 5" do cabeçalho.
  const etapas = ouFalha(
    "as etapas do mês de social",
    await supabase
      .from("subtasks")
      .select(
        "id, ordem, titulo, responsavel_id, status, data_inicio, prazo, estimativa_minutos, social_papel, social_campo, social_portao, aviso_geracao",
      )
      .eq("task_id", taskId)
      .not("social_papel", "is", null)
      .order("ordem"),
  );

  if (etapas.length === 0) return { etapas: [], caixinhas: [] };

  const marcacoes = ouFalha(
    "as caixinhas do mês de social",
    await supabase
      .from("post_etapa_progresso")
      .select("post_id, subtask_id, concluido, observacao")
      .in(
        "subtask_id",
        etapas.map((e) => e.id),
      ),
  );

  const nomes = await nomesDe(etapas.map((e) => e.responsavel_id));

  const feitos = new Map<string, number>();
  const total = new Map<string, number>();
  for (const m of marcacoes) {
    total.set(m.subtask_id, (total.get(m.subtask_id) ?? 0) + 1);
    if (m.concluido) feitos.set(m.subtask_id, (feitos.get(m.subtask_id) ?? 0) + 1);
  }

  return {
    etapas: etapas.map((e) => ({
      id: e.id,
      ordem: e.ordem,
      titulo: e.titulo,
      responsavelId: e.responsavel_id,
      responsavel: e.responsavel_id
        ? (nomes.get(e.responsavel_id) ?? null)
        : null,
      status: e.status,
      dataInicio: e.data_inicio,
      prazo: e.prazo,
      estimativaMinutos: e.estimativa_minutos,
      // O `not is null` acima garante o papel; o `!` é para o tipo, que não
      // sabe ler o filtro do PostgREST.
      papel: e.social_papel!,
      campo: e.social_campo,
      portao: e.social_portao,
      avisoGeracao: e.aviso_geracao,
      feitos: feitos.get(e.id) ?? 0,
      total: total.get(e.id) ?? 0,
    })),
    caixinhas: marcacoes.map((m) => ({
      postId: m.post_id,
      etapaId: m.subtask_id,
      concluido: m.concluido,
      observacao: m.observacao,
    })),
  };
}

/**
 * ---------------------------------------------------------------------------
 * `minhasEtapasDeSocial()` SAIU, e com ela o bloco Social de Minhas Tasks
 * (migration 0088)
 *
 * Ela lia `post_etapas` por `responsavel_id` e montava a linhagem
 * `conta › demanda do mês › post` à mão, porque a etapa era DO POST: doze
 * posts davam doze linhas "Layout" e o agrupamento era a única coisa que
 * dizia que são o mesmo trabalho.
 *
 * Com a etapa sendo do MÊS, a etapa de Layout é UMA — e ela é uma subtarefa
 * comum, com responsável, prazo, estimativa e status. Então ela já aparece em
 * Minhas Tasks pelo caminho de toda etapa de demanda, com o cronômetro, o
 * botão certo e a linhagem `Cliente · Social de Outubro › Layout` de graça.
 *
 * **Foi APAGADA e não mantida ao lado, que é a decisão da 0023:** uma consulta
 * que nenhuma tela lê é o que alguém reaproveita errado três sprints depois,
 * achando que ela ainda diz a verdade sobre a corrente. O que ficou no lugar
 * é uma linha em `areaDaLinha()`, que responde "social" pelo `social_papel` da
 * própria subtarefa.
 * ---------------------------------------------------------------------------
 */

/**
 * O PORTÃO DA VEZ DO MÊS, as peças que entram no próximo lote, e o que falta.
 *
 * ---------------------------------------------------------------------------
 * **UMA LEITURA E NÃO TRÊS**, e o que a junta é que as três respondem sobre o
 * MESMO botão: qual fase está esperando o cliente, quantas peças vão nela, e
 * por que alguma não vai. Separadas, a tela chamaria três vezes e poderia
 * desenhar "(18)" ao lado de uma recusa que fala de dezenove.
 *
 * **AS TRÊS SÃO `security definer` COM `is_staff()` NA PORTA** (0090), então a
 * recusa chega como ERRO e não como lista vazia — e por isso elas não passam
 * por `ouFalha()`: quem abre esta tela é da equipe por definição (`is_staff()`
 * no módulo desde a 0042), e o que derrubaria a página é um erro de rede. Um
 * portão nulo é a resposta normal: o mês cuja corrente ainda não chegou a
 * nenhuma fase de decisão não tem portão nenhum.
 *
 * `portao_atual_do_mes` devolve `setof subtasks`, então o PostgREST entrega um
 * objeto e não uma lista — ela é `returns public.subtasks`, não `returns
 * table`.
 * ---------------------------------------------------------------------------
 */
export type PortaoDoMes = {
  /** A fase que está esperando a decisão do cliente, ou `null`. */
  etapa: { id: string; titulo: string; papel: SocialFlowPapel } | null;
  /** Quantas peças entram no próximo lote deste portão. */
  pecas: number;
  /** Uma linha por peça que NÃO entra, com o motivo por extenso. */
  falta: { postId: string; tema: string; motivo: string }[];
};

export async function portaoDoMes(taskId: string): Promise<PortaoDoMes> {
  const supabase = await criarClienteServidor();

  const { data: etapa, error: erroDoPortao } = await supabase.rpc(
    "portao_atual_do_mes",
    { p_task_id: taskId },
  );
  if (erroDoPortao) {
    console.error("[consulta:o portão da vez do mês]", erroDoPortao);
    return { etapa: null, pecas: 0, falta: [] };
  }
  if (!etapa?.id || !etapa.social_papel) {
    return { etapa: null, pecas: 0, falta: [] };
  }

  const [elegiveis, pendencias] = await Promise.all([
    supabase.rpc("posts_elegiveis_do_portao", {
      p_task_id: taskId,
      p_etapa_id: etapa.id,
    }),
    supabase.rpc("o_que_falta_no_portao", {
      p_task_id: taskId,
      p_etapa_id: etapa.id,
    }),
  ]);

  if (elegiveis.error) {
    console.error("[consulta:as peças do portão]", elegiveis.error);
  }
  if (pendencias.error) {
    console.error("[consulta:o que falta no portão]", pendencias.error);
  }

  const faltam = (pendencias.data ?? []).map((l) => ({
    postId: l.post_id,
    tema: l.tema,
    motivo: l.motivo,
  }));

  // `pecas` É O TOTAL ELEGÍVEL, e NÃO o total menos o que falta — e eu tinha
  // escrito o contrário aqui, com a conta subtraindo. **Foi o teste de fumaça
  // contra o Postgres que mostrou**, e o erro era caro: a tela dizia "(7)" num
  // mês de 13 e o banco recusava o envio INTEIRO, porque
  // `enviar_mes_ao_cliente` confere `o_que_falta_no_portao()` antes de gravar
  // qualquer coisa. Ela não manda as 7 e deixa 6 para trás.
  //
  // **E ela está certa:** o mês anda junto por padrão (0090), e um portão é do
  // MÊS — mandar 7 de 13 partiria o mês no portão, que é exatamente o que
  // `avanca_em_paralelo` existe para permitir e o que o padrão recusa.
  //
  // Então o número é o que vai sair quando nada mais faltar, e quem desliga o
  // botão é `falta.length > 0`. É a decisão do "Enviar ao cliente" desligado
  // com a razão escrita, e não um número que o clique desmente.
  const pecas = (elegiveis.data ?? []).length;

  return {
    etapa: { id: etapa.id, titulo: etapa.titulo, papel: etapa.social_papel },
    pecas,
    falta: faltam,
  };
}

/** Os posts que ninguém datou ainda — a faixa ao lado da grade do mês. */
export async function postsSemData(
  clienteId?: string,
): Promise<PostDaAgencia[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .is("data_publicacao", null)
    .order("created_at")
    .limit(200);

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const data = ouFalha("os posts sem data", await consulta);
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

  const data = ouFalha(
    "as referências do post",
    await supabase
      .from("post_referencias")
      .select("id, url, titulo, adicionado_por, created_at")
      .eq("post_id", postId)
      .order("created_at"),
  );

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
