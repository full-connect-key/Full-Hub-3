import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/database.types";

/**
 * Os portais de clientes, vistos pela equipe.
 *
 * O QUE ISTO NÃO É: login como cliente. A sessão continua sendo a da pessoa da
 * agência, com o `auth.uid()` dela. Nenhum token é trocado, nada é
 * "impersonado". A gestão já podia ler os dados desses clientes pelo painel —
 * o que /portal/{slug} acrescenta é o ARRANJO: ver a mesma informação na tela
 * em que o cliente vê, para conferir o que ele está enxergando antes de uma
 * reunião.
 *
 * Por isso a visualização é só leitura, e por isso ela deixa rastro.
 */

/** As empresas ativas, para a grade da tela inicial. */
export const listarPortaisDeClientes = cache(
  async (): Promise<{ id: string; nome_empresa: string; slug: string }[]> => {
    const supabase = await criarClienteServidor();

    const { data } = await supabase
      .from("clients")
      .select("id, nome_empresa, slug")
      .eq("ativo", true)
      .order("nome_empresa");

    return (data ?? [])
      .filter((c): c is { id: string; nome_empresa: string; slug: string } => Boolean(c.slug));
  },
);

/** A empresa de um endereço. Null quando o slug não existe ou está inativa. */
export const obterClientePeloSlug = cache(async (slug: string): Promise<Client | null> => {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return data ?? null;
});
