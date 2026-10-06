/**
 * Versao de prototipo de src/lib/dados/fluxo-do-cliente.ts (0064).
 *
 * A MUNDO VERDE ESTA CONFIGURADA E A OPTICA NAO, como no seed -- e a razao e a
 * mesma: "conta nunca configurada" e o estado de toda empresa no dia em que
 * esta aba aparece, e e ele que precisa ser conferido na imagem. Com as duas
 * configuradas, a tela do caso comum nunca sairia.
 *
 * E a Mundo Verde fica SEM REDATOR, que e o que faz o aviso da etapa orfa
 * aparecer nomeando a funcao em vez de dizer "alguma".
 */
import type { TeamFuncao } from "@/lib/supabase/database.types";

import type {
  FluxoDaConta,
  PadroesDaConta,
  RecorrenciaDaConta,
} from "../../src/lib/dados/fluxo-do-cliente";

export type { FluxoDaConta, PadroesDaConta, RecorrenciaDaConta };
export type { PessoaDoFluxo, EtapaResumida } from "../../src/lib/dados/fluxo-do-cliente";

export { PRAZO_DE_APROVACAO_PADRAO } from "@/lib/dominio/fluxo-do-cliente";

const VERDE = "c0000000-0000-0000-0000-00000000000a";

const MARINA = {
  id: "a0000000-0000-0000-0000-000000000006",
  nome: "Marina Costa",
  avatar_url: null,
};
const BRUNO = {
  id: "a0000000-0000-0000-0000-000000000005",
  nome: "Bruno Lima",
  avatar_url: null,
};
const CARLA = {
  id: "a0000000-0000-0000-0000-000000000003",
  nome: "Carla Nunes",
  avatar_url: null,
};
const DIEGO = {
  id: "a0000000-0000-0000-0000-000000000002",
  nome: "Diego Reis",
  avatar_url: null,
};

const DA_CONTA: Map<TeamFuncao, { id: string; nome: string; avatar_url: null }> = new Map([
  ["Atendimento" as TeamFuncao, CARLA],
  ["Social Media" as TeamFuncao, MARINA],
  ["Design" as TeamFuncao, BRUNO],
]);

export async function padroesDaConta(clienteId: string): Promise<PadroesDaConta> {
  if (clienteId !== VERDE) {
    return { linha: null, aprovadorInterno: null, porFuncao: [] };
  }

  return {
    linha: {
      id: "fd-verde",
      client_id: VERDE,
      aprovador_interno_id: DIEGO.id,
      pasta_entrega_url: "https://drive.google.com/drive/folders/mundo-verde-entregas",
      prazo_aprovacao_cliente_dias: 2,
      // A MUNDO VERDE APROVA A PAUTA (0076), e o exemplo existe para a imagem
      // mostrar o interruptor ligado com a consequência escrita embaixo dele.
      // Com a lista vazia, a seção sairia igual em toda conta — e o que ela
      // acrescenta é justamente o estado que quase nenhuma conta tem.
      social_flow_id: "f1000000-0000-4000-8000-00000000000a",
      created_at: "2027-01-10T12:00:00.000Z",
      updated_at: "2027-03-02T09:30:00.000Z",
    },
    aprovadorInterno: DIEGO,
    porFuncao: [...DA_CONTA.entries()]
      .map(([funcao, pessoa]) => ({ funcao, pessoa }))
      .sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR")),
  };
}

export async function equipePorFuncaoDaConta(
  clienteId: string,
): Promise<Map<TeamFuncao, string>> {
  if (clienteId !== VERDE) return new Map();
  return new Map([...DA_CONTA.entries()].map(([funcao, pessoa]) => [funcao, pessoa.id]));
}

export async function fluxosDaConta(clienteId: string): Promise<FluxoDaConta[]> {
  const temPadrao = clienteId === VERDE;
  const semDono = (funcao: TeamFuncao) => temPadrao && !DA_CONTA.has(funcao);

  return [
    {
      id: "tt-feed",
      nome: "Post de feed",
      clientId: null,
      etapas: [
        { nome: "Pauta", requerAprovacao: true, funcao: "Social Media", semDono: semDono("Social Media") },
        { nome: "Conteúdo", requerAprovacao: false, funcao: "Redator", semDono: semDono("Redator") },
        { nome: "Arte", requerAprovacao: true, funcao: "Design", semDono: semDono("Design") },
        { nome: "Agendamento", requerAprovacao: false, funcao: "Social Media", semDono: semDono("Social Media") },
      ],
    },
    // O FLUXO DE UM CLIENTE SO APARECE PARA ELE, como `listarWorkflows` filtra:
    // um fluxo "Campanha da Mundo Verde" na ficha da Optica seria a tela
    // mostrando o trabalho de outra conta.
    ...(temPadrao
      ? ([
    {
      id: "tt-campanha",
      nome: "Campanha da Mundo Verde",
      clientId: VERDE,
      etapas: [
        { nome: "Conceito", requerAprovacao: false, funcao: "Atendimento", semDono: false },
        { nome: "KV", requerAprovacao: true, funcao: "Design", semDono: semDono("Design") },
        { nome: "Adaptações", requerAprovacao: false, funcao: "Design", semDono: semDono("Design") },
      ],
    },
        ] satisfies FluxoDaConta[])
      : []),
  ];
}

export async function recorrenciasDaConta(clienteId: string): Promise<RecorrenciaDaConta[]> {
  if (clienteId !== VERDE) return [];
  return [
    {
      id: "rec-stories",
      nome: "Stories de toda segunda",
      frequencia: "semanal",
      ativo: true,
      proximaGeracaoEm: "2027-03-08",
    },
    {
      id: "rec-relatorio",
      nome: "Relatório do dia 5",
      frequencia: "mensal",
      ativo: false,
      proximaGeracaoEm: null,
    },
  ];
}
