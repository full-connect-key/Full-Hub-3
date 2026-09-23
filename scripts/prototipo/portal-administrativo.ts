/**
 * Versao de prototipo de src/lib/auth/portal-administrativo.ts.
 *
 * O modulo real decide QUEM entra em /portal, e por isso ele precisa de uma
 * versao aqui: sem ela o gerador subiria o portal do cliente com a sessao de
 * socio do ambiente, e toda captura do portal viraria a tela de escolha.
 *
 * Quem manda e PROTOTIPO_PORTAL_EQUIPE, e nao o role: o gerador ja sobe um
 * servidor por perfil, entao a escolha entra como perfil -- "socio-no-portal"
 * --, do mesmo jeito que o primeiro acesso com senha provisoria entrou.
 */
import { notFound, redirect } from "next/navigation";

import { exigirSessao, type Sessao } from "@/lib/auth/dal";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import type { Client, Profile } from "@/lib/supabase/database.types";

function comoEquipeNoPortal(): boolean {
  // Colchetes de proposito, como no dal: assim o valor vem do ambiente na hora
  // do pedido e o mesmo build serve para as duas telas.
  return process.env["PROTOTIPO_PORTAL_EQUIPE"] === "1";
}

export type QuemOlhaOPortal = { sessao: Sessao; comoEquipe: boolean };

export async function exigirAreaDoCliente(): Promise<QuemOlhaOPortal> {
  const sessao = await exigirSessao();
  return { sessao, comoEquipe: comoEquipeNoPortal() };
}

export async function exigirClienteNaTela(): Promise<Sessao> {
  const { sessao, comoEquipe } = await exigirAreaDoCliente();
  if (comoEquipe) redirect("/portal");
  return sessao;
}

export async function exigirVisualizacaoDoPortal(
  slug: string,
): Promise<{ cliente: Client; profile: Profile; email: string }> {
  const sessao = await exigirSessao();
  const cliente = await obterClientePeloSlug(slug);
  if (!cliente) notFound();
  // O registro da visita nao existe aqui: o prototipo nao tem banco, e uma
  // gravacao fingida esconderia justamente o que a tela de verdade faz.
  return { cliente, profile: sessao.profile, email: sessao.email };
}
