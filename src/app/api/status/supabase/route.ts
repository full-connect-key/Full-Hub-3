import { NextResponse } from "next/server";

import { diagnosticarSupabase } from "@/lib/supabase/diagnostico";

export const dynamic = "force-dynamic";

/**
 * Mesma verificacao da pagina /status, em JSON.
 *
 * Util para checar o deploy sem abrir o navegador:
 *   curl -s https://seu-dominio.com.br/api/status/supabase | jq
 *
 * Responde 200 quando tudo esta ok e 503 quando algo falhou, entao tambem
 * serve como health check de monitoramento.
 */
export async function GET() {
  const diagnostico = await diagnosticarSupabase();
  return NextResponse.json(diagnostico, {
    status: diagnostico.situacaoGeral === "falha" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
