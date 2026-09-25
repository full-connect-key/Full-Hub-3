/**
 * As duas abas de Gestão de Pessoas — o que o servidor e a tela usam JUNTOS.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO NÃO MORA EM `abas.tsx`
 *
 * Porque `abas.tsx` é `"use client"`, e **valor exportado de arquivo cliente
 * não vale no servidor**. `ehAba` morava lá, e `page.tsx` — que é Server
 * Component — a chamava para ler a aba da URL. O que o Next entrega ao
 * servidor não é a função: é uma referência de cliente. Chamá-la estoura com
 *
 *     Attempted to call ehAba() from the server but ehAba is on the client.
 *
 * e a página inteira devolve 500. **Gestão de Tasks, Full Days e Financeiro
 * não tinham o problema** porque nenhum deles chama função de arquivo cliente
 * no servidor: o Financeiro tem este mesmo arquivo (`financeiro/vocabulario.ts`)
 * e o Full Days lê a aba dentro do próprio `page.tsx`. Aqui faltava o lugar.
 *
 * **E o `npm run build` passa.** Ele passou, e o `npm run lint`, e o
 * `npx tsc --noEmit`: o tipo está certo, o import existe, e o erro só nasce
 * quando alguém PEDE a página. Foi o usuário quem encontrou, clicando no menu.
 * Por isso o gerador de protótipo passou a gravar o log do servidor e a
 * recusar a rodada quando uma tela responde 500 — antes disso, a imagem da
 * página de erro saía e a rodada terminava dizendo "Pronto".
 *
 * A regra geral está no CLAUDE.md, e vale nos dois sentidos: valor que os dois
 * lados usam vai para um módulo **sem diretiva nenhuma**. Tipo pode ficar no
 * arquivo cliente — tipo é apagado na compilação.
 * ---------------------------------------------------------------------------
 */

export type Aba = "clientes" | "equipe";

export const ABAS: Aba[] = ["clientes", "equipe"];

/** A aba pedida na URL, quando é uma das duas. */
export function ehAba(valor: unknown): valor is Aba {
  return typeof valor === "string" && (ABAS as string[]).includes(valor);
}
