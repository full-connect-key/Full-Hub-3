"use server";

import { revalidatePath } from "next/cache";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import {
  blocosIniciais,
  lerBlocos,
  type BlocoDoRelatorio,
} from "@/lib/dominio/relatorios";
import type { Json } from "@/lib/supabase/database.types";
import { criarClienteServidor } from "@/lib/supabase/server";

const ROTA = "/painel/relatorios";
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function revalidar() {
  revalidatePath(ROTA, "layout");
  revalidatePath("/portal", "layout");
}

export type RelatorioParaGravar = {
  titulo: string;
  subtitulo: string;
  periodoInicio: string;
  periodoFim: string;
  blocos: BlocoDoRelatorio[];
};

function recusaDoCabecalho(d: {
  titulo: string;
  periodoInicio: string;
  periodoFim: string;
}): string | null {
  if (!d.titulo?.trim()) return "Dê um título ao relatório.";
  if (!DATA.test(d.periodoInicio) || !DATA.test(d.periodoFim))
    return "Informe o início e o fim do período.";
  if (d.periodoFim < d.periodoInicio)
    return "O fim do período vem antes do início.";
  return null;
}

/**
 * Cria o relatório de uma conta. Quando a conta já tem um, o novo parte da
 * ESTRUTURA do mais recente — e o gráfico de crescimento já chega com os
 * números de lá na coluna "anterior".
 */
export async function criarRelatorio(dados: {
  clienteId: string;
  titulo: string;
  periodoInicio: string;
  periodoFim: string;
}): Promise<Resultado<{ id: string }>> {
  return executarAcao("criarRelatorio", async () => {
    const sessao = await exigirEquipeNaAcao();

    if (!UUID.test(dados.clienteId ?? "")) return falha("Escolha a conta.");
    const recusa = recusaDoCabecalho(dados);
    if (recusa) return falha(recusa);

    const supabase = await criarClienteServidor();

    const { data: anteriores, error: erroDoAnterior } = await supabase
      .from("relatorios")
      .select("blocos")
      .eq("client_id", dados.clienteId)
      .lt("periodo_inicio", dados.periodoInicio)
      .order("periodo_inicio", { ascending: false })
      .limit(1);
    if (erroDoAnterior) return falha(erroDoAnterior.message);

    let blocos = blocosIniciais();
    const passado = lerBlocos(anteriores?.[0]?.blocos).find(
      (b) => b.tipo === "crescimento",
    );
    if (passado && passado.tipo === "crescimento") {
      blocos = blocos.map((b) =>
        b.tipo === "crescimento"
          ? {
              ...b,
              linhas: passado.linhas.map((l) => ({
                metrica: l.metrica,
                anterior: l.atual,
                atual: 0,
              })),
            }
          : b,
      );
    }

    const { data, error } = await supabase
      .from("relatorios")
      .insert({
        client_id: dados.clienteId,
        titulo: dados.titulo.trim(),
        periodo_inicio: dados.periodoInicio,
        periodo_fim: dados.periodoFim,
        blocos: blocos as unknown as Json,
        criado_por: sessao.usuarioId,
      })
      .select("id");

    if (error) return falha(`Não foi possível criar: ${error.message}`);
    if (!data || data.length === 0)
      return falha("O banco recusou. Criar relatório é da equipe interna.");

    revalidar();
    return sucesso("Relatório criado.", { id: data[0].id });
  });
}

export async function salvarRelatorio(
  id: string,
  dados: RelatorioParaGravar,
): Promise<Resultado> {
  return executarAcao("salvarRelatorio", async () => {
    await exigirEquipeNaAcao();

    const recusa = recusaDoCabecalho(dados);
    if (recusa) return falha(recusa);

    // Relido pela mesma função que a tela usa: o que não é bloco não entra.
    const blocos = lerBlocos(dados.blocos);
    if (blocos.length > 60) return falha("O relatório passou de 60 blocos.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("relatorios")
      .update({
        titulo: dados.titulo.trim(),
        subtitulo: dados.subtitulo?.trim() || null,
        periodo_inicio: dados.periodoInicio,
        periodo_fim: dados.periodoFim,
        blocos: blocos as unknown as Json,
      })
      .eq("id", id)
      .select("id");

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data || data.length === 0)
      return falha("O banco recusou. Este relatório não existe mais.");

    revalidar();
    return sucesso("Relatório salvo.");
  });
}

export async function publicarRelatorio(
  id: string,
  publicar: boolean,
): Promise<Resultado> {
  return executarAcao("publicarRelatorio", async () => {
    await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("relatorios")
      .update({ publicado_em: publicar ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0)
      return falha("O banco recusou. Este relatório não existe mais.");

    revalidar();
    return sucesso(
      publicar
        ? "Publicado. O cliente já vê o relatório no portal."
        : "O relatório saiu do portal do cliente.",
    );
  });
}

export async function apagarRelatorio(id: string): Promise<Resultado> {
  return executarAcao("apagarRelatorio", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("relatorios")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0)
      return falha("O banco recusou. Apagar relatório é da gestão.");

    revalidar();
    return sucesso("Relatório apagado.");
  });
}
