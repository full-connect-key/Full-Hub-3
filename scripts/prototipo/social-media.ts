/**
 * Versao de prototipo de src/lib/dados/social-media.ts.
 *
 * Os tres estados da corrente aparecem de proposito -- briefing sem dono, em
 * producao e com o cliente --, porque cada linha diz a mao e uma imagem com um
 * estado so nao prova que os tres cabem.
 *
 * E SAO DUAS CONTAS, desde que a lista passou a agrupar por conta: com uma so,
 * a imagem mostra um cabecalho e nao prova que elas se separam -- a licao da
 * pilha de avatares, que sem mais ninguem na demanda provava apenas que ela
 * sabe sumir. Um dos posts e do SOCIO, que e quem o prototipo fotografa, para
 * o "N suas" do cabecalho aparecer em alguma imagem.
 *
 * E o carrossel tem cinco slides: a faixa em 375px e o que primeiro estoura a
 * largura, e ela so aparece com mais de um.
 */
import type {
  DemandaDoMes as DemandaReal,
  MesDeSocial as MesReal,
  PostDaAgencia as PostReal,
  ReferenciaDoPost as ReferenciaReal,
  SituacaoDoMes as SituacaoReal,
  VersaoDoPost as VersaoReal,
} from "../../src/lib/dados/social-media";
import type { CaixinhaDoPost, EtapaDoMes } from "../../src/lib/dominio/posts";
import type { SocialFlowPapel } from "../../src/lib/supabase/database.types";

export type PostDaAgencia = PostReal;
export type MesDeSocial = MesReal;
export type DemandaDoMes = DemandaReal;
export type SituacaoDoMes = SituacaoReal;
export type VersaoDoPost = VersaoReal;
export type ReferenciaDoPost = ReferenciaReal;

const MES_DE_NOVEMBRO = "t-social-nov";
const MES_DA_OPTICA = "t-social-nov-optica";

const VERDE = "c0000000-0000-0000-0000-00000000000a";
const PRODUTOR = "a0000000-0000-0000-0000-000000000005"; // o colaborador do prototipo
const OUTRO = "a0000000-0000-0000-0000-000000000006";
const OPTICA = "c0000000-0000-0000-0000-00000000000b";
const SOCIO = "a0000000-0000-0000-0000-000000000001"; // a Ana, que o prototipo fotografa

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
    plataformas: ["instagram"],
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
    socialTaskId: MES_DE_NOVEMBRO,
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
    plataformas: ["instagram"],
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
    socialTaskId: MES_DE_NOVEMBRO,
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
    plataformas: ["instagram"],
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
    socialTaskId: MES_DE_NOVEMBRO,
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
    plataformas: ["instagram"],
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
    socialTaskId: MES_DE_NOVEMBRO,
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
    plataformas: ["instagram"],
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
    // O POST AVULSO, sem mês: é o estado de quem abre pela ação "Novo post" e
    // não por `abrir_mes_de_social()`. Sem ele, nenhuma imagem mostra o editor
    // sem a corrente — e aquele ramo é o que mantém de pé o post anterior à
    // 0045, com um envio e uma decisão.
    //
    // **E ele NÃO é o post programado**, que é a outra metade: o selo sai da
    // caixinha da última etapa do MÊS, e um post sem mês não tem etapa nenhuma
    // onde a marca pudesse morar. Com o avulso carregando o selo, a imagem
    // mostraria um estado que a consulta de verdade não produz.
    socialTaskId: null,
    avalInterno: false,
    esperandoCliente: false,
    programado: false,
  },
  {
    id: "p6",
    clienteId: OPTICA,
    cliente: "Óptica Visão",
    tema: "Promoção de outubro",
    pauta: null,
    legenda: "Corre que acaba! Toda a linha com 20% até domingo.",
    dataPublicacao: dia(11),
    horario: "12:00",
    plataformas: ["instagram"],
    formato: "Feed",
    midia: "imagem",
    videoUrl: null,
    status: "em_aprovacao",
    arteUrl: "/exemplos/arte-3.svg",
    thumbnailUrl: "/exemplos/arte-3.svg",
    versaoAtual: 2,
    enviadoEm: dia(3),
    responsavelId: SOCIO,
    responsavel: "Ana Souza",
    criadoPor: "a1",
    criadorNome: "Ana Souza",
    socialTaskId: MES_DA_OPTICA,
    avalInterno: true,
    esperandoCliente: true,
    programado: false,
  },
  {
    id: "p7",
    clienteId: OPTICA,
    cliente: "Óptica Visão",
    tema: "Bastidores",
    pauta: null,
    legenda: "Quem planta o que chega na sua casa.",
    dataPublicacao: dia(2),
    horario: "09:00",
    plataformas: ["instagram"],
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
    socialTaskId: MES_DA_OPTICA,
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
    // O POST AVULSO ABRE SEM CORRENTE, e e o ramo que o stub tem que
    // reproduzir: sem mes nao ha etapa nenhuma, e o editor volta a se
    // comportar como um post anterior a 0045. Devolvendo a corrente para
    // todos, a imagem mostraria a lista num post que nao a tem.
    etapas: post.socialTaskId ? CORRENTE : [],
    caixinhas: post.socialTaskId ? CAIXINHAS.map((c) => ({ ...c, postId: post.id })) : [],
    // UMA APROVACAO JA DADA: a Pauta. E o que faz o botao de envio dizer
    // "Enviar ao cliente" em vez de "Enviar a Pauta ao cliente" -- com zero,
    // o portao da vez seria a Pauta de novo, que ja esta aprovada na caixinha
    // acima, e a imagem mostraria dois fatos que se contradizem.
    aprovacoesDoCliente: post.socialTaskId ? 1 : 0,
    referencias: REFERENCIAS,
    portao: post.socialTaskId ? PORTAO : null,
  };
}

/**
 * O PORTAO DA VEZ DO MES, com peca de fora.
 *
 * As duas metades sao de proposito: o botao sai com "(4)" -- um numero, que e o
 * que a imagem precisa provar -- e DUAS pecas ficam fora, nomeadas e com link.
 * Sem a segunda metade a faixa ambar nao aparece em imagem nenhuma, e ela e
 * justamente o que o envio em lote acrescentou a esta tela.
 *
 * E o portao e o da ENTREGA e nao um do meio: com um do meio o rotulo seria
 * "Enviar a Pauta ao cliente", e a `CORRENTE` do stub tem a Pauta ja aprovada
 * na caixinha -- a imagem mostraria dois fatos que se contradizem, que e a
 * mesma armadilha que `aprovacoesDoCliente: 1` existe para evitar.
 */
const PORTAO: PortaoDoMes = {
  etapa: { id: "e4", titulo: "Envio", papel: "entrega" },
  pecas: 4,
  falta: [
    {
      postId: "sd1",
      tema: "Instagram 1 de 6 · mês que vem",
      motivo: "ainda não tem data de publicação",
    },
    {
      postId: "sd3",
      tema: "Instagram 3 de 6 · mês que vem",
      motivo: "é vídeo e ainda não tem o link",
    },
  ],
};

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
 * A CORRENTE DO MES, com cinco etapas e as caixinhas de um post (0088).
 *
 * -------------------------------------------------------------------------
 * **ERAM SEIS ETAPAS DO POST, e agora sao cinco DO MES.** A sexta era a de
 * Ajustes, que nascia entre o Envio e o Programar quando o cliente pedia --
 * e ela nao existe mais: com a etapa sendo do mes, criar uma "Ajustes" por
 * pedido afirmaria que o mes inteiro voltou por causa de uma peca.
 *
 * O que entrou no lugar dela, e e o que esta imagem precisa provar, e a
 * `observacao` da caixinha: o pedido do cliente sobre AQUELE post, escrito
 * por `posts_corrente_do_cliente` no instante da recusa.
 * -------------------------------------------------------------------------
 *
 * Os estados sao escolhidos para a imagem mostrar as quatro linhas que o
 * componente sabe desenhar, e nao o caso fácil:
 *
 *   - a Pauta e PORTAO DO CLIENTE (0076), e e o unico elo com a marca: ela
 *     existe para o selo aparecer. Marcar todas poria na imagem uma conta que
 *     aprova cinco vezes, que nao e o caso comum;
 *   - o Layout tem a caixinha DESMARCADA COM OBSERVACAO -- o post voltou;
 *   - a entrega sai sem caixa, com a razao escrita: ela nao se marca a mao;
 *   - e o ultimo elo fica bloqueado, que e a linha da trava da corrente.
 *
 * E o "12 de 18" de cada etapa nao bate com `feitos`/`total` das irmas de
 * proposito: o mes tem dezoito pecas e esta imagem mostra uma.
 */
const CORRENTE: EtapaDoMes[] = [
  {
    id: "e1",
    ordem: 10,
    titulo: "Pauta",
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    status: "concluida",
    dataInicio: dia(2),
    prazo: dia(5),
    estimativaMinutos: 240,
    papel: "producao",
    campo: "pauta",
    portao: true,
    avisoGeracao: null,
    feitos: 18,
    total: 18,
  },
  {
    id: "e2",
    ordem: 20,
    titulo: "Conteúdo",
    responsavelId: "a0000000-0000-0000-0000-000000000003",
    responsavel: "Carla Dias",
    status: "concluida",
    dataInicio: dia(5),
    prazo: dia(12),
    estimativaMinutos: 480,
    papel: "producao",
    campo: "legenda",
    portao: false,
    avisoGeracao: null,
    feitos: 18,
    total: 18,
  },
  {
    id: "e3",
    ordem: 30,
    titulo: "Layout",
    responsavelId: OUTRO,
    responsavel: "Bruno Lima",
    status: "em_andamento",
    dataInicio: dia(12),
    prazo: dia(20),
    estimativaMinutos: 960,
    papel: "producao",
    campo: null,
    portao: false,
    avisoGeracao: null,
    feitos: 11,
    total: 18,
  },
  {
    id: "e4",
    ordem: 40,
    titulo: "Envio",
    responsavelId: SOCIO,
    responsavel: "Ana Souza",
    status: "em_andamento",
    dataInicio: null,
    prazo: dia(25),
    estimativaMinutos: null,
    papel: "entrega",
    campo: null,
    portao: false,
    avisoGeracao: null,
    feitos: 6,
    total: 18,
  },
  {
    id: "e5",
    ordem: 50,
    titulo: "Programar",
    responsavelId: PRODUTOR,
    responsavel: "Marina Costa",
    status: "nao_iniciada",
    dataInicio: null,
    prazo: dia(30),
    estimativaMinutos: 120,
    papel: "pos_entrega",
    campo: null,
    portao: false,
    // A FUNCAO SEM DONO AVISA E NUNCA RECUSA (0064), e o aviso NOMEIA a funcao
    // que faltou: "ha etapa sem responsavel" manda abrir uma por uma. Ele esta
    // num elo so para a imagem mostrar a linha, e nao em todos -- um mes com
    // cinco avisos e um mes que ninguem configurou.
    avisoGeracao: null,
    feitos: 0,
    total: 18,
  },
];

/**
 * AS CAIXINHAS DO POST ABERTO.
 *
 * O Layout VEM DESMARCADO COM A OBSERVACAO, que e o estado que a imagem
 * precisa: ele e o que sobrou da etapa de Ajustes da 0045, e e a unica coisa
 * desta tela que alguem de fora escreveu. Um conjunto todo marcado ou todo em
 * branco nao desenha nem o pedido nem a caixa desligada.
 *
 * E a entrega fica DESMARCADA de proposito: ela fecha com a aprovacao, e
 * marcada ali a imagem mostraria uma peca aprovada que o cliente ainda esta
 * olhando -- o post aberto do stub tem `esperandoCliente`.
 */
const CAIXINHAS: CaixinhaDoPost[] = [
  { postId: "p1", etapaId: "e1", concluido: true, observacao: null },
  { postId: "p1", etapaId: "e2", concluido: true, observacao: null },
  {
    postId: "p1",
    etapaId: "e3",
    concluido: false,
    observacao: "O logo ficou pixelado no terceiro slide; e o rodape cortou.",
  },
  { postId: "p1", etapaId: "e4", concluido: false, observacao: null },
  { postId: "p1", etapaId: "e5", concluido: false, observacao: null },
];

export async function correnteDoMes(_taskId: string): Promise<{
  etapas: EtapaDoMes[];
  caixinhas: CaixinhaDoPost[];
}> {
  return { etapas: CORRENTE, caixinhas: CAIXINHAS };
}

export type PortaoDoMes = {
  etapa: { id: string; titulo: string; papel: SocialFlowPapel } | null;
  pecas: number;
  falta: { postId: string; tema: string; motivo: string }[];
};

export async function portaoDoMes(_taskId: string): Promise<PortaoDoMes> {
  return PORTAO;
}

/**
 * ---------------------------------------------------------------------------
 * `minhasEtapasDeSocial()` E O SEU EXEMPLO SAIRAM (0088)
 *
 * Eram seis linhas montadas para provar o agrupamento `conta > demanda do mes
 * > post` em "Minhas Tasks" -- quatro posts do mesmo mes todos com a etapa
 * "Layout", duas etapas do mesmo post, um post avulso e um sem data. Aquele
 * agrupamento existia porque a etapa era DO POST: doze posts davam doze linhas
 * "Layout", e a faixa do mes era a unica coisa que dizia que sao o mesmo
 * trabalho.
 *
 * Com a etapa sendo do mes a etapa de Layout e UMA, e ela e uma subtarefa
 * comum -- entao ela aparece em Minhas Tasks pelo caminho de toda etapa de
 * demanda, com o exemplo que `prototipo/minhas-tasks` ja monta, e o chip
 * "Social Media" conta pela mesma `areaDaLinha()` dos outros dois.
 * ---------------------------------------------------------------------------
 */

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

/**
 * OS MESES DA NAVEGACAO CONTA → ANO → MES.
 *
 * TRES CONTAS E DOIS ANOS, e as tres metades da imagem: uma conta com peca
 * esperando o cliente (ela sobe para o topo, e o cabecalho dela diz "N
 * esperando"), uma com dois anos (o segundo nivel de dobra so aparece com
 * mais de um), e um mes ARQUIVADO -- que e o estado que o filtro de situacao
 * existe para alcancar e que nenhuma outra fixture do produto tem.
 *
 * Sem a terceira, a imagem de "Arquivados" sairia vazia e a regra dos 90 dias
 * nao apareceria em lugar nenhum: e a licao da Optica Visao sem responsavel de
 * atendimento (0062), aplicada ao recorte de uma tela.
 */
const MESES_DE_SOCIAL: MesDeSocial[] = [
  {
    taskId: "mes-mv-10",
    clienteId: "c0000000-0000-0000-0000-000000000001",
    cliente: "Mundo Verde",
    mes: "2026-11-01",
    status: "em_andamento",
    concluidaEm: null,
    arquivadaEm: null,
    pecas: 18,
    aprovadas: 4,
    esperandoCliente: 6,
    fase: { titulo: "Envio", responsavel: "Ana Souza" },
  },
  {
    taskId: "mes-mv-09",
    clienteId: "c0000000-0000-0000-0000-000000000001",
    cliente: "Mundo Verde",
    mes: "2026-10-01",
    status: "concluido",
    concluidaEm: "2026-10-02T12:00:00Z",
    arquivadaEm: null,
    pecas: 18,
    aprovadas: 18,
    esperandoCliente: 0,
    fase: null,
  },
  {
    taskId: "mes-mv-2025",
    clienteId: "c0000000-0000-0000-0000-000000000001",
    cliente: "Mundo Verde",
    mes: "2025-12-01",
    status: "concluido",
    concluidaEm: "2026-01-05T12:00:00Z",
    arquivadaEm: "2026-04-05T12:00:00Z",
    pecas: 12,
    aprovadas: 12,
    esperandoCliente: 0,
    fase: null,
  },
  {
    taskId: "mes-ov-10",
    clienteId: "c0000000-0000-0000-0000-00000000000a",
    cliente: "Óptica Visão",
    mes: "2026-10-01",
    status: "em_andamento",
    concluidaEm: null,
    arquivadaEm: null,
    pecas: 8,
    aprovadas: 0,
    esperandoCliente: 0,
    fase: { titulo: "Layout", responsavel: "Bruno Lima" },
  },
  {
    taskId: "mes-mz-10",
    clienteId: "c0000000-0000-0000-0000-000000000002",
    cliente: "Matriz Comunicação",
    mes: "2026-10-01",
    status: "em_andamento",
    concluidaEm: null,
    arquivadaEm: null,
    pecas: 0,
    aprovadas: 0,
    esperandoCliente: 0,
    fase: { titulo: "Pauta", responsavel: null },
  },
];

export async function mesesDeSocialDaAgencia(
  situacao: SituacaoDoMes = "producao",
  clienteId?: string,
): Promise<MesDeSocial[]> {
  // O STUB APLICA O MESMO RECORTE DA CONSULTA, e nao devolve a lista inteira:
  // uma imagem de "Arquivados" com o mes em producao dentro seria uma paleta
  // conferindo o stub e nao o produto -- a licao da busca global.
  return MESES_DE_SOCIAL.filter((m) => {
    if (clienteId && m.clienteId !== clienteId) return false;
    if (situacao === "arquivados") return m.arquivadaEm !== null;
    if (situacao === "concluidos")
      return m.status === "concluido" && m.arquivadaEm === null;
    if (situacao === "producao")
      return m.status !== "concluido" && m.arquivadaEm === null;
    return true;
  });
}

/**
 * A DEMANDA DO MÊS, para a seção "Encerrar o mês" sair na imagem.
 *
 * **O RECORTE QUE ELE APLICA É A EMPRESA, e não o mês.** É ela a condição que
 * decide se a seção é desenhada — em "Todos os clientes" não existe "o mês" —,
 * e devolvendo um mês sempre a imagem mostraria os três botões numa tela que o
 * produto deixa sem eles: uma imagem conferindo o stub em vez do produto.
 *
 * **O mês não entra na comparação porque as duas pontas têm calendários
 * diferentes:** `MESES_DE_SOCIAL` é datado em literais fixos e a URL do
 * protótipo pede o mês CORRENTE, porque os posts de exemplo nascem a partir
 * do dia 1 de hoje. Casando os dois a seção sumiria da imagem sozinha na
 * virada do mês, sem ninguém ter tocado em nada — e uma tela que desaparece
 * do protótipo em silêncio é a que ninguém descobre que perdeu.
 *
 * **E o título sai do mês PEDIDO, não do da ficha**, porque ele é o texto que
 * a confirmação por digitação cobra: vindo da ficha, o diálogo da imagem
 * pediria um nome que o cabeçalho da tela não mostra.
 */
export async function demandaDoMes(
  mes: string,
  clienteId: string,
): Promise<DemandaDoMes | null> {
  const achado = MESES_DE_SOCIAL.find((m) => m.clienteId === clienteId);
  if (!achado) return null;
  return {
    taskId: achado.taskId,
    titulo: `Social · ${mes} de ${achado.cliente}`,
    arquivadaEm: achado.arquivadaEm,
  };
}
