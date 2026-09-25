import "server-only";

import { colunasDoConteudo, type Conteudo } from "@/lib/aprovacoes/conteudo";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { StatusRodada } from "@/lib/supabase/database.types";

/**
 * O que é igual em post e em entregável de campanha.
 *
 * Os dois passam pelo mesmo motor de aprovação, guardam a conversa na mesma
 * tabela `comments` e têm um histórico de arquivos com a mesma forma. Escrever
 * duas vezes a consulta que troca `content_type` seria criar dois lugares para
 * a mesma regra — e a que diverge em silêncio é a que decide o que o cliente
 * enxerga.
 *
 * O que NÃO mora aqui é a leitura da tabela de cada módulo: `posts` tem tema,
 * rede e horário, `deliverables` tem árvore, ordem e prazo. Generalizar isso
 * também levaria a um `if tipo ===` no meio de cada `select`, que é a
 * duplicação de volta com outro nome.
 */

/** A rodada de escopo cliente de um conteúdo, a mais recente. */
export type RodadaDoConteudo = {
  id: string;
  content_id: string;
  status: StatusRodada;
  numero_rodada: number;
  decidido_por: string | null;
  decidido_em: string | null;
  /** O motivo, quando a decisão foi "ajustes" ou "rejeitada". */
  comentario: string | null;
  solicitado_em: string;
};

/**
 * As rodadas de escopo cliente dos conteúdos pedidos, a mais recente de cada.
 *
 * Uma consulta para a tela inteira, e não uma por cartão: o calendário mostra
 * trinta posts e a campanha mostra cinquenta entregáveis — cinquenta idas ao
 * banco por causa de um selo é o tipo de conta que só aparece quando o mês
 * está cheio.
 */
export async function rodadasDo(
  tipo: Conteudo["tipo"],
  ids: string[],
): Promise<Map<string, RodadaDoConteudo>> {
  if (ids.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("approval_rounds")
    .select(
      "id, content_id, status, numero_rodada, decidido_por, decidido_em, comentario, solicitado_em",
    )
    .eq("content_type", tipo)
    .eq("escopo", "cliente")
    .in("content_id", ids)
    .order("numero_rodada", { ascending: false });

  const mapa = new Map<string, RodadaDoConteudo>();
  for (const linha of (data ?? []) as RodadaDoConteudo[]) {
    // A de maior número é a que vale; as anteriores são o histórico de um
    // ciclo que já fechou.
    if (!mapa.has(linha.content_id)) mapa.set(linha.content_id, linha);
  }
  return mapa;
}

export async function nomesDe(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const limpos = [...new Set(ids.filter(Boolean))] as string[];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", limpos);

  return new Map((data ?? []).map((p) => [p.id, p.nome]));
}

/**
 * Uma versão do material.
 *
 * `texto` é a legenda no post e o nome do arquivo no entregável — a coisa que
 * muda junto com a arte e que a pessoa quer conferir depois de pedir ajuste.
 * Quem escreve o rótulo é a tela, porque é ela que sabe de que material se
 * trata.
 */
export type VersaoDoConteudo = {
  id: string;
  numero: number;
  arteUrl: string | null;
  /** Os slides desta versão, em ordem — vazio quando a peça é uma arte só.
   *  A capa continua em `arteUrl`, e é o primeiro deles. */
  arquivos: string[];
  texto: string | null;
  notas: string | null;
  quando: string;
  quem: string | null;
};

/**
 * A conversa sobre um material.
 *
 * **O comentário interno não é filtrado aqui**, e é de propósito: quem o
 * esconde é `comments_select_cliente`, que exige `interno = false`. Repetir o
 * filtro criaria um segundo lugar onde a regra pode divergir — e para a
 * equipe, que lê os dois, a consulta é a mesma.
 */
export type ComentarioDoConteudo = {
  id: string;
  texto: string;
  quando: string;
  autorId: string;
  autor: string;
  daAgencia: boolean;
  interno: boolean;
  respostaA: string | null;
};

export async function comentariosDe(
  conteudo: Conteudo,
): Promise<ComentarioDoConteudo[]> {
  const supabase = await criarClienteServidor();
  const { content_type, content_id } = colunasDoConteudo(conteudo);

  const { data } = await supabase
    .from("comments")
    .select("id, texto, created_at, autor_id, interno, resposta_a")
    .eq("content_type", content_type)
    .eq("content_id", content_id)
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
 * As artes de um bucket privado, assinadas.
 *
 * O bucket é privado — material não publicado é da agência, e URL pública é
 * URL que circula antes de o cliente ter decidido. As assinadas valem uma hora
 * e saem sob a sessão de quem pediu, então o RLS do Storage continua valendo.
 *
 * Um endereço que já começa com `http` passa direto: nem toda arte mora no
 * bucket — algumas são link de Drive ou de Figma, e assinar um endereço que
 * não é do Storage devolveria erro e apagaria a imagem da tela.
 */
export async function assinarArquivos(
  bucket: string,
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
    .from(bucket)
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
