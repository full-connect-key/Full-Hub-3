import "server-only";

import { format } from "date-fns";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O Resumo Semanal de quem está logado.
 *
 * Só o próprio: a RLS de `weekly_entries` fecha em `user_id = auth.uid()`, e
 * nem a sócia lê o de outra pessoa. Esta camada não repete a regra — ela
 * confia no banco, que é onde a regra vale de verdade.
 */

export type EntregaDaSemana = {
  id: string;
  data: string;
  descricao: string;
  cliente: { id: string; nome_empresa: string } | null;
  subtarefa: { id: string; titulo: string } | null;
};

export async function entregasDaSemana(
  inicio: Date,
  fim: Date,
): Promise<EntregaDaSemana[]> {
  const supabase = await criarClienteServidor();

  const { data: linhas } = await supabase
    .from("weekly_entries")
    .select("*")
    .gte("data", format(inicio, "yyyy-MM-dd"))
    .lte("data", format(fim, "yyyy-MM-dd"))
    .order("data", { ascending: true })
    .order("created_at", { ascending: true });

  const entregas = linhas ?? [];
  if (entregas.length === 0) return [];

  const idsDeClientes = [...new Set(entregas.map((e) => e.client_id).filter(Boolean))] as string[];
  const idsDeSubtarefas = [
    ...new Set(entregas.map((e) => e.subtask_id).filter(Boolean)),
  ] as string[];

  const [{ data: clientes }, { data: subtarefas }] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    idsDeSubtarefas.length
      ? supabase.from("subtasks").select("id, titulo").in("id", idsDeSubtarefas)
      : Promise.resolve({ data: [] as { id: string; titulo: string }[] }),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porSubtarefa = new Map((subtarefas ?? []).map((s) => [s.id, s]));

  return entregas.map((entrega) => ({
    id: entrega.id,
    data: entrega.data,
    descricao: entrega.descricao,
    cliente: entrega.client_id ? (porCliente.get(entrega.client_id) ?? null) : null,
    subtarefa: entrega.subtask_id ? (porSubtarefa.get(entrega.subtask_id) ?? null) : null,
  }));
}

/**
 * As subtarefas que a pessoa concluiu na semana, para o campo de vínculo.
 *
 * Só as concluídas, e só as dela. O vínculo existe para poupar digitação no
 * caso mais comum — "entreguei a arte da campanha" é uma subtarefa que acabou
 * de ser fechada —, então oferecer o que ainda não terminou seria oferecer o
 * que ninguém vai escolher.
 */
export async function subtarefasConcluidasNaSemana(
  usuarioId: string,
  inicio: Date,
  fim: Date,
): Promise<{ id: string; titulo: string; cliente: string | null; clientId: string | null }[]> {
  const supabase = await criarClienteServidor();

  const { data: subtarefas } = await supabase
    .from("subtasks")
    .select("id, titulo, task_id, updated_at")
    .eq("responsavel_id", usuarioId)
    .eq("status", "concluida")
    .gte("updated_at", format(inicio, "yyyy-MM-dd"))
    .lte("updated_at", `${format(fim, "yyyy-MM-dd")}T23:59:59`)
    .order("updated_at", { ascending: false })
    .limit(30);

  const lista = subtarefas ?? [];
  if (lista.length === 0) return [];

  const idsDeTasks = [...new Set(lista.map((s) => s.task_id))];
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, client_id")
    .in("id", idsDeTasks);

  const idsDeClientes = [
    ...new Set((tasks ?? []).map((t) => t.client_id).filter(Boolean)),
  ] as string[];

  const { data: clientes } = idsDeClientes.length
    ? await supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
    : { data: [] as { id: string; nome_empresa: string }[] };

  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  return lista.map((sub) => {
    const clientId = porTask.get(sub.task_id)?.client_id ?? null;
    return {
      id: sub.id,
      titulo: sub.titulo,
      clientId,
      cliente: clientId ? (porCliente.get(clientId)?.nome_empresa ?? null) : null,
    };
  });
}
