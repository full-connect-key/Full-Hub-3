"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

/** O update tipado da tabela: evita mandar coluna que nao existe. */
type EdicaoDeTask = Database["public"]["Tables"]["tasks"]["Update"];

export type Resultado<T = undefined> = { ok?: string; erro?: string; dado?: T };

/**
 * Ações do módulo de tasks.
 *
 * Tudo passa pelo cliente Supabase da própria pessoa: quem pode criar e editar
 * é o RLS que decide (gestão, Atendimento ou quem é responsável pela task).
 * A checagem de rota aqui é a primeira barreira, não a única.
 */

const ROTA = "/painel/gestao-tasks";

const prioridade = z.enum(["baixa", "normal", "alta", "urgente"]);
const status = z.enum([
  "aberta",
  "em_andamento",
  "aguardando_aprovacao",
  "concluida",
  "cancelada",
]);

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

const esquemaDeSubtarefa = z.object({
  titulo: z.string().min(1, "A subtarefa precisa de um título."),
  prazo: z.string().optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  estimativa_horas: z.union([z.number(), z.string(), z.null()]).optional(),
});

const esquemaDeReferencia = z.object({
  tipo: z.enum(["link", "arquivo"]),
  url: z.string().min(1),
  titulo: z.string().optional().nullable(),
  arquivo_nome: z.string().optional().nullable(),
});

const esquemaDeTask = z.object({
  titulo: z.string().min(2, "Informe o título da task."),
  client_id: z.string().uuid().optional().nullable(),
  briefing_rico: z.unknown().optional().nullable(),
  briefing_texto: z.string().optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  prazo: z.string().optional().nullable(),
  prioridade: prioridade.default("normal"),
  estimativa_horas: z.union([z.number(), z.string(), z.null()]).optional(),
  subtarefas: z.array(esquemaDeSubtarefa).default([]),
  referencias: z.array(esquemaDeReferencia).default([]),
});

export async function criarTask(dados: unknown): Promise<Resultado<string>> {
  const sessao = await exigirAcessoARota(ROTA);

  const validacao = esquemaDeTask.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados da task." };
  }
  const entrada = validacao.data;

  const supabase = await criarClienteServidor();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      titulo: entrada.titulo.trim(),
      client_id: entrada.client_id || null,
      briefing_rico: (entrada.briefing_rico ?? null) as Json | null,
      briefing_texto: vazioParaNulo(entrada.briefing_texto),
      responsavel_id: entrada.responsavel_id || null,
      prazo: vazioParaNulo(entrada.prazo),
      prioridade: entrada.prioridade,
      estimativa_horas: numeroOuNulo(entrada.estimativa_horas),
      criado_por: sessao.usuarioId,
    })
    .select("id")
    .single();

  if (error || !task) {
    return { erro: `Não foi possível criar a task: ${error?.message ?? "erro desconhecido"}` };
  }

  if (entrada.subtarefas.length > 0) {
    const { error: erroDasSubtarefas } = await supabase.from("subtasks").insert(
      entrada.subtarefas.map((sub, indice) => ({
        task_id: task.id,
        titulo: sub.titulo.trim(),
        prazo: vazioParaNulo(sub.prazo),
        responsavel_id: sub.responsavel_id || null,
        estimativa_horas: numeroOuNulo(sub.estimativa_horas),
        ordem: indice,
      })),
    );
    if (erroDasSubtarefas) {
      return {
        dado: task.id,
        erro: `Task criada, mas as subtarefas falharam: ${erroDasSubtarefas.message}`,
      };
    }
  }

  if (entrada.referencias.length > 0) {
    await supabase.from("task_referencias").insert(
      entrada.referencias.map((ref) => ({
        task_id: task.id,
        tipo: ref.tipo,
        url: ref.url,
        titulo: vazioParaNulo(ref.titulo),
        arquivo_nome: vazioParaNulo(ref.arquivo_nome),
        adicionado_por: sessao.usuarioId,
      })),
    );
  }

  revalidatePath(ROTA);
  return { ok: "Task criada.", dado: task.id };
}

const esquemaDeEdicao = z.object({
  titulo: z.string().min(2).optional(),
  client_id: z.string().uuid().nullable().optional(),
  briefing_rico: z.unknown().optional(),
  briefing_texto: z.string().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  prazo: z.string().nullable().optional(),
  prioridade: prioridade.optional(),
  status: status.optional(),
  estimativa_horas: z.union([z.number(), z.string(), z.null()]).optional(),
  tempo_real_horas: z.union([z.number(), z.string(), z.null()]).optional(),
});

/**
 * Edição pontual — usada pelo arrastar do board, pela edição inline da lista e
 * pelo detalhe. Recebe só os campos que mudaram.
 */
export async function atualizarTask(id: string, campos: unknown): Promise<Resultado> {
  await exigirAcessoARota(ROTA);

  const validacao = esquemaDeEdicao.safeParse(campos);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const mudancas: EdicaoDeTask = {};
  const entrada = validacao.data;

  if (entrada.titulo !== undefined) mudancas.titulo = entrada.titulo.trim();
  if (entrada.client_id !== undefined) mudancas.client_id = entrada.client_id;
  // O conteúdo do editor chega como unknown (é JSON arbitrário do TipTap);
  // o banco guarda em jsonb, então a conversão é declarada aqui, num lugar só.
  if (entrada.briefing_rico !== undefined)
    mudancas.briefing_rico = (entrada.briefing_rico ?? null) as Json | null;
  if (entrada.briefing_texto !== undefined) mudancas.briefing_texto = entrada.briefing_texto;
  if (entrada.responsavel_id !== undefined) mudancas.responsavel_id = entrada.responsavel_id;
  if (entrada.prazo !== undefined) mudancas.prazo = vazioParaNulo(entrada.prazo);
  if (entrada.prioridade !== undefined) mudancas.prioridade = entrada.prioridade;
  if (entrada.estimativa_horas !== undefined)
    mudancas.estimativa_horas = numeroOuNulo(entrada.estimativa_horas);
  if (entrada.tempo_real_horas !== undefined)
    mudancas.tempo_real_horas = numeroOuNulo(entrada.tempo_real_horas);

  if (entrada.status !== undefined) {
    mudancas.status = entrada.status;
    // A data de conclusão acompanha o status: sair de concluída limpa a data,
    // senão a task fica com um carimbo de conclusão que não aconteceu.
    mudancas.concluida_em = entrada.status === "concluida" ? new Date().toISOString() : null;
  }

  if (Object.keys(mudancas).length === 0) return { ok: "Nada a alterar." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").update(mudancas).eq("id", id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/${id}`);
  return { ok: "Salvo." };
}

/** Ações em massa da visão Lista. */
export async function atualizarTasksEmMassa(ids: string[], campos: unknown): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  if (ids.length === 0) return { erro: "Nenhuma task selecionada." };

  const validacao = esquemaDeEdicao.safeParse(campos);
  if (!validacao.success) return { erro: "Dados inválidos." };

  const mudancas: EdicaoDeTask = {};
  const entrada = validacao.data;
  if (entrada.responsavel_id !== undefined) mudancas.responsavel_id = entrada.responsavel_id;
  if (entrada.prioridade !== undefined) mudancas.prioridade = entrada.prioridade;
  if (entrada.prazo !== undefined) mudancas.prazo = vazioParaNulo(entrada.prazo);
  if (entrada.status !== undefined) {
    mudancas.status = entrada.status;
    mudancas.concluida_em = entrada.status === "concluida" ? new Date().toISOString() : null;
  }

  if (Object.keys(mudancas).length === 0) return { erro: "Escolha o que alterar." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").update(mudancas).in("id", ids);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath(ROTA);
  return { ok: `${ids.length} task(s) atualizada(s).` };
}

export async function excluirTask(id: string): Promise<Resultado> {
  await exigirAcessoARota(ROTA);
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };
  revalidatePath(ROTA);
  return { ok: "Task excluída." };
}
