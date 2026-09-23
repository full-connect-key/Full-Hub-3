import "server-only";

import { cache } from "react";

import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ApprovalRound,
  Subtask,
  SubtaskEntrega,
  SubtaskStatus,
  Task,
  TaskComentario,
  TaskHistory,
  TaskPrioridade,
  TaskReferencia,
  TaskStatus,
} from "@/lib/supabase/database.types";

/**
 * Consultas de tasks.
 *
 * Desde o Sprint 3B a Task é o agrupador e a SUBTAREFA é a unidade de
 * trabalho: dono, prazo, tempo e aprovação vivem nela. Por isso quase tudo
 * aqui parte de `subtasks` e sobe para a task, e não o contrário.
 *
 * Os relacionamentos são resolvidos com consultas separadas e juntados aqui —
 * mesmo motivo do módulo de clientes: o embed do PostgREST depende do nome da
 * constraint de chave estrangeira e quebra em silêncio quando ela muda.
 *
 * Nenhuma consulta filtra por perfil: o RLS já garante que só a equipe lê, e
 * que um cliente só alcança o que foi enviado para ele.
 */

export type FiltrosDeTask = {
  cliente?: string;
  /** Quem trabalha na demanda — casa pelo responsável das SUBTAREFAS. */
  responsavel?: string;
  prioridade?: TaskPrioridade;
  status?: TaskStatus;
  tipo?: string;
  de?: string;
  ate?: string;
  soAtrasadas?: boolean;
};

export type Pessoa = { id: string; nome: string; avatar_url: string | null };

export type TaskDaLista = Task & {
  cliente: { id: string; nome_empresa: string } | null;
  /** Quem está na demanda, pelos responsáveis das subtarefas. */
  equipe: Pessoa[];
  subtarefasTotal: number;
  subtarefasConcluidas: number;
  /** Soma das estimativas das subtarefas, em minutos. A Task não tem a sua. */
  estimativaMinutos: number | null;
  /** Soma do tempo real das subtarefas, em minutos. */
  tempoRealMinutos: number | null;
  /** O prazo mais apertado entre as subtarefas em aberto. */
  proximoPrazo: string | null;
  /** Título da subtarefa com aprovação esperando decisão, se houver. */
  aprovacaoPendenteEm: string | null;
  temSubtarefaEmAjustes: boolean;
};

const HOJE = () => new Date().toISOString().slice(0, 10);

const CONCLUIDAS: TaskStatus[] = ["concluido"];

type LinhaDeSubtarefa = Pick<
  Subtask,
  | "id"
  | "task_id"
  | "titulo"
  | "prazo"
  | "responsavel_id"
  | "status"
  | "estimativa_minutos"
  | "tempo_real_minutos"
>;

/**
 * Completa as tasks com cliente, equipe e o resumo das subtarefas.
 *
 * Exportada porque Minhas Tasks monta a própria consulta — ela parte das
 * subtarefas da pessoa — mas o formato da linha tem de ser exatamente o mesmo,
 * senão board, lista e calendário precisariam de duas versões.
 */
export async function enriquecer(tasks: Task[]): Promise<TaskDaLista[]> {
  if (tasks.length === 0) return [];
  const supabase = await criarClienteServidor();

  const ids = tasks.map((t) => t.id);
  const idsDeClientes = [...new Set(tasks.map((t) => t.client_id))];

  const [{ data: clientes }, { data: subtarefas }] = await Promise.all([
    supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes),
    supabase
      .from("subtasks")
      .select(
        "id, task_id, titulo, prazo, responsavel_id, status, estimativa_minutos, tempo_real_minutos",
      )
      .in("task_id", ids),
  ]);

  const linhas = (subtarefas ?? []) as LinhaDeSubtarefa[];

  // Quais subtarefas têm rodada esperando decisão. É o que o board precisa
  // saber para recusar um arrasto com o motivo certo.
  const { data: pendentes } = linhas.length
    ? await supabase
        .from("approval_rounds")
        .select("subtask_id")
        .eq("status", "pendente")
        .in(
          "subtask_id",
          linhas.map((s) => s.id),
        )
    : { data: [] as { subtask_id: string }[] };

  const comRodadaPendente = new Set((pendentes ?? []).map((r) => r.subtask_id));

  const idsDePessoas = [...new Set(linhas.map((s) => s.responsavel_id).filter(Boolean))] as string[];
  const { data: pessoas } = idsDePessoas.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas)
    : { data: [] as Pessoa[] };

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const resumos = new Map<string, ReturnType<typeof resumoVazio>>();
  for (const sub of linhas) {
    const atual = resumos.get(sub.task_id) ?? resumoVazio();
    atual.total += 1;
    if (sub.status === "concluida") atual.concluidas += 1;
    if (sub.status === "em_ajustes") atual.emAjustes = true;
    if (comRodadaPendente.has(sub.id) && !atual.aprovacaoPendenteEm) {
      atual.aprovacaoPendenteEm = sub.titulo;
    }
    if (sub.estimativa_minutos !== null) atual.estimativa += sub.estimativa_minutos;
    if (sub.tempo_real_minutos !== null) atual.tempoReal += sub.tempo_real_minutos;
    if (sub.status !== "concluida" && sub.prazo) {
      if (!atual.proximoPrazo || sub.prazo < atual.proximoPrazo) atual.proximoPrazo = sub.prazo;
    }
    const pessoa = sub.responsavel_id ? porPessoa.get(sub.responsavel_id) : null;
    if (pessoa && !atual.equipe.some((p) => p.id === pessoa.id)) atual.equipe.push(pessoa);
    resumos.set(sub.task_id, atual);
  }

  return tasks.map((task) => {
    const r = resumos.get(task.id) ?? resumoVazio();
    return {
      ...task,
      cliente: porCliente.get(task.client_id) ?? null,
      equipe: r.equipe,
      subtarefasTotal: r.total,
      subtarefasConcluidas: r.concluidas,
      estimativaMinutos: r.estimativa > 0 ? r.estimativa : null,
      tempoRealMinutos: r.tempoReal > 0 ? r.tempoReal : null,
      proximoPrazo: r.proximoPrazo,
      aprovacaoPendenteEm: r.aprovacaoPendenteEm,
      temSubtarefaEmAjustes: r.emAjustes,
    };
  });
}

function resumoVazio() {
  return {
    total: 0,
    concluidas: 0,
    estimativa: 0,
    tempoReal: 0,
    proximoPrazo: null as string | null,
    aprovacaoPendenteEm: null as string | null,
    emAjustes: false,
    equipe: [] as Pessoa[],
  };
}

export async function listarTasks(filtros: FiltrosDeTask = {}): Promise<TaskDaLista[]> {
  const supabase = await criarClienteServidor();

  // O filtro por pessoa casa pelas SUBTAREFAS: o "responsável da task" não
  // existe mais, e quem trabalha na demanda é quem tem etapa dentro dela.
  let idsPorPessoa: string[] | null = null;
  if (filtros.responsavel) {
    const { data } = await supabase
      .from("subtasks")
      .select("task_id")
      .eq("responsavel_id", filtros.responsavel);
    idsPorPessoa = [...new Set((data ?? []).map((s) => s.task_id))];
    if (idsPorPessoa.length === 0) return [];
  }

  let consulta = supabase.from("tasks").select("*");

  if (idsPorPessoa) consulta = consulta.in("id", idsPorPessoa);
  if (filtros.cliente) consulta = consulta.eq("client_id", filtros.cliente);
  if (filtros.prioridade) consulta = consulta.eq("prioridade", filtros.prioridade);
  if (filtros.status) consulta = consulta.eq("status", filtros.status);
  if (filtros.tipo) consulta = consulta.eq("task_type_id", filtros.tipo);

  // O período da Task é uma janela: entra tudo que cruza o intervalo pedido.
  if (filtros.de) consulta = consulta.or(`data_fim.gte.${filtros.de},data_fim.is.null`);
  if (filtros.ate) consulta = consulta.lte("data_inicio", filtros.ate);

  const { data } = await consulta.order("data_fim", { ascending: true, nullsFirst: false });
  const tasks = await enriquecer(data ?? []);

  if (filtros.soAtrasadas) {
    // Atraso é da SUBTAREFA: a Task não tem prazo próprio. Uma demanda está
    // atrasada quando alguma etapa em aberto passou da data.
    const hoje = HOJE();
    return tasks.filter(
      (t) =>
        !CONCLUIDAS.includes(t.status) && t.proximoPrazo !== null && t.proximoPrazo < hoje,
    );
  }

  return tasks;
}

/** Os três números do cabeçalho. */
export const contadoresDeTasks = cache(async () => {
  const supabase = await criarClienteServidor();
  const hoje = HOJE();
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;

  const [abertas, concluidas, atrasadas] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(concluido)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluido")
      .gte("concluida_em", `${primeiroDoMes}T00:00:00Z`),
    // Atrasada conta pela subtarefa vencida, e cada task conta uma vez.
    supabase
      .from("subtasks")
      .select("task_id")
      .lt("prazo", hoje)
      .not("status", "eq", "concluida"),
  ]);

  return {
    abertas: abertas.count ?? 0,
    atrasadas: new Set((atrasadas.data ?? []).map((s) => s.task_id)).size,
    concluidasNoMes: concluidas.count ?? 0,
  };
});

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export type RodadaDetalhada = ApprovalRound & {
  solicitante: Pessoa | null;
  decisor: Pessoa | null;
};

export type EntregaDetalhada = SubtaskEntrega & { autor: Pessoa | null };

export type SubtarefaDetalhada = Subtask & {
  responsavel: Pessoa | null;
  /** De quem ela depende, com o estado de cada uma. */
  dependeDe: { id: string; titulo: string; status: SubtaskStatus }[];
  /** Só os títulos do que ainda não terminou — é o texto do cadeado. */
  dependenciasAbertas: string[];
  rodadas: RodadaDetalhada[];
  entregas: EntregaDetalhada[];
  rodadaPendente: boolean;
  avalInterno: boolean;
  avalFinal: boolean;
  enviadaAoCliente: boolean;
  rodadaAtual: number;
};

export type TaskCompleta = TaskDaLista & {
  subtarefas: SubtarefaDetalhada[];
  referencias: TaskReferencia[];
  comentarios: (TaskComentario & { autor: Pessoa | null })[];
  historico: (TaskHistory & { autor: Pessoa | null })[];
  tipo: { id: string; nome: string } | null;
  autor: Pessoa | null;
};

export async function obterTask(id: string): Promise<TaskCompleta | null> {
  const supabase = await criarClienteServidor();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return null;

  const [{ data: subtarefas }, { data: referencias }, { data: comentarios }, { data: historico }] =
    await Promise.all([
      supabase.from("subtasks").select("*").eq("task_id", id).order("ordem"),
      supabase.from("task_referencias").select("*").eq("task_id", id).order("created_at"),
      supabase.from("task_comentarios").select("*").eq("task_id", id).order("created_at"),
      supabase
        .from("task_history")
        .select("*")
        .eq("task_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const idsDeSubtarefas = (subtarefas ?? []).map((s) => s.id);

  const [{ data: rodadas }, { data: entregas }, { data: dependencias }] = await Promise.all([
    idsDeSubtarefas.length
      ? supabase
          .from("approval_rounds")
          .select("*")
          .in("subtask_id", idsDeSubtarefas)
          .order("numero_rodada", { ascending: false })
      : Promise.resolve({ data: [] as ApprovalRound[] }),
    idsDeSubtarefas.length
      ? supabase
          .from("subtask_entregas")
          .select("*")
          .in("subtask_id", idsDeSubtarefas)
          .order("created_at")
      : Promise.resolve({ data: [] as SubtaskEntrega[] }),
    idsDeSubtarefas.length
      ? supabase
          .from("subtask_dependencies")
          .select("subtask_id, depende_de_id")
          .in("subtask_id", idsDeSubtarefas)
      : Promise.resolve({ data: [] as { subtask_id: string; depende_de_id: string }[] }),
  ]);

  const ids = [
    ...new Set(
      [
        task.criado_por,
        ...(subtarefas ?? []).map((s) => s.responsavel_id),
        ...(comentarios ?? []).map((c) => c.autor_id),
        ...(historico ?? []).map((h) => h.autor_id),
        ...(rodadas ?? []).flatMap((r) => [r.solicitado_por, r.decidido_por]),
        ...(entregas ?? []).map((e) => e.enviado_por),
      ].filter(Boolean),
    ),
  ] as string[];

  const [{ data: pessoas }, { data: tipo }] = await Promise.all([
    ids.length
      ? supabase.from("profiles").select("id, nome, avatar_url").in("id", ids)
      : Promise.resolve({ data: [] as Pessoa[] }),
    task.task_type_id
      ? supabase.from("task_types").select("id, nome").eq("id", task.task_type_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porSubtarefa = new Map((subtarefas ?? []).map((s) => [s.id, s]));
  const [enriquecida] = await enriquecer([task]);

  const detalhadas: SubtarefaDetalhada[] = (subtarefas ?? []).map((sub) => {
    const minhasRodadas = (rodadas ?? []).filter((r) => r.subtask_id === sub.id);
    const situacao = situacaoDasRodadas(minhasRodadas, sub.tipo_aprovacao);

    const dependeDe = (dependencias ?? [])
      .filter((d) => d.subtask_id === sub.id)
      .map((d) => porSubtarefa.get(d.depende_de_id))
      .filter(Boolean)
      .map((dep) => ({ id: dep!.id, titulo: dep!.titulo, status: dep!.status }));

    return {
      ...sub,
      responsavel: sub.responsavel_id ? (porPessoa.get(sub.responsavel_id) ?? null) : null,
      dependeDe,
      dependenciasAbertas: dependeDe.filter((d) => d.status !== "concluida").map((d) => d.titulo),
      rodadas: minhasRodadas.map((r) => ({
        ...r,
        solicitante: porPessoa.get(r.solicitado_por) ?? null,
        decisor: r.decidido_por ? (porPessoa.get(r.decidido_por) ?? null) : null,
      })),
      entregas: (entregas ?? [])
        .filter((e) => e.subtask_id === sub.id)
        .map((e) => ({ ...e, autor: porPessoa.get(e.enviado_por) ?? null })),
      ...situacao,
    };
  });

  return {
    ...enriquecida,
    autor: porPessoa.get(task.criado_por) ?? null,
    tipo: tipo ?? null,
    subtarefas: detalhadas,
    referencias: referencias ?? [],
    comentarios: (comentarios ?? []).map((comentario) => ({
      ...comentario,
      autor: porPessoa.get(comentario.autor_id) ?? null,
    })),
    historico: (historico ?? []).map((evento) => ({
      ...evento,
      autor: evento.autor_id ? (porPessoa.get(evento.autor_id) ?? null) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

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
 * O calendário mostra os dois níveis: o fim do período da Task e o prazo de
 * cada subtarefa, cada um no seu dia. É o ponto do módulo — uma entrega no dia
 * 25 costuma ter roteiro no 21 e arte no 23, e quem gerencia precisa ver isso
 * separado.
 */
export async function itensDoCalendario(filtros: FiltrosDeTask = {}): Promise<ItemDeCalendario[]> {
  const tasks = await listarTasks({ ...filtros, de: undefined, ate: undefined });
  if (tasks.length === 0) return [];

  const supabase = await criarClienteServidor();

  const { data: subtarefas } = await supabase
    .from("subtasks")
    .select("*")
    .in(
      "task_id",
      tasks.map((t) => t.id),
    )
    .not("prazo", "is", null);

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
    if (!task.data_fim) continue;
    itens.push({
      chave: `task-${task.id}`,
      tipo: "task",
      taskId: task.id,
      titulo: task.titulo,
      prazo: task.data_fim,
      prioridade: task.prioridade,
      status: task.status,
      concluida: task.status === "concluido",
      responsavel: null,
      cliente: task.cliente?.nome_empresa ?? null,
    });
  }

  for (const sub of subtarefas ?? []) {
    const mae = porTask.get(sub.task_id);
    if (!mae || !sub.prazo) continue;
    // O filtro de pessoa vale pelo responsável da SUBTAREFA: é a pauta dela
    // que se quer enxergar, não a da demanda inteira.
    if (filtros.responsavel && sub.responsavel_id !== filtros.responsavel) continue;
    itens.push({
      chave: `subtarefa-${sub.id}`,
      tipo: "subtarefa",
      taskId: sub.task_id,
      titulo: sub.titulo,
      prazo: sub.prazo,
      prioridade: sub.prioridade,
      status: mae.status,
      concluida: sub.status === "concluida",
      responsavel: sub.responsavel_id ? (porPessoa.get(sub.responsavel_id) ?? null) : null,
      cliente: mae.cliente?.nome_empresa ?? null,
    });
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

/**
 * URLs temporárias para os arquivos de referência e de entrega.
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
