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

const POSTS: PostDoPortal[] = [
  {
    id: "p1",
    clienteId: VERDE,
    tema: "Promoção de outubro",
    legenda:
      "Corre que acaba! Toda a linha de granolas com 20% até domingo. Aproveite para experimentar os sabores novos — tem castanha, tem cacau, e tem aquele de coco que sai voando toda semana.",
    dataPublicacao: dia(9),
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
];

export async function postsDoMes(
  mes: string,
  _clienteId?: string,
): Promise<PostDoPortal[]> {
  return POSTS.filter((p) => p.dataPublicacao.startsWith(mes));
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
