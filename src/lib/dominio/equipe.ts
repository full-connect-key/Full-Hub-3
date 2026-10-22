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

/**
 * A ÁREA DE CADA FUNÇÃO — e ela deixou de ser um campo.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"tem opção de área e função que fica duplicado,
 * mantenha apenas a 'função' e tire 'área'"*. Ele estava certo: o cadastro
 * tinha dois seletores lado a lado com vocabulários que se sobrepunham —
 * "Atendimento" e "Audiovisual" apareciam nos dois, palavra por palavra.
 *
 * **MAS A ÁREA NÃO PODIA SIMPLESMENTE SUMIR**, e é o que esta função resolve:
 * ela é o agrupamento de que o Day Off inteiro depende. A matriz da equipe
 * agrupa por área, o relatório filtra por área, e o calendário de propor
 * período **bloqueia os dias de quem é da mesma área** — *"quem responde
 * precisa saber quem mais do mesmo time está fora"*. Tirar o campo e deixar a
 * coluna em branco poria toda pessoa nova num balde "Sem área", e o bloqueio
 * passaria a tratar a agência inteira como um time só.
 *
 * Então a coluna continua existindo e continua sendo escrita — **só que
 * derivada**, e não digitada. É a regra que o produto já aplica em toda parte:
 * o que dá para calcular não se guarda duas vezes, senão são duas verdades e
 * a digitada é a que envelhece. É `atraso` não ser coluna no Financeiro, e
 * `maoDoPost()` no Social.
 *
 * **O VOCABULÁRIO É O DA LISTA ANTIGA**, menos "Administrativo": ele não é a
 * área de nenhuma das nove funções, e inventar um dono para ele seria pôr
 * gente num grupo que ninguém escolheu. `Outro` vira a área `Outro`, que é
 * honesta — e é também o único grupo em que duas pessoas de ofícios
 * diferentes podem cair juntas.
 *
 * **QUEM ESCREVE É O SERVIDOR**, nas duas ações que gravam a ficha, e nunca a
 * tela: a derivação num lugar só é o que impede o cadastro e a edição de
 * discordarem sobre a área da mesma pessoa.
 *
 * *O que fica em aberto, e é dito em vez de escondido:* as fichas que já
 * existem mantêm a área que alguém digitou até a próxima vez que alguém as
 * salvar. Não há passada de conversão, de propósito — ela reescreveria uma
 * escolha que ninguém pediu para desfazer. Quem quiser alinhar a tabela
 * inteira de uma vez faz um `update` com este mesmo de-para.
 * ---------------------------------------------------------------------------
 */
export const AREA_DA_FUNCAO: Record<TeamFuncao, string> = {
  Atendimento: "Atendimento",
  "Social Media": "Criação",
  Redator: "Criação",
  Design: "Criação",
  Audiovisual: "Audiovisual",
  Trafego: "Mídia",
  Desenvolvimento: "Tecnologia",
  Gestao: "Direção",
  Outro: "Outro",
};

/** A área de quem tem esta função. Nulo vira nulo: ficha sem função não tem área. */
export function areaDaFuncao(funcao: string | null | undefined): string | null {
  if (!funcao) return null;
  return AREA_DA_FUNCAO[funcao as TeamFuncao] ?? "Outro";
}
