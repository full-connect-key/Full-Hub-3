import "server-only";

import { cache } from "react";

import {
  competenciaDe,
  contratoCobraEm,
  deslocarCompetencia,
  foiRealizado,
  situacaoDoLancamento,
  ultimasCompetencias,
  VEZES_POR_ANO,
} from "@/lib/dominio/financeiro";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  Contract,
  FinanceCategory,
  FinanceEntry,
  FinStatus,
} from "@/lib/supabase/database.types";

/**
 * O financeiro da agência.
 *
 * SÓ O SÓCIO CHEGA AQUI. Esta camada não repete a regra — a RLS de
 * `contracts`, `finance_categories` e `finance_entries` fecha em
 * `is_socio()`, e é ela que vale. O que o código garante é não haver uma
 * segunda porta: nenhuma função daqui é chamada por tela que não seja
 * `/painel/financeiro`, e nenhuma aceita um id de usuário por parâmetro.
 */

export type LancamentoComRelacoes = FinanceEntry & {
  cliente: { id: string; nome_empresa: string } | null;
  categoria: { id: string; nome: string } | null;
  contrato: { id: string; nome: string } | null;
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
  const idsDeContratos = [
    ...new Set(entradas.map((e) => e.contract_id).filter(Boolean)),
  ] as string[];

  const [{ data: clientes }, { data: categorias }, { data: contratos }] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    idsDeCategorias.length
      ? supabase.from("finance_categories").select("id, nome").in("id", idsDeCategorias)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    idsDeContratos.length
      ? supabase.from("contracts").select("id, nome").in("id", idsDeContratos)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porCategoria = new Map((categorias ?? []).map((c) => [c.id, c]));
  const porContrato = new Map((contratos ?? []).map((c) => [c.id, c]));

  return entradas.map((entrada) => ({
    ...entrada,
    cliente: entrada.client_id ? (porCliente.get(entrada.client_id) ?? null) : null,
    categoria: entrada.category_id ? (porCategoria.get(entrada.category_id) ?? null) : null,
    contrato: entrada.contract_id ? (porContrato.get(entrada.contract_id) ?? null) : null,
    situacao: situacaoDoLancamento(entrada, hojeISO),
  }));
}

export const listarCategorias = cache(async (): Promise<FinanceCategory[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("finance_categories")
    .select("*")
    .order("tipo")
    .order("nome");
  return data ?? [];
});

export type ContratoComCliente = Contract & {
  cliente: { id: string; nome_empresa: string } | null;
};

export const listarContratos = cache(async (): Promise<ContratoComCliente[]> => {
  const supabase = await criarClienteServidor();
  const { data: contratos } = await supabase
    .from("contracts")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome");

  const lista = contratos ?? [];
  if (lista.length === 0) return [];

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .in("id", [...new Set(lista.map((c) => c.client_id))]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  return lista.map((contrato) => ({
    ...contrato,
    cliente: porCliente.get(contrato.client_id) ?? null,
  }));
});

/** Os lançamentos de uma competência. */
export async function lancamentosDaCompetencia(
  competencia: string,
  hojeISO: string,
): Promise<LancamentoComRelacoes[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("finance_entries")
    .select("*")
    .eq("competencia", competencia)
    .order("vencimento", { ascending: true, nullsFirst: false })
    .order("created_at");
  return comRelacoes(data ?? [], hojeISO);
}

/**
 * Os lançamentos de um intervalo de competências, para a lista filtrada.
 *
 * O filtro por texto, tipo, cliente, categoria e situação é aplicado na tela,
 * sobre o que voltou: o período já limita o volume, e filtrar na memória
 * mantém os contadores e a lista concordando — eles olham o mesmo array.
 */
export async function lancamentosDoPeriodo(
  deCompetencia: string,
  ateCompetencia: string,
  hojeISO: string,
): Promise<LancamentoComRelacoes[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("finance_entries")
    .select("*")
    .gte("competencia", deCompetencia)
    .lte("competencia", ateCompetencia)
    .order("competencia", { ascending: false })
    .order("vencimento", { ascending: true, nullsFirst: false });
  return comRelacoes(data ?? [], hojeISO);
}

// ---------------------------------------------------------------------------
// A visão geral
// ---------------------------------------------------------------------------

export type PontoDoMes = { competencia: string; receita: number; despesa: number };

export type Alerta = {
  tipo: "vence" | "atrasado" | "contrato-terminando";
  titulo: string;
  detalhe: string;
  valor: number | null;
  data: string;
};

export type VisaoGeral = {
  competencia: string;
  receitaPrevista: number;
  receitaRealizada: number;
  despesaPrevista: number;
  despesaRealizada: number;
  /** Previsto menos previsto. O realizado tem o seu par logo abaixo. */
  resultadoPrevisto: number;
  resultadoRealizado: number;
  /** Vencido e não pago, de QUALQUER competência — dívida não respeita mês. */
  inadimplencia: number;
  quantosInadimplentes: number;
  /** O que os contratos ativos somam por mês. */
  receitaRecorrente: number;
  serie: PontoDoMes[];
  porCliente: { nome: string; valor: number }[];
  alertas: Alerta[];
};

/**
 * Tudo o que a aba Visão Geral mostra, numa passada.
 *
 * Um cartão, dois gráficos e a lista de alertas são cinco arranjos dos mesmos
 * lançamentos. Com cinco consultas eles poderiam discordar entre si sobre o
 * mesmo título — a mesma razão pela qual `panoramaDeSkills()` existe.
 */
export async function visaoGeralDoMes(
  competencia: string,
  hojeISO: string,
): Promise<VisaoGeral> {
  const supabase = await criarClienteServidor();

  const inicioDaSerie = deslocarCompetencia(competencia, -11);

  const [{ data: doPeriodo }, { data: emAberto }, contratos] = await Promise.all([
    // Doze meses para a série, e o mês escolhido está dentro dela.
    supabase
      .from("finance_entries")
      .select("*")
      .gte("competencia", inicioDaSerie)
      .lte("competencia", competencia),
    // A inadimplência ignora competência: um título de março ainda não pago
    // continua sendo dinheiro que a agência não recebeu.
    supabase
      .from("finance_entries")
      .select("*")
      .is("pagamento", null)
      .neq("status", "cancelado")
      .not("vencimento", "is", null),
    listarContratos(),
  ]);

  const periodo = doPeriodo ?? [];
  const doMes = periodo.filter((e) => e.competencia === competencia && e.status !== "cancelado");

  const somar = (lista: FinanceEntry[]) => lista.reduce((total, e) => total + Number(e.valor), 0);

  const receitas = doMes.filter((e) => e.tipo === "receita");
  const despesas = doMes.filter((e) => e.tipo === "despesa");

  const receitaPrevista = somar(receitas);
  const receitaRealizada = somar(receitas.filter(foiRealizado));
  const despesaPrevista = somar(despesas);
  const despesaRealizada = somar(despesas.filter(foiRealizado));

  // --- A série de 12 meses
  const meses = ultimasCompetencias(competencia, 12);
  const serie: PontoDoMes[] = meses.map((mes) => {
    const daquele = periodo.filter((e) => e.competencia === mes && e.status !== "cancelado");
    return {
      competencia: mes,
      receita: somar(daquele.filter((e) => e.tipo === "receita")),
      despesa: somar(daquele.filter((e) => e.tipo === "despesa")),
    };
  });

  // --- Receita por cliente no mês
  const idsDeClientes = [...new Set(receitas.map((e) => e.client_id).filter(Boolean))] as string[];
  const { data: clientes } = idsDeClientes.length
    ? await supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
    : { data: [] as { id: string; nome_empresa: string }[] };
  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));

  const acumuladoPorCliente = new Map<string, number>();
  for (const receita of receitas) {
    // Receita sem cliente existe (juro, venda de equipamento) e não pode
    // sumir do gráfico só por não ter dono.
    const nome = receita.client_id
      ? (nomeDoCliente.get(receita.client_id) ?? "Cliente removido")
      : "Sem cliente";
    acumuladoPorCliente.set(nome, (acumuladoPorCliente.get(nome) ?? 0) + Number(receita.valor));
  }
  const porCliente = [...acumuladoPorCliente.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  // --- Inadimplência e alertas
  const vencidos = (emAberto ?? []).filter(
    (e) => e.vencimento !== null && e.vencimento < hojeISO && e.tipo === "receita",
  );
  const inadimplencia = somar(vencidos);

  const daquiA7 = somarDias(hojeISO, 7);
  const vencendo = (emAberto ?? []).filter(
    (e) => e.vencimento !== null && e.vencimento >= hojeISO && e.vencimento <= daquiA7,
  );

  const daquiA60 = somarDias(hojeISO, 60);

  const alertas: Alerta[] = [
    ...vencidos.slice(0, 8).map((e) => ({
      tipo: "atrasado" as const,
      titulo: e.descricao,
      detalhe: `Venceu em ${formatarBR(e.vencimento!)}`,
      valor: Number(e.valor),
      data: e.vencimento!,
    })),
    ...vencendo.slice(0, 8).map((e) => ({
      tipo: "vence" as const,
      titulo: e.descricao,
      detalhe: `${e.tipo === "receita" ? "Recebe" : "Paga"} em ${formatarBR(e.vencimento!)}`,
      valor: Number(e.valor),
      data: e.vencimento!,
    })),
    ...contratos
      .filter((c) => c.ativo && c.data_fim && c.data_fim >= hojeISO && c.data_fim <= daquiA60)
      .map((c) => ({
        tipo: "contrato-terminando" as const,
        titulo: c.nome,
        detalhe: `${c.cliente?.nome_empresa ?? "Cliente removido"} — termina em ${formatarBR(c.data_fim!)}`,
        valor: Number(c.valor),
        data: c.data_fim!,
      })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  /**
   * A receita recorrente é o valor MENSALIZADO dos contratos ativos, não a
   * soma crua: um contrato anual de R$ 120 mil não são R$ 120 mil por mês.
   * Contrato pontual não entra — ele não se repete, e por isso não é receita
   * recorrente por definição.
   */
  const receitaRecorrente = contratos
    .filter((c) => c.ativo && VEZES_POR_ANO[c.recorrencia] > 0)
    .filter((c) => !c.data_fim || c.data_fim >= hojeISO)
    .reduce((total, c) => total + (Number(c.valor) * VEZES_POR_ANO[c.recorrencia]) / 12, 0);

  return {
    competencia,
    receitaPrevista,
    receitaRealizada,
    despesaPrevista,
    despesaRealizada,
    resultadoPrevisto: receitaPrevista - despesaPrevista,
    resultadoRealizado: receitaRealizada - despesaRealizada,
    inadimplencia,
    quantosInadimplentes: vencidos.length,
    receitaRecorrente,
    serie,
    porCliente,
    alertas,
  };
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

export type LinhaDoDRE = { categoria: string; valor: number };

export type DRE = {
  receitas: LinhaDoDRE[];
  despesas: LinhaDoDRE[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
};

export type RentabilidadeDoCliente = {
  clientId: string | null;
  nome: string;
  receita: number;
  minutos: number;
  /** Nulo quando não há hora lançada — dividir por zero daria Infinity. */
  receitaPorHora: number | null;
};

/**
 * O DRE e a rentabilidade por cliente, no período escolhido.
 *
 * RENTABILIDADE CRUZA RECEITA COM O TEMPO DAS SUBTAREFAS, e não com um campo
 * da task: `tasks` não tem `tempo_real_horas` desde o Sprint 3B — quem tem
 * tempo é a subtarefa, em `tempo_real_minutos`. O sprint pedia a coluna
 * antiga; ressuscitá-la contrariaria a regra de que nenhuma consulta pode
 * trazer essas colunas de volta, e o número sairia zerado de qualquer jeito.
 *
 * O tempo é contado pela data de CONCLUSÃO da subtarefa, não pela competência
 * do lançamento: o que se quer saber é quantas horas a casa gastou naquele
 * cliente enquanto faturava aquilo dele.
 */
export async function relatorioDoPeriodo(
  deCompetencia: string,
  ateCompetencia: string,
): Promise<{ dre: DRE; rentabilidade: RentabilidadeDoCliente[] }> {
  const supabase = await criarClienteServidor();

  const inicio = deCompetencia;
  // O fim do intervalo em DIAS é o último dia do mês da competência final.
  const fimEmDias = ultimoDiaDoMes(ateCompetencia);

  const [{ data: entradas }, { data: categorias }] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("*")
      .gte("competencia", inicio)
      .lte("competencia", ateCompetencia)
      .neq("status", "cancelado"),
    supabase.from("finance_categories").select("id, nome"),
  ]);

  const lista = entradas ?? [];
  const nomeDaCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nome]));

  const agrupar = (tipo: "receita" | "despesa"): LinhaDoDRE[] => {
    const mapa = new Map<string, number>();
    for (const entrada of lista.filter((e) => e.tipo === tipo)) {
      const nome = entrada.category_id
        ? (nomeDaCategoria.get(entrada.category_id) ?? "Sem categoria")
        : "Sem categoria";
      mapa.set(nome, (mapa.get(nome) ?? 0) + Number(entrada.valor));
    }
    return [...mapa.entries()]
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  };

  const receitas = agrupar("receita");
  const despesas = agrupar("despesa");
  const totalReceitas = receitas.reduce((t, l) => t + l.valor, 0);
  const totalDespesas = despesas.reduce((t, l) => t + l.valor, 0);

  // --- As horas gastas em cada cliente no período
  const { data: subtarefas } = await supabase
    .from("subtasks")
    .select("task_id, tempo_real_minutos, updated_at")
    .eq("status", "concluida")
    .not("tempo_real_minutos", "is", null)
    .gte("updated_at", inicio)
    .lte("updated_at", `${fimEmDias}T23:59:59`);

  const listaDeSubtarefas = subtarefas ?? [];
  const idsDeTasks = [...new Set(listaDeSubtarefas.map((s) => s.task_id))];

  const { data: tasks } = idsDeTasks.length
    ? await supabase.from("tasks").select("id, client_id").in("id", idsDeTasks)
    : { data: [] as { id: string; client_id: string | null }[] };
  const clienteDaTask = new Map((tasks ?? []).map((t) => [t.id, t.client_id]));

  const minutosPorCliente = new Map<string, number>();
  for (const subtarefa of listaDeSubtarefas) {
    const clientId = clienteDaTask.get(subtarefa.task_id) ?? null;
    if (!clientId) continue;
    minutosPorCliente.set(
      clientId,
      (minutosPorCliente.get(clientId) ?? 0) + (subtarefa.tempo_real_minutos ?? 0),
    );
  }

  // --- Receita por cliente no período
  const receitaPorCliente = new Map<string, number>();
  for (const entrada of lista.filter((e) => e.tipo === "receita" && e.client_id)) {
    receitaPorCliente.set(
      entrada.client_id!,
      (receitaPorCliente.get(entrada.client_id!) ?? 0) + Number(entrada.valor),
    );
  }

  const idsEnvolvidos = [
    ...new Set([...receitaPorCliente.keys(), ...minutosPorCliente.keys()]),
  ];
  const { data: clientes } = idsEnvolvidos.length
    ? await supabase.from("clients").select("id, nome_empresa").in("id", idsEnvolvidos)
    : { data: [] as { id: string; nome_empresa: string }[] };
  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));

  const rentabilidade: RentabilidadeDoCliente[] = idsEnvolvidos
    .map((clientId) => {
      const receita = receitaPorCliente.get(clientId) ?? 0;
      const minutos = minutosPorCliente.get(clientId) ?? 0;
      return {
        clientId,
        nome: nomeDoCliente.get(clientId) ?? "Cliente removido",
        receita,
        minutos,
        // Sem hora lançada não há receita por hora — e um zero ali seria uma
        // afirmação falsa sobre a conta, em vez de "não medimos".
        receitaPorHora: minutos > 0 ? receita / (minutos / 60) : null,
      };
    })
    .sort((a, b) => (b.receitaPorHora ?? -1) - (a.receitaPorHora ?? -1));

  return {
    dre: { receitas, despesas, totalReceitas, totalDespesas, resultado: totalReceitas - totalDespesas },
    rentabilidade,
  };
}

/**
 * Os contratos que ainda NÃO têm lançamento nesta competência.
 *
 * É o que "Gerar lançamentos do mês" cria. A trava contra duplicata é o índice
 * único `(contract_id, competencia)` no banco — esta consulta existe para a
 * tela poder dizer quantos vai criar antes de criar.
 */
export async function contratosSemLancamento(
  competencia: string,
): Promise<ContratoComCliente[]> {
  const supabase = await criarClienteServidor();

  const [contratos, { data: jaGerados }] = await Promise.all([
    listarContratos(),
    supabase
      .from("finance_entries")
      .select("contract_id")
      .eq("competencia", competencia)
      .not("contract_id", "is", null),
  ]);

  const gerados = new Set((jaGerados ?? []).map((e) => e.contract_id));

  return contratos.filter(
    (contrato) => contratoCobraEm(contrato, competencia) && !gerados.has(contrato.id),
  );
}

// ---------------------------------------------------------------------------
// Datas, sem date-fns: aqui são strings ISO o tempo todo
// ---------------------------------------------------------------------------

function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

function ultimoDiaDoMes(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${ultimo}`;
}

function formatarBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export { competenciaDe };
