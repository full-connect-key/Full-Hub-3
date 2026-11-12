import "server-only";

import { notFound, redirect } from "next/navigation";

import { exigirEquipe, exigirSessao, type Sessao } from "@/lib/auth/dal";
import { ehCliente } from "@/lib/auth/roles";
import { obterClientePeloSlug } from "@/lib/dados/portais-de-clientes";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/supabase/database.types";

/**
 * A guarda de /portal/{slug}.
 *
 * Duas recusas, nesta ordem:
 *
 *   1. Quem não é da equipe nem chega aqui — `exigirEquipe()` já barra.
 *   2. Slug que não existe, ou de empresa desativada, é 404.
 *
 * **ERAM TRÊS, E A DO MEIO SAIU por decisão do usuário**: *"preciso que passe
 * a aba Portal dos Clientes, para a aba Principal, com acesso de todos"*. Ela
 * devolvia 403 ao colaborador, com o argumento de que ver o portal de um
 * cliente é da gestão — *"é a visão do cliente inteira, de todas as contas, e
 * não do trabalho que cabe à pessoa"*.
 *
 * **A segunda metade daquela frase continua verdadeira e deixou de ser a razão
 * certa**, porque ela descreve o que a tela MOSTRA e não o que ela DEIXA
 * FAZER: aqui ninguém decide, ninguém comenta e ninguém escreve — a visita é
 * leitura, e quem recorta o que cada pessoa lê é a RLS de cada tabela do
 * portal, não esta linha. E quem produz a peça tem a mesma pergunta de quem a
 * distribui, *como isto chegou ao cliente?*.
 *
 * ***O que isso abre, e é dito em vez de escondido:*** o colaborador passa a
 * ver, de uma conta, o que o cliente dela vê — a grade de social do mês, a
 * árvore das campanhas, a Biblioteca. Era já tudo legível para `is_staff()`
 * pelo painel; o que muda é o ARRANJO, que é a frase que criou esta rota.
 *
 * E então registra a visita. **A policy de INSERT de `client_portal_views`
 * abriu para `is_staff()` na 0133, no mesmo commit**: deixada em `is_gestor()`,
 * a visita do colaborador voltaria sem erro e sem linha, e o bloco da ficha do
 * cliente passaria a mentir por omissão — a trilha mais curta que a verdade é
 * pior que trilha nenhuma. **Quem LÊ o rastro continua sendo `is_gestor()`**:
 * quem andou vendo o portal de quem é informação sobre as outras pessoas.
 *
 * O registro NÃO é condição de entrada: se a gravação falhar, a tela abre
 * assim mesmo. Trancar a porta por causa de um log seria transformar um
 * problema de auditoria num problema de trabalho.
 */
export async function exigirVisualizacaoDoPortal(
  slug: string,
): Promise<{ cliente: Client; profile: Profile; email: string }> {
  const { email, profile } = await exigirEquipe();

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
 * Então a equipe entra — e entra no lugar certo. Ela não tem empresa: não há
 * linha em `client_users` para ninguém da equipe, e `my_client_ids()` devolve
 * vazio. Um portal aberto assim mostraria uma tela zerada, que é pior que a
 * recusa. Por isso /portal, para quem é da equipe, é a ESCOLHA de qual portal
 * abrir, e a tela do cliente continua sendo /portal/{slug}: com a faixa de
 * aviso, sem nenhuma ação em nome dele, e deixando rastro em
 * `client_portal_views`.
 *
 * **E ERA SÓ A GESTÃO ATÉ AQUI**, com o colaborador levando 403 — *"o portal é
 * a conta inteira de um cliente, e não o trabalho que cabe a ele"*. Saiu por
 * decisão do usuário, junto com a entrada do menu e com a guarda de
 * /portal/{slug}: as três camadas tinham de mudar no mesmo commit, senão o
 * item novo levaria a um 403, que é o chip de "Demandas" de Minhas Tasks pela
 * segunda vez.
 *
 * `comoEquipe` CONTINUA querendo dizer o mesmo, e é ele que mantém a tela em
 * modo leitura para toda a equipe: ele desliga as três decisões e a conversa,
 * e troca as frases de "esperando você" para "esperando o cliente".
 */
export type QuemOlhaOPortal = { sessao: Sessao; comoEquipe: boolean };

export async function exigirAreaDoCliente(): Promise<QuemOlhaOPortal> {
  const sessao = await exigirSessao();
  if (ehCliente(sessao.profile.role)) return { sessao, comoEquipe: false };
  return { sessao, comoEquipe: true };
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
