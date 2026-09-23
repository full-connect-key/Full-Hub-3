"use server";

import { redirect } from "next/navigation";

import { exigirSessaoParaTrocarSenha } from "@/lib/auth/dal";
import { rotaInicialDoRole } from "@/lib/auth/roles";
import { esquemaDeNovaSenha } from "@/lib/auth/esquemas";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoDaTroca = { erro?: string };

/**
 * A troca obrigatória do primeiro acesso.
 *
 * DOIS CLIENTES, e a ordem é a regra inteira:
 *
 *   1. o cliente DA PESSOA troca a senha. Tem que ser o dela — a sessão é que
 *      prova quem está pedindo, e `updateUser` só mexe em quem está logado;
 *   2. só depois, e só se o passo 1 deu certo, a CHAVE DE SERVIÇO baixa a
 *      bandeira.
 *
 * O segundo passo não pode ser feito pelo cliente da pessoa: o trigger
 * `protect_profile_role` (migration 0019) devolve `deve_trocar_senha` ao valor
 * antigo para qualquer escrita que venha de alguém logado. É de propósito —
 * sem isso bastaria um PATCH no PostgREST para marcar a senha como trocada
 * sem ter trocado nada, e a pessoa seguiria com a provisória, que outra
 * pessoa conhece.
 *
 * Se o passo 2 falhar, a bandeira continua de pé e a pessoa cai aqui de novo
 * no próximo acesso. Chato, e é o lado certo de errar: o outro seria dar
 * acesso achando que a senha foi trocada.
 */
export async function trocarSenhaDoPrimeiroAcesso(
  _anterior: EstadoDaTroca,
  formData: FormData,
): Promise<EstadoDaTroca> {
  const sessao = await exigirSessaoParaTrocarSenha();

  const validacao = esquemaDeNovaSenha.safeParse({
    senha: String(formData.get("senha") ?? ""),
    confirmacao: String(formData.get("confirmacao") ?? ""),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira as senhas informadas." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: validacao.data.senha });

  if (error) {
    console.error("[trocar-senha] o Supabase recusou a nova senha:", error.message);
    // "New password should be different" é o caso que mais aparece aqui: a
    // pessoa digita a provisória de novo, por reflexo.
    if (error.message.toLowerCase().includes("different")) {
      return { erro: "A nova senha precisa ser diferente da provisória." };
    }
    return { erro: `Não foi possível salvar a senha: ${error.message}` };
  }

  const admin = criarClienteAdmin();
  const { data, error: erroDaBandeira } = await admin
    .from("profiles")
    .update({ deve_trocar_senha: false })
    .eq("id", sessao.usuarioId)
    .select("id");

  if (erroDaBandeira || !data?.length) {
    console.error(
      "[trocar-senha] a senha mudou mas a bandeira nao baixou:",
      erroDaBandeira?.message ?? "nenhuma linha devolvida",
    );
    return {
      erro:
        "Sua senha nova já está valendo, mas não foi possível concluir o primeiro acesso. " +
        "Entre de novo com ela — se esta tela reaparecer, fale com a equipe interna.",
    };
  }

  redirect(rotaInicialDoRole(sessao.profile.role));
}
