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

/**
 * Marcar como vistos os avisos de uma área — o botão da faixa de novidades em
 * Minhas Tasks.
 *
 * **Ela é a MESMA escrita de `marcarComoLida`, em lote**, e é por isso que o
 * sinal da faixa e o contador do sino apagam juntos: os dois leem `lida_em`.
 * Uma coluna `visto_em` separada daria dois números sobre o mesmo fato, e a
 * pessoa não teria como saber qual dos dois acreditar.
 *
 * **Os ids vêm da tela, e não a área**, porque quem decide o recorte é a
 * consulta que desenhou a faixa: mandar "social" para cá faria o servidor
 * repetir a regra de qual link é de qual área, e as duas divergiriam no dia em
 * que uma rota mudasse. E não há risco no que vem do navegador — a RLS de
 * `notifications` fecha em `auth.uid()`, então um id de outra pessoa não
 * atualiza linha nenhuma.
 */
export async function marcarNovidadesComoVistas(ids: unknown): Promise<Resultado> {
  return executarAcao("marcarNovidadesComoVistas", async () => {
    await exigirSessaoNaAcao();

    const lista = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
    if (lista.length === 0) return sucesso("Nada por ver.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("notifications")
      .update({ lida_em: new Date().toISOString() })
      .in("id", lista)
      .is("lida_em", null)
      .select("id");

    if (error) return falha(error.message);

    revalidatePath("/painel", "layout");
    const quantas = data?.length ?? 0;
    return sucesso(quantas === 0 ? "Já estavam vistas." : "Pronto — marcadas como vistas.");
  });
}
