"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type EdicaoDeSubtarefa = Database["public"]["Tables"]["subtasks"]["Update"];

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

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

// --- subtarefas -------------------------------------------------------------

const esquemaDeSubtarefa = z.object({
  titulo: z.string().min(1).optional(),
  prazo: z.string().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  estimativa_horas: z.union([z.number(), z.string(), z.null()]).optional(),
  tempo_real_horas: z.union([z.number(), z.string(), z.null()]).optional(),
  concluida: z.boolean().optional(),
});

export async function criarSubtarefa(taskId: string, titulo: string): Promise<Resultado> {
  return executarAcao("criarSubtarefa", async () => {
    await exigirRotaNaAcao(ROTA);
    if (titulo.trim().length === 0) return falha("A subtarefa precisa de um título.");

    const supabase = await criarClienteServidor();

    const { data: ultima } = await supabase
      .from("subtasks")
      .select("ordem")
      .eq("task_id", taskId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("subtasks").insert({
      task_id: taskId,
      titulo: titulo.trim(),
      ordem: (ultima?.ordem ?? -1) + 1,
    });

    if (error) return falha(`Não foi possível criar: ${error.message}`);
    revalidar(taskId);
    return sucesso("Subtarefa criada.");
  });
}

export async function atualizarSubtarefa(
  id: string,
  taskId: string,
  campos: unknown,
): Promise<Resultado> {
  return executarAcao("atualizarSubtarefa", async () => {
    await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDeSubtarefa.safeParse(campos);
    if (!validacao.success) return falha("Dados inválidos.");

    const mudancas: EdicaoDeSubtarefa = {};
    const entrada = validacao.data;
    if (entrada.titulo !== undefined) mudancas.titulo = entrada.titulo.trim();
    if (entrada.prazo !== undefined) mudancas.prazo = vazioParaNulo(entrada.prazo);
    if (entrada.responsavel_id !== undefined) mudancas.responsavel_id = entrada.responsavel_id;
    if (entrada.estimativa_horas !== undefined)
      mudancas.estimativa_horas = numeroOuNulo(entrada.estimativa_horas);
    if (entrada.tempo_real_horas !== undefined)
      mudancas.tempo_real_horas = numeroOuNulo(entrada.tempo_real_horas);
    if (entrada.concluida !== undefined) {
      mudancas.concluida = entrada.concluida;
      // Marcar como concluída registra data e hora; desmarcar apaga o registro.
      mudancas.concluida_em = entrada.concluida ? new Date().toISOString() : null;
    }

    if (Object.keys(mudancas).length === 0) return sucesso("Nada a alterar.");

    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("subtasks").update(mudancas).eq("id", id);

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    revalidar(taskId);
    return sucesso("Salvo.");
  });
}

export async function removerSubtarefa(id: string, taskId: string): Promise<Resultado> {
  return executarAcao("removerSubtarefa", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("subtasks").delete().eq("id", id);
    if (error) return falha(`Não foi possível remover: ${error.message}`);
    revalidar(taskId);
    return sucesso("Subtarefa removida.");
  });
}

/** Grava a nova ordem depois do arrastar. Recebe os ids já na ordem final. */
export async function reordenarSubtarefas(taskId: string, ids: string[]): Promise<Resultado> {
  return executarAcao("reordenarSubtarefas", async () => {
    await exigirRotaNaAcao(ROTA);
    const supabase = await criarClienteServidor();

    const resultados = await Promise.all(
      ids.map((id, indice) => supabase.from("subtasks").update({ ordem: indice }).eq("id", id)),
    );

    const problema = resultados.find((r) => r.error);
    if (problema?.error) return falha(`Não foi possível reordenar: ${problema.error.message}`);

    revalidar(taskId);
    return sucesso("Ordem salva.");
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

export async function comentar(
  taskId: string,
  texto: string,
  respostaA?: string | null,
): Promise<Resultado> {
  return executarAcao("comentar", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);
    if (texto.trim().length === 0) return falha("Escreva alguma coisa.");

    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("task_comentarios").insert({
      task_id: taskId,
      autor_id: sessao.usuarioId,
      texto: texto.trim(),
      resposta_a: respostaA || null,
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
