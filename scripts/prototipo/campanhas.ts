/**
 * Versao de prototipo de src/lib/dados/campanhas.ts.
 *
 * Uma Wave no meio do caminho, que e o estado em que a tela tem mais o que
 * mostrar: KV aprovado, Enxoval com uma peca recusada e uma esperando decisao,
 * Feed/Storys pela metade, e um grupo inteiro que o cliente NAO enxerga --
 * porque nada dentro dele foi enviado.
 *
 * O periodo termina em 6 dias de proposito: e o que faz o alerta de prazo
 * aparecer. Com 8 ele nao apareceria, e o caso mais interessante da tela
 * ficaria sem imagem.
 */
import type { VersaoDoConteudo } from "../../src/lib/dados/conteudo";
import type {
  CampanhaDoPortal,
  EntregavelDoPortal,
} from "../../src/lib/dominio/campanhas";
import type { EstruturaDeTemplate } from "../../src/lib/supabase/database.types";

const HOJE = new Date();
const dia = (delta: number) =>
  new Date(HOJE.getTime() + delta * 864e5).toISOString().slice(0, 10);

const VERDE = "c0000000-0000-0000-0000-00000000000a";

const CAMPANHAS: CampanhaDoPortal[] = [
  {
    id: "camp-wave",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    nome: "Wave Outubro Rosa",
    descricao:
      "A campanha de outubro: KV, enxoval de peças, feed, vídeos e os arquivos do Deskfy.",
    dataInicio: dia(-24),
    dataFim: dia(6),
    status: "ativa",
  },
  {
    id: "camp-verao",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    nome: "Linha de Verão",
    descricao: null,
    dataInicio: dia(-90),
    dataFim: dia(-30),
    status: "finalizada",
  },
  {
    id: "camp-natal",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    nome: "Natal 2026",
    descricao: null,
    dataInicio: dia(60),
    dataFim: dia(95),
    status: "planejamento",
  },
];

function entregavel(
  parcial: Partial<EntregavelDoPortal> & { id: string; nome: string },
): EntregavelDoPortal {
  return {
    campanhaId: "camp-wave",
    paiId: null,
    descricao: null,
    ordem: 0,
    status: "em_producao",
    prazo: dia(3),
    arteUrl: null,
    thumbnailUrl: null,
    arquivoNome: null,
    versaoAtual: 1,
    enviadoEm: null,
    rodadaPendenteId: null,
    decididoPor: null,
    decididoEm: null,
    motivo: null,
    esperandoDesde: null,
    ...parcial,
  };
}

const ENXOVAL = [
  "Lâmina customizável A5",
  "Precificador editável",
  "Precificador não editável",
  "Banner A5 editável",
  "Banner A5 não editável",
];

const DA_WAVE: EntregavelDoPortal[] = [
  entregavel({
    id: "d-kv",
    nome: "KV",
    descricao: "A chave visual da campanha.",
    ordem: 0,
    status: "aprovado",
    arteUrl: "/exemplos/arte-1.svg",
    thumbnailUrl: "/exemplos/arte-1.svg",
    arquivoNome: "kv-outubro-rosa.pdf",
    prazo: dia(-19),
    enviadoEm: dia(-20),
    decididoPor: "Joana Prado",
    decididoEm: `${dia(-19)}T14:20:00.000Z`,
    versaoAtual: 2,
  }),

  entregavel({ id: "d-enxoval", nome: "Enxoval", ordem: 1, prazo: dia(-12) }),

  ...ENXOVAL.map((nome, i) =>
    entregavel({
      id: `d-enx-${i}`,
      nome,
      paiId: "d-enxoval",
      ordem: i,
      prazo: dia(-12),
      arteUrl: "/exemplos/arte-1.svg",
      thumbnailUrl: "/exemplos/arte-1.svg",
      enviadoEm: dia(-10),
      ...(i < 3
        ? {
            status: "aprovado" as const,
            decididoPor: "Joana Prado",
            decididoEm: `${dia(-8)}T10:00:00.000Z`,
          }
        : i === 3
          ? {
              status: "rejeitado" as const,
              decididoPor: "Joana Prado",
              decididoEm: `${dia(-7)}T16:40:00.000Z`,
              motivo:
                "O logo ficou pequeno demais no rodapé. Não dá para usar assim.",
            }
          : {
              status: "em_aprovacao" as const,
              rodadaPendenteId: "r-enx-4",
              esperandoDesde: `${dia(-3)}T09:00:00.000Z`,
            }),
    }),
  ),

  entregavel({ id: "d-feed", nome: "Feed/Storys", ordem: 2, prazo: dia(2) }),

  ...Array.from({ length: 6 }, (_, i) =>
    entregavel({
      id: `d-feed-${i}`,
      nome: `Feed/Story ${i + 1}`,
      paiId: "d-feed",
      ordem: i,
      prazo: dia(2),
      arteUrl: "/exemplos/arte-3.svg",
      thumbnailUrl: "/exemplos/arte-3.svg",
      enviadoEm: dia(-9),
      ...(i < 4
        ? {
            status: "aprovado" as const,
            decididoPor: "Joana Prado",
            decididoEm: `${dia(-6)}T11:30:00.000Z`,
          }
        : {
            status: "em_aprovacao" as const,
            rodadaPendenteId: `r-feed-${i}`,
            esperandoDesde: `${dia(-2)}T08:15:00.000Z`,
          }),
    }),
  ),

  entregavel({
    id: "d-tabloide",
    nome: "Tabloide",
    ordem: 3,
    status: "aprovado",
    prazo: dia(-15),
    arteUrl: "/exemplos/arte-2.svg",
    thumbnailUrl: "/exemplos/arte-2.svg",
    arquivoNome: "tabloide-outubro.pdf",
    enviadoEm: dia(-14),
    decididoPor: "Joana Prado",
    decididoEm: `${dia(-11)}T09:05:00.000Z`,
  }),
];

export async function campanhasDoCliente(
  _clienteId?: string,
): Promise<CampanhaDoPortal[]> {
  return CAMPANHAS;
}

export async function obterCampanha(
  id: string,
  _clienteId?: string,
): Promise<CampanhaDoPortal | null> {
  return CAMPANHAS.find((c) => c.id === id) ?? CAMPANHAS[0] ?? null;
}

export async function entregaveisDaCampanha(
  campanhaId: string,
): Promise<EntregavelDoPortal[]> {
  return campanhaId === "camp-wave" ? DA_WAVE : [];
}

export async function obterEntregavel(
  id: string,
): Promise<EntregavelDoPortal | null> {
  return DA_WAVE.find((d) => d.id === id) ?? null;
}

export async function versoesDoEntregavel(
  id: string,
): Promise<VersaoDoConteudo[]> {
  if (id !== "d-kv") return [];

  return [
    {
      id: "v2",
      numero: 2,
      arteUrl: "/exemplos/arte-1.svg",
      texto: "kv-outubro-rosa.pdf",
      notas: "Logo maior e a faixa rosa mais alta",
      quando: new Date(HOJE.getTime() - 20 * 864e5).toISOString(),
      quem: "Bruno Lima",
    },
    {
      id: "v1",
      numero: 1,
      arteUrl: "/exemplos/arte-3.svg",
      texto: "kv-outubro-rosa-v1.pdf",
      notas: "Primeira proposta",
      quando: new Date(HOJE.getTime() - 23 * 864e5).toISOString(),
      quem: "Bruno Lima",
    },
  ];
}

export async function urlsDosArquivos(
  _caminhos: (string | null)[],
): Promise<Record<string, string>> {
  return {};
}

export type TemplateDeCampanha = {
  id: string;
  nome: string;
  descricao: string | null;
  estrutura: EstruturaDeTemplate;
  clienteId: string | null;
};

export async function templatesDeCampanha(
  _clienteId?: string,
): Promise<TemplateDeCampanha[]> {
  return [
    {
      id: "00000000-0000-0000-0000-0000000000t1",
      nome: "Wave Outubro Rosa",
      descricao: "A estrutura completa de uma Wave.",
      estrutura: [
        { nome: "KV" },
        {
          nome: "Enxoval",
          itens: ENXOVAL.map((nome) => ({ nome })),
        },
        { nome: "Feed/Storys", itens: [], quantidade: 15 },
        { nome: "Tabloide" },
      ],
      clienteId: null,
    },
  ];
}
