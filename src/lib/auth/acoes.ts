"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { SITE_URL } from "@/lib/env";
import {
  consumirTentativa,
  enderecoDeQuemChama,
  esperePor,
  LIMITES,
  perdoarTentativas,
} from "@/lib/acoes/limite";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehCliente, rotaInicialDoRole } from "./roles";
import { esquemaDeLogin, esquemaDeNovaSenha, esquemaDeRecuperacao } from "./esquemas";

export type EstadoFormulario = { erro?: string; sucesso?: string };

/**
 * O Supabase responde em ingles e, em alguns casos, de forma generica de
 * proposito (para nao revelar se um e-mail existe). Traduzimos mantendo essa
 * discricao.
 *
 * SEMPRE LOGA A MENSAGEM ORIGINAL. A regra do projeto é que nenhuma falha
 * pode sumir em silêncio, e o login estava fora dela: quem via a tela recebia
 * uma frase que não dizia nada e o motivo real não ficava em lugar nenhum.
 * Agora ele está no `pm2 logs full-hub`, que é onde alguém vai procurar.
 *
 * As três últimas traduções são problemas de CONFIGURAÇÃO, não de quem está
 * digitando. A diferença importa na tela: "tente novamente em instantes"
 * manda a pessoa insistir num erro que nunca vai passar sozinho.
 */
function traduzirErro(mensagem: string, contexto: string): string {
  console.error(`[auth:${contexto}] Supabase respondeu: ${mensagem}`);

  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("new password should be different"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("fetch failed") || m.includes("network"))
    return "Não foi possível falar com o Supabase. Confira a conexão e as variáveis de ambiente.";

  // Login por e-mail desligado no projeto. Acontece ao desmarcar "Enable
  // Email provider" querendo desmarcar "Enable Sign Ups" — são dois
  // interruptores na mesma tela, e um deles mata o login de todo mundo.
  if (m.includes("logins are disabled") || m.includes("provider is disabled"))
    return "O login por e-mail está desligado no Supabase. Em Authentication → Sign In / Providers, religue o provedor Email — o que fecha o cadastro é “Enable Sign Ups”, não o provedor.";

  // Chave anon errada, trocada ou revogada.
  if (m.includes("invalid api key") || m.includes("invalid jwt"))
    return "A chave do Supabase não foi aceita. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY no servidor e reconstrua — o valor é embutido no build.";

  // Schema de auth incompleto, ou a migration não rodou inteira.
  if (m.includes("database error"))
    return "O banco recusou a consulta de autenticação. Abra /status para o diagnóstico.";

  return "Não foi possível entrar, e não foi por causa da senha. Isto é configuração: abra /status para o diagnóstico, ou veja o motivo exato no log do servidor.";
}

/**
 * Decide para onde mandar a pessoa depois do login.
 *
 * Um destino guardado antes do login so e respeitado se pertencer a area do
 * perfil dela -- senao um cliente que tentou /painel voltaria para /painel e
 * levaria um 403 logo apos entrar.
 */
function destinoDepoisDoLogin(role: Parameters<typeof rotaInicialDoRole>[0], pedido: string) {
  const padrao = rotaInicialDoRole(role);
  if (!pedido.startsWith("/") || pedido.startsWith("//")) return padrao;

  const areaDoCliente = pedido === "/portal" || pedido.startsWith("/portal/");
  const areaInterna = pedido === "/painel" || pedido.startsWith("/painel/");

  if (ehCliente(role) && areaDoCliente) return pedido;
  if (!ehCliente(role) && areaInterna) return pedido;
  return padrao;
}

export async function entrar(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaDeLogin.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    senha: String(formData.get("senha") ?? ""),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira os dados informados." };
  }

  // ------------------------------------------------------------------------
  // O LIMITE VEM ANTES DE FALAR COM O SUPABASE, e a ordem é o ponto: depois
  // dele, cada tentativa recusada já teria custado uma ida ao servidor de
  // autenticação. O que se está limitando é justamente isso.
  //
  // São DUAS contas, e nenhuma das duas sozinha resolve. Por IP barra a
  // máquina que varre a lista de e-mails da agência; por e-mail barra quem
  // tem botnet e troca de endereço a cada tentativa. O teto por e-mail é o
  // mais folgado de propósito — veja `LIMITES`: trancar por e-mail é o que
  // deixaria um estranho trancar o sócio para fora.
  //
  // A MENSAGEM É A MESMA NOS DOIS CASOS, e não diz qual dos dois estourou.
  // "Esse e-mail atingiu o limite" seria confirmar que o e-mail existe, na
  // única tela do produto que se recusa a confirmar isso.
  // ------------------------------------------------------------------------
  const email = validacao.data.email.toLowerCase();
  const ip = await enderecoDeQuemChama();
  const chaveDoEmail = `login:email:${email}`;

  const porEmail = await consumirTentativa(chaveDoEmail, LIMITES.loginPorEmail);
  const porIp = ip
    ? await consumirTentativa(`login:ip:${ip}`, LIMITES.loginPorIp)
    : { permitido: true, espereSegundos: 0 };

  if (!porEmail.permitido || !porIp.permitido) {
    const espere = Math.max(
      porEmail.permitido ? 0 : porEmail.espereSegundos,
      porIp.permitido ? 0 : porIp.espereSegundos,
    );
    console.error(`[auth:entrar] limite de tentativas atingido (ip=${ip ?? "?"})`);
    return {
      erro: `Muitas tentativas seguidas. Aguarde ${esperePor(espere)} e tente de novo.`,
    };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validacao.data.email,
    password: validacao.data.senha,
  });

  if (error || !data.user) {
    return { erro: error ? traduzirErro(error.message, "entrar") : "E-mail ou senha incorretos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      erro: "Sua conta existe, mas ainda não tem perfil de acesso. Fale com a equipe interna.",
    };
  }

  if (!profile.ativo) {
    await supabase.auth.signOut();
    return { erro: "Esta conta está desativada. Fale com a equipe interna." };
  }

  // ENTROU: a cota do e-mail volta. Sem isto o contador conta tentativa e não
  // erro, e quem entra e sai várias vezes num dia — trocando de navegador,
  // abrindo o portal de um cliente — levaria a recusa no meio do expediente
  // sem ter errado nada. A do IP não volta: um endereço pode ter mais de uma
  // pessoa atrás, e o acerto de uma não fala pelas outras.
  await perdoarTentativas(chaveDoEmail);

  const destino = destinoDepoisDoLogin(
    profile.role,
    String(formData.get("redirecionar") ?? ""),
  );

  revalidatePath("/", "layout");
  // redirect() funciona lancando uma excecao interna do Next: precisa ficar
  // fora de qualquer try/catch.
  redirect(destino);
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function enviarLinkDeRecuperacao(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaDeRecuperacao.safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira o e-mail informado." };
  }

  // CADA TENTATIVA AQUI MANDA UMA MENSAGEM DE VERDADE PARA UMA PESSOA DE
  // VERDADE, e é isso que este limite protege: sem ele, o formulário de
  // "esqueci a senha" é um botão de encher a caixa de entrada de qualquer
  // e-mail da agência, hospedado pela própria agência.
  //
  // E AQUI NÃO SE PERDOA NADA. No login existe um "deu certo" em que confiar;
  // aqui a resposta é idêntica havendo conta ou não — de propósito, para não
  // entregar quais e-mails existem. Sem um sinal de sucesso confiável, devolver
  // cota seria devolver com base em nada.
  const emailPedido = validacao.data.email.toLowerCase();
  const enderecoIp = await enderecoDeQuemChama();

  const cotaEmail = await consumirTentativa(
    `recuperacao:email:${emailPedido}`,
    LIMITES.recuperacaoPorEmail,
  );
  const cotaIp = enderecoIp
    ? await consumirTentativa(`recuperacao:ip:${enderecoIp}`, LIMITES.recuperacaoPorIp)
    : { permitido: true, espereSegundos: 0 };

  if (!cotaEmail.permitido || !cotaIp.permitido) {
    const espere = Math.max(
      cotaEmail.permitido ? 0 : cotaEmail.espereSegundos,
      cotaIp.permitido ? 0 : cotaIp.espereSegundos,
    );
    console.error(
      `[auth:recuperar-senha] limite atingido (ip=${enderecoIp ?? "?"})`,
    );
    return {
      erro: `Muitos pedidos seguidos. Aguarde ${esperePor(espere)} e tente de novo.`,
    };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(validacao.data.email, {
    redirectTo: `${SITE_URL}/auth/callback?proximo=/redefinir-senha`,
  });

  if (error) return { erro: traduzirErro(error.message, "recuperar-senha") };

  // Resposta identica havendo conta ou nao: nao entregamos a quem tenta
  // adivinhar a informacao de quais e-mails existem.
  return {
    sucesso: "Se houver uma conta com esse e-mail, o link de redefinição chega em instantes.",
  };
}

export async function definirNovaSenha(
  _estadoAnterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaDeNovaSenha.safeParse({
    senha: String(formData.get("senha") ?? ""),
    confirmacao: String(formData.get("confirmacao") ?? ""),
  });

  if (!validacao.success) {
    return { erro: validacao.error.issues[0]?.message ?? "Confira as senhas informadas." };
  }

  const supabase = await criarClienteServidor();

  // O link do e-mail ja criou uma sessao temporaria. Sem ela nao ha o que
  // redefinir -- normalmente quer dizer que o link expirou.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Link expirado ou inválido. Peça um novo link de redefinição." };
  }

  const { error } = await supabase.auth.updateUser({ password: validacao.data.senha });
  if (error) return { erro: traduzirErro(error.message, "definir-senha") };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/", "layout");
  redirect(profile ? rotaInicialDoRole(profile.role) : "/login");
}
