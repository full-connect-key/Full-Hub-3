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

    return (data ?? []).filter(
      (c): c is { id: string; nome_empresa: string; slug: string } =>
        Boolean(c.slug),
    );
  },
);

/** A empresa de um endereço. Null quando o slug não existe ou está inativa. */
export const obterClientePeloSlug = cache(
  async (slug: string): Promise<Client | null> => {
    const supabase = await criarClienteServidor();

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    return data ?? null;
  },
);

/**
 * Quem tem acesso ao portal de uma empresa, com a data do último login.
 *
 * É o mesmo conteúdo da aba "Quem tem acesso" que o cliente vê, montado por
 * outro caminho: `usuarios_do_meu_cliente()` fecha em `my_client_ids()`, que é
 * vazio para quem é da agência. Aqui as policies já fazem o trabalho —
 * `client_users`, `profiles` e `client_access_log` abrem para `is_staff()` —,
 * então basta perguntar direto.
 */
export async function usuariosDoPortal(
  clienteId: string,
): Promise<
  {
    user_id: string;
    nome: string;
    email: string;
    ultimo_acesso: string | null;
  }[]
> {
  const supabase = await criarClienteServidor();

  const { data: vinculos } = await supabase
    .from("client_users")
    .select("user_id")
    .eq("client_id", clienteId);

  const ids = [...new Set((vinculos ?? []).map((v) => v.user_id))];
  if (ids.length === 0) return [];

  const [{ data: pessoas }, { data: acessos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids)
      .order("nome"),
    supabase
      .from("client_access_log")
      .select("user_id, created_at")
      .eq("acao", "login")
      .in("user_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  // O último login de cada pessoa é a primeira linha dela na lista ordenada.
  const ultimo = new Map<string, string>();
  for (const linha of acessos ?? []) {
    if (!ultimo.has(linha.user_id)) ultimo.set(linha.user_id, linha.created_at);
  }

  return (pessoas ?? []).map((pessoa) => ({
    user_id: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
    ultimo_acesso: ultimo.get(pessoa.id) ?? null,
  }));
}
