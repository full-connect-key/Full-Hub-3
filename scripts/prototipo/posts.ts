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
    plataforma: "instagram",
    formato: "carrossel",
    midia: "carrossel",
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 2,
    prazoAprovacao: dia(7),
    rodadaPendenteId: "r1",
    decididoPor: null,
    decididoEm: null,
  },
  {
    id: "p2",
    clienteId: VERDE,
    tema: "Post institucional do mês",
    legenda: "Quinze anos escolhendo fornecedor por fornecedor.",
    dataPublicacao: dia(12),
    horario: "18:30",
    plataforma: "linkedin",
    formato: "feed",
    midia: "imagem",
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r2",
    decididoPor: null,
    decididoEm: null,
  },
  {
    id: "p3",
    clienteId: VERDE,
    tema: "Enquete de sabores",
    legenda: "Qual entra na linha do ano que vem?",
    dataPublicacao: dia(12),
    horario: "09:00",
    plataforma: "twitter",
    formato: "story",
    midia: "video",
    status: "em_aprovacao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: "r3",
    decididoPor: null,
    decididoEm: null,
  },
  {
    id: "p4",
    clienteId: VERDE,
    tema: "Receita da semana",
    legenda: "Panqueca de banana com granola. Cinco minutos.",
    dataPublicacao: dia(16),
    horario: "08:00",
    plataforma: "instagram",
    formato: "feed",
    midia: "imagem",
    status: "ajustes",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 2,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    decididoEm: new Date(HOJE.getTime() - 4 * 864e5).toISOString(),
  },
  {
    id: "p5",
    clienteId: VERDE,
    tema: "Lançamento da granola de cacau",
    legenda: "Chegou. E sim, tem pedaço de cacau de verdade.",
    dataPublicacao: dia(20),
    horario: "19:00",
    plataforma: "instagram",
    formato: "carrossel",
    midia: "carrossel",
    status: "aprovado",
    arteUrl: "/exemplos/arte-2.svg",
    thumbnailUrl: "/exemplos/arte-2.svg",
    versaoAtual: 3,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    decididoEm: new Date(HOJE.getTime() - 6 * 864e5).toISOString(),
  },
  {
    id: "p6",
    clienteId: VERDE,
    tema: "Guia de receitas no Pinterest",
    legenda: "Salvou, fez. É simples assim.",
    dataPublicacao: dia(22),
    horario: "15:00",
    plataforma: "pinterest",
    formato: "feed",
    midia: "imagem",
    status: "aprovado",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    decididoEm: new Date(HOJE.getTime() - 10 * 864e5).toISOString(),
  },
  {
    id: "p7",
    clienteId: VERDE,
    tema: "Comparativo com concorrente",
    legenda: "A gente sabe quem faz melhor.",
    dataPublicacao: dia(24),
    horario: null,
    plataforma: "instagram",
    formato: "feed",
    midia: "imagem",
    status: "rejeitado",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    decididoEm: new Date(HOJE.getTime() - 12 * 864e5).toISOString(),
  },
  {
    id: "p8",
    clienteId: VERDE,
    tema: "Card de horário de feriado",
    legenda: null,
    dataPublicacao: dia(18),
    horario: null,
    plataforma: "facebook",
    formato: "feed",
    midia: "imagem",
    status: "ajustes",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: "Joana Prado",
    decididoEm: new Date(HOJE.getTime() - 2 * 864e5).toISOString(),
  },
  {
    id: "p9",
    clienteId: VERDE,
    tema: "Ação de fim de ano",
    legenda: "Esperando o calendário comercial fechar.",
    dataPublicacao: dia(27),
    horario: null,
    plataforma: "facebook",
    formato: "feed",
    midia: "imagem",
    status: "stand_by",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    prazoAprovacao: null,
    rodadaPendenteId: null,
    decididoPor: null,
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
