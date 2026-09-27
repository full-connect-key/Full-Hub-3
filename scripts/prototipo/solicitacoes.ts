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

const TIPOS: RequestType[] = [
  {
    id: "d0000000-0000-0000-0000-000000000001",
    nome: "Peça para redes",
    descricao: "Post, story, carrossel ou reels para as suas redes.",
    icone: "Share2",
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
        opcoes: ["Feed", "Stories", "Reels", "Não sei ainda"],
      },
      {
        chave: "mensagem",
        rotulo: "O que esta peça precisa dizer",
        tipo: "texto_longo",
        obrigatorio: true,
        ajuda: "Em uma ou duas frases. O texto final é com a gente.",
      },
    ],
    ordem: 10,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000002",
    nome: "Material impresso",
    descricao: "Folder, banner, cartão, lâmina — o que vai para a gráfica.",
    icone: "Printer",
    campos_json: [
      { chave: "peca", rotulo: "Que peça é", tipo: "texto", obrigatorio: true },
      { chave: "medida", rotulo: "Medida", tipo: "texto" },
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
    campos_json: [
      { chave: "duracao", rotulo: "Duração aproximada", tipo: "texto" },
      {
        chave: "mensagem",
        rotulo: "O que o vídeo precisa dizer",
        tipo: "texto_longo",
        obrigatorio: true,
      },
    ],
    ordem: 30,
    ativo: true,
    created_at: diasAtras(90),
    updated_at: diasAtras(90),
  },
  {
    id: "d0000000-0000-0000-0000-000000000004",
    nome: "Outro",
    descricao: "Não se encaixa nos anteriores — conte o que você precisa.",
    icone: "CircleHelp",
    campos_json: [
      {
        chave: "mensagem",
        rotulo: "O que você precisa",
        tipo: "texto_longo",
        obrigatorio: true,
      },
    ],
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
    respostas: {
      rede: "Instagram",
      formato: "Feed",
      mensagem: "Que a gente tem uma seleção de presentes até R$ 80.",
    },
    data_desejada: daquiA(20),
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
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[1].id,
    criado_por: JOANA.id,
    titulo: "Lâmina A5 para a feira",
    descricao: null,
    respostas: { peca: "Lâmina A5, frente e verso", medida: "14,8 × 21 cm" },
    data_desejada: null,
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
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    client_id: "b0000000-0000-0000-0000-000000000002",
    request_type_id: TIPOS[2].id,
    criado_por: JOANA.id,
    titulo: "Vídeo de 30s para a vitrine",
    descricao: null,
    respostas: { duracao: "30 segundos", mensagem: "A coleção nova chegou." },
    data_desejada: null,
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
  },
  {
    id: "e0000000-0000-0000-0000-000000000004",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[3].id,
    criado_por: JOANA.id,
    titulo: "Reimprimir os cartões antigos",
    descricao: null,
    respostas: { mensagem: "Os mesmos do ano passado, sem mudar nada." },
    data_desejada: null,
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
    respostas: { rede: "Site", formato: "Banner", mensagem: "Até 40% em toda a loja." },
    data_desejada: diasAtras(6),
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
  },
  {
    id: "e0000000-0000-0000-0000-000000000006",
    client_id: "b0000000-0000-0000-0000-000000000001",
    request_type_id: TIPOS[3].id,
    criado_por: JOANA.id,
    titulo: "Trocar o telefone no rodapé do site",
    descricao: null,
    respostas: { mensagem: "O número mudou na semana passada." },
    data_desejada: null,
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

export async function caixaDeEntrada(_filtros?: {
  status?: PedidoNaLista["status"] | null;
  clienteId?: string | null;
}): Promise<PedidoNaLista[]> {
  const abertos = PEDIDOS.filter((p) => p.status === "nova" || p.status === "em_analise");
  const resto = PEDIDOS.filter((p) => p.status !== "nova" && p.status !== "em_analise");
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
