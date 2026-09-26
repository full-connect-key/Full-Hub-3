/**
 * Versao de prototipo de src/lib/dados/clientes.ts.
 * Devolve dados de exemplo, sem falar com o Supabase.
 */
import type { Client } from "@/lib/supabase/database.types";

import { CLIENTES_EXEMPLO, EMPRESAS_EXEMPLO } from "./dados-exemplo";

export type ClienteComResumo = Client & {
  responsavel: { id: string; nome: string } | null;
  usuariosComAcesso: number;
};

const RESPONSAVEIS: Record<string, string> = {
  "a0000000-0000-0000-0000-000000000001": "Ana Souza",
  "a0000000-0000-0000-0000-000000000003": "Carla Nunes",
};

const ACESSOS: Record<string, number> = {
  "c0000000-0000-0000-0000-00000000000a": 2,
  "c0000000-0000-0000-0000-00000000000b": 1,
  "c0000000-0000-0000-0000-00000000000c": 0,
};

export async function obterMinhasEmpresas() {
  return EMPRESAS_EXEMPLO;
}

/**
 * A identidade do portal (0063), com uma capa de exemplo do proprio site.
 *
 * O caminho e um arquivo de `public/` e nao do bucket, como a capa da campanha
 * do seed: `enderecoDaArte` ja sabe distinguir os dois -- assinar um endereco
 * que nao e do Storage devolve erro, e a imagem sumiria da tela sem nada
 * avisando.
 */
export async function identidadeDoPortal(clienteId?: string) {
  const alvo = clienteId ?? EMPRESAS_EXEMPLO[0]?.id;
  const empresa = CLIENTES_EXEMPLO.find((c) => c.id === alvo);
  if (!empresa) return null;
  return {
    nome: empresa.nome_empresa,
    capaAssinada: "/exemplos/capa-1.svg",
    // A foto fica NULA de propósito: é o estado do dia um de todo cliente, e
    // é o que precisa ser conferido na imagem — a capa com foto é o caso
    // fácil; o círculo vazio sobre a faixa é o que quebra.
    fotoAssinada: null,
  };
}

export async function listarClientes(): Promise<ClienteComResumo[]> {
  return CLIENTES_EXEMPLO.map((cliente) => ({
    ...(cliente as Client),
    responsavel: cliente.responsavel_atendimento_id
      ? { id: cliente.responsavel_atendimento_id, nome: RESPONSAVEIS[cliente.responsavel_atendimento_id] }
      : null,
    usuariosComAcesso: ACESSOS[cliente.id] ?? 0,
  }));
}

export async function obterCliente(id: string): Promise<Client | null> {
  return (CLIENTES_EXEMPLO.find((cliente) => cliente.id === id) as Client) ?? null;
}

export async function usuariosDoCliente(clientId: string) {
  if (clientId !== "c0000000-0000-0000-0000-00000000000a") return [];
  return [
    {
      vinculoId: "v1",
      vinculadoEm: "2024-03-12T10:00:00.000Z",
      id: "a0000000-0000-0000-0000-000000000004",
      nome: "Caio Alves",
      email: "contato@mundoverde.com.br",
      ativo: true,
    },
    {
      vinculoId: "v2",
      vinculadoEm: "2024-09-02T10:00:00.000Z",
      id: "a0000000-0000-0000-0000-000000000008",
      nome: "Juliana Prado",
      email: "marketing@mundoverde.com.br",
      ativo: true,
    },
  ];
}

export async function vinculosDoCliente(clientId: string) {
  const usuarios = (await usuariosDoCliente(clientId)).length;
  // A Mundo Verde tem trabalho no nome dela, entao a exclusao aparece barrada
  // no prototipo -- que e o comportamento que a agencia vai encontrar.
  const tasks = clientId === "c0000000-0000-0000-0000-00000000000a" ? 3 : 0;
  const total = usuarios + tasks;
  return {
    usuarios,
    tasks,
    campanhas: 0,
    posts: 0,
    lancamentos: 0,
    total,
    impedeExclusao: total > 0,
  };
}
