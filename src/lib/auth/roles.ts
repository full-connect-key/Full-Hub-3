import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Os quatro perfis de acesso, num lugar so.
 *
 * Estas funcoes sao o espelho das funcoes SQL da migration 0002 (is_staff,
 * is_gestor, is_socio). As duas camadas precisam concordar: o banco e quem
 * protege os dados, e isto aqui decide o que a interface mostra.
 */

export const ROTULOS_DE_ROLE: Record<UserRole, string> = {
  cliente: "Cliente",
  colaborador: "Colaborador",
  desenvolvedor: "Desenvolvedor",
  socio: "Sócio",
};

/** Faz parte da equipe da agencia? */
export function ehEquipe(role: UserRole | null | undefined): boolean {
  return role === "colaborador" || role === "desenvolvedor" || role === "socio";
}

/** Tem poder de gestao? */
export function ehGestor(role: UserRole | null | undefined): boolean {
  return role === "desenvolvedor" || role === "socio";
}

export function ehSocio(role: UserRole | null | undefined): boolean {
  return role === "socio";
}

export function ehCliente(role: UserRole | null | undefined): boolean {
  return role === "cliente";
}

/** Para onde a pessoa vai depois de entrar. */
export function rotaInicialDoRole(role: UserRole): string {
  return role === "cliente" ? "/portal" : "/painel";
}

/**
 * O timeout por inatividade vale so para o cliente: ele acessa de fora da
 * agencia, muitas vezes de um computador compartilhado. A equipe fica o dia
 * inteiro no sistema e seria atrapalhada por isso.
 */
export function exigeTimeoutDeInatividade(role: UserRole): boolean {
  return role === "cliente";
}
