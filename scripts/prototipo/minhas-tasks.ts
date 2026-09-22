/**
 * Versao de prototipo de src/lib/dados/minhas-tasks.ts.
 *
 * Reaproveita as demandas de scripts/prototipo/tasks.ts e recorta o que e da
 * pessoa logada -- pelas SUBTAREFAS dela, como no modelo real. A Task aparece
 * uma vez so, com as etapas dos outros ao lado, em cinza.
 *
 * Quem e a pessoa logada sai de PROTOTIPO_ROLE: o socio ve as demandas da Ana,
 * o colaborador as do Bruno. E o que faz uma imagem do prototipo mostrar
 * contadores diferentes de outra.
 */
import { combinaComFoco, situacaoDoPrazo, type FocoDoDia } from "../../src/lib/dominio/tasks";
import type {
  ItemDoDia as ItemDoDiaReal,
  MinhaSubtarefa as MinhaSubtarefaReal,
  MinhaTask as MinhaTaskReal,
  Prazos as PrazosReais,
} from "../../src/lib/dados/minhas-tasks";
import type { ItemDeCalendario } from "../../src/lib/dados/tasks";

import { SUBTAREFAS, TASKS, ANA, BRUNO, CARLA, DIEGO, MARINA } from "./tasks";

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
  };
}

/**
 * Quem esta olhando o prototipo.
 *
 * Bruno e colaborador e tem a etapa que esta esperando aprovacao; Ana e socia.
 * Escolher pelo papel e o que faz a tela mostrar botoes diferentes na mesma
 * imagem.
 */
function usuarioDoPrototipo(): string {
  const papel = process.env.PROTOTIPO_ROLE ?? "socio";
  if (papel === "socio") return ANA.id;
  if (papel === "desenvolvedor") return DIEGO.id;
  const funcao = process.env.PROTOTIPO_FUNCAO ?? "";
  if (funcao === "Atendimento") return CARLA.id;
  if (funcao === "Social Media") return MARINA.id;
  return BRUNO.id;
}

function carregar(userId: string): MinhaTask[] {
  const minhas = SUBTAREFAS.filter((s) => s.responsavel_id === userId);
  const ids = [...new Set(minhas.map((s) => s.task_id))];

  return TASKS.filter((t) => ids.includes(t.id)).map((task) => ({
    ...task,
    minhasSubtarefas: minhas.filter((s) => s.task_id === task.id).sort((a, b) => a.ordem - b.ordem),
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
  _userId: string,
  foco: FocoDoDia | null = null,
  prazos: Prazos = prazosDeHoje(),
): Promise<MinhaTask[]> {
  return aplicarFoco(carregar(usuarioDoPrototipo()), foco, prazos);
}

export async function contadoresPessoais(
  _userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<Record<FocoDoDia, number>> {
  const contagem: Record<FocoDoDia, number> = { atrasadas: 0, hoje: 0, semana: 0 };

  for (const task of carregar(usuarioDoPrototipo())) {
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
  _userId: string,
  prazos: Prazos = prazosDeHoje(),
): Promise<ItemDoDia[]> {
  const itens: ItemDoDia[] = [];

  for (const task of carregar(usuarioDoPrototipo())) {
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
