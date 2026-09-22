"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

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
  return executarAcao("salvarMeuPerfil", async () => {
    const sessao = await exigirSessaoNaAcao();

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      return falha(validacao.error.issues[0]?.message ?? "Confira os dados.");
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        nome: validacao.data.nome.trim(),
        ...(validacao.data.avatar_url !== undefined
          ? { avatar_url: validacao.data.avatar_url }
          : {}),
      })
      .eq("id", sessao.usuarioId)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou a gravação do seu perfil.");

    revalidatePath("/", "layout");
    return sucesso("Perfil atualizado.");
  });
}

export async function trocarMinhaSenha(senha: string, confirmacao: string): Promise<Resultado> {
  return executarAcao("trocarMinhaSenha", async () => {
    await exigirSessaoNaAcao();

    if (senha.length < 8) return falha("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmacao) return falha("As duas senhas não são iguais.");

    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("new password should be different")) {
        return falha("A nova senha precisa ser diferente da atual.");
      }
      return falha(`Não foi possível trocar a senha: ${error.message}`);
    }

    return sucesso("Senha trocada.");
  });
}
