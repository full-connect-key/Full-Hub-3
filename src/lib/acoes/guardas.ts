import "server-only";

import { obterSessao } from "@/lib/auth/dal";
import { canAccess } from "@/lib/auth/permissions";
import { ehEquipe, ehGestor, ehSocio } from "@/lib/auth/roles";
import type { Sessao } from "@/lib/auth/dal";

import { ErroDeAcao } from "./resultado";

/**
 * Guardas das Server Actions.
 *
 * Diferente das páginas, uma action não pode chamar `forbidden()`: ali o erro
 * lançado não vira tela de 403, vira promise rejeitada e silêncio. Aqui a
 * recusa é um ErroDeAcao, que `executarAcao` transforma em mensagem vermelha.
 *
 * Isto é a primeira barreira, não a única: o RLS no Postgres é quem decide de
 * verdade, e continua valendo mesmo que alguém chame a API direto.
 */

export async function exigirSessaoNaAcao(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroDeAcao("Sua sessão expirou. Entre de novo para continuar.");
  return sessao;
}

export async function exigirEquipeNaAcao(): Promise<Sessao> {
  const sessao = await exigirSessaoNaAcao();
  if (!ehEquipe(sessao.profile.role)) {
    throw new ErroDeAcao("Esta área é da equipe interna.");
  }
  return sessao;
}

export async function exigirRotaNaAcao(href: string): Promise<Sessao> {
  const sessao = await exigirEquipeNaAcao();
  if (!canAccess(sessao.profile.role, href)) {
    throw new ErroDeAcao("Seu perfil não permite esta ação.");
  }
  return sessao;
}

export async function exigirGestorNaAcao(): Promise<Sessao> {
  const sessao = await exigirEquipeNaAcao();
  if (!ehGestor(sessao.profile.role)) {
    throw new ErroDeAcao("Apenas gestão (desenvolvedor ou sócio) pode fazer isso.");
  }
  return sessao;
}

export async function exigirSocioNaAcao(): Promise<Sessao> {
  const sessao = await exigirEquipeNaAcao();
  if (!ehSocio(sessao.profile.role)) {
    throw new ErroDeAcao("Apenas sócios podem fazer isso.");
  }
  return sessao;
}
