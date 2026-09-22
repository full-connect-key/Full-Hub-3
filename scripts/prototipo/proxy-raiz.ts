import { NextResponse } from "next/server";

/**
 * Versao de prototipo de src/proxy.ts, copiada por cima dele dentro da copia
 * temporaria.
 *
 * Deixa passar tudo, sem checar sessao. Sem isso as telas publicas nao dao
 * para fotografar: o proxy de verdade considera que ha alguem logado durante
 * o prototipo e manda /login direto para /painel.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
