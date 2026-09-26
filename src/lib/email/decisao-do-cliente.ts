import "server-only";

import { criarClienteAdmin, servicoConfigurado } from "@/lib/supabase/admin";

import { titularDoConteudo } from "./conteudo";
import { emailsDaEquipe } from "./destinatarios";
import { avisarDepois, despacharEmail } from "./enviar";
import { clienteDecidiu } from "./mensagens";

/**
 * O caminho de volta: o cliente decidiu, e a agência precisa saber
 * (Sprint 16, Parte B).
 *
 * ---------------------------------------------------------------------------
 * **É A CHAVE DE SERVIÇO PORQUE QUEM CHAMA É O CLIENTE.**
 *
 * As duas ações de decisão rodam com a sessão dele, e ele não lê `profiles` de
 * gente da agência, nem `tasks`, nem `posts` que não sejam os enviados. Com o
 * cliente da sessão, a busca por "quem avisar" volta vazia — e vazia quer
 * dizer "não avisa ninguém", que é o mesmo modo de falha de sempre: **lista
 * vazia é indistinguível da verdade**, e ninguém abre chamado sobre um e-mail
 * que não sabe que existia.
 *
 * O que impede isto de virar porta dos fundos é o recorte: esta função lê
 * **uma rodada pelo id que a ação acabou de decidir** e os endereços de quem
 * está nela. Ela não recebe filtro de fora, não devolve nada para a tela e não
 * escreve em lugar nenhum.
 * ---------------------------------------------------------------------------
 *
 * **Roda depois da decisão, nunca antes.** Se a rodada for recusada pelo banco
 * — não é dele, já foi decidida, não é de escopo cliente —, a ação volta em
 * `falha` e isto não é chamado. Avisar a agência de uma decisão que não
 * aconteceu seria pior que não avisar.
 */

export function avisarAgenciaDaDecisao(
  rodadaId: string,
  decisao: string,
  comentario: string | null,
  quemDecidiu: string,
): void {
  if (!servicoConfigurado()) return;

  avisarDepois("decisao", async () => {
    const admin = criarClienteAdmin();

    const { data: rodada } = await admin
      .from("approval_rounds")
      .select("content_type, content_id, solicitado_por")
      .eq("id", rodadaId)
      .maybeSingle();
    if (!rodada) return;

    const { data: pessoa } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", quemDecidiu)
      .maybeSingle();

    const conteudo = await titularDoConteudo(rodada.content_type, rodada.content_id);
    if (!conteudo) return;

    // QUEM ENVIOU E QUEM FEZ. Costumam ser duas pessoas, e estão esperando
    // esta resposta por motivos diferentes: uma para seguir, outra para
    // refazer. Podem ser a mesma desde a 0060 — `emailsDaEquipe` deduplica,
    // senão ela receberia o aviso duas vezes.
    const destinos = await emailsDaEquipe(
      [rodada.solicitado_por, conteudo.responsavelId],
      quemDecidiu,
    );
    if (destinos.length === 0) return;

    despacharEmail(
      destinos,
      clienteDecidiu({
        cliente: pessoa?.nome ?? "O cliente",
        titulo: conteudo.titulo,
        decisao,
        comentario,
        rota: conteudo.rota,
      }),
    );
    // NUNCA DERRUBA A DECISÃO. Ela já está gravada, a resposta já saiu, e o
    // que falha aqui vira linha de log — o sino continua de pé porque é do
    // banco.
  });
}
