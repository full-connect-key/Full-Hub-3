/**
 * As quatro abas de Gestão de Tasks, na URL.
 *
 * ---------------------------------------------------------------------------
 * **MÓDULO SEM DIRETIVA NENHUMA, e é mecânica e não gosto.** A barra de abas é
 * `"use client"` e o `page.tsx` é de servidor, e os dois precisam ler a mesma
 * chave. Valor exportado de arquivo cliente chega ao servidor como referência
 * de cliente, e `ehAba(...)` estoura com *"is not a function"* — foi assim que
 * a Gestão de Pessoas devolveu 500 nas duas abas. O `npm run check:fronteira`
 * existe por causa daquele dia, e `pessoas/vocabulario.ts` é o exemplo que
 * este arquivo copia.
 * ---------------------------------------------------------------------------
 */
export const ABAS = ["demandas", "workflows", "recorrencias", "aprovacoes-internas"] as const;

export type Aba = (typeof ABAS)[number];

export function ehAba(valor: string | undefined): valor is Aba {
  return (ABAS as readonly string[]).includes(valor ?? "");
}

/** O padrão é `demandas`: quem abre este módulo abre para ver o trabalho. */
export function lerAba(valor: string | string[] | undefined): Aba {
  const texto = typeof valor === "string" ? valor : undefined;
  return ehAba(texto) ? texto : "demandas";
}
