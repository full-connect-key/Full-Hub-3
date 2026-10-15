/**
 * Versao de prototipo de src/lib/dados/workflows.ts.
 *
 * Dois tipos de tarefa com fluxo, para a tela mostrar a cadeia de etapas e o
 * caso do tipo que vale so para um cliente.
 */
import type {
  EtapaAplicada,
  FluxoAplicado,
  TipoComFluxo as TipoComFluxoReal,
  WorkflowDaAgencia as TipoReal,
} from "../../src/lib/dados/workflows";

export type WorkflowDaAgencia = TipoReal;
export type { EtapaAplicada, FluxoAplicado };
export type TipoComFluxo = TipoComFluxoReal;

const ALFA = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };

/** So o par (modelo, etapas): a tela unificada nao mostra mais o fluxo solto. */
type FluxoDeExemplo = {
  id: string;
  nome: string;
  descricao: string | null;
  client_id: string | null;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  cliente: { id: string; nome_empresa: string } | null;
  etapas: TipoComFluxo["etapas"];
};

const POST = "w0000000-0000-0000-0000-000000000001";
const ENXOVAL = "t0108000-0000-4000-8000-000000000001";
const LANDING = "w0000000-0000-0000-0000-000000000002";

const FLUXOS: FluxoDeExemplo[] = [
  {
    id: POST,
    nome: "Post de feed",
    descricao: "Pauta, conteúdo, arte e agendamento de um post de feed.",
    client_id: null,
    ativo: true,
    criado_por: null,
    created_at: "2026-09-01T10:00:00.000Z",
    cliente: null,
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
    etapas: [
      etapa(LANDING, "e5", "Texto", 1, "Redator", 3, true, "interna", null),
      etapa(LANDING, "e6", "Layout", 2, "Design", 7, true, "cliente", 1),
      etapa(LANDING, "e7", "Desenvolvimento", 3, "Desenvolvimento", 14, true, "interna", 2),
      etapa(LANDING, "e8", "Publicação", 4, "Desenvolvimento", 16, false, null, 3),
    ],
  },
  {
    id: ENXOVAL,
    nome: "Campanha com enxoval",
    descricao:
      "A estrutura de uma campanha: KV, o enxoval de peças e o tabloide. É o workflow de DOIS NÍVEIS, que a tela de abrir campanha oferece.",
    client_id: null,
    ativo: true,
    criado_por: null,
    created_at: "2026-09-10T10:00:00.000Z",
    cliente: null,
    // A ARVORE DE DOIS NIVEIS (migration 0108), e ela existe no stub por duas
    // razoes: o editor de workflow precisa de um exemplo COM sub-etapa para a
    // imagem provar o recuo e a numeracao "2.1", e a tela de abrir campanha
    // precisa de um workflow que valha escolher -- um de cadeia reta viraria
    // uma lista de entregaveis sem grupo, que e o que o modelo de campanha ja
    // fazia.
    etapas: [
      etapa(ENXOVAL, "e9", "KV", 10, "Design", 3, true, "cliente", null),
      // A MAE NAO PEDE AVAL E NAO ESPERA NINGUEM, e nao e escolha de exemplo:
      // a 0108 recusa as duas coisas numa etapa com filha, porque
      // `subtasks_agrupadora` (0022) recusaria na hora de aplicar.
      etapa(ENXOVAL, "e10", "Enxoval", 20, "Design", 10, false, null, null),
      etapa(ENXOVAL, "e11", "Lâmina A5", 21, "Design", 8, true, "interna", null, 20),
      etapa(ENXOVAL, "e12", "Banner A5", 22, "Design", 9, true, "interna", null, 20),
      etapa(ENXOVAL, "e13", "Tabloide", 30, "Design", 12, true, "cliente", null),
    ],
  },
];

function etapa(
  template: string,
  id: string,
  nome: string,
  ordem: number,
  funcao: TipoComFluxo["etapas"][number]["funcao_padrao"],
  offset: number,
  aprovacao: boolean,
  tipo: TipoComFluxo["etapas"][number]["tipo_aprovacao"],
  depende: number | null,
  pai?: number | null,
): TipoComFluxo["etapas"][number] {
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
    // O PAI (0108) entra com default: so o exemplo que mostra a arvore o
    // passa, e as outras oito etapas continuam de topo sem mudar de linha.
    parent_ordem: pai ?? null,
    created_at: "2026-09-01T10:00:00.000Z",
    responsavelPadrao: null,
  };
}

export const TIPOS: WorkflowDaAgencia[] = [
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
  // O WORKFLOW DE DOIS NIVEIS (0108): e ele que a tela de abrir campanha
  // oferece em "Partir de um modelo", ao lado dos modelos de campanha.
  {
    id: "t0108000-0000-4000-8000-000000000011",
    nome: "Campanha com enxoval",
    descricao: "KV, o enxoval de pecas e o tabloide. Dois niveis.",
    client_id: null,
    workflow_template_id: ENXOVAL,
    ativo: true,
    created_at: "2026-09-10T10:00:00.000Z",
    cliente: null,
    workflow: { id: ENXOVAL, nome: "Campanha com enxoval", etapas: 5 },
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

export async function listarWorkflows(clienteId?: string | null): Promise<WorkflowDaAgencia[]> {
  if (!clienteId) return TIPOS;
  return TIPOS.filter((t) => t.client_id === null || t.client_id === clienteId);
}

export async function listarTiposComFluxo(): Promise<TipoComFluxo[]> {
  return TIPOS.map((tipo, i) => ({
    ...tipo,
    etapas: FLUXOS.find((f) => f.id === tipo.workflow_template_id)?.etapas ?? [],
    // Um usado e um nao usado, para a confirmacao de apagar aparecer nas
    // duas formas na imagem do prototipo.
    demandas: i === 0 ? 7 : 0,
  }));
}

export async function fluxoDoWorkflow(
  tipoId: string,
  dataInicio: string,
  clienteId?: string | null,
): Promise<FluxoAplicado | null> {
  const tipo = TIPOS.find((t) => t.id === tipoId);
  if (!tipo?.workflow_template_id) return null;
  return etapasDoWorkflow(tipo.workflow_template_id, dataInicio, clienteId);
}

/**
 * O PADRAO DA CONTA aparece no prototipo (0064), e a etapa de Redator e a que
 * fica sem dono: e ela que faz a frase "esta conta nao tem ninguem em Redator"
 * sair na imagem, que e onde se confere que o aviso nomeia a funcao em vez de
 * dizer "alguma".
 */
const RESPONSAVEL_POR_FUNCAO: Record<string, string> = {
  "Social Media": "5555-marina",
  Design: "4444-bruno",
};

export async function etapasDoWorkflow(
  templateId: string,
  dataInicio: string,
  clienteId?: string | null,
): Promise<FluxoAplicado | null> {
  const modelo = FLUXOS.find((w) => w.id === templateId);
  if (!modelo) return null;

  // A dependencia e gravada pela ORDEM dentro do modelo; o formulario pensa em
  // posicao na lista. O mapa traduz uma na outra, como a versao real faz.
  const posicaoPorOrdem = new Map(modelo.etapas.map((e, indice) => [e.ordem, indice + 1]));

  const daConta = (funcao: string | null): string | null =>
    clienteId && funcao ? (RESPONSAVEL_POR_FUNCAO[funcao] ?? null) : null;

  return {
    snapshot: { workflow_id: modelo.id, nome: modelo.nome, etapas: modelo.etapas },
    semDono: [
      ...new Set(
        modelo.etapas
          .filter((e) => e.funcao_padrao !== null && daConta(e.funcao_padrao) === null)
          .map((e) => e.funcao_padrao!),
      ),
    ],
    etapas: modelo.etapas.map((etapa) => ({
      titulo: etapa.nome,
      prazo:
        etapa.prazo_offset_dias === null ? null : somarDias(dataInicio, etapa.prazo_offset_dias),
      responsavel_id: daConta(etapa.funcao_padrao),
      funcao_padrao: etapa.funcao_padrao,
      prioridade: etapa.prioridade,
      requer_aprovacao: etapa.requer_aprovacao,
      tipo_aprovacao: etapa.tipo_aprovacao,
      parent_de:
        etapa.parent_ordem === null
          ? null
          : (posicaoPorOrdem.get(etapa.parent_ordem) ?? null),
      depende_de:
        etapa.depende_de_ordem === null
          ? null
          : (posicaoPorOrdem.get(etapa.depende_de_ordem) ?? null),
    })),
  };
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}
