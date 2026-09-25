import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * A leitura dos indicadores da 0035.
 *
 * ---------------------------------------------------------------------------
 * `ouFalha()` EM TODAS, E AQUI ELE FAZ MAIS QUE O DE COSTUME
 *
 * As seis funções são `security definer` e recusam na PRIMEIRA linha quem não
 * pode — `is_gestor()` em cinco, `is_socio()` na rentabilidade. Essa recusa
 * chega como ERRO do PostgREST, não como lista vazia.
 *
 * Sem `ouFalha()`, `const { data } = await` jogaria a recusa fora e a tela
 * mostraria zeros: o colaborador que digitasse a URL veria um painel de
 * métricas dizendo que a agência não produziu nada. **Um painel zerado não
 * parece uma recusa, parece uma agência parada** — e é exatamente a classe de
 * bug que `ouFalha()` existe para impedir, agora numa tela onde o vazio
 * mentiria sobre a empresa inteira.
 * ---------------------------------------------------------------------------
 *
 * Nenhuma delas repete a pergunta de permissão do lado de cá. Quem decide é o
 * banco, como sempre; o que a tela faz é não OFERECER a aba que ela sabe que
 * vai levar recusa — cortesia, não trava.
 */

export type Producao = {
  criadas: number;
  concluidas: number;
  atrasadas: number;
  no_prazo: number;
  fora_do_prazo: number;
  sem_prazo: number;
  minutos_reais: number;
};

export async function producaoDoPeriodo(
  de: string,
  ate: string,
  clienteId?: string | null,
): Promise<Producao> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "producao do período",
    await supabase.rpc("producao_do_periodo", {
      p_de: de,
      p_ate: ate,
      p_client_id: clienteId ?? null,
    }),
  );

  // A função devolve UMA linha sempre — os `count(*) filter` de um `select`
  // sem `group by`. Sem nenhuma, os zeros aqui são a verdade: não houve
  // etapa no período. É diferente do vazio que `ouFalha` protege, que seria
  // a consulta ter sido recusada.
  return (
    linhas?.[0] ?? {
      criadas: 0,
      concluidas: 0,
      atrasadas: 0,
      no_prazo: 0,
      fora_do_prazo: 0,
      sem_prazo: 0,
      minutos_reais: 0,
    }
  );
}

export type TempoEmStatus = { status: string; minutos: number; ocorrencias: number };

export async function tempoPorStatus(de: string, ate: string): Promise<TempoEmStatus[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "tempo por status",
    await supabase.rpc("tempo_por_status", { p_de: de, p_ate: ate }),
  );
  return [...(linhas ?? [])].sort((a, b) => b.minutos - a.minutos);
}

export type TempoDeAprovacao = {
  escopo: string;
  cliente: string | null;
  horasMedia: number;
  rodadas: number;
  pendentes: number;
};

export async function tempoDeAprovacao(de: string, ate: string): Promise<TempoDeAprovacao[]> {
  const supabase = await criarClienteServidor();
  const [linhas, clientes] = await Promise.all([
    supabase
      .rpc("tempo_de_aprovacao", { p_de: de, p_ate: ate })
      .then((r) => ouFalha("tempo de aprovação", r)),
    nomesDeClientes(),
  ]);

  return (linhas ?? []).map((linha) => ({
    escopo: linha.escopo,
    // CLIENTE NULO É CASO NORMAL e não erro: a rodada interna de uma etapa
    // de demanda sem cliente não tem de onde tirar um. A tela escreve
    // "sem cliente", que é a verdade — não um traço que pareça dado faltando.
    cliente: linha.client_id ? (clientes.get(linha.client_id) ?? null) : null,
    horasMedia: Number(linha.horas_media ?? 0),
    rodadas: linha.rodadas,
    pendentes: linha.pendentes,
  }));
}

export type DesvioDaPessoa = {
  responsavelId: string;
  nome: string;
  etapas: number;
  minutosEstimados: number;
  minutosReais: number;
  desvioPercentual: number;
};

export async function desvioDeEstimativa(de: string, ate: string): Promise<DesvioDaPessoa[]> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "desvio de estimativa",
    await supabase.rpc("desvio_de_estimativa", { p_de: de, p_ate: ate }),
  );

  const ids = (linhas ?? []).map((l) => l.responsavel_id);
  const nomes = await nomesDePessoas(ids);

  return (linhas ?? [])
    .map((linha) => ({
      responsavelId: linha.responsavel_id,
      nome: nomes.get(linha.responsavel_id) ?? "Pessoa desligada",
      etapas: linha.etapas,
      minutosEstimados: linha.minutos_estimados,
      minutosReais: linha.minutos_reais,
      desvioPercentual: Number(linha.desvio_percentual ?? 0),
    }))
    // O MAIOR DESVIO PRIMEIRO, EM MÓDULO: quem entrega em metade do tempo
    // estimado erra o planejamento tanto quanto quem leva o dobro, e a
    // segunda conta é a que enche a agenda de todo mundo. Ordenar pelo
    // número com sinal esconderia o subestimador no fim da lista.
    .sort((a, b) => Math.abs(b.desvioPercentual) - Math.abs(a.desvioPercentual));
}

export type QualidadeDoCliente = {
  clienteId: string | null;
  cliente: string;
  conteudos: number;
  aprovadosDePrima: number;
  rodadasMedia: number;
  rejeitados: number;
};

export async function qualidadeDaEntrega(de: string, ate: string): Promise<QualidadeDoCliente[]> {
  const supabase = await criarClienteServidor();
  const [linhas, clientes] = await Promise.all([
    supabase
      .rpc("qualidade_da_entrega", { p_de: de, p_ate: ate })
      .then((r) => ouFalha("qualidade da entrega", r)),
    nomesDeClientes(),
  ]);

  return (linhas ?? [])
    .map((linha) => ({
      clienteId: linha.client_id,
      cliente: linha.client_id ? (clientes.get(linha.client_id) ?? "—") : "Sem cliente",
      conteudos: linha.conteudos,
      aprovadosDePrima: linha.aprovados_de_prima,
      rodadasMedia: Number(linha.rodadas_media ?? 0),
      rejeitados: linha.rejeitados,
    }))
    .sort((a, b) => b.conteudos - a.conteudos);
}

export type RentabilidadeDoCliente = {
  clienteId: string | null;
  cliente: string;
  receita: number;
  despesa: number;
  horas: number;
  /** NULA e não zero quando ninguém lançou hora: zero afirma sobre a conta. */
  receitaPorHora: number | null;
};

export async function rentabilidadeDoPeriodo(
  de: string,
  ate: string,
): Promise<RentabilidadeDoCliente[]> {
  const supabase = await criarClienteServidor();
  const [linhas, clientes] = await Promise.all([
    supabase
      .rpc("rentabilidade_do_periodo", { p_de: de, p_ate: ate })
      .then((r) => ouFalha("rentabilidade do período", r)),
    nomesDeClientes(),
  ]);

  return (linhas ?? [])
    .map((linha) => ({
      clienteId: linha.client_id,
      cliente: linha.client_id ? (clientes.get(linha.client_id) ?? "—") : "Sem cliente",
      receita: Number(linha.receita ?? 0),
      despesa: Number(linha.despesa ?? 0),
      horas: Number(linha.horas ?? 0),
      receitaPorHora: linha.receita_por_hora === null ? null : Number(linha.receita_por_hora),
    }))
    .sort((a, b) => b.receita - a.receita);
}

// ---------------------------------------------------------------------------
// OS NOMES
//
// As funções devolvem `client_id` e `responsavel_id` crus, e é certo: um
// indicador não é o lugar de juntar texto. Quem traduz é esta camada, numa
// consulta só por tela — e o que o RLS não deixar ler simplesmente não entra
// no mapa, virando "—" em vez de vazar um nome.
// ---------------------------------------------------------------------------

async function nomesDeClientes(): Promise<Map<string, string>> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes de clientes",
    await supabase.from("clients").select("id, nome_empresa"),
  );
  return new Map((linhas ?? []).map((c) => [c.id, c.nome_empresa]));
}

async function nomesDePessoas(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "nomes de pessoas",
    await supabase.from("profiles").select("id, nome").in("id", ids),
  );
  return new Map((linhas ?? []).map((p) => [p.id, p.nome]));
}
