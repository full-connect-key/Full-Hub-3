/**
 * Versao de prototipo de src/lib/dados/academy.ts.
 *
 * SEIS ITENS, e cada um existe para mostrar um estado que os outros nao
 * mostram:
 *
 *   playbook "Briefing que nao volta"  -- lido, e na versao CORRENTE. E o
 *                                         estado bom, e sem ele nao ha com
 *                                         que comparar o de baixo.
 *   playbook "Como a gente apresenta"  -- a pessoa lei a v1 e a v2 EXIGE
 *                                         releitura. E o estado que justifica
 *                                         o modulo inteiro existir, e o unico
 *                                         que desenha a faixa ambar.
 *   playbook "Padroes de nomeacao"     -- RASCUNHO. So aparece porque o
 *                                         prototipo roda como gestao; no app,
 *                                         a RLS o esconde da equipe.
 *   ebook    "Marca da Full"           -- nao lido, com arquivo.
 *   curso    "Trafego do zero"         -- pela metade: 2 de 5 aulas. E o unico
 *                                         estado em que a barra significa
 *                                         alguma coisa.
 *   curso    "Primeiros 30 dias"       -- OBRIGATORIO e FORA DO PRAZO. Sem ele
 *                                         o selo ambar e a frase de pendencia
 *                                         nao saem em imagem nenhuma.
 *
 * Um acervo onde tudo esta zerado ou tudo concluido nao valida nada: os dois
 * extremos escondem justamente o que a tela serve para mostrar.
 */
import type {
  AchadoDaBusca,
  EbookInterativo,
  ItemAberto,
  ItemDoAcervo,
  LinhaDoAcompanhamento,
} from "../../src/lib/dados/academy";

export type {
  AchadoDaBusca,
  EbookInterativo,
  ItemAberto,
  ItemDoAcervo,
  LinhaDoAcompanhamento,
};

const AGORA = "2026-09-20T10:00:00.000Z";

function item(
  parcial: Partial<ItemDoAcervo> & Pick<ItemDoAcervo, "id" | "tipo" | "titulo" | "slug">,
): ItemDoAcervo {
  return {
    resumo: null,
    descricao: null,
    categoria: null,
    capa_url: null,
    tags: [],
    autor_id: null,
    publicado: true,
    exige_confirmacao_leitura: false,
    ordem: 0,
    duracao_estimada_minutos: null,
    created_at: AGORA,
    updated_at: AGORA,
    estado: "nao_iniciado",
    vistos: 0,
    total: 1,
    percentual: 0,
    duracaoMinutos: null,
    obrigatorio: false,
    prazo: null,
    vencido: false,
    ...parcial,
  };
}

/**
 * UM ANEXO DE EXEMPLO, e ele existe porque o stub e quem decide o que a
 * imagem prova.
 *
 * O anexo de playbook e de curso nasceu com a tela — `academy_arquivos` e por
 * item desde a 0096, e o que prendia o upload ao e-book era o condicional da
 * tela. Sem um anexo aqui, NENHUMA imagem mostraria nem o cartao de baixar
 * nem o uploader preenchido: a rodada terminaria dizendo "Pronto" e a peca
 * nova nao sairia em lugar nenhum. E a licao do carrossel combinado e da
 * duplicata do Cronograma.
 *
 * **E UM SO TEM, de proposito.** O "Briefing que nao volta com duvida" fica
 * SEM, porque e ele que `82e-academy-montar` fotografa: com anexo nos dois, a
 * imagem provaria que o bloco aparece e nao que ele sabe dizer "Anexar um
 * arquivo" quando ainda nao ha nada. E a razao do evento de cada par da
 * legenda do calendario.
 */
function anexo(itemId: string, nome: string, bytes: number, paginas: number | null) {
  return {
    arquivo: {
      id: `arq${itemId.slice(3, 11)}-0000-4000-8000-000000000009`,
      item_id: itemId,
      url: "/exemplos/checklist.pdf",
      nome,
      tamanho_bytes: bytes,
      paginas,
      formato: "pdf" as const,
      versao: 1,
      notas_mudanca: null,
      exige_releitura: false,
      publicado_em: AGORA,
      created_at: AGORA,
    },
    arquivoAssinado: "/exemplos/checklist.pdf",
  };
}

const ACERVO: ItemDoAcervo[] = [
  item({
    id: "aca00001-0000-4000-8000-000000000001",
    tipo: "playbook",
    titulo: "Briefing que não volta com dúvida",
    slug: "briefing-que-nao-volta-com-duvida",
    resumo: "As sete perguntas que todo briefing responde antes de sair da mesa.",
    categoria: "Atendimento",
    tags: ["briefing", "atendimento"],
    estado: "concluido",
    vistos: 1,
    percentual: 100,
  }),
  item({
    id: "aca00002-0000-4000-8000-000000000002",
    tipo: "playbook",
    titulo: "Como a gente apresenta para o cliente",
    slug: "como-a-gente-apresenta-para-o-cliente",
    resumo: "A ordem da conversa, o que mostrar primeiro e o que nunca abrir em reunião.",
    categoria: "Atendimento",
    tags: ["apresentação", "cliente"],
    estado: "releitura",
  }),
  item({
    id: "aca00003-0000-4000-8000-000000000003",
    tipo: "playbook",
    titulo: "Padrões de nomeação de arquivo",
    slug: "padroes-de-nomeacao-de-arquivo",
    resumo: "Como nomear pasta, arte e versão para o próximo achar.",
    categoria: "Produção",
    publicado: false,
  }),
  item({
    id: "aca00004-0000-4000-8000-000000000004",
    tipo: "ebook",
    titulo: "A marca da Full, por dentro",
    slug: "a-marca-da-full-por-dentro",
    resumo: "O símbolo, a paleta e os usos que a gente não faz.",
    categoria: "Cultura",
    tags: ["marca"],
    duracaoMinutos: 40,
  }),
  // O E-BOOK INTERATIVO, que e o primeiro item publicado do acervo de verdade.
  // Ele existe aqui porque a tela dele nao e a do PDF: e um iframe com a
  // pagina inteira dentro, com barra de capitulos lidos e "Li e estou ciente"
  // no cabecalho. Sem ele, o unico e-book em imagem seria o do cartao de
  // download -- e o formato novo nao sairia em tela nenhuma.
  item({
    id: "aca00010-0000-4000-8000-000000000010",
    tipo: "ebook",
    titulo: "Operações | Criação",
    slug: "operacoes-criacao",
    resumo:
      "Como a Criação da Full opera: do briefing que chega ao arquivo aberto que fica.",
    categoria: "Produção",
    tags: ["criação", "processo", "onboarding"],
    estado: "em_andamento",
    vistos: 9,
    total: 23,
    percentual: 39,
    duracaoMinutos: 90,
    exige_confirmacao_leitura: true,
  }),
  // O E-BOOK RECEM-CRIADO, QUE AINDA NAO TEM ARQUIVO, e ele e o estado que
  // doi: foi dele a queixa do usuario -- *"quando eu seleciono que vou montar
  // um e-book, ele nao me da nem sequer o espaco para enviar um PDF"*. Com um
  // e-book so no acervo, e ele COM arquivo, o prototipo mostrava o modulo no
  // unico estado em que o furo nao aparece. E a licao da Optica Visao sem
  // atendente (0062) e da pessoa desligada (0069), aplicada ao formato.
  item({
    id: "aca00009-0000-4000-8000-000000000009",
    tipo: "ebook",
    titulo: "Guia de tom de voz",
    slug: "guia-de-tom-de-voz",
    resumo: "Como a Full escreve para cada rede e para cada cliente.",
    categoria: "Cultura",
    tags: ["escrita"],
    publicado: false,
  }),
  item({
    id: "aca00005-0000-4000-8000-000000000005",
    tipo: "curso",
    titulo: "Tráfego pago do zero",
    slug: "trafego-pago-do-zero",
    resumo: "Da conta de anúncios ao primeiro relatório que o cliente entende.",
    categoria: "Mídia",
    tags: ["tráfego", "mídia"],
    estado: "em_andamento",
    vistos: 2,
    total: 5,
    percentual: 40,
    duracaoMinutos: 185,
  }),
  item({
    id: "aca00006-0000-4000-8000-000000000006",
    tipo: "curso",
    titulo: "Primeiros 30 dias na Full",
    slug: "primeiros-30-dias-na-full",
    resumo: "O que você precisa saber na primeira semana, e o que pode esperar.",
    categoria: "Cultura",
    estado: "em_andamento",
    vistos: 1,
    total: 4,
    percentual: 25,
    obrigatorio: true,
    prazo: "2026-09-10",
    vencido: true,
    duracaoMinutos: 95,
  }),
];

export async function listarAcervo(_usuarioId: string): Promise<ItemDoAcervo[]> {
  return ACERVO;
}

export async function abrirItem(
  slug: string,
  _usuarioId: string,
): Promise<ItemAberto | null> {
  const achado = ACERVO.find((i) => i.slug === slug);
  if (!achado) return null;

  const base = {
    item: achado,
    estado: achado.estado,
    vistos: achado.vistos,
    total: achado.total,
    playbook: null,
    arquivo: null,
    arquivoAssinado: null,
    interativo: null,
    curso: null,
  } satisfies ItemAberto;

  if (achado.tipo === "playbook") {
    const texto = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Antes de qualquer coisa, pergunte o que o cliente quer que aconteça depois que a peça for ao ar. É a única pergunta que separa um briefing de um pedido.",
            },
          ],
        },
      ],
    };
    const releitura = achado.estado === "releitura";
    return {
      ...base,
      playbook: {
        versaoCorrente: {
          id: "ver00001-0000-4000-8000-000000000001",
          item_id: achado.id,
          numero_versao: releitura ? 2 : 1,
          conteudo_rico: texto,
          conteudo_texto: "Antes de qualquer coisa, pergunte o que o cliente quer.",
          notas_mudanca: releitura
            ? "A ordem da apresentação mudou: o preço passa a vir depois do conceito."
            : null,
          exige_releitura: releitura,
          publicado_por: null,
          publicado_em: AGORA,
        },
        historico: [],
        versaoConfirmada: achado.estado === "nao_iniciado" ? null : 1,
        versaoDeReleitura: releitura ? 2 : null,
      },
      ...(achado.slug === "como-a-gente-apresenta-para-o-cliente"
        ? anexo(achado.id, "roteiro-da-apresentacao.pdf", 1_800_000, 6)
        : {}),
    };
  }

  if (achado.tipo === "ebook") {
    // O SEGUNDO E-BOOK NAO TEM ARQUIVO, de proposito: e ele que desenha o
    // "Anexar o arquivo" na tela de montar e a frase que diz o que falta.
    if (achado.slug === "guia-de-tom-de-voz") return base;

    // O INTERATIVO, com 9 de 23 capitulos lidos: nem zerado nem completo, que
    // sao os dois extremos que escondem o que a barra serve para mostrar.
    if (achado.slug === "operacoes-criacao") {
      const CAPITULOS = [
        ["como-usar", "Como usar este documento"],
        ["escopos", "Escopos e responsabilidades"],
        ["papel", "Papel da equipe de Criação"],
        ["clientes", "Clientes atendidos"],
        ["integracao", "Guia de integração das equipes"],
        ["ferramentas", "Ferramentas de apoio"],
        ["entrada", "Fluxo de entrada de demandas"],
        ["organizacao", "Organização do processo"],
        ["inicio", "Início do processo"],
        ["desenvolvimento", "Desenvolvimento criativo"],
        ["autorrevisao", "Autorrevisão da demanda"],
        ["grafica", "Fechamento de arquivos para gráfica"],
        ["pesquisa", "Pesquisa e referência visual"],
        ["identidade", "Identidade visual dos clientes"],
        ["social", "Criação para social media"],
        ["performance", "Criação para criativos de performance"],
        ["audiovisual", "Criação para audiovisual"],
        ["imagens", "Imagens, ilustrações e inteligência artificial"],
        ["qualidade", "Controle de qualidade"],
        ["aprovacao", "Apresentação e aprovação"],
        ["alteracoes", "Alterações e retrabalho"],
        ["drive", "Organização do Google Drive"],
        ["arquivo-aberto", "Arquivo aberto"],
      ] as const;

      return {
        ...base,
        arquivo: {
          id: "arq00002-0000-4000-8000-000000000002",
          item_id: achado.id,
          url: "ebooks/aca00010/v1/index.html",
          nome: "operacoes-criacao.html",
          tamanho_bytes: 152_322,
          paginas: 109,
          formato: "html_interativo",
          versao: 1,
          notas_mudanca: "Primeira publicação.",
          exige_releitura: false,
          publicado_em: AGORA,
          created_at: AGORA,
        },
        arquivoAssinado: "/exemplos/operacoes-criacao.html",
        interativo: {
          capitulos: CAPITULOS.map(([chave, titulo], i) => ({
            id: `cap0${String(i).padStart(4, "0")}-0000-4000-8000-00000000000${i % 10}`,
            item_id: achado.id,
            chave,
            titulo,
            ordem: i + 1,
          })),
          lidos: CAPITULOS.slice(0, 9).map(([chave]) => chave),
          checks: { "inicio-7-0": 1, "inicio-7-2": 1 },
          versao: 1,
          versaoConfirmada: null,
          versaoDeReleitura: null,
          notasDaVersao: "Primeira publicação.",
        },
      };
    }

    return {
      ...base,
      arquivo: {
        id: "arq00001-0000-4000-8000-000000000001",
        item_id: achado.id,
        url: "/exemplos/marca.pdf",
        nome: "a-marca-da-full.pdf",
        tamanho_bytes: 4_200_000,
        paginas: 28,
        formato: "pdf",
        versao: 1,
        notas_mudanca: null,
        exige_releitura: false,
        publicado_em: AGORA,
        created_at: AGORA,
      },
      // JA E UM ENDERECO, e por isso ele passa igual: o stub aponta para
      // `/exemplos/`, e `assinarArquivos` deixa passar o que nao e caminho de
      // bucket. No produto este campo e a URL assinada que vale uma hora.
      arquivoAssinado: "/exemplos/marca.pdf",
    };
  }

  return {
    ...base,
    ...anexo(achado.id, "apostila-trafego-pago.pdf", 3_100_000, 42),
    curso: {
      modulos: [
        {
          id: "mod00001-0000-4000-8000-000000000001",
          item_id: achado.id,
          titulo: "O começo",
          descricao: "O que precisa estar pronto antes da primeira campanha.",
          ordem: 0,
          aulas: [
            {
              id: "aul00001-0000-4000-8000-000000000001",
              modulo_id: "mod00001-0000-4000-8000-000000000001",
              titulo: "Por que medir antes de anunciar",
              tipo: "video",
              url: "https://www.youtube.com/watch?v=exemplo",
              conteudo_rico: null,
              arquivo_url: null,
              duracao_minutos: 12,
              ordem: 0,
            },
            {
              id: "aul00002-0000-4000-8000-000000000002",
              modulo_id: "mod00001-0000-4000-8000-000000000001",
              titulo: "A conta de anúncios, passo a passo",
              tipo: "texto",
              url: null,
              conteudo_rico: null,
              arquivo_url: null,
              duracao_minutos: 20,
              ordem: 1,
            },
            {
              id: "aul00003-0000-4000-8000-000000000003",
              modulo_id: "mod00001-0000-4000-8000-000000000001",
              titulo: "Checklist de primeira campanha",
              tipo: "pdf",
              url: null,
              conteudo_rico: null,
              arquivo_url: "/exemplos/checklist.pdf",
              duracao_minutos: null,
              ordem: 2,
            },
          ],
        },
      ],
      vistas: new Set(["aul00001-0000-4000-8000-000000000001"]),
    },
  };
}

export async function minhaAnotacao(
  _itemId: string,
  _aulaId: string | null,
  _usuarioId: string,
): Promise<string> {
  return "Perguntar à Carla como ela faz a parte do orçamento.";
}

export async function buscarNoAcervo(
  _termo: string,
  _usuarioId: string,
): Promise<AchadoDaBusca[]> {
  return ACERVO.slice(0, 2).map((i) => ({ ...i, trecho: null }));
}

export async function acompanhamentoDaEquipe(): Promise<LinhaDoAcompanhamento[]> {
  return [
    {
      user_id: "11111111-1111-1111-1111-111111111111",
      pessoa: "Ana Souza",
      funcao: "Gestao",
      item_id: "aca00006-0000-4000-8000-000000000006",
      item: "Primeiros 30 dias na Full",
      tipo: "curso",
      estado: "concluido",
      prazo: "2026-02-10",
      vencido: false,
    },
    {
      user_id: "33333333-3333-3333-3333-333333333333",
      pessoa: "Carla Reis",
      funcao: "Atendimento",
      item_id: "aca00001-0000-4000-8000-000000000001",
      item: "Briefing que não volta com dúvida",
      tipo: "playbook",
      estado: "releitura",
      prazo: "2026-09-15",
      vencido: true,
    },
    {
      user_id: "44444444-4444-4444-4444-444444444444",
      pessoa: "Bruno Alves",
      funcao: "Design",
      item_id: "aca00006-0000-4000-8000-000000000006",
      item: "Primeiros 30 dias na Full",
      tipo: "curso",
      estado: "em_andamento",
      prazo: "2026-09-10",
      vencido: true,
    },
    {
      user_id: "55555555-5555-5555-5555-555555555555",
      pessoa: "Marina Costa",
      funcao: "Social Media",
      item_id: "aca00006-0000-4000-8000-000000000006",
      item: "Primeiros 30 dias na Full",
      tipo: "curso",
      estado: "nao_iniciado",
      prazo: null,
      vencido: false,
    },
  ];
}

export async function listarTrilhas() {
  return [];
}
