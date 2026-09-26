import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";

import { acharOuCriarPasta } from "./api";
import { driveConfigurado, pastaRaiz } from "./config";

/**
 * A pasta de entrega de uma demanda (Sprint 16, Parte C).
 *
 * ---------------------------------------------------------------------------
 * **A COLUNA JÁ EXISTIA, E NINGUÉM A ATRAVESSAVA.**
 *
 * `clients.drive_folder_id` nasceu na **0002**, aparece no formulário e na
 * ficha do cliente desde o Sprint 2, é protegida contra escrita do cliente
 * desde a 0005 e foi relembrada por nome na 0031. Em vinte e tantos sprints,
 * nenhuma linha de código a LEU: ela era um campo de anotação.
 *
 * É a mesma situação de `deliverables.subtask_id` antes da 0051 e de
 * `deliverable_versions` antes da tela de Campanhas — a ponte estava
 * construída e faltava alguém atravessar. Por isso esta parte do sprint **não
 * traz migration nenhuma**: o que faltava não era schema.
 * ---------------------------------------------------------------------------
 *
 * **São dois níveis, Cliente › Demanda, e não três.** A tentação é meter o ano
 * no meio, e ela é forte — mas quem procura material procura pelo nome da
 * demanda, não pelo ano em que ela aconteceu, e a busca do Drive já resolve o
 * resto. Um nível a mais é um clique a mais em toda visita, para organizar o
 * que ninguém navega. É a mesma conta da árvore de entregáveis, que é de dois
 * níveis pela mesma razão.
 *
 * **A pasta do cliente é ACHADA OU CRIADA, e o id fica gravado.** Sem gravar,
 * toda demanda nova custaria uma busca no Drive e dependeria do nome da
 * empresa não ter mudado — e nome de empresa muda. Com o id gravado, a agência
 * pode renomear a pasta no Drive à vontade que o Full Hub continua achando.
 *
 * **E ele é escrito com o cliente do usuário, não com a chave de serviço.**
 * `clients_update` é da gestão, e é quem está clicando: se um dia esta ação
 * ficar acessível a quem não pode editar clientes, a escrita tem que ser
 * recusada pelo banco — e não passar porque o servidor usou uma chave que
 * ignora RLS.
 */

export type PastaDaEntrega = {
  /** O endereço para gravar em `tasks.link_entrega`. */
  url: string;
  /** A pasta do cliente foi criada agora? Vira parte da frase na tela. */
  clienteNasceuAgora: boolean;
};

export async function pastaDaEntregaDaDemanda(
  clienteId: string,
  tituloDaDemanda: string,
): Promise<PastaDaEntrega> {
  if (!driveConfigurado()) {
    throw new Error(
      "Google Drive não configurado. Cole o endereço da pasta à mão, ou peça " +
        "para configurarem a integração em /status.",
    );
  }

  const supabase = await criarClienteServidor();

  const { data: cliente, error } = await supabase
    .from("clients")
    .select("id, nome_empresa, drive_folder_id")
    .eq("id", clienteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!cliente) throw new Error("Cliente não encontrado.");

  let pastaDoCliente = cliente.drive_folder_id;
  let clienteNasceuAgora = false;

  if (!pastaDoCliente) {
    const criada = await acharOuCriarPasta(cliente.nome_empresa, pastaRaiz());
    pastaDoCliente = criada.id;
    clienteNasceuAgora = true;

    // `.select()` porque uma escrita barrada pelo RLS volta sem erro e sem
    // linha. Aqui o silêncio custaria caro de um jeito específico: a pasta
    // existiria no Drive, o id não ficaria gravado, e a próxima demanda
    // criaria OUTRA pasta para o mesmo cliente.
    const { data: gravado, error: erroGravar } = await supabase
      .from("clients")
      .update({ drive_folder_id: pastaDoCliente })
      .eq("id", clienteId)
      .select("id");

    if (erroGravar) throw new Error(erroGravar.message);
    if (!gravado || gravado.length === 0) {
      throw new Error(
        "A pasta foi criada no Drive, mas seu perfil não pode gravá-la na ficha " +
          "do cliente. Peça para a gestão colar o id lá.",
      );
    }
  }

  const daDemanda = await acharOuCriarPasta(tituloDaDemanda, pastaDoCliente);
  return { url: daDemanda.url, clienteNasceuAgora };
}
