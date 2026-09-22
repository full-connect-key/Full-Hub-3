import "server-only";

import { format } from "date-fns";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { WeeklyNote } from "@/lib/supabase/database.types";

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

export type SubtarefaConcluida = {
  id: string;
  titulo: string;
  cliente: string | null;
  clientId: string | null;
  /** O dia em que a etapa foi fechada — é ele que data a entrega puxada. */
  concluidaEm: string;
};

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
): Promise<SubtarefaConcluida[]> {
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
      concluidaEm: sub.updated_at.slice(0, 10),
    };
  });
}

/** O texto livre de uma semana. Null quando a pessoa ainda não escreveu. */
export async function notaDaSemana(inicioISO: string): Promise<WeeklyNote | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("weekly_notes")
    .select("*")
    .eq("semana", inicioISO)
    .maybeSingle();
  return data ?? null;
}

export type AchadoDaBusca = {
  semana: string;
  /** O trecho que casou, já com o termo em volta. */
  trecho: string;
  origem: "entrega" | "nota";
};

/**
 * Busca no próprio histórico.
 *
 * Procura nas DUAS coisas — a descrição das entregas e o texto da semana —
 * porque quem procura "campanha de outubro" não lembra em qual das duas
 * escreveu. O JSON do TipTap fica de fora: `conteudo_texto` existe justamente
 * para isso, já que procurar dentro do JSON com `ilike` acharia nomes de nó.
 */
export async function buscarNoHistorico(termo: string): Promise<AchadoDaBusca[]> {
  const limpo = termo.trim();
  if (limpo.length < 2) return [];

  const supabase = await criarClienteServidor();
  const padrao = `%${limpo}%`;

  const [{ data: entregas }, { data: notas }] = await Promise.all([
    supabase
      .from("weekly_entries")
      .select("data, descricao")
      .ilike("descricao", padrao)
      .order("data", { ascending: false })
      .limit(40),
    supabase
      .from("weekly_notes")
      .select("semana, conteudo_texto")
      .ilike("conteudo_texto", padrao)
      .order("semana", { ascending: false })
      .limit(40),
  ]);

  const achados: AchadoDaBusca[] = [];

  for (const entrega of entregas ?? []) {
    achados.push({
      semana: segundaDa(entrega.data),
      trecho: entrega.descricao,
      origem: "entrega",
    });
  }

  for (const nota of notas ?? []) {
    achados.push({
      semana: nota.semana,
      trecho: recorte(nota.conteudo_texto ?? "", limpo),
      origem: "nota",
    });
  }

  return achados.sort((a, b) => b.semana.localeCompare(a.semana));
}

/** A segunda-feira de uma data ISO, sem depender do fuso do servidor. */
function segundaDa(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const recuo = (data.getUTCDay() + 6) % 7;
  data.setUTCDate(data.getUTCDate() - recuo);
  return data.toISOString().slice(0, 10);
}

/** Um pedaço do texto em volta do termo, para a lista não despejar a semana inteira. */
function recorte(texto: string, termo: string): string {
  const onde = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (onde < 0) return texto.slice(0, 120);
  const de = Math.max(0, onde - 50);
  const ate = Math.min(texto.length, onde + termo.length + 70);
  return `${de > 0 ? "…" : ""}${texto.slice(de, ate)}${ate < texto.length ? "…" : ""}`;
}

/**
 * Todo o histórico, para exportar.
 *
 * Um arquivo de texto e não PDF: o que a pessoa faz com isso é colar num
 * documento, mandar num chat ou guardar. Texto puro serve para os três, e não
 * depende de nada instalado.
 */
export async function historicoParaExportar(): Promise<
  { semana: string; nota: string | null; humor: string | null; entregas: { data: string; descricao: string }[] }[]
> {
  const supabase = await criarClienteServidor();

  const [{ data: entregas }, { data: notas }] = await Promise.all([
    supabase.from("weekly_entries").select("data, descricao").order("data"),
    supabase.from("weekly_notes").select("semana, conteudo_texto, humor").order("semana"),
  ]);

  const porSemana = new Map<
    string,
    { semana: string; nota: string | null; humor: string | null; entregas: { data: string; descricao: string }[] }
  >();

  const garantir = (semana: string) => {
    const atual = porSemana.get(semana) ?? { semana, nota: null, humor: null, entregas: [] };
    porSemana.set(semana, atual);
    return atual;
  };

  for (const entrega of entregas ?? []) {
    garantir(segundaDa(entrega.data)).entregas.push(entrega);
  }
  for (const nota of notas ?? []) {
    const alvo = garantir(nota.semana);
    alvo.nota = nota.conteudo_texto;
    alvo.humor = nota.humor;
  }

  return [...porSemana.values()].sort((a, b) => b.semana.localeCompare(a.semana));
}

/**
 * As subtarefas que a pessoa concluiu na semana e que AINDA NÃO viraram
 * entrega registrada.
 *
 * O filtro por `subtask_id` é o que impede o botão "puxar minhas entregas" de
 * duplicar tudo quando alguém clica duas vezes — e clicar duas vezes é o que
 * acontece quando a primeira parece não ter feito nada.
 *
 * A data vem de `concluidaEm`, e é limitada a hoje. `updated_at` é timestamptz
 * lido em UTC: uma etapa fechada às 22h de domingo no horário de Brasília
 * viraria segunda, e o trigger `weekly_entries_sem_futuro` recusaria a
 * gravação inteira — as outras entregas junto.
 */
export async function subtarefasAindaNaoRegistradas(
  usuarioId: string,
  inicio: Date,
  fim: Date,
): Promise<SubtarefaConcluida[]> {
  const supabase = await criarClienteServidor();

  const concluidas = await subtarefasConcluidasNaSemana(usuarioId, inicio, fim);
  if (concluidas.length === 0) return [];

  const { data: jaRegistradas } = await supabase
    .from("weekly_entries")
    .select("subtask_id")
    .not("subtask_id", "is", null);

  const usadas = new Set((jaRegistradas ?? []).map((e) => e.subtask_id));

  const hojeISO = format(new Date(), "yyyy-MM-dd");

  return concluidas
    .filter((s) => !usadas.has(s.id))
    .map((s) => ({ ...s, concluidaEm: s.concluidaEm > hojeISO ? hojeISO : s.concluidaEm }));
}
