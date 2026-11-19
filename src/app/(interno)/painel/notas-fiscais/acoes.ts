"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { anunciar } from "@/lib/acoes/ao-vivo";
import { exigirEquipeNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { quemDeveNota } from "@/lib/dados/notas-fiscais";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações da nota fiscal da pessoa (0065).
 *
 * ---------------------------------------------------------------------------
 * **AS GUARDAS AQUI NÃO SÃO A TRAVA, e a divisão importa.**
 *
 * Quem decide de verdade é o Postgres: `team_invoices_insert` exige que a nota
 * seja sua e nasça `enviada`; `nota_protege_colunas` exige o sócio para mexer
 * em `status`. Estas guardas escrevem a frase em português ANTES de a pessoa
 * levar um "nenhuma linha voltou" — que é o modo de falha que a convenção do
 * projeto proíbe.
 *
 * E elas espelham a primeira linha de cada policy, nunca uma pergunta
 * diferente. A lição da 0059 é essa: quando a regra mora nos dois lados e um
 * fica mais apertado, a pessoa lê "seu perfil não permite" numa ação que o
 * produto diz que é dela.
 * ---------------------------------------------------------------------------
 */

const ROTA = "/painel/notas-fiscais";

const esquemaDeEnvio = z.object({
  /** "2027-09" — a tela manda o mês; a competência é o dia 1 dele. */
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês da nota."),
  valor: z
    .number()
    .positive("O valor da nota precisa ser maior que zero.")
    .max(1000000, "Confira o valor: esse número parece ter um zero a mais."),
  numero: z.string().max(60).optional().nullable(),
  arquivo_url: z.string().min(1, "Anexe o PDF da nota."),
  observacoes: z.string().max(2000).optional().nullable(),
});

const ROTULOS = {
  mes: "mês",
  valor: "valor",
  numero: "número da nota",
  arquivo_url: "arquivo",
  observacoes: "observações",
};

export async function enviarNota(dados: unknown): Promise<Resultado> {
  return executarAcao("enviarNota", async () => {
    const sessao = await exigirEquipeNaAcao();

    const lido = esquemaDeEnvio.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("enviarNota", lido.error, dados, "Confira os dados da nota.", ROTULOS),
      );
    }

    const entrada = lido.data;
    const supabase = await criarClienteServidor();

    // `.select()` no fim porque a policy pode barrar: sem ele um insert
    // recusado volta sem erro e sem linha, e a tela diz "enviada" à toa.
    const { data, error } = await supabase
      .from("team_invoices")
      .insert({
        user_id: sessao.usuarioId,
        competencia: `${entrada.mes}-01`,
        valor: entrada.valor,
        numero: entrada.numero?.trim() || null,
        arquivo_url: entrada.arquivo_url,
        observacoes: entrada.observacoes?.trim() || null,
      })
      .select("id");

    if (error) {
      // O ÍNDICE PARCIAL RECUSA A SEGUNDA NOTA VIVA DO MÊS, e a mensagem do
      // Postgres fala de "unique constraint" — que não diz nada a quem está
      // mandando a nota de setembro pela segunda vez sem lembrar da primeira.
      if (error.code === "23505") {
        return falha(
          "Você já tem uma nota deste mês esperando conferência. Apague a anterior ou escolha outro mês.",
        );
      }
      return falha(`Não foi possível enviar: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return falha("Não foi possível enviar a nota. Confira se você é da equipe.");
    }

    revalidatePath(ROTA);
    return sucesso("Nota enviada. O sócio foi avisado.");
  });
}

const esquemaDaDecisao = z.object({
  id: z.string().uuid(),
  decisao: z.enum(["aprovada", "recusada", "paga"]),
  motivo: z.string().max(2000).optional().nullable(),
  /** Só na decisão `paga`: o dia em que o dinheiro saiu. */
  pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/**
 * Conferir, recusar e pagar — só o sócio.
 *
 * **A data de pagamento é DIGITADA e não `now()`**, e é a mesma decisão das
 * três datas do Financeiro: o sócio marca a nota como paga no dia em que
 * lembra, e a transferência saiu no dia em que saiu. Gravar a data do clique
 * poria no relatório de caixa um dia que não aconteceu.
 */
export async function decidirNota(dados: unknown): Promise<Resultado> {
  return executarAcao("decidirNota", async () => {
    await exigirSocioNaAcao();

    const lido = esquemaDaDecisao.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("decidirNota", lido.error, dados, "Confira a decisão.", {
          id: "nota",
          decisao: "decisão",
          motivo: "motivo",
          pagamento: "data do pagamento",
        }),
      );
    }

    const { id, decisao, motivo, pagamento } = lido.data;

    // AS DUAS EXIGÊNCIAS SÃO DO BANCO, e a tela as repete só para a frase sair
    // em português antes da ida. Tirar daqui não abre buraco nenhum: o check
    // `team_invoices_recusa_com_motivo` e o `team_invoices_paga_com_data`
    // continuam recusando.
    if (decisao === "recusada" && !motivo?.trim()) {
      return falha("Diga o que está errado — a pessoa precisa saber o que corrigir.");
    }
    if (decisao === "paga" && !pagamento) {
      return falha("Informe o dia em que o pagamento saiu.");
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("team_invoices")
      .update({
        status: decisao,
        motivo_recusa: decisao === "recusada" ? motivo!.trim() : null,
        pagamento: decisao === "paga" ? pagamento : null,
      })
      .eq("id", id)
      .select("id");

    // O `hint` do Postgres é onde mora a SAÍDA, não o problema: as travas de
    // transição recusam dizendo o que fazer no lugar. Descartá-lo deixaria a
    // pessoa com um "não pode" sem caminho.
    if (error) {
      return falha(
        error.hint ? `${error.message} ${error.hint}` : `Não foi possível salvar: ${error.message}`,
      );
    }
    if (!data || data.length === 0) {
      return falha("Conferir e pagar nota fiscal é do sócio.");
    }

    revalidatePath(ROTA);
    // O Financeiro ganhou um lançamento quando a decisão foi `paga`.
    if (decisao === "paga") revalidatePath("/painel/financeiro");

    return sucesso(
      decisao === "aprovada"
        ? "Nota aprovada. Ela entra na lista de pagar."
        : decisao === "paga"
          ? "Nota paga, e a despesa entrou no Financeiro."
          : "Nota recusada. A pessoa foi avisada com o motivo.",
    );
  });
}

/**
 * Apagar a própria nota, enquanto ela não foi paga.
 *
 * **A TRAVA É A POLICY, e esta função não repete a pergunta.** Quem recusa é
 * `team_invoices_delete` (0117): `auth.uid() = user_id and status <> 'paga'`.
 * Um `if` aqui seria a mesma regra em dois lados — a classe de furo que a
 * 0029 e a 0060 pagaram, as duas vezes em que desfazer um lado não desfez
 * nada. O `.select("id")` é o que transforma a recusa silenciosa do RLS numa
 * frase: sem linha de volta, foi recusa.
 *
 * **O corte em `paga` é onde o dinheiro entra:** `nota_paga_vira_despesa()`
 * grava em `finance_entries` naquela transição, e a chave estrangeira mora
 * do lado da nota — apagar uma nota paga deixaria a despesa sozinha no
 * Financeiro. A razão inteira está no cabeçalho da 0117.
 */
export async function apagarNota(id: string): Promise<Resultado> {
  return executarAcao("apagarNota", async () => {
    await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("team_invoices")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return falha(`Não foi possível apagar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("Só dá para apagar a sua própria nota, e enquanto ela não tiver sido paga.");
    }

    revalidatePath(ROTA);
    return sucesso("Nota apagada.");
  });
}

/**
 * Pedir a todo mundo que ainda não mandou a nota do mês.
 *
 * ---------------------------------------------------------------------------
 * **UMA CHAMADA SÓ, E É POR ISSO QUE ELA MORA NO BANCO.**
 *
 * `solicitar_notas_do_mes()` grava o registro e toca os N sinos na mesma
 * transação. Pelo PostgREST seriam N+1 idas, e a terceira falhando deixaria
 * metade da equipe cobrada e o registro dizendo que todos foram. É a mesma
 * razão de `decidir_solicitacao()` no Full Days e de `abrir_campanha()`.
 *
 * **E o sino é o banco, não esta action.** `notificar()` é função do Postgres:
 * ela nunca avisa quem causou o aviso, nunca avisa quem saiu da agência, e
 * devolve `null` sem derrubar a escrita quando não há ninguém — a lição da
 * 0062. Escrever o aviso aqui perderia as três de uma vez.
 * ---------------------------------------------------------------------------
 *
 * A guarda de sócio espelha a primeira linha da função, e existe para a recusa
 * chegar em português: sem ela, quem não pode leria a mensagem crua do
 * Postgres.
 */
export async function solicitarNotasDoMes(mes: unknown): Promise<Resultado> {
  return executarAcao("solicitarNotasDoMes", async () => {
    await exigirSocioNaAcao();

    const lido = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse({ mes });
    if (!lido.success) {
      return falha(
        recusaDeValidacao("solicitarNotasDoMes", lido.error, { mes }, "Escolha o mês de serviço.", {
          mes: "mês de serviço",
        }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("solicitar_notas_do_mes", {
      p_competencia: `${lido.data.mes}-01`,
    });

    if (error) return falha(error.message);

    revalidatePath("/painel/financeiro");
    revalidatePath(ROTA);
    // O AVISO CAI NO SINO DE OUTRAS PESSOAS, então a Home delas também muda —
    // e é lá que o bloco "Precisa de mim" mostra o pedido em aberto.
    revalidatePath("/painel");

    // O PEDIDO CHEGA SEM RECARREGAR (0143), que é a frase do usuário:
    // *"implementar a notificação em tempo real, sem necessidade de atualizar
    // a página"*. **Nada novo viaja no fio** — `anunciar` manda a palavra
    // `"nota-fiscal"` no canal da equipe, quem recebe chama `router.refresh()`,
    // e o pop-up aparece porque o layout do painel é um Server Component que
    // relê `meuPedidoDeNotaEmAberto()` na remontagem. É o mecanismo do Sprint
    // 16 inteiro, sem uma linha de exceção para esta tela.
    //
    // E ele vem DEPOIS dos três `revalidatePath`: o aviso diz "peça a tela de
    // novo", e pedi-la antes de o cache do servidor ser invalidado devolveria
    // a versão sem o pedido — a tela recarregaria para mostrar o mesmo.
    anunciar("nota-fiscal");

    const quantas = data ?? 0;

    // O NÚMERO ZERO É UMA RESPOSTA BOA, e a frase diz isso em vez de parecer
    // que o botão não funcionou: "pedi e não faltava ninguém" é exatamente o
    // que quem aperta quer saber.
    if (quantas === 0) {
      return sucesso("Ninguém está devendo a nota deste mês — nenhum aviso foi enviado.");
    }

    return sucesso(
      quantas === 1
        ? "Pedido enviado para 1 pessoa. O prazo é hoje."
        : `Pedido enviado para ${quantas} pessoas. O prazo é hoje.`,
    );
  });
}

/**
 * Quem vai ser cobrado, para o diálogo escrever a frase ANTES do clique.
 *
 * ---------------------------------------------------------------------------
 * **É UMA LEITURA NUMA `"use server"`, e a exceção tem motivo.**
 *
 * `lib/dados/` é `server-only` — o navegador não alcança. E este número precisa
 * ser recalculado quando a pessoa troca o mês no diálogo, que é uma interação
 * do lado de cá. As alternativas eram piores: buscar os doze meses no
 * carregamento da página são doze RPCs para desenhar um botão, e mostrar um
 * número fixo faria o diálogo prometer uma coisa e o banco fazer outra.
 *
 * **E ela chama a MESMA função que o envio chama.** `quem_deve_nota()` é a
 * fonte única dos dois lados, pela razão de `podeEnviarAoCliente()` no Social:
 * a tela existe para escrever a frase que o banco vai confirmar.
 * ---------------------------------------------------------------------------
 */
export async function contarQuemDeveNota(
  mes: unknown,
): Promise<{ ok: true; nomes: string[] } | { ok: false; error: string }> {
  try {
    await exigirSocioNaAcao();

    const lido = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse({ mes });
    if (!lido.success) return { ok: false, error: "Escolha o mês de serviço." };

    const pessoas = await quemDeveNota(`${lido.data.mes}-01`);
    return { ok: true, nomes: pessoas.map((p) => p.nome) };
  } catch (erro) {
    // A RECUSA NÃO PODE SUMIR, mesmo numa leitura: o diálogo mostra a frase em
    // vez de um "0 pessoas" que faria o botão parecer desnecessário. Zero é uma
    // resposta plausível, e é o pior tipo de resposta errada.
    console.error("[acao:contarQuemDeveNota]", erro);
    return {
      ok: false,
      error: erro instanceof Error ? erro.message : "Não foi possível contar quem está devendo.",
    };
  }
}

/**
 * Fechar o pop-up do pedido de nota — a dispensa de quem leu (0143).
 *
 * ---------------------------------------------------------------------------
 * **DISPENSAR NÃO É MARCAR COMO LIDA**, e a separação é o pedido do usuário:
 * *"permitir que cada usuário dispense o pop-up após visualizar a solicitação,
 * **mantendo o registro na central de notificações**"*. Escrever `lida_em`
 * apagaria o aviso do contador do sino, que é justamente o registro que ele
 * pediu para ficar — e `marcarNovidadesComoVistas`, que faz essa escrita em
 * lote, está a um import de distância e seria a resposta errada de graça.
 *
 * E há um segundo motivo, que é o que faz o pop-up poder morar no layout:
 * `lida_em` não sabe quando o pedido deixou de valer. Quem manda a nota some
 * de `meus_pedidos_de_nota()` no mesmo instante; a notificação continuaria por
 * ler, e o aviso continuaria na tela de quem já mandou.
 * ---------------------------------------------------------------------------
 *
 * **É UM `insert` E NÃO UMA RPC**, ao contrário de `registrar_visita` (0142):
 * lá a escrita é uma conta sobre o valor antigo e um `select`-então-`update`
 * seria a corrida da 0040; aqui é uma linha nova, sem conta nenhuma. Quem
 * decide é o `with check` da policy — um `request_id` forjado grava no nome de
 * quem chamou e dispensa o aviso dela mesma, que é o pior que ele faz.
 *
 * **`ignoreDuplicates` porque fechar duas vezes não é erro:** o segundo clique
 * acontece quando a tela ainda não se refez, e uma recusa de chave primária
 * apareceria como um botão que falhou depois de ter funcionado.
 */
export async function dispensarPedidoDeNota(pedidoId: unknown): Promise<Resultado> {
  return executarAcao("dispensarPedidoDeNota", async () => {
    const sessao = await exigirEquipeNaAcao();

    const lido = z.object({ pedidoId: z.string().uuid() }).safeParse({ pedidoId });
    if (!lido.success) {
      return falha(
        recusaDeValidacao("dispensarPedidoDeNota", lido.error, { pedidoId }, "Aviso desconhecido.", {
          pedidoId: "pedido",
        }),
      );
    }

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("invoice_request_dismissals")
      .upsert(
        { request_id: lido.data.pedidoId, user_id: sessao.usuarioId },
        { onConflict: "request_id,user_id", ignoreDuplicates: true },
      );

    if (error) return falha(error.message);

    // O LAYOUT INTEIRO, e não só esta rota: o pop-up é desenhado lá, então
    // revalidar só `/painel/notas-fiscais` o deixaria na tela de quem está em
    // qualquer outro módulo — que é exatamente onde ele foi pedido para
    // aparecer.
    revalidatePath("/painel", "layout");
    return sucesso("Aviso dispensado.");
  });
}
