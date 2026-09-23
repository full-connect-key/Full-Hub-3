"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { interpretarTempo } from "@/lib/dominio/tempo";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database, Json, SubtaskStatus } from "@/lib/supabase/database.types";

type EdicaoDeSubtarefa = Database["public"]["Tables"]["subtasks"]["Update"];
type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;
type EventoDeHistorico = Database["public"]["Tables"]["task_history"]["Insert"];

const RECUSA_DO_BANCO = "O banco recusou a operação.";

const RECUSA_DA_SUBTAREFA =
  "O banco recusou a operação. A subtarefa é de quem a executa: só o responsável por ela, " +
  "o Atendimento e a gestão conseguem mexer.";

/**
 * Histórico. Nunca some e nunca é reescrito — é o que permite reconstruir o
 * que foi pedido e o que foi decidido meses depois.
 */
async function registrar(supabase: ClienteSupabase, evento: EventoDeHistorico) {
  await supabase.from("task_history").insert(evento);
}

/**
 * Ações das partes de uma task: subtarefas, referências e comentários.
 *
 * Todas dependem da permissão da task-mãe, que o RLS resolve pela função
 * pode_editar_task() — aqui não repetimos a regra.
 */

const ROTA = "/painel/gestao-tasks";

function revalidar(taskId: string) {
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/${taskId}`);
}

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/** Tempo chega como texto livre ("2h30", "150"). Aqui vira minuto inteiro. */
function minutosOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor) : null;
  const lido = interpretarTempo(String(valor));
  return lido ?? null;
}

// --- subtarefas -------------------------------------------------------------

const esquemaDeSubtarefa = z.object({
  /** A etapa de cima, quando esta é uma sub-etapa (migration 0022). Só na
   *  criação: mudar de mãe é arrastar, e ainda não existe essa tela. */
  parent_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1).optional(),
  data_inicio: z.string().nullable().optional(),
  descricao_rica: z.unknown().optional(),
  descricao_texto: z.string().nullable().optional(),
  prazo: z.string().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]).optional(),
  requer_aprovacao: z.boolean().optional(),
  tipo_aprovacao: z.enum(["interna", "cliente"]).nullable().optional(),
  estimativa: z.union([z.number(), z.string(), z.null()]).optional(),
  ordem: z.number().int().optional(),
});

/**
 * Criar subtarefa é do Atendimento e da gestão — é a policy `subtasks_insert`
 * que diz isso, e a tela apenas não mostra o campo para os outros.
 */
export async function criarSubtarefa(
  taskId: string,
  dados: { titulo: string } & Record<string, unknown>,
): Promise<Resultado<string>> {
  return executarAcao("criarSubtarefa", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDeSubtarefa.safeParse(dados);
    if (!validacao.success) return falha("Confira os dados da subtarefa.");
    const entrada = validacao.data;

    if (!entrada.titulo?.trim()) return falha("A subtarefa precisa de um título.");
    if (entrada.requer_aprovacao && !entrada.tipo_aprovacao) {
      return falha("Diga de que tipo é a aprovação: interna ou do cliente.");
    }

    const supabase = await criarClienteServidor();

    // A ordem é contada DENTRO da etapa de cima quando há uma: a sub-etapa é
    // a primeira da mãe dela, não a oitava da demanda. Contar sobre a task
    // inteira faria a lista de cada mãe começar num número qualquer.
    const consultaDaOrdem = supabase.from("subtasks").select("ordem").eq("task_id", taskId);
    const { data: ultima } = await (entrada.parent_id
      ? consultaDaOrdem.eq("parent_id", entrada.parent_id)
      : consultaDaOrdem.is("parent_id", null)
    )
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        parent_id: entrada.parent_id || null,
        titulo: entrada.titulo.trim(),
        data_inicio: vazioParaNulo(entrada.data_inicio),
        prazo: vazioParaNulo(entrada.prazo),
        responsavel_id: entrada.responsavel_id || null,
        prioridade: entrada.prioridade ?? "normal",
        requer_aprovacao: entrada.requer_aprovacao ?? false,
        tipo_aprovacao: entrada.requer_aprovacao ? (entrada.tipo_aprovacao ?? "interna") : null,
        estimativa_minutos: minutosOuNulo(entrada.estimativa),
        ordem: (ultima?.ordem ?? 0) + 1,
      })
      .select("id")
      .single();

    if (error || !data) {
      return falha(`Não foi possível criar a subtarefa: ${error?.message ?? RECUSA_DO_BANCO}`);
    }

    await registrar(supabase, {
      task_id: taskId,
      subtask_id: data.id,
      acao: "subtarefa_criada",
      para_valor: entrada.titulo.trim(),
      autor_id: sessao.usuarioId,
    });

    revalidar(taskId);
    return sucesso("Subtarefa criada.", data.id);
  });
}

/**
 * Edição dos campos da subtarefa. O STATUS não passa por aqui: ele tem ação
 * própria (`moverSubtarefa`), que checa a máquina de estados antes.
 */
export async function atualizarSubtarefa(
  id: string,
  taskId: string,
  campos: unknown,
): Promise<Resultado> {
  return executarAcao("atualizarSubtarefa", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDeSubtarefa.safeParse(campos);
    if (!validacao.success) return falha("Dados inválidos.");
    const entrada = validacao.data;

    const mudancas: EdicaoDeSubtarefa = {};
    if (entrada.titulo !== undefined) mudancas.titulo = entrada.titulo.trim();
    if (entrada.descricao_rica !== undefined)
      mudancas.descricao_rica = (entrada.descricao_rica ?? null) as Json | null;
    if (entrada.descricao_texto !== undefined) mudancas.descricao_texto = entrada.descricao_texto;
    if (entrada.data_inicio !== undefined)
      mudancas.data_inicio = vazioParaNulo(entrada.data_inicio);
    if (entrada.prazo !== undefined) mudancas.prazo = vazioParaNulo(entrada.prazo);
    if (entrada.responsavel_id !== undefined) mudancas.responsavel_id = entrada.responsavel_id;
    if (entrada.prioridade !== undefined) mudancas.prioridade = entrada.prioridade;
    if (entrada.estimativa !== undefined)
      mudancas.estimativa_minutos = minutosOuNulo(entrada.estimativa);
    if (entrada.ordem !== undefined) mudancas.ordem = entrada.ordem;

    // O par (requer_aprovacao, tipo_aprovacao) tem check no banco: ou os dois
    // preenchidos, ou os dois vazios. Mandar um sem o outro seria erro de SQL
    // na cara do usuário; aqui vira mensagem.
    if (entrada.requer_aprovacao !== undefined) {
      mudancas.requer_aprovacao = entrada.requer_aprovacao;
      mudancas.tipo_aprovacao = entrada.requer_aprovacao
        ? (entrada.tipo_aprovacao ?? "interna")
        : null;
    } else if (entrada.tipo_aprovacao !== undefined) {
      mudancas.tipo_aprovacao = entrada.tipo_aprovacao;
      mudancas.requer_aprovacao = entrada.tipo_aprovacao !== null;
    }

    if (Object.keys(mudancas).length === 0) return sucesso("Nada a alterar.");

    const supabase = await criarClienteServidor();

    const anterior =
      entrada.responsavel_id !== undefined
        ? await supabase.from("subtasks").select("responsavel_id").eq("id", id).maybeSingle()
        : null;

    const { data, error } = await supabase
      .from("subtasks")
      .update(mudancas)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA_DA_SUBTAREFA);

    if (anterior?.data && anterior.data.responsavel_id !== entrada.responsavel_id) {
      await registrar(supabase, {
        task_id: taskId,
        subtask_id: id,
        acao: "responsavel_alterado",
        de_valor: anterior.data.responsavel_id,
        para_valor: entrada.responsavel_id ?? null,
        autor_id: sessao.usuarioId,
      });
    }

    revalidar(taskId);
    return sucesso("Salvo.");
  });
}

/**
 * Mover a subtarefa de status.
 *
 * As transições que o banco recusa (concluir o que exige aprovação, sair de
 * `nao_iniciada` com dependência aberta) chegam aqui como erro de trigger. A
 * mensagem do Postgres já é escrita para ser lida por gente — ela vem com o
 * nome da subtarefa e o que está faltando —, então é ela que vai para a tela.
 */
export async function moverSubtarefa(
  id: string,
  taskId: string,
  destino: SubtaskStatus,
  tempoReal?: number | string | null,
): Promise<Resultado> {
  return executarAcao("moverSubtarefa", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const { data: antes } = await supabase
      .from("subtasks")
      .select("status, titulo")
      .eq("id", id)
      .maybeSingle();
    if (!antes) return falha("Subtarefa não encontrada.");

    const mudancas: EdicaoDeSubtarefa = { status: destino };
    if (tempoReal !== undefined) mudancas.tempo_real_minutos = minutosOuNulo(tempoReal);

    const { data, error } = await supabase
      .from("subtasks")
      .update(mudancas)
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha(RECUSA_DA_SUBTAREFA);

    await registrar(supabase, {
      task_id: taskId,
      subtask_id: id,
      acao: "status_da_subtarefa",
      de_valor: antes.status,
      para_valor: data.status,
      autor_id: sessao.usuarioId,
    });

    revalidar(taskId);
    return sucesso("Salvo.");
  });
}

export async function removerSubtarefa(id: string, taskId: string): Promise<Resultado> {
  return executarAcao("removerSubtarefa", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("subtasks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    if (!data) return falha(RECUSA_DA_SUBTAREFA);
    revalidar(taskId);
    return sucesso("Subtarefa removida.");
  });
}

export async function reordenarSubtarefas(taskId: string, ids: string[]): Promise<Resultado> {
  return executarAcao("reordenarSubtarefas", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    for (const [indice, id] of ids.entries()) {
      const { error } = await supabase
        .from("subtasks")
        .update({ ordem: indice + 1 })
        .eq("id", id);
      if (error) return falha(`Não foi possível reordenar: ${error.message}`);
    }

    revalidar(taskId);
    return sucesso("Ordem salva.");
  });
}

// --- dependências -----------------------------------------------------------

export async function vincularDependencia(
  taskId: string,
  subtaskId: string,
  dependeDeId: string,
): Promise<Resultado> {
  return executarAcao("vincularDependencia", async () => {
    await exigirRotaNaAcao(ROTA);
    if (subtaskId === dependeDeId) return falha("Uma subtarefa não depende de si mesma.");

    const supabase = await criarClienteServidor();
    // O ciclo é recusado por trigger, com a mensagem por extenso. Aqui ela
    // passa direto para a tela em vez de virar "erro ao salvar".
    const { error } = await supabase
      .from("subtask_dependencies")
      .insert({ subtask_id: subtaskId, depende_de_id: dependeDeId });

    if (error) return falha(error.message);
    revalidar(taskId);
    return sucesso("Dependência criada.");
  });
}

export async function desvincularDependencia(
  taskId: string,
  subtaskId: string,
  dependeDeId: string,
): Promise<Resultado> {
  return executarAcao("desvincularDependencia", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("subtask_dependencies")
      .delete()
      .eq("subtask_id", subtaskId)
      .eq("depende_de_id", dependeDeId);
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    revalidar(taskId);
    return sucesso("Dependência removida.");
  });
}

// --- referências ------------------------------------------------------------

export async function adicionarReferencia(
  taskId: string,
  referencia: { tipo: "link" | "arquivo"; url: string; titulo?: string; arquivo_nome?: string },
): Promise<Resultado> {
  return executarAcao("adicionarReferencia", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    if (!referencia.url?.trim()) return falha("Informe o endereço.");

    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("task_referencias").insert({
      task_id: taskId,
      tipo: referencia.tipo,
      url: referencia.url.trim(),
      titulo: vazioParaNulo(referencia.titulo),
      arquivo_nome: vazioParaNulo(referencia.arquivo_nome),
      adicionado_por: sessao.usuarioId,
    });

    if (error) return falha(`Não foi possível adicionar: ${error.message}`);
    revalidar(taskId);
    return sucesso("Referência adicionada.");
  });
}

export async function removerReferencia(id: string, taskId: string): Promise<Resultado> {
  return executarAcao("removerReferencia", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("task_referencias").delete().eq("id", id);
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    revalidar(taskId);
    return sucesso("Referência removida.");
  });
}

/**
 * URL temporária para abrir um arquivo de referência.
 *
 * O bucket é privado: material de cliente não pode ficar acessível por link
 * solto. A URL assinada vale uma hora e é gerada sob a sessão de quem pediu,
 * então o RLS do Storage ainda vale.
 */
export async function urlDoArquivo(caminho: string): Promise<Resultado<string>> {
  return executarAcao("urlDoArquivo", async () => {
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.storage
      .from("task-arquivos")
      .createSignedUrl(caminho, 60 * 60);

    if (error || !data) return falha(`Não foi possível abrir: ${error?.message ?? "erro"}`);
    return sucesso("Link gerado.", data.signedUrl);
  });
}

// --- comentários ------------------------------------------------------------

/**
 * Comentar na task ou numa subtarefa dela.
 *
 * `interno` é true por padrão, e a tela precisa de um gesto explícito para
 * desmarcar: conversa de equipe não vaza para o Portal por esquecimento.
 */
export async function comentar(
  taskId: string,
  texto: string,
  opcoes?: { respostaA?: string | null; subtaskId?: string | null; interno?: boolean },
): Promise<Resultado> {
  return executarAcao("comentar", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    if (texto.trim().length === 0) return falha("Escreva alguma coisa.");

    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("task_comentarios").insert({
      task_id: taskId,
      subtask_id: opcoes?.subtaskId || null,
      autor_id: sessao.usuarioId,
      texto: texto.trim(),
      interno: opcoes?.interno ?? true,
      resposta_a: opcoes?.respostaA || null,
    });

    if (error) return falha(`Não foi possível comentar: ${error.message}`);
    revalidar(taskId);
    return sucesso("Comentário publicado.");
  });
}

export async function removerComentario(id: string, taskId: string): Promise<Resultado> {
  return executarAcao("removerComentario", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("task_comentarios").delete().eq("id", id);
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    revalidar(taskId);
    return sucesso("Comentário removido.");
  });
}

// --- entregas da subtarefa --------------------------------------------------

/**
 * O material produzido: arquivo no bucket privado ou link.
 *
 * O caminho do arquivo segue a convenção `entregas/<subtask_id>/<nome>` — é
 * por ela que a policy do Storage consegue decidir, por subtarefa, se o
 * cliente pode abrir aquele arquivo.
 */
export async function anexarEntrega(
  taskId: string,
  subtaskId: string,
  entrega: { tipo: "link" | "arquivo"; url: string; nome?: string | null },
): Promise<Resultado> {
  return executarAcao("anexarEntrega", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    if (!entrega.url?.trim()) return falha("Informe o endereço ou envie o arquivo.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("subtask_entregas")
      .insert({
        subtask_id: subtaskId,
        tipo: entrega.tipo,
        url: entrega.url.trim(),
        nome: vazioParaNulo(entrega.nome),
        enviado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível anexar: ${error.message}`);
    if (!data) {
      return falha(
        "O banco recusou o anexo. Anexar entrega é do responsável pela subtarefa, do " +
          "Atendimento ou da gestão.",
      );
    }

    await registrar(supabase, {
      task_id: taskId,
      subtask_id: subtaskId,
      acao: "entrega_anexada",
      para_valor: entrega.nome ?? entrega.url,
      autor_id: sessao.usuarioId,
    });

    revalidar(taskId);
    return sucesso("Entrega anexada.");
  });
}

export async function removerEntrega(id: string, taskId: string): Promise<Resultado> {
  return executarAcao("removerEntrega", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("subtask_entregas")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    if (!data) return falha(RECUSA_DO_BANCO);
    revalidar(taskId);
    return sucesso("Entrega removida.");
  });
}
