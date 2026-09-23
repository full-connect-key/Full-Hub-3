/**
 * Versao de prototipo de src/lib/dados/minhas-tasks.ts.
 *
 * Reaproveita as demandas de scripts/prototipo/tasks.ts e recorta o que e da
 * pessoa logada -- pelas SUBTAREFAS dela, como no modelo real. A Task aparece
 * uma vez so, com as etapas dos outros ao lado, em cinza.
 *
 * Quem e a pessoa logada vem da sessao do prototipo (scripts/prototipo/dal.ts),
 * que segue PROTOTIPO_ROLE. Os ids batem com os daqui, entao o socio ve as
 * etapas da Ana e o social media as da Marina -- e o que faz uma imagem do
 * prototipo mostrar contadores e botoes diferentes de outra.
 */
import { combinaComFoco, situacaoDoPrazo, type FocoDoDia } from "../../src/lib/dominio/tasks";
import type {
  ItemDoDia as ItemDoDiaReal,
  MinhaSubtarefa as MinhaSubtarefaReal,
  MinhaTask as MinhaTaskReal,
  Prazos as PrazosReais,
} from "../../src/lib/dados/minhas-tasks";
import type { ItemDeCalendario } from "../../src/lib/dados/tasks";

import { SUBTAREFAS, TASKS } from "./tasks";

export type MinhaTask = MinhaTaskReal;
export type MinhaSubtarefa = MinhaSubtarefaReal;
export type ItemDoDia = ItemDoDiaReal;
export type Prazos = PrazosReais;

export function prazosDeHoje(): Prazos {
  const agora = new Date();
  const fim = new Date(agora);
  // Domingo como fim de semana, igual ao calendario do modulo.
  fim.setDate(fim.getDate() + ((7 - fim.getDay()) % 7));
  return {
    hoje: agora.toISOString().slice(0, 10),
    fimDaSemana: fim.toISOString().slice(0, 10),
    agora: agora.getTime(),
  };
}

function carregar(userId: string): MinhaTask[] {
  const minhas = SUBTAREFAS.filter((s) => s.responsavel_id === userId);
  const ids = [...new Set(minhas.map((s) => s.task_id))];

  return TASKS.filter((t) => ids.includes(t.id)).map((task) => ({
    ...task,
    minhasSubtarefas: minhas
      .filter((s) => s.task_id === task.id)
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({
        ...s,
        etapaDeCima: s.parent_id
          ? (SUBTAREFAS.find((m) => m.id === s.parent_id)?.titulo ?? null)
          : null,
      })),
    outrasSubtarefas: SUBTAREFAS.filter(
      (s) => s.task_id === task.id && s.responsavel_id !== userId,
    ).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      responsavel: s.responsavel,
    })),
  }));
}

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

export async function minhasTasks(
  userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<MinhaTask[]> {
  return aplicarFoco(carregar(userId), foco, prazos);
}

export async function contadoresPessoais(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of carregar(userId)) {
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

export async function meuDia(
  userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDoDia[]> {
  const itens: ItemDoDia[] = [];

  for (const task of carregar(userId)) {
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

  return itens.sort((a, b) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    return (a.prazo ?? "").localeCompare(b.prazo ?? "");
  });
}

/** No protótipo, Atendimento e gestão criam task — a mesma regra do banco. */
export async function souDoAtendimento(): Promise<boolean> {
  const papel = process.env.PROTOTIPO_ROLE ?? "socio";
  if (papel === "socio" || papel === "desenvolvedor") return true;
  return (process.env.PROTOTIPO_FUNCAO ?? "") === "Atendimento";
}
