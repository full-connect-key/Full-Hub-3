import "server-only";

import { NextResponse } from "next/server";

import { obterSessao } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import type { Sessao } from "@/lib/auth/dal";

/**
 * Guardas das Route Handlers.
 *
 * As rotas de /api/usuarios usam a service role, que ignora todo o RLS. Por
 * isso a checagem de quem chamou acontece aqui, antes de qualquer coisa: é a
 * única barreira que resta nessas rotas.
 */

export type Falha = { resposta: NextResponse };

export function erro(mensagem: string, status = 400): NextResponse {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function exigirGestorNaApi(): Promise<Sessao | Falha> {
  const sessao = await obterSessao();
  if (!sessao) return { resposta: erro("Sua sessão expirou. Entre de novo.", 401) };
  if (!ehGestor(sessao.profile.role)) {
    return { resposta: erro("Seu perfil não permite esta ação.", 403) };
  }
  return sessao;
}

export async function exigirSocioNaApi(): Promise<Sessao | Falha> {
  const sessao = await obterSessao();
  if (!sessao) return { resposta: erro("Sua sessão expirou. Entre de novo.", 401) };
  if (!ehSocio(sessao.profile.role)) {
    return { resposta: erro("Apenas sócios podem fazer isso.", 403) };
  }
  return sessao;
}

export function ehFalha(valor: Sessao | Falha): valor is Falha {
  return "resposta" in valor;
}

/** Traduz os erros do Supabase Auth que a equipe vai encontrar de verdade. */
export function traduzirErroDeAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (m.includes("invalid email")) return "Esse e-mail não parece válido.";
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitos convites seguidos. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("service_role_key") || m.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "A chave de serviço do Supabase não está configurada no servidor.";
  }
  return `Não foi possível concluir: ${mensagem}`;
}
