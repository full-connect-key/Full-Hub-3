import "server-only";

import { cache } from "react";

import { SUBTAREFAS_EM_ABERTO } from "@/lib/dominio/tasks";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Profile, TeamMember } from "@/lib/supabase/database.types";

/**
 * Consultas da equipe interna.
 *
 * Uma pessoa da equipe tem duas linhas: `profiles` (acesso) e `team_members`
 * (RH). Estão separadas porque nem todo usuário é da equipe — um cliente tem
 * profile e não tem team_member.
 */

export type MembroDaEquipe = Profile & {
  membro: TeamMember | null;
};

async function juntarPerfisComMembros(
  perfis: Profile[],
  membros: TeamMember[],
): Promise<MembroDaEquipe[]> {
  const porUsuario = new Map(membros.map((m) => [m.user_id, m]));
  return perfis.map((perfil) => ({ ...perfil, membro: porUsuario.get(perfil.id) ?? null }));
}

/**
 * Todo mundo da equipe.
 *
 * `incluirDesligados` é falso por padrão: quem saiu não deve aparecer em lista
 * nem em seletor. Os registros continuam no banco, com a autoria preservada.
 */
export const listarEquipe = cache(async (incluirDesligados = false): Promise<MembroDaEquipe[]> => {
  const supabase = await criarClienteServidor();

  const consulta = supabase
    .from("profiles")
    .select("*")
    .neq("role", "cliente")
    .order("nome");

  const { data: perfis } = incluirDesligados ? await consulta : await consulta.eq("ativo", true);
  if (!perfis || perfis.length === 0) return [];

  const { data: membros } = await supabase
    .from("team_members")
    .select("*")
    .in(
      "user_id",
      perfis.map((p) => p.id),
    );

  return juntarPerfisComMembros(perfis, membros ?? []);
});

export const obterColaborador = cache(async (id: string): Promise<MembroDaEquipe | null> => {
  const supabase = await criarClienteServidor();

  const { data: perfil } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!perfil) return null;

  const { data: membro } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  return { ...perfil, membro: membro ?? null };
});

/**
 * Quem pode receber tarefas e responder por clientes: equipe ativa.
 * Usada nos seletores de responsável.
 */
export const listarEquipeAtiva = cache(async () => {
  const equipe = await listarEquipe(false);
  return equipe
    .filter((pessoa) => pessoa.membro?.ativo !== false)
    .map((pessoa) => ({ id: pessoa.id, nome: pessoa.nome, email: pessoa.email }));
});

/**
 * O que está preso ao nome de uma pessoa e precisa ser resolvido antes de
 * desligá-la.
 *
 * `tasksAbertas` conta SUBTAREFAS em aberto no nome da pessoa: desde o Sprint
 * 3B é a subtarefa que tem dono, e é ela que precisa de alguém para assumir.
 * Com qualquer uma em aberto, a tela de desligamento passa a exigir para quem
 * transferir.
 * Full Days entram no Sprint 6 — some a contagem aqui e a tela obedece
 * sozinha, porque ela só olha para este resultado.
 */
export async function vinculosDoColaborador(userId: string) {
  const supabase = await criarClienteServidor();

  const [{ count: tasks }, { count: clientes }] = await Promise.all([
    supabase
      .from("subtasks")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_id", userId)
      .in("status", SUBTAREFAS_EM_ABERTO),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("responsavel_atendimento_id", userId),
  ]);

  const tasksAbertas = tasks ?? 0;
  const clientesSobResponsabilidade = clientes ?? 0;

  // Sprint 6: solicitações de Full Day pendentes entram aqui.
  const solicitacoesPendentes = 0;

  return {
    tasksAbertas,
    solicitacoesPendentes,
    clientesSobResponsabilidade,
    exigeTransferencia: tasksAbertas > 0,
    total: tasksAbertas + solicitacoesPendentes + clientesSobResponsabilidade,
  };
}
