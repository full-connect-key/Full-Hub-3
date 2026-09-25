import "server-only";

import {
  assinarArquivos,
  enderecoDaArte,
  nomesDe,
  rodadasDo,
  type RodadaDoConteudo,
  type VersaoDoConteudo,
} from "@/lib/dados/conteudo";
import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  CampanhaDoPortal,
  EntregavelDoPortal,
} from "@/lib/dominio/campanhas";
import type { EstruturaDeTemplate } from "@/lib/supabase/database.types";

/**
 * As campanhas e os entregáveis que o cliente enxerga.
 *
 * **O ISOLAMENTO NÃO MORA AQUI**, como em `lib/dados/posts.ts` e em
 * `lib/dados/portal.ts`. `campaigns_select_cliente` recusa a campanha de outra
 * empresa e `deliverables_select_cliente` exige `enviado_em is not null` —
 * mesmo que esta consulta esqueça o filtro, mesmo que alguém chame a API do
 * Supabase direto com o id na mão. Aqui só montamos o que passou.
 *
 * A assimetria entre as duas policies é de propósito e está escrita na 0033:
 * **a campanha o cliente vê desde o planejamento; o entregável, só depois de
 * enviado.** Ela tem nome, período e progresso, e é isso que responde "o que a
 * Full está fazendo para mim este mês".
 *
 * `clienteId` existe para a visualização administrativa em `/portal/{slug}`.
 * Para a pessoa cliente ele é dispensável; para quem é da equipe NÃO É:
 * `is_staff()` enxerga todos os clientes, e sem ele o portal de uma empresa
 * mostraria a campanha de outra.
 */

// prettier-ignore
// `clients(nome)` ESTAVA AQUI, E DERRUBAVA A CONSULTA INTEIRA. A coluna da
// tabela é `nome_empresa`; o PostgREST recusa o `select` quando o embutido
// cita coluna que não existe, e o erro descartado virava "Nenhuma campanha
// aberta" na tela de quem tinha acabado de criar uma.
//
// E ela nem era usada: `LinhaDeCampanha` não declara o embutido, e o nome da
// empresa sempre veio de `nomesDasEmpresas()`, logo abaixo. Um pedaço de
// consulta que ninguém lê e que quebra tudo.
const COLUNAS_DA_CAMPANHA = "id, client_id, nome, descricao, data_inicio, data_fim, status, capa_url";

// prettier-ignore
const COLUNAS_DO_ENTREGAVEL = "id, campaign_id, parent_id, nome, descricao, ordem, status, prazo, arte_url, thumbnail_url, arquivo_nome, versao_atual, enviado_em";

type LinhaDeCampanha = {
  id: string;
  client_id: string;
  capa_url: string | null;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  status: CampanhaDoPortal["status"];
};

type LinhaDeEntregavel = {
  id: string;
  campaign_id: string;
  parent_id: string | null;
  nome: string;
  descricao: string | null;
  ordem: number;
  status: EntregavelDoPortal["status"];
  prazo: string | null;
  arte_url: string | null;
  thumbnail_url: string | null;
  arquivo_nome: string | null;
  versao_atual: number;
  enviado_em: string | null;
};

async function nomesDasEmpresas(
  ids: string[],
): Promise<Map<string, { nome: string; slug: string | null }>> {
  const limpos = [...new Set(ids)];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("clients")
    .select("id, nome_empresa, slug")
    .in("id", limpos);

  return new Map(
    (data ?? []).map(
      (c) => [c.id, { nome: c.nome_empresa, slug: c.slug }] as const,
    ),
  );
}

function montarCampanha(
  linha: LinhaDeCampanha,
  empresas: Map<string, { nome: string; slug: string | null }>,
): CampanhaDoPortal {
  return {
    id: linha.id,
    clienteId: linha.client_id,
    cliente: empresas.get(linha.client_id)?.nome ?? "",
    // O slug abre o portal DAQUELE cliente, que é a única tela de detalhe de
    // campanha que existe hoje. Sem ele a tela da agência lista a campanha e
    // não leva a lugar nenhum — que foi exatamente o que aconteceu.
    slug: empresas.get(linha.client_id)?.slug ?? null,
    nome: linha.nome,
    descricao: linha.descricao,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim,
    status: linha.status,
    capaUrl: linha.capa_url,
    // ASSINADA POR QUEM LISTA, e não aqui: `montarCampanha` é síncrona e
    // assinar é ida à rede. Uma lista de oito campanhas faria oito idas em
    // série — a listagem inteira paga o preço de uma.
    capaAssinada: null,
  };
}

function montarEntregavel(
  linha: LinhaDeEntregavel,
  rodada: RodadaDoConteudo | undefined,
  nomes: Map<string, string>,
): EntregavelDoPortal {
  return {
    id: linha.id,
    campanhaId: linha.campaign_id,
    paiId: linha.parent_id,
    nome: linha.nome,
    descricao: linha.descricao,
    ordem: linha.ordem,
    status: linha.status,
    prazo: linha.prazo,
    arteUrl: linha.arte_url,
    thumbnailUrl: linha.thumbnail_url ?? linha.arte_url,
    arquivoNome: linha.arquivo_nome,
    versaoAtual: linha.versao_atual,
    enviadoEm: linha.enviado_em,
    rodadaPendenteId: rodada?.status === "pendente" ? rodada.id : null,
    decididoPor: rodada?.decidido_por
      ? (nomes.get(rodada.decidido_por) ?? null)
      : null,
    decididoEm: rodada?.decidido_em ?? null,
    motivo: rodada?.comentario ?? null,
    esperandoDesde:
      rodada?.status === "pendente" ? (rodada.solicitado_em ?? null) : null,
  };
}

/**
 * As campanhas, da que termina primeiro para a que termina depois.
 *
 * A ordem é o fim e não o começo: a pergunta de quem abre a lista é "o que
 * preciso decidir antes que acabe", e ordenar pelo início põe no topo a
 * campanha mais antiga, que costuma ser a que já foi resolvida.
 */
export async function campanhasDoCliente(
  clienteId?: string,
): Promise<CampanhaDoPortal[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("campaigns")
    .select(COLUNAS_DA_CAMPANHA)
    .order("data_fim", { ascending: false });

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const linhas = (ouFalha("campanhas do cliente", await consulta) ??
    []) as LinhaDeCampanha[];
  const empresas = await nomesDasEmpresas(linhas.map((l) => l.client_id));

  // UMA ASSINATURA PARA A LISTA INTEIRA. O bucket é privado, e a URL vale uma
  // hora — assinar campanha a campanha seriam oito idas à rede para desenhar
  // oito cartões.
  const capas = await urlsDosArquivos(linhas.map((l) => l.capa_url));

  return linhas.map((linha) => ({
    ...montarCampanha(linha, empresas),
    // `enderecoDaArte` e NAO `capas[...]`: nem toda capa mora no bucket. A do
    // seed e um caminho do proprio site, e assinar um endereco que nao e do
    // Storage devolve erro — a imagem sumiria da tela sem nada avisando.
    capaAssinada: enderecoDaArte(linha.capa_url, capas),
  }));
}

/** Uma campanha, ou null quando o RLS não deixa ver. */
export async function obterCampanha(
  id: string,
  clienteId?: string,
): Promise<CampanhaDoPortal | null> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("campaigns")
    .select(COLUNAS_DA_CAMPANHA)
    .eq("id", id);
  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const data = ouFalha("a campanha", await consulta.maybeSingle());
  if (!data) return null;

  const linha = data as LinhaDeCampanha;
  const capas = await urlsDosArquivos([linha.capa_url]);
  return {
    ...montarCampanha(linha, await nomesDasEmpresas([linha.client_id])),
    capaAssinada: enderecoDaArte(linha.capa_url, capas),
  };
}

/**
 * Os entregáveis de uma campanha, achatados.
 *
 * Vem achatado de propósito: quem monta a árvore é `emArvore()`, em
 * `lib/dominio/campanhas.ts`, que é função pura e roda nos dois lados. Montar
 * a árvore aqui obrigaria a tela a desmontá-la para filtrar.
 */
export async function entregaveisDaCampanha(
  campanhaId: string,
): Promise<EntregavelDoPortal[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("deliverables")
    .select(COLUNAS_DO_ENTREGAVEL)
    .eq("campaign_id", campanhaId)
    .order("ordem");

  const linhas = (data ?? []) as LinhaDeEntregavel[];
  if (linhas.length === 0) return [];

  const rodadas = await rodadasDo(
    "deliverable",
    linhas.map((l) => l.id),
  );
  const nomes = await nomesDe([...rodadas.values()].map((r) => r.decidido_por));

  return linhas.map((l) => montarEntregavel(l, rodadas.get(l.id), nomes));
}

/** Um entregável, ou null quando o RLS não deixa ver. */
export async function obterEntregavel(
  id: string,
): Promise<EntregavelDoPortal | null> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("deliverables")
    .select(COLUNAS_DO_ENTREGAVEL)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const linha = data as LinhaDeEntregavel;
  const rodadas = await rodadasDo("deliverable", [linha.id]);
  const nomes = await nomesDe([rodadas.get(linha.id)?.decidido_por ?? null]);

  return montarEntregavel(linha, rodadas.get(linha.id), nomes);
}

/** O histórico de arquivos, do mais novo para o mais antigo. */
export async function versoesDoEntregavel(
  entregavelId: string,
): Promise<VersaoDoConteudo[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("deliverable_versions")
    .select(
      "id, numero_versao, arte_url, arquivo_nome, notas_mudanca, criado_por, created_at",
    )
    .eq("deliverable_id", entregavelId)
    .order("numero_versao", { ascending: false });

  const linhas = data ?? [];
  const nomes = await nomesDe(linhas.map((l) => l.criado_por));

  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero_versao,
    arteUrl: l.arte_url,
    // O entregável não tem slides: a peça dele é um arquivo só. A lista vazia
    // é o que faz a casca compartilhada não precisar perguntar o tipo.
    arquivos: [],
    // No post o texto é a legenda; aqui é o nome do arquivo. É o que muda
    // junto com a arte e o que a pessoa confere depois de pedir ajuste.
    texto: l.arquivo_nome,
    notas: l.notas_mudanca,
    quando: l.created_at,
    quem: l.criado_por ? (nomes.get(l.criado_por) ?? null) : null,
  }));
}

/**
 * Os arquivos da campanha, assinados.
 *
 * Bucket próprio, e não o dos posts: a policy do `campanhas-arquivos` pergunta
 * pela primeira pasta do caminho, que é o id da empresa, e misturar os dois
 * faria uma regra ter de valer para material de dois módulos.
 */
export function urlsDosArquivos(
  caminhos: (string | null)[],
): Promise<Record<string, string>> {
  return assinarArquivos("campanhas-arquivos", caminhos);
}

/** Os templates disponíveis para um cliente: os da casa mais os dele. */
export type TemplateDeCampanha = {
  id: string;
  nome: string;
  descricao: string | null;
  estrutura: EstruturaDeTemplate;
  /** Null é template da casa, que serve a todo cliente. */
  clienteId: string | null;
};

export async function templatesDeCampanha(
  clienteId?: string,
): Promise<TemplateDeCampanha[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("campaign_templates")
    .select("id, nome, descricao, estrutura_json, client_id")
    .eq("ativo", true)
    .order("nome");

  // O da casa (`client_id` nulo) aparece sempre; o de outro cliente, nunca.
  if (clienteId)
    consulta = consulta.or(`client_id.is.null,client_id.eq.${clienteId}`);

  const { data } = await consulta;

  return (data ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    estrutura: t.estrutura_json,
    clienteId: t.client_id,
  }));
}
