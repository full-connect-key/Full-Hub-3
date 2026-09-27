/**
 * Versao de prototipo de src/lib/dados/notas-fiscais.ts (0065).
 *
 * OS QUATRO ESTADOS APARECEM, e e o criterio: uma tela que so mostra o caso
 * feliz nao conferiu o bloco da recusada -- que e o unico que pede acao e o
 * unico que abre a lista.
 */
import type { NotaDaEquipe, FilaDeNotas } from "../../src/lib/dados/notas-fiscais";

export type { NotaDaEquipe, FilaDeNotas };

const BRUNO = { id: "a0000000-0000-0000-0000-000000000005", nome: "Bruno Lima", avatar_url: null };
const CARLA = { id: "a0000000-0000-0000-0000-000000000003", nome: "Carla Nunes", avatar_url: null };
const MARINA = { id: "a0000000-0000-0000-0000-000000000006", nome: "Marina Costa", avatar_url: null };

function nota(dados: Partial<NotaDaEquipe> & { id: string; competencia: string; valor: number }): NotaDaEquipe {
  return {
    user_id: BRUNO.id,
    numero: null,
    arquivo_url: "nf/exemplo.pdf",
    observacoes: null,
    status: "enviada",
    motivo_recusa: null,
    decidido_por: null,
    decidido_em: null,
    pagamento: null,
    finance_entry_id: null,
    created_at: "2027-10-02T12:00:00.000Z",
    updated_at: "2027-10-02T12:00:00.000Z",
    pessoa: BRUNO,
    arquivoAssinado: "/exemplos/arte-1.svg",
    ...dados,
  } as NotaDaEquipe;
}

export async function minhasNotas(): Promise<NotaDaEquipe[]> {
  return [
    nota({
      id: "nf-out",
      competencia: "2027-10-01",
      valor: 4400,
      status: "recusada",
      motivo_recusa: "O CNPJ está o da empresa antiga.",
      numero: "000141",
    }),
    nota({ id: "nf-set", competencia: "2027-09-01", valor: 4250, status: "aprovada", numero: "000123" }),
    nota({
      id: "nf-ago",
      competencia: "2027-08-01",
      valor: 4250,
      status: "paga",
      pagamento: "2027-09-05",
      numero: "000108",
    }),
  ];
}

export async function mesesJaEnviados(): Promise<string[]> {
  return ["2027-09", "2027-08"];
}

export async function filaDeNotas(): Promise<FilaDeNotas> {
  return {
    aConferir: [
      nota({ id: "f1", competencia: "2027-10-01", valor: 5300, pessoa: CARLA, user_id: CARLA.id, numero: "000412" }),
      nota({
        id: "f2",
        competencia: "2027-10-01",
        valor: 3900,
        pessoa: MARINA,
        user_id: MARINA.id,
        observacoes: "Inclui as duas diárias do evento de sábado.",
      }),
    ],
    aPagar: [
      nota({ id: "f3", competencia: "2027-09-01", valor: 4250, status: "aprovada", numero: "000123" }),
      nota({ id: "f4", competencia: "2027-09-01", valor: 5300, status: "aprovada", pessoa: CARLA, user_id: CARLA.id }),
    ],
    encerradas: [
      nota({ id: "f5", competencia: "2027-08-01", valor: 4250, status: "paga", pagamento: "2027-09-05" }),
      nota({
        id: "f6",
        competencia: "2027-08-01",
        valor: 9999,
        status: "recusada",
        motivo_recusa: "Valor divergente do combinado para agosto.",
        pessoa: MARINA,
        user_id: MARINA.id,
      }),
    ],
  };
}

export async function notasEsperandoOSocio(): Promise<number> {
  return 4;
}

export async function minhasNotasRecusadas(): Promise<NotaDaEquipe[]> {
  return [
    nota({
      id: "nf-out",
      competencia: "2027-10-01",
      valor: 4400,
      status: "recusada",
      motivo_recusa: "O CNPJ está o da empresa antiga.",
    }),
  ];
}
