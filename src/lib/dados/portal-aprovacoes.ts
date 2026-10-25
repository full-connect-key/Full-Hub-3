import "server-only";

import { ouFalha } from "./consulta";

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
  /** O prazo da etapa, quando ela tem um. É por ele que a fila ordena. */
  prazo: string | null;
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
    const tasksDoCliente = ouFalha(
      "as demandas da empresa",
      await supabase.from("tasks").select("id").eq("client_id", clienteId),
    );

    const ids = tasksDoCliente.map((t) => t.id);
    if (ids.length === 0) return { esperando: [], decididas: [] };

    const subtarefasDoCliente = ouFalha(
      "as etapas das demandas da empresa",
      await supabase.from("subtasks").select("id").in("task_id", ids),
    );

    idsPermitidos = subtarefasDoCliente.map((s) => s.id);
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

  const rodadas = ouFalha(
    "as aprovações do cliente",
    await consulta.order("solicitado_em", { ascending: false }),
  );

  const todas = rodadas as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], decididas: [] };

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.content_id))];

  const [respostaDeSubtarefas, respostaDeEntregas] = await Promise.all([
    supabase
      .from("subtasks")
      .select("id, task_id, titulo, prazo")
      .in("id", idsDeSubtarefas),
    supabase
      .from("subtask_entregas")
      .select("*")
      .in("subtask_id", idsDeSubtarefas),
  ]);
  const subtarefas = ouFalha("as etapas em aprovação", respostaDeSubtarefas);
  const entregas = ouFalha("os arquivos entregues", respostaDeEntregas);

  const idsDeTasks = [...new Set(subtarefas.map((s) => s.task_id))];

  const [respostaDeTasks, respostaDeComentarios] = await Promise.all([
    idsDeTasks.length
      ? supabase.from("tasks").select("id, titulo").in("id", idsDeTasks)
      : Promise.resolve({ data: [] as { id: string; titulo: string }[], error: null }),
    supabase
      .from("task_comentarios")
      .select("id, subtask_id, autor_id, texto, created_at")
      .eq("interno", false)
      .in("subtask_id", idsDeSubtarefas)
      .order("created_at"),
  ]);
  const tasks = ouFalha("as demandas em aprovação", respostaDeTasks);
  const comentarios = ouFalha("a conversa de cada material", respostaDeComentarios);

  const porSubtarefa = new Map(subtarefas.map((s) => [s.id, s]));
  const porTask = new Map(tasks.map((t) => [t.id, t]));

  const montar = (rodada: ApprovalRound): AprovacaoDoCliente | null => {
    const sub = porSubtarefa.get(rodada.content_id);
    if (!sub) return null;
    return {
      rodadaId: rodada.id,
      subtaskId: sub.id,
      titulo: sub.titulo,
      demanda: porTask.get(sub.task_id)?.titulo ?? "",
      numeroRodada: rodada.numero_rodada,
      prazo: sub.prazo,
      status: rodada.status,
      enviadaEm: rodada.solicitado_em,
      decididaEm: rodada.decidido_em,
      comentario: rodada.comentario,
      entregas: entregas.filter((e) => e.subtask_id === sub.id),
      conversa: comentarios
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
    // A FILA ORDENA POR PRAZO, e não pela ordem em que as coisas chegaram.
    //
    // A consulta traz por `solicitado_em` decrescente, que é a ordem certa
    // para o HISTÓRICO — o que foi decidido por último em cima — e a errada
    // para a fila: o material que vence amanhã ficava embaixo do que chegou
    // hoje e vence semana que vem. É a decisão da caixa de entrada das
    // solicitações, virada: lá a pergunta é quem espera há mais tempo, aqui é
    // o que vence primeiro.
    //
    // **Sem prazo vai para o FIM**, nunca para o topo: um material sem data é
    // o que menos cobra, e `null` ordenado como string o poria na frente de
    // tudo. É a regra de `focoDoPrazo` e de `ordenarPorUrgencia`.
    esperando: montadas
      .filter((a) => a.status === "pendente")
      .sort(porUrgencia),
    decididas: montadas.filter((a) => a.status !== "pendente"),
  };
}

/** Prazo crescente, e quem não tem prazo no fim. */
function porUrgencia(a: AprovacaoDoCliente, b: AprovacaoDoCliente): number {
  if (a.prazo !== b.prazo) {
    if (!a.prazo) return 1;
    if (!b.prazo) return -1;
    return a.prazo.localeCompare(b.prazo);
  }
  // O DESEMPATE É A CHEGADA, da mais antiga para a mais nova: entre dois
  // materiais que vencem no mesmo dia, o que está esperando há mais tempo vem
  // primeiro.
  return a.enviadaEm.localeCompare(b.enviadaEm);
}

/**
 * QUANTOS MATERIAIS ESPERAM A DECISÃO — o número do selo de Aprovações.
 *
 * ---------------------------------------------------------------------------
 * **O selo existia na barra lateral desde que ela nasceu, e nada o alimentava.**
 * O comentário de `ListaDaBarraDoPortal` dizia que ele seria ligado "quando a
 * tela de Aprovações entrar" — e ela já estava lá. Mais uma ponte construída e
 * não atravessada.
 *
 * **É UMA CONTAGEM E NÃO `minhasAprovacoes()`**, que é a razão de ela existir:
 * aquela função faz seis idas ao banco e monta a conversa de cada material,
 * e esta roda no LAYOUT — ou seja, em toda tela do portal. O que o selo
 * precisa é de um número.
 *
 * **E ela conta exatamente o que a fila lista**, `content_type = 'subtask'` e
 * escopo cliente: um selo que cobrasse mais do que a tela de destino mostra
 * mandaria a pessoa procurar um material que não está lá.
 *
 * **Ela não derruba a tela**, e é a decisão de `rotinasAgendadas()`: o portal
 * funciona inteiro sem o selo, e trocar uma informação a menos por uma falha
 * total seria o pior dos dois. O erro vai para o log, senão um selo que
 * parasse de aparecer para todo mundo seria descoberto por alguém perguntando
 * à agência se o material chegou.
 * ---------------------------------------------------------------------------
 */
export async function quantasEsperamDecisao(
  clienteId?: string,
): Promise<number> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("approval_rounds")
    .select("id", { count: "exact", head: true })
    .eq("escopo", "cliente")
    .eq("content_type", "subtask")
    .eq("status", "pendente");

  // A VISUALIZAÇÃO ADMINISTRATIVA PRECISA DO FILTRO, e a do cliente não: o
  // RLS já recorta as linhas dele. Para quem é da equipe, `is_staff()`
  // enxerga todos os clientes — sem isto o selo do portal da Mundo Verde
  // contaria as aprovações da Óptica Visão.
  if (clienteId) {
    const tasks = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", clienteId);
    const ids = (tasks.data ?? []).map((t) => t.id);
    if (ids.length === 0) return 0;

    const subs = await supabase
      .from("subtasks")
      .select("id")
      .in("task_id", ids);
    const idsDeSubtarefas = (subs.data ?? []).map((s) => s.id);
    if (idsDeSubtarefas.length === 0) return 0;

    consulta = consulta.in("content_id", idsDeSubtarefas);
  }

  const { count, error } = await consulta;
  if (error) {
    console.error("[consulta:o selo de aprovações do portal]", error);
    return 0;
  }
  return count ?? 0;
}
