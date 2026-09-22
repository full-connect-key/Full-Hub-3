"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { vinculosDoCliente } from "@/lib/dados/clientes";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: string; erro?: string };

/**
 * Ações do módulo Clientes.
 *
 * A gravação passa pelo cliente Supabase do usuário, não pela service role: o
 * RLS é quem decide se a pessoa pode escrever. A checagem de perfil aqui é a
 * primeira barreira, não a única.
 */

const esquemaDeCliente = z.object({
  id: z.string().uuid().optional(),
  nome_empresa: z.string().min(2, "Informe o nome da empresa.").max(160),
  nome_contato: z.string().max(120).optional().nullable(),
  email_contato: z.union([z.string().email("E-mail de contato inválido."), z.literal("")]).optional(),
  telefone: z.string().max(40).optional().nullable(),
  segmento: z.string().max(120).optional().nullable(),
  responsavel_atendimento_id: z.string().uuid().nullable().optional(),
  drive_folder_id: z.string().max(200).optional().nullable(),
  observacoes: z.string().max(4000).optional().nullable(),
});

function vazioParaNulo(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

export async function salvarCliente(dados: unknown): Promise<Resultado> {
  await exigirAcessoARota("/painel/clientes");

  const validacao = esquemaDeCliente.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados informados." };
  }
  const { id, ...campos } = validacao.data;

  const registro = {
    nome_empresa: campos.nome_empresa.trim(),
    nome_contato: vazioParaNulo(campos.nome_contato),
    email_contato: vazioParaNulo(campos.email_contato),
    telefone: vazioParaNulo(campos.telefone),
    segmento: vazioParaNulo(campos.segmento),
    responsavel_atendimento_id: campos.responsavel_atendimento_id || null,
    drive_folder_id: vazioParaNulo(campos.drive_folder_id),
    observacoes: vazioParaNulo(campos.observacoes),
  };

  const supabase = await criarClienteServidor();
  const { error } = id
    ? await supabase.from("clients").update(registro).eq("id", id)
    : await supabase.from("clients").insert(registro);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/painel/clientes");
  if (id) revalidatePath(`/painel/clientes/${id}`);
  return { ok: id ? "Cliente atualizado." : "Cliente cadastrado." };
}

/**
 * Desativar em vez de excluir. O histórico da conta precisa sobreviver, e
 * reativar é um clique quando o cliente volta.
 */
export async function alternarAtivoDoCliente(id: string, ativo: boolean): Promise<Resultado> {
  await exigirAcessoARota("/painel/clientes");

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("clients").update({ ativo }).eq("id", id);
  if (error) return { erro: `Não foi possível alterar: ${error.message}` };

  revalidatePath("/painel/clientes");
  revalidatePath(`/painel/clientes/${id}`);
  return { ok: ativo ? "Cliente reativado." : "Cliente desativado." };
}

/**
 * Exclusão de verdade. Só sócio, só com o nome digitado e só quando não há
 * nada de produção preso à empresa.
 */
export async function excluirCliente(id: string, nomeDigitado: string): Promise<Resultado> {
  const sessao = await exigirAcessoARota("/painel/clientes");
  if (!ehSocio(sessao.profile.role)) {
    return { erro: "Apenas sócios podem excluir um cliente." };
  }

  const supabase = await criarClienteServidor();
  const { data: cliente } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) return { erro: "Cliente não encontrado." };

  if (nomeDigitado.trim() !== cliente.nome_empresa) {
    return { erro: "O nome digitado não confere." };
  }

  const vinculos = await vinculosDoCliente(id);
  if (vinculos.impedeExclusao) {
    return {
      erro: "Esta empresa tem campanhas ou posts vinculados. Desative em vez de excluir.",
    };
  }

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  revalidatePath("/painel/clientes");
  return { ok: `${cliente.nome_empresa} foi excluída.` };
}

/** Tira o acesso de alguém ao portal desta empresa. A conta continua existindo. */
export async function removerAcessoDoUsuario(vinculoId: string, clientId: string): Promise<Resultado> {
  await exigirAcessoARota("/painel/clientes");

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("client_users").delete().eq("id", vinculoId);
  if (error) return { erro: `Não foi possível remover: ${error.message}` };

  revalidatePath(`/painel/clientes/${clientId}`);
  return { ok: "Acesso removido." };
}
