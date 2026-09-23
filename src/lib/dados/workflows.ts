import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import type { TaskType, WorkflowStep } from "@/lib/supabase/database.types";

/**
 * Workflows.
 *
 * Um workflow é um jeito de trabalho da agência — "Post de feed",
 * "Campanha" — e ele CARREGA a cadeia fixa de etapas que toda demanda daquele
 * tipo percorre. É o que a pessoa escolhe ao abrir uma Task, e é o que faz as
 * subtarefas nascerem prontas.
 *
 * No banco isso mora em duas tabelas: `task_types` guarda o nome e o alcance,
 * `workflow_templates` + `workflow_steps` guardam as etapas. A divisão existe
 * porque dois tipos podem, em tese, compartilhar o mesmo fluxo — mas ela é
 * detalhe de armazenamento, e a tela nunca a mostra: quem usa o Full Hub
 * cadastra "um workflow com suas etapas", uma coisa só.
 *
 * Um tipo pode ser global (`client_id` nulo) ou de um cliente só. É assim que
 * uma conta com processo próprio ganha o fluxo dela sem duplicar o resto.
 */

export type WorkflowDaAgencia = TaskType & {
  cliente: { id: string; nome_empresa: string } | null;
  workflow: { id: string; nome: string; etapas: number } | null;
};

export type EtapaDeWorkflow = WorkflowStep & {
  responsavelPadrao: { id: string; nome: string } | null;
};

/** Um workflow com as etapas que ele gera. É a unidade da tela. */
export type TipoComFluxo = TaskType & {
  cliente: { id: string; nome_empresa: string } | null;
  etapas: EtapaDeWorkflow[];
};

/**
 * Os tipos que valem para um cliente: os globais mais os dele.
 *
 * Sem `clienteId`, devolve todos — é o que a tela de gestão precisa.
 */
export async function listarWorkflows(clienteId?: string | null): Promise<WorkflowDaAgencia[]> {
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

/**
 * Os workflows com a cadeia de etapas inteira — o que a tela de gestão
 * mostra e edita.
 *
 * Diferente de `listarWorkflows`, traz os arquivados junto (com `ativo`
 * dizendo qual é qual) porque quem administra precisa enxergar e reativar o
 * que saiu de circulação.
 */
export async function listarTiposComFluxo(): Promise<TipoComFluxo[]> {
  const supabase = await criarClienteServidor();

  const { data: tipos } = await supabase
    .from("task_types")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome");

  if (!tipos || tipos.length === 0) return [];

  const idsDeClientes = [...new Set(tipos.map((t) => t.client_id).filter(Boolean))] as string[];
  const idsDeFluxos = [
    ...new Set(tipos.map((t) => t.workflow_template_id).filter(Boolean)),
  ] as string[];

  const [{ data: clientes }, { data: etapas }] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ data: [] as { id: string; nome_empresa: string }[] }),
    idsDeFluxos.length
      ? supabase.from("workflow_steps").select("*").in("template_id", idsDeFluxos).order("ordem")
      : Promise.resolve({ data: [] as WorkflowStep[] }),
  ]);

  const idsDePessoas = [
    ...new Set((etapas ?? []).map((e) => e.responsavel_padrao_id).filter(Boolean)),
  ] as string[];

  const { data: pessoas } = idsDePessoas.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsDePessoas)
    : { data: [] as { id: string; nome: string }[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  return tipos.map((tipo) => ({
    ...tipo,
    cliente: tipo.client_id ? (porCliente.get(tipo.client_id) ?? null) : null,
    etapas: (etapas ?? [])
      .filter((e) => e.template_id === tipo.workflow_template_id)
      .map((etapa) => ({
        ...etapa,
        responsavelPadrao: etapa.responsavel_padrao_id
          ? (porPessoa.get(etapa.responsavel_padrao_id) ?? null)
          : null,
      })),
  }));
}

/**
 * As etapas de um WORKFLOW, já traduzidas em subtarefas.
 *
 * Mora aqui, e não na Server Action, porque é leitura: a action só orquestra.
 * E porque é aqui que o gerador de protótipo consegue trocar a fonte por dados
 * de exemplo — uma consulta solta dentro da action deixaria a tela do protótipo
 * sem as etapas, que é exatamente o que ela precisa mostrar.
 */
export async function fluxoDoWorkflow(
  tipoId: string,
  dataInicio: string,
): Promise<{ etapas: EtapaAplicada[]; snapshot: unknown } | null> {
  const supabase = await criarClienteServidor();

  const { data: tipo } = await supabase
    .from("task_types")
    .select("workflow_template_id")
    .eq("id", tipoId)
    .maybeSingle();

  if (!tipo?.workflow_template_id) return null;
  return etapasDoWorkflow(tipo.workflow_template_id, dataInicio);
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
