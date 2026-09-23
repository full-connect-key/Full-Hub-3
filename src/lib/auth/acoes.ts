"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SITE_URL } from "@/lib/env";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehCliente, rotaInicialDoRole } from "./roles";
import { esquemaDeLogin, esquemaDeNovaSenha, esquemaDeRecuperacao } from "./esquemas";

export type EstadoFormulario = { erro?: string; sucesso?: string };

/**
 * O Supabase responde em ingles e, em alguns casos, de forma generica de
 * proposito (para nao revelar se um e-mail existe). Traduzimos mantendo essa
 * discricao.
 *
 * SEMPRE LOGA A MENSAGEM ORIGINAL. A regra do projeto é que nenhuma falha
 * pode sumir em silêncio, e o login estava fora dela: quem via a tela recebia
 * uma frase que não dizia nada e o motivo real não ficava em lugar nenhum.
 * Agora ele está no `pm2 logs full-hub`, que é onde alguém vai procurar.
 *
 * As três últimas traduções são problemas de CONFIGURAÇÃO, não de quem está
 * digitando. A diferença importa na tela: "tente novamente em instantes"
 * manda a pessoa insistir num erro que nunca vai passar sozinho.
 */
function traduzirErro(mensagem: string, contexto: string): string {
  console.error(`[auth:${contexto}] Supabase respondeu: ${mensagem}`);

  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("new password should be different"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("fetch failed") || m.includes("network"))
    return "Não foi possível falar com o Supabase. Confira a conexão e as variáveis de ambiente.";

  // Login por e-mail desligado no projeto. Acontece ao desmarcar "Enable
  // Email provider" querendo desmarcar "Enable Sign Ups" — são dois
  // interruptores na mesma tela, e um deles mata o login de todo mundo.
  if (m.includes("logins are disabled") || m.includes("provider is disabled"))
    return "O login por e-mail está desligado no Supabase. Em Authentication → Sign In / Providers, religue o provedor Email — o que fecha o cadastro é “Enable Sign Ups”, não o provedor.";

  // Chave anon errada, trocada ou revogada.
  if (m.includes("invalid api key") || m.includes("invalid jwt"))
    return "A chave do Supabase não foi aceita. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY no servidor e reconstrua — o valor é embutido no build.";

  // Schema de auth incompleto, ou a migration não rodou inteira.
  if (m.includes("database error"))
    return "O banco recusou a consulta de autenticação. Abra /status para o diagnóstico.";

  return "Não foi possível entrar, e não foi por causa da senha. Isto é configuração: abra /status para o diagnóstico, ou veja o motivo exato no log do servidor.";
}

/**
 * Decide para onde mandar a pessoa depois do login.
 *
 * Um destino guardado antes do login so e respeitado se pertencer a area do
 * perfil dela -- senao um cliente que tentou /painel voltaria para /painel e
 * levaria um 403 logo apos entrar.
 */
function destinoDepoisDoLogin(role: Parameters<typeof rotaInicialDoRole>[0], pedido: string) {
  const padrao = rotaInicialDoRole(role);
  if (!pedido.startsWith("/") || pedido.startsWith("//")) return padrao;

  const areaDoCliente = pedido === "/portal" || pedido.startsWith("/portal/");
  const areaInterna = pedido === "/painel" || pedido.startsWith("/painel/");

  if (ehCliente(role) && areaDoCliente) return pedido;
  if (!ehCliente(role) && areaInterna) return pedido;
  return padrao;
}

export async function entrar(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaDeLogin.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    senha: String(formData.get("senha") ?? ""),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados informados." };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validacao.data.email,
    password: validacao.data.senha,
  });

  if (error || !data.user) {
    return { erro: error ? traduzirErro(error.message, "entrar") : "E-mail ou senha incorretos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      erro: "Sua conta existe, mas ainda não tem perfil de acesso. Fale com a equipe interna.",
    };
  }

  if (!profile.ativo) {
    await supabase.auth.signOut();
    return { erro: "Esta conta está desativada. Fale com a equipe interna." };
  }

  const destino = destinoDepoisDoLogin(
    profile.role,
    String(formData.get("redirecionar") ?? ""),
  );

  revalidatePath("/", "layout");
  // redirect() funciona lancando uma excecao interna do Next: precisa ficar
  // fora de qualquer try/catch.
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
  const validacao = esquemaDeRecuperacao.safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira o e-mail informado." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(validacao.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?proximo=/redefinir-senha`,
  });

  if (error) return { erro: traduzirErro(error.message, "recuperar-senha") };

  // Resposta identica havendo conta ou nao: nao entregamos a quem tenta
  // adivinhar a informacao de quais e-mails existem.
  return {
    sucesso: "Se houver uma conta com esse e-mail, o link de redefinição chega em instantes.",
  };
}

export async function definirNovaSenha(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaDeNovaSenha.safeParse({
    senha: String(formData.get("senha") ?? ""),
    confirmacao: String(formData.get("confirmacao") ?? ""),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira as senhas informadas." };
  }

  const supabase = await criarClienteServidor();

  // O link do e-mail ja criou uma sessao temporaria. Sem ela nao ha o que
  // redefinir -- normalmente quer dizer que o link expirou.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Link expirado ou inválido. Peça um novo link de redefinição." };
  }

  const { error } = await supabase.auth.updateUser({ password: validacao.data.senha });
  if (error) return { erro: traduzirErro(error.message, "definir-senha") };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/", "layout");
  redirect(profile ? rotaInicialDoRole(profile.role) : "/login");
}
