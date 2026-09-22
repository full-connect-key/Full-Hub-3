import { NextResponse, type NextRequest } from "next/server";

import { supabaseConfigurado } from "@/lib/env";
import { renovarSessao } from "@/lib/supabase/proxy";

/**
 * Proxy -- nas versoes anteriores do Next chamava-se middleware.
 *
 * Roda antes de cada requisicao e cuida de duas coisas:
 *   1. renovar o token de sessao do Supabase, para ninguem cair no meio do uso;
 *   2. mandar quem nao esta logado para a tela de login.
 *
 * O que NAO e decidido aqui e o perfil de acesso. Saber se alguem e cliente ou
 * equipe exige consultar o banco, e fazer isso a cada requisicao -- inclusive
 * para cada imagem e cada arquivo de estilo -- deixaria tudo lento. A checagem
 * de perfil fica nos layouts de cada area, via exigirEquipe() e
 * exigirCliente(), que devolvem HTTP 403.
 *
 * Sao tres camadas independentes: o proxy, a checagem no servidor de cada
 * pagina, e o RLS do Postgres, que e quem realmente protege os dados.
 */

const ROTAS_PUBLICAS = [
  "/login",
  "/esqueci-senha",
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

  // Ainda sem credenciais do Supabase: todo mundo vai para a tela de status,
  // que lista exatamente quais variaveis faltam.
  if (!supabaseConfigurado()) {
    if (ehRotaPublica(pathname) && pathname !== "/login") {
      return NextResponse.next();
    }
    const destino = request.nextUrl.clone();
    destino.pathname = "/status";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  const { resposta, usuario } = await renovarSessao(request);

  if (!usuario && !ehRotaPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    // Guarda para onde a pessoa queria ir, e volta para la depois do login.
    if (pathname !== "/") destino.searchParams.set("redirecionar", pathname);
    return NextResponse.redirect(destino);
  }

  if (usuario && pathname === "/login") {
    // Quem ja esta logado nao precisa da tela de login. A raiz decide a area
    // certa conforme o perfil, entao mandamos para la.
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos os arquivos estaticos -- eles nao precisam de sessao, e
     * chamar o Supabase para cada icone so deixaria o site lento.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
