import type { SkillNivel } from "@/lib/supabase/database.types";

/**
 * O vocabulário das skills, e a régua dos níveis.
 *
 * Em `lib/dominio/` porque a tela do colaborador e a matriz da gestão precisam
 * das mesmas respostas, e uma delas roda no navegador.
 */

export const NIVEIS: SkillNivel[] = [
  "iniciante",
  "intermediario",
  "avancado",
  "especialista",
];

export const ROTULOS_DE_NIVEL: Record<SkillNivel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
  especialista: "Especialista",
};

/**
 * O que cada nível quer dizer.
 *
 * Existe porque autoavaliação sem régua vira escala pessoal: sem isto, o
 * "avançado" de uma pessoa é o "intermediário" de outra, e a matriz deixa de
 * comparar qualquer coisa.
 */
export const DESCRICAO_DO_NIVEL: Record<SkillNivel, string> = {
  iniciante: "Já usei, e ainda preciso de ajuda ou de consulta.",
  intermediario: "Faço sozinho o trabalho do dia a dia.",
  avancado: "Resolvo caso difícil e reviso o trabalho dos outros.",
  especialista: "Sou a referência da casa. Ensino e defino o padrão.",
};

/** 1 a 4, para ordenar e para pintar a matriz. */
export const PESO_DO_NIVEL: Record<SkillNivel, number> = {
  iniciante: 1,
  intermediario: 2,
  avancado: 3,
  especialista: 4,
};

/**
 * A opacidade da célula na matriz: mais escuro, mais avançado.
 *
 * Números altos o bastante para o nível mais claro ainda se distinguir do
 * fundo — com 0.25 no iniciante, a célula sumia e parecia "não tem a skill",
 * que é exatamente a outra informação da grade.
 */
export const OPACIDADE_DO_NIVEL: Record<SkillNivel, number> = {
  iniciante: 0.35,
  intermediario: 0.55,
  avancado: 0.78,
  especialista: 1,
};

/** Avançado ou acima: é a régua de "a agência sabe fazer isso". */
export function ehSenior(nivel: SkillNivel): boolean {
  return PESO_DO_NIVEL[nivel] >= 3;
}

/**
 * Como a agência depende de uma skill.
 *
 * `risco` quando ninguém é sênior nela, ou quando há uma pessoa só. O segundo
 * caso é o que costuma passar batido: a skill existe, o trabalho sai, e no dia
 * em que essa pessoa entra em recesso ninguém percebeu que era ela sozinha.
 */
export type Dependencia = "sem_ninguem" | "uma_pessoa" | "coberta";

export function dependenciaDaSkill(quantosSeniores: number): Dependencia {
  if (quantosSeniores === 0) return "sem_ninguem";
  if (quantosSeniores === 1) return "uma_pessoa";
  return "coberta";
}

export const EXPLICACAO_DA_DEPENDENCIA: Record<Dependencia, string> = {
  sem_ninguem: "Ninguém da casa é avançado nisso.",
  uma_pessoa: "Uma pessoa só. Se ela sair ou entrar em recesso, a agência para.",
  coberta: "Mais de uma pessoa cobre.",
};

export const HUMORES = ["otimo", "bom", "neutro", "dificil"] as const;
export type Humor = (typeof HUMORES)[number];

export const ROTULOS_DE_HUMOR: Record<Humor, string> = {
  otimo: "Ótima",
  bom: "Boa",
  neutro: "Normal",
  dificil: "Difícil",
};

export const EMOJI_DE_HUMOR: Record<Humor, string> = {
  otimo: "🤩",
  bom: "🙂",
  neutro: "😐",
  dificil: "😮‍💨",
};
