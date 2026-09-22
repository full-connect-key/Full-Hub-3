import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { TaskType, WorkflowStep, WorkflowTemplate } from "@/lib/supabase/database.types";

/**
 * Tipos de tarefa e workflows.
 *
 * Workflow é o fluxo fixo de subtarefas de um tipo de trabalho — todo "Post de
 * feed" nasce com as mesmas etapas. O tipo de tarefa é o atalho que a pessoa
 * escolhe na criação da Task; ela não precisa saber que existe um objeto
 * chamado workflow.
 *
 * Um tipo pode ser global (`client_id` nulo) ou de um cliente só. É assim que
 * uma conta com processo próprio ganha o fluxo dela sem duplicar o resto.
 */

export type TipoDeTarefa = TaskType & {
  cliente: { id: string; nome_empresa: string } | null;
  workflow: { id: string; nome: string; etapas: number } | null;
};

export type EtapaDeWorkflow = WorkflowStep & {
  responsavelPadrao: { id: string; nome: string } | null;
};

export type WorkflowCompleto = WorkflowTemplate & {
  cliente: { id: string; nome_empresa: string } | null;
  etapas: EtapaDeWorkflow[];
  /** Quantos tipos de tarefa apontam para ele. */
  tiposQueUsam: number;
};

/**
 * Os tipos que valem para um cliente: os globais mais os dele.
 *
 * Sem `clienteId`, devolve todos — é o que a tela de gestão precisa.
 */
export async function listarTiposDeTarefa(clienteId?: string | null): Promise<TipoDeTarefa[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase.from("task_types").select("*").eq("ativo", true);
  if (clienteId) consulta = consulta.or(`client_id.is.null,client_id.eq.${clienteId}`);

  const { data: tipos } = await consulta.order("nome");
  if (!tipos || tipos.length === 0) return [];

  const idsDeClientes = [...new Set(tipos.map((t) => t.client_id).filter(Boolean))] as string[];
  const idsDeWorkflows = [
    ...new Set(tipos.map((t) => t.workflow_template_id).filter(Boolean)),
  ] as string[];

  const [{ data: clientes }, { data: workflows }, { data: etapas }] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    idsDeWorkflows.length
      ? supabase.from("workflow_templates").select("id, nome").in("id", idsDeWorkflows)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    idsDeWorkflows.length
      ? supabase.from("workflow_steps").select("template_id").in("template_id", idsDeWorkflows)
      : Promise.resolve({ data: [] as { template_id: string }[] }),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porWorkflow = new Map((workflows ?? []).map((w) => [w.id, w]));
  const contagem = new Map<string, number>();
  for (const etapa of etapas ?? []) {
    contagem.set(etapa.template_id, (contagem.get(etapa.template_id) ?? 0) + 1);
  }

  return tipos.map((tipo) => {
    const workflow = tipo.workflow_template_id
      ? porWorkflow.get(tipo.workflow_template_id)
      : undefined;
    return {
      ...tipo,
      cliente: tipo.client_id ? (porCliente.get(tipo.client_id) ?? null) : null,
      workflow: workflow
        ? { ...workflow, etapas: contagem.get(workflow.id) ?? 0 }
        : null,
    };
  });
}

export async function listarWorkflows(): Promise<WorkflowCompleto[]> {
  const supabase = await criarClienteServidor();

  const { data: modelos } = await supabase
    .from("workflow_templates")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome");

  if (!modelos || modelos.length === 0) return [];

  const ids = modelos.map((m) => m.id);
  const idsDeClientes = [...new Set(modelos.map((m) => m.client_id).filter(Boolean))] as string[];

  const [{ data: etapas }, { data: clientes }, { data: tipos }] = await Promise.all([
    supabase.from("workflow_steps").select("*").in("template_id", ids).order("ordem"),
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    supabase.from("task_types").select("workflow_template_id").in("workflow_template_id", ids),
  ]);

  const idsDePessoas = [
    ...new Set((etapas ?? []).map((e) => e.responsavel_padrao_id).filter(Boolean)),
  ] as string[];

  const { data: pessoas } = idsDePessoas.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsDePessoas)
    : { data: [] as { id: string; nome: string }[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  const usos = new Map<string, number>();
  for (const tipo of tipos ?? []) {
    if (!tipo.workflow_template_id) continue;
    usos.set(tipo.workflow_template_id, (usos.get(tipo.workflow_template_id) ?? 0) + 1);
  }

  return modelos.map((modelo) => ({
    ...modelo,
    cliente: modelo.client_id ? (porCliente.get(modelo.client_id) ?? null) : null,
    tiposQueUsam: usos.get(modelo.id) ?? 0,
    etapas: (etapas ?? [])
      .filter((e) => e.template_id === modelo.id)
      .map((etapa) => ({
        ...etapa,
        responsavelPadrao: etapa.responsavel_padrao_id
          ? (porPessoa.get(etapa.responsavel_padrao_id) ?? null)
          : null,
      })),
  }));
}

export type EtapaAplicada = {
  titulo: string;
  prazo: string | null;
  responsavel_id: string | null;
  funcao_padrao: WorkflowStep["funcao_padrao"];
  prioridade: WorkflowStep["prioridade"];
  requer_aprovacao: boolean;
  tipo_aprovacao: WorkflowStep["tipo_aprovacao"];
  depende_de: number | null;
};

/**
 * Traduz um workflow em subtarefas prontas para o formulário.
 *
 * O prazo sai de `data_inicio + prazo_offset_dias`: data fixa num modelo
 * reutilizável faria toda Task nova nascer vencida.
 *
 * Nada é gravado aqui — o que volta é uma sugestão que a pessoa ainda edita,
 * acrescenta e reordena antes de confirmar.
 */
export async function etapasDoWorkflow(
  templateId: string,
  dataInicio: string,
): Promise<{ etapas: EtapaAplicada[]; snapshot: unknown } | null> {
  const supabase = await criarClienteServidor();

  const { data: modelo } = await supabase
    .from("workflow_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (!modelo) return null;

  const { data: etapas } = await supabase
    .from("workflow_steps")
    .select("*")
    .eq("template_id", templateId)
    .order("ordem");

  const lista = etapas ?? [];
  const posicaoPorOrdem = new Map(lista.map((e, indice) => [e.ordem, indice + 1]));

  return {
    // O snapshot é a cópia congelada: mudar o workflow depois não mexe em
    // nenhuma Task já criada, e este JSON é o que diz qual versão gerou estas
    // subtarefas.
    snapshot: {
      workflow_id: modelo.id,
      nome: modelo.nome,
      copiado_em: new Date().toISOString(),
      etapas: lista,
    },
    etapas: lista.map((etapa) => ({
      titulo: etapa.nome,
      prazo:
        etapa.prazo_offset_dias !== null
          ? somarDias(dataInicio, etapa.prazo_offset_dias)
          : null,
      responsavel_id: etapa.responsavel_padrao_id,
      funcao_padrao: etapa.funcao_padrao,
      prioridade: etapa.prioridade,
      requer_aprovacao: etapa.requer_aprovacao,
      tipo_aprovacao: etapa.tipo_aprovacao,
      depende_de:
        etapa.depende_de_ordem !== null
          ? (posicaoPorOrdem.get(etapa.depende_de_ordem) ?? null)
          : null,
    })),
  };
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}
