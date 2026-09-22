"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Tipos de tarefa.
 *
 * Gestão só — é `task_types_write` e `workflow_templates_write` no banco, as
 * duas presas a `is_gestor()`.
 *
 * O TIPO E O FLUXO SÃO GRAVADOS JUNTOS. Cadastrar "Post de feed" e cadastrar
 * as etapas de um post de feed eram, até aqui, duas telas e dois objetos —
 * e ninguém entendia por quê, com razão: no uso real é uma coisa só. As duas
 * tabelas continuam existindo (`workflow_templates` pode, em tese, ser
 * compartilhado por dois tipos), mas quem usa o Full Hub nunca mais precisa
 * saber disso.
 *
 * A regra que atravessa tudo aqui é o SNAPSHOT: editar um tipo nunca mexe numa
 * Task existente. Ao aplicar um tipo, as subtarefas são materializadas e uma
 * cópia da configuração vai para `tasks.workflow_snapshot`. A partir dali, as
 * subtarefas são a fonte da verdade daquela demanda — mudar o modelo muda as
 * próximas, e só.
 */

const ROTA = "/painel/workflows";

const FUNCOES = [
  "Atendimento",
  "Social Media",
  "Redator",
  "Design",
  "Audiovisual",
  "Trafego",
  "Desenvolvimento",
  "Gestao",
  "Outro",
] as const;

const esquemaDeEtapa = z.object({
  nome: z.string().min(1, "A etapa precisa de um nome."),
  ordem: z.number().int().positive(),
  funcao_padrao: z.enum(FUNCOES).nullable().optional(),
  responsavel_padrao_id: z.string().uuid().nullable().optional(),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]).default("normal"),
  prazo_offset_dias: z.number().int().nullable().optional(),
  requer_aprovacao: z.boolean().default(false),
  tipo_aprovacao: z.enum(["interna", "cliente"]).nullable().optional(),
  depende_de_ordem: z.number().int().positive().nullable().optional(),
});

const esquemaDeTipo = z.object({
  nome: z.string().min(2, "Dê um nome ao tipo de tarefa."),
  descricao: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  ativo: z.boolean().default(true),
  etapas: z.array(esquemaDeEtapa).default([]),
});

type Etapa = z.infer<typeof esquemaDeEtapa>;

/**
 * Grava as etapas de um fluxo, substituindo as que estavam lá.
 *
 * Elas não têm vida própria fora do modelo, e nenhuma Task aponta para elas —
 * o que a Task guarda é a cópia materializada nas subtarefas dela. Por isso
 * reescrever inteiro é mais honesto que tentar casar linha a linha.
 */
async function regravarEtapas(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  templateId: string,
  etapas: Etapa[],
): Promise<string | null> {
  await supabase.from("workflow_steps").delete().eq("template_id", templateId);
  if (etapas.length === 0) return null;

  const { error } = await supabase.from("workflow_steps").insert(
    etapas.map((etapa) => ({
      template_id: templateId,
      nome: etapa.nome.trim(),
      ordem: etapa.ordem,
      funcao_padrao: etapa.funcao_padrao ?? null,
      responsavel_padrao_id: etapa.responsavel_padrao_id ?? null,
      prioridade: etapa.prioridade,
      prazo_offset_dias: etapa.prazo_offset_dias ?? null,
      requer_aprovacao: etapa.requer_aprovacao,
      tipo_aprovacao: etapa.requer_aprovacao ? (etapa.tipo_aprovacao ?? "interna") : null,
      depende_de_ordem: etapa.depende_de_ordem ?? null,
    })),
  );
  return error ? error.message : null;
}

/**
 * Cria ou atualiza um tipo de tarefa junto com as etapas dele.
 *
 * Num cadastro novo, o fluxo nasce antes do tipo e o tipo já aponta para ele.
 * Se as etapas falharem, o fluxo recém-criado é apagado: modelo pela metade é
 * pior que nenhum — a pessoa escolheria "Post de feed" e não viria etapa
 * nenhuma, sem entender por quê.
 */
export async function salvarTipoDeTarefa(
  id: string | null,
  dados: unknown,
): Promise<Resultado<string>> {
  return executarAcao("salvarTipoDeTarefa", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeTipo.safeParse(dados);
    if (!validacao.success) {
      return falha(validacao.error.issues[0]?.message ?? "Confira os dados do tipo de tarefa.");
    }
    const entrada = validacao.data;

    for (const etapa of entrada.etapas) {
      if (etapa.requer_aprovacao && !etapa.tipo_aprovacao) {
        return falha(`Diga de que tipo é a aprovação de "${etapa.nome}": interna ou do cliente.`);
      }
    }

    const supabase = await criarClienteServidor();
    const nome = entrada.nome.trim();
    const clientId = entrada.client_id ?? null;

    if (id) {
      const { data: tipo, error } = await supabase
        .from("task_types")
        .update({
          nome,
          descricao: entrada.descricao ?? null,
          client_id: clientId,
          ativo: entrada.ativo,
        })
        .eq("id", id)
        .select("id, workflow_template_id")
        .maybeSingle();

      if (error) return falha(`Não foi possível salvar: ${error.message}`);
      if (!tipo) return falha("O banco recusou. Editar tipo de tarefa é da gestão.");

      // Um tipo antigo pode não ter fluxo ainda. Nesse caso ele ganha um agora,
      // em vez de as etapas se perderem em silêncio.
      let templateId = tipo.workflow_template_id;
      if (!templateId) {
        const { data: novo, error: erroDoFluxo } = await supabase
          .from("workflow_templates")
          .insert({ nome, client_id: clientId, criado_por: sessao.usuarioId })
          .select("id")
          .single();
        if (erroDoFluxo || !novo) {
          return falha(`Não foi possível criar o fluxo: ${erroDoFluxo?.message ?? "erro"}`);
        }
        templateId = novo.id;
        await supabase
          .from("task_types")
          .update({ workflow_template_id: templateId })
          .eq("id", id);
      } else {
        // O fluxo acompanha o nome e o alcance do tipo: eles são a mesma coisa
        // para quem usa, e um nome divergente só confundiria quem for ler o
        // banco depois.
        await supabase
          .from("workflow_templates")
          .update({ nome, client_id: clientId, ativo: entrada.ativo })
          .eq("id", templateId);
      }

      const erroDasEtapas = await regravarEtapas(supabase, templateId, entrada.etapas);
      if (erroDasEtapas) return falha(`As etapas falharam: ${erroDasEtapas}`);

      revalidatePath(ROTA);
      return sucesso("Tipo salvo. As Tasks já criadas não mudam.", id);
    }

    const { data: fluxo, error: erroDoFluxo } = await supabase
      .from("workflow_templates")
      .insert({
        nome,
        descricao: entrada.descricao ?? null,
        client_id: clientId,
        ativo: entrada.ativo,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (erroDoFluxo || !fluxo) {
      return falha(`Não foi possível criar: ${erroDoFluxo?.message ?? "erro"}`);
    }

    const erroDasEtapas = await regravarEtapas(supabase, fluxo.id, entrada.etapas);
    if (erroDasEtapas) {
      await supabase.from("workflow_templates").delete().eq("id", fluxo.id);
      return falha(`As etapas falharam, então o tipo não foi criado: ${erroDasEtapas}`);
    }

    const { data: tipo, error } = await supabase
      .from("task_types")
      .insert({
        nome,
        descricao: entrada.descricao ?? null,
        client_id: clientId,
        workflow_template_id: fluxo.id,
        ativo: entrada.ativo,
      })
      .select("id")
      .single();

    if (error || !tipo) {
      await supabase.from("workflow_templates").delete().eq("id", fluxo.id);
      return falha(`Não foi possível criar: ${error?.message ?? "erro"}`);
    }

    revalidatePath(ROTA);
    return sucesso(
      `Tipo "${nome}" criado com ${entrada.etapas.length} etapa(s). Já dá para escolher ao abrir uma task.`,
      tipo.id,
    );
  });
}

/**
 * Duplicar — o caminho para dar a um cliente uma variação do fluxo global sem
 * refazer tudo.
 */
export async function duplicarTipoDeTarefa(
  id: string,
  paraCliente: string | null,
): Promise<Resultado<string>> {
  return executarAcao("duplicarTipoDeTarefa", async () => {
    const sessao = await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data: original } = await supabase
      .from("task_types")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!original) return falha("Tipo de tarefa não encontrado.");

    const { data: etapas } = original.workflow_template_id
      ? await supabase
          .from("workflow_steps")
          .select("*")
          .eq("template_id", original.workflow_template_id)
          .order("ordem")
      : { data: null };

    const nome = `${original.nome} (cópia)`;

    const { data: fluxo, error: erroDoFluxo } = await supabase
      .from("workflow_templates")
      .insert({
        nome,
        descricao: original.descricao,
        client_id: paraCliente,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (erroDoFluxo || !fluxo) {
      return falha(`Não foi possível duplicar: ${erroDoFluxo?.message ?? "erro"}`);
    }

    if (etapas && etapas.length > 0) {
      await supabase.from("workflow_steps").insert(
        etapas.map((etapa) => ({
          template_id: fluxo.id,
          nome: etapa.nome,
          ordem: etapa.ordem,
          funcao_padrao: etapa.funcao_padrao,
          responsavel_padrao_id: etapa.responsavel_padrao_id,
          prioridade: etapa.prioridade,
          prazo_offset_dias: etapa.prazo_offset_dias,
          requer_aprovacao: etapa.requer_aprovacao,
          tipo_aprovacao: etapa.tipo_aprovacao,
          depende_de_ordem: etapa.depende_de_ordem,
        })),
      );
    }

    const { data: copia, error } = await supabase
      .from("task_types")
      .insert({
        nome,
        descricao: original.descricao,
        client_id: paraCliente,
        workflow_template_id: fluxo.id,
      })
      .select("id")
      .single();

    if (error || !copia) {
      await supabase.from("workflow_templates").delete().eq("id", fluxo.id);
      return falha(`Não foi possível duplicar: ${error?.message ?? "erro"}`);
    }

    revalidatePath(ROTA);
    return sucesso("Tipo duplicado.", copia.id);
  });
}

/**
 * Arquivar em vez de apagar: Tasks antigas apontam para o tipo, e o nome
 * precisa continuar legível no histórico delas.
 */
export async function arquivarTipoDeTarefa(id: string, ativo: boolean): Promise<Resultado> {
  return executarAcao("arquivarTipoDeTarefa", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("task_types")
      .update({ ativo })
      .eq("id", id)
      .select("id, workflow_template_id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Arquivar tipo de tarefa é da gestão.");

    if (data.workflow_template_id) {
      await supabase
        .from("workflow_templates")
        .update({ ativo })
        .eq("id", data.workflow_template_id);
    }

    revalidatePath(ROTA);
    return sucesso(ativo ? "Tipo reativado." : "Tipo arquivado.");
  });
}

/**
 * "Salvar as subtarefas desta Task como tipo de tarefa."
 *
 * O caminho de volta: uma demanda que deu certo vira modelo. O prazo de cada
 * etapa é convertido em dias a partir do início da Task — data fixa num modelo
 * reutilizável faria toda Task nova nascer vencida.
 *
 * Cria o TIPO, não só o fluxo. Antes criava só o fluxo, e o resultado era um
 * beco sem saída: o modelo existia, aparecia na tela de gestão e nunca podia
 * ser escolhido ao abrir uma task, porque o formulário lista tipos.
 */
export async function salvarTaskComoTipo(
  taskId: string,
  nome: string,
  paraCliente: string | null,
): Promise<Resultado<string>> {
  return executarAcao("salvarTaskComoTipo", async () => {
    const sessao = await exigirGestorNaAcao();
    if (nome.trim().length < 2) return falha("Dê um nome ao tipo de tarefa.");

    const supabase = await criarClienteServidor();

    const { data: task } = await supabase
      .from("tasks")
      .select("id, data_inicio")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) return falha("Task não encontrada.");

    const { data: subtarefas } = await supabase
      .from("subtasks")
      .select(
        "id, titulo, ordem, prazo, responsavel_id, prioridade, requer_aprovacao, tipo_aprovacao",
      )
      .eq("task_id", taskId)
      .order("ordem");

    if (!subtarefas || subtarefas.length === 0) {
      return falha("Esta task não tem subtarefas para virar modelo.");
    }

    const { data: dependencias } = await supabase
      .from("subtask_dependencies")
      .select("subtask_id, depende_de_id")
      .in(
        "subtask_id",
        subtarefas.map((s) => s.id),
      );

    const { data: fluxo, error: erroDoFluxo } = await supabase
      .from("workflow_templates")
      .insert({
        nome: nome.trim(),
        descricao: "Criado a partir de uma task existente.",
        client_id: paraCliente,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (erroDoFluxo || !fluxo) {
      return falha(`Não foi possível criar: ${erroDoFluxo?.message ?? "erro"}`);
    }

    const ordemPorId = new Map(subtarefas.map((s, indice) => [s.id, indice + 1]));

    const { error: erroDasEtapas } = await supabase.from("workflow_steps").insert(
      subtarefas.map((sub, indice) => {
        const dependencia = (dependencias ?? []).find((d) => d.subtask_id === sub.id);
        return {
          template_id: fluxo.id,
          nome: sub.titulo,
          ordem: indice + 1,
          responsavel_padrao_id: sub.responsavel_id,
          prioridade: sub.prioridade,
          prazo_offset_dias: sub.prazo ? diasEntre(task.data_inicio, sub.prazo) : null,
          requer_aprovacao: sub.requer_aprovacao,
          tipo_aprovacao: sub.tipo_aprovacao,
          depende_de_ordem: dependencia
            ? (ordemPorId.get(dependencia.depende_de_id) ?? null)
            : null,
        };
      }),
    );

    if (erroDasEtapas) {
      await supabase.from("workflow_templates").delete().eq("id", fluxo.id);
      return falha(`As etapas falharam, então o tipo não foi criado: ${erroDasEtapas.message}`);
    }

    const { data: tipo, error } = await supabase
      .from("task_types")
      .insert({
        nome: nome.trim(),
        descricao: "Criado a partir de uma task existente.",
        client_id: paraCliente,
        workflow_template_id: fluxo.id,
      })
      .select("id")
      .single();

    if (error || !tipo) {
      await supabase.from("workflow_templates").delete().eq("id", fluxo.id);
      return falha(`Não foi possível criar: ${error?.message ?? "erro"}`);
    }

    revalidatePath(ROTA);
    return sucesso(
      `Tipo "${nome.trim()}" criado com ${subtarefas.length} etapa(s).`,
      tipo.id,
    );
  });
}

function diasEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / umDia);
}
