"use server";

import { revalidatePath } from "next/cache";

import { exigirSessaoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O que dá para fazer com uma notificação: marcar como lida.
 *
 * Só isso. Criar é da função `notificar()` no Postgres, e apagar não existe —
 * um aviso lido some da contagem e continua no histórico, que é o que permite
 * voltar e reler o que foi avisado.
 */

export async function marcarComoLida(id: string): Promise<Resultado> {
  return executarAcao("marcarComoLida", async () => {
    await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("notifications")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", id)
      .is("lida_em", null)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    // Zero linhas aqui não é recusa: pode ser um aviso que já estava lido, e
    // avisar sobre isso seria um erro por uma coisa que deu certo.
    if (!data) return sucesso("Já estava lida.");

    revalidatePath("/painel", "layout");
    return sucesso("Marcada como lida.");
  });
}

export async function marcarTodasComoLidas(): Promise<Resultado> {
  return executarAcao("marcarTodasComoLidas", async () => {
    const sessao = await exigirSessaoNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("notifications")
      .update({ lida_em: new Date().toISOString() })
      .eq("user_id", sessao.usuarioId)
      .is("lida_em", null)
      .select("id");

    if (error) return falha(error.message);

    revalidatePath("/painel", "layout");
    const quantas = data?.length ?? 0;
    return sucesso(
      quantas === 0 ? "Nada por ler." : `${quantas} notificação(ões) marcada(s) como lida(s).`,
    );
  });
}
