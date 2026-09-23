"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { recorrentesParaReplicar } from "@/lib/dados/financeiro-pessoal";
import { deslocarCompetencia } from "@/lib/dominio/financeiro";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O Financeiro Pessoal.
 *
 * `user_id` NUNCA vem do formulário: sai da sessão. Mesmo que a RLS já
 * recusasse — e ela recusa, com `with check` nas duas pontas —, uma action
 * que aceitasse o id de fora seria um erro de desenho, não um risco coberto.
 *
 * Editar e apagar não conferem o dono no código, e isso é deliberado: a
 * policy já fecha em `auth.uid()`, e repetir a regra aqui criaria dois lugares
 * para ela divergir. O que o código garante é o `.select()` — sem ele, uma
 * escrita recusada voltaria sem erro e sem linha, e a tela diria "salvo".
 */

const ROTA = "/painel/financeiro-pessoal";

const esquema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  descricao: z.string().trim().min(2, "Escreva o que foi."),
  categoria: z.string().trim().nullable().optional(),
  valor: z.number().positive("O valor precisa ser maior que zero."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  recorrente: z.boolean().optional(),
});

export async function criarLancamentoPessoal(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("criarLancamentoPessoal", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("criarLancamentoPessoal", validacao.error, dados, "Confira os dados."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("personal_finance_entries")
      .insert({
        user_id: sessao.usuarioId,
        tipo: entrada.tipo,
        descricao: entrada.descricao,
        categoria: entrada.categoria?.trim() || null,
        valor: entrada.valor,
        data: entrada.data,
        recorrente: entrada.recorrente ?? false,
      })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível lançar: ${error?.message ?? "erro"}`);

    revalidatePath(ROTA);
    return sucesso("Lançado.", data.id);
  });
}

export async function editarLancamentoPessoal(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarLancamentoPessoal", async () => {
    await exigirRotaNaAcao(ROTA);

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("editarLancamentoPessoal", validacao.error, dados, "Confira os dados."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("personal_finance_entries")
      .update({
        tipo: entrada.tipo,
        descricao: entrada.descricao,
        categoria: entrada.categoria?.trim() || null,
        valor: entrada.valor,
        data: entrada.data,
        recorrente: entrada.recorrente ?? false,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. Este registro é de outra pessoa.");

    revalidatePath(ROTA);
    return sucesso("Atualizado.");
  });
}

export async function excluirLancamentoPessoal(id: string): Promise<Resultado> {
  return executarAcao("excluirLancamentoPessoal", async () => {
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("personal_finance_entries")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Este registro é de outra pessoa.");

    revalidatePath(ROTA);
    return sucesso("Excluído.");
  });
}

/**
 * Copia os recorrentes de um mês para o seguinte.
 *
 * Não roda sozinho ao virar o mês: um lançamento que aparece sem ninguém ter
 * pedido é um lançamento em que a pessoa não confia, e a primeira coisa que
 * ela faria seria conferir todos. Clicar é mais barato que desconfiar.
 *
 * Clicar duas vezes não duplica — `recorrentesParaReplicar` já descarta o que
 * existe no mês seguinte com a mesma descrição, tipo e valor.
 */
export async function replicarRecorrentes(competencia: string): Promise<Resultado<number>> {
  return executarAcao("replicarRecorrentes", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(competencia)) return falha("Mês inválido.");

    const pendentes = await recorrentesParaReplicar(competencia);
    if (pendentes.length === 0) {
      return falha("Nada a replicar — os recorrentes deste mês já estão no mês seguinte.");
    }

    const proximo = deslocarCompetencia(competencia, 1);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("personal_finance_entries")
      .insert(
        pendentes.map((lancamento) => ({
          user_id: sessao.usuarioId,
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          categoria: lancamento.categoria,
          valor: Number(lancamento.valor),
          // O mesmo DIA do mês seguinte. Dia 31 em mês de 30 vira o último:
          // um aluguel que vence no fim do mês não pode pular para o próximo.
          data: mesmoDiaNoMesSeguinte(lancamento.data, proximo),
          recorrente: true,
        })),
      )
      .select("id");

    if (error) return falha(`Não foi possível replicar: ${error.message}`);

    revalidatePath(ROTA);
    const quantos = data?.length ?? 0;
    return sucesso(`${quantos} lançamento(s) copiado(s) para o mês seguinte.`, quantos);
  });
}

function mesmoDiaNoMesSeguinte(dataOriginal: string, competenciaDestino: string): string {
  const dia = Number(dataOriginal.slice(8, 10));
  const [ano, mes] = competenciaDestino.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const escolhido = Math.min(dia, ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(escolhido).padStart(2, "0")}`;
}

/**
 * Apaga tudo o que é da pessoa.
 *
 * Existe porque o módulo é OPCIONAL, e um módulo do qual não se consegue sair
 * não é opcional. A confirmação em duas etapas mora na tela; aqui a única
 * trava é a RLS, que já limita o delete às linhas de quem chamou — é por isso
 * que não há `where user_id` no código: escrevê-lo daria a impressão de que
 * ele é a proteção, e ele não é.
 */
export async function apagarTudoDoFinanceiroPessoal(): Promise<Resultado<number>> {
  return executarAcao("apagarTudoDoFinanceiroPessoal", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("personal_finance_entries")
      .delete()
      .eq("user_id", sessao.usuarioId)
      .select("id");

    if (error) return falha(`Não foi possível apagar: ${error.message}`);

    revalidatePath(ROTA);
    const quantos = data?.length ?? 0;
    return sucesso(
      quantos === 0
        ? "Não havia nada para apagar."
        : `${quantos} lançamento(s) apagado(s). Não sobrou nada.`,
      quantos,
    );
  });
}
