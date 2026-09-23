import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type {
  ApprovalRound,
  SubtaskEntrega,
} from "@/lib/supabase/database.types";

/**
 * O que o cliente vê no Portal.
 *
 * Só o que foi enviado a ele: rodadas de escopo `cliente`. A aprovação interna
 * inteira — quem pediu, quem aprovou, o que foi comentado — fica do lado de cá
 * da parede, e isso não é uma escolha desta consulta: as policies
 * `approval_rounds_select_cliente` e `subtasks_select_cliente` já recusam o
 * resto. Aqui só montamos o que passou.
 *
 * `clienteId` é para a visualização administrativa em /portal/{slug}. Para a
 * pessoa cliente ele é dispensável — o RLS já limita as linhas às empresas
 * dela. Para quem é da equipe, NÃO É: `is_staff()` enxerga todos os clientes,
 * e sem este filtro o portal da Mundo Verde mostraria as aprovações da Óptica
 * Visão. O isolamento por cliente continua valendo; o que muda é que aqui ele
 * precisa ser dito, porque quem pergunta tem permissão para ver mais.
 */

export type AprovacaoDoCliente = {
  rodadaId: string;
  subtaskId: string;
  titulo: string;
  /** A demanda a que o material pertence. */
  demanda: string;
  numeroRodada: number;
  status: ApprovalRound["status"];
  enviadaEm: string;
  decididaEm: string | null;
  comentario: string | null;
  entregas: SubtaskEntrega[];
  /** Os comentários que a agência marcou como visíveis ao cliente. */
  conversa: { id: string; texto: string; created_at: string; meu: boolean }[];
};

export async function minhasAprovacoes(
  usuarioId: string,
  clienteId?: string,
): Promise<{
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
}> {
  const supabase = await criarClienteServidor();

  // Com cliente definido, a pergunta começa pelas tasks dele: assim o filtro
  // acontece no banco, e não depois de trazer o que não interessa.
  let idsPermitidos: string[] | null = null;
  if (clienteId) {
    const { data: tasksDoCliente } = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", clienteId);

    const ids = (tasksDoCliente ?? []).map((t) => t.id);
    if (ids.length === 0) return { esperando: [], decididas: [] };

    const { data: subtarefasDoCliente } = await supabase
      .from("subtasks")
      .select("id")
      .in("task_id", ids);

    idsPermitidos = (subtarefasDoCliente ?? []).map((s) => s.id);
    if (idsPermitidos.length === 0) return { esperando: [], decididas: [] };
  }

  let consulta = supabase
    .from("approval_rounds")
    .select("*")
    .eq("escopo", "cliente")
    // Idem: esta tela monta cada item a partir de uma subtarefa. Post e
    // entregável entram nos Sprints 12 e 13, com a consulta deles.
    .eq("content_type", "subtask");
  if (idsPermitidos) consulta = consulta.in("content_id", idsPermitidos);

  const { data: rodadas } = await consulta.order("solicitado_em", {
    ascending: false,
  });

  const todas = (rodadas ?? []) as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], decididas: [] };

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.content_id))];

  const [{ data: subtarefas }, { data: entregas }] = await Promise.all([
    supabase
      .from("subtasks")
      .select("id, task_id, titulo")
      .in("id", idsDeSubtarefas),
    supabase
      .from("subtask_entregas")
      .select("*")
      .in("subtask_id", idsDeSubtarefas),
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
    const sub = porSubtarefa.get(rodada.content_id);
    if (!sub) return null;
    return {
      rodadaId: rodada.id,
      subtaskId: sub.id,
      titulo: sub.titulo,
      demanda: porTask.get(sub.task_id)?.titulo ?? "",
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
