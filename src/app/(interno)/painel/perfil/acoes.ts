"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSessao } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok?: string; erro?: string };

/**
 * Ações do próprio perfil.
 *
 * Só alcançam nome e avatar. Cargo, área, função e perfil de acesso são da
 * gestão — a pessoa não muda o que ela própria alcança nem o que ela faz na
 * agência. O banco reforça isso com o trigger protect_profile_role.
 */

const esquema = z.object({
  nome: z.string().min(2, "Informe seu nome.").max(120),
  avatar_url: z.string().url().nullable().optional(),
});

export async function salvarMeuPerfil(dados: unknown): Promise<Resultado> {
  const sessao = await exigirSessao();

  const validacao = esquema.safeParse(dados);
  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("profiles")
    .update({
      nome: validacao.data.nome.trim(),
      ...(validacao.data.avatar_url !== undefined
        ? { avatar_url: validacao.data.avatar_url }
        : {}),
    })
    .eq("id", sessao.usuarioId);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: "Perfil atualizado." };
}

export async function trocarMinhaSenha(senha: string, confirmacao: string): Promise<Resultado> {
  await exigirSessao();

  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("new password should be different")) {
      return { erro: "A nova senha precisa ser diferente da atual." };
    }
    return { erro: `Não foi possível trocar a senha: ${error.message}` };
  }

  return { ok: "Senha trocada." };
}
