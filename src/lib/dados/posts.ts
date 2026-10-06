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
const COLUNAS = "id, client_id, social_task_id, tema, legenda, data_publicacao, horario, plataformas, formato, midia, status, arte_url, thumbnail_url, versao_atual, prazo_aprovacao, enviado_em";

type LinhaDePost = {
  id: string;
  client_id: string;
  social_task_id: string | null;
  tema: string;
  legenda: string | null;
  data_publicacao: string | null;
  horario: string | null;
  plataformas: PostDoPortal["plataformas"];
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
    mesId: linha.social_task_id,
    horario: linha.horario ? linha.horario.slice(0, 5) : null,
    plataformas: linha.plataformas,
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

/**
 * Os posts de um mês. `mes` é `AAAA-MM`.
 *
 * ---------------------------------------------------------------------------
 * **A DATA DEIXOU DE DECIDIR SE A PEÇA EXISTE** (Sprint 3K), e esta é a
 * metade de tela do bug 1 da 0090.
 *
 * Ela filtrava `data_publicacao >= inicio and < fim`. Desde a 0044 o mês de
 * social abre SEM DATA em nenhum post, e desde a 0076 uma peça pode ir ao
 * cliente num portão do MEIO — a pauta, a legenda —, onde a data ainda não
 * existe e exigi-la seria uma recusa que a corrente não tem como satisfazer.
 * Resultado: a RLS liberava a peça, a consulta a escondia, e o cliente via um
 * item em "esperando você" na tela inicial e a área de Social vazia.
 *
 * O recorte passou a ser a DEMANDA DO MÊS. A data continua servindo para
 * ordenar e para posicionar na grade — nunca para decidir existência.
 *
 * **E O MÊS É RESOLVIDO POR RPC**, não por um `select` em `tasks`: o cliente
 * não enxerga aquela tabela (`tasks_select_cliente` exige uma rodada de escopo
 * cliente numa subtarefa da demanda, e a demanda do mês não tem nenhuma). Um
 * `in (select id from tasks ...)` aqui voltaria vazio para ele, e a tela
 * ficaria igualzinha ao bug que ela está consertando — que é a mesma pegadinha
 * que a policy do lote pagou na 0090.
 *
 * O POST AVULSO continua entrando pela data, e é a única coisa que ele tem:
 * `social_task_id` nulo é a forma anterior à 0045, um envio e uma decisão.
 * ---------------------------------------------------------------------------
 */
export async function postsDoMes(
  mes: string,
  clienteId?: string,
): Promise<PostDoPortal[]> {
  const supabase = await criarClienteServidor();

  // O intervalo fecha no primeiro dia do mês seguinte, exclusivo: `lt` em vez
  // de `lte` no último dia evita a conta de quantos dias tem fevereiro.
  const inicio = `${mes}-01`;
  const fim = `${deslocarMes(mes, 1)}-01`;

  const { data: demanda, error: erroDoMes } = await supabase.rpc(
    "mes_de_social_do_portal",
    { p_mes: mes, p_client_id: clienteId ?? null },
  );

  // ELE NÃO DERRUBA A TELA, e a exceção tem motivo: sem a demanda do mês a
  // listagem ainda responde pelos posts datados, que é o comportamento de
  // antes do Sprint 3K. Derrubar a área de Social por causa da resolução do
  // mês seria trocar uma lista incompleta por uma falha total — a decisão de
  // `portaoDoPost()`. O que ela não pode é falhar calada.
  if (erroDoMes) console.error("[consulta:o mês de social do portal]", erroDoMes);

  const doMes = typeof demanda === "string" ? demanda : null;

  let consulta = supabase.from("posts").select(COLUNAS).order("data_publicacao");

  // `or()` E NÃO DOIS `select`: duas consultas devolveriam duas listas para
  // juntar, e a peça que está nos dois ramos — datada E do mês — apareceria
  // duas vezes na grade.
  consulta = doMes
    ? consulta.or(
        `social_task_id.eq.${doMes},and(social_task_id.is.null,data_publicacao.gte.${inicio},data_publicacao.lt.${fim})`,
      )
    : consulta.gte("data_publicacao", inicio).lt("data_publicacao", fim);

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

/**
 * TODOS OS POSTS QUE ESTE CLIENTE ENXERGA, sem recorte de mês.
 *
 * ---------------------------------------------------------------------------
 * **É A FONTE ÚNICA, e ela existe por causa do sintoma mais revelador do bug
 * 1 do Sprint 3K.**
 *
 * Havia duas leituras de post do portal, em dois arquivos: esta área (que
 * filtrava por `data_publicacao` dentro do mês) e a tela inicial (que não
 * filtrava nada). A peça enviada num portão do meio aparecia na home e sumia
 * no Social — o cliente lia "1 material esperando você" e abria uma área
 * vazia.
 *
 * Com uma fonte só não há onde a divergência morar: o que a home conta como
 * pendente é exatamente o que esta área lista, porque as duas leem daqui.
 * `postsDoMes` é esta lista RECORTADA pela demanda do mês, e `postsComoItens`
 * em `lib/dados/portal.ts` é esta lista TRADUZIDA para `ItemDoPortal`.
 *
 * É a decisão de `situacaoDoLancamento()` e de `linhasDoPrecisaDeMim()`: duas
 * somas para o mesmo fato é exatamente o bug que a fonte única evita.
 * ---------------------------------------------------------------------------
 *
 * **O isolamento continua não morando aqui.** `posts_select_cliente` (0032)
 * recusa o que é de outra empresa e o que ainda não foi enviado — mesmo que
 * esta consulta esqueça o filtro, mesmo chamando a API do Supabase direto.
 */
export async function lerPostsDoCliente(
  clienteId?: string,
): Promise<LinhaDePost[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("posts")
    .select(COLUNAS)
    .order("data_publicacao");

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  return (ouFalha("os posts do cliente", await consulta) ??
    []) as LinhaDePost[];
}

/**
 * O LOTE ABERTO deste mês — o que a agência mandou e ainda espera resposta.
 *
 * **Os dois números são DERIVADOS das rodadas**, e é a regra que o lote existe
 * para respeitar: ele não guarda decisão nenhuma. "18 peças · 12 decididas"
 * sai de `approval_rounds`, e uma coluna aqui seria a segunda fonte de verdade
 * que produziu a confusão que o Sprint 3K desfez.
 *
 * O cliente lê o lote por `social_lotes_select_cliente` (0090), que passa por
 * `lote_e_do_meu_cliente()` — `security definer`, porque ele não enxerga
 * `tasks`.
 *
 * **Lote fechado devolve nulo, e o cabeçalho some**: ele é o bloco de exceção
 * da Home visto de outro ângulo — uma faixa dizendo "nada esperando você"
 * todos os dias é espaço gasto para informar em alguns.
 */
export type LoteDoPortal = {
  portao: string;
  recado: string | null;
  pecas: number;
  decididas: number;
};

export async function loteAbertoDoMes(
  mes: string,
  clienteId?: string,
): Promise<LoteDoPortal | null> {
  const supabase = await criarClienteServidor();

  const { data: demanda } = await supabase.rpc("mes_de_social_do_portal", {
    p_mes: mes,
    p_client_id: clienteId ?? null,
  });
  if (typeof demanda !== "string") return null;

  // `ouFalha` NÃO, e a exceção é a de `portaoDoPost()`: a área de Social
  // funciona inteira sem o cabeçalho, e derrubá-la por causa de uma faixa que
  // quase sempre não existe seria trocar uma imprecisão por uma falha total.
  // O que ela não pode é falhar calada — o erro vai para o log.
  const { data: lote, error } = await supabase
    .from("social_lotes")
    .select("id, etapa_id, recado")
    .eq("task_id", demanda)
    .is("fechado_em", null)
    .order("enviado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[consulta:o lote aberto do mês]", error);
    return null;
  }
  if (!lote) return null;

  const rodadas = await supabase
    .from("approval_rounds")
    .select("status")
    .eq("lote_id", lote.id);

  if (rodadas.error) {
    console.error("[consulta:as rodadas do lote]", rodadas.error);
    return null;
  }

  const linhas = rodadas.data ?? [];

  // O NOME DO PORTÃO SAI DA ETAPA, numa segunda ida e não num embutido: o
  // PostgREST recusa o `select` INTEIRO quando não acha a relação pelo nome
  // escrito, e foi assim que uma campanha recém-criada não aparecia em lugar
  // nenhum. Duas idas ao banco custam menos que essa classe de bug.
  const etapa = await supabase
    .from("subtasks")
    .select("titulo")
    .eq("id", lote.etapa_id)
    .maybeSingle();

  return {
    portao: etapa.data?.titulo ?? "Material",
    recado: lote.recado,
    pecas: linhas.length,
    decididas: linhas.filter((r) => r.status !== "pendente").length,
  };
}

/**
 * AS PEÇAS DO MESMO MÊS que esta — a vizinhança do detalhe.
 *
 * Ela existe porque a tela de detalhe não tem o mês: ela tem o POST. Até o
 * Sprint 3K dava para derivar um do outro (`mesDe(post.dataPublicacao)`), e
 * agora não dá — a peça enviada num portão do meio não tem data, e aquela
 * linha estourava.
 *
 * O recorte é `mesId` quando há, e a data quando não há: é o mesmo par de
 * `postsDoMes`, e o segundo ramo é o post AVULSO, que nunca teve mês.
 */
export async function postsDoMesmoMes(
  post: PostDoPortal,
  clienteId?: string,
): Promise<PostDoPortal[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("posts").select(COLUNAS).order("data_publicacao");

  if (post.mesId) {
    consulta = consulta.eq("social_task_id", post.mesId);
  } else if (post.dataPublicacao) {
    const mes = post.dataPublicacao.slice(0, 7);
    consulta = consulta
      .is("social_task_id", null)
      .gte("data_publicacao", `${mes}-01`)
      .lt("data_publicacao", `${deslocarMes(mes, 1)}-01`);
  } else {
    // Sem mês e sem data não há vizinhança: ele é uma peça só. Devolver a
    // lista inteira do cliente poria as setas "anterior/próximo" levando a
    // peças de outros meses, que é pior que não ter setas.
    return [];
  }

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const linhas = (ouFalha("os posts do mesmo mês", await consulta) ??
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
