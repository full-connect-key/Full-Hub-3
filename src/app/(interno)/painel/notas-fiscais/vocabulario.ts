/**
 * As abas das Notas Fiscais, num módulo SEM DIRETIVA NENHUMA.
 *
 * ---------------------------------------------------------------------------
 * **Por que não mora em `abas.tsx`:** aquele arquivo é `"use client"`, e um
 * valor exportado de lá chega ao Server Component como referência de cliente —
 * `lerAba(...)` estoura com *"Attempted to call lerAba() from the server"*, que
 * não aparece no build, nem no lint, nem no `tsc`. Só quando alguém pede a
 * página.
 *
 * **E isto já derrubou a Gestão de Pessoas uma vez**, com `ehAba` na mesma
 * posição. Foi dessa vez que nasceu o `npm run check:fronteira` — que é o que
 * pegou este aqui, antes de a tela ir para qualquer lugar, e ainda apontou o
 * `pessoas/vocabulario.ts` como o formato a copiar. A trava fez exatamente o
 * trabalho para o qual foi escrita.
 * ---------------------------------------------------------------------------
 */

export type Aba = "minhas" | "conferir";

export function ehAba(valor: string | undefined): valor is Aba {
  return valor === "minhas" || valor === "conferir";
}

export function lerAba(valor: string | undefined): Aba {
  return ehAba(valor) ? valor : "minhas";
}
