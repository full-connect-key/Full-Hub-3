import "server-only";

import { ouFalha } from "./consulta";

import { cache } from "react";

import { situacaoDoLancamento } from "@/lib/dominio/financeiro";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  FinanceCategory,
  FinanceEntry,
  FinStatus,
} from "@/lib/supabase/database.types";

/**
 * OS GASTOS DA AGÊNCIA (0095).
 *
 * Até a 0095 esta camada lia receita e despesa, cruzava as duas com as horas
 * da equipe e montava o DRE. A receita saiu do produto — decisão do usuário —,
 * e o que ficou é a tabela de gasto: `finance_entries` com categoria,
 * competência, vencimento, pagamento e fornecedor.
 *
 * SÓ O SÓCIO CHEGA AQUI. Esta camada não repete a regra — a RLS de
 * `finance_categories` e `finance_entries` fecha em `is_socio()`, e é ela que
 * vale. O que o código garante é não haver uma segunda porta: nenhuma função
 * daqui é chamada por tela que não seja `/painel/financeiro`, e nenhuma aceita
 * um id de usuário por parâmetro.
 */

export type LancamentoComRelacoes = FinanceEntry & {
  cliente: { id: string; nome_empresa: string } | null;
  categoria: { id: string; nome: string } | null;
  /** A situação depois do atraso derivado. Nunca é igual a `status` por acaso. */
  situacao: FinStatus;
};

/** Junta as relações de uma leva de lançamentos, numa consulta por tabela. */
async function comRelacoes(
  entradas: FinanceEntry[],
  hojeISO: string,
): Promise<LancamentoComRelacoes[]> {
  if (entradas.length === 0) return [];
  const supabase = await criarClienteServidor();

  const idsDeClientes = [...new Set(entradas.map((e) => e.client_id).filter(Boolean))] as string[];
  const idsDeCategorias = [
    ...new Set(entradas.map((e) => e.category_id).filter(Boolean)),
  ] as string[];

  // O RAMO VAZIO FICA FORA DO `Promise.all` e não como um `Promise.resolve({
  // data: [] })` dentro dele: o tipo que `ouFalha` devolveria é a UNIÃO dos dois
  // ramos, e o TypeScript a resolve para `never` — com o erro saindo blocos
  // abaixo, num lugar que não tem nada a ver com a consulta.
  const [clientes, categorias] = await Promise.all([
    idsDeClientes.length
      ? supabase
          .from("clients")
          .select("id, nome_empresa")
          .in("id", idsDeClientes)
          .then((r) => ouFalha("as empresas dos lançamentos", r))
      : Promise.resolve([]),
    idsDeCategorias.length
      ? supabase
          .from("finance_categories")
          .select("id, nome")
          .in("id", idsDeCategorias)
          .then((r) => ouFalha("as categorias dos lançamentos", r))
      : Promise.resolve([]),
  ]);

  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  const porCategoria = new Map(categorias.map((c) => [c.id, c]));

  return entradas.map((entrada) => ({
    ...entrada,
    cliente: entrada.client_id ? (porCliente.get(entrada.client_id) ?? null) : null,
    categoria: entrada.category_id ? (porCategoria.get(entrada.category_id) ?? null) : null,
    situacao: situacaoDoLancamento(entrada, hojeISO),
  }));
}

/**
 * As categorias de gasto.
 *
 * Sem `.order("tipo")`: a coluna saiu na 0095, e a unicidade passou a ser o
 * nome. Ordenar por uma coluna que não existe faz o PostgREST recusar o
 * `select` INTEIRO — e a leitura voltaria vazia, que é indistinguível de "a
 * agência não tem categoria nenhuma".
 */
export const listarCategorias = cache(async (): Promise<FinanceCategory[]> => {
  const supabase = await criarClienteServidor();
  return ouFalha(
    "as categorias do Financeiro",
    await supabase.from("finance_categories").select("*").order("nome"),
  );
});

/** Os gastos de uma competência. */
export async function lancamentosDaCompetencia(
  competencia: string,
  hojeISO: string,
): Promise<LancamentoComRelacoes[]> {
  const supabase = await criarClienteServidor();
  const data = ouFalha(
    "os lançamentos da competência",
    await supabase
      .from("finance_entries")
      .select("*")
      .eq("competencia", competencia)
      .order("vencimento", { ascending: true, nullsFirst: false })
      .order("created_at"),
  );
  return comRelacoes(data, hojeISO);
}

/**
 * O que venceu e ninguém pagou, de QUALQUER competência.
 *
 * É uma consulta à parte, e não um `filter` sobre a lista do mês, porque a
 * dívida não respeita competência: a assinatura de março que ninguém pagou
 * continua sendo dinheiro que a agência deve, e em setembro ela não está na
 * lista de setembro. Sem esta consulta a tela mostraria "nada atrasado" num
 * mês em que há seis meses de atraso logo atrás — uma afirmação falsa com toda
 * a confiança.
 *
 * O recorte é o do banco e não o derivado: `situacaoDoLancamento()` responde
 * sobre uma linha que já está na mão, e aqui a pergunta é qual linha trazer.
 */
export async function gastosVencidos(hojeISO: string): Promise<LancamentoComRelacoes[]> {
  const supabase = await criarClienteServidor();
  const data = ouFalha(
    "os gastos vencidos",
    await supabase
      .from("finance_entries")
      .select("*")
      .is("pagamento", null)
      .neq("status", "cancelado")
      .not("vencimento", "is", null)
      .lt("vencimento", hojeISO)
      .order("vencimento"),
  );
  return comRelacoes(data, hojeISO);
}
