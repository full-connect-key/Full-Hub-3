/**
 * Versao de prototipo de src/lib/dados/notas-fiscais.ts (0065).
 *
 * OS QUATRO ESTADOS APARECEM, e e o criterio: uma tela que so mostra o caso
 * feliz nao conferiu o bloco da recusada -- que e o unico que pede acao e o
 * unico que abre a lista.
 */
import type { NotaDaEquipe, FilaDeNotas } from "../../src/lib/dados/notas-fiscais";
import type { PedidoDeNota } from "../../src/lib/dominio/notas-fiscais";

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

// ===========================================================================
// O PEDIDO DE NOTAS DO MÊS (0066)
//
// O protótipo mostra o estado que vale a pena conferir: alguém COBRADO e
// ATRASADO. O estado sem pedido nenhum é o que a faixa esconde, e uma tela sem
// faixa não prova que a faixa está certa — prova só que ela sabe sumir.
// ===========================================================================

/**
 * Cobrada, com o prazo JA VENCIDO: a faixa no tom de atencao.
 *
 * ESTE E O UNICO STUB DO ARQUIVO QUE CALCULA A DATA, e a excecao tem motivo: o
 * prazo e o unico dado deste modulo que a TELA compara com o relogio de hoje.
 * Os outros sao etiquetas de mes, e uma data fixa de 2027 serve. Aqui uma data
 * fixa mostraria o estado FACIL -- "o prazo e 03/12", no futuro -- e a imagem
 * nao conferiria nada: o estado que pede conferencia e o de quem passou do dia.
 */
export async function meusPedidosDeNota(): Promise<PedidoDeNota[]> {
  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const dia = tresDiasAtras.toISOString().slice(0, 10);
  return [{ competencia: `${dia.slice(0, 7)}-01`, pedidoEm: dia }];
}

export async function quemDeveNota(_competencia: string): Promise<{ id: string; nome: string }[]> {
  return [
    { id: MARINA.id, nome: MARINA.nome },
    { id: "p-rafael", nome: "Rafael Dias" },
    { id: "p-carla", nome: "Carla Nunes" },
  ];
}

/**
 * O pedido anterior ECOA a competencia que recebeu, em vez de devolver uma
 * fixa: o dialogo diz "voce ja pediu as notas DESTE mes", e um mes diferente
 * do que esta no seletor logo acima faz o revisor procurar um bug que nao
 * existe. Dado de exemplo tambem precisa ser coerente com a tela.
 */
export async function pedidosDeNota(
  competencia: string,
): Promise<{ id: string; competencia: string; quantasPessoas: number; criadoEm: string }[]> {
  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return [
    {
      id: "ped-1",
      competencia,
      quantasPessoas: 5,
      criadoEm: tresDiasAtras.toISOString(),
    },
  ];
}
