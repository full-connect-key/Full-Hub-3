"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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

/** Apagar a nota que ainda ninguém conferiu — só a própria pessoa. */
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
      return falha("Só dá para apagar a sua própria nota, e enquanto ela ainda não foi conferida.");
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
