/**
 * Versao de prototipo de src/lib/dados/solicitacoes.ts.
 *
 * Quatro pedidos, escolhidos para as duas telas mostrarem o que fazem:
 *
 *   - um NOVO e esperando ha cinco dias, que e o unico estado em que o
 *     destaque da fila significa alguma coisa -- com data desejada, para a
 *     frase do desejo aparecer;
 *   - um em analise com conversa e anexo, para a tela de detalhe ter as duas
 *     secoes cheias;
 *   - um que ja virou demanda, para o bloco verde do "virou a demanda X";
 *   - um recusado com motivo, que e a unica linha que pede acao do cliente.
 *
 * Nenhum deles esta `concluida`: um pedido concluido e uma linha a mais no fim
 * da fila e nao acrescenta estado nenhum que as imagens precisem mostrar.
 */
import type {
  MensagemDoPedido,
  PedidoCompleto,
  PedidoNaLista,
} from "../../src/lib/dados/solicitacoes";
import type { RequestType } from "../../src/lib/supabase/database.types";

export type { PedidoCompleto, PedidoNaLista, MensagemDoPedido };

export { BUCKET_DOS_PEDIDOS } from "../../src/lib/dominio/solicitacoes";

const JOANA = {
  id: "c0000000-0000-0000-0000-000000000001",
  nome: "Joana Prado",
  avatar_url: null,
};

const CARLA = {
  id: "a0000000-0000-0000-0000-000000000003",
  nome: "Carla Reis",
  avatar_url: null,
};

/** Datas relativas ao dia da rodada: um pedido "de 12/09" envelhece sozinho e
 *  o destaque da fila deixaria de aparecer com o tempo. */
function diasAtras(quantos: number): string {
  const d = new Date();
  d.setDate(d.getDate() - quantos);
  return d.toISOString();
}

function daquiA(quantos: number): string {
  const d = new Date();
  d.setDate(d.getDate() + quantos);
  return d.toISOString().slice(0, 10);
}

/**
 * O catálogo de tipos de trabalho, espelhando o do banco depois da 0148.
 *
 * **A `frente` é coluna desde a 0148**, e é ela que o formulário lê para saber
 * se a seção de campanha aparece — o cliente deixou de escolher a frente num
 * cartão próprio. Um stub sem ela faria a imagem do formulário sair sem a
 * seção de campanha em tela nenhuma.
 *
 * **E "Vídeo" vem DESATIVADO**, que é o pedido do usuário — *"videos tbm são
 * peças para rede"*: ele some do formulário do cliente por RLS
 * (`request_types_select` é `is_staff() or ativo`), e a tela da gestão continua
 * listando os cinco. Com ele ativo aqui, a imagem mostraria um cartão que o
 * produto não oferece mais.
 */
const TIPOS: RequestType[] = [
  {
    id: "d0000000-0000-0000-0000-000000000001",
    nome: "Peça para redes",
    descricao: "Post, story, carrossel ou reels para as suas redes.",
    icone: "Share2",
    frente: "social",
    campos_json: [
      {
        chave: "rede",
        rotulo: "Onde vai ao ar",
        tipo: "escolha",
        obrigatorio: true,
        opcoes: ["Instagram", "Facebook", "LinkedIn", "TikTok", "Mais de uma"],
      },
      {
        chave: "formato",
        rotulo: "Formato",
        tipo: "escolha",
        obrigatorio: false,
        opcoes: ["Feed", "Stories", "Carrossel", "Reels ou vídeo", "Não sei ainda"],
        ajuda: "Vídeo entra aqui também — gravação, edição ou animação.",
      },
    ],
    ordem: 10,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000005",
    nome: "Campanha",
    descricao: "Uma ação com começo e fim, com várias peças dentro.",
    icone: "Megaphone",
    frente: "campanha",
    campos_json: [
      {
        chave: "publico",
        rotulo: "Para quem",
        tipo: "texto",
        obrigatorio: false,
        ajuda: "Quem a campanha precisa alcancar.",
      },
    ],
    ordem: 15,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000002",
    nome: "Material impresso",
    descricao: "Folder, banner, cartão, lâmina — o que vai para a gráfica.",
    icone: "Printer",
    frente: null,
    campos_json: [
      {
        chave: "peca",
        rotulo: "Que peça é",
        tipo: "texto",
        obrigatorio: true,
        ajuda: "Folder A5, banner de 2x1, cartão de visita…",
      },
      {
        chave: "medida",
        rotulo: "Medida",
        tipo: "texto",
        obrigatorio: false,
        ajuda: "Se a gráfica já pediu um tamanho, é aqui.",
      },
      { chave: "quantidade", rotulo: "Quantas", tipo: "texto", obrigatorio: false },
      {
        chave: "onde_usa",
        rotulo: "Onde vai ser usada",
        tipo: "texto",
        obrigatorio: false,
      },
    ],
    ordem: 20,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000003",
    nome: "Vídeo",
    descricao: "Gravação, edição ou animação.",
    icone: "Video",
    frente: null,
    campos_json: [
      {
        chave: "duracao",
        rotulo: "Duração aproximada",
        tipo: "texto",
        obrigatorio: false,
      },
      { chave: "onde", rotulo: "Onde vai ao ar", tipo: "texto", obrigatorio: false },
      {
        chave: "tem_material",
        rotulo: "Já existe material gravado?",
        tipo: "escolha",
        obrigatorio: false,
        opcoes: ["Sim, vou anexar", "Sim, mando depois", "Não"],
      },
    ],
    ordem: 30,
    ativo: false,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000004",
    nome: "Outro",
    descricao: "Não se encaixa nos anteriores — conte o que você precisa.",
    icone: "CircleHelp",
    frente: null,
    /**
     * O ROTEIRO DELE ESTÁ VAZIO, e é a 0148.
     *
     * Ele perguntava *"O que você precisa"* num campo de texto longo
     * obrigatório, e com o BRIEFING sendo o campo principal da seção 1 aquela
     * pergunta passou a ser a mesma coisa pedida duas vezes na mesma tela. O
     * `campos.length > 0` do formulário é o que faz o roteiro simplesmente não
     * nascer.
     */
    campos_json: [],
    ordem: 40,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
];

const PEDIDOS: PedidoNaLista[] = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[0].id,
    criado_por: JOANA.id,
    titulo: "Arte para o Dia das Mães",
    descricao: "Queria uma peça bonita para o feed, com a linha visual da loja.",
    briefing_rico: null,
    respostas: {
      rede: "Instagram",
      formato: "Feed",
      mensagem: "Que a gente tem uma seleção de presentes até R$ 80.",
    },
    data_desejada: daquiA(20),
    // DOIS DOS SEIS NASCEM DE UMA CAMPANHA, e os outros quatro nao: sem os
    // dois estados, a coluna CAMPANHA sai em imagem provando so que ela sabe
    // ficar vazia.
    campaign_id: "camp-1",
    frente: "campanha",
    vertente_id: "ee000000-0000-0000-0000-000000000002",
    vertente: "Lojas Próprias",
    campanha: "Wave Outubro Rosa",
    campanha_inicio: null,
    campanha_fim: null,
    composicao: null,
    status: "nova",
    motivo_recusa: null,
    decidida_em: null,
    created_at: diasAtras(5),
    updated_at: diasAtras(5),
    empresa: "Mundo Verde",
    autor: JOANA,
    tipo: "Peça para redes",
    quantosAnexos: 2,
    quantasMensagens: 0,
    demanda: null,
    demandaEmAjustes: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    // O `client_id` DA LISTA DE CLIENTES, e nao um uuid qualquer: a abertura
    // de campanha pre-preenche o seletor de Cliente com ele, e um id que
    // `clientesAtivos()` nao conhece deixa o campo EM BRANCO -- a imagem
    // mostraria o prefill nao preenchendo justamente o primeiro campo.
    client_id: "c0000000-0000-0000-0000-00000000000a",
    request_type_id: TIPOS[1].id,
    criado_por: JOANA.id,
    titulo: "Lâmina A5 para a feira",
    descricao: null,
    briefing_rico: null,
    respostas: { peca: "Lâmina A5, frente e verso", medida: "14,8 × 21 cm" },
    data_desejada: null,
    campaign_id: null,
    frente: "campanha",
    vertente_id: null,
    vertente: null,
    campanha: null,
    // O PEDIDO DE CAMPANHA COM PERIODO E LISTA DE MATERIAIS (0138), e ele e o
    // UNICO dos seis: com os tres de campanha preenchidos, a imagem provaria
    // que o bloco aparece e nao que ele sabe FALTAR -- que e o estado da
    // maioria dos pedidos. E este e o que a `94` abre e o que carrega o botao
    // "Abrir a campanha", porque ele e `campanha`, sem demanda e nao recusado.
    //
    // AS DATAS SAO CALCULADAS e nunca literais, que e a licao dos meses da
    // nota fiscal: um periodo escrito em 2027 para de ser futuro sozinho, e a
    // imagem sai igual sem nada reclamar.
    campanha_inicio: daquiA(20),
    campanha_fim: daquiA(50),
    composicao: [
      { tipo: "banner", quantidade: 2, formato: "Banner de lona", dimensoes: "200 × 100 cm" },
      { tipo: "estatico", quantidade: 6, formato: "Feed", dimensoes: "1080 × 1350" },
      { tipo: "outro", quantidade: 1, formato: "Lâmina A5", dimensoes: "14,8 × 21 cm" },
    ],
    status: "em_analise",
    motivo_recusa: null,
    decidida_em: null,
    created_at: diasAtras(2),
    updated_at: diasAtras(1),
    empresa: "Mundo Verde",
    autor: JOANA,
    tipo: "Material impresso",
    quantosAnexos: 1,
    quantasMensagens: 2,
    demanda: null,
    demandaEmAjustes: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    client_id: "b0000000-0000-0000-0000-000000000002",
    request_type_id: TIPOS[2].id,
    criado_por: JOANA.id,
    titulo: "Vídeo de 30s para a vitrine",
    descricao: null,
    briefing_rico: null,
    respostas: { duracao: "30 segundos", mensagem: "A coleção nova chegou." },
    data_desejada: null,
    campaign_id: "camp-1",
    frente: "campanha",
    vertente_id: null,
    vertente: null,
    campanha: "Wave Outubro Rosa",
    campanha_inicio: null,
    campanha_fim: null,
    composicao: null,
    status: "em_andamento",
    motivo_recusa: null,
    decidida_em: null,
    created_at: diasAtras(9),
    updated_at: diasAtras(6),
    empresa: "Óptica Visão",
    autor: JOANA,
    tipo: "Vídeo",
    quantosAnexos: 0,
    quantasMensagens: 1,
    demanda: {
      id: "f0000000-0000-0000-0000-000000000001",
      titulo: "Vídeo de vitrine — Óptica Visão",
    },
    // EM AJUSTES, e e de proposito: sem um pedido nesta fase a aba sai vazia na
    // imagem, e uma aba vazia nao prova que ela separa nada.
    demandaEmAjustes: true,
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[3].id,
    criado_por: JOANA.id,
    titulo: "Reimprimir os cartões antigos",
    descricao: null,
    briefing_rico: null,
    respostas: { mensagem: "Os mesmos do ano passado, sem mudar nada." },
    data_desejada: null,
    campaign_id: null,
    frente: null,
    vertente_id: null,
    vertente: null,
    campanha: null,
    campanha_inicio: null,
    campanha_fim: null,
    composicao: null,
    status: "recusada",
    motivo_recusa:
      "A arte do ano passado usa o logo antigo. Vale refazer com a marca nova — abrimos outro pedido?",
    decidida_em: diasAtras(11),
    created_at: diasAtras(14),
    updated_at: diasAtras(11),
    empresa: "Mundo Verde",
    autor: JOANA,
    tipo: "Outro",
    quantosAnexos: 0,
    quantasMensagens: 0,
    demanda: null,
    demandaEmAjustes: false,
  },
  // OS DOIS CONCLUIDOS, e sao dois porque a secao "Material deste pedido" tem
  // dois estados e nenhum deles aparecia antes: com material, e concluido SEM
  // material -- que e o caso que motivou a secao existir.
  {
    id: "e0000000-0000-0000-0000-000000000005",
    // ESTE `client_id` E O DA EMPRESA DE `scripts/prototipo/portal.ts`, e nao
    // o `b0...0001` dos outros: `itensDoPortal` filtra por empresa, e com o id
    // dos vizinhos a secao sairia vazia na tela que existe para mostra-la
    // cheia. O comentario do outro stub diz o mesmo do lado de la.
    client_id: "c0000000-0000-0000-0000-00000000000a",
    request_type_id: TIPOS[0].id,
    criado_por: JOANA.id,
    titulo: "Banner do site para a Black Friday",
    descricao: "Um para a home e um quadrado para o feed, com o desconto em destaque.",
    /**
     * O BRIEFING RICO (0148), e ele é de UM dos seis.
     *
     * Com os seis preenchidos a imagem provaria que o `BriefingDoPedido`
     * desenha, e não que ele **escolhe**: o outro ramo dele é o pedido
     * anterior à migration, que tem só o texto — e é o pedido 1 que mostra
     * esse, com a `descricao` dele e `briefing_rico` nulo. É a razão do evento
     * de cada par da legenda do calendário.
     *
     * E ele carrega uma TABELA e um DESTAQUE de propósito: são as duas
     * ferramentas que o usuário nomeou — *"com tabelas, grifando"* —, e um
     * briefing de parágrafos soltos sairia idêntico ao texto puro do ramo de
     * baixo.
     */
    briefing_rico: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "São duas peças para a " },
            { type: "text", marks: [{ type: "bold" }], text: "Semana do Cliente" },
            { type: "text", text: ": uma para a home do site e uma quadrada para o feed." },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "O desconto " },
            {
              type: "text",
              // O REALCE E ATRIBUTO DE `textStyle`, e nunca uma marca propria:
              // `BackgroundColor` mora dentro de `@tiptap/extension-text-style` e
              // acrescenta o atributo aquela marca, como `Color` faz com a cor.
              // Escrito como marca, o documento inteiro e INVALIDO -- e o TipTap
              // nao estoura: ele cai para um paragrafo vazio, entao a tela sai com
              // a secao do briefing em branco. Foi a imagem que mostrou.
              marks: [{ type: "textStyle", attrs: { backgroundColor: "var(--rico-realce-amarelo)" } }],
              text: "precisa aparecer em destaque",
            },
            { type: "text", text: " nas duas." },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Peça" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Medida" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Banner da home" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1920 x 600" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Post do feed" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1080 x 1080" }] }] },
              ],
            },
          ],
        },
      ],
    },
    respostas: { rede: "Site", formato: "Banner", mensagem: "Até 40% em toda a loja." },
    data_desejada: diasAtras(6),
    campaign_id: null,
    frente: "social",
    vertente_id: "ee000000-0000-0000-0000-000000000001",
    vertente: "Institucional",
    campanha: null,
    campanha_inicio: null,
    campanha_fim: null,
    composicao: null,
    status: "concluida",
    motivo_recusa: null,
    decidida_em: diasAtras(3),
    created_at: diasAtras(16),
    updated_at: diasAtras(3),
    empresa: "Mundo Verde",
    autor: JOANA,
    tipo: "Peça para redes",
    quantosAnexos: 1,
    quantasMensagens: 2,
    demanda: {
      id: "f0000000-0000-0000-0000-000000000002",
      titulo: "Banner de Black Friday — site",
    },
    demandaEmAjustes: false,
  },
  {
    id: "e0000000-0000-0000-0000-000000000006",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[3].id,
    criado_por: JOANA.id,
    titulo: "Trocar o telefone no rodapé do site",
    descricao: null,
    briefing_rico: null,
    respostas: { mensagem: "O número mudou na semana passada." },
    data_desejada: null,
    campaign_id: null,
    frente: "social",
    vertente_id: null,
    vertente: null,
    campanha: null,
    campanha_inicio: null,
    campanha_fim: null,
    composicao: null,
    status: "concluida",
    motivo_recusa: null,
    decidida_em: diasAtras(8),
    created_at: diasAtras(12),
    updated_at: diasAtras(8),
    empresa: "Mundo Verde",
    autor: JOANA,
    tipo: "Outro",
    quantosAnexos: 0,
    quantasMensagens: 1,
    demanda: null,
    demandaEmAjustes: false,
  },
];

const CONVERSA: Record<string, MensagemDoPedido[]> = {
  "e0000000-0000-0000-0000-000000000002": [
    {
      id: "aa000000-0000-0000-0000-000000000001",
      request_id: "e0000000-0000-0000-0000-000000000002",
      autor_id: CARLA.id,
      texto: "A feira é em qual cidade? Pergunto por causa do prazo da gráfica.",
      created_at: diasAtras(2),
      autor: CARLA,
    },
    {
      id: "aa000000-0000-0000-0000-000000000002",
      request_id: "e0000000-0000-0000-0000-000000000002",
      autor_id: JOANA.id,
      texto: "Em Curitiba, dia 12.",
      created_at: diasAtras(1),
      autor: JOANA,
    },
  ],
  "e0000000-0000-0000-0000-000000000003": [
    {
      id: "aa000000-0000-0000-0000-000000000003",
      request_id: "e0000000-0000-0000-0000-000000000003",
      autor_id: CARLA.id,
      texto: "Fechado — entra na produção desta semana.",
      created_at: diasAtras(6),
      autor: CARLA,
    },
  ],
};

const ANEXOS: Record<string, PedidoCompleto["anexos"]> = {
  "e0000000-0000-0000-0000-000000000001": [
    {
      id: "bb000000-0000-0000-0000-000000000001",
      request_id: "e0000000-0000-0000-0000-000000000001",
      caminho: "/exemplos/arte-1.svg",
      nome: "referencia-que-eu-gostei.png",
      tipo: "image/png",
      tamanho: 482_112,
      enviado_por: JOANA.id,
      created_at: diasAtras(5),
      assinado: "/exemplos/arte-1.svg",
    },
    {
      id: "bb000000-0000-0000-0000-000000000002",
      request_id: "e0000000-0000-0000-0000-000000000001",
      caminho: "/exemplos/arte-2.svg",
      nome: "logo-da-loja.svg",
      tipo: "image/svg+xml",
      tamanho: 12_004,
      enviado_por: JOANA.id,
      created_at: diasAtras(5),
      assinado: "/exemplos/arte-2.svg",
    },
  ],
  "e0000000-0000-0000-0000-000000000002": [
    {
      id: "bb000000-0000-0000-0000-000000000003",
      request_id: "e0000000-0000-0000-0000-000000000002",
      caminho: "/exemplos/arte-1.svg",
      nome: "lamina-do-ano-passado.pdf",
      tipo: "application/pdf",
      tamanho: 2_411_008,
      enviado_por: JOANA.id,
      created_at: diasAtras(2),
      assinado: "/exemplos/arte-1.svg",
    },
  ],
};

export async function tiposDePedido(): Promise<RequestType[]> {
  return TIPOS;
}

export async function caixaDeEntrada(): Promise<PedidoNaLista[]> {
  // A FILA DESCE INTEIRA, como no produto (0134): quem recorta é a tela, para
  // as opções de cada dimensão saírem do todo e não do que sobrou da outra.
  const abertos = PEDIDOS.filter(
    (p) => p.status === "nova" || p.status === "em_analise",
  );
  const resto = PEDIDOS.filter(
    (p) => p.status !== "nova" && p.status !== "em_analise",
  );
  return [...abertos, ...resto];
}

export async function meusPedidos(_clienteId?: string): Promise<PedidoNaLista[]> {
  return PEDIDOS;
}

export async function pedido(id: string): Promise<PedidoCompleto | null> {
  const base = PEDIDOS.find((p) => p.id === id) ?? PEDIDOS[0];
  return {
    ...base,
    mensagens: CONVERSA[base.id] ?? [],
    anexos: ANEXOS[base.id] ?? [],
    roteiro: TIPOS.find((t) => t.id === base.request_type_id) ?? null,
  };
}

export async function quantosPedidosEsperando(): Promise<number> {
  return PEDIDOS.filter((p) => p.status === "nova" || p.status === "em_analise").length;
}

export async function contaAceitaPedidos(_clienteId: string): Promise<boolean> {
  return true;
}
