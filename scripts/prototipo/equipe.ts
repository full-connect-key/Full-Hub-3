/**
 * Versao de prototipo de src/lib/dados/equipe.ts.
 */
import type { Profile, TeamMember } from "@/lib/supabase/database.types";

import { EQUIPE_EXEMPLO } from "./dados-exemplo";

export type MembroDaEquipe = Profile & { membro: TeamMember | null };

/**
 * A assinatura precisa bater com a do modulo real, que a pagina de Equipe
 * chama com `true` para tambem trazer quem foi desligado. No conjunto de
 * exemplo ninguem esta desligado, entao o filtro nao muda o resultado -- mas
 * ele existe para o exemplo nao mentir sobre o comportamento.
 */
export async function listarEquipe(incluirDesligados = false): Promise<MembroDaEquipe[]> {
  const todos = EQUIPE_EXEMPLO as unknown as MembroDaEquipe[];
  return incluirDesligados ? todos : todos.filter((pessoa) => pessoa.ativo);
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
  // Carla e do Atendimento: responde por dois clientes e tem task em aberto.
  // Com task aberta, a tela de desligamento passa a exigir para quem
  // transferir -- e e isso que o prototipo precisa mostrar.
  const daCarla = userId === "a0000000-0000-0000-0000-000000000003";
  const tasksAbertas = daCarla ? 3 : 0;
  const clientesSobResponsabilidade = daCarla ? 2 : 0;

  return {
    tasksAbertas,
    solicitacoesPendentes: 0,
    clientesSobResponsabilidade,
    exigeTransferencia: tasksAbertas > 0,
    total: tasksAbertas + clientesSobResponsabilidade,
  };
}
