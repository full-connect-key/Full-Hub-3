import "server-only";

import { gerarSenhaProvisoria } from "./senha-provisoria";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/database.types";

import { ErroDeAcao, mensagemDeErro } from "./resultado";

/**
 * Criação de contas no Supabase Auth.
 *
 * Por que aqui e não num Route Handler chamado pelo navegador: isto usa a
 * service role key, que ignora todo o RLS. Ela nunca pode sair do servidor.
 * O arquivo lib/supabase/admin.ts tem `import "server-only"` justamente para
 * o build quebrar se alguém importar isso num componente de navegador.
 *
 * POR QUE NÃO `inviteUserByEmail`
 *   Era o que o projeto usava, e é a causa mais provável de "adicionar
 *   colaborador não faz nada": o convite só existe se o e-mail sair. Num
 *   projeto Supabase sem SMTP próprio, o remetente embutido só entrega para
 *   os e-mails da equipe do projeto e para por volta de 2 mensagens por hora.
 *   Passando desse limite, `inviteUserByEmail` devolve erro e NÃO cria a
 *   conta — o cadastro inteiro se perde por causa do e-mail.
 *
 *   Aqui a conta é criada primeiro, com `createUser`, que não depende de
 *   e-mail nenhum. Só depois tentamos enviar o link de senha. Se o envio
 *   falhar, geramos o link e devolvemos para a tela mostrar, para a agência
 *   passar por WhatsApp. O cadastro nunca mais se perde por causa de SMTP.
 */

export type ContaCriada = {
  usuarioId: string;
  /** Já tinha conta no Full Hub: nada foi criado, só reaproveitado. */
  jaExistia: boolean;
  emailEnviado: boolean;
  /** Só vem preenchido quando o e-mail não pôde ser enviado. */
  linkDeSenha: string | null;
  /** Motivo real da falha de envio, para explicar na tela. */
  motivoDoEmail: string | null;
};

export type ClienteAdmin = ReturnType<typeof criarClienteAdmin>;

/** Traduz os erros do Supabase Auth que a equipe vai encontrar de verdade. */
export function traduzirErroDeAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (m.includes("invalid email")) return "Esse e-mail não parece válido.";
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitos envios seguidos. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("service_role") || m.includes("not authorized") || m.includes("invalid api key")) {
    return (
      "A chave de serviço do Supabase não está configurada ou está errada. " +
      "Confira SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o servidor."
    );
  }
  if (m.includes("database error")) {
    return `O banco recusou a criação da conta: ${mensagem}. Rode a migration 0005.`;
  }
  return mensagem;
}

/** O admin, com erro legível quando a chave não está configurada. */
export function adminOuErro(): ClienteAdmin {
  try {
    return criarClienteAdmin();
  } catch (e) {
    throw new ErroDeAcao(traduzirErroDeAuth(mensagemDeErro(e)));
  }
}

/**
 * Cria a conta no Auth e garante a linha em `profiles`.
 *
 * `email_confirm: true` não é descuido: quem cria a conta é a agência e o
 * endereço já é conhecido. Com `false` o Supabase recusaria o login até uma
 * confirmação por e-mail que, sem SMTP próprio, quase nunca chega.
 *
 * A CONTA NASCE COM SENHA PROVISÓRIA, sorteada por pessoa, e com
 * `deve_trocar_senha = true`. Antes ela nascia sem senha nenhuma e a porta
 * era um link de recuperação — o que fazia a entrada de alguém novo depender
 * de um e-mail sair. A senha volta desta função para a tela mostrar UMA VEZ a
 * quem cadastrou; não é guardada em lugar nenhum além do hash do Auth.
 */
export async function criarConta(
  admin: ClienteAdmin,
  { email, nome, role }: { email: string; nome: string; role: UserRole },
): Promise<{ usuarioId: string; jaExistia: boolean; senhaProvisoria: string | null }> {
  const enderecoNormalizado = email.trim().toLowerCase();

  const { data: existente } = await admin
    .from("profiles")
    .select("id, role, nome")
    .eq("email", enderecoNormalizado)
    .maybeSingle();

  if (existente) return { usuarioId: existente.id, jaExistia: true, senhaProvisoria: null };

  const senhaProvisoria = gerarSenhaProvisoria();

  const { data, error } = await admin.auth.admin.createUser({
    email: enderecoNormalizado,
    email_confirm: true,
    password: senhaProvisoria,
    user_metadata: { nome, role },
  });

  if (error || !data.user) {
    throw new ErroDeAcao(traduzirErroDeAuth(error?.message ?? "Falha ao criar a conta."));
  }

  const usuarioId = data.user.id;

  // O trigger handle_new_user já deve ter criado o profile. A partir da 0005
  // ele não derruba mais o cadastro quando falha, só avisa no log — então
  // conferimos e criamos a linha na mão se precisar.
  const { error: erroDoPerfil } = await admin
    .from("profiles")
    .upsert(
      {
        id: usuarioId,
        email: enderecoNormalizado,
        nome,
        role,
        ativo: true,
        deve_trocar_senha: true,
      },
      { onConflict: "id" },
    );

  if (erroDoPerfil) {
    await admin.auth.admin.deleteUser(usuarioId).catch(() => undefined);
    throw new ErroDeAcao(
      `A conta foi criada mas o perfil falhou (${erroDoPerfil.message}). Nada foi mantido — tente de novo.`,
    );
  }

  return { usuarioId, jaExistia: false, senhaProvisoria };
}

/** Desfaz uma conta recém-criada quando um passo seguinte falha. */
export async function desfazerConta(admin: ClienteAdmin, usuarioId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(usuarioId);
  if (error) {
    console.error("[contas] rollback nao conseguiu apagar o usuario", usuarioId, error);
  }
}
