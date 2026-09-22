import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/supabase/database.types";

/**
 * Camada de acesso aos dados de autenticacao (DAL).
 *
 * Toda pagina ou action que precisa saber quem esta logado passa por aqui,
 * em vez de chamar o Supabase direto. Assim a regra fica num lugar so.
 *
 * `cache()` do React deduplica as chamadas dentro da mesma requisicao: se o
 * layout, a pagina e tres componentes pedirem o usuario, o Supabase e
 * consultado uma vez.
 */

export const obterUsuario = cache(async () => {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Usuario logado + perfil, ou null. */
export const obterSessao = cache(async (): Promise<{ usuario: NonNullable<Awaited<ReturnType<typeof obterUsuario>>>; perfil: Perfil | null } | null> => {
  const usuario = await obterUsuario();
  if (!usuario) return null;

  const supabase = await criarClienteServidor();
  const { data: perfil } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", usuario.id)
    .maybeSingle();

  if (perfil) return { usuario, perfil };

  // Rede de seguranca. Normalmente o perfil ja nasceu junto com o usuario,
  // pelo trigger ao_criar_usuario. Mas alguns projetos Supabase restringem o
  // schema auth e nao deixam criar esse trigger -- nesse caso o dashboard
  // cria o registro que falta no primeiro acesso.
  //
  // Nao ha risco de alguem nascer admin por aqui: a policy so aceita o
  // proprio id, e o trigger perfis_proteger_papel forca papel 'membro'.
  const metadados = usuario.user_metadata as Record<string, unknown> | undefined;
  const nomeDosMetadados = metadados?.nome_completo ?? metadados?.full_name;

  const { data: perfilCriado } = await supabase
    .from("perfis")
    .insert({
      id: usuario.id,
      email: usuario.email ?? null,
      nome_completo: typeof nomeDosMetadados === "string" ? nomeDosMetadados : null,
    })
    .select("*")
    .maybeSingle();

  return { usuario, perfil: perfilCriado ?? null };
});

/**
 * Use no topo de qualquer pagina privada. Se nao houver sessao, redireciona
 * para o login em vez de renderizar a tela.
 */
export async function exigirSessao() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  return sessao;
}

/** Nome curto para saudacao: primeiro nome, ou a parte do e-mail antes do @. */
export function nomeDeExibicao(perfil: Perfil | null, email: string | undefined): string {
  const completo = perfil?.nome_completo?.trim();
  if (completo) return completo.split(/\s+/)[0];
  return email?.split("@")[0] ?? "usuário";
}
