import { NextResponse } from "next/server";

import { obterSessao } from "@/lib/auth/dal";
import { ehEquipe } from "@/lib/auth/roles";
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
  // A MESMA REGRA DA TELA, e é ela que faz a rota não ser a porta dos fundos
  // dela: sem sessão de equipe sai o veredito e as duas checagens da porta.
  const sessao = await obterSessao();
  const diagnostico = await diagnosticarSupabase({
    completo: !!sessao && ehEquipe(sessao.profile.role),
  });
  return NextResponse.json(diagnostico, {
    status: diagnostico.situacaoGeral === "falha" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
