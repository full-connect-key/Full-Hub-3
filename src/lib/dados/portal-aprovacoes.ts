import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { ApprovalRound, SubtaskEntrega } from "@/lib/supabase/database.types";

/**
 * O que o cliente vê no Portal.
 *
 * Só o que foi enviado a ele: rodadas de escopo `cliente`. A aprovação interna
 * inteira — quem pediu, quem aprovou, o que foi comentado — fica do lado de cá
 * da parede, e isso não é uma escolha desta consulta: as policies
 * `approval_rounds_select_cliente` e `subtasks_select_cliente` já recusam o
 * resto. Aqui só montamos o que passou.
 */

export type AprovacaoDoCliente = {
  rodadaId: string;
  subtaskId: string;
  titulo: string;
  task: string;
  numeroRodada: number;
  status: ApprovalRound["status"];
  enviadaEm: string;
  decididaEm: string | null;
  comentario: string | null;
  entregas: SubtaskEntrega[];
  /** Os comentários que a agência marcou como visíveis ao cliente. */
  conversa: { id: string; texto: string; created_at: string; meu: boolean }[];
};

export async function minhasAprovacoes(usuarioId: string): Promise<{
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
}> {
  const supabase = await criarClienteServidor();

  const { data: rodadas } = await supabase
    .from("approval_rounds")
    .select("*")
    .eq("escopo", "cliente")
    .order("solicitado_em", { ascending: false });

  const todas = (rodadas ?? []) as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], decididas: [] };

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.subtask_id))];

  const [{ data: subtarefas }, { data: entregas }] = await Promise.all([
    supabase.from("subtasks").select("id, task_id, titulo").in("id", idsDeSubtarefas),
    supabase.from("subtask_entregas").select("*").in("subtask_id", idsDeSubtarefas),
  ]);

  const idsDeTasks = [...new Set((subtarefas ?? []).map((s) => s.task_id))];

  const [{ data: tasks }, { data: comentarios }] = await Promise.all([
    idsDeTasks.length
      ? supabase.from("tasks").select("id, titulo").in("id", idsDeTasks)
      : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
    supabase
      .from("task_comentarios")
      .select("id, subtask_id, autor_id, texto, created_at")
      .eq("interno", false)
      .in("subtask_id", idsDeSubtarefas)
      .order("created_at"),
  ]);

  const porSubtarefa = new Map((subtarefas ?? []).map((s) => [s.id, s]));
  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));

  const montar = (rodada: ApprovalRound): AprovacaoDoCliente | null => {
    const sub = porSubtarefa.get(rodada.subtask_id);
    if (!sub) return null;
    return {
      rodadaId: rodada.id,
      subtaskId: sub.id,
      titulo: sub.titulo,
      task: porTask.get(sub.task_id)?.titulo ?? "",
      numeroRodada: rodada.numero_rodada,
      status: rodada.status,
      enviadaEm: rodada.solicitado_em,
      decididaEm: rodada.decidido_em,
      comentario: rodada.comentario,
      entregas: (entregas ?? []).filter((e) => e.subtask_id === sub.id),
      conversa: (comentarios ?? [])
        .filter((c) => c.subtask_id === sub.id)
        .map((c) => ({
          id: c.id,
          texto: c.texto,
          created_at: c.created_at,
          meu: c.autor_id === usuarioId,
        })),
    };
  };

  const montadas = todas.map(montar).filter(Boolean) as AprovacaoDoCliente[];

  return {
    esperando: montadas.filter((a) => a.status === "pendente"),
    decididas: montadas.filter((a) => a.status !== "pendente"),
  };
}
