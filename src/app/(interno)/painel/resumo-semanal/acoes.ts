"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirRotaNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { subtarefasAindaNaoRegistradas } from "@/lib/dados/resumo-semanal";
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
      return falha(recusaDeValidacao("criarEntrega", validacao.error, dados, "Confira os dados da entrega."));
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
      return falha(recusaDeValidacao("editarEntrega", validacao.error, dados, "Confira os dados da entrega."));
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

const esquemaDaNota = z.object({
  semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Semana inválida."),
  conteudo_rico: z.unknown().nullable().optional(),
  conteudo_texto: z.string().max(20000).nullable().optional(),
  humor: z.enum(["otimo", "bom", "neutro", "dificil"]).nullable().optional(),
});

/**
 * O texto livre da semana.
 *
 * Grava os dois formatos: o JSON do TipTap, que é o que a tela reabre, e o
 * texto puro, que é o que a busca procura. Guardar só o JSON obrigaria a
 * busca a vasculhar nomes de nó; guardar só o texto perderia a formatação.
 *
 * `user_id` sai da sessão, nunca do formulário — e a semana futura é recusada
 * pelo trigger da 0012, não só por esta action.
 */
export async function salvarNotaDaSemana(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarNotaDaSemana", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const validacao = esquemaDaNota.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarNotaDaSemana", validacao.error, dados, "Confira o registro da semana."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("weekly_notes")
      .upsert(
        {
          user_id: sessao.usuarioId,
          semana: entrada.semana,
          conteudo_rico: (entrada.conteudo_rico ?? null) as never,
          conteudo_texto: entrada.conteudo_texto?.trim() || null,
          humor: entrada.humor ?? null,
        },
        { onConflict: "user_id,semana" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Este registro é de outra pessoa.");

    revalidatePath(ROTA);
    return sucesso("Salvo.");
  });
}

/**
 * Transforma em entregas as subtarefas concluídas na semana.
 *
 * Só as que ainda não viraram entrega: clicar duas vezes não duplica — e
 * clicar duas vezes é o que acontece quando a primeira parece não ter feito
 * nada.
 *
 * NÃO roda sozinho ao abrir a tela. O sprint é explícito, e a razão é boa: o
 * registro é a leitura que a pessoa faz do próprio trabalho, e uma lista
 * preenchida por máquina deixaria de ser dela.
 */
export async function puxarEntregasDaSemana(
  inicioISO: string,
  fimISO: string,
): Promise<Resultado<number>> {
  return executarAcao("puxarEntregasDaSemana", async () => {
    const sessao = await exigirRotaNaAcao(ROTA);

    const pendentes = await subtarefasAindaNaoRegistradas(
      sessao.usuarioId,
      new Date(`${inicioISO}T12:00:00`),
      new Date(`${fimISO}T12:00:00`),
    );

    if (pendentes.length === 0) {
      return falha("Nada novo para puxar — as etapas desta semana já estão registradas.");
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("weekly_entries")
      .insert(
        pendentes.map((sub) => ({
          user_id: sessao.usuarioId,
          // A data da entrega é a da conclusão, e não a de hoje: puxar na
          // segunda-feira seguinte dataria tudo errado.
          data: sub.concluidaEm,
          descricao: sub.titulo,
          client_id: sub.clientId,
          subtask_id: sub.id,
        })),
      )
      .select("id");

    if (error) return falha(`Não foi possível puxar: ${error.message}`);

    revalidatePath(ROTA);
    const quantas = data?.length ?? 0;
    return sucesso(
      `${quantas} entrega(s) registrada(s). Ajuste o texto de cada uma como quiser.`,
      quantas,
    );
  });
}
