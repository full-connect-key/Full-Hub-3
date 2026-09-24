"use server";

import { revalidatePath } from "next/cache";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { ehCliente } from "@/lib/auth/roles";
import { criarClienteServidor } from "@/lib/supabase/server";
import { colunasDoConteudo, type Conteudo } from "@/lib/aprovacoes/conteudo";

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

    revalidatePath("/portal/social-media");
    revalidatePath("/portal/campanhas");
    return sucesso("Comentário enviado.");
  });
}
