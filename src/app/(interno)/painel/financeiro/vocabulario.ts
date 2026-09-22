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
 */

export type Aba = "visao-geral" | "lancamentos" | "contratos" | "relatorios";

export const ABAS: Aba[] = ["visao-geral", "lancamentos", "contratos", "relatorios"];

export const ABA_PADRAO: Aba = "visao-geral";

/** Lê o `?aba=` da URL, caindo no padrão para qualquer coisa desconhecida. */
export function lerAba(valor: string | string[] | undefined): Aba {
  const texto = typeof valor === "string" ? valor : ABA_PADRAO;
  return ABAS.includes(texto as Aba) ? (texto as Aba) : ABA_PADRAO;
}
