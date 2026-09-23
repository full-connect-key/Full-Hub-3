/**
 * Versao de prototipo de src/lib/dados/tasks.ts.
 *
 * Demandas ficticias no modelo do Sprint 3B: a Task agrupa, e quem tem dono,
 * prazo, tempo e aprovacao e a SUBTAREFA. O conjunto cobre de proposito os
 * quatro casos que a tela precisa saber mostrar:
 *
 *   - etapa sem aprovacao, ja concluida;
 *   - etapa esperando aprovacao interna (a fila do desenvolvedor tem item);
 *   - etapa com aval interno esperando o envio ao cliente;
 *   - etapa bloqueada por dependencia.
 */
import { situacaoDasRodadas } from "../../src/lib/tasks/state-machine";
import type {
  ItemDeCalendario,
  FiltrosDeTask as FiltrosReais,
  Pessoa as PessoaReal,
  SubtarefaDetalhada as SubtarefaReal,
  TaskCompleta as TaskCompletaReal,
  TaskDaLista as TaskDaListaReal,
} from "../../src/lib/dados/tasks";
import type { ApprovalRound } from "../../src/lib/supabase/database.types";

export type FiltrosDeTask = FiltrosReais;
export type Pessoa = PessoaReal;
export type TaskDaLista = TaskDaListaReal;
export type TaskCompleta = TaskCompletaReal;
export type SubtarefaDetalhada = SubtarefaReal;
export type { ItemDeCalendario };

const HOJE = new Date();
const dia = (deslocamento: number) => {
  const data = new Date(HOJE);
  data.setDate(data.getDate() + deslocamento);
  return data.toISOString().slice(0, 10);
};

export const ANA: Pessoa = { id: "a0000000-0000-0000-0000-000000000001", nome: "Ana Souza", avatar_url: null };
export const DIEGO: Pessoa = { id: "a0000000-0000-0000-0000-000000000002", nome: "Diego Reis", avatar_url: null };
export const CARLA: Pessoa = { id: "a0000000-0000-0000-0000-000000000003", nome: "Carla Nunes", avatar_url: null };
export const BRUNO: Pessoa = { id: "a0000000-0000-0000-0000-000000000004", nome: "Bruno Alves", avatar_url: null };
export const MARINA: Pessoa = { id: "a0000000-0000-0000-0000-000000000005", nome: "Marina Costa", avatar_url: null };

const ALFA = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Mundo Verde" };
const BETA = { id: "c0000000-0000-0000-0000-00000000000b", nome_empresa: "Óptica Visão" };

const BRIEFING_RICO = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Objetivo" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Anunciar a " },
        { type: "text", marks: [{ type: "bold" }], text: "nova linha de verão" },
        { type: "text", text: " com foco em " },
        {
          type: "text",
          marks: [{ type: "textStyle", attrs: { color: "#dc2626" } }],
          text: "conversão direta",
        },
        { type: "text", text: "." },
      ],
    },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Entregáveis" }] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Carrossel de 5 cartões" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Story com enquete" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Legenda com CTA" }] }] },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "O cliente pediu para evitar fundo branco." }],
        },
      ],
    },
  ],
};

// --- subtarefas -------------------------------------------------------------

type Semente = {
  id: string;
  task_id: string;
  titulo: string;
  ordem: number;
  prazo: string | null;
  responsavel: Pessoa | null;
  status: SubtarefaDetalhada["status"];
  requer_aprovacao: boolean;
  tipo_aprovacao: SubtarefaDetalhada["tipo_aprovacao"];
  estimativa_minutos: number | null;
  tempo_real_minutos: number | null;
  dependeDe?: string;
  rodadas?: { numero: number; escopo: "interna" | "cliente"; status: ApprovalRound["status"]; comentario?: string }[];
};

const SEMENTES: Semente[] = [
  // Campanha de Instagram — o caso completo
  {
    id: "s1",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Criar conceito",
    ordem: 1,
    prazo: dia(-1),
    responsavel: MARINA,
    status: "concluida",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 120,
    tempo_real_minutos: 150,
  },
  {
    id: "s2",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Criar KV",
    ordem: 2,
    prazo: dia(1),
    responsavel: BRUNO,
    status: "enviada_aprovacao",
    requer_aprovacao: true,
    tipo_aprovacao: "cliente",
    estimativa_minutos: 240,
    tempo_real_minutos: null,
    dependeDe: "s1",
    rodadas: [
      { numero: 1, escopo: "interna", status: "ajustes_solicitados", comentario: "Trocar a cor do fundo para o azul da marca." },
      { numero: 2, escopo: "interna", status: "pendente" },
    ],
  },
  {
    id: "s3",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Adaptar formatos",
    ordem: 3,
    prazo: dia(4),
    responsavel: MARINA,
    status: "nao_iniciada",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 90,
    tempo_real_minutos: null,
    dependeDe: "s2",
  },
  // Reels institucional — etapa com aval interno esperando o envio ao cliente
  {
    id: "s4",
    task_id: "22222222-2222-2222-2222-222222222222",
    titulo: "Roteiro do reels",
    ordem: 1,
    prazo: dia(-2),
    responsavel: CARLA,
    status: "enviada_aprovacao",
    requer_aprovacao: true,
    tipo_aprovacao: "cliente",
    estimativa_minutos: 180,
    tempo_real_minutos: 210,
    rodadas: [{ numero: 1, escopo: "interna", status: "aprovada" }],
  },
  {
    id: "s5",
    task_id: "22222222-2222-2222-2222-222222222222",
    titulo: "Gravação",
    ordem: 2,
    prazo: dia(5),
    responsavel: BRUNO,
    status: "nao_iniciada",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 300,
    tempo_real_minutos: null,
    dependeDe: "s4",
  },
  // Landing page — aprovação interna pendente, do próprio desenvolvedor
  {
    id: "s6",
    task_id: "66666666-6666-6666-6666-666666666666",
    titulo: "Desenvolver landing",
    ordem: 1,
    prazo: dia(6),
    responsavel: DIEGO,
    status: "enviada_aprovacao",
    requer_aprovacao: true,
    tipo_aprovacao: "interna",
    estimativa_minutos: 960,
    tempo_real_minutos: null,
    rodadas: [{ numero: 1, escopo: "interna", status: "pendente" }],
  },
  // Plano de mídia — tudo concluído
  {
    id: "s7",
    task_id: "44444444-4444-4444-4444-444444444444",
    titulo: "Levantamento de verbas",
    ordem: 1,
    prazo: dia(-9),
    responsavel: ANA,
    status: "concluida",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 480,
    tempo_real_minutos: 600,
  },
  // Manual interno — etapa simples, sem aprovação: mostra "Concluir"
  {
    id: "s8",
    task_id: "55555555-5555-5555-5555-555555555555",
    titulo: "Revisar o texto do manual",
    ordem: 1,
    prazo: dia(0),
    responsavel: ANA,
    status: "em_andamento",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 180,
    tempo_real_minutos: null,
  },
  // Vitrine — as duas etapas que dao a cada perfil um botao diferente
  {
    id: "s9",
    task_id: "77777777-7777-7777-7777-777777777777",
    titulo: "Arte da vitrine",
    ordem: 1,
    prazo: dia(2),
    responsavel: MARINA,
    status: "em_andamento",
    requer_aprovacao: true,
    tipo_aprovacao: "interna",
    estimativa_minutos: 240,
    tempo_real_minutos: null,
  },
  {
    id: "s10",
    task_id: "77777777-7777-7777-7777-777777777777",
    titulo: "Impressão",
    ordem: 2,
    prazo: dia(0),
    responsavel: CARLA,
    status: "em_andamento",
    requer_aprovacao: false,
    tipo_aprovacao: null,
    estimativa_minutos: 60,
    tempo_real_minutos: null,
  },
];

function montarSubtarefa(semente: Semente): SubtarefaDetalhada {
  const rodadas = (semente.rodadas ?? []).map((r, indice) => ({
    id: `${semente.id}-r${indice}`,
    subtask_id: semente.id,
    numero_rodada: r.numero,
    escopo: r.escopo,
    status: r.status,
    solicitado_por: semente.responsavel?.id ?? ANA.id,
    solicitado_em: "2026-09-19T10:00:00.000Z",
    decidido_por: r.status === "pendente" ? null : DIEGO.id,
    decidido_em: r.status === "pendente" ? null : "2026-09-19T16:00:00.000Z",
    comentario: r.comentario ?? null,
    created_at: "2026-09-19T10:00:00.000Z",
  }));

  const dependencia = semente.dependeDe
    ? SEMENTES.find((s) => s.id === semente.dependeDe)
    : undefined;

  const dependeDe = dependencia
    ? [{ id: dependencia.id, titulo: dependencia.titulo, status: dependencia.status }]
    : [];

  return {
    id: semente.id,
    task_id: semente.task_id,
    titulo: semente.titulo,
    descricao_rica: null,
    descricao_texto: null,
    prazo: semente.prazo,
    responsavel_id: semente.responsavel?.id ?? null,
    prioridade: "normal",
    status: semente.status,
    requer_aprovacao: semente.requer_aprovacao,
    tipo_aprovacao: semente.tipo_aprovacao,
    estimativa_minutos: semente.estimativa_minutos,
    tempo_real_minutos: semente.tempo_real_minutos,
    ordem: semente.ordem,
    iniciada_em: null,
    concluida_em: semente.status === "concluida" ? "2026-09-20T11:00:00.000Z" : null,
    // O cronometro. Fixo, porque a imagem do prototipo precisa sair igual a
    // cada rodada -- um relogio correndo daria um PNG diferente por captura.
    // A etapa em andamento comeca 47 minutos atras para o selo aparecer
    // rodando; as outras mostram so o acumulado.
    andando_desde:
      semente.status === "em_andamento" ? new Date(Date.now() - 47 * 60 * 1000).toISOString() : null,
    tempo_medido_segundos: semente.status === "nao_iniciada" ? 0 : 95 * 60,
    created_at: "2026-09-10T09:05:00.000Z",
    updated_at: "2026-09-19T15:30:00.000Z",
    responsavel: semente.responsavel,
    dependeDe,
    dependenciasAbertas: dependeDe.filter((d) => d.status !== "concluida").map((d) => d.titulo),
    rodadas: rodadas.map((r) => ({
      ...r,
      solicitante: semente.responsavel,
      decisor: r.decidido_por ? DIEGO : null,
    })),
    entregas:
      semente.rodadas && semente.rodadas.length > 0
        ? [
            {
              id: `${semente.id}-e1`,
              subtask_id: semente.id,
              approval_round_id: rodadas[rodadas.length - 1]?.id ?? null,
              tipo: "link" as const,
              url: "https://www.figma.com/file/exemplo",
              nome: `${semente.titulo} v${rodadas.length}`,
              enviado_por: semente.responsavel?.id ?? ANA.id,
              created_at: "2026-09-19T09:50:00.000Z",
              autor: semente.responsavel,
            },
          ]
        : [],
    ...situacaoDasRodadas(rodadas, semente.tipo_aprovacao),
  };
}

export const SUBTAREFAS: SubtarefaDetalhada[] = SEMENTES.map(montarSubtarefa);

// --- tasks ------------------------------------------------------------------

const BASE = {
  briefing_rico: null,
  briefing_texto: null,
  status_manual: false,
  // A exigencia de aprovacao e o link de entrega vem do Sprint 9. O padrao e
  // "nenhuma", que e o mesmo do banco: demanda que nao exige aval encerra
  // quando o Atendimento disser.
  exigencia_aprovacao: "nenhuma" as const,
  link_entrega: null,
  task_type_id: null,
  workflow_snapshot: null,
  concluida_em: null,
  criado_por: CARLA.id,
  created_at: "2026-09-10T09:00:00.000Z",
  updated_at: "2026-09-19T15:30:00.000Z",
};

type SementeDeTask = {
  id: string;
  client_id: string;
  cliente: { id: string; nome_empresa: string };
  titulo: string;
  prioridade: TaskDaLista["prioridade"];
  status: TaskDaLista["status"];
  data_inicio: string;
  data_fim: string | null;
  briefing_rico?: unknown;
  briefing_texto?: string | null;
  concluida_em?: string | null;
};

const SEMENTES_DE_TASK: SementeDeTask[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    client_id: ALFA.id,
    cliente: ALFA,
    titulo: "Campanha de Instagram — linha de verão",
    prioridade: "alta",
    status: "em_aprovacao",
    data_inicio: dia(-6),
    data_fim: dia(8),
    briefing_rico: BRIEFING_RICO,
    briefing_texto: "Anunciar a nova linha de verão com foco em conversão direta.",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    client_id: BETA.id,
    cliente: BETA,
    titulo: "Reels institucional",
    prioridade: "urgente",
    status: "em_aprovacao",
    data_inicio: dia(-10),
    data_fim: dia(5),
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    client_id: BETA.id,
    cliente: BETA,
    titulo: "Plano de mídia do trimestre",
    prioridade: "baixa",
    status: "concluido",
    data_inicio: dia(-30),
    data_fim: dia(-8),
    concluida_em: "2026-09-16T17:20:00.000Z",
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    client_id: ALFA.id,
    cliente: ALFA,
    titulo: "Revisar o manual de atendimento",
    prioridade: "baixa",
    status: "em_andamento",
    data_inicio: dia(-2),
    data_fim: dia(20),
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    client_id: ALFA.id,
    cliente: ALFA,
    titulo: "Landing page da promoção",
    prioridade: "alta",
    status: "em_aprovacao",
    data_inicio: dia(-4),
    data_fim: dia(10),
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    client_id: BETA.id,
    cliente: BETA,
    titulo: "Vitrine de outubro",
    prioridade: "normal",
    status: "entregue",
    data_inicio: dia(-14),
    data_fim: dia(-1),
  },
];

function montarTask(semente: SementeDeTask): TaskDaLista {
  const minhas = SUBTAREFAS.filter((s) => s.task_id === semente.id);
  const equipe: Pessoa[] = [];
  for (const sub of minhas) {
    if (sub.responsavel && !equipe.some((p) => p.id === sub.responsavel!.id)) {
      equipe.push(sub.responsavel);
    }
  }

  const emAberto = minhas.filter((s) => s.status !== "concluida" && s.prazo).map((s) => s.prazo!);
  const estimativa = minhas.reduce((total, s) => total + (s.estimativa_minutos ?? 0), 0);
  const real = minhas.reduce((total, s) => total + (s.tempo_real_minutos ?? 0), 0);

  return {
    ...BASE,
    id: semente.id,
    client_id: semente.client_id,
    titulo: semente.titulo,
    briefing_rico: (semente.briefing_rico ?? null) as TaskDaLista["briefing_rico"],
    briefing_texto: semente.briefing_texto ?? null,
    prioridade: semente.prioridade,
    status: semente.status,
    data_inicio: semente.data_inicio,
    data_fim: semente.data_fim,
    concluida_em: semente.concluida_em ?? null,
    cliente: semente.cliente,
    equipe,
    subtarefasTotal: minhas.length,
    subtarefasConcluidas: minhas.filter((s) => s.status === "concluida").length,
    estimativaMinutos: estimativa > 0 ? estimativa : null,
    tempoRealMinutos: real > 0 ? real : null,
    proximoPrazo: emAberto.sort()[0] ?? null,
    aprovacaoPendenteEm:
      minhas.find((s) => s.rodadas.some((r) => r.status === "pendente"))?.titulo ?? null,
    temSubtarefaEmAjustes: minhas.some((s) => s.status === "em_ajustes"),
  };
}

export const TASKS: TaskDaLista[] = SEMENTES_DE_TASK.map(montarTask);

export async function enriquecer(): Promise<TaskDaLista[]> {
  return TASKS;
}

export async function listarTasks(filtros: FiltrosDeTask = {}): Promise<TaskDaLista[]> {
  return TASKS.filter((task) => {
    if (filtros.cliente && task.client_id !== filtros.cliente) return false;
    if (filtros.prioridade && task.prioridade !== filtros.prioridade) return false;
    if (filtros.status && task.status !== filtros.status) return false;
    if (filtros.responsavel) {
      const minhas = SUBTAREFAS.filter(
        (s) => s.task_id === task.id && s.responsavel_id === filtros.responsavel,
      );
      if (minhas.length === 0) return false;
    }
    if (filtros.soAtrasadas) {
      const viva = task.status !== "concluido" && task.status !== "cancelada";
      if (!viva || !task.proximoPrazo || task.proximoPrazo >= dia(0)) return false;
    }
    return true;
  });
}

export async function contadoresDeTasks() {
  return { abertas: 5, atrasadas: 2, concluidasNoMes: 1 };
}

export async function obterTask(id: string): Promise<TaskCompleta | null> {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return null;

  return {
    ...task,
    autor: CARLA,
    tipo: null,
    subtarefas: SUBTAREFAS.filter((s) => s.task_id === id),
    historico: [
      {
        id: "h1",
        task_id: id,
        subtask_id: null,
        approval_round_id: null,
        acao: "task_criada",
        de_valor: null,
        para_valor: task.titulo,
        autor_id: CARLA.id,
        detalhes: null,
        created_at: "2026-09-10T09:00:00.000Z",
        autor: CARLA,
      },
      {
        id: "h2",
        task_id: id,
        subtask_id: null,
        approval_round_id: null,
        acao: "enviada_para_aprovacao",
        de_valor: null,
        para_valor: "Rodada 1",
        autor_id: BRUNO.id,
        detalhes: null,
        created_at: "2026-09-19T10:00:00.000Z",
        autor: BRUNO,
      },
    ] as TaskCompleta["historico"],
    referencias:
      id === "11111111-1111-1111-1111-111111111111"
        ? ([
            {
              id: "r1",
              task_id: id,
              tipo: "link",
              url: "https://www.figma.com/file/exemplo",
              titulo: "Figma da campanha",
              arquivo_nome: null,
              adicionado_por: ANA.id,
              created_at: "2026-09-10T10:00:00.000Z",
            },
            {
              id: "r2",
              task_id: id,
              tipo: "arquivo",
              url: `${id}/moodboard.pdf`,
              titulo: "moodboard.pdf",
              arquivo_nome: "moodboard.pdf",
              adicionado_por: ANA.id,
              created_at: "2026-09-10T10:02:00.000Z",
            },
          ] as TaskCompleta["referencias"])
        : [],
    comentarios:
      id === "11111111-1111-1111-1111-111111111111"
        ? ([
            {
              id: "c1",
              task_id: id,
              subtask_id: null,
              approval_round_id: null,
              autor_id: ANA.id,
              texto: "@Bruno o cliente pediu para evitar fundo branco nos cartões.",
              interno: true,
              resposta_a: null,
              created_at: "2026-09-18T14:10:00.000Z",
              autor: ANA,
            },
            {
              id: "c2",
              task_id: id,
              subtask_id: null,
              approval_round_id: null,
              autor_id: BRUNO.id,
              texto: "Anotado. Vou testar com o degradê da marca.",
              interno: true,
              resposta_a: "c1",
              created_at: "2026-09-18T14:25:00.000Z",
              autor: BRUNO,
            },
          ] as TaskCompleta["comentarios"])
        : [],
  };
}

export async function itensDoCalendario(filtros: FiltrosDeTask = {}): Promise<ItemDeCalendario[]> {
  const tasks = await listarTasks(filtros);
  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    if (!task.data_fim) continue;
    itens.push({
      chave: `task-${task.id}`,
      tipo: "task",
      taskId: task.id,
      titulo: task.titulo,
      prazo: task.data_fim,
      prioridade: task.prioridade,
      status: task.status,
      concluida: task.status === "concluido",
      responsavel: null,
      cliente: task.cliente?.nome_empresa ?? null,
    });
  }

  for (const sub of SUBTAREFAS) {
    const mae = tasks.find((t) => t.id === sub.task_id);
    if (!mae || !sub.prazo) continue;
    if (filtros.responsavel && sub.responsavel_id !== filtros.responsavel) continue;
    itens.push({
      chave: `subtarefa-${sub.id}`,
      tipo: "subtarefa",
      taskId: sub.task_id,
      titulo: sub.titulo,
      prazo: sub.prazo,
      prioridade: sub.prioridade,
      status: mae.status,
      concluida: sub.status === "concluida",
      responsavel: sub.responsavel,
      cliente: mae.cliente?.nome_empresa ?? null,
    });
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export async function urlsDosArquivos(caminhos: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  for (const caminho of caminhos) mapa[caminho] = "#";
  return mapa;
}
