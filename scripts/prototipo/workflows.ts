/**
 * Versao de prototipo de src/lib/dados/workflows.ts.
 *
 * Dois tipos de tarefa com fluxo, para a tela mostrar a cadeia de etapas e o
 * caso do tipo que vale so para um cliente.
 */
import type {
  EtapaAplicada,
  TipoDeTarefa as TipoReal,
  WorkflowCompleto as WorkflowReal,
} from "../../src/lib/dados/workflows";

export type TipoDeTarefa = TipoReal;
export type { EtapaAplicada };
export type WorkflowCompleto = WorkflowReal;

const ALFA = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };

const POST = "w0000000-0000-0000-0000-000000000001";
const LANDING = "w0000000-0000-0000-0000-000000000002";

export const WORKFLOWS: WorkflowCompleto[] = [
  {
    id: POST,
    nome: "Post de feed",
    descricao: "Pauta, conteúdo, arte e agendamento de um post de feed.",
    client_id: null,
    ativo: true,
    criado_por: null,
    created_at: "2026-09-01T10:00:00.000Z",
    cliente: null,
    tiposQueUsam: 1,
    etapas: [
      etapa(POST, "e1", "Pauta", 1, "Social Media", 1, true, "interna", null),
      etapa(POST, "e2", "Conteúdo", 2, "Redator", 3, false, null, 1),
      etapa(POST, "e3", "Arte", 3, "Design", 5, true, "cliente", 2),
      etapa(POST, "e4", "Agendamento", 4, "Social Media", 7, false, null, 3),
    ],
  },
  {
    id: LANDING,
    nome: "Landing page — Mundo Verde",
    descricao: "Variação do fluxo global para a conta.",
    client_id: ALFA.id,
    ativo: true,
    criado_por: null,
    created_at: "2026-09-05T10:00:00.000Z",
    cliente: ALFA,
    tiposQueUsam: 1,
    etapas: [
      etapa(LANDING, "e5", "Texto", 1, "Redator", 3, true, "interna", null),
      etapa(LANDING, "e6", "Layout", 2, "Design", 7, true, "cliente", 1),
      etapa(LANDING, "e7", "Desenvolvimento", 3, "Desenvolvimento", 14, true, "interna", 2),
      etapa(LANDING, "e8", "Publicação", 4, "Desenvolvimento", 16, false, null, 3),
    ],
  },
];

function etapa(
  template: string,
  id: string,
  nome: string,
  ordem: number,
  funcao: WorkflowCompleto["etapas"][number]["funcao_padrao"],
  offset: number,
  aprovacao: boolean,
  tipo: WorkflowCompleto["etapas"][number]["tipo_aprovacao"],
  depende: number | null,
): WorkflowCompleto["etapas"][number] {
  return {
    id,
    template_id: template,
    nome,
    ordem,
    responsavel_padrao_id: null,
    funcao_padrao: funcao,
    prioridade: "normal",
    prazo_offset_dias: offset,
    requer_aprovacao: aprovacao,
    tipo_aprovacao: tipo,
    depende_de_ordem: depende,
    created_at: "2026-09-01T10:00:00.000Z",
    responsavelPadrao: null,
  };
}

export const TIPOS: TipoDeTarefa[] = [
  {
    id: "t0000000-0000-0000-0000-000000000001",
    nome: "Post de feed",
    descricao: "Publicação única no feed.",
    client_id: null,
    workflow_template_id: POST,
    ativo: true,
    created_at: "2026-09-01T10:00:00.000Z",
    cliente: null,
    workflow: { id: POST, nome: "Post de feed", etapas: 4 },
  },
  {
    id: "t0000000-0000-0000-0000-000000000002",
    nome: "Landing page",
    descricao: "Página de destino de campanha.",
    client_id: ALFA.id,
    workflow_template_id: LANDING,
    ativo: true,
    created_at: "2026-09-05T10:00:00.000Z",
    cliente: ALFA,
    workflow: { id: LANDING, nome: "Landing page — Mundo Verde", etapas: 4 },
  },
  {
    id: "t0000000-0000-0000-0000-000000000003",
    nome: "Reels",
    descricao: "Vídeo curto para redes sociais.",
    client_id: null,
    workflow_template_id: null,
    ativo: true,
    created_at: "2026-09-01T10:00:00.000Z",
    cliente: null,
    workflow: null,
  },
];

export async function listarTiposDeTarefa(clienteId?: string | null): Promise<TipoDeTarefa[]> {
  if (!clienteId) return TIPOS;
  return TIPOS.filter((t) => t.client_id === null || t.client_id === clienteId);
}

export async function listarWorkflows(): Promise<WorkflowCompleto[]> {
  return WORKFLOWS;
}

export async function etapasDoWorkflow(
  templateId: string,
  dataInicio: string,
): Promise<{ etapas: EtapaAplicada[]; snapshot: unknown } | null> {
  const modelo = WORKFLOWS.find((w) => w.id === templateId);
  if (!modelo) return null;

  return {
    snapshot: { workflow_id: modelo.id, nome: modelo.nome, etapas: modelo.etapas },
    etapas: modelo.etapas.map((etapa, indice) => ({
      titulo: etapa.nome,
      prazo:
        etapa.prazo_offset_dias === null ? null : somarDias(dataInicio, etapa.prazo_offset_dias),
      responsavel_id: null,
      funcao_padrao: etapa.funcao_padrao,
      prioridade: etapa.prioridade,
      requer_aprovacao: etapa.requer_aprovacao,
      tipo_aprovacao: etapa.tipo_aprovacao,
      depende_de: etapa.depende_de_ordem === null ? null : indice,
    })),
  };
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
