import { NextResponse, type NextRequest } from "next/server";

import { supabaseConfigurado } from "@/lib/env";
import { renovarSessao } from "@/lib/supabase/proxy";

/**
 * Proxy (nas versoes anteriores do Next chamava-se middleware).
 *
 * Roda antes de cada requisicao e cuida de duas coisas:
 *   1. renovar o token de sessao do Supabase, para ninguem cair no meio do uso;
 *   2. barrar rotas privadas para quem nao esta logado.
 *
 * A checagem aqui e a primeira barreira, nao a unica: cada pagina e cada
 * action confere a sessao de novo (src/lib/auth/dal.ts), e o RLS do banco
 * decide o que cada usuario pode ler. Sao tres camadas independentes.
 */

/** Rotas que qualquer visitante pode abrir. */
const ROTAS_PUBLICAS = [
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/status",
  "/api/status",
  "/auth",
];

function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ainda sem credenciais do Supabase: manda todo mundo para a tela de status,
  // que lista exatamente quais variaveis faltam.
  if (!supabaseConfigurado()) {
    if (ehRotaPublica(pathname) && pathname !== "/login") {
      return NextResponse.next();
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/status";
    return NextResponse.redirect(destino);
  }

  const { resposta, usuario } = await renovarSessao(request);

  if (!usuario && !ehRotaPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    // Guarda para onde a pessoa queria ir, e volta pra la depois do login.
    destino.searchParams.set("redirecionar", pathname);
    return NextResponse.redirect(destino);
  }

  // Ja logado nao precisa ver a tela de login.
  if (usuario && pathname === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/dashboard";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos os arquivos estaticos -- eles nao precisam de sessao e
     * chamar o Supabase para cada icone so deixaria o site lento.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
