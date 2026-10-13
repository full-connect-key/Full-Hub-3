/**
 * As abas do financeiro, num módulo SEM "use client".
 *
 * Esta separação não é organização: é necessidade. `abas.tsx` é um Client
 * Component, e um `const` exportado de um arquivo "use client" NÃO atravessa a
 * fronteira como valor — do lado do servidor ele chega como referência de
 * cliente, e `ABAS.includes(...)` estoura com "is not a function".
 *
 * É o espelho exato do erro de `export const` num arquivo "use server" do
 * Sprint 3B, e o `npm run build` não pega nenhum dos dois: só aparece pedindo
 * a página. Quem pegou este foi a captura do protótipo, que abriu a tela e
 * recebeu 500.
 *
 * Valor que os dois lados usam mora aqui. A tela importa daqui, a página
 * importa daqui, e não existe segunda lista para elas divergirem.
 *
 * ---------------------------------------------------------------------------
 * **ERAM QUATRO ABAS, E SÃO DUAS (0095).** Decisão do usuário: *"Preciso que o
 * financeiro tenha apenas duas abas, a aba de visualizar as notas recebidas, e
 * pagar, ou recusar, e a aba de Softwares - em que a pessoa responsável
 * consegue fazer controle, de todos os gastos da agência"*.
 *
 * Saíram a Visão Geral, os Contratos e os Relatórios, e com eles a receita —
 * tabela, coluna e conta. O que a 0023 fez com `tasks.exigencia_aprovacao`:
 * **as duas que saíram do TIPO, e não só da fileira de pílulas.** `Aba` é uma
 * união de dois valores, quem mexer nisso leva erro de tipo, e `lerAba()` manda
 * o endereço antigo para a primeira — que é o que um link salvo tem de fazer:
 * abrir, e não quebrar.
 * ---------------------------------------------------------------------------
 */

export type Aba = "notas" | "softwares";

export const ABAS: Aba[] = ["notas", "softwares"];

export const ABA_PADRAO: Aba = "notas";

/** Lê o `?aba=` da URL, caindo no padrão para qualquer coisa desconhecida. */
export function lerAba(valor: string | string[] | undefined): Aba {
  const texto = typeof valor === "string" ? valor : ABA_PADRAO;
  return ABAS.includes(texto as Aba) ? (texto as Aba) : ABA_PADRAO;
}
