/**
 * Versao de prototipo de src/lib/dados/portal.ts.
 *
 * Tres materiais, e eles cobrem os tres casos que a tela precisa mostrar: um
 * vencido (no vermelho), um desta semana e um ja aprovado. Com todos iguais, o
 * prototipo nao mostraria a diferenca -- que e justamente o que se quer olhar.
 */
import type {
  Atividade,
  PreferenciasDeAviso,
  UsuarioDoCliente,
} from "../../src/lib/dados/portal";
import type { ItemDoPortal } from "../../src/lib/dominio/portal";

export type { Atividade, PreferenciasDeAviso, UsuarioDoCliente };

const HOJE = new Date();
const dia = (deslocamento: number) => {
  const data = new Date(HOJE);
  data.setDate(data.getDate() + deslocamento);
  return data.toISOString().slice(0, 10);
};

const VERDE = "aaaaaaaa-0000-0000-0000-000000000001";

export function prazosDoPortal() {
  const fim = new Date(HOJE);
  fim.setDate(fim.getDate() + ((7 - fim.getDay()) % 7));
  return { hoje: dia(0), fimDaSemana: fim.toISOString().slice(0, 10) };
}

const ITENS: ItemDoPortal[] = [
  {
    rodadaId: "r1",
    tipo: "subtask",
    conteudoId: "i1",
    titulo: "KV da campanha de verão",
    demanda: "Campanha de Instagram — linha de verão",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    status: "em_aprovacao",
    prazo: dia(0),
    enviadoEm: dia(-1),
    miniatura: null,
  },
  {
    rodadaId: "r2",
    tipo: "subtask",
    conteudoId: "i2",
    titulo: "Roteiro do reels institucional",
    demanda: "Reels institucional",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    status: "em_aprovacao",
    prazo: dia(3),
    enviadoEm: dia(-2),
    miniatura: null,
  },
  {
    rodadaId: null,
    tipo: "subtask",
    conteudoId: "i3",
    titulo: "Landing page da promoção",
    demanda: "Landing page da promoção",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    status: "aprovado",
    prazo: dia(-9),
    enviadoEm: dia(-12),
    miniatura: null,
  },
  {
    rodadaId: null,
    tipo: "subtask",
    conteudoId: "i4",
    titulo: "Adaptações para stories",
    demanda: "Campanha de Instagram — linha de verão",
    clienteId: VERDE,
    cliente: "Mundo Verde",
    status: "em_producao",
    prazo: dia(8),
    enviadoEm: dia(-1),
    miniatura: null,
  },
];

export async function itensDoPortal(
  clienteId?: string,
): Promise<ItemDoPortal[]> {
  // O filtro por empresa existe para o seletor do cabecalho. No prototipo ha
  // uma empresa so, e manter a assinatura e o que faz a tela do prototipo ser
  // a mesma tela do produto.
  return clienteId ? ITENS.filter((i) => i.clienteId === clienteId) : ITENS;
}

export async function atividadeRecente(
  _clienteId?: string,
): Promise<Atividade[]> {
  return [
    {
      id: "a1",
      acao: "Enviado para a sua aprovação",
      quando: dia(-1),
      sobre: "KV da campanha de verão",
    },
    {
      id: "a2",
      acao: "Você aprovou",
      quando: dia(-3),
      sobre: "Landing page da promoção",
    },
    {
      id: "a3",
      acao: "Você pediu ajustes",
      quando: dia(-6),
      sobre: "Roteiro do reels institucional",
    },
  ];
}

export async function registrarAcesso(
  _clienteId: string,
  _acao: "login" | "visualizou_item" | "download",
  _entidade?: { tipo: string; id: string },
): Promise<void> {}

export async function usuariosDoMeuCliente(): Promise<UsuarioDoCliente[]> {
  return [
    {
      user_id: "u1",
      nome: "Joana Verde",
      email: "joana@mundoverde.com",
      ultimo_acesso: dia(0),
    },
    {
      user_id: "u2",
      nome: "Paulo Verde",
      email: "paulo@mundoverde.com",
      ultimo_acesso: dia(-4),
    },
  ];
}

export async function minhasPreferencias(): Promise<PreferenciasDeAviso> {
  return {
    novo_conteudo: true,
    novo_comentario: true,
    lembrete_pendencias: false,
    frequencia: "diario",
  };
}
