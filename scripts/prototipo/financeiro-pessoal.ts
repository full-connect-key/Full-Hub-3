/**
 * Versao de prototipo de src/lib/dados/financeiro-pessoal.ts.
 *
 * `temAlgumLancamento` devolve TRUE: o aviso de primeira visita tem tela
 * propria na captura (quem nunca lancou nada), e deixa-lo sempre aberto
 * esconderia o resto da tela em toda imagem.
 */
import type { MesPessoal } from "../../src/lib/dados/financeiro-pessoal";
import type { PersonalFinanceEntry } from "../../src/lib/supabase/database.types";
import { ultimasCompetencias } from "../../src/lib/dominio/financeiro";

export type { MesPessoal };

function diaDoMes(dia: number): string {
  const hoje = new Date().toISOString().slice(0, 7);
  return `${hoje}-${String(dia).padStart(2, "0")}`;
}

const LANCAMENTOS: PersonalFinanceEntry[] = [
  { id: "pf-1", user_id: "u1", tipo: "entrada", descricao: "Salário", categoria: "Renda", valor: 5800, data: diaDoMes(5), recorrente: true, created_at: "" },
  { id: "pf-2", user_id: "u1", tipo: "saida", descricao: "Aluguel", categoria: "Moradia", valor: 1650, data: diaDoMes(10), recorrente: true, created_at: "" },
  { id: "pf-3", user_id: "u1", tipo: "saida", descricao: "Mercado do mês", categoria: "Alimentação", valor: 820, data: diaDoMes(12), recorrente: true, created_at: "" },
  { id: "pf-4", user_id: "u1", tipo: "saida", descricao: "Plano de saúde", categoria: "Saúde", valor: 410, data: diaDoMes(8), recorrente: true, created_at: "" },
  { id: "pf-5", user_id: "u1", tipo: "saida", descricao: "Transporte", categoria: "Transporte", valor: 260, data: diaDoMes(15), recorrente: false, created_at: "" },
  { id: "pf-6", user_id: "u1", tipo: "saida", descricao: "Cinema e jantar", categoria: "Lazer", valor: 180, data: diaDoMes(18), recorrente: false, created_at: "" },
];

export async function lancamentosDoMes(competencia: string): Promise<PersonalFinanceEntry[]> {
  void competencia;
  return [...LANCAMENTOS].sort((a, b) => b.data.localeCompare(a.data));
}

export async function saldoDosUltimosMeses(
  competencia: string,
  quantos = 6,
): Promise<MesPessoal[]> {
  // Um mes NEGATIVO de proposito: o grafico divergente so se valida com os
  // dois lados do zero preenchidos.
  const saldos = [
    { entradas: 5800, saidas: 4600 },
    { entradas: 5800, saidas: 6250 },
    { entradas: 5800, saidas: 4910 },
    { entradas: 7200, saidas: 5100 },
    { entradas: 5800, saidas: 6120 },
    { entradas: 5800, saidas: 3320 },
  ];
  return ultimasCompetencias(competencia, quantos).map((mes, i) => {
    const { entradas, saidas } = saldos[i % saldos.length];
    return { competencia: mes, entradas, saidas, saldo: entradas - saidas };
  });
}

export async function saidasPorCategoria(
  competencia: string,
): Promise<{ nome: string; valor: number }[]> {
  void competencia;
  return [
    { nome: "Moradia", valor: 1650 },
    { nome: "Alimentação", valor: 820 },
    { nome: "Saúde", valor: 410 },
    { nome: "Transporte", valor: 260 },
    { nome: "Lazer", valor: 180 },
  ];
}

export async function recorrentesParaReplicar(
  competencia: string,
): Promise<PersonalFinanceEntry[]> {
  void competencia;
  return LANCAMENTOS.filter((l) => l.recorrente);
}

export async function historicoParaExportar(): Promise<PersonalFinanceEntry[]> {
  return LANCAMENTOS;
}

export async function temAlgumLancamento(): Promise<boolean> {
  return true;
}
