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
import { anunciar } from "@/lib/acoes/ao-vivo";
import { avisarAgenciaDaDecisao } from "@/lib/email/decisao-do-cliente";

/**
 * A decisão do cliente.
 *
 * Passa por uma função do banco (`decidir_rodada_do_cliente`) e não por um
 * update direto, por um motivo concreto: aprovar precisa mexer no MATERIAL, e
 * o cliente não tem — nem deve ter — permissão de escrita em `subtasks`. A
 * função roda como dona da tabela, mas antes confere que a rodada é de escopo
 * cliente, que está pendente e que pertence a uma empresa dele. Tentar decidir
 * a rodada de outro cliente é recusado lá dentro, não aqui.
 *
 * Aqui de fora, o que garantimos é a mensagem em português e o contrato
 * `{ ok, error }` — nenhuma escrita pode falhar em silêncio.
 */
export async function decisaoCliente(
  roundId: string,
  decisao: "aprovada" | "ajustes_solicitados",
  comentario: string,
): Promise<Resultado> {
  return executarAcao("decisaoCliente", async () => {
    const sessao = await exigirSessaoNaAcao();

    if (!ehCliente(sessao.profile.role)) {
      return falha("Esta decisão é do cliente, pelo Portal.");
    }

    if (decisao === "ajustes_solicitados" && comentario.trim().length === 0) {
      return falha(
        "Diga o que precisa ser ajustado — sem isso a equipe não sabe o que refazer.",
      );
    }

    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("decidir_rodada_do_cliente", {
      p_round_id: roundId,
      p_decisao: decisao,
      p_comentario: comentario.trim() || null,
    });

    if (error) return falha(error.message);

    revalidatePath("/portal/aprovacoes");
    // O CLIENTE DECIDIU, E QUEM PRECISA SABER É A AGÊNCIA. O aviso sai no
    // canal da equipe — que é o único que existe — porque é do lado de cá que
    // alguém está com a fila aberta esperando esta resposta. O caminho
    // inverso, avisar o cliente do que a equipe faz, não existe de propósito:
    // ele recebe material enviado, não o ritmo da produção.
    anunciar("aprovacao");
    // E O E-MAIL VAI JUNTO, pela mesma razão do aviso ao vivo: é do lado de
    // cá que alguém está com a fila aberta esperando. A diferença é que o
    // aviso só alcança quem está com a tela aberta agora, e esta resposta
    // costuma chegar quando não há ninguém olhando.
    await avisarAgenciaDaDecisao(
      roundId,
      decisao,
      comentario.trim() || null,
      sessao.usuarioId,
    );
    return sucesso(
      decisao === "aprovada"
        ? "Aprovado. A equipe foi avisada."
        : "Pedido de ajustes enviado.",
    );
  });
}
