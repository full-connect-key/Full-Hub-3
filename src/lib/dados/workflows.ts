import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { TaskType, TeamFuncao, WorkflowStep } from "@/lib/supabase/database.types";

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
  /**
   * Quantas demandas usaram este workflow.
   *
   * A tela mostra antes de apagar. Elas NÃO se perdem — as etapas foram
   * materializadas como subtarefas e o fluxo ficou no `workflow_snapshot` da
   * Task —, mas quem vai apagar merece saber o tamanho do que está mexendo.
   */
  demandas: number;
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

  const tipos = ouFalha(
    "os workflows da agência",
    await consulta.order("nome"),
  );
  if (!tipos || tipos.length === 0) return [];

  const idsDeClientes = [...new Set(tipos.map((t) => t.client_id).filter(Boolean))] as string[];
  const idsDeWorkflows = [
    ...new Set(tipos.map((t) => t.workflow_template_id).filter(Boolean)),
  ] as string[];

  const [resposta0, resposta1, resposta2] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ error: null, data: [] as { id: string; nome_empresa: string }[] }),
    idsDeWorkflows.length
      ? supabase.from("workflow_templates").select("id, nome").in("id", idsDeWorkflows)
      : Promise.resolve({ error: null, data: [] as { id: string; nome: string }[] }),
    idsDeWorkflows.length
      ? supabase.from("workflow_steps").select("template_id").in("template_id", idsDeWorkflows)
      : Promise.resolve({ error: null, data: [] as { template_id: string }[] }),
  ]);
  const clientes = ouFalha("as empresas dos workflows", resposta0);
  const workflows = ouFalha("os workflows", resposta1);
  const etapas = ouFalha("as etapas dos workflows", resposta2);

  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  const porWorkflow = new Map(workflows.map((w) => [w.id, w]));
  const contagem = new Map<string, number>();
  for (const etapa of etapas) {
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

  const tipos = ouFalha(
    "as pessoas das etapas",
    await supabase
      .from("task_types")
      .select("*")
      .order("ativo", { ascending: false })
      .order("nome"),
  );

  if (!tipos || tipos.length === 0) return [];

  const idsDeClientes = [...new Set(tipos.map((t) => t.client_id).filter(Boolean))] as string[];
  const idsDeFluxos = [
    ...new Set(tipos.map((t) => t.workflow_template_id).filter(Boolean)),
  ] as string[];

  const [resposta0, resposta1, resposta2] = await Promise.all([
    idsDeClientes.length
      ? supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes)
      : Promise.resolve({ error: null, data: [] as { id: string; nome_empresa: string }[] }),
    idsDeFluxos.length
      ? supabase.from("workflow_steps").select("*").in("template_id", idsDeFluxos).order("ordem")
      : Promise.resolve({ error: null, data: [] as WorkflowStep[] }),
    // Uma consulta para TODOS os tipos, e não uma por cartão: a tela lista
    // dezenas, e contar demanda por cartão seria dezenas de idas ao banco
    // por um número que aparece só na confirmação.
    supabase
      .from("tasks")
      .select("task_type_id")
      .in(
        "task_type_id",
        tipos.map((t) => t.id),
      ),
  ]);
  const clientes = ouFalha("as empresas do workflow", resposta0);
  const etapas = ouFalha("as etapas do workflow", resposta1);
  const usos = ouFalha("as demandas que usam o workflow", resposta2);

  const porTipo = new Map<string, number>();
  for (const linha of usos) {
    if (!linha.task_type_id) continue;
    porTipo.set(linha.task_type_id, (porTipo.get(linha.task_type_id) ?? 0) + 1);
  }

  const idsDePessoas = [
    ...new Set(etapas.map((e) => e.responsavel_padrao_id).filter(Boolean)),
  ] as string[];

  const pessoas = idsDePessoas.length
    ? ouFalha(
        "as pessoas padrão das etapas",
        await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", idsDePessoas),
      )
    : [];

  const porPessoa = new Map(pessoas.map((p) => [p.id, p]));
  const porCliente = new Map(clientes.map((c) => [c.id, c]));

  return tipos.map((tipo) => ({
    ...tipo,
    demandas: porTipo.get(tipo.id) ?? 0,
    cliente: tipo.client_id ? (porCliente.get(tipo.client_id) ?? null) : null,
    etapas: etapas
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
  clienteId?: string | null,
): Promise<FluxoAplicado | null> {
  const supabase = await criarClienteServidor();

  // `limit(1)` E NÃO `maybeSingle()`: o genérico de `ouFalha` resolve a união de
  // duas formas que ele devolve para `never`, e o erro sai na linha de baixo
  // dizendo que a propriedade não existe em `never`.
  const [tipo] = ouFalha(
    "o workflow do modelo de task",
    await supabase
      .from("task_types")
      .select("workflow_template_id")
      .eq("id", tipoId)
      .limit(1),
  );

  if (!tipo?.workflow_template_id) return null;
  return etapasDoWorkflow(tipo.workflow_template_id, dataInicio, clienteId);
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

export type FluxoAplicado = {
  etapas: EtapaAplicada[];
  snapshot: unknown;
  /**
   * As funções que ficaram sem ninguém, sem repetição.
   *
   * **Isto é aviso e não recusa**, e é decisão registrada: uma etapa sem dono
   * não aparece no "Minhas Tasks" de ninguém, que é o pior tipo de trabalho —
   * o que existe e ninguém sabe que é seu. Mas travar a abertura da demanda por
   * causa de um cadastro deixaria o cliente sem entrega, então quem abre lê
   * quais faltam e resolve na hora, na própria etapa ou na ficha da conta.
   */
  semDono: TeamFuncao[];
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
  clienteId?: string | null,
): Promise<FluxoAplicado | null> {
  const supabase = await criarClienteServidor();

  const [modelo] = ouFalha(
    "o workflow pedido",
    await supabase
      .from("workflow_templates")
      .select("*")
      .eq("id", templateId)
      .limit(1),
  );
  if (!modelo) return null;

  /**
   * QUEM RESOLVE O RESPONSÁVEL É O BANCO, quando há conta (migration 0064).
   *
   * `etapas_resolvidas_do_workflow()` aplica a ordem — pessoa escrita na etapa,
   * depois quem exerce aquela função nesta conta — e é ela que responde, e não
   * um `coalesce` escrito aqui do lado. Duas contas com a mesma pergunta é
   * onde as duas verdades começam a divergir, e esta em especial tem um degrau
   * a mais que a tela não tem como reproduzir sem uma consulta própria: quem
   * saiu da agência não vira responsável, nem estando gravado na etapa.
   *
   * **Sem cliente a resolução não acontece**, e é o caso da tela de workflows
   * pré-visualizando a cadeia: ali não há conta de quem herdar nada.
   */
  const lista = clienteId
    ? await resolvidasPelaConta(templateId, clienteId)
    : await cruasDoModelo(templateId);

  const posicaoPorOrdem = new Map(lista.map((e, indice) => [e.ordem, indice + 1]));

  return {
    // O snapshot é a cópia congelada: mudar o workflow depois não mexe em
    // nenhuma Task já criada, e este JSON é o que diz qual versão gerou estas
    // subtarefas. Com conta, ele guarda a cadeia JÁ RESOLVIDA — é essa que
    // gerou as subtarefas, e guardar a crua faria o registro descrever um
    // fluxo que não foi o aplicado.
    snapshot: {
      workflow_id: modelo.id,
      nome: modelo.nome,
      copiado_em: new Date().toISOString(),
      resolvido_para_cliente: clienteId ?? null,
      etapas: lista,
    },
    semDono: [
      ...new Set(
        lista
          .filter((etapa) => etapa.responsavel_id === null && etapa.funcao_padrao !== null)
          .map((etapa) => etapa.funcao_padrao as TeamFuncao),
      ),
    ],
    etapas: lista.map((etapa) => ({
      titulo: etapa.nome,
      prazo:
        etapa.prazo_offset_dias !== null
          ? somarDias(dataInicio, etapa.prazo_offset_dias)
          : null,
      responsavel_id: etapa.responsavel_id,
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

/** A forma que as duas leituras devolvem, para o resto não precisar saber qual foi. */
type EtapaDoModelo = {
  ordem: number;
  nome: string;
  responsavel_id: string | null;
  funcao_padrao: TeamFuncao | null;
  prioridade: WorkflowStep["prioridade"];
  prazo_offset_dias: number | null;
  requer_aprovacao: boolean;
  tipo_aprovacao: WorkflowStep["tipo_aprovacao"];
  depende_de_ordem: number | null;
};

async function resolvidasPelaConta(
  templateId: string,
  clienteId: string,
): Promise<EtapaDoModelo[]> {
  const supabase = await criarClienteServidor();

  const resolvidas = ouFalha(
    "as etapas do workflow resolvidas pela conta",
    await supabase.rpc("etapas_resolvidas_do_workflow", {
      p_template_id: templateId,
      p_client_id: clienteId,
    }),
  );

  return resolvidas;
}

async function cruasDoModelo(templateId: string): Promise<EtapaDoModelo[]> {
  const supabase = await criarClienteServidor();

  const etapas = ouFalha(
    "as etapas do workflow",
    await supabase
      .from("workflow_steps")
      .select("*")
      .eq("template_id", templateId)
      .order("ordem"),
  );

  return etapas.map((etapa) => ({
    ordem: etapa.ordem,
    nome: etapa.nome,
    responsavel_id: etapa.responsavel_padrao_id,
    funcao_padrao: etapa.funcao_padrao,
    prioridade: etapa.prioridade,
    prazo_offset_dias: etapa.prazo_offset_dias,
    requer_aprovacao: etapa.requer_aprovacao,
    tipo_aprovacao: etapa.tipo_aprovacao,
    depende_de_ordem: etapa.depende_de_ordem,
  }));
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}
