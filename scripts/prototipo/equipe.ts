/**
 * Versao de prototipo de src/lib/dados/equipe.ts.
 */
import type { Profile, TeamMember } from "@/lib/supabase/database.types";

import { EQUIPE_EXEMPLO } from "./dados-exemplo";

export type MembroDaEquipe = Profile & { membro: TeamMember | null };

export async function listarEquipe(): Promise<MembroDaEquipe[]> {
  return EQUIPE_EXEMPLO as unknown as MembroDaEquipe[];
}

export async function obterColaborador(id: string): Promise<MembroDaEquipe | null> {
  return (
    (EQUIPE_EXEMPLO.find((pessoa) => pessoa.id === id) as unknown as MembroDaEquipe) ?? null
  );
}

export async function listarEquipeAtiva() {
  return EQUIPE_EXEMPLO.map((pessoa) => ({
    id: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
  }));
}

export async function vinculosDoColaborador(userId: string) {
  // Carla responde por um cliente; os demais, por nenhum.
  const clientes = userId === "a0000000-0000-0000-0000-000000000003" ? 1 : 0;
  return {
    tasksAbertas: 0,
    solicitacoesPendentes: 0,
    clientesSobResponsabilidade: clientes,
    exigeTransferencia: false,
    total: clientes,
  };
}
