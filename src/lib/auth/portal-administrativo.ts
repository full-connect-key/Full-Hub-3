import "server-only";

import { forbidden, notFound, redirect } from "next/navigation";

import { exigirEquipe, exigirSessao, type Sessao } from "@/lib/auth/dal";
import { ehCliente, ehGestor } from "@/lib/auth/roles";
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
      console.error(
        "[portal administrativo] visita não registrada:",
        error.message,
      );
    }
  } catch (erro) {
    console.error("[portal administrativo] visita não registrada:", erro);
  }
}

/**
 * A guarda de /portal, o grupo `(meu)`.
 *
 * **A área do cliente passou a abrir para a gestão, e foi decisão do usuário.**
 * Até aqui `exigirCliente()` devolvia 403 para todo perfil interno, inclusive o
 * sócio: quem é da agência entrava só por /portal/{slug}. O problema prático é
 * que /portal é o endereço que a pessoa digita, e um 403 ali não ensina que o
 * caminho existe com outro nome.
 *
 * Então a gestão entra — e entra no lugar certo. Ela não tem empresa: não há
 * linha em `client_users` para ninguém da equipe, e `my_client_ids()` devolve
 * vazio. Um portal aberto assim mostraria uma tela zerada, que é pior que a
 * recusa. Por isso /portal, para quem é da gestão, é a ESCOLHA de qual portal
 * abrir, e a tela do cliente continua sendo /portal/{slug}: com a faixa de
 * aviso, sem nenhuma ação em nome dele, e deixando rastro em
 * `client_portal_views`.
 *
 * Colaborador continua recebendo 403, pela mesma razão de sempre: o portal é a
 * conta inteira de um cliente, e não o trabalho que cabe a ele.
 */
export type QuemOlhaOPortal = { sessao: Sessao; comoEquipe: boolean };

export async function exigirAreaDoCliente(): Promise<QuemOlhaOPortal> {
  const sessao = await exigirSessao();
  if (ehCliente(sessao.profile.role)) return { sessao, comoEquipe: false };
  if (ehGestor(sessao.profile.role)) return { sessao, comoEquipe: true };
  forbidden();
}

/**
 * As telas de dentro de /portal que são do cliente e só dele.
 *
 * A gestão não recebe 403 aqui: recebe o caminho. Quem é da equipe e digitou
 * /portal/configuracoes está procurando o portal de um cliente, e a escolha
 * dele fica em /portal. Recusar seria tecnicamente correto e inútil.
 */
export async function exigirClienteNaTela(): Promise<Sessao> {
  const { sessao, comoEquipe } = await exigirAreaDoCliente();
  if (comoEquipe) redirect("/portal");
  return sessao;
}
