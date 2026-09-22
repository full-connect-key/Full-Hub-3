import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/database.types";

/**
 * Consultas de clientes.
 *
 * Os relacionamentos são resolvidos com uma segunda consulta e juntados aqui,
 * em vez de usar o embed do PostgREST. É mais previsível: o embed depende do
 * nome exato da constraint de chave estrangeira e quebra em silêncio quando
 * ela muda de nome numa migration.
 *
 * Nenhuma consulta filtra por usuário: o RLS de `clients` já faz isso — a
 * equipe vê todas, o cliente vê só as vinculadas a ele. Repetir o filtro aqui
 * seria manter a mesma regra em dois lugares.
 */

export type ClienteComResumo = Client & {
  responsavel: { id: string; nome: string } | null;
  usuariosComAcesso: number;
};

/** Empresas que a pessoa logada enxerga. Usada pelo Portal. */
export const obterMinhasEmpresas = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .eq("ativo", true)
    .order("nome_empresa");

  return data ?? [];
});

export const listarClientes = cache(async (): Promise<ClienteComResumo[]> => {
  const supabase = await criarClienteServidor();

  const [{ data: clientes }, { data: vinculos }] = await Promise.all([
    supabase.from("clients").select("*").order("nome_empresa"),
    supabase.from("client_users").select("client_id, user_id"),
  ]);

  if (!clientes) return [];

  const idsDeResponsaveis = [
    ...new Set(clientes.map((c) => c.responsavel_atendimento_id).filter(Boolean)),
  ] as string[];

  const { data: responsaveis } = idsDeResponsaveis.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsDeResponsaveis)
    : { data: [] };

  const porId = new Map((responsaveis ?? []).map((p) => [p.id, p]));
  const contagem = new Map<string, number>();
  for (const vinculo of vinculos ?? []) {
    contagem.set(vinculo.client_id, (contagem.get(vinculo.client_id) ?? 0) + 1);
  }

  return clientes.map((cliente) => ({
    ...cliente,
    responsavel: cliente.responsavel_atendimento_id
      ? (porId.get(cliente.responsavel_atendimento_id) ?? null)
      : null,
    usuariosComAcesso: contagem.get(cliente.id) ?? 0,
  }));
});

export const obterCliente = cache(async (id: string): Promise<Client | null> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return data ?? null;
});

/** Pessoas do lado do cliente com acesso ao portal desta empresa. */
export const usuariosDoCliente = cache(async (clientId: string) => {
  const supabase = await criarClienteServidor();

  const { data: vinculos } = await supabase
    .from("client_users")
    .select("id, user_id, created_at")
    .eq("client_id", clientId);

  if (!vinculos || vinculos.length === 0) return [];

  const { data: perfis } = await supabase
    .from("profiles")
    .select("id, nome, email, ativo")
    .in(
      "id",
      vinculos.map((v) => v.user_id),
    );

  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

  return vinculos
    .map((vinculo) => {
      const perfil = porId.get(vinculo.user_id);
      return perfil
        ? { vinculoId: vinculo.id, vinculadoEm: vinculo.created_at, ...perfil }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
});

/**
 * O que impede apagar um cliente de verdade.
 *
 * Hoje só existem os acessos ao portal. Campanhas e posts entram em sprints
 * futuros: acrescente a contagem aqui e a tela de exclusão passa a barrar
 * sozinha, porque ela só olha para este resultado.
 */
export async function vinculosDoCliente(clientId: string) {
  const supabase = await criarClienteServidor();

  const { count } = await supabase
    .from("client_users")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  const usuarios = count ?? 0;

  // Sprint 5+: campanhas e posts entram aqui.
  const campanhas = 0;
  const posts = 0;

  return {
    usuarios,
    campanhas,
    posts,
    total: usuarios + campanhas + posts,
    impedeExclusao: campanhas + posts > 0,
  };
}
