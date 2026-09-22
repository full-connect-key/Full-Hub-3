import "server-only";

import { forbidden, notFound } from "next/navigation";

import { exigirEquipe } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/supabase/database.types";

/**
 * A guarda de /portal/{slug}.
 *
 * Três recusas, nesta ordem:
 *
 *   1. Quem não é da equipe nem chega aqui — `exigirEquipe()` já barra.
 *   2. Colaborador recebe 403. Ver o portal de um cliente é da gestão: é a
 *      visão do cliente inteira, de todas as contas, e não do trabalho que
 *      cabe à pessoa. Esconder o link na tela inicial não bastaria — quem
 *      recebesse o endereço colado entraria.
 *   3. Slug que não existe, ou de empresa desativada, é 404.
 *
 * E então registra a visita. O registro é para o Sprint 16 poder responder
 * "quem andou vendo o portal da Mundo Verde no mês passado" — a RLS de
 * `client_portal_views` só aceita a linha em nome de quem está logado, então
 * não dá para forjar.
 *
 * O registro NÃO é condição de entrada: se a gravação falhar, a tela abre
 * assim mesmo. Trancar a porta por causa de um log seria transformar um
 * problema de auditoria num problema de trabalho.
 */
export async function exigirVisualizacaoDoPortal(
  slug: string,
): Promise<{ cliente: Client; profile: Profile; email: string }> {
  const { email, profile } = await exigirEquipe();

  if (!ehGestor(profile.role)) forbidden();

  const cliente = await obterClientePeloSlug(slug);
  if (!cliente || !cliente.ativo) notFound();

  await registrarVisita(cliente.id, profile.id);

  return { cliente, profile, email };
}

async function registrarVisita(clientId: string, staffUserId: string) {
  try {
    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("client_portal_views")
      .insert({ client_id: clientId, staff_user_id: staffUserId })
      .select("id");

    // `.select()` porque uma escrita barrada pelo RLS volta sem erro e sem
    // linha. Aqui não há tela para avisar, então o console do servidor é onde
    // o problema aparece — em silêncio total, a auditoria ficaria vazia e
    // ninguém descobriria antes de precisar dela.
    if (error) {
      console.error("[portal administrativo] visita não registrada:", error.message);
    }
  } catch (erro) {
    console.error("[portal administrativo] visita não registrada:", erro);
  }
}
