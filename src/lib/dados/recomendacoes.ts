import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { RecCategoria, Recomendacao } from "@/lib/supabase/database.types";

/**
 * As consultas do feed de Recomendações.
 *
 * A RLS já fecha o feed para `is_staff()`, e o cliente não alcança nada disto.
 * Esta camada só arranja: post, autor, contagem de curtidas, se EU curti, e os
 * comentários com a thread de um nível.
 */

export type Autor = { id: string; nome: string; avatar_url: string | null };

export type ComentarioDoPost = {
  id: string;
  texto: string;
  created_at: string;
  autor: Autor | null;
  respostaA: string | null;
};

export type PostDoFeed = Recomendacao & {
  autor: Autor | null;
  quantasCurtidas: number;
  euCurti: boolean;
  comentarios: ComentarioDoPost[];
};

export type FiltrosDoFeed = {
  categoria: RecCategoria | null;
  tag: string | null;
  busca: string | null;
  ordem: "recentes" | "curtidas";
};

/**
 * O feed inteiro numa leitura.
 *
 * A ORDENAÇÃO POR CURTIDAS É FEITA AQUI, e não no banco, de propósito: seria
 * uma view materializada ou um `order by` sobre uma agregação, e o feed de uma
 * agência de dez pessoas não tem volume que justifique nenhum dos dois. Com a
 * tabela grande, o caminho é uma coluna `quantas_curtidas` mantida por
 * trigger — e aí a conta muda de lugar, não de dono.
 */
export const listarFeed = cache(
  async (usuarioId: string, filtros: FiltrosDoFeed): Promise<PostDoFeed[]> => {
    const supabase = await criarClienteServidor();

    let consulta = supabase.from("recommendations").select("*");

    if (filtros.categoria) consulta = consulta.eq("categoria", filtros.categoria);
    if (filtros.tag) consulta = consulta.contains("tags", [filtros.tag]);
    if (filtros.busca) {
      const termo = `%${filtros.busca}%`;
      consulta = consulta.or(`titulo.ilike.${termo},descricao.ilike.${termo}`);
    }

    const { data: posts } = await consulta.order("created_at", { ascending: false });
    if (!posts || posts.length === 0) return [];

    const ids = posts.map((p) => p.id);
    const idsDeAutor = [...new Set(posts.map((p) => p.autor_id))];

    const [{ data: curtidas }, { data: comentarios }] = await Promise.all([
      supabase.from("recommendation_likes").select("recommendation_id, user_id").in(
        "recommendation_id",
        ids,
      ),
      supabase
        .from("recommendation_comments")
        .select("*")
        .in("recommendation_id", ids)
        .order("created_at"),
    ]);

    const todosOsAutores = [
      ...new Set([...idsDeAutor, ...(comentarios ?? []).map((c) => c.autor_id)]),
    ];
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", todosOsAutores);

    const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

    const montados: PostDoFeed[] = posts.map((post) => {
      const minhas = (curtidas ?? []).filter((c) => c.recommendation_id === post.id);
      return {
        ...post,
        autor: porId.get(post.autor_id) ?? null,
        quantasCurtidas: minhas.length,
        euCurti: minhas.some((c) => c.user_id === usuarioId),
        comentarios: (comentarios ?? [])
          .filter((c) => c.recommendation_id === post.id)
          .map((c) => ({
            id: c.id,
            texto: c.texto,
            created_at: c.created_at,
            autor: porId.get(c.autor_id) ?? null,
            respostaA: c.resposta_a,
          })),
      };
    });

    if (filtros.ordem === "curtidas") {
      return montados.sort(
        (a, b) =>
          b.quantasCurtidas - a.quantasCurtidas ||
          b.created_at.localeCompare(a.created_at),
      );
    }
    return montados;
  },
);

export type EmAlta = { id: string; titulo: string; categoria: RecCategoria; quantas: number };

/**
 * "Em alta este mês" — as cinco mais curtidas dos últimos 30 dias.
 *
 * DOS ÚLTIMOS 30 DIAS, e não de sempre: uma lista de sempre congela nos
 * primeiros posts da história do feed e nunca mais muda. O ponto da seção é
 * dizer o que a equipe anda achando bom agora.
 *
 * O `hojeISO` vem de fora, como em todo o resto do produto: se a função lesse
 * o relógio, o servidor e o navegador em fusos diferentes recortariam janelas
 * diferentes.
 */
export const emAltaNoMes = cache(
  async (hojeISO: string, limite = 5): Promise<EmAlta[]> => {
    const supabase = await criarClienteServidor();

    const desde = new Date(hojeISO);
    desde.setDate(desde.getDate() - 30);

    const { data: posts } = await supabase
      .from("recommendations")
      .select("id, titulo, categoria")
      .gte("created_at", desde.toISOString());

    if (!posts || posts.length === 0) return [];

    const { data: curtidas } = await supabase
      .from("recommendation_likes")
      .select("recommendation_id")
      .in(
        "recommendation_id",
        posts.map((p) => p.id),
      );

    const conta = new Map<string, number>();
    for (const c of curtidas ?? []) {
      conta.set(c.recommendation_id, (conta.get(c.recommendation_id) ?? 0) + 1);
    }

    return posts
      .map((p) => ({ ...p, quantas: conta.get(p.id) ?? 0 }))
      .filter((p) => p.quantas > 0)
      .sort((a, b) => b.quantas - a.quantas || a.titulo.localeCompare(b.titulo))
      .slice(0, limite);
  },
);

/** As tags de todos os posts, para a nuvem. Só a coluna — a nuvem conta em
 *  `lib/dominio/recomendacoes.ts`, que é onde os dois lados leem a mesma
 *  conta. */
export const tagsDoFeed = cache(async (): Promise<{ tags: string[] | null }[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("recommendations").select("tags");
  return data ?? [];
});
