"use server";

import { revalidatePath } from "next/cache";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Sugestões para o Full Hub (0158): a equipe escreve, a gestão lê.
 */
export async function enviarSugestao(texto: string): Promise<Resultado> {
  return executarAcao("enviarSugestao", async () => {
    const sessao = await exigirEquipeNaAcao();

    const limpo = (texto ?? "").trim();
    if (limpo.length < 3) return falha("Escreva a sugestão antes de enviar.");
    if (limpo.length > 4000) return falha("A sugestão passou de 4000 caracteres.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("sugestoes")
      .insert({ autor_id: sessao.usuarioId, texto: limpo })
      .select("id");

    if (error) return falha(`Não foi possível enviar: ${error.message}`);
    if (!data || data.length === 0) {
      return falha("O banco recusou. Sugerir é da equipe interna.");
    }

    revalidatePath("/painel", "layout");
    return sucesso("Sugestão enviada. Obrigado!");
  });
}

export async function marcarSugestaoComoVista(id: string): Promise<Resultado> {
  return executarAcao("marcarSugestaoComoVista", async () => {
    const sessao = await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("sugestoes")
      .update({ vista_em: new Date().toISOString(), vista_por: sessao.usuarioId })
      .eq("id", id)
      .select("id");

    if (error) return falha(error.message);
    if (!data || data.length === 0) {
      return falha("O banco recusou. Marcar como vista é da gestão.");
    }

    revalidatePath("/painel", "layout");
    return sucesso("Marcada como vista.");
  });
}
