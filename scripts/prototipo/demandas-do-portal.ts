/**
 * Versao de prototipo de src/lib/dados/demandas-do-portal.ts.
 *
 * Duas demandas: uma com material esperando o cliente (o box em destaque) e
 * uma no meio do caminho.
 */
import type {
  DemandaNoPortal,
  EtapaNoPortal,
} from "../../src/lib/dados/demandas-do-portal";

export type { DemandaNoPortal, EtapaNoPortal };

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
      etapas: [
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
      etapas: [
        { titulo: "Fotos", estado: "concluida" },
        { titulo: "Diagramação", estado: "em_andamento" },
        { titulo: "Revisão", estado: "a_fazer" },
      ],
    },
  ];
}
