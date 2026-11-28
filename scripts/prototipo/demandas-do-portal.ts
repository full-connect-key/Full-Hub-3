/**
 * Versao de prototipo de src/lib/dados/demandas-do-portal.ts.
 *
 * Duas demandas: uma com material esperando o cliente (o box em destaque) e
 * uma no meio do caminho.
 */
import type {
  ConteudoEmProducao,
  DemandaNoPortal,
  EtapaNoPortal,
} from "../../src/lib/dados/demandas-do-portal";

export type { ConteudoEmProducao, DemandaNoPortal, EtapaNoPortal };

export async function conteudosEmProducao(
  mes: string,
  clienteId?: string | null,
): Promise<ConteudoEmProducao[]> {
  void clienteId;
  return [
    { id: "5f000000-0000-0000-0000-000000000001", tema: "Receita de fim de ano", dataPublicacao: `${mes}-22`, formato: "Reels" },
    { id: "5f000000-0000-0000-0000-000000000002", tema: "Bastidores da loja", dataPublicacao: `${mes}-27`, formato: "Carrossel" },
  ];
}

export async function demandasDoPortal(
  clienteId?: string | null,
): Promise<DemandaNoPortal[]> {
  void clienteId;
  return [
    {
      id: "5e000000-0000-0000-0000-000000000001",
      titulo: "Ativação da loja conceito",
      prazo: "2026-12-05",
      concluida: false,
      esperando: true,
      passos: [
        { titulo: "Adesivação da máquina", estado: "em_andamento" },
        { titulo: "Material de ponto de venda", estado: "a_fazer" },
      ],
    },
    {
      id: "5e000000-0000-0000-0000-000000000002",
      titulo: "Catálogo de verão",
      prazo: "2026-12-18",
      concluida: false,
      esperando: false,
      passos: [
        { titulo: "Fotos", estado: "concluida" },
        { titulo: "Diagramação", estado: "em_andamento" },
        { titulo: "Revisão", estado: "a_fazer" },
      ],
    },
  ];
}
