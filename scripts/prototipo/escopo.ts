/**
 * O escopo do contrato de exemplo (migration 0149).
 *
 * **A MUNDO VERDE TEM CONTRATO E A ÓPTICA VISÃO NÃO TEM**, de propósito: o
 * bloco do portal SOME quando a conta não tem item nenhum, e medido em
 * produção é o estado de todas as 21 contas ativas hoje. Com as duas
 * cadastradas, nenhuma imagem mostraria a ausência — a lição da Óptica Visão
 * sem atendente (0062) e da duplicata do Cronograma.
 *
 * **SÃO OS QUATRO ESTADOS QUE A LINHA DISTINGUE**, e é por isso que são
 * quatro itens e não um:
 *
 *   em aberto  — 7 de 12, o caso comum
 *   quase      — 5 de 6, o âmbar
 *   além       — 14 de 12, com a observação que explica
 *   sem lançar — 0 de 2, o começo de todo mês
 *
 * Com os quatro iguais, a imagem provaria que a barra aparece e não que ela
 * DISTINGUE, que é a razão do evento de cada par da legenda do calendário.
 *
 * **E O ÚLTIMO ESTÁ DESATIVADO**: ele é o único jeito de a ficha provar que a
 * lista distingue o item ativo do aposentado, e de o portal provar que o
 * aposentado não aparece lá.
 */
import { montarLinhas, type LinhaDoEscopo } from "@/lib/dominio/escopo";
import type { Database } from "@/lib/supabase/database.types";

type Item = Database["public"]["Tables"]["client_scope_items"]["Row"];
type Consumo = Database["public"]["Tables"]["client_scope_usage"]["Row"];

const MUNDO_VERDE = "c0000000-0000-0000-0000-00000000000a";

const base = {
  client_id: MUNDO_VERDE,
  ativo: true,
  created_at: "2026-01-10T10:00:00.000Z",
  updated_at: "2026-01-10T10:00:00.000Z",
};

export const ITENS_DO_ESCOPO_EXEMPLO: Item[] = [
  { ...base, id: "f1000000-0000-0000-0000-000000000001", descricao: "Posts no feed", quantidade: 12, unidade: null, ordem: 10 },
  { ...base, id: "f1000000-0000-0000-0000-000000000002", descricao: "Stories", quantidade: 6, unidade: null, ordem: 20 },
  { ...base, id: "f1000000-0000-0000-0000-000000000003", descricao: "Impulsionamentos", quantidade: 12, unidade: null, ordem: 30 },
  { ...base, id: "f1000000-0000-0000-0000-000000000004", descricao: "Relatório de desempenho", quantidade: 2, unidade: null, ordem: 40 },
  { ...base, id: "f1000000-0000-0000-0000-000000000005", descricao: "Produção de vídeo", quantidade: 4, unidade: "horas", ordem: 50, ativo: false },
];

/**
 * O CONSUMO É DO MÊS CORRENTE, calculado e nunca literal.
 *
 * É a lição dos meses da nota fiscal: uma competência fixa para de ser o mês
 * corrente sozinha, e a imagem sairia com a lista inteira em "0 de N" sem
 * nada reclamar.
 */
function competenciaDeHoje(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-01`;
}

function consumo(itemId: string, usado: number, observacao: string | null): Consumo {
  return {
    id: `f2${itemId.slice(2)}`,
    item_id: itemId,
    competencia: competenciaDeHoje(),
    usado,
    observacao,
    created_at: "2026-01-10T10:00:00.000Z",
    updated_at: "2026-01-10T10:00:00.000Z",
  };
}

export const CONSUMO_DO_ESCOPO_EXEMPLO: Consumo[] = [
  consumo("f1000000-0000-0000-0000-000000000001", 7, null),
  consumo("f1000000-0000-0000-0000-000000000002", 5, null),
  consumo("f1000000-0000-0000-0000-000000000003", 14, "2 impulsionamentos extras aprovados por e-mail no dia 12."),
  // O quarto item NÃO tem linha: é o estado "ninguém lançou ainda".
];

function linhasDaConta(clienteId: string): LinhaDoEscopo[] {
  const itens = ITENS_DO_ESCOPO_EXEMPLO.filter((i) => i.client_id === clienteId);
  return montarLinhas(itens, CONSUMO_DO_ESCOPO_EXEMPLO);
}

export async function escopoDasContas(
  clienteIds: string[],
  _competencia: string,
): Promise<Map<string, LinhaDoEscopo[]>> {
  const mapa = new Map<string, LinhaDoEscopo[]>();
  for (const id of [...new Set(clienteIds.filter(Boolean))]) {
    const linhas = linhasDaConta(id);
    if (linhas.length > 0) mapa.set(id, linhas);
  }
  return mapa;
}

export async function escopoDaConta(
  clienteId: string,
  _competencia: string,
): Promise<LinhaDoEscopo[]> {
  return linhasDaConta(clienteId);
}
