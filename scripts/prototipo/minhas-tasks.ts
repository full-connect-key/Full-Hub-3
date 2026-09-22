/**
 * Versao de prototipo de src/lib/dados/minhas-tasks.ts.
 *
 * Reaproveita as tasks e subtarefas ficticias de ./tasks.ts, e aplica a mesma
 * regra do modulo real: e meu o que esta no meu nome, seja a task inteira ou
 * so uma subtarefa dentro da task de outra pessoa. As funcoes puras vem de
 * lib/dominio, entao o filtro e os contadores se comportam igual ao app.
 */
import { endOfWeek, format } from "date-fns";

import { combinaComFoco, situacaoDoPrazo, type FocoDoDia } from "../../src/lib/dominio/tasks";
import type {
  ItemDoDia as ItemDoDiaReal,
  MinhaSubtarefa as MinhaSubtarefaReal,
  MinhaTask as MinhaTaskReal,
  Prazos as PrazosReais,
} from "../../src/lib/dados/minhas-tasks";
import type { ItemDeCalendario } from "../../src/lib/dados/tasks";

import { SUBTAREFAS, TASKS } from "./tasks";

export type MinhaSubtarefa = MinhaSubtarefaReal;
export type MinhaTask = MinhaTaskReal;
export type Prazos = PrazosReais;
export type ItemDoDia = ItemDoDiaReal;

export function prazosDeHoje(): Prazos {
  const agora = new Date();
  return {
    hoje: format(agora, "yyyy-MM-dd"),
    fimDaSemana: format(endOfWeek(agora, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

function carregar(userId: string): MinhaTask[] {
  const minhasSubs = SUBTAREFAS.filter((sub) => sub.responsavel_id === userId);
  const idsDeMaes = new Set(minhasSubs.map((sub) => sub.task_id));

  return TASKS.filter((task) => task.responsavel_id === userId || idsDeMaes.has(task.id)).map(
    (task) => ({
      ...task,
      souResponsavel: task.responsavel_id === userId,
      minhasSubtarefas: minhasSubs.filter(
        (sub) => sub.task_id === task.id,
      ) as unknown as MinhaSubtarefa[],
    }),
  );
}

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

    const subs = task.minhasSubtarefas.filter((sub) =>
      combinaComFoco(
        situacaoDoPrazo(sub.prazo, sub.concluida, prazos.hoje, prazos.fimDaSemana),
        foco,
      ),
    );

    if (daTask || subs.length > 0) {
      resultado.push({ ...task, minhasSubtarefas: daTask ? task.minhasSubtarefas : subs });
    }
  }
  return resultado;
}

export async function minhasTasks(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<MinhaTask[]> {
  return aplicarFoco(carregar(userId), foco, prazos).sort((a, b) =>
    (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
  );
}

export async function contadoresPessoais(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of carregar(userId)) {
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

export async function meuDia(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDoDia[]> {
  const itens: ItemDoDia[] = [];

  for (const task of carregar(userId)) {
    const viva = task.status !== "concluida" && task.status !== "cancelada";
    const daTask = situacaoDoPrazo(task.prazo, !viva, prazos.hoje, prazos.fimDaSemana);

    if (task.souResponsavel && (daTask === "atrasada" || daTask === "hoje")) {
      itens.push({
        chave: `task-${task.id}`,
        tipo: "task",
        id: task.id,
        taskId: task.id,
        titulo: task.titulo,
        tituloDaMae: null,
        cliente: task.cliente?.nome_empresa ?? null,
        prazo: task.prazo,
        atrasada: daTask === "atrasada",
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

  return itens.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    return (a.prazo ?? "").localeCompare(b.prazo ?? "");
  });
}

/**
 * No app isto pergunta ao banco com `is_atendimento()`. Aqui a resposta vem do
 * ambiente, para as capturas mostrarem os dois lados da regra.
 */
export async function souDoAtendimento(): Promise<boolean> {
  const role = process.env["PROTOTIPO_ROLE"];
  if (role === "socio" || role === "desenvolvedor") return true;
  return process.env["PROTOTIPO_FUNCAO"] === "Atendimento";
}
