/**
 * O contrato de retorno das Server Actions, sem nada de servidor dentro.
 *
 * Fica num arquivo separado porque as telas (componentes de navegador)
 * precisam do tipo, e `lib/acoes/resultado.ts` tem `import "server-only"`.
 */

export type Resultado<T = undefined> =
  | { ok: true; mensagem: string; dados?: T }
  | { ok: false; error: string };
