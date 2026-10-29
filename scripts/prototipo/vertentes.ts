/**
 * As vertentes de exemplo (migration 0118).
 *
 * **A MUNDO VERDE TEM AS CINCO DO PEDIDO**, e elas são as do usuário: *"o
 * exemplo apresenta cinco vertentes, considerando 'Nutricionistas e
 * Franqueados' uma única área"*.
 *
 * **A ÓPTICA VISÃO NÃO TEM NENHUMA, de propósito.** Conta sem vertente é um
 * estado de verdade do produto — a demanda dela não pede área —, e com as
 * duas contas cadastradas nenhuma imagem mostraria o vazio nem o seletor
 * ausente. É a lição da Óptica Visão sem atendente (0062) e da peça de
 * campanha sem fixture: o exemplo que mostra o produto num estado só esconde
 * uma classe inteira de bug.
 *
 * **E UMA DELAS ESTÁ DESATIVADA**, pela mesma razão: ela é o único jeito de a
 * imagem provar que a lista distingue a ativa da aposentada, e que a
 * desativada continua na tela em vez de sumir.
 */
import type { Vertente } from "@/lib/dominio/vertentes";

const MUNDO_VERDE = "c0000000-0000-0000-0000-00000000000a";

export const VERTENTES_EXEMPLO: Vertente[] = [
  { id: "ee000000-0000-0000-0000-000000000001", client_id: MUNDO_VERDE, nome: "Institucional", ordem: 10, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000002", client_id: MUNDO_VERDE, nome: "Lojas Próprias", ordem: 20, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000003", client_id: MUNDO_VERDE, nome: "Marca Própria", ordem: 30, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000004", client_id: MUNDO_VERDE, nome: "Nutricionistas e Franqueados", ordem: 40, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000005", client_id: MUNDO_VERDE, nome: "E-commerce", ordem: 50, ativa: true, created_at: "2026-01-10T10:00:00.000Z" },
  { id: "ee000000-0000-0000-0000-000000000006", client_id: MUNDO_VERDE, nome: "Feiras e eventos", ordem: 60, ativa: false, created_at: "2026-01-10T10:00:00.000Z" },
];

export async function vertentesDoCliente(clienteId: string | null): Promise<Vertente[]> {
  if (!clienteId) return [];
  return VERTENTES_EXEMPLO.filter((v) => v.client_id === clienteId);
}

export async function vertentesDasContas(
  clienteIds: string[],
): Promise<Map<string, Vertente[]>> {
  const mapa = new Map<string, Vertente[]>();
  for (const v of VERTENTES_EXEMPLO) {
    if (!clienteIds.includes(v.client_id)) continue;
    const lista = mapa.get(v.client_id) ?? [];
    lista.push(v);
    mapa.set(v.client_id, lista);
  }
  return mapa;
}
