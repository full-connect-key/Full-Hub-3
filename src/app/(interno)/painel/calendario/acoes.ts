"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAtendimentoNaAcao, exigirEquipeNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso } from "@/lib/acoes/resultado";
import type { Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações dos eventos do calendário.
 *
 * **Quem escreve é `is_atendimento()`, e a guarda aqui não é a trava.** A
 * trava é a policy de `events`, que faz a mesma pergunta no banco e vale
 * mesmo para quem chamar a API do Supabase direto. Esta guarda existe para a
 * pessoa ler uma frase em vez de levar um "0 linhas" mudo.
 */

const ROTA = "/painel/calendario";

const esquemaDoEvento = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao evento."),
  tipo: z.enum([
    "convencao",
    "feira",
    "lancamento",
    "reuniao",
    "treinamento",
    "feriado_cliente",
    "outro",
  ]),
  descricao: z.string().trim().max(2000).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data de início."),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data de fim."),
  dia_inteiro: z.boolean().default(true),
  hora_inicio: z.string().optional().nullable(),
  hora_fim: z.string().optional().nullable(),
  local: z.string().trim().max(200).optional().nullable(),
  link: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), {
      message: "O link precisa começar com http:// ou https://.",
    })
    .optional()
    .nullable(),
  bloqueia_ferias: z.boolean().default(false),
  participantes: z.array(z.string().uuid()).default([]),
});

/** Os rótulos da tela, para a recusa nomear o campo em português. */
const ROTULOS = {
  nome: "nome",
  tipo: "tipo",
  data_inicio: "data de início",
  data_fim: "data de fim",
  client_id: "cliente",
  link: "link",
};

export async function salvarEvento(
  id: string | null,
  dados: unknown,
): Promise<Resultado<string>> {
  return executarAcao("salvarEvento", async () => {
    const sessao = await exigirAtendimentoNaAcao();

    const validacao = esquemaDoEvento.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("salvarEvento", validacao.error, dados, "Confira os dados.", ROTULOS),
      );
    }
    const entrada = validacao.data;

    // O PERÍODO INVERTIDO É RECUSADO AQUI E NO BANCO, e as duas existem de
    // propósito: esta escreve a frase que a pessoa lê, o `check` é o que vale
    // para quem chamar a API direto.
    if (entrada.data_fim < entrada.data_inicio) {
      return falha("O evento não pode acabar antes de começar.");
    }

    const supabase = await criarClienteServidor();

    const campos = {
      nome: entrada.nome,
      tipo: entrada.tipo,
      descricao: entrada.descricao?.trim() || null,
      client_id: entrada.client_id || null,
      data_inicio: entrada.data_inicio,
      data_fim: entrada.data_fim,
      dia_inteiro: entrada.dia_inteiro,
      // Sem horário quando é dia inteiro: guardar "09:00" num evento de dia
      // inteiro deixaria a tela mostrando uma hora que ninguém escolheu.
      hora_inicio: entrada.dia_inteiro ? null : entrada.hora_inicio || null,
      hora_fim: entrada.dia_inteiro ? null : entrada.hora_fim || null,
      local: entrada.local?.trim() || null,
      link: entrada.link?.trim() || null,
      bloqueia_ferias: entrada.bloqueia_ferias,
    };

    const { data, error } = id
      ? await supabase.from("events").update(campos).eq("id", id).select("id").maybeSingle()
      : await supabase
          .from("events")
          .insert({ ...campos, criado_por: sessao.usuarioId })
          .select("id")
          .maybeSingle();

    if (error) return falha(`Não foi possível salvar o evento: ${error.message}`);
    if (!data) {
      return falha(
        "O banco recusou. Quem abre evento é quem abre demanda: o Atendimento e a gestão.",
      );
    }

    // OS PARTICIPANTES SÃO REESCRITOS INTEIROS, e não comparados um a um: a
    // lista é curta e a pessoa a edita de uma vez. Comparar daria uma
    // diferença calculada em dois lugares — aqui e na tela — que divergiria
    // no primeiro caso estranho.
    //
    // O DELETE vem antes, e o INSERT só do que ficou: sem isso, tirar alguém
    // não tiraria nada, porque o `unique (event_id, user_id)` faz o insert
    // repetido falhar em silêncio e o antigo continuar lá.
    const eventoId = data.id;
    const { error: erroAoLimpar } = await supabase
      .from("event_participants")
      .delete()
      .eq("event_id", eventoId);
    if (erroAoLimpar) {
      return falha(`O evento foi salvo, mas os participantes não: ${erroAoLimpar.message}`);
    }

    if (entrada.participantes.length > 0) {
      const { error: erroAoPor } = await supabase
        .from("event_participants")
        .insert(entrada.participantes.map((user_id) => ({ event_id: eventoId, user_id })));
      if (erroAoPor) {
        return falha(`O evento foi salvo, mas os participantes não: ${erroAoPor.message}`);
      }
    }

    revalidatePath(ROTA);
    return sucesso(id ? "Evento salvo." : "Evento criado.", eventoId);
  });
}

export async function excluirEvento(id: string): Promise<Resultado> {
  return executarAcao("excluirEvento", async () => {
    await exigirAtendimentoNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Apagar evento é do Atendimento e da gestão.");

    revalidatePath(ROTA);
    return sucesso("Evento removido.");
  });
}

/**
 * Arrastar uma etapa no calendário muda o PRAZO dela.
 *
 * ---------------------------------------------------------------------------
 * AÇÃO PRÓPRIA, E NÃO `atualizarSubtarefa`
 *
 * Aquela pede o `task_id` para revalidar a tela da demanda, e o item do
 * calendário não o carrega — ele vem da view, que devolve o link e mais nada.
 * Tirar o id de dentro do link com uma expressão regular funcionaria até
 * alguém mudar a rota, e aí a gravação passaria a falhar num lugar que
 * ninguém liga à mudança de rota.
 *
 * **Quem decide se pode é a RLS de `subtasks`**, como sempre: a escrita
 * termina em `.select()`, e sem linha de volta é recusa. A tela não repete a
 * pergunta — ela só não oferece o arrasto para quem o banco vai recusar, que
 * é cortesia e não trava.
 *
 * **Arrastar não mexe na Task.** O período dela é derivado das etapas desde a
 * 0028 e se recalcula sozinho: escrever nele aqui seria o segundo lugar
 * gravando o que o trigger já grava.
 * ---------------------------------------------------------------------------
 */
export async function moverPrazoDaEtapa(id: string, prazo: string): Promise<Resultado> {
  return executarAcao("moverPrazoDaEtapa", async () => {
    await exigirEquipeNaAcao();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return falha("Data inválida.");

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("subtasks")
      .update({ prazo })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível mover: ${error.message}`);
    if (!data) {
      return falha("O banco recusou. Mover o prazo é de quem faz a etapa, do Atendimento ou da gestão.");
    }

    revalidatePath(ROTA);
    return sucesso("Prazo movido.");
  });
}
