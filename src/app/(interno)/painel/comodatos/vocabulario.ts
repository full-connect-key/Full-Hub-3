/**
 * As abas dos Comodatos, num módulo SEM DIRETIVA NENHUMA.
 *
 * `abas.tsx` é `"use client"`, e valor exportado de arquivo cliente não vale
 * no servidor — `lerAba(...)` estouraria com *"Attempted to call lerAba() from
 * the server"*, que não aparece no build, nem no lint, nem no `tsc`. É a mesma
 * posição que derrubou a Gestão de Pessoas, e o formato que o
 * `check:fronteira` manda copiar.
 */

export type Aba = "meus" | "geral";

export function ehAba(valor: string | undefined): valor is Aba {
  return valor === "meus" || valor === "geral";
}

export function lerAba(valor: string | undefined): Aba {
  return ehAba(valor) ? valor : "meus";
}

export type VisaoDaGestao = "equipamento" | "pessoa";

export function lerVisao(valor: string | undefined): VisaoDaGestao {
  return valor === "pessoa" ? "pessoa" : "equipamento";
}
