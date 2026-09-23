import "server-only";

import { endOfWeek, format } from "date-fns";

import {
  enriquecer,
  type ItemDeCalendario,
  type Pessoa,
  type SubtarefaDetalhada,
  type TaskDaLista,
} from "./tasks";
import { combinaComFoco, situacaoDoPrazo, type FocoDoDia } from "@/lib/dominio/tasks";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ApprovalRound, Subtask, Task } from "@/lib/supabase/database.types";

/**
 * Consultas da tela Minhas Tasks.
 *
 * A regra é uma só, e é o coração do módulo: **o meu trabalho são as minhas
 * SUBTAREFAS.** A Task não tem responsável desde o Sprint 3B — ela é o
 * agrupador da demanda, e aparece aqui porque tem alguma etapa no meu nome.
 *
 * Consequência prática: a Task aparece UMA vez, mesmo quando tenho três
 * subtarefas nela, e os contadores de prazo olham para o prazo das minhas
 * subtarefas, nunca para o período da Task.
 */

export type MinhaSubtarefa = SubtarefaDetalhada;

export type MinhaTask = TaskDaLista & {
  /** As subtarefas desta task que estão no meu nome. */
  minhasSubtarefas: MinhaSubtarefa[];
  /** As outras, em cinza, como contexto de quem mais está na demanda. */
  outrasSubtarefas: { id: string; titulo: string; status: Subtask["status"]; responsavel: Pessoa | null }[];
};

export type Prazos = {
  hoje: string;
  fimDaSemana: string;
  /** O instante do servidor, para o cronômetro das subtarefas começar de lá. */
  agora: number;
};

/**
 * A régua de datas, calculada uma vez no servidor.
 *
 * A semana termina no domingo, como no calendário do módulo. Passar estes dois
 * valores adiante (em vez de cada tela ler o relógio) é o que impede o
 * contador dizer "3 para hoje" e a lista mostrar 2 porque o navegador da
 * pessoa está em outro fuso.
 */
export function prazosDeHoje(): Prazos {
  const agora = new Date();
  return {
    hoje: format(agora, "yyyy-MM-dd"),
    fimDaSemana: format(endOfWeek(agora, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    agora: agora.getTime(),
  };
}

/** As tasks que têm subtarefa minha, cada uma uma vez só. */
async function carregar(userId: string): Promise<MinhaTask[]> {
  const supabase = await criarClienteServidor();

  const { data: minhasSubs } = await supabase
    .from("subtasks")
    .select("*")
    .eq("responsavel_id", userId);

  const subtarefas = (minhasSubs ?? []) as Subtask[];
  if (subtarefas.length === 0) return [];

  const idsDeTasks = [...new Set(subtarefas.map((s) => s.task_id))];

  const [{ data: tasks }, { data: todasAsSubs }] = await Promise.all([
    supabase.from("tasks").select("*").in("id", idsDeTasks),
    supabase
      .from("subtasks")
      .select("id, task_id, titulo, status, responsavel_id, ordem")
      .in("task_id", idsDeTasks)
      .order("ordem"),
  ]);

  const [{ data: rodadas }, { data: dependencias }] = await Promise.all([
    supabase
      .from("approval_rounds")
      .select("*")
      .in(
        "subtask_id",
        subtarefas.map((s) => s.id),
      )
      .order("numero_rodada", { ascending: false }),
    supabase
      .from("subtask_dependencies")
      .select("subtask_id, depende_de_id")
      .in(
        "subtask_id",
        subtarefas.map((s) => s.id),
      ),
  ]);

  const outras = (todasAsSubs ?? []).filter((s) => s.responsavel_id !== userId);
  const idsDePessoas = [...new Set(outras.map((s) => s.responsavel_id).filter(Boolean))] as string[];

  const { data: pessoas } = idsDePessoas.length
    ? await supabase.from("profiles").select("id, nome, avatar_url").in("id", idsDePessoas)
    : { data: [] as Pessoa[] };

  const { data: eu } = await supabase
    .from("profiles")
    .select("id, nome, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porId = new Map((todasAsSubs ?? []).map((s) => [s.id, s]));
  const enriquecidas = await enriquecer((tasks ?? []) as Task[]);

  const minhasPorTask = new Map<string, MinhaSubtarefa[]>();
  for (const sub of subtarefas) {
    const minhasRodadas = ((rodadas ?? []) as ApprovalRound[]).filter(
      (r) => r.subtask_id === sub.id,
    );
    const dependeDe = (dependencias ?? [])
      .filter((d) => d.subtask_id === sub.id)
      .map((d) => porId.get(d.depende_de_id))
      .filter(Boolean)
      .map((dep) => ({ id: dep!.id, titulo: dep!.titulo, status: dep!.status }));

    const detalhada: MinhaSubtarefa = {
      ...sub,
      responsavel: (eu as Pessoa | null) ?? null,
      dependeDe,
      dependenciasAbertas: dependeDe.filter((d) => d.status !== "concluida").map((d) => d.titulo),
      // O painel pessoal não abre as rodadas em detalhe: ele precisa saber se
      // há uma esperando decisão para escolher o botão. O acordeão completo
      // fica no detalhe da Task.
      rodadas: minhasRodadas.map((r) => ({ ...r, solicitante: null, decisor: null })),
      entregas: [],
      ...situacaoDasRodadas(minhasRodadas, sub.tipo_aprovacao),
    };

    minhasPorTask.set(sub.task_id, [...(minhasPorTask.get(sub.task_id) ?? []), detalhada]);
  }

  return enriquecidas.map((task) => ({
    ...task,
    minhasSubtarefas: (minhasPorTask.get(task.id) ?? []).sort((a, b) => a.ordem - b.ordem),
    outrasSubtarefas: outras
      .filter((s) => s.task_id === task.id)
      .map((s) => ({
        id: s.id,
        titulo: s.titulo,
        status: s.status,
        responsavel: s.responsavel_id ? (porPessoa.get(s.responsavel_id) ?? null) : null,
      })),
  }));
}

/**
 * Uma task entra na lista quando alguma subtarefa minha combina com o foco, e
 * só as que combinam ficam visíveis — senão "Para hoje" traria junto a etapa
 * que vence semana que vem.
 */
function aplicarFoco(tasks: MinhaTask[], foco: FocoDoDia | null, prazos: Prazos): MinhaTask[] {
  if (!foco) return tasks;

  const resultado: MinhaTask[] = [];
  for (const task of tasks) {
    const combinam = task.minhasSubtarefas.filter((sub) =>
      combinaComFoco(
        situacaoDoPrazo(sub.prazo, sub.status === "concluida", prazos.hoje, prazos.fimDaSemana),
        foco,
      ),
    );
    if (combinam.length > 0) resultado.push({ ...task, minhasSubtarefas: combinam });
  }
  return resultado;
}

/**
 * Ordenação padrão: pelo prazo mais apertado entre as MINHAS subtarefas, e
 * quem não tem prazo por último. O período da Task não entra nessa conta.
 */
function meuPrazo(task: MinhaTask): string | null {
  const prazos = task.minhasSubtarefas
    .filter((s) => s.status !== "concluida")
    .map((s) => s.prazo)
    .filter(Boolean) as string[];
  if (prazos.length === 0) return null;
  return prazos.sort()[0];
}

function porPrazo(a: MinhaTask, b: MinhaTask): number {
  const pa = meuPrazo(a);
  const pb = meuPrazo(b);
  if (pa === pb) return a.titulo.localeCompare(b.titulo, "pt-BR");
  if (!pa) return 1;
  if (!pb) return -1;
  return pa.localeCompare(pb);
}

export async function minhasTasks(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<MinhaTask[]> {
  const todas = await carregar(userId);
  return aplicarFoco(todas, foco, prazos).sort(porPrazo);
}

/**
 * Os três contadores do cabeçalho.
 *
 * Contam SUBTAREFAS minhas, não tasks: é a unidade de trabalho, e é o mesmo
 * conjunto que as listas mostram, calculado pela mesma função — é isso que faz
 * o número bater com a tela.
 */
export async function contadoresPessoais(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const todas = await carregar(userId);
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of todas) {
    for (const sub of task.minhasSubtarefas) {
      const situacao = situacaoDoPrazo(
        sub.prazo,
        sub.status === "concluida",
        prazos.hoje,
        prazos.fimDaSemana,
      );
      if (combinaComFoco(situacao, "atrasadas")) contagem.atrasadas += 1;
      if (combinaComFoco(situacao, "hoje")) contagem.hoje += 1;
      if (combinaComFoco(situacao, "semana")) contagem.semana += 1;
    }
  }

  return contagem;
}

/**
 * Os mesmos itens, no formato que o calendário compartilhado já entende.
 *
 * Só as subtarefas: cada uma no dia do prazo dela. O período da Task não
 * aparece aqui — na visão pessoal ele seria ruído, porque não é o que a pessoa
 * entrega.
 */
export async function itensPessoaisDoCalendario(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDeCalendario[]> {
  const tasks = await minhasTasks(userId, foco, prazos);
  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    for (const sub of task.minhasSubtarefas) {
      if (!sub.prazo) continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        tipo: "subtarefa",
        taskId: task.id,
        titulo: sub.titulo,
        prazo: sub.prazo,
        prioridade: sub.prioridade,
        status: task.status,
        concluida: sub.status === "concluida",
        responsavel: sub.responsavel,
        cliente: task.cliente?.nome_empresa ?? null,
      });
    }
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export type ItemDoDia = {
  chave: string;
  id: string;
  taskId: string;
  titulo: string;
  tituloDaMae: string;
  cliente: string | null;
  prazo: string | null;
  atrasada: boolean;
  estimativaMinutos: number | null;
  /**
   * O cronômetro, para "Meu dia" oferecer o mesmo número medido que o detalhe
   * da Task. Sem eles, concluir daqui cairia na estimativa e a mesma etapa
   * sugeriria dois tempos diferentes conforme a tela de onde foi concluída.
   */
  tempoMedidoSegundos: number;
  andandoDesde: string | null;
  /** O que fazer com ela — vem da máquina de estados, não do palpite da tela. */
  requerAprovacao: boolean;
  tipoAprovacao: "interna" | "cliente" | null;
  dependenciasAbertas: string[];
  status: Subtask["status"];
};

/**
 * O widget "Meu dia": o que vence hoje e o que já passou do prazo.
 *
 * Deliberadamente curto — é a primeira coisa que a pessoa lê ao abrir a tela,
 * e serve para responder "o que eu entrego hoje?" sem rolagem.
 */
export async function meuDia(userId: string, prazos: Prazos = prazosDeHoje()): Promise<ItemDoDia[]> {
  const tasks = await carregar(userId);
  const itens: ItemDoDia[] = [];

  for (const task of tasks) {
    for (const sub of task.minhasSubtarefas) {
      const situacao = situacaoDoPrazo(
        sub.prazo,
        sub.status === "concluida",
        prazos.hoje,
        prazos.fimDaSemana,
      );
      if (situacao !== "atrasada" && situacao !== "hoje") continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        id: sub.id,
        taskId: task.id,
        titulo: sub.titulo,
        tituloDaMae: task.titulo,
        cliente: task.cliente?.nome_empresa ?? null,
        prazo: sub.prazo,
        atrasada: situacao === "atrasada",
        estimativaMinutos: sub.estimativa_minutos,
        tempoMedidoSegundos: sub.tempo_medido_segundos,
        andandoDesde: sub.andando_desde,
        requerAprovacao: sub.requer_aprovacao,
        tipoAprovacao: sub.tipo_aprovacao,
        dependenciasAbertas: sub.dependenciasAbertas,
        status: sub.status,
      });
    }
  }

  // Atrasado primeiro, depois por prazo: a ordem em que a pessoa deve atacar.
  return itens.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    return (a.prazo ?? "").localeCompare(b.prazo ?? "");
  });
}

/**
 * A pessoa logada pode criar task?
 *
 * Pergunta ao próprio banco, com `is_atendimento()`, em vez de repetir a regra
 * em TypeScript. É o que mantém o botão na tela e a policy do Postgres sempre
 * de acordo: se a regra mudar na migration, a tela acompanha sem alteração.
 *
 * Esconder o botão não é a proteção — a policy `tasks_insert` é. Isto só evita
 * oferecer um caminho que terminaria em erro.
 */
export async function souDoAtendimento(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("is_atendimento");

  if (error) {
    console.error("[minhas-tasks] is_atendimento falhou:", error);
    return false;
  }
  return data === true;
}
