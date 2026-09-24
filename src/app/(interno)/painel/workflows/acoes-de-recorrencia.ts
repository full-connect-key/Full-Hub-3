"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAtendimentoNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * As ações das demandas recorrentes.
 *
 * **QUEM CONFIGURA É `is_atendimento()`**, a mesma pergunta que `tasks_insert`
 * faz desde a 0006 — uma recorrência é uma demanda que ainda não aconteceu, e
 * se o Atendimento abre a de hoje, configura a de todo mês. A guarda daqui
 * escreve a frase em português; quem recusa de verdade é a policy.
 *
 * **Gerar não é um insert.** `gerar_ocorrencia()` e `gerar_recorrencias()` são
 * funções do Postgres porque a geração é transacional: cria a task, as
 * subtarefas, as dependências, as referências, grava o histórico e notifica.
 * Seis chamadas pelo PostgREST seriam seis transações, e a terceira falhando
 * deixaria uma task com metade das etapas — e a chave de ocorrência já
 * gravada, o que impediria a rotina de tentar de novo.
 */

const ROTA = "/painel/workflows";

const ROTULOS = {
  nome: "nome da regra",
  client_id: "cliente",
  modelo: "modelo da demanda",
  data_inicio: "data de início",
} as const;

const esquemaDeRecorrencia = z.object({
  nome: z.string().trim().min(2, "Dê um nome à regra."),
  client_id: z.string().uuid("Escolha o cliente."),
  modo: z.enum(["mensal_agrupada", "task_por_ocorrencia"]),
  frequencia: z.enum(["diaria", "semanal", "quinzenal", "mensal"]),
  dias_semana: z.array(z.number().int().min(1).max(7)).nullable().optional(),
  dia_mes: z.number().int().min(1).max(31).nullable().optional(),
  pular_feriados: z.boolean(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data de início."),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  antecedencia_dias: z.number().int().min(0).max(90),
  gerar_como_rascunho: z.boolean(),
  task_type_id: z.string().uuid().nullable().optional(),
  modelo: z.object({
    titulo: z.string().trim().min(1, "Escreva o título das demandas."),
    // Fallback da etapa sem dono (0041). Opcional: uma regra pode distribuir
    // etapa por etapa e não precisar dele.
    responsavel_padrao: z.string().uuid().nullable().optional(),
    briefing_rico: z.unknown().nullable().optional(),
    prioridade: z.enum(["baixa", "normal", "alta", "urgente"]),
    pasta_entrega: z
      .string()
      .trim()
      .regex(/^https?:\/\//i, "A pasta de entrega precisa começar com http:// ou https://."),
    subtarefa_diaria: z.unknown().nullable().optional(),
    subtarefas: z.array(z.unknown()),
    referencias: z.array(z.unknown()),
  }),
});

function conferirPeriodo(entrada: z.infer<typeof esquemaDeRecorrencia>) {
  if (entrada.data_fim && entrada.data_fim < entrada.data_inicio) {
    return "A data de fim não pode ser antes da de início.";
  }
  if (entrada.frequencia === "mensal" && !entrada.dia_mes) {
    return "Numa regra mensal, escolha o dia do mês.";
  }
  if (
    entrada.modo === "task_por_ocorrencia" &&
    entrada.modelo.subtarefas.length === 0
  ) {
    return "Uma task por ocorrência precisa de pelo menos uma etapa no modelo.";
  }
  return null;
}

export async function criarRecorrencia(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("criarRecorrencia", async () => {
    const sessao = await exigirAtendimentoNaAcao();

    const validacao = esquemaDeRecorrencia.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("criarRecorrencia", validacao.error, dados, "Confira a regra.", ROTULOS),
      );
    }
    const entrada = validacao.data;
    const problema = conferirPeriodo(entrada);
    if (problema) return falha(problema);

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("task_recurrences")
      .insert({
        client_id: entrada.client_id,
        nome: entrada.nome,
        modo: entrada.modo,
        frequencia: entrada.frequencia,
        dias_semana: entrada.dias_semana ?? null,
        dia_mes: entrada.dia_mes ?? null,
        pular_feriados: entrada.pular_feriados,
        data_inicio: entrada.data_inicio,
        data_fim: entrada.data_fim ?? null,
        antecedencia_dias: entrada.antecedencia_dias,
        gerar_como_rascunho: entrada.gerar_como_rascunho,
        task_type_id: entrada.task_type_id ?? null,
        modelo: entrada.modelo as unknown as Json,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Configurar recorrência é do Atendimento e da gestão.");

    revalidatePath(ROTA);
    return sucesso("Recorrência criada. Nada foi gerado ainda — a primeira vem na data.", data.id);
  });
}

export async function atualizarRecorrencia(
  id: string,
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("atualizarRecorrencia", async () => {
    await exigirAtendimentoNaAcao();

    const validacao = esquemaDeRecorrencia.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("atualizarRecorrencia", validacao.error, dados, "Confira a regra.", ROTULOS),
      );
    }
    const entrada = validacao.data;
    const problema = conferirPeriodo(entrada);
    if (problema) return falha(problema);

    const supabase = await criarClienteServidor();
    // EDITAR A REGRA AFETA SÓ AS GERAÇÕES FUTURAS. As tasks que já saíram
    // continuam como estão — elas são trabalho de verdade, com comentário e
    // tempo lançado. O trigger `task_recurrences_recalcula` refaz a próxima
    // data quando o QUANDO muda.
    const { data, error } = await supabase
      .from("task_recurrences")
      .update({
        nome: entrada.nome,
        modo: entrada.modo,
        frequencia: entrada.frequencia,
        dias_semana: entrada.dias_semana ?? null,
        dia_mes: entrada.dia_mes ?? null,
        pular_feriados: entrada.pular_feriados,
        data_inicio: entrada.data_inicio,
        data_fim: entrada.data_fim ?? null,
        antecedencia_dias: entrada.antecedencia_dias,
        gerar_como_rascunho: entrada.gerar_como_rascunho,
        task_type_id: entrada.task_type_id ?? null,
        modelo: entrada.modelo as unknown as Json,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou a alteração.");

    revalidatePath(ROTA);
    return sucesso("Regra atualizada. As demandas já geradas continuam como estão.");
  });
}

/** Pausar e retomar. Pausada, a regra some da fila de geração. */
export async function alternarRecorrencia(
  id: string,
  ativo: boolean,
): Promise<Resultado> {
  return executarAcao("alternarRecorrencia", async () => {
    await exigirAtendimentoNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("task_recurrences")
      .update({ ativo })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou.");

    revalidatePath(ROTA);
    return sucesso(
      ativo
        ? "Regra retomada. A próxima ocorrência é a partir de hoje — o que passou não volta."
        : "Regra pausada. Nada mais é gerado até você retomar.",
    );
  });
}

/**
 * Apagar a regra. **As tasks já geradas continuam.**
 *
 * `recurrence_id` é `on delete set null`, e é a regra que o sprint pede em voz
 * alta: elas são trabalho de verdade, com comentário, tempo lançado e
 * aprovação. Apagar a regra apaga o que ainda não aconteceu.
 */
export async function apagarRecorrencia(id: string): Promise<Resultado> {
  return executarAcao("apagarRecorrencia", async () => {
    await exigirAtendimentoNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("task_recurrences")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Apagar recorrência é do Atendimento e da gestão.");

    revalidatePath(ROTA);
    return sucesso("Regra apagada. As demandas que ela já gerou continuam no lugar.");
  });
}

/** Duplicar, para quem tem a mesma rotina em dois clientes. */
export async function duplicarRecorrencia(id: string): Promise<Resultado<string>> {
  return executarAcao("duplicarRecorrencia", async () => {
    const sessao = await exigirAtendimentoNaAcao();

    const supabase = await criarClienteServidor();
    const { data: origem } = await supabase
      .from("task_recurrences")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!origem) return falha("Regra não encontrada.");

    // A CÓPIA NASCE PAUSADA. Duplicar é o começo de uma configuração, não o
    // fim: a pessoa vai trocar o cliente e o título antes de querer que ela
    // gere qualquer coisa. Nascer ativa faria a cópia gerar a demanda do
    // cliente errado na madrugada seguinte.
    const { data, error } = await supabase
      .from("task_recurrences")
      .insert({
        client_id: origem.client_id,
        nome: `${origem.nome} (cópia)`,
        modo: origem.modo,
        frequencia: origem.frequencia,
        dias_semana: origem.dias_semana,
        dia_mes: origem.dia_mes,
        pular_feriados: origem.pular_feriados,
        data_inicio: origem.data_inicio,
        data_fim: origem.data_fim,
        antecedencia_dias: origem.antecedencia_dias,
        gerar_como_rascunho: origem.gerar_como_rascunho,
        task_type_id: origem.task_type_id,
        modelo: origem.modelo,
        ativo: false,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou a cópia.");

    revalidatePath(ROTA);
    return sucesso("Cópia criada, e ela nasce PAUSADA — ajuste antes de ativar.", data.id);
  });
}

/**
 * "Gerar agora": cria a próxima ocorrência na hora.
 *
 * Roda o mesmo caminho da rotina noturna, e a idempotência é a mesma — clicar
 * duas vezes não cria duas tasks, porque quem decide é o índice único e não
 * uma consulta.
 */
export async function gerarAgora(id: string): Promise<Resultado> {
  return executarAcao("gerarAgora", async () => {
    await exigirAtendimentoNaAcao();

    const supabase = await criarClienteServidor();
    const { data: periodo, error: erroPeriodo } = await supabase.rpc(
      "proximo_periodo_da_recorrencia",
      { p_recurrence_id: id },
    );

    if (erroPeriodo) return falha(erroPeriodo.message);
    if (!periodo) {
      return falha(
        "Não há próxima ocorrência para gerar: ou a regra chegou na data de fim, ou tudo o que ela alcança já foi gerado.",
      );
    }

    const { data, error } = await supabase.rpc("gerar_ocorrencia", {
      p_recurrence_id: id,
      p_periodo: periodo,
    });

    if (error) return falha(error.message);
    if (!data) {
      return falha(
        "Nada foi criado: esta ocorrência já existe, ou o período não tem nenhuma data. Veja o histórico da regra.",
      );
    }

    revalidatePath(ROTA);
    revalidatePath("/painel/gestao-tasks");
    return sucesso("Demanda gerada.");
  });
}
