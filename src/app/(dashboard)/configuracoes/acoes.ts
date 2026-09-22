"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoDoPerfil = { erro?: string; sucesso?: string };

/**
 * Salva o proprio perfil.
 *
 * Nao recebemos o id do usuario pelo formulario de proposito: ele vem da
 * sessao no servidor. Assim ninguem consegue editar o perfil de outra pessoa
 * alterando um campo escondido -- e o RLS ainda barraria, mas e melhor que o
 * pedido nem chegue errado ao banco.
 */
export async function salvarPerfil(
  _estadoAnterior: EstadoDoPerfil,
  formData: FormData,
): Promise<EstadoDoPerfil> {
  const nomeCompleto = String(formData.get("nome_completo") ?? "").trim();
  const cargo = String(formData.get("cargo") ?? "").trim();

  if (nomeCompleto.length > 120 || cargo.length > 120) {
    return { erro: "Nome e cargo devem ter no maximo 120 caracteres." };
  }

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erro: "Sua sessao expirou. Entre de novo." };

  const { error } = await supabase
    .from("perfis")
    .update({
      nome_completo: nomeCompleto || null,
      cargo: cargo || null,
    })
    .eq("id", user.id);

  if (error) {
    return { erro: `Nao foi possivel salvar: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { sucesso: "Perfil atualizado." };
}
