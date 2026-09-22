import type { TeamFuncao, UserRole } from "@/lib/supabase/database.types";

/**
 * Vocabulário da equipe interna.
 *
 * `funcao` é o que a pessoa faz na agência; `role` é o que ela alcança na
 * plataforma. São coisas diferentes de propósito: um colaborador do
 * Atendimento cria tasks sem virar gestor de nada.
 */

export const FUNCOES: TeamFuncao[] = [
  "Atendimento",
  "Social Media",
  "Redator",
  "Design",
  "Audiovisual",
  "Trafego",
  "Desenvolvimento",
  "Gestao",
  "Outro",
];

/** O banco guarda sem acento (é um enum); a tela mostra com acento. */
export const ROTULOS_DE_FUNCAO: Record<TeamFuncao, string> = {
  Atendimento: "Atendimento",
  "Social Media": "Social Media",
  Redator: "Redator",
  Design: "Design",
  Audiovisual: "Audiovisual",
  Trafego: "Tráfego",
  Desenvolvimento: "Desenvolvimento",
  Gestao: "Gestão",
  Outro: "Outro",
};

export function rotuloDaFuncao(funcao: TeamFuncao | null): string {
  return funcao ? ROTULOS_DE_FUNCAO[funcao] : "—";
}

/** Perfis de acesso que podem ser atribuídos a alguém da equipe. */
export const ROLES_INTERNOS: UserRole[] = ["colaborador", "desenvolvedor", "socio"];

/**
 * Quem pode conceder cada perfil.
 *
 * Só sócio concede sócio — a regra vale no servidor, na rota de criação, e não
 * apenas escondendo a opção no formulário.
 */
export function podeConcederRole(quemConcede: UserRole, roleDesejado: UserRole): boolean {
  if (roleDesejado === "socio") return quemConcede === "socio";
  if (roleDesejado === "cliente") return false;
  return quemConcede === "socio" || quemConcede === "desenvolvedor";
}

/** Áreas sugeridas. Campo livre: a agência pode criar outras. */
export const AREAS_SUGERIDAS = [
  "Atendimento",
  "Criação",
  "Mídia",
  "Audiovisual",
  "Tecnologia",
  "Direção",
  "Administrativo",
];
