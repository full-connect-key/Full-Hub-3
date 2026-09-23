/**
 * Versao de prototipo de src/lib/dados/recomendacoes.ts.
 *
 * Quatro posts, escolhidos para o feed mostrar o que ele faz:
 *
 *   - um com curtidas E thread de dois niveis (comentario + resposta), que e o
 *     unico estado em que a indentacao da resposta significa alguma coisa;
 *   - um curtido por quem esta olhando, para o coracao aparecer preenchido;
 *   - um sem link e sem curtida, porque o cartao precisa funcionar vazio;
 *   - um de vinte dias atras, que e onde `tempoRelativo` devolve null e a tela
 *     cai para a data seca. Um feed todo de "ha 2 horas" esconderia isso.
 */
import type { EmAlta, FiltrosDoFeed, PostDoFeed } from "../../src/lib/dados/recomendacoes";

export type { EmAlta, FiltrosDoFeed, PostDoFeed };

const CARLA = {
  id: "a0000000-0000-0000-0000-000000000003",
  nome: "Carla Reis",
  avatar_url: null,
};
const BRUNO = {
  id: "a0000000-0000-0000-0000-000000000004",
  nome: "Bruno Alves",
  avatar_url: null,
};
const MARINA = {
  id: "a0000000-0000-0000-0000-000000000005",
  nome: "Marina Costa",
  avatar_url: null,
};
const ANA = {
  id: "a0000000-0000-0000-0000-000000000001",
  nome: "Ana Souza",
  avatar_url: null,
};

/**
 * As datas sao contadas do RELOGIO, nao de um instante fixo.
 *
 * A primeira versao fixava o "agora" em 2026-09-20 para a imagem nao mudar a
 * cada rodada. So que a tela recebe o agora de verdade: com o tempo, o post
 * de "ha 2 horas" virou "ha 2 dias" na captura, e os caminhos curtos de
 * `tempoRelativo` -- "agora", "ha X min", "ha X horas" -- deixaram de
 * aparecer em imagem nenhuma. Contando de agora, cada post cai sempre na
 * mesma faixa e os quatro caminhos aparecem.
 *
 * O preco e o ultimo cartao, que cai na data seca (acima de uma semana
 * `tempoRelativo` devolve null): so ele muda de uma rodada para outra.
 */
const AGORA = Date.now();
const atras = (minutos: number) => new Date(AGORA - minutos * 60000).toISOString();

const POSTS: PostDoFeed[] = [
  {
    id: "r1",
    autor_id: CARLA.id,
    categoria: "ferramenta",
    titulo: "Figma Slides",
    descricao: "Dá para montar apresentação de campanha sem sair do arquivo do KV.",
    url: "https://www.figma.com/slides/",
    imagem_url: null,
    tags: ["design", "apresentacao"],
    created_at: atras(3 * 60),
    autor: CARLA,
    quantasCurtidas: 2,
    euCurti: false,
    comentarios: [
      {
        id: "c1",
        texto: "Uso desde a semana passada, economizou meu domingo.",
        created_at: atras(90),
        autor: MARINA,
        respostaA: null,
      },
      {
        id: "c2",
        texto: "Boa, vou testar no próximo job.",
        created_at: atras(60),
        autor: BRUNO,
        respostaA: "c1",
      },
    ],
  },
  {
    id: "r2",
    autor_id: BRUNO.id,
    categoria: "filme",
    titulo: "Abstract: The Art of Design",
    descricao: "A temporada sobre design gráfico vale por três cursos.",
    url: "https://www.netflix.com/title/80057883",
    imagem_url: null,
    tags: ["design", "inspiracao"],
    created_at: atras(60 * 24 * 2),
    autor: BRUNO,
    quantasCurtidas: 1,
    // Curtido por quem esta olhando: e o unico jeito de a imagem mostrar o
    // coracao preenchido.
    euCurti: true,
    comentarios: [],
  },
  {
    id: "r3",
    autor_id: MARINA.id,
    categoria: "podcast",
    titulo: "Braincast — episódio sobre marcas",
    descricao: "Serve para a conversa de posicionamento com cliente novo.",
    url: null,
    imagem_url: null,
    tags: ["estrategia"],
    created_at: atras(60 * 24 * 6),
    autor: MARINA,
    quantasCurtidas: 0,
    euCurti: false,
    comentarios: [],
  },
  {
    id: "r4",
    autor_id: ANA.id,
    categoria: "livro",
    titulo: "Obviously Awesome",
    descricao: "Posicionamento explicado sem jargão. Curto.",
    url: "https://www.aprildunford.com/obviously-awesome",
    imagem_url: null,
    tags: ["estrategia", "posicionamento"],
    // Vinte dias: acima de uma semana `tempoRelativo` devolve null e a tela
    // mostra a data. Sem um post antigo, esse caminho nunca apareceria numa
    // imagem.
    created_at: atras(60 * 24 * 20),
    autor: ANA,
    quantasCurtidas: 0,
    euCurti: false,
    comentarios: [],
  },
];

export async function listarFeed(
  _usuarioId: string,
  filtros: FiltrosDoFeed,
): Promise<PostDoFeed[]> {
  let visiveis = POSTS;

  if (filtros.categoria) visiveis = visiveis.filter((p) => p.categoria === filtros.categoria);
  if (filtros.tag) visiveis = visiveis.filter((p) => (p.tags ?? []).includes(filtros.tag!));
  if (filtros.busca) {
    const termo = filtros.busca.toLowerCase();
    visiveis = visiveis.filter(
      (p) =>
        p.titulo.toLowerCase().includes(termo) ||
        (p.descricao ?? "").toLowerCase().includes(termo),
    );
  }

  if (filtros.ordem === "curtidas") {
    return [...visiveis].sort((a, b) => b.quantasCurtidas - a.quantasCurtidas);
  }
  return visiveis;
}

export async function emAltaNoMes(_hojeISO: string, _limite = 5): Promise<EmAlta[]> {
  return POSTS.filter((p) => p.quantasCurtidas > 0)
    .map((p) => ({
      id: p.id,
      titulo: p.titulo,
      categoria: p.categoria,
      quantas: p.quantasCurtidas,
    }))
    .sort((a, b) => b.quantas - a.quantas);
}

export async function tagsDoFeed() {
  return POSTS.map((p) => ({ tags: p.tags }));
}
