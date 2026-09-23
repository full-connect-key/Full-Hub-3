"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirSocioNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { contratosSemLancamento } from "@/lib/dados/financeiro";
import {
  competenciaDe,
  lerCSV,
  lerDinheiro,
  vencimentoNaCompetencia,
} from "@/lib/dominio/financeiro";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As escritas do financeiro da agência.
 *
 * TODA action aqui começa por `exigirSocioNaAcao()`. É a primeira barreira, e
 * a segunda é a RLS — que é a que vale: mesmo que alguém remova esta linha
 * por engano, o Postgres continua recusando quem não é sócio. As duas existem
 * de propósito, como a máquina de estados da subtarefa: esta escreve a
 * mensagem que a pessoa lê, aquela é a que ninguém contorna.
 *
 * `criado_por` nunca vem do formulário: sai da sessão.
 */

const ROTA = "/painel/financeiro";

const esquemaDeLancamento = z.object({
  tipo: z.enum(["receita", "despesa"]),
  descricao: z.string().trim().min(2, "Escreva a descrição do lançamento."),
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
      return falha(recusaDeValidacao("criarLancamento", validacao.error, dados, "Confira os dados do lançamento."));
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
    return sucesso("Lançamento registrado.", data.id);
  });
}

export async function editarLancamento(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarLancamento", async () => {
    await exigirSocioNaAcao();

    const validacao = esquemaDeLancamento.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("editarLancamento", validacao.error, dados, "Confira os dados do lançamento."));
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
    if (!data) return falha("O banco recusou. Só o sócio altera lançamento.");

    revalidatePath(ROTA);
    return sucesso("Lançamento atualizado.");
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
    if (!data) return falha("O banco recusou. Só o sócio exclui lançamento.");

    revalidatePath(ROTA);
    return sucesso("Lançamento excluído.");
  });
}

/**
 * Marcar como pago.
 *
 * A data vai junto, e não é opcional: o trigger `coerencia_do_pagamento`
 * recusa `status = 'pago'` sem `pagamento`, justamente para o título não
 * sumir do realizado do mês sem ninguém entender por quê.
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
// Contratos
// ---------------------------------------------------------------------------

const esquemaDeContrato = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  nome: z.string().trim().min(2, "Dê um nome ao contrato."),
  valor: z.number().positive("O valor do contrato precisa ser maior que zero."),
  recorrencia: z.enum(["mensal", "trimestral", "anual", "pontual"]),
  dia_vencimento: z.number().int().min(1).max(31).nullable().optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o início da vigência."),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ativo: z.boolean(),
  observacoes: z.string().trim().nullable().optional(),
});

export async function salvarContrato(
  id: string | null,
  dados: unknown,
): Promise<Resultado<string>> {
  return executarAcao("salvarContrato", async () => {
    await exigirSocioNaAcao();

    const validacao = esquemaDeContrato.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarContrato", validacao.error, dados, "Confira os dados do contrato."));
    }
    const entrada = validacao.data;

    if (entrada.data_fim && entrada.data_fim < entrada.data_inicio) {
      return falha("O fim da vigência não pode ser antes do início.");
    }

    const carga = {
      ...entrada,
      dia_vencimento: entrada.dia_vencimento ?? null,
      data_fim: entrada.data_fim || null,
      observacoes: entrada.observacoes || null,
    };

    const supabase = await criarClienteServidor();
    const { data, error } = id
      ? await supabase.from("contracts").update(carga).eq("id", id).select("id").maybeSingle()
      : await supabase.from("contracts").insert(carga).select("id").maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. Só o sócio mexe em contrato.");

    revalidatePath(ROTA);
    return sucesso(id ? "Contrato atualizado." : "Contrato cadastrado.", data.id);
  });
}

export async function excluirContrato(id: string): Promise<Resultado> {
  return executarAcao("excluirContrato", async () => {
    await exigirSocioNaAcao();

    const supabase = await criarClienteServidor();
    const { count } = await supabase
      .from("finance_entries")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", id);

    // Contrato com lançamento não se apaga: o `on delete set null` deixaria a
    // receita órfã e ninguém saberia de onde ela veio. Desativar preserva a
    // memória — a mesma regra de pessoa e de cliente.
    if ((count ?? 0) > 0) {
      return falha(
        `Este contrato já gerou ${count} lançamento(s). Desative-o em vez de excluir, para o histórico continuar explicando de onde veio cada receita.`,
      );
    }

    const { data, error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Só o sócio exclui contrato.");

    revalidatePath(ROTA);
    return sucesso("Contrato excluído.");
  });
}

/**
 * Gera as receitas previstas dos contratos ativos para uma competência.
 *
 * RODAR DUAS VEZES NÃO DUPLICA, e a trava não é a consulta daqui: é o índice
 * único `(contract_id, competencia)`. Duas abas abertas clicando ao mesmo
 * tempo passariam pelas duas consultas antes de qualquer uma gravar. Por isso
 * a inserção é feita contrato a contrato e o conflito é engolido em silêncio
 * — quem já existe simplesmente não entra na conta.
 */
export async function gerarLancamentosDoMes(competencia: string): Promise<Resultado<number>> {
  return executarAcao("gerarLancamentosDoMes", async () => {
    const sessao = await exigirSocioNaAcao();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(competencia)) return falha("Competência inválida.");
    const mes = competenciaDe(competencia);

    const pendentes = await contratosSemLancamento(mes);
    if (pendentes.length === 0) {
      return falha("Nada a gerar — os contratos que cobram neste mês já têm lançamento.");
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("finance_entries")
      .insert(
        pendentes.map((contrato) => ({
          tipo: "receita" as const,
          client_id: contrato.client_id,
          contract_id: contrato.id,
          descricao: contrato.nome,
          valor: Number(contrato.valor),
          competencia: mes,
          vencimento: vencimentoNaCompetencia(mes, contrato.dia_vencimento),
          status: "previsto" as const,
          criado_por: sessao.usuarioId,
        })),
      )
      .select("id");

    if (error) {
      // 23505 é violação de índice único: outra aba gerou primeiro. Não é
      // erro para quem clicou — o resultado que ela queria já está lá.
      if (error.code === "23505") {
        return falha("Estes lançamentos já foram gerados. Recarregue a tela.");
      }
      return falha(`Não foi possível gerar: ${error.message}`);
    }

    revalidatePath(ROTA);
    const quantos = data?.length ?? 0;
    return sucesso(`${quantos} lançamento(s) gerado(s) como receita prevista.`, quantos);
  });
}

// ---------------------------------------------------------------------------
// Importação de CSV
// ---------------------------------------------------------------------------

/**
 * Importa lançamentos de um CSV.
 *
 * O cabeçalho manda, não a ordem das colunas: uma planilha vinda do contador
 * nunca tem as colunas na ordem que este sistema escolheu. Linha que não dá
 * para entender NÃO derruba o lote — ela volta na mensagem, com o número,
 * para a pessoa corrigir. Um import que falha inteiro por causa da linha 47
 * faz alguém reimportar quarenta e seis linhas repetidas.
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

    const iTipo = coluna("tipo");
    const iDescricao = coluna("descricao");
    const iValor = coluna("valor");

    if (iTipo < 0 || iDescricao < 0 || iValor < 0) {
      return falha(
        'O cabeçalho precisa ter pelo menos as colunas "tipo", "descricao" e "valor". As opcionais são "competencia", "vencimento", "cliente", "categoria" e "fornecedor".',
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
      supabase.from("finance_categories").select("id, nome, tipo"),
    ]);

    const chave = (t: string) =>
      t
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    const clientePorNome = new Map((clientes ?? []).map((c) => [chave(c.nome_empresa), c.id]));
    const categoriaPorNome = new Map(
      (categorias ?? []).map((c) => [`${c.tipo}|${chave(c.nome)}`, c.id]),
    );

    const paraCriar: Record<string, unknown>[] = [];
    const recusadas: string[] = [];

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      const numero = i + 1;

      const tipoCru = chave(linha[iTipo] ?? "");
      const tipo = tipoCru.startsWith("rec") ? "receita" : tipoCru.startsWith("desp") ? "despesa" : null;
      if (!tipo) {
        recusadas.push(`linha ${numero}: tipo "${linha[iTipo] ?? ""}" não é receita nem despesa`);
        continue;
      }

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
        tipo,
        descricao,
        valor: Math.abs(valor),
        competencia,
        vencimento,
        status: "previsto",
        client_id: nomeDoCliente ? (clientePorNome.get(nomeDoCliente) ?? null) : null,
        category_id: nomeDaCategoria
          ? (categoriaPorNome.get(`${tipo}|${nomeDaCategoria}`) ?? null)
          : null,
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
        ? `${criados} lançamento(s) importado(s).`
        : `${criados} importado(s), ${recusadas.length} recusada(s): ${recusadas.slice(0, 3).join("; ")}${recusadas.length > 3 ? "…" : ""}`,
      { criados, recusadas },
    );
  });
}
