"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SITE_URL } from "@/lib/env";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { erro?: string; sucesso?: string };

/**
 * O Supabase responde em ingles e, as vezes, de forma generica de proposito
 * (para nao revelar se um e-mail existe). Traduzimos aqui mantendo essa
 * discricao.
 */
function traduzirErro(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("new password should be different"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("fetch failed") || m.includes("network"))
    return "Nao foi possivel falar com o Supabase. Confira a conexao e as variaveis de ambiente.";
  return "Nao foi possivel concluir. Tente novamente em instantes.";
}

/** So aceita caminhos internos: bloqueia redirecionamento para outro site. */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const caminho = typeof valor === "string" ? valor : "";
  if (caminho.startsWith("/") && !caminho.startsWith("//")) return caminho;
  return "/dashboard";
}

export async function entrar(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const destino = destinoSeguro(formData.get("redirecionar"));

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    return { erro: traduzirErro(error.message) };
  }

  revalidatePath("/", "layout");
  // redirect() funciona lancando uma excecao interna do Next,
  // entao precisa ficar fora de qualquer try/catch.
  redirect(destino);
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function enviarLinkDeRecuperacao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { erro: "Informe o e-mail da sua conta." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?proximo=/redefinir-senha`,
  });

  if (error) {
    return { erro: traduzirErro(error.message) };
  }

  // Resposta identica com e-mail existente ou nao: nao entregamos a quem
  // tenta adivinhar a informacao de quais contas existem.
  return {
    sucesso: "Se houver uma conta com esse e-mail, o link de redefinicao chega em instantes.",
  };
}

export async function definirNovaSenha(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As duas senhas nao sao iguais." };

  const supabase = await criarClienteServidor();

  // O link do e-mail ja criou uma sessao temporaria. Sem ela, nao ha o que
  // redefinir -- normalmente quer dizer que o link expirou.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: "Link expirado ou invalido. Peca um novo link de redefinicao." };
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: traduzirErro(error.message) };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
