/**
 * Versao de prototipo de src/lib/auth/dal.ts.
 *
 * Devolve sempre a mesma pessoa ficticia, para as telas privadas renderizarem
 * sem precisar de um Supabase de verdade nem de login.
 *
 * Precisa exportar exatamente o mesmo que o arquivo original -- se o original
 * ganhar uma funcao nova, o build do prototipo falha avisando, e e so
 * acrescentar aqui.
 */
import type { User } from "@supabase/supabase-js";

import type { Perfil } from "@/lib/supabase/database.types";
import { PERFIL_EXEMPLO, USUARIO_EXEMPLO } from "./dados-exemplo";

const usuario = USUARIO_EXEMPLO as unknown as User;
const perfil = PERFIL_EXEMPLO as Perfil;

export async function obterUsuario(): Promise<User | null> {
  return usuario;
}

export async function obterSessao(): Promise<{ usuario: User; perfil: Perfil | null } | null> {
  return { usuario, perfil };
}

export async function exigirSessao(): Promise<{ usuario: User; perfil: Perfil | null }> {
  return { usuario, perfil };
}

export function nomeDeExibicao(perfilRecebido: Perfil | null, email: string | undefined): string {
  const completo = perfilRecebido?.nome_completo?.trim();
  if (completo) return completo.split(/\s+/)[0];
  return email?.split("@")[0] ?? "usuário";
}
