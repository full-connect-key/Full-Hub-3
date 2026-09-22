"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

import type { Resultado } from "./acoes";

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
  await exigirAcessoARota(ROTA);
  if (titulo.trim().length === 0) return { erro: "A subtarefa precisa de um título." };

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

  if (error) return { erro: `Não foi possível criar: ${error.message}` };
  revalidar(taskId);
  return { ok: "Subtarefa criada." };
}

export async function atualizarSubtarefa(
  id: string,
  taskId: string,
  campos: unknown,
): Promise<Resultado> {
  await exigirAcessoARota(ROTA);

  const validacao = esquemaDeSubtarefa.safeParse(campos);
  if (!validacao.success) return { erro: "Dados inválidos." };

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

  if (Object.keys(mudancas).length === 0) return { ok: "Nada a alterar." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("subtasks").update(mudancas).eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidar(taskId);
  return { ok: "Salvo." };
}

export async function removerSubtarefa(id: string, taskId: string): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("subtasks").delete().eq("id", id);
  if (error) return { erro: `Não foi possível remover: ${error.message}` };
  revalidar(taskId);
  return { ok: "Subtarefa removida." };
}

/** Grava a nova ordem depois do arrastar. Recebe os ids já na ordem final. */
export async function reordenarSubtarefas(taskId: string, ids: string[]): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  const supabase = await criarClienteServidor();

  const resultados = await Promise.all(
    ids.map((id, indice) => supabase.from("subtasks").update({ ordem: indice }).eq("id", id)),
  );

  const falha = resultados.find((r) => r.error);
  if (falha?.error) return { erro: `Não foi possível reordenar: ${falha.error.message}` };

  revalidar(taskId);
  return { ok: "Ordem salva." };
}

// --- referências ------------------------------------------------------------

export async function adicionarReferencia(
  taskId: string,
  referencia: { tipo: "link" | "arquivo"; url: string; titulo?: string; arquivo_nome?: string },
): Promise<Resultado> {
  const sessao = await exigirAcessoARota(ROTA);

  if (!referencia.url?.trim()) return { erro: "Informe o endereço." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("task_referencias").insert({
    task_id: taskId,
    tipo: referencia.tipo,
    url: referencia.url.trim(),
    titulo: vazioParaNulo(referencia.titulo),
    arquivo_nome: vazioParaNulo(referencia.arquivo_nome),
    adicionado_por: sessao.usuarioId,
  });

  if (error) return { erro: `Não foi possível adicionar: ${error.message}` };
  revalidar(taskId);
  return { ok: "Referência adicionada." };
}

export async function removerReferencia(id: string, taskId: string): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("task_referencias").delete().eq("id", id);
  if (error) return { erro: `Não foi possível remover: ${error.message}` };
  revalidar(taskId);
  return { ok: "Referência removida." };
}

/**
 * URL temporária para abrir um arquivo de referência.
 *
 * O bucket é privado: material de cliente não pode ficar acessível por link
 * solto. A URL assinada vale uma hora e é gerada sob a sessão de quem pediu,
 * então o RLS do Storage ainda vale.
 */
export async function urlDoArquivo(caminho: string): Promise<Resultado<string>> {
  await exigirAcessoARota(ROTA);

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.storage
    .from("task-arquivos")
    .createSignedUrl(caminho, 60 * 60);

  if (error || !data) return { erro: `Não foi possível abrir: ${error?.message ?? "erro"}` };
  return { dado: data.signedUrl };
}

// --- comentários ------------------------------------------------------------

export async function comentar(
  taskId: string,
  texto: string,
  respostaA?: string | null,
): Promise<Resultado> {
  const sessao = await exigirAcessoARota(ROTA);
  if (texto.trim().length === 0) return { erro: "Escreva alguma coisa." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("task_comentarios").insert({
    task_id: taskId,
    autor_id: sessao.usuarioId,
    texto: texto.trim(),
    resposta_a: respostaA || null,
  });

  if (error) return { erro: `Não foi possível comentar: ${error.message}` };
  revalidar(taskId);
  return { ok: "Comentário publicado." };
}

export async function removerComentario(id: string, taskId: string): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("task_comentarios").delete().eq("id", id);
  if (error) return { erro: `Não foi possível remover: ${error.message}` };
  revalidar(taskId);
  return { ok: "Comentário removido." };
}
