import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SITE_URL } from "@/lib/env";
import { ehFalha, erro, exigirGestorNaApi, traduzirErroDeAuth } from "@/lib/auth/api";
import { podeConcederRole } from "@/lib/dominio/equipe";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Cria alguém da equipe interna: conta no Auth, perfil de acesso e ficha de RH,
 * na mesma operação, e dispara o e-mail de definição de senha.
 *
 * A regra "só sócio concede sócio" é verificada AQUI, no servidor. Esconder a
 * opção no formulário não impede um pedido montado à mão.
 */

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome completo.").max(120),
  email: z.string().email("Esse e-mail não parece válido."),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().max(120).optional().nullable(),
  area: z.string().max(120).optional().nullable(),
  funcao: z
    .enum([
      "Atendimento",
      "Social Media",
      "Redator",
      "Design",
      "Audiovisual",
      "Trafego",
      "Desenvolvimento",
      "Gestao",
      "Outro",
    ])
    .optional()
    .nullable(),
  data_admissao: z.string().optional().nullable(),
  dias_ferias_ano: z.coerce.number().int().min(0).max(365).default(30),
});

export async function POST(request: NextRequest) {
  const sessao = await exigirGestorNaApi();
  if (ehFalha(sessao)) return sessao.resposta;

  const validacao = esquema.safeParse(await request.json().catch(() => ({})));
  if (!validacao.success) {
    return erro(validacao.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const dados = validacao.data;

  if (!podeConcederRole(sessao.profile.role, dados.role)) {
    return erro("Apenas sócios podem conceder o perfil de sócio.", 403);
  }

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (e) {
    return erro(traduzirErroDeAuth(e instanceof Error ? e.message : String(e)), 500);
  }

  const { data: jaExiste } = await admin
    .from("profiles")
    .select("id")
    .eq("email", dados.email.toLowerCase())
    .maybeSingle();

  if (jaExiste) {
    return erro("Já existe uma conta com esse e-mail.", 409);
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(dados.email, {
    data: { nome: dados.nome, role: dados.role },
    redirectTo: `${SITE_URL}/auth/callback?proximo=/redefinir-senha`,
  });

  if (error || !data.user) {
    return erro(traduzirErroDeAuth(error?.message ?? "Falha ao enviar o convite."), 400);
  }

  const usuarioId = data.user.id;

  // O trigger já criou o profile lendo os metadados; reafirmamos para não
  // depender da ordem em que as coisas acontecem do lado do Supabase.
  const { error: erroDoPerfil } = await admin
    .from("profiles")
    .update({ nome: dados.nome, role: dados.role, ativo: true })
    .eq("id", usuarioId);

  if (erroDoPerfil) {
    return erro(`Conta criada, mas o perfil falhou: ${erroDoPerfil.message}`, 500);
  }

  const { error: erroDaFicha } = await admin.from("team_members").upsert(
    {
      user_id: usuarioId,
      cargo: dados.cargo || null,
      area: dados.area || null,
      funcao: dados.funcao || null,
      data_admissao: dados.data_admissao || null,
      dias_ferias_ano: dados.dias_ferias_ano,
      ativo: true,
    },
    { onConflict: "user_id" },
  );

  if (erroDaFicha) {
    return erro(`Conta criada, mas a ficha falhou: ${erroDaFicha.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    id: usuarioId,
    mensagem: `Convite enviado para ${dados.email}.`,
  });
}
