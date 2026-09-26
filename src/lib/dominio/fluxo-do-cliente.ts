/**
 * O que os dois lados precisam saber sobre os padrões de uma conta (0064).
 *
 * ---------------------------------------------------------------------------
 * **MÓDULO SEM DIRETIVA NENHUMA, e é a convenção respondendo a um erro real.**
 *
 * A primeira versão deixava esta constante em `lib/dados/fluxo-do-cliente.ts`,
 * que tem `import "server-only"` — e a aba, que é `"use client"`, a importava.
 * O `npm run build` quebrou apontando para `server.ts`, três importações
 * abaixo, dizendo que um Client Component alcançava código de servidor.
 *
 * É o espelho do que `check:fronteira` procura: lá, servidor importando VALOR
 * de arquivo cliente; aqui, cliente importando valor de arquivo `server-only`.
 * Os dois têm a mesma saída — o valor mora num módulo sem diretiva, e cada lado
 * importa dele.
 * ---------------------------------------------------------------------------
 */

/**
 * O prazo de resposta do cliente quando a conta nunca foi configurada.
 *
 * Três dias é o mesmo `default` da coluna `prazo_aprovacao_cliente_dias`, e os
 * dois existem de propósito: a coluna decide o que fica gravado, esta constante
 * decide o que a tela conta para a conta que ainda não tem linha. Sem ela,
 * "passou do prazo" não teria com o que comparar e o selo simplesmente não
 * apareceria para quem nunca abriu esta aba — que é a maioria no dia em que ela
 * nasce.
 */
export const PRAZO_DE_APROVACAO_PADRAO = 3;
