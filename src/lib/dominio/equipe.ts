import type { TeamFuncao, UserRole } from "@/lib/supabase/database.types";

/**
 * Vocabulário da equipe interna.
 *
 * `funcao` é o que a pessoa faz na agência; `role` é o que ela alcança na
 * plataforma. São coisas diferentes de propósito: um colaborador do
 * Atendimento cria tasks sem virar gestor de nada.
 */

/**
 * As nove funções, em TUPLA e não em array.
 *
 * O `as const` é o que faz esta lista servir aos DOIS lados: a tela percorre
 * com `.map()`, e o zod das actions pede `readonly [string, ...string[]]` —
 * `TeamFuncao[]` não serve para `z.enum`. Por isso ela vivia copiada em quatro
 * arquivos, e a quinta cópia seria a que esquecesse uma função nova: o enum do
 * banco ganharia o valor, uma tela ofereceria, e a action ao lado recusaria com
 * uma mensagem sobre escolher a função.
 *
 * O `satisfies` é a trava: uma função que não exista em `team_funcao` não
 * compila aqui, em vez de virar recusa do Postgres na tela de quem salvou.
 */
export const FUNCOES = [
  "Atendimento",
  "Social Media",
  "Redator",
  "Design",
  "Audiovisual",
  "Trafego",
  "Desenvolvimento",
  "Gestao",
  "Outro",
] as const satisfies readonly TeamFuncao[];

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
