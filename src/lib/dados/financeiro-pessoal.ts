import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import { deslocarCompetencia, ultimasCompetencias } from "@/lib/dominio/financeiro";
import type { PersonalFinanceEntry } from "@/lib/supabase/database.types";

/**
 * O Financeiro Pessoal de quem está logado.
 *
 * NENHUMA função daqui aceita um id de usuário por parâmetro, e isso é
 * deliberado — a mesma decisão da exportação do Resumo Semanal. A RLS de
 * `personal_finance_entries` já fecha em `auth.uid()`, mas uma função que
 * aceitasse `usuarioId` seria um convite a alguém tentar, e um dia alguém
 * tenta com o cliente de serviço na mão.
 *
 * Não existe, e não pode passar a existir, função que agregue esta tabela
 * para a gestão.
 */

export type MesPessoal = {
  competencia: string;
  entradas: number;
  saidas: number;
  saldo: number;
};

/** Os lançamentos de um mês. */
export async function lancamentosDoMes(competencia: string): Promise<PersonalFinanceEntry[]> {
  const supabase = await criarClienteServidor();
  const fim = deslocarCompetencia(competencia, 1);
  const { data } = await supabase
    .from("personal_finance_entries")
    .select("*")
    .gte("data", competencia)
    .lt("data", fim)
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Os seis meses do gráfico de saldo.
 *
 * Uma consulta só, fatiada aqui: seis consultas devolveriam os mesmos dados em
 * seis idas ao banco, e o mês em comum com a lista poderia discordar dela se
 * alguém lançasse algo no meio.
 */
export async function saldoDosUltimosMeses(
  competencia: string,
  quantos = 6,
): Promise<MesPessoal[]> {
  const supabase = await criarClienteServidor();
  const meses = ultimasCompetencias(competencia, quantos);
  const fim = deslocarCompetencia(competencia, 1);

  const { data } = await supabase
    .from("personal_finance_entries")
    .select("tipo, valor, data")
    .gte("data", meses[0])
    .lt("data", fim);

  const lista = data ?? [];

  return meses.map((mes) => {
    const doMes = lista.filter((e) => e.data.slice(0, 7) === mes.slice(0, 7));
    const entradas = doMes
      .filter((e) => e.tipo === "entrada")
      .reduce((t, e) => t + Number(e.valor), 0);
    const saidas = doMes.filter((e) => e.tipo === "saida").reduce((t, e) => t + Number(e.valor), 0);
    return { competencia: mes, entradas, saidas, saldo: entradas - saidas };
  });
}

/** As saídas do mês agrupadas por categoria, da maior para a menor. */
export async function saidasPorCategoria(
  competencia: string,
): Promise<{ nome: string; valor: number }[]> {
  const lancamentos = await lancamentosDoMes(competencia);

  const mapa = new Map<string, number>();
  for (const lancamento of lancamentos.filter((l) => l.tipo === "saida")) {
    const nome = lancamento.categoria?.trim() || "Sem categoria";
    mapa.set(nome, (mapa.get(nome) ?? 0) + Number(lancamento.valor));
  }

  return [...mapa.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Os recorrentes de um mês que ainda não foram replicados para o seguinte.
 *
 * O par que identifica "já replicado" é descrição + tipo + valor. Não há
 * coluna de origem de propósito: ela amarraria cada cópia ao mês anterior
 * para sempre, e a pessoa que editasse o valor de um aluguel veria a conta
 * quebrar. Descrição repetida no mês seguinte é o suficiente para não
 * duplicar, que é a única coisa que precisa ser verdade aqui.
 */
export async function recorrentesParaReplicar(
  competencia: string,
): Promise<PersonalFinanceEntry[]> {
  const doMes = await lancamentosDoMes(competencia);
  const recorrentes = doMes.filter((l) => l.recorrente);
  if (recorrentes.length === 0) return [];

  const proximo = deslocarCompetencia(competencia, 1);
  const doProximo = await lancamentosDoMes(proximo);

  const jaExiste = new Set(
    doProximo.map((l) => `${l.tipo}|${l.descricao.trim().toLowerCase()}|${Number(l.valor)}`),
  );

  return recorrentes.filter(
    (l) => !jaExiste.has(`${l.tipo}|${l.descricao.trim().toLowerCase()}|${Number(l.valor)}`),
  );
}

/** O histórico inteiro, para exportar. Só o de quem está logado. */
export async function historicoParaExportar(): Promise<PersonalFinanceEntry[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("personal_finance_entries")
    .select("*")
    .order("data", { ascending: false });
  return data ?? [];
}

/** Já existe algum lançamento? É o que decide se o aviso de boas-vindas aparece. */
export async function temAlgumLancamento(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { count } = await supabase
    .from("personal_finance_entries")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
