/**
 * Versao de prototipo de src/lib/dados/notas-fiscais.ts (0065).
 *
 * OS QUATRO ESTADOS APARECEM, e e o criterio: uma tela que so mostra o caso
 * feliz nao conferiu o bloco da recusada -- que e o unico que pede acao e o
 * unico que abre a lista.
 *
 * ---------------------------------------------------------------------------
 * OS MESES SAO RELATIVOS A HOJE, e isso passou a ser obrigatorio.
 *
 * Eles eram literais de 2027, com a razao escrita aqui: "sao etiquetas de mes,
 * e uma data fixa serve". Deixou de ser verdade no dia em que a linha recusada
 * ganhou o botao "Enviar outra" -- ele so aparece quando o mes da nota esta
 * entre os doze que `mesesParaEmitir(hoje)` oferece, e `hoje` no prototipo e o
 * dia de verdade. Com 2027 fixo, nenhuma nota caia na janela e o botao nao
 * saia em imagem nenhuma: a tela conferida seria a que nao tem a peca nova.
 *
 * E a comparacao nao e so a do botao -- `mesesVivos` decide o que o seletor
 * oferece, e `recusadasPendentes` decide o bloco vermelho. Tres perguntas sobre
 * o mesmo mes.
 * ---------------------------------------------------------------------------
 */
import type { NotaDaEquipe } from "../../src/lib/dados/notas-fiscais";
import type { PedidoDeNota } from "../../src/lib/dominio/notas-fiscais";

export type { NotaDaEquipe };

/** "n meses atras", no primeiro dia -- como a competencia e gravada. */
function competenciaRelativa(mesesAtras: number): string {
  const hoje = new Date();
  const total = hoje.getFullYear() * 12 + hoje.getMonth() - mesesAtras;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

const ESTE_MES = competenciaRelativa(0);
const MES_PASSADO = competenciaRelativa(1);
const DOIS_MESES = competenciaRelativa(2);

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

/**
 * O historico de quem envia, com DOIS tipos de recusada.
 *
 * A do mes corrente esta em aberto: ela abre o bloco vermelho e carrega o
 * botao "Enviar outra". A do mes passado JA FOI REENVIADA -- o mes tem uma
 * aprovada ao lado --, e por isso ela NAO entra no bloco e NAO ganha botao:
 * fica no historico, com o motivo, que e o que o produto promete.
 *
 * E ela e o cenario virado do avesso do bug que o usuario relatou: devolvendo
 * `notas.filter((n) => n.status === "recusada")` a tela, o bloco passa a dizer
 * "2 notas precisam ser reenviadas" e a imagem mostra o mes resolvido cobrando
 * de novo.
 */
export async function minhasNotas(): Promise<NotaDaEquipe[]> {
  return [
    nota({
      id: "nf-corrente",
      competencia: ESTE_MES,
      valor: 4400,
      status: "recusada",
      motivo_recusa: "O CNPJ está o da empresa antiga.",
      numero: "000141",
    }),
    nota({ id: "nf-anterior", competencia: MES_PASSADO, valor: 4250, status: "aprovada", numero: "000123" }),
    nota({
      id: "nf-anterior-recusada",
      competencia: MES_PASSADO,
      valor: 4250,
      status: "recusada",
      motivo_recusa: "Faltou o número da nota.",
    }),
    nota({
      id: "nf-dois-meses",
      competencia: DOIS_MESES,
      valor: 4250,
      status: "paga",
      pagamento: competenciaRelativa(1).slice(0, 8) + "05",
      numero: "000108",
    }),
  ];
}

export async function mesesJaEnviados(): Promise<string[]> {
  return [MES_PASSADO.slice(0, 7), DOIS_MESES.slice(0, 7)];
}

/**
 * A fila do socio, numa LISTA SO -- o corte em quatro colunas e da tela.
 *
 * TRES PESSOAS E TRES MESES, e e o criterio: com uma pessoa e um mes os dois
 * seletores de filtro nascem com uma opcao cada, e uma imagem assim nao prova
 * que eles filtram -- prova so que eles existem. E as quatro colunas tem peca,
 * porque uma coluna vazia e justamente o estado que a divisao nova existe para
 * deixar de esconder: a recusada ficava dentro de "Encerradas".
 */
export async function filaDeNotas(): Promise<NotaDaEquipe[]> {
  return [
    nota({ id: "f1", competencia: ESTE_MES, valor: 5300, pessoa: CARLA, user_id: CARLA.id, numero: "000412" }),
    nota({
      id: "f2",
      competencia: ESTE_MES,
      valor: 3900,
      pessoa: MARINA,
      user_id: MARINA.id,
      observacoes: "Inclui as duas diárias do evento de sábado.",
    }),
    nota({ id: "f3", competencia: MES_PASSADO, valor: 4250, status: "aprovada", numero: "000123" }),
    nota({ id: "f4", competencia: MES_PASSADO, valor: 5300, status: "aprovada", pessoa: CARLA, user_id: CARLA.id }),
    nota({
      id: "f6",
      competencia: MES_PASSADO,
      valor: 9999,
      status: "recusada",
      motivo_recusa: "Valor divergente do combinado para o mês.",
      pessoa: MARINA,
      user_id: MARINA.id,
    }),
    nota({
      id: "f5",
      competencia: DOIS_MESES,
      valor: 4250,
      status: "paga",
      pagamento: competenciaRelativa(1).slice(0, 8) + "05",
    }),
  ];
}

export async function notasEsperandoOSocio(): Promise<number> {
  return 4;
}

/** So a do mes corrente: a do mes passado ja foi reenviada. */
export async function minhasNotasRecusadas(): Promise<NotaDaEquipe[]> {
  return [
    nota({
      id: "nf-corrente",
      competencia: ESTE_MES,
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
