import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Empresas que a pessoa logada enxerga.
 *
 * Não há filtro por usuário no código de propósito: o RLS da tabela `clients`
 * já limita o resultado — a equipe vê todas, o cliente vê só as vinculadas a
 * ele em `client_users`. Filtrar de novo aqui seria repetir a regra em dois
 * lugares, e os dois sairiam do lugar com o tempo.
 */
export const obterMinhasEmpresas = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .eq("ativo", true)
    .order("nome_empresa");

  return data ?? [];
});
