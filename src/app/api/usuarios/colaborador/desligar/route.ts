import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ehFalha, erro, exigirSocioNaApi, traduzirErroDeAuth } from "@/lib/auth/api";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Desliga alguém da equipe.
 *
 * NÃO apaga a pessoa. Desligar é:
 *   - profiles.ativo = false          (some das listas e dos seletores)
 *   - team_members.ativo = false + desligado_em
 *   - acesso revogado no Auth         (não consegue mais entrar)
 *   - clientes sob responsabilidade dela passam para quem receber a
 *     transferência, ou ficam sem responsável
 *
 * As tasks e os registros históricos continuam com o nome dela. Apagar a
 * pessoa apagaria a autoria do que ela fez -- e é justamente esse histórico
 * que a agência precisa manter.
 *
 * Só sócio faz isso.
 */

const esquema = z.object({
  userId: z.string().uuid(),
  /** Para quem vão as tasks em aberto e os clientes sob responsabilidade. */
  transferirPara: z.string().uuid().optional().nullable(),
});

const CEM_ANOS_EM_HORAS = "876000h";

export async function POST(request: NextRequest) {
  const sessao = await exigirSocioNaApi();
  if (ehFalha(sessao)) return sessao.resposta;

  const validacao = esquema.safeParse(await request.json().catch(() => ({})));
  if (!validacao.success) {
    return erro(validacao.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const { userId, transferirPara } = validacao.data;

  if (userId === sessao.usuarioId) {
    return erro("Você não pode desligar a si mesmo.", 400);
  }

  let admin;
  try {
    admin = criarClienteAdmin();
  } catch (e) {
    return erro(traduzirErroDeAuth(e instanceof Error ? e.message : String(e)), 500);
  }

  const { data: pessoa } = await admin
    .from("profiles")
    .select("id, nome, role")
    .eq("id", userId)
    .maybeSingle();

  if (!pessoa) return erro("Pessoa não encontrada.", 404);
  if (pessoa.role === "cliente") return erro("Essa conta não é da equipe interna.", 400);

  if (transferirPara) {
    const { data: destino } = await admin
      .from("profiles")
      .select("id, ativo, role")
      .eq("id", transferirPara)
      .maybeSingle();

    if (!destino || !destino.ativo || destino.role === "cliente") {
      return erro("Escolha alguém da equipe que esteja ativo para receber a transferência.", 400);
    }
  }

  // Clientes sob responsabilidade não podem ficar apontando para alguém que
  // saiu: ou passam para quem recebeu a transferência, ou ficam sem dono --
  // e sem dono aparece na lista, o que é melhor do que desaparecer.
  const { error: erroDeTransferencia } = await admin
    .from("clients")
    .update({ responsavel_atendimento_id: transferirPara ?? null })
    .eq("responsavel_atendimento_id", userId);

  if (erroDeTransferencia) {
    return erro(`Não foi possível transferir os clientes: ${erroDeTransferencia.message}`, 500);
  }

  // Sprint 3+: transferir aqui as tasks em aberto para `transferirPara`.

  const hoje = new Date().toISOString().slice(0, 10);

  const { error: erroDaFicha } = await admin
    .from("team_members")
    .update({ ativo: false, desligado_em: hoje })
    .eq("user_id", userId);

  if (erroDaFicha) {
    return erro(`Não foi possível atualizar a ficha: ${erroDaFicha.message}`, 500);
  }

  const { error: erroDoPerfil } = await admin
    .from("profiles")
    .update({ ativo: false })
    .eq("id", userId);

  if (erroDoPerfil) {
    return erro(`Não foi possível desativar o perfil: ${erroDoPerfil.message}`, 500);
  }

  // Bloqueio por cem anos é como o Supabase revoga acesso sem apagar a conta.
  const { error: erroDoBloqueio } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: CEM_ANOS_EM_HORAS,
  });

  return NextResponse.json({
    ok: true,
    mensagem: erroDoBloqueio
      ? `${pessoa.nome} foi desligada, mas o acesso não pôde ser revogado no Auth (${erroDoBloqueio.message}). Revogue manualmente em Authentication > Users.`
      : `${pessoa.nome} foi desligada. O histórico continua com o nome dela.`,
    acessoRevogado: !erroDoBloqueio,
  });
}
