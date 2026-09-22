"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O Resumo Semanal.
 *
 * Toda escrita aqui é sobre o registro da PRÓPRIA pessoa. `user_id` nunca vem
 * do formulário: sai da sessão. Aceitá-lo de fora seria oferecer a qualquer um
 * a chance de escrever no resumo de outro — e mesmo que a RLS recusasse, o
 * simples fato de a action tentar já seria um erro de desenho.
 *
 * Para editar e apagar não há conferência de dono no código, e isso é
 * deliberado: a policy de `weekly_entries` já fecha em `user_id = auth.uid()`,
 * e repetir a regra aqui criaria dois lugares para ela divergir. O que o
 * código garante é o `.select()` — sem ele, um update recusado voltaria sem
 * erro e sem linha, e a tela diria "salvo".
 */

const ROTA = "/painel/resumo-semanal";

const esquema = z.object({
  descricao: z.string().trim().min(3, "Escreva o que foi entregue."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data da entrega."),
  client_id: z.string().uuid().nullable().optional(),
  subtask_id: z.string().uuid().nullable().optional(),
});

export async function criarEntrega(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("criarEntrega", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      return falha(validacao.error.issues[0]?.message ?? "Confira os dados da entrega.");
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("weekly_entries")
      .insert({
        user_id: sessao.usuarioId,
        descricao: entrada.descricao,
        data: entrada.data,
        client_id: entrada.client_id ?? null,
        subtask_id: entrada.subtask_id ?? null,
      })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível registrar: ${error?.message ?? "erro"}`);

    revalidatePath(ROTA);
    return sucesso("Entrega registrada.", data.id);
  });
}

export async function editarEntrega(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarEntrega", async () => {
    await exigirRotaNaAcao(ROTA);

    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      return falha(validacao.error.issues[0]?.message ?? "Confira os dados da entrega.");
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("weekly_entries")
      .update({
        descricao: entrada.descricao,
        data: entrada.data,
        client_id: entrada.client_id ?? null,
        subtask_id: entrada.subtask_id ?? null,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. Este registro é de outra pessoa.");

    revalidatePath(ROTA);
    return sucesso("Entrega atualizada.");
  });
}

export async function excluirEntrega(id: string): Promise<Resultado> {
  return executarAcao("excluirEntrega", async () => {
    await exigirRotaNaAcao(ROTA);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("weekly_entries")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Este registro é de outra pessoa.");

    revalidatePath(ROTA);
    return sucesso("Entrega removida.");
  });
}
