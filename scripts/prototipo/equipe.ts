/**
 * Versao de prototipo de src/lib/dados/equipe.ts.
 */
import type { Profile, TeamMember } from "@/lib/supabase/database.types";

import { EQUIPE_EXEMPLO } from "./dados-exemplo";

export type MembroDaEquipe = Profile & { membro: TeamMember | null };

/**
 * A assinatura precisa bater com a do modulo real, que a pagina de Equipe
 * chama com `true` para tambem trazer quem foi desligado -- e desde que o
 * conjunto de exemplo tem UMA pessoa desligada, o parametro passou a mudar o
 * resultado de verdade. Ate aqui ele nao mudava nada, e era essa a razao pela
 * qual nenhuma imagem mostrava a linha de quem saiu.
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

/**
 * QUEM PODE RECEBER TRABALHO, e por isso ela FILTRA -- o que o stub nao fazia.
 *
 * A de producao chama `listarEquipe(false)` (que recorta `profiles.ativo`) e
 * ainda descarta `membro.ativo === false`; esta mapeava o conjunto inteiro.
 * Era um bug latente: so nao aparecia porque ninguem no exemplo estava
 * desligado. Com a Helena no array, sem o filtro todo seletor de responsavel
 * do prototipo passaria a oferecer quem saiu da agencia -- o exemplo mostrando
 * um estado que o produto nao tem, e degradando dezenas de imagens velhas.
 */
export async function listarEquipeAtiva() {
  return EQUIPE_EXEMPLO.filter(
    (pessoa) => pessoa.ativo && pessoa.membro?.ativo !== false,
  ).map((pessoa) => ({
    id: pessoa.id,
    nome: pessoa.nome,
    email: pessoa.email,
    avatar_url: pessoa.avatar_url ?? null,
    funcao: pessoa.membro?.funcao ?? null,
    // O PERFIL VIAJA JUNTO desde a 0064: o seletor de aprovador padrao da
    // conta lista so quem pode decidir uma rodada interna, e sem o role ele
    // sairia vazio na imagem do prototipo.
    role: pessoa.role,
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
    // UM EQUIPAMENTO COM ELA (0069): e o que faz a faixa de comodato do
    // desligamento aparecer na imagem. Sem isto, o bloco que obriga a decidir
    // sobre o notebook nunca seria fotografado.
    equipamentosEmAberto: daCarla ? 1 : 0,
    exigeTransferencia: tasksAbertas > 0,
    total: tasksAbertas + clientesSobResponsabilidade,
  };
}

/**
 * A ficha de RH de quem esta "logado" no prototipo.
 *
 * Quem e a pessoa vem de PROTOTIPO_ROLE, entao a ficha tem que acompanhar: com
 * um cargo fixo, o cartao do menu diria "Socia-diretora" tambem quando o
 * prototipo esta rodando como colaborador.
 */
export async function obterMinhaFicha(): Promise<TeamMember | null> {
  const eu = EQUIPE_EXEMPLO.find((pessoa) => pessoa.role === (process.env.PROTOTIPO_ROLE ?? "socio"));
  return ((eu ?? EQUIPE_EXEMPLO[0]).membro as unknown as TeamMember) ?? null;
}
