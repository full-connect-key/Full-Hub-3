import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Ponto de chegada dos links que o Supabase manda por e-mail:
 * confirmacao de cadastro, convite e redefinicao de senha.
 *
 * Dois formatos sao aceitos, porque o Supabase usa um ou outro dependendo
 * de como o template de e-mail do projeto esta configurado:
 *   - ?code=...                 (fluxo PKCE)
 *   - ?token_hash=...&type=...  (templates de e-mail padrao)
 *
 * Lembre de cadastrar esta URL em Supabase > Authentication > URL Configuration
 * > Redirect URLs, senao o link volta com erro.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  const proximo = searchParams.get("proximo") ?? searchParams.get("next") ?? "/dashboard";
  // Nunca redirecionar para fora do dashboard, mesmo se o parametro for adulterado.
  const destino = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/dashboard";

  const supabase = await criarClienteServidor();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  }

  return NextResponse.redirect(new URL("/auth/erro", origin));
}
