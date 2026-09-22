import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  Subtask,
  Task,
  TaskComentario,
  TaskPrioridade,
  TaskReferencia,
  TaskStatus,
} from "@/lib/supabase/database.types";

/**
 * Consultas de tasks.
 *
 * Os relacionamentos são resolvidos com consultas separadas e juntados aqui —
 * mesmo motivo do módulo de clientes: o embed do PostgREST depende do nome da
 * constraint de chave estrangeira e quebra em silêncio quando ela muda.
 *
 * Nenhuma consulta filtra por perfil: o RLS já garante que só a equipe lê, e
 * que cliente não alcança nada disto.
 */

export type FiltrosDeTask = {
  cliente?: string;
  responsavel?: string;
  prioridade?: TaskPrioridade;
  status?: TaskStatus;
  de?: string;
  ate?: string;
  soAtrasadas?: boolean;
};

export type Pessoa = { id: string; nome: string; avatar_url: string | null };

export type TaskDaLista = Task & {
  cliente: { id: string; nome_empresa: string } | null;
  responsavel: Pessoa | null;
  subtarefasTotal: number;
  subtarefasConcluidas: number;
  /**
   * Soma do tempo das subtarefas — o real quando existe, senão a estimativa.
   * É a sugestão que aparece ao concluir a task-mãe: quem tocou as etapas já
   * registrou o tempo delas, e somar é melhor palpite que estimativa antiga.
   */
  tempoDasSubtarefas: number;
};

const HOJE = () => new Date().toISOString().slice(0, 10);

/**
 * Completa as tasks com cliente, responsável e contagem de subtarefas.
 *
 * Exportada porque Minhas Tasks monta a própria consulta — ela precisa das
 * tasks que têm subtarefa minha, e não só das que são minhas — mas o formato
 * da linha tem de ser exatamente o mesmo, senão board, lista e calendário
 * precisariam de duas versões.
 */
export async function enriquecer(tasks: Task[]): Promise<TaskDaLista[]> {
  if (tasks.length === 0) return [];
  const supabase = await criarClienteServidor();

  const idsDeClientes = [...new Set(tasks.map((t) => t.client_id).filter(Boolean))] as string[];
  const idsDePessoas = [...new Set(tasks.map((t) => t.responsavel_id).filter(Boolean))] as string[];

  const [{ data: clientes }, { data: pessoas }, { data: subtarefas }] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    idsDePessoas.length
      ? supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas)
      : Promise.resolve({ data: [] as Pessoa[] }),
    supabase
      .from("subtasks")
      .select("task_id, concluida, tempo_real_horas, estimativa_horas")
      .in(
        "task_id",
        tasks.map((t) => t.id),
      ),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const contagem = new Map<string, { total: number; concluidas: number; tempo: number }>();
  for (const sub of subtarefas ?? []) {
    const atual = contagem.get(sub.task_id) ?? { total: 0, concluidas: 0, tempo: 0 };
    atual.total += 1;
    if (sub.concluida) atual.concluidas += 1;
    atual.tempo += Number(sub.tempo_real_horas ?? sub.estimativa_horas ?? 0);
    contagem.set(sub.task_id, atual);
  }

  return tasks.map((task) => {
    const resumo = contagem.get(task.id) ?? { total: 0, concluidas: 0, tempo: 0 };
    return {
      ...task,
      cliente: task.client_id ? (porCliente.get(task.client_id) ?? null) : null,
      responsavel: task.responsavel_id ? (porPessoa.get(task.responsavel_id) ?? null) : null,
      subtarefasTotal: resumo.total,
      subtarefasConcluidas: resumo.concluidas,
      tempoDasSubtarefas: Math.round(resumo.tempo * 100) / 100,
    };
  });
}

export async function listarTasks(filtros: FiltrosDeTask = {}): Promise<TaskDaLista[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("tasks").select("*");

  if (filtros.cliente) consulta = consulta.eq("client_id", filtros.cliente);
  if (filtros.responsavel) consulta = consulta.eq("responsavel_id", filtros.responsavel);
  if (filtros.prioridade) consulta = consulta.eq("prioridade", filtros.prioridade);
  if (filtros.status) consulta = consulta.eq("status", filtros.status);
  if (filtros.de) consulta = consulta.gte("prazo", filtros.de);
  if (filtros.ate) consulta = consulta.lte("prazo", filtros.ate);

  if (filtros.soAtrasadas) {
    // Vencida é prazo no passado com a task ainda viva. Concluída ou cancelada
    // nunca conta como atrasada, por mais antigo que seja o prazo.
    consulta = consulta.lt("prazo", HOJE()).not("status", "in", "(concluida,cancelada)");
  }

  const { data } = await consulta.order("prazo", { ascending: true, nullsFirst: false });
  return enriquecer(data ?? []);
}

/** Os três números do cabeçalho. */
export const contadoresDeTasks = cache(async () => {
  const supabase = await criarClienteServidor();
  const hoje = HOJE();
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;

  const [abertas, atrasadas, concluidas] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluida,cancelada)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .lt("prazo", hoje)
      .not("status", "in", "(concluida,cancelada)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluida")
      .gte("concluida_em", `${primeiroDoMes}T00:00:00Z`),
  ]);

  return {
    abertas: abertas.count ?? 0,
    atrasadas: atrasadas.count ?? 0,
    concluidasNoMes: concluidas.count ?? 0,
  };
});

export type TaskCompleta = TaskDaLista & {
  subtarefas: (Subtask & { responsavel: Pessoa | null })[];
  referencias: TaskReferencia[];
  comentarios: (TaskComentario & { autor: Pessoa | null })[];
  autor: Pessoa | null;
};

export async function obterTask(id: string): Promise<TaskCompleta | null> {
  const supabase = await criarClienteServidor();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return null;

  const [{ data: subtarefas }, { data: referencias }, { data: comentarios }] = await Promise.all([
    supabase.from("subtasks").select("*").eq("task_id", id).order("ordem"),
    supabase.from("task_referencias").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_comentarios").select("*").eq("task_id", id).order("created_at"),
  ]);

  const ids = [
    ...new Set(
      [
        task.criado_por,
        ...(subtarefas ?? []).map((s) => s.responsavel_id),
        ...(comentarios ?? []).map((c) => c.autor_id),
      ].filter(Boolean),
    ),
  ] as string[];

  const { data: pessoas } = ids.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", ids)
    : { data: [] as Pessoa[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const [enriquecida] = await enriquecer([task]);

  return {
    ...enriquecida,
    autor: porPessoa.get(task.criado_por) ?? null,
    subtarefas: (subtarefas ?? []).map((sub) => ({
      ...sub,
      responsavel: sub.responsavel_id ? (porPessoa.get(sub.responsavel_id) ?? null) : null,
    })),
    referencias: referencias ?? [],
    comentarios: (comentarios ?? []).map((comentario) => ({
      ...comentario,
      autor: porPessoa.get(comentario.autor_id) ?? null,
    })),
  };
}

export type ItemDeCalendario = {
  chave: string;
  tipo: "task" | "subtarefa";
  taskId: string;
  titulo: string;
  prazo: string;
  prioridade: TaskPrioridade;
  status: TaskStatus;
  concluida: boolean;
  responsavel: Pessoa | null;
  cliente: string | null;
};

/**
 * O calendário mostra os dois níveis: o prazo da task e o prazo de cada
 * subtarefa, cada um no seu dia. É o ponto do módulo — uma entrega no dia 25
 * costuma ter roteiro no 21 e arte no 23, e quem gerencia precisa ver isso
 * separado.
 */
export async function itensDoCalendario(filtros: FiltrosDeTask = {}): Promise<ItemDeCalendario[]> {
  const tasks = await listarTasks({ ...filtros, de: undefined, ate: undefined });
  const supabase = await criarClienteServidor();

  const { data: subtarefas } = tasks.length
    ? await supabase
        .from("subtasks")
        .select("*")
        .in(
          "task_id",
          tasks.map((t) => t.id),
        )
        .not("prazo", "is", null)
    : { data: [] as Subtask[] };

  const idsDePessoas = [
    ...new Set((subtarefas ?? []).map((s) => s.responsavel_id).filter(Boolean)),
  ] as string[];

  const { data: pessoas } = idsDePessoas.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas)
    : { data: [] as Pessoa[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porTask = new Map(tasks.map((t) => [t.id, t]));

  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    if (!task.prazo) continue;
    itens.push({
      chave: `task-${task.id}`,
      tipo: "task",
      taskId: task.id,
      titulo: task.titulo,
      prazo: task.prazo,
      prioridade: task.prioridade,
      status: task.status,
      concluida: task.status === "concluida",
      responsavel: task.responsavel,
      cliente: task.cliente?.nome_empresa ?? null,
    });
  }

  for (const sub of subtarefas ?? []) {
    const mae = porTask.get(sub.task_id);
    if (!mae || !sub.prazo) continue;
    // O filtro de responsável vale para a subtarefa pelo responsável dela,
    // não pelo da task-mãe: é a pauta da pessoa que se quer enxergar.
    if (filtros.responsavel && sub.responsavel_id !== filtros.responsavel) continue;
    itens.push({
      chave: `subtarefa-${sub.id}`,
      tipo: "subtarefa",
      taskId: sub.task_id,
      titulo: sub.titulo,
      prazo: sub.prazo,
      prioridade: mae.prioridade,
      status: mae.status,
      concluida: sub.concluida,
      responsavel: sub.responsavel_id ? (porPessoa.get(sub.responsavel_id) ?? null) : null,
      cliente: mae.cliente?.nome_empresa ?? null,
    });
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

/**
 * URLs temporárias para os arquivos de referência.
 *
 * O bucket é privado, então nem miniatura nem download funcionam com o caminho
 * cru. As URLs valem uma hora e são geradas sob a sessão de quem pediu — o RLS
 * do Storage continua valendo.
 */
export async function urlsDosArquivos(caminhos: string[]): Promise<Record<string, string>> {
  if (caminhos.length === 0) return {};

  const supabase = await criarClienteServidor();
  const { data } = await supabase.storage.from("task-arquivos").createSignedUrls(caminhos, 3600);

  const mapa: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  }
  return mapa;
}
