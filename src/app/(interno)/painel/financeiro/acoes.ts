"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { lerCSV } from "@/lib/dominio/csv";
import { competenciaDe, lerDinheiro } from "@/lib/dominio/financeiro";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As escritas dos gastos da agência.
 *
 * TODA action aqui começa por `exigirSocioNaAcao()`. É a primeira barreira, e
 * a segunda é a RLS — que é a que vale: mesmo que alguém remova esta linha
 * por engano, o Postgres continua recusando quem não é sócio. As duas existem
 * de propósito, como a máquina de estados da subtarefa: esta escreve a
 * mensagem que a pessoa lê, aquela é a que ninguém contorna.
 *
 * `criado_por` nunca vem do formulário: sai da sessão.
 *
 * NÃO HÁ `tipo` EM LUGAR NENHUM (0095): toda linha desta tabela é gasto. A
 * coluna saiu junto com a receita, e um `tipo: "despesa"` escrito aqui seria
 * recusado pelo PostgREST com um erro sobre coluna inexistente — que a tela
 * mostraria como "não foi possível lançar".
 */

const ROTA = "/painel/financeiro";

const esquemaDeLancamento = z.object({
  descricao: z.string().trim().min(2, "Escreva a descrição do gasto."),
  valor: z.number().refine((v) => v !== 0, "O valor não pode ser zero."),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a competência."),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["previsto", "faturado", "pago", "cancelado"]),
  client_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  fornecedor: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
});

export async function criarLancamento(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("criarLancamento", async () => {
    const sessao = await exigirSocioNaAcao();

    const validacao = esquemaDeLancamento.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("criarLancamento", validacao.error, dados, "Confira os dados do gasto."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("finance_entries")
      .insert({
        ...entrada,
        competencia: competenciaDe(entrada.competencia),
        vencimento: entrada.vencimento ?? null,
        pagamento: entrada.pagamento ?? null,
        client_id: entrada.client_id ?? null,
        category_id: entrada.category_id ?? null,
        fornecedor: entrada.fornecedor || null,
        observacoes: entrada.observacoes || null,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível lançar: ${error?.message ?? "erro"}`);

    revalidatePath(ROTA);
    return sucesso("Gasto registrado.", data.id);
  });
}

export async function editarLancamento(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarLancamento", async () => {
    await exigirSocioNaAcao();

    const validacao = esquemaDeLancamento.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("editarLancamento", validacao.error, dados, "Confira os dados do gasto."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("finance_entries")
      .update({
        ...entrada,
        competencia: competenciaDe(entrada.competencia),
        vencimento: entrada.vencimento ?? null,
        pagamento: entrada.pagamento ?? null,
        client_id: entrada.client_id ?? null,
        category_id: entrada.category_id ?? null,
        fornecedor: entrada.fornecedor || null,
        observacoes: entrada.observacoes || null,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. Só o sócio altera gasto.");

    revalidatePath(ROTA);
    return sucesso("Gasto atualizado.");
  });
}

export async function excluirLancamento(id: string): Promise<Resultado> {
  return executarAcao("excluirLancamento", async () => {
    await exigirSocioNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("finance_entries")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Só o sócio exclui gasto.");

    revalidatePath(ROTA);
    return sucesso("Gasto excluído.");
  });
}

/**
 * Marcar como pago.
 *
 * A data vai junto, e não é opcional: o trigger `coerencia_do_pagamento`
 * recusa `status = 'pago'` sem `pagamento`, justamente para o gasto não sumir
 * do realizado do mês sem ninguém entender por quê.
 */
export async function marcarComoPago(id: string, dataISO: string): Promise<Resultado> {
  return executarAcao("marcarComoPago", async () => {
    await exigirSocioNaAcao();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return falha("Escolha a data do pagamento.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("finance_entries")
      .update({ status: "pago", pagamento: dataISO })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível marcar: ${error.message}`);
    if (!data) return falha("O banco recusou. Só o sócio marca pagamento.");

    revalidatePath(ROTA);
    return sucesso("Marcado como pago.");
  });
}

// ---------------------------------------------------------------------------
// Importação de CSV
// ---------------------------------------------------------------------------

/**
 * Importa gastos de um CSV.
 *
 * O cabeçalho manda, não a ordem das colunas: uma planilha vinda do contador
 * nunca tem as colunas na ordem que este sistema escolheu. Linha que não dá
 * para entender NÃO derruba o lote — ela volta na mensagem, com o número,
 * para a pessoa corrigir. Um import que falha inteiro por causa da linha 47
 * faz alguém reimportar quarenta e seis linhas repetidas.
 *
 * A COLUNA `tipo` NÃO É MAIS LIDA, e uma planilha que a traga não é recusada
 * por isso: desde a 0095 toda linha é gasto, então a coluna deixou de decidir
 * alguma coisa. Recusar o arquivo por causa dela faria o extrato do contador
 * parar de importar por um motivo que não existe mais.
 */
export async function importarLancamentosCSV(
  texto: string,
  competenciaPadrao: string,
): Promise<Resultado<{ criados: number; recusadas: string[] }>> {
  return executarAcao("importarLancamentosCSV", async () => {
    const sessao = await exigirSocioNaAcao();

    const linhas = lerCSV(texto);
    if (linhas.length < 2) {
      return falha("O arquivo precisa do cabeçalho e de pelo menos uma linha.");
    }

    const cabecalho = linhas[0].map((c) =>
      c
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, ""),
    );
    const coluna = (nome: string) => cabecalho.indexOf(nome);

    const iDescricao = coluna("descricao");
    const iValor = coluna("valor");

    if (iDescricao < 0 || iValor < 0) {
      return falha(
        'O cabeçalho precisa ter pelo menos as colunas "descricao" e "valor". As opcionais são "competencia", "vencimento", "cliente", "categoria" e "fornecedor".',
      );
    }

    const iCompetencia = coluna("competencia");
    const iVencimento = coluna("vencimento");
    const iCliente = coluna("cliente");
    const iCategoria = coluna("categoria");
    const iFornecedor = coluna("fornecedor");

    const supabase = await criarClienteServidor();
    const [{ data: clientes }, { data: categorias }] = await Promise.all([
      supabase.from("clients").select("id, nome_empresa"),
      supabase.from("finance_categories").select("id, nome"),
    ]);

    const chave = (t: string) =>
      t
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    const clientePorNome = new Map((clientes ?? []).map((c) => [chave(c.nome_empresa), c.id]));
    // A chave é o NOME e só ele: a categoria deixou de ser tipada na 0095, e
    // um prefixo de tipo aqui nunca casaria com nada — todo gasto importado
    // entraria sem categoria, sem erro nenhum.
    const categoriaPorNome = new Map((categorias ?? []).map((c) => [chave(c.nome), c.id]));

    const paraCriar: Record<string, unknown>[] = [];
    const recusadas: string[] = [];

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      const numero = i + 1;

      const descricao = (linha[iDescricao] ?? "").trim();
      if (descricao.length < 2) {
        recusadas.push(`linha ${numero}: sem descrição`);
        continue;
      }

      const valor = lerDinheiro(linha[iValor] ?? "");
      if (valor === undefined || valor === null || valor === 0) {
        recusadas.push(`linha ${numero}: valor "${linha[iValor] ?? ""}" não é um número`);
        continue;
      }

      const competenciaCrua = iCompetencia >= 0 ? (linha[iCompetencia] ?? "").trim() : "";
      const competencia = /^\d{4}-\d{2}/.test(competenciaCrua)
        ? competenciaDe(`${competenciaCrua.slice(0, 7)}-01`)
        : competenciaPadrao;

      const vencimentoCru = iVencimento >= 0 ? (linha[iVencimento] ?? "").trim() : "";
      const vencimento = /^\d{4}-\d{2}-\d{2}$/.test(vencimentoCru) ? vencimentoCru : null;

      const nomeDoCliente = iCliente >= 0 ? chave(linha[iCliente] ?? "") : "";
      const nomeDaCategoria = iCategoria >= 0 ? chave(linha[iCategoria] ?? "") : "";

      paraCriar.push({
        descricao,
        valor: Math.abs(valor),
        competencia,
        vencimento,
        status: "previsto",
        client_id: nomeDoCliente ? (clientePorNome.get(nomeDoCliente) ?? null) : null,
        category_id: nomeDaCategoria ? (categoriaPorNome.get(nomeDaCategoria) ?? null) : null,
        fornecedor: iFornecedor >= 0 ? (linha[iFornecedor] ?? "").trim() || null : null,
        criado_por: sessao.usuarioId,
      });
    }

    if (paraCriar.length === 0) {
      return falha(
        `Nenhuma linha pôde ser importada. ${recusadas.slice(0, 5).join("; ")}`,
      );
    }

    const { data, error } = await supabase
      .from("finance_entries")
      .insert(paraCriar as never)
      .select("id");

    if (error) return falha(`Não foi possível importar: ${error.message}`);

    revalidatePath(ROTA);
    const criados = data?.length ?? 0;
    return sucesso(
      recusadas.length === 0
        ? `${criados} gasto(s) importado(s).`
        : `${criados} importado(s), ${recusadas.length} recusada(s): ${recusadas.slice(0, 3).join("; ")}${recusadas.length > 3 ? "…" : ""}`,
      { criados, recusadas },
    );
  });
}
