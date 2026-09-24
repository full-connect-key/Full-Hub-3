import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Json, TaskRecurrence } from "@/lib/supabase/database.types";

/**
 * As consultas das demandas recorrentes.
 *
 * **NENHUMA DELAS REPETE FILTRO DE PERMISSÃO**, e a ausência é a regra da
 * casa: `task_recurrences_select` já fecha em `is_staff()` e
 * `recurrence_runs_select` também. Repetir aqui criaria o segundo lugar onde
 * a regra pode divergir — e é sempre o segundo que esquece.
 */

export type RecorrenciaNaTela = TaskRecurrence & {
  cliente: string;
  /** Nome de quem configurou. A tela mostra "por Carla", não um uuid. */
  criadoPor: string | null;
  /** Quantas tasks já saíram dela. */
  geradas: number;
  /**
   * Quantas das últimas três execuções deram erro. Três é o que a lista
   * destaca — uma falha isolada é ruído, três seguidas é uma regra parada.
   */
  errosRecentes: number;
};

export async function listarRecorrencias(): Promise<RecorrenciaNaTela[]> {
  const supabase = await criarClienteServidor();

  const [{ data: regras }, { data: clientes }, { data: pessoas }] =
    await Promise.all([
      supabase
        .from("task_recurrences")
        .select("*")
        .order("ativo", { ascending: false })
        .order("proxima_geracao_em", { ascending: true, nullsFirst: false })
        .order("nome"),
      supabase.from("clients").select("id, nome_empresa"),
      supabase.from("profiles").select("id, nome"),
    ]);

  const lista = regras ?? [];
  if (lista.length === 0) return [];

  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));
  const nomeDaPessoa = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));

  // AS EXECUÇÕES VÊM DE UMA CONSULTA SÓ, para todas as regras. Uma por regra
  // seria uma consulta por linha da lista — o problema clássico, e numa tela
  // que a agência abre para conferir vinte regras de uma vez.
  const { data: execucoes } = await supabase
    .from("recurrence_runs")
    .select("recurrence_id, status, created_at")
    .in("recurrence_id", lista.map((r) => r.id))
    .order("created_at", { ascending: false });

  const porRegra = new Map<string, { status: string }[]>();
  for (const linha of execucoes ?? []) {
    const atual = porRegra.get(linha.recurrence_id) ?? [];
    atual.push({ status: linha.status });
    porRegra.set(linha.recurrence_id, atual);
  }

  return lista.map((regra) => {
    const corridas = porRegra.get(regra.id) ?? [];
    return {
      ...regra,
      cliente: nomeDoCliente.get(regra.client_id) ?? "—",
      criadoPor: nomeDaPessoa.get(regra.criado_por) ?? null,
      geradas: corridas.filter((c) => c.status === "gerada").length,
      errosRecentes: corridas.slice(0, 3).filter((c) => c.status === "erro").length,
    };
  });
}

export type ExecucaoNaTela = {
  id: string;
  chave: string;
  status: "gerada" | "pulada" | "erro";
  taskId: string | null;
  tituloDaTask: string | null;
  motivo: string | null;
  avisos: string[];
  subtarefas: number | null;
  quando: string;
};

/** O histórico de execução de uma regra, com o que cada uma produziu. */
export async function execucoesDaRecorrencia(
  recurrenceId: string,
): Promise<ExecucaoNaTela[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("recurrence_runs")
    .select("*")
    .eq("recurrence_id", recurrenceId)
    .order("created_at", { ascending: false })
    .limit(60);

  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const ids = linhas.map((l) => l.task_id).filter((id): id is string => Boolean(id));
  const { data: tasks } = ids.length
    ? await supabase.from("tasks").select("id, titulo").in("id", ids)
    : { data: [] };
  const tituloDe = new Map((tasks ?? []).map((t) => [t.id, t.titulo]));

  return linhas.map((linha) => {
    const detalhes = (linha.detalhes ?? {}) as Record<string, Json>;
    return {
      id: linha.id,
      chave: linha.chave_ocorrencia,
      status: linha.status,
      taskId: linha.task_id,
      // A task pode ter sido APAGADA depois de gerada — `on delete set null`.
      // O histórico continua dizendo que a ocorrência aconteceu, que é o que
      // impede a rotina de criá-la de novo.
      tituloDaTask: linha.task_id ? (tituloDe.get(linha.task_id) ?? null) : null,
      motivo: typeof detalhes.motivo === "string" ? detalhes.motivo : null,
      avisos: Array.isArray(detalhes.avisos)
        ? (detalhes.avisos as string[]).filter((a) => typeof a === "string")
        : [],
      subtarefas: typeof detalhes.subtarefas === "number" ? detalhes.subtarefas : null,
      quando: linha.created_at,
    };
  });
}

/** As tasks que saíram de uma regra, para a aba "Geradas". */
export async function tasksDaRecorrencia(recurrenceId: string) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, status, data_inicio, data_fim, publicada_em, created_at")
    .eq("recurrence_id", recurrenceId)
    .order("data_inicio", { ascending: false })
    .limit(60);
  return data ?? [];
}

/** Uma regra só, para a tela de edição. */
export async function buscarRecorrencia(id: string) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("task_recurrences")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * Os feriados que a prévia precisa.
 *
 * A PRÉVIA OLHA 18 MESES À FRENTE no modo task por ocorrência, e a tabela de
 * feriados vai até 2030 desde a 0038. Buscar o intervalo inteiro de uma vez é
 * o mesmo motivo do calendário do Full Days: a prévia recalcula a cada tecla,
 * e não dá para consultar o banco a cada tecla.
 */
export async function feriadosParaAPrevia(): Promise<string[]> {
  const supabase = await criarClienteServidor();
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear() + 3, 11, 31);
  const { data } = await supabase
    .from("holidays")
    .select("data")
    .gte("data", hoje.toISOString().slice(0, 10))
    .lte("data", fim.toISOString().slice(0, 10));
  return (data ?? []).map((f) => f.data);
}

/**
 * O modelo pré-preenchido a partir de uma task que já existe.
 *
 * **"Transformar em recorrente" NÃO SALVA NADA — abre o editor com o que a
 * task tem.** É obrigatório que seja assim: uma task não sabe a cadência
 * dela. Ela tem um período, não uma frequência, e "toda segunda" ou "todo dia
 * 5" é exatamente a informação que não está lá. Uma ação que gravasse direto
 * teria que inventar a cadência — e a regra passaria a gerar sozinha, de
 * madrugada, no ritmo que o sistema chutou.
 *
 * **Só as FOLHAS viram etapa do modelo.** A agrupadora é o agrupador de quem
 * tem filha, e copiá-la junto criaria no modelo uma etapa que nasce sem
 * trabalho e conta duas vezes no tempo — a mesma razão pela qual toda soma da
 * Task olha só as folhas.
 *
 * O prazo de cada etapa vira `prazo_offset_dias` contado do início da Task,
 * como no "salvar como workflow": data fixa num modelo reutilizável faria toda
 * demanda nova nascer vencida.
 */
export async function modeloDeUmaTask(taskId: string) {
  const supabase = await criarClienteServidor();

  const { data: task } = await supabase
    .from("tasks")
    .select("id, titulo, client_id, prioridade, link_entrega, briefing_rico, data_inicio")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return null;

  const { data: etapas } = await supabase
    .from("subtasks")
    .select("id, parent_id, titulo, responsavel_id, prazo, prioridade, estimativa_minutos, requer_aprovacao, tipo_aprovacao, ordem")
    .eq("task_id", taskId)
    .order("ordem");

  const todas = etapas ?? [];
  const temFilha = new Set(todas.map((e) => e.parent_id).filter(Boolean));
  const folhas = todas.filter((e) => !temFilha.has(e.id));

  const inicio = task.data_inicio ? new Date(`${task.data_inicio}T12:00:00`) : null;

  return {
    clienteId: task.client_id,
    modelo: {
      titulo: task.titulo,
      briefing_rico: task.briefing_rico,
      prioridade: task.prioridade,
      pasta_entrega: task.link_entrega ?? "",
      subtarefa_diaria: null,
      subtarefas: folhas.map((e) => ({
        titulo: e.titulo,
        responsavel_id: e.responsavel_id,
        prazo_offset_dias:
          e.prazo && inicio
            ? Math.max(
                0,
                Math.round(
                  (new Date(`${e.prazo}T12:00:00`).getTime() - inicio.getTime()) /
                    86_400_000,
                ),
              )
            : 0,
        prioridade: e.prioridade,
        estimativa_minutos: e.estimativa_minutos,
        requer_aprovacao: e.requer_aprovacao,
        tipo_aprovacao: e.tipo_aprovacao,
        // A DEPENDÊNCIA NÃO VIAJA, e a ausência é escolha: ela aponta para
        // uuid de subtarefa desta task, e o modelo grava posição. Traduzir
        // uma para a outra é a conversão que `salvarTaskComoTipo` faz; aqui
        // ela entraria numa tela em que a pessoa ainda vai mexer na ordem das
        // etapas, e uma dependência apontando para a posição errada é pior
        // que nenhuma.
        depende_de_ordem: null,
      })),
      referencias: [] as { tipo: "link"; url: string; titulo: string | null }[],
    },
  };
}
