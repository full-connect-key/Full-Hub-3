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
  EtapaDeSocialMinha as EtapaMinhaReal,
  PostDaAgencia as PostReal,
  ReferenciaDoPost as ReferenciaReal,
  VersaoDoPost as VersaoReal,
} from "../../src/lib/dados/social-media";
import type { EtapaDoPost } from "../../src/lib/dominio/posts";

export type PostDaAgencia = PostReal;
export type VersaoDoPost = VersaoReal;
export type EtapaDeSocialMinha = EtapaMinhaReal;
export type ReferenciaDoPost = ReferenciaReal;

const VERDE = "c0000000-0000-0000-0000-00000000000a";
const PRODUTOR = "a0000000-0000-0000-0000-000000000005"; // o colaborador do prototipo
const OUTRO = "a0000000-0000-0000-0000-000000000006";

function dia(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const POSTS: PostDaAgencia[] = [
  {
    id: "p1",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Carrossel de dicas",
    pauta:
      "Tema: manter a horta viva no calor. Ângulo de quem mora em apartamento — " +
      "vaso, varanda, sol da tarde. Cinco dicas, uma por slide.",
    legenda:
      "Cinco dicas para manter a horta viva no calor. Arrasta pro lado 👉\n\n#MundoVerde",
    dataPublicacao: dia(17),
    horario: "12:00",
    plataforma: "instagram",
    formato: "Carrossel",
    midia: "carrossel",
    videoUrl: null,
    status: "em_producao",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    versaoAtual: 2,
    enviadoEm: null,
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: false,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p2",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Antes e depois",
    pauta: null,
    legenda: "O canteiro em março e o canteiro hoje.",
    dataPublicacao: dia(7),
    horario: "09:00",
    plataforma: "instagram",
    formato: "Feed",
    midia: "imagem",
    videoUrl: null,
    status: "em_producao",
    arteUrl: "/exemplos/arte-2.svg",
    thumbnailUrl: "/exemplos/arte-2.svg",
    versaoAtual: 1,
    enviadoEm: null,
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: false,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p3",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Reels da receita",
    pauta: null,
    legenda: "A receita da nutricionista em 30 segundos.",
    dataPublicacao: dia(20),
    horario: "18:00",
    plataforma: "instagram",
    formato: "Reels",
    midia: "video",
    videoUrl: "https://drive.google.com/file/d/exemplo/view",
    status: "em_producao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    enviadoEm: null,
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: true,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p4",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Fim de mês",
    pauta: null,
    legenda: null,
    dataPublicacao: dia(26),
    horario: null,
    plataforma: "instagram",
    formato: "Feed",
    midia: "imagem",
    videoUrl: null,
    status: "em_producao",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    enviadoEm: null,
    responsavelId: null,
    responsavel: null,
    criadoPor: "a2",
    criadorNome: "Diego Alves",
    avalInterno: false,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p5",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Depoimento de cliente",
    pauta: null,
    legenda: null,
    dataPublicacao: dia(19),
    horario: null,
    plataforma: "instagram",
    formato: "Stories",
    midia: "imagem",
    videoUrl: null,
    status: "aguardando_informacoes",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    enviadoEm: null,
    responsavelId: null,
    responsavel: null,
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: false,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p6",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Promoção de outubro",
    pauta: null,
    legenda: "Corre que acaba! Toda a linha com 20% até domingo.",
    dataPublicacao: dia(11),
    horario: "12:00",
    plataforma: "instagram",
    formato: "Feed",
    midia: "imagem",
    videoUrl: null,
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 2,
    enviadoEm: dia(3),
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: true,
    esperandoCliente: true,
    programado: false,
  },
  {
    id: "p7",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    tema: "Bastidores",
    pauta: null,
    legenda: "Quem planta o que chega na sua casa.",
    dataPublicacao: dia(2),
    horario: "09:00",
    plataforma: "instagram",
    formato: "Reels",
    midia: "video",
    videoUrl: "https://youtu.be/exemplo",
    status: "aprovado",
    arteUrl: null,
    thumbnailUrl: null,
    versaoAtual: 1,
    enviadoEm: dia(-4),
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    avalInterno: true,
    esperandoCliente: false,
    programado: true,
  },
];

const VERSOES: VersaoDoPost[] = [
  {
    id: "v2",
    numero: 2,
    legenda: "Cinco dicas para manter a horta viva no calor.",
    notas: "logo maior no último slide",
    autor: "Marina Costa",
    quando: new Date().toISOString(),
    arquivos: [1, 2, 3, 4, 5].map((n) => ({
      url: `/exemplos/arte-${(n % 3) + 1}.svg`,
      thumbnail_url: `/exemplos/arte-${(n % 3) + 1}.svg`,
      nome: `slide-${n}.png`,
      assinada: `/exemplos/arte-${(n % 3) + 1}.svg`,
    })),
    arteUrl: null,
    arteAssinada: null,
    videoUrl: null,
  },
  {
    id: "v1",
    numero: 1,
    legenda: "Dicas para a horta",
    notas: null,
    autor: "Marina Costa",
    quando: new Date(Date.now() - 3 * 864e5).toISOString(),
    arquivos: [],
    arteUrl: "/exemplos/arte-1.svg",
    arteAssinada: "/exemplos/arte-1.svg",
    videoUrl: null,
  },
];

export async function postsDoMesDaAgencia(
  _mes?: string,
  _filtros?: unknown,
): Promise<PostDaAgencia[]> {
  return POSTS;
}
export async function filaDaAgencia(
  _filtros?: unknown,
): Promise<PostDaAgencia[]> {
  return POSTS;
}
export async function obterPostDaAgencia(id: string) {
  const post = POSTS.find((p) => p.id === id) ?? POSTS[0];
  return {
    post,
    versoes: post.midia === "carrossel" ? VERSOES : VERSOES.slice(1),
    etapas: CORRENTE,
    referencias: REFERENCIAS,
  };
}

/**
 * DUAS REFERENCIAS DE DUAS PESSOAS, e uma so com endereco: a imagem precisa
 * mostrar o caso em que o titulo falta (a linha cai para a URL truncada) e o
 * caso em que quem pos nao e quem esta olhando -- que e quando a lixeira
 * some.
 */
const REFERENCIAS: ReferenciaDoPost[] = [
  {
    id: "r1",
    url: "https://drive.google.com/drive/folders/moodboard-verao",
    titulo: "Moodboard do cliente",
    quem: "Marina Costa",
    quando: dia(9),
    minha: true,
  },
  {
    id: "r2",
    url: "https://www.instagram.com/p/exemplo-que-foi-bem-em-julho/",
    titulo: null,
    quem: "Carla Dias",
    quando: dia(11),
    minha: false,
  },
];

export async function referenciasDoPost(
  _postId: string,
  _usuarioId?: string,
): Promise<ReferenciaDoPost[]> {
  return REFERENCIAS;
}

/**
 * A CORRENTE COM SEIS ETAPAS, e nao com as cinco do padrao: a sexta e a de
 * Ajustes, que so nasce quando o cliente pede -- e e justamente ela que a
 * imagem precisa mostrar, porque e o unico elo que nao esta em nenhuma tela de
 * configuracao. Com cinco, a imagem provaria o caso fácil.
 *
 * E o Envio entra EM CURSO, nao em branco: e o estado em que o selo troca o
 * seletor e a razao aparece escrita embaixo. Uma corrente toda "nao iniciada"
 * nao desenha nada disso.
 */
const CORRENTE: EtapaDoPost[] = [
  {
    id: "e1",
    ordem: 10,
    nome: "Pauta",
    funcao: "Social Media",
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    status: "concluida",
    prazo: dia(10),
    concluidaEm: dia(10),
  },
  {
    id: "e2",
    ordem: 20,
    nome: "Conteúdo",
    funcao: "Redator",
    responsavelId: "a0000000-0000-0000-0000-000000000003",
    responsavel: "Carla Dias",
    status: "concluida",
    prazo: dia(12),
    concluidaEm: dia(12),
  },
  {
    id: "e3",
    ordem: 30,
    nome: "Layout",
    funcao: "Design",
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    status: "concluida",
    prazo: dia(14),
    concluidaEm: dia(14),
  },
  // `em_ajustes` E NAO `enviada_aprovacao`, e a diferenca nao e detalhe: a
  // etapa de Ajustes so existe porque o cliente pediu, e nesse instante o
  // Envio volta para "em ajustes". Um stub com o Envio em aprovacao E UMA
  // ETAPA DE AJUSTES ao lado desenha um estado que o produto nao alcanca.
  {
    id: "e4",
    ordem: 40,
    nome: "Envio",
    funcao: "Gestao",
    responsavelId: null,
    responsavel: null,
    status: "em_ajustes",
    prazo: null,
    concluidaEm: null,
  },
  {
    id: "e5",
    ordem: 41,
    nome: "Ajustes",
    funcao: "Design",
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    status: "em_andamento",
    prazo: dia(16),
    concluidaEm: null,
  },
  {
    id: "e6",
    ordem: 50,
    nome: "Programar",
    funcao: "Social Media",
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    status: "nao_iniciada",
    prazo: dia(17),
    concluidaEm: null,
  },
];

export async function corrente(_postId: string): Promise<EtapaDoPost[]> {
  return CORRENTE;
}

/**
 * AS ETAPAS DE SOCIAL EM "MINHAS TASKS", e sao TRES de posts DIFERENTES: o que
 * a imagem precisa provar e que o bloco e uma lista de trabalhos e nao o
 * recorte de um post so. Uma delas sem data, que e o estado que a 0044 criou.
 */
const MINHAS: EtapaDeSocialMinha[] = [
  {
    ...CORRENTE[4],
    id: "m1",
    postId: "p1",
    tema: "Carrossel de dicas",
    cliente: "Mundo Verde",
    dataPublicacao: dia(17),
  },
  {
    ...CORRENTE[2],
    id: "m2",
    postId: "p2",
    nome: "Layout",
    status: "em_andamento",
    concluidaEm: null,
    tema: "Antes e depois",
    cliente: "Mundo Verde",
    dataPublicacao: dia(7),
  },
  {
    ...CORRENTE[0],
    id: "m3",
    postId: "p9",
    nome: "Pauta",
    status: "nao_iniciada",
    concluidaEm: null,
    prazo: null,
    tema: "Instagram 3 de 6 · mês que vem",
    cliente: "Óptica Visão",
    dataPublicacao: null,
  },
];

export async function minhasEtapasDeSocial(
  _usuarioId: string,
): Promise<EtapaDeSocialMinha[]> {
  return MINHAS;
}

/** A faixa "sem data ainda" do calendario: quatro, para ela provar o lote. */
export async function postsSemData(
  _clienteId?: string,
): Promise<PostDaAgencia[]> {
  return [1, 2, 3, 4].map((n) => ({
    ...POSTS[1],
    id: `sd${n}`,
    tema: `Instagram ${n} de 6 · mês que vem`,
    dataPublicacao: null,
    horario: null,
    arteUrl: null,
    thumbnailUrl: null,
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    status: "em_producao" as const,
  }));
}
