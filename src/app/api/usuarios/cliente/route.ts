import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SITE_URL } from "@/lib/env";
import { ehFalha, erro, exigirGestorNaApi, traduzirErroDeAuth } from "@/lib/auth/api";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Convida alguém do lado do cliente para o portal.
 *
 * Usa a service role porque criar usuário no Auth não é operação de usuário
 * comum. A chave nunca sai do servidor: o navegador só chama esta rota.
 *
 * Todos os usuários de uma empresa têm exatamente o mesmo acesso. Não há
 * hierarquia nem níveis do lado do cliente, de propósito.
 */

const esquema = z.object({
  clientId: z.string().uuid(),
  nome: z.string().min(2, "Informe o nome de quem vai acessar.").max(120),
  email: z.string().email("Esse e-mail não parece válido."),
});

export async function POST(request: NextRequest) {
  const sessao = await exigirGestorNaApi();
  if (ehFalha(sessao)) return sessao.resposta;

  const validacao = esquema.safeParse(await request.json().catch(() => ({})));
  if (!validacao.success) {
    return erro(validacao.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const { clientId, nome, email } = validacao.data;

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (e) {
    return erro(traduzirErroDeAuth(e instanceof Error ? e.message : String(e)), 500);
  }

  const { data: empresa } = await admin
    .from("clients")
    .select("id, nome_empresa")
    .eq("id", clientId)
    .maybeSingle();

  if (!empresa) return erro("Empresa não encontrada.", 404);

  // Se a pessoa já tem conta, reaproveitamos em vez de recusar: é comum o
  // mesmo contato responder por mais de uma empresa do grupo.
  const { data: jaExiste } = await admin
    .from("profiles")
    .select("id, role, nome")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  let usuarioId = jaExiste?.id ?? null;
  let convidado = false;

  if (!usuarioId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, role: "cliente" },
      redirectTo: `${SITE_URL}/auth/callback?proximo=/redefinir-senha`,
    });

    if (error || !data.user) {
      return erro(traduzirErroDeAuth(error?.message ?? "Falha ao enviar o convite."), 400);
    }
    usuarioId = data.user.id;
    convidado = true;
  } else if (jaExiste && jaExiste.role !== "cliente") {
    // Não rebaixamos alguém da equipe para cliente por engano.
    return erro(
      "Esse e-mail já pertence a alguém da equipe interna. Use outro endereço para o acesso do cliente.",
      409,
    );
  }

  // O perfil nasce pelo trigger; garantimos nome e perfil de acesso.
  await admin
    .from("profiles")
    .update({ nome, role: "cliente", ativo: true })
    .eq("id", usuarioId);

  const { error: erroDoVinculo } = await admin
    .from("client_users")
    .upsert({ client_id: clientId, user_id: usuarioId }, { onConflict: "client_id,user_id" });

  if (erroDoVinculo) {
    return erro(`Não foi possível vincular à empresa: ${erroDoVinculo.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    convidado,
    mensagem: convidado
      ? `Convite enviado para ${email}.`
      : `${nome} já tinha conta e agora enxerga ${empresa.nome_empresa}.`,
  });
}
