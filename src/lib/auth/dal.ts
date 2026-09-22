import "server-only";

import { cache } from "react";
import { forbidden, redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/database.types";
import { canAccess } from "./permissions";
import { ehCliente, ehEquipe } from "./roles";

/**
 * Camada de acesso aos dados de autenticacao (DAL).
 *
 * Toda pagina e toda action que precisa saber quem esta logado passa por aqui,
 * em vez de chamar o Supabase direto. A regra fica num lugar so.
 *
 * `cache()` do React deduplica dentro da mesma requisicao: se o layout, a
 * pagina e tres componentes pedirem a sessao, o Supabase responde uma vez.
 */

export type Sessao = { usuarioId: string; email: string; profile: Profile };

export const obterUsuario = cache(async () => {
  const supabase = await criarClienteServidor();
  // getUser() valida o token no servidor do Supabase. getSession() apenas le o
  // cookie, que o navegador pode ter adulterado -- nunca confiar nele aqui.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const usuario = await obterUsuario();
  if (!usuario) return null;

  const supabase = await criarClienteServidor();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", usuario.id)
    .maybeSingle();

  // Sem profile a pessoa nao tem perfil de acesso definido, e conta desativada
  // nao entra. Nos dois casos tratamos como quem nao esta logado.
  if (!profile || !profile.ativo) return null;

  return { usuarioId: usuario.id, email: usuario.email ?? profile.email, profile };
});

/** Use no topo de qualquer pagina privada. Sem sessao, manda para o login. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  return sessao;
}

/**
 * Area interna (/painel). Cliente que tentar entrar recebe 403 de verdade,
 * nao uma tela em branco nem um redirecionamento silencioso.
 */
export async function exigirEquipe(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!ehEquipe(sessao.profile.role)) forbidden();
  return sessao;
}

/**
 * Valida o perfil para uma rota especifica do painel.
 *
 * E esta funcao que faz o "esconder no menu nao basta" valer: quem digitar
 * /painel/financeiro sendo desenvolvedor recebe 403, mesmo sem o item aparecer
 * no menu. Toda pagina do painel comeca chamando isto com a propria rota.
 */
export async function exigirAcessoARota(href: string): Promise<Sessao> {
  const sessao = await exigirEquipe();
  if (!canAccess(sessao.profile.role, href)) forbidden();
  return sessao;
}

/** Area do cliente (/portal). Perfis internos recebem 403. */
export async function exigirCliente(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!ehCliente(sessao.profile.role)) forbidden();
  return sessao;
}

/** Primeiro nome, para saudacao. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

/** Iniciais para o avatar. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
