"use server";

import { revalidatePath } from "next/cache";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { exigirCotaDeComentario } from "@/lib/acoes/limite";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { ehCliente } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";
import { colunasDoConteudo, type Conteudo } from "@/lib/aprovacoes/conteudo";
import { empresaDoConteudo, titularDoConteudo } from "@/lib/email/conteudo";
import { avisarAgenciaDaDecisao } from "@/lib/email/decisao-do-cliente";
import { clientesQueQueremReceber, emailsDaEquipe } from "@/lib/email/destinatarios";
import { despacharEmail } from "@/lib/email/enviar";
import { comentarioNovo } from "@/lib/email/mensagens";

/**
 * As ações do cliente sobre um material — post ou entregável de campanha.
 *
 * **Nenhuma delas escreve `posts.status`**, e não é estilo: o cliente não tem
 * policy de UPDATE naquela tabela (migration 0032), e a bateria prova isso com
 * o comando cru. Quem muda o status é `decidir_rodada_do_cliente`, que roda
 * como dona da tabela depois de conferir que a rodada é de escopo cliente, que
 * está pendente e que o post é de uma empresa de quem pediu.
 *
 * O que estas funções acrescentam é o contrato `{ ok, error }` e a mensagem em
 * português — nenhuma escrita pode falhar em silêncio.
 */

export type DecisaoDoCliente = "aprovada" | "ajustes_solicitados" | "rejeitada";

const PEDE_MOTIVO: Record<DecisaoDoCliente, string | null> = {
  aprovada: null,
  ajustes_solicitados:
    "Diga o que precisa ser ajustado — sem isso a equipe não sabe o que refazer.",
  rejeitada: "Diga por que o material foi recusado.",
};

const CONFIRMACAO: Record<DecisaoDoCliente, string> = {
  aprovada: "Aprovado. A equipe foi avisada.",
  ajustes_solicitados: "Pedido de ajustes enviado.",
  rejeitada: "Material recusado. A equipe foi avisada.",
};

export async function decidirConteudo(
  rodadaId: string,
  decisao: DecisaoDoCliente,
  comentario: string,
): Promise<Resultado> {
  return executarAcao("decidirConteudo", async () => {
    const sessao = await exigirSessaoNaAcao();

    if (!ehCliente(sessao.profile.role)) {
      return falha("Esta decisão é do cliente, pelo Portal.");
    }

    // A exigência existe nos DOIS lados, e é de propósito: aqui ela escreve a
    // frase que a pessoa lê antes de enviar; no banco ela é a que vale, para
    // quem montar a chamada à mão. É a mesma divisão da máquina de estados
    // que o painel interno usa.
    const motivo = PEDE_MOTIVO[decisao];
    if (motivo && comentario.trim().length === 0) return falha(motivo);

    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("decidir_rodada_do_cliente", {
      p_round_id: rodadaId,
      p_decisao: decisao,
      p_comentario: comentario.trim() || null,
    });

    if (error) return falha(error.message);

    // As DUAS telas, porque a decisão vale nas duas e a action não sabe de
    // qual veio. Revalidar a errada deixaria o cliente olhando um "aguardando
    // aprovação" que ele acabou de resolver.
    revalidatePath("/portal/social-media");
    revalidatePath("/portal/campanhas");
    // A AGÊNCIA PRECISA SABER, e aqui mais que na fila de aprovações: um post
    // recusado na sexta sem ninguém avisado é um post que só aparece na
    // segunda, com a data de publicação já passada.
    await avisarAgenciaDaDecisao(
      rodadaId,
      decisao,
      comentario.trim() || null,
      sessao.usuarioId,
    );
    return sucesso(CONFIRMACAO[decisao]);
  });
}

/**
 * Comentar num material.
 *
 * `interno` não é parâmetro. Quem escreve por aqui é o cliente, e o comentário
 * dele é sempre público — o trigger `comments_normaliza` garante isso mesmo se
 * alguém montar o insert à mão, mas oferecer a opção na assinatura já seria
 * prometer uma escolha que ele não tem.
 */
export async function comentarNoConteudo(
  conteudo: Conteudo,
  texto: string,
  respostaA: string | null,
): Promise<Resultado> {
  return executarAcao("comentarNoConteudo", async () => {
    const sessao = await exigirSessaoNaAcao();

    if (texto.trim().length === 0) {
      return falha("Escreva o comentário antes de enviar.");
    }

    await exigirCotaDeComentario(sessao.usuarioId);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        ...colunasDoConteudo(conteudo),
        autor_id: sessao.usuarioId,
        texto: texto.trim(),
        resposta_a: respostaA,
      })
      .select("id");

    if (error) return falha(error.message);

    // `.select()` porque uma escrita barrada pelo RLS volta sem erro e sem
    // linha: sem isto a tela diria "comentário enviado" para um comentário que
    // não existe.
    if (!data || data.length === 0) {
      return falha("Não foi possível comentar neste material.");
    }

    await avisarDoComentario(conteudo, sessao.usuarioId, sessao.profile.nome);

    revalidatePath("/portal/social-media");
    revalidatePath("/portal/campanhas");
    return sucesso("Comentário enviado.");
  });
}

/**
 * O aviso de comentário novo.
 *
 * ---------------------------------------------------------------------------
 * **ESTA É A ÚNICA PORTA DE COMENTÁRIO DO PRODUTO, e é o que torna a caixa
 * `novo_comentario` honesta.**
 *
 * `client_notification_prefs` tem essa coluna desde a 0031, e a tela do portal
 * a oferece desde então com a frase *"quando alguém responder em um material
 * seu"*. Quem produz o evento é esta ação — a agência não tem, hoje, um lugar
 * de onde comentar um material do lado de lá; o painel tem os comentários da
 * demanda, que são outra tabela e não chegam ao cliente.
 *
 * Então quem recebe são as OUTRAS pessoas da mesma empresa mais quem está
 * com o material na mão do lado de cá. Sem essa segunda metade, uma dúvida
 * escrita no portal na sexta esperaria alguém abrir a tela para ser lida.
 * ---------------------------------------------------------------------------
 *
 * **Nunca derruba o comentário.** Ele já está gravado; o que falha aqui é o
 * aviso. É a mesma decisão de `anunciar()` e o oposto da trilha de auditoria.
 */
async function avisarDoComentario(
  conteudo: Conteudo,
  autorId: string,
  autorNome: string,
): Promise<void> {
  try {
    const titular = await titularDoConteudo(conteudo.tipo, conteudo.id);
    if (!titular) return;

    const empresa = await empresaDoConteudo(conteudo.tipo, conteudo.id);

    const [daEmpresa, daAgencia] = await Promise.all([
      empresa
        ? clientesQueQueremReceber(empresa, "novo_comentario", autorId)
        : Promise.resolve([]),
      emailsDaEquipe([titular.responsavelId], autorId),
    ]);

    // O MESMO TEXTO PARA OS DOIS LADOS, e ENDEREÇOS DIFERENTES. A mensagem
    // não conta o comentário, então não há nela nada que sirva a um e não ao
    // outro; o link, sim — mandar o cliente para `/painel/...` é mandá-lo
    // para um 403, e ele conclui que o portal dele quebrou.
    const texto = (rota: string) =>
      comentarioNovo({ autor: autorNome, titulo: titular.titulo, rota });

    despacharEmail(daEmpresa, texto(titular.rotaNoPortal));
    despacharEmail(daAgencia, texto(titular.rota));
  } catch (erro) {
    console.error("[email:comentario] não deu para avisar:", erro);
  }
}
