"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
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
