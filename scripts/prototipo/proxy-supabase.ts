/**
 * Versao de prototipo de src/lib/supabase/proxy.ts.
 *
 * Responde que ha sempre alguem logado, para o proxy nao mandar o navegador
 * para a tela de login durante a captura das imagens.
 */
import { NextResponse, type NextRequest } from "next/server";

import { USUARIO_EXEMPLO } from "./dados-exemplo";

export async function renovarSessao(request: NextRequest) {
  return { resposta: NextResponse.next({ request }), usuario: USUARIO_EXEMPLO };
}
