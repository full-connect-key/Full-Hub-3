import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import type { ApprovalRound, SubtaskEntrega, TipoAprovacao } from "@/lib/supabase/database.types";

import type { Pessoa } from "./tasks";

/**
 * A fila de aprovações internas.
 *
 * Duas listas, e a diferença entre elas é o ponto do fluxo:
 *
 *   **Esperando decisão** — alguém produziu e mandou validar.
 *   **Prontas para enviar ao cliente** — já passaram pelo aval interno, mas
 *     ninguém apertou o botão. Aprovar diz que o material está bom; enviar diz
 *     que é agora. São duas decisões, e juntá-las já mandou peça errada para
 *     cliente em muita agência.
 *
 * O RLS já limita o que cada perfil lê; aqui não repetimos a regra. O que a
 * tela precisa saber é quem NÃO pode decidir cada item — quem é o próprio
 * responsável pela entrega.
 */

export type ItemDaFila = {
  rodadaId: string | null;
  subtaskId: string;
  taskId: string;
  numeroRodada: number;
  subtarefa: string;
  task: string;
  cliente: string | null;
  responsavel: Pessoa | null;
  tipoAprovacao: TipoAprovacao;
  /** Desde quando espera. */
  desde: string;
  entregas: SubtaskEntrega[];
  /** Eu sou o responsável — outra pessoa da gestão precisa decidir. */
  souOAutor: boolean;
};

export type FilaDeAprovacoes = {
  esperando: ItemDaFila[];
  prontasParaOCliente: ItemDaFila[];
};

export async function filaDeAprovacoes(usuarioId: string): Promise<FilaDeAprovacoes> {
  const supabase = await criarClienteServidor();

  // Toda rodada de escopo interna das subtarefas que ainda não fecharam o
  // ciclo. Trazer as decididas junto é o que permite descobrir quais já têm
  // aval e estão só esperando o envio.
  const { data: rodadas } = await supabase
    .from("approval_rounds")
    .select("*")
    .order("numero_rodada", { ascending: false });

  const todas = (rodadas ?? []) as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], prontasParaOCliente: [] };

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.subtask_id))];

  const [{ data: subtarefas }, { data: entregas }] = await Promise.all([
    supabase
      .from("subtasks")
      .select("id, task_id, titulo, responsavel_id, tipo_aprovacao, requer_aprovacao, status")
      .in("id", idsDeSubtarefas),
    supabase.from("subtask_entregas").select("*").in("subtask_id", idsDeSubtarefas),
  ]);

  const idsDeTasks = [...new Set((subtarefas ?? []).map((s) => s.task_id))];

  const [{ data: tasks }, { data: pessoas }] = await Promise.all([
    idsDeTasks.length
      ? supabase.from("tasks").select("id, titulo, client_id, status").in("id", idsDeTasks)
      : Promise.resolve({
          data: [] as { id: string; titulo: string; client_id: string; status: string }[],
        }),
    supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .in(
        "id",
        [...new Set((subtarefas ?? []).map((s) => s.responsavel_id).filter(Boolean))] as string[],
      ),
  ]);

  const idsDeClientes = [...new Set((tasks ?? []).map((t) => t.client_id))];
  const { data: clientes } = idsDeClientes.length
    ? await supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
    : { data: [] as { id: string; nome_empresa: string }[] };

  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const esperando: ItemDaFila[] = [];
  const prontasParaOCliente: ItemDaFila[] = [];

  for (const sub of subtarefas ?? []) {
    const minhas = todas.filter((r) => r.subtask_id === sub.id);
    const situacao = situacaoDasRodadas(minhas, sub.tipo_aprovacao);
    const task = porTask.get(sub.task_id);
    if (!task) continue;

    const base = {
      subtaskId: sub.id,
      taskId: sub.task_id,
      subtarefa: sub.titulo,
      task: task.titulo,
      cliente: porCliente.get(task.client_id)?.nome_empresa ?? null,
      responsavel: sub.responsavel_id ? (porPessoa.get(sub.responsavel_id) ?? null) : null,
      tipoAprovacao: (sub.tipo_aprovacao ?? "interna") as TipoAprovacao,
      entregas: (entregas ?? []).filter((e) => e.subtask_id === sub.id),
      souOAutor: sub.responsavel_id === usuarioId,
    };

    const pendenteInterna = minhas.find((r) => r.status === "pendente" && r.escopo === "interna");
    if (pendenteInterna) {
      esperando.push({
        ...base,
        rodadaId: pendenteInterna.id,
        numeroRodada: pendenteInterna.numero_rodada,
        desde: pendenteInterna.solicitado_em,
      });
      continue;
    }

    if (
      sub.tipo_aprovacao === "cliente" &&
      situacao.avalInterno &&
      !situacao.enviadaAoCliente &&
      sub.status !== "concluida"
    ) {
      const interna = minhas.find(
        (r) => r.numero_rodada === situacao.rodadaAtual && r.escopo === "interna",
      );
      prontasParaOCliente.push({
        ...base,
        rodadaId: null,
        numeroRodada: situacao.rodadaAtual,
        desde: interna?.decidido_em ?? interna?.solicitado_em ?? new Date().toISOString(),
      });
    }
  }

  // Quem espera há mais tempo vem primeiro: é a fila justa, e é a que evita
  // uma entrega ficar esquecida no fim da lista.
  const maisAntigoPrimeiro = (a: ItemDaFila, b: ItemDaFila) => a.desde.localeCompare(b.desde);

  return {
    esperando: esperando.sort(maisAntigoPrimeiro),
    prontasParaOCliente: prontasParaOCliente.sort(maisAntigoPrimeiro),
  };
}
