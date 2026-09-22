/**
 * Versao de prototipo de src/lib/auth/dal.ts.
 *
 * Devolve sessoes ficticias para as telas privadas renderizarem sem Supabase
 * e sem login. Cada guarda devolve o perfil que aquela area espera, entao
 * /painel aparece como socio e /portal como cliente.
 *
 * Precisa exportar exatamente o mesmo que o arquivo original -- se o original
 * ganhar uma funcao nova, o build do prototipo falha avisando qual falta.
 */
import type { User } from "@supabase/supabase-js";

import type { Profile } from "@/lib/supabase/database.types";
import { PROFILE_CLIENTE, PROFILE_EQUIPE, USUARIO_EXEMPLO } from "./dados-exemplo";

export type Sessao = { usuarioId: string; email: string; profile: Profile };

function sessaoDe(profile: Profile): Sessao {
  return { usuarioId: profile.id, email: profile.email, profile };
}

export async function obterUsuario(): Promise<User | null> {
  return USUARIO_EXEMPLO as unknown as User;
}

export async function obterSessao(): Promise<Sessao | null> {
  return sessaoDe(PROFILE_EQUIPE);
}

export async function exigirSessao(): Promise<Sessao> {
  return sessaoDe(PROFILE_EQUIPE);
}

export async function exigirEquipe(): Promise<Sessao> {
  return sessaoDe(PROFILE_EQUIPE);
}

export async function exigirCliente(): Promise<Sessao> {
  return sessaoDe(PROFILE_CLIENTE);
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
