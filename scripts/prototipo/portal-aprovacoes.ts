/**
 * Versao de prototipo de src/lib/dados/portal-aprovacoes.ts.
 *
 * O que o cliente ve: uma peca esperando a decisao dele e uma ja decidida, com
 * o que ele escreveu da outra vez. Nada da aprovacao interna aparece aqui.
 */
import type { AprovacaoDoCliente } from "../../src/lib/dados/portal-aprovacoes";

export type { AprovacaoDoCliente };

const AGORA = Date.now();
const diasAtras = (d: number) => new Date(AGORA - d * 86400_000).toISOString();

export async function minhasAprovacoes(
  usuarioId: string,
  clienteId?: string,
): Promise<{
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
}> {
  // O prototipo nao filtra: estes dados ja sao os de um cliente so. Os dois
  // parametros existem para a assinatura bater com a do modulo real -- no app,
  // `clienteId` e o que impede a visualizacao administrativa do portal de uma
  // empresa mostrar as aprovacoes de outra.
  void usuarioId;
  void clienteId;

  return {
    esperando: [
      {
        rodadaId: "pc1",
        subtaskId: "s4",
        titulo: "Roteiro do reels",
        task: "Reels institucional",
        numeroRodada: 1,
        status: "pendente",
        enviadaEm: diasAtras(1),
        decididaEm: null,
        comentario: null,
        entregas: [
          {
            id: "pe1",
            subtask_id: "s4",
            approval_round_id: "pc1",
            tipo: "link",
            url: "https://docs.google.com/document/exemplo",
            nome: "Roteiro v1",
            enviado_por: "a0000000-0000-0000-0000-000000000003",
            created_at: diasAtras(1),
          },
        ],
        conversa: [
          {
            id: "pk1",
            texto: "Seguimos a linha que você aprovou na reunião. Qualquer ajuste, é só dizer.",
            created_at: diasAtras(1),
            meu: false,
          },
        ],
      },
    ],
    decididas: [
      {
        rodadaId: "pc0",
        subtaskId: "s0",
        titulo: "Arte do post de aniversário",
        task: "Aniversário da loja",
        numeroRodada: 2,
        status: "aprovada",
        enviadaEm: diasAtras(9),
        decididaEm: diasAtras(8),
        comentario: "Ficou ótimo, podem publicar.",
        entregas: [],
        conversa: [],
      },
    ],
  };
}
