/**
 * As vertentes de uma conta (migration 0118).
 *
 * Vertente é a área, a unidade de negócio ou a frente dentro de um mesmo
 * cliente: a Mundo Verde tem Institucional, Lojas Próprias, Marca Própria,
 * Nutricionistas e Franqueados, e E-commerce — cinco frentes, uma conta só.
 *
 * **O QUE MORA AQUI É O VOCABULÁRIO, e a conta de ordem.** O recorte por
 * vertente é um `where` no Postgres, e o nome vem da linha: não há cálculo
 * nenhum para duplicar deste lado.
 */

import type { Database } from "@/lib/supabase/database.types";

export type Vertente = Database["public"]["Tables"]["client_vertentes"]["Row"];

/**
 * O passo entre duas posições.
 *
 * **DEZ E NÃO UM**, como a corrente do social (0045): inserir uma vertente
 * ENTRE duas sem renumerar as outras é o caso comum de "reorganizar", e com
 * passo 1 cada arrastada reescreveria a lista inteira.
 */
export const PASSO_DA_ORDEM = 10;

/**
 * As que o seletor da task oferece.
 *
 * **A DESATIVADA FICA DE FORA, e a já escolhida fica dentro.** Oferecer uma
 * vertente que a agência aposentou é oferecer a classificação que ela acabou
 * de tirar do ar; sumir com a da demanda que já aponta para ela faria o campo
 * abrir em branco numa task classificada, e o próximo salvamento apagaria a
 * classificação sem ninguém ter pedido. É a regra do fluxo de social
 * desativado na ficha do cliente, palavra por palavra.
 */
export function vertentesParaEscolher(
  todas: Vertente[],
  jaEscolhida: string | null,
): Vertente[] {
  return todas.filter((v) => v.ativa || v.id === jaEscolhida);
}

/**
 * A conta exige vertente?
 *
 * **SÓ AS ATIVAS CONTAM.** Uma conta cujas vertentes foram todas desativadas
 * voltou a ser uma conta sem vertente — cobrar a escolha ali seria cobrar
 * uma lista vazia, que é uma recusa que ninguém consegue satisfazer.
 */
export function aContaExigeVertente(todas: Vertente[]): boolean {
  return todas.some((v) => v.ativa);
}
