import "server-only";

import { endOfWeek, format } from "date-fns";

import { enriquecer, type ItemDeCalendario, type Pessoa, type TaskDaLista } from "./tasks";
import { combinaComFoco, situacaoDoPrazo, type FocoDoDia } from "@/lib/dominio/tasks";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Subtask, Task } from "@/lib/supabase/database.types";

/**
 * Consultas da tela Minhas Tasks.
 *
 * O que separa esta camada da de `tasks.ts` é uma regra só, e ela é o coração
 * do módulo: **o que é meu não é só a task onde sou responsável.** Uma
 * subtarefa atribuída a mim, dentro de uma task de outra pessoa, também é meu
 * trabalho — é assim que a produção funciona, com o redator escrevendo dentro
 * de uma task que é do social media.
 *
 * Por isso a consulta tem dois lados, e a task-mãe alheia entra na lista
 * marcada como tal: eu enxergo a subtarefa, mas não mando na task.
 */

export type MinhaSubtarefa = Subtask & { responsavel: Pessoa | null };

export type MinhaTask = TaskDaLista & {
  /** Sou o responsável pela task, e não só por uma subtarefa dentro dela. */
  souResponsavel: boolean;
  /** As subtarefas desta task que estão no meu nome. */
  minhasSubtarefas: MinhaSubtarefa[];
};

export type Prazos = { hoje: string; fimDaSemana: string };

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
  };
}

/** Tasks minhas e tasks que têm subtarefa minha, num formato só. */
async function carregar(userId: string): Promise<MinhaTask[]> {
  const supabase = await criarClienteServidor();

  const [{ data: minhas }, { data: minhasSubs }] = await Promise.all([
    supabase.from("tasks").select("*").eq("responsavel_id", userId),
    supabase.from("subtasks").select("*").eq("responsavel_id", userId),
  ]);

  const tasksMinhas = (minhas ?? []) as Task[];
  const subtarefas = (minhasSubs ?? []) as Subtask[];

  const jaTenho = new Set(tasksMinhas.map((t) => t.id));
  const idsDeMaesAlheias = [
    ...new Set(subtarefas.map((s) => s.task_id).filter((id) => !jaTenho.has(id))),
  ];

  const { data: maesAlheias } = idsDeMaesAlheias.length
    ? await supabase.from("tasks").select("*").in("id", idsDeMaesAlheias)
    : { data: [] as Task[] };

  const todas = [...tasksMinhas, ...((maesAlheias ?? []) as Task[])];
  const enriquecidas = await enriquecer(todas);

  // O responsável da subtarefa sou eu, sempre — mas a linha precisa do nome
  // para o detalhe e para o board, então buscamos o perfil uma vez.
  const { data: eu } = await supabase
    .from("profiles")
    .select("id, nome, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const porTask = new Map<string, Subtask[]>();
  for (const sub of subtarefas) {
    porTask.set(sub.task_id, [...(porTask.get(sub.task_id) ?? []), sub]);
  }

  return enriquecidas.map((task) => ({
    ...task,
    souResponsavel: task.responsavel_id === userId,
    minhasSubtarefas: (porTask.get(task.id) ?? [])
      .map((sub) => ({ ...sub, responsavel: (eu as Pessoa | null) ?? null }))
      .sort((a, b) => a.ordem - b.ordem),
  }));
}

/**
 * Uma task entra na lista se ela própria combina com o foco, ou se alguma
 * subtarefa minha combina. No segundo caso, só as subtarefas que combinam
 * ficam visíveis — senão o filtro "Para hoje" traria junto a subtarefa que
 * vence semana que vem.
 */
function aplicarFoco(tasks: MinhaTask[], foco: FocoDoDia | null, prazos: Prazos): MinhaTask[] {
  if (!foco) return tasks;

  const resultado: MinhaTask[] = [];
  for (const task of tasks) {
    const daTask =
      task.souResponsavel &&
      combinaComFoco(
        situacaoDoPrazo(
          task.prazo,
          task.status === "concluida" || task.status === "cancelada",
          prazos.hoje,
          prazos.fimDaSemana,
        ),
        foco,
      );

    const subsQueCombinam = task.minhasSubtarefas.filter((sub) =>
      combinaComFoco(
        situacaoDoPrazo(sub.prazo, sub.concluida, prazos.hoje, prazos.fimDaSemana),
        foco,
      ),
    );

    if (daTask || subsQueCombinam.length > 0) {
      resultado.push({ ...task, minhasSubtarefas: daTask ? task.minhasSubtarefas : subsQueCombinam });
    }
  }
  return resultado;
}

/** Ordenação padrão da tela: prazo crescente, e quem não tem prazo por último. */
function porPrazo(a: MinhaTask, b: MinhaTask): number {
  if (a.prazo === b.prazo) return a.titulo.localeCompare(b.titulo, "pt-BR");
  if (!a.prazo) return 1;
  if (!b.prazo) return -1;
  return a.prazo.localeCompare(b.prazo);
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
 * Contam ITENS, não tasks: a subtarefa que vence hoje conta como uma entrega
 * de hoje, mesmo que a task-mãe só vença na semana que vem. É o mesmo conjunto
 * que as listas mostram, calculado pela mesma função — é isso que faz o número
 * bater com a tela.
 */
export async function contadoresPessoais(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const todas = await carregar(userId);
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of todas) {
    const situacoes = [
      ...(task.souResponsavel
        ? [
            situacaoDoPrazo(
              task.prazo,
              task.status === "concluida" || task.status === "cancelada",
              prazos.hoje,
              prazos.fimDaSemana,
            ),
          ]
        : []),
      ...task.minhasSubtarefas.map((sub) =>
        situacaoDoPrazo(sub.prazo, sub.concluida, prazos.hoje, prazos.fimDaSemana),
      ),
    ];

    for (const situacao of situacoes) {
      if (combinaComFoco(situacao, "atrasadas")) contagem.atrasadas += 1;
      if (combinaComFoco(situacao, "hoje")) contagem.hoje += 1;
      if (combinaComFoco(situacao, "semana")) contagem.semana += 1;
    }
  }

  return contagem;
}

/** Os mesmos itens, no formato que o calendário compartilhado já entende. */
export async function itensPessoaisDoCalendario(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDeCalendario[]> {
  const tasks = await minhasTasks(userId, foco, prazos);
  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    if (task.souResponsavel && task.prazo) {
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

    for (const sub of task.minhasSubtarefas) {
      if (!sub.prazo) continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        tipo: "subtarefa",
        taskId: task.id,
        titulo: sub.titulo,
        prazo: sub.prazo,
        prioridade: task.prioridade,
        status: task.status,
        concluida: sub.concluida,
        responsavel: sub.responsavel,
        cliente: task.cliente?.nome_empresa ?? null,
      });
    }
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export type ItemDoDia = {
  chave: string;
  tipo: "task" | "subtarefa";
  id: string;
  taskId: string;
  titulo: string;
  tituloDaMae: string | null;
  cliente: string | null;
  prazo: string | null;
  atrasada: boolean;
  estimativa: number | null;
};

/**
 * O widget "Meu dia": o que vence hoje e o que já passou do prazo.
 *
 * Deliberadamente curto — é a primeira coisa que a pessoa lê ao abrir a tela,
 * e serve para responder "o que eu entrego hoje?" sem rolagem.
 */
export async function meuDia(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDoDia[]> {
  const tasks = await carregar(userId);
  const itens: ItemDoDia[] = [];

  for (const task of tasks) {
    const viva = task.status !== "concluida" && task.status !== "cancelada";
    const situacaoDaTask = situacaoDoPrazo(task.prazo, !viva, prazos.hoje, prazos.fimDaSemana);

    if (task.souResponsavel && (situacaoDaTask === "atrasada" || situacaoDaTask === "hoje")) {
      itens.push({
        chave: `task-${task.id}`,
        tipo: "task",
        id: task.id,
        taskId: task.id,
        titulo: task.titulo,
        tituloDaMae: null,
        cliente: task.cliente?.nome_empresa ?? null,
        prazo: task.prazo,
        atrasada: situacaoDaTask === "atrasada",
        estimativa: task.estimativa_horas,
      });
    }

    for (const sub of task.minhasSubtarefas) {
      const situacao = situacaoDoPrazo(sub.prazo, sub.concluida, prazos.hoje, prazos.fimDaSemana);
      if (situacao !== "atrasada" && situacao !== "hoje") continue;
      itens.push({
        chave: `subtarefa-${sub.id}`,
        tipo: "subtarefa",
        id: sub.id,
        taskId: task.id,
        titulo: sub.titulo,
        tituloDaMae: task.titulo,
        cliente: task.cliente?.nome_empresa ?? null,
        prazo: sub.prazo,
        atrasada: situacao === "atrasada",
        estimativa: sub.estimativa_horas,
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

