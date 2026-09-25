/**
 * Versao de prototipo de src/lib/dados/social-media.ts.
 *
 * Os tres estados da corrente aparecem de proposito -- briefing sem dono, em
 * producao e com o cliente --, porque a lista agrupa por QUEM ESTA SEGURANDO e
 * uma imagem com um grupo so nao prova que os tres cabem.
 *
 * E o carrossel tem cinco slides: a faixa em 375px e o que primeiro estoura a
 * largura, e ela so aparece com mais de um.
 */
import type {
  PostDaAgencia as PostReal,
  VersaoDoPost as VersaoReal,
} from "../../src/lib/dados/social-media";

export type PostDaAgencia = PostReal;
export type VersaoDoPost = VersaoReal;

const VERDE = "c0000000-0000-0000-0000-00000000000a";
const PRODUTOR = "a0000000-0000-0000-0000-000000000005";  // o colaborador do prototipo
const OUTRO = "a0000000-0000-0000-0000-000000000006";


function dia(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const POSTS: PostDaAgencia[] = [
  {
    id: "p1", clienteId: VERDE, cliente: "Mundo Verde",
    tema: "Carrossel de dicas",
    legenda: "Cinco dicas para manter a horta viva no calor. Arrasta pro lado 👉\n\n#MundoVerde",
    dataPublicacao: dia(17), horario: "12:00", plataforma: "instagram",
    formato: "Carrossel", midia: "carrossel", videoUrl: null, status: "em_producao",
    arteUrl: "/exemplos/arte-1.svg", thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 2, enviadoEm: null, responsavelId: PRODUTOR, responsavel: "Marina Costa",
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: false, esperandoCliente: false,
  },
  {
    id: "p2", clienteId: VERDE, cliente: "Mundo Verde", tema: "Antes e depois",
    legenda: "O canteiro em março e o canteiro hoje.",
    dataPublicacao: dia(7), horario: "09:00", plataforma: "instagram",
    formato: "Feed", midia: "imagem", videoUrl: null, status: "em_producao",
    arteUrl: "/exemplos/arte-2.svg", thumbnailUrl: "/exemplos/arte-2.svg",
    versaoAtual: 1, enviadoEm: null, responsavelId: PRODUTOR, responsavel: "Marina Costa",
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: false, esperandoCliente: false,
  },
  {
    id: "p3", clienteId: VERDE, cliente: "Mundo Verde", tema: "Reels da receita",
    legenda: "A receita da nutricionista em 30 segundos.",
    dataPublicacao: dia(20), horario: "18:00", plataforma: "instagram",
    formato: "Reels", midia: "video",
    videoUrl: "https://drive.google.com/file/d/exemplo/view", status: "em_producao",
    arteUrl: null, thumbnailUrl: null, versaoAtual: 1, enviadoEm: null,
    responsavelId: OUTRO, responsavel: "Bruno Lima",
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: true, esperandoCliente: false,
  },
  {
    id: "p4", clienteId: VERDE, cliente: "Mundo Verde", tema: "Fim de mês",
    legenda: null, dataPublicacao: dia(26), horario: null, plataforma: "instagram",
    formato: "Feed", midia: "imagem", videoUrl: null, status: "em_producao",
    arteUrl: null, thumbnailUrl: null, versaoAtual: 1, enviadoEm: null,
    responsavelId: null, responsavel: null,
    criadoPor: "a2", criadorNome: "Diego Alves", avalInterno: false, esperandoCliente: false,
  },
  {
    id: "p5", clienteId: VERDE, cliente: "Mundo Verde", tema: "Depoimento de cliente",
    legenda: null, dataPublicacao: dia(19), horario: null, plataforma: "instagram",
    formato: "Stories", midia: "imagem", videoUrl: null, status: "aguardando_informacoes",
    arteUrl: null, thumbnailUrl: null, versaoAtual: 1, enviadoEm: null,
    responsavelId: null, responsavel: null,
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: false, esperandoCliente: false,
  },
  {
    id: "p6", clienteId: VERDE, cliente: "Mundo Verde", tema: "Promoção de outubro",
    legenda: "Corre que acaba! Toda a linha com 20% até domingo.",
    dataPublicacao: dia(11), horario: "12:00", plataforma: "instagram",
    formato: "Feed", midia: "imagem", videoUrl: null, status: "em_aprovacao",
    arteUrl: "/exemplos/arte-3.svg", thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 2, enviadoEm: dia(3), responsavelId: OUTRO, responsavel: "Bruno Lima",
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: true, esperandoCliente: true,
  },
  {
    id: "p7", clienteId: VERDE, cliente: "Mundo Verde", tema: "Bastidores",
    legenda: "Quem planta o que chega na sua casa.",
    dataPublicacao: dia(2), horario: "09:00", plataforma: "instagram",
    formato: "Reels", midia: "video",
    videoUrl: "https://youtu.be/exemplo", status: "aprovado",
    arteUrl: null, thumbnailUrl: null, versaoAtual: 1, enviadoEm: dia(-4),
    responsavelId: OUTRO, responsavel: "Bruno Lima",
    criadoPor: "a1", criadorNome: "Ana Souza", avalInterno: true, esperandoCliente: false,
  },
];

const VERSOES: VersaoDoPost[] = [
  {
    id: "v2", numero: 2, legenda: "Cinco dicas para manter a horta viva no calor.",
    notas: "logo maior no último slide", autor: "Marina Costa",
    quando: new Date().toISOString(),
    arquivos: [1, 2, 3, 4, 5].map((n) => ({
      url: `/exemplos/arte-${(n % 3) + 1}.svg`,
      thumbnail_url: `/exemplos/arte-${(n % 3) + 1}.svg`,
      nome: `slide-${n}.png`,
      assinada: `/exemplos/arte-${(n % 3) + 1}.svg`,
    })),
    arteUrl: null, arteAssinada: null, videoUrl: null,
  },
  {
    id: "v1", numero: 1, legenda: "Dicas para a horta", notas: null,
    autor: "Marina Costa", quando: new Date(Date.now() - 3 * 864e5).toISOString(),
    arquivos: [], arteUrl: "/exemplos/arte-1.svg",
    arteAssinada: "/exemplos/arte-1.svg", videoUrl: null,
  },
];

export async function postsDoMesDaAgencia(
  _mes?: string,
  _filtros?: unknown,
): Promise<PostDaAgencia[]> {
  return POSTS;
}
export async function filaDaAgencia(_filtros?: unknown): Promise<PostDaAgencia[]> {
  return POSTS;
}
export async function obterPostDaAgencia(id: string) {
  const post = POSTS.find((p) => p.id === id) ?? POSTS[0];
  return { post, versoes: post.midia === "carrossel" ? VERSOES : VERSOES.slice(1) };
}
