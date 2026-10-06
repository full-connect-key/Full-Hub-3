/**
 * Versao de prototipo de src/lib/dados/posts.ts.
 *
 * Um mes com os sete status representados, duas versoes num deles e uma
 * conversa curta. A arte sai de /exemplos/, que sao arquivos do proprio site:
 * `urlsDasArtes` nao assina caminho que comeca com "/", entao eles chegam a
 * tela iguais aqui e no app de verdade.
 */
import type { VersaoDoConteudo } from "../../src/lib/dados/conteudo";
import type { PostDoPortal } from "../../src/lib/dominio/posts";

export type { VersaoDoConteudo };

const HOJE = new Date();
const MES = `${HOJE.getFullYear()}-${String(HOJE.getMonth() + 1).padStart(2, "0")}`;
const dia = (n: number) => `${MES}-${String(n).padStart(2, "0")}`;

const VERDE = "c0000000-0000-0000-0000-00000000000a";

// A DEMANDA DO MES. Todo post deste exemplo e do mesmo mes de social, que e o
// que faz o recorte do Sprint 3K funcionar no prototipo: desde ele a lista do
// portal e recortada pela DEMANDA e nao pela data, e um stub sem `mesId`
// deixaria as pecas sem data fora da tela -- exatamente o bug que o sprint
// conserta, reproduzido no protipo.
const MES_ID = "t0000000-0000-0000-0000-0000000000a1";

const POSTS: PostDoPortal[] = [
  {
    id: "p1",
    clienteId: VERDE,
    tema: "Promoção de outubro",
    legenda:
      "Corre que acaba! Toda a linha de granolas com 20% até domingo. Aproveite para experimentar os sabores novos — tem castanha, tem cacau, e tem aquele de coco que sai voando toda semana.",
    dataPublicacao: dia(9),
    mesId: MES_ID,
    horario: "12:00",
    // AS DUAS REDES (0082): é o caso que o usuário descreveu, e sem um exemplo
    // dele nenhuma imagem do protótipo mostra o selo duplo.
    plataformas: ["instagram", "facebook"],
    formato: "carrossel",
    midia: "carrossel",
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 2,
    prazoAprovacao: dia(7),
    rodadaPendenteId: "r1",
    decididoPor: null,
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: null,
  },
  {
    id: "p2",
    clienteId: VERDE,
    tema: "Post institucional do mês",
    legenda: "Quinze anos escolhendo fornecedor por fornecedor.",
    dataPublicacao: dia(12),
    mesId: MES_ID,
    horario: "18:30",
    plataformas: ["linkedin"],
    formato: "feed",
    midia: "imagem",
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r2",
    decididoPor: null,
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: null,
  },
  {
    id: "p3",
    clienteId: VERDE,
    tema: "Enquete de sabores",
    legenda: "Qual entra na linha do ano que vem?",
    dataPublicacao: dia(12),
    mesId: MES_ID,
    horario: "09:00",
    plataformas: ["twitter"],
    formato: "story",
    midia: "video",
    status: "em_aprovacao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r3",
    decididoPor: null,
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: null,
  },
  {
    id: "p4",
    clienteId: VERDE,
    tema: "Receita da semana",
    legenda: "Panqueca de banana com granola. Cinco minutos.",
    dataPublicacao: dia(16),
    mesId: MES_ID,
    horario: "08:00",
    plataformas: ["instagram"],
    formato: "feed",
    midia: "imagem",
    status: "ajustes",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 2,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: new Date(HOJE.getTime() - 4 * 864e5).toISOString(),
  },
  {
    id: "p5",
    clienteId: VERDE,
    tema: "Lançamento da granola de cacau",
    legenda: "Chegou. E sim, tem pedaço de cacau de verdade.",
    dataPublicacao: dia(20),
    mesId: MES_ID,
    horario: "19:00",
    plataformas: ["instagram"],
    formato: "carrossel",
    midia: "carrossel",
    status: "aprovado",
    arteUrl: "/exemplos/arte-2.svg",
    thumbnailUrl: "/exemplos/arte-2.svg",
    versaoAtual: 3,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: new Date(HOJE.getTime() - 6 * 864e5).toISOString(),
  },
  {
    id: "p6",
    clienteId: VERDE,
    tema: "Guia de receitas no Pinterest",
    legenda: "Salvou, fez. É simples assim.",
    dataPublicacao: dia(22),
    mesId: MES_ID,
    horario: "15:00",
    plataformas: ["pinterest"],
    formato: "feed",
    midia: "imagem",
    status: "aprovado",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: new Date(HOJE.getTime() - 10 * 864e5).toISOString(),
  },
  {
    id: "p7",
    clienteId: VERDE,
    tema: "Comparativo com concorrente",
    legenda: "A gente sabe quem faz melhor.",
    dataPublicacao: dia(24),
    mesId: MES_ID,
    horario: null,
    plataformas: ["instagram"],
    formato: "feed",
    midia: "imagem",
    status: "rejeitado",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: new Date(HOJE.getTime() - 12 * 864e5).toISOString(),
  },
  {
    id: "p8",
    clienteId: VERDE,
    tema: "Card de horário de feriado",
    legenda: null,
    dataPublicacao: dia(18),
    mesId: MES_ID,
    horario: null,
    plataformas: ["facebook"],
    formato: "feed",
    midia: "imagem",
    status: "ajustes",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: new Date(HOJE.getTime() - 2 * 864e5).toISOString(),
  },
  {
    id: "p9",
    clienteId: VERDE,
    tema: "Ação de fim de ano",
    legenda: "Esperando o calendário comercial fechar.",
    dataPublicacao: dia(27),
    mesId: MES_ID,
    horario: null,
    plataformas: ["facebook"],
    formato: "feed",
    midia: "imagem",
    status: "stand_by",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: null,
    portaoDoCliente: null,
    textoDoPortao: null,
    decididoEm: null,
  },
  // O PORTAO DO MEIO DA CORRENTE (0076), e ele existe aqui pela razao pela qual
  // o seed tem uma pessoa desligada: sem um post neste estado, a imagem do
  // portal sai no unico arranjo em que a novidade nao aparece. Ele nao tem arte
  // -- e nao e falta: a Pauta e a PRIMEIRA etapa, e a arte nasce duas etapas
  // depois. E o que a tela mostra no lugar dela e o texto da pauta.
  {
    id: "p10",
    clienteId: VERDE,
    tema: "Dia do Cliente",
    legenda: null,
    dataPublicacao: dia(22),
    mesId: MES_ID,
    horario: null,
    plataformas: ["instagram"],
    formato: "feed",
    midia: "carrossel",
    status: "em_aprovacao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: dia(24),
    rodadaPendenteId: "r10",
    decididoPor: null,
    portaoDoCliente: "Pauta",
    textoDoPortao:
      "Carrossel de cinco telas contando a história de três clientes que compram na loja desde a inauguração. Tom de conversa, sem promoção nenhuma — a ideia é a data, não a venda. Fecha com um convite para marcar quem apresentou a marca à pessoa.",
    decididoEm: null,
  },

  // ----------------------------------------------------------------------
  // AS DUAS PECAS SEM DATA, e sao a razao de o stub existir no Sprint 3K.
  //
  // Elas sao o estado que o bug 1 escondia: a agencia enviou a PAUTA num
  // portao do meio (0076), o cliente precisa decidi-la, e o mes abre em
  // branco (0044) -- entao a peca nao tem data nenhuma. Sem elas aqui, a
  // bandeja "Sem data definida" nao aparece em imagem nenhuma do prototipo,
  // e e a licao da Optica Visao sem atendente (0062): o ambiente mostraria o
  // produto no unico estado em que a correcao nao faz diferenca.
  //
  // DUAS E NAO UMA, pela razao das etapas de exemplo da pilha de avatares:
  // com uma so, a bandeja pareceria um cartao solto e ninguem descobriria que
  // ela e uma lista.
  // ----------------------------------------------------------------------
  {
    id: "p11",
    clienteId: VERDE,
    tema: "Instagram 11 de 12 · pauta para aprovar",
    legenda: null,
    dataPublicacao: null,
    mesId: MES_ID,
    horario: null,
    plataformas: ["instagram"],
    formato: "feed",
    midia: "imagem",
    status: "em_aprovacao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r11",
    decididoPor: null,
    portaoDoCliente: "Pauta",
    textoDoPortao:
      "Receita da semana com a granola de cacau, em três passos, com a embalagem nova aparecendo no último.",
    decididoEm: null,
  },
  {
    id: "p12",
    clienteId: VERDE,
    tema: "Instagram 12 de 12 · pauta para aprovar",
    legenda: null,
    dataPublicacao: null,
    mesId: MES_ID,
    horario: null,
    plataformas: ["instagram", "facebook"],
    formato: "feed",
    midia: "imagem",
    status: "em_aprovacao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r12",
    decididoPor: null,
    portaoDoCliente: "Pauta",
    textoDoPortao:
      "Depoimento de quem trocou o café da manhã, em carrossel de dois slides.",
    decididoEm: null,
  },
];

/**
 * O RECORTE E O MES DA DEMANDA, e nao a data (Sprint 3K).
 *
 * `p.dataPublicacao.startsWith(mes)` era o stub reproduzindo o bug: as duas
 * pecas sem data ficariam de fora, e a imagem do prototipo mostraria a tela
 * como ela era antes da correcao.
 */
export async function postsDoMes(
  mes: string,
  _clienteId?: string,
): Promise<PostDoPortal[]> {
  return POSTS.filter(
    (p) => p.mesId === MES_ID || (p.dataPublicacao?.startsWith(mes) ?? false),
  );
}

/**
 * O LOTE ABERTO do mes de exemplo.
 *
 * Ele EXISTE no prototipo, e e deliberado: a faixa some quando o lote fechou,
 * entao um stub devolvendo nulo mostraria a tela no unico estado em que o
 * cabecalho nao aparece -- e o Sprint 3K inteiro e sobre essa faixa. E a licao
 * da Optica Visao sem atendente (0062).
 *
 * As duas pecas sem data sao as duas pendentes: doze decididas de catorze.
 */
export type LoteDoPortal = {
  portao: string;
  recado: string | null;
  pecas: number;
  decididas: number;
};

export async function loteAbertoDoMes(
  _mes: string,
  _clienteId?: string,
): Promise<LoteDoPortal | null> {
  return {
    portao: "Pauta",
    recado:
      "Mandei a pauta das duas últimas peças do mês. Nas outras, é só conferir a arte.",
    pecas: 14,
    decididas: 12,
  };
}

/** A vizinhanca do detalhe: tudo do mesmo mes de exemplo. */
export async function postsDoMesmoMes(
  _post: PostDoPortal,
  _clienteId?: string,
): Promise<PostDoPortal[]> {
  return POSTS;
}

export async function obterPost(
  id: string,
  _clienteId?: string,
): Promise<PostDoPortal | null> {
  return POSTS.find((p) => p.id === id) ?? POSTS[0] ?? null;
}

export async function versoesDoPost(
  postId: string,
): Promise<VersaoDoConteudo[]> {
  if (postId !== "p1" && postId !== "p5") return [];

  return [
    {
      id: "v2",
      numero: 2,
      arquivos: [
        "/exemplos/arte-1.svg",
        "/exemplos/arte-2.svg",
        "/exemplos/arte-3.svg",
      ],
      arteUrl: "/exemplos/arte-1.svg",
      texto: "Corre que acaba! Toda a linha de granolas com 20% até domingo.",
      notas: "Logo maior e tempo de preparo na legenda",
      quando: new Date(HOJE.getTime() - 2 * 864e5).toISOString(),
      quem: "Bruno Lima",
    },
    {
      id: "v1",
      numero: 1,
      arquivos: [],
      arteUrl: "/exemplos/arte-3.svg",
      texto: "Corre que acaba!",
      notas: "Primeira arte",
      quando: new Date(HOJE.getTime() - 5 * 864e5).toISOString(),
      quem: "Bruno Lima",
    },
  ];
}

export async function urlsDasArtes(
  _caminhos: (string | null)[],
): Promise<Record<string, string>> {
  return {};
}

export function enderecoDaArte(
  caminho: string | null,
  assinadas: Record<string, string>,
): string | null {
  if (!caminho) return null;
  return assinadas[caminho] ?? caminho;
}
