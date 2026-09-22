/**
 * Versao de prototipo de src/lib/dados/notificacoes.ts.
 *
 * Tres avisos, um deles ja lido: o sino precisa mostrar o contador, a bolinha
 * de nao lido e a diferenca visual entre os dois estados. So com os tres da
 * para ver se a tela distingue.
 */
import type { NotificacaoNaTela } from "../../src/lib/dados/notificacoes";

export type { NotificacaoNaTela };

const DIEGO = {
  id: "a0000000-0000-0000-0000-000000000002",
  nome: "Diego Reis",
  avatar_url: null,
};

const MARINA = {
  id: "a0000000-0000-0000-0000-000000000006",
  nome: "Marina Costa",
  avatar_url: null,
};

const AVISOS: NotificacaoNaTela[] = [
  {
    id: "n1",
    user_id: "a0000000-0000-0000-0000-000000000001",
    tipo: "full_days",
    titulo: "Marina Costa pediu férias",
    corpo: "5 dias úteis, esperando sua decisão.",
    link: "/painel/full-days?aba=aprovacoes",
    origem_id: MARINA.id,
    lida_em: null,
    created_at: agoraMenos(40),
    origem: MARINA,
  },
  {
    id: "n2",
    user_id: "a0000000-0000-0000-0000-000000000001",
    tipo: "aprovacao",
    titulo: "Arte do post está esperando aprovação",
    corpo: "Campanha de outubro — Mundo Verde.",
    link: "/painel/aprovacoes-internas",
    origem_id: DIEGO.id,
    lida_em: null,
    created_at: agoraMenos(5 * 60),
    origem: DIEGO,
  },
  {
    id: "n3",
    user_id: "a0000000-0000-0000-0000-000000000001",
    tipo: "task",
    titulo: "Bruno Lima concluiu “Criar KV”",
    corpo: null,
    link: "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111",
    origem_id: null,
    lida_em: agoraMenos(20 * 60),
    created_at: agoraMenos(26 * 60),
    origem: null,
  },
];

function agoraMenos(minutos: number): string {
  return new Date(Date.now() - minutos * 60 * 1000).toISOString();
}

export async function minhasNotificacoes(): Promise<{
  lista: NotificacaoNaTela[];
  naoLidas: number;
}> {
  return { lista: AVISOS, naoLidas: AVISOS.filter((a) => a.lida_em === null).length };
}
