import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Renova o token de sessao e devolve o usuario logado (ou null).
 *
 * Roda em toda requisicao, via src/proxy.ts. O token de acesso do Supabase
 * dura cerca de uma hora; sem esta renovacao o usuario seria deslogado no meio
 * do expediente. Os cookies novos precisam ser gravados na resposta que
 * realmente sai daqui -- por isso a funcao devolve a resposta junto.
 */
export async function renovarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  // Sem credenciais o app ainda sobe: a tela de status explica o que falta.
  if (!supabaseConfigurado()) {
    return { resposta, usuario: null };
  }

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar) {
        for (const { name, value } of cookiesParaGravar) {
          request.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesParaGravar) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // Sempre getUser(): ele valida o token no servidor do Supabase.
    // getSession() apenas le o cookie, que o navegador pode ter adulterado.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { resposta, usuario: user };
  } catch (erro) {
    // Supabase fora do ar ou sem rede. Tratamos como "nao autenticado": a
    // pessoa cai no login em vez de receber um erro 500 do site inteiro.
    console.error("[proxy] falha ao validar a sessao no Supabase:", erro);
    return { resposta, usuario: null };
  }
}
