/**
 * Versao de prototipo de src/lib/dados/tasks.ts.
 *
 * Tasks ficticias cobrindo as quatro prioridades, os status do board, uma
 * vencida e uma com tres subtarefas de prazos diferentes -- que e o que a
 * visao de calendario precisa mostrar separado.
 */
import type {
  ItemDeCalendario,
  FiltrosDeTask as FiltrosReais,
  Pessoa as PessoaReal,
  TaskCompleta as TaskCompletaReal,
  TaskDaLista as TaskDaListaReal,
} from "../../src/lib/dados/tasks";

export type FiltrosDeTask = FiltrosReais;
export type Pessoa = PessoaReal;
export type TaskDaLista = TaskDaListaReal;
export type TaskCompleta = TaskCompletaReal;
export type { ItemDeCalendario };

const HOJE = new Date();
const dia = (deslocamento: number) => {
  const data = new Date(HOJE);
  data.setDate(data.getDate() + deslocamento);
  return data.toISOString().slice(0, 10);
};

const ANA: Pessoa = { id: "a0000000-0000-0000-0000-000000000001", nome: "Ana Souza", avatar_url: null };
const DIEGO: Pessoa = { id: "a0000000-0000-0000-0000-000000000002", nome: "Diego Reis", avatar_url: null };
const CARLA: Pessoa = { id: "a0000000-0000-0000-0000-000000000003", nome: "Carla Nunes", avatar_url: null };
const MARINA: Pessoa = { id: "a0000000-0000-0000-0000-000000000005", nome: "Marina Alves", avatar_url: null };

const ALFA = { id: "c0000000-0000-0000-0000-00000000000a", nome_empresa: "Cliente Alfa" };
const BETA = { id: "c0000000-0000-0000-0000-00000000000b", nome_empresa: "Cliente Beta" };

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

const BASE = {
  briefing_rico: null,
  briefing_texto: null,
  etapa_atual_id: null,
  concluida_em: null,
  tempo_real_horas: null,
  criado_por: ANA.id,
  created_at: "2026-09-10T09:00:00.000Z",
  updated_at: "2026-09-19T15:30:00.000Z",
};

const TASKS: TaskDaLista[] = [
  {
    ...BASE,
    id: "11111111-1111-1111-1111-111111111111",
    client_id: ALFA.id,
    titulo: "Carrossel de lançamento da linha de verão",
    briefing_rico: BRIEFING_RICO as unknown as TaskDaLista["briefing_rico"],
    briefing_texto: "Anunciar a nova linha de verão com foco em conversão direta.",
    prioridade: "alta",
    status: "em_andamento",
    prazo: dia(3),
    estimativa_horas: 8,
    responsavel_id: MARINA.id,
    cliente: ALFA,
    responsavel: MARINA,
    subtarefasTotal: 3,
    subtarefasConcluidas: 1,
  },
  {
    ...BASE,
    id: "22222222-2222-2222-2222-222222222222",
    client_id: BETA.id,
    titulo: "Roteiro do reels institucional",
    prioridade: "urgente",
    status: "aberta",
    prazo: dia(-2),
    estimativa_horas: 4,
    tempo_real_horas: 6,
    responsavel_id: CARLA.id,
    cliente: BETA,
    responsavel: CARLA,
    subtarefasTotal: 0,
    subtarefasConcluidas: 0,
  },
  {
    ...BASE,
    id: "33333333-3333-3333-3333-333333333333",
    client_id: ALFA.id,
    titulo: "Ajustes no post de aniversário",
    prioridade: "normal",
    status: "aguardando_aprovacao",
    prazo: dia(0),
    estimativa_horas: 2,
    responsavel_id: DIEGO.id,
    cliente: ALFA,
    responsavel: DIEGO,
    subtarefasTotal: 2,
    subtarefasConcluidas: 2,
  },
  {
    ...BASE,
    id: "44444444-4444-4444-4444-444444444444",
    client_id: BETA.id,
    titulo: "Plano de mídia do trimestre",
    prioridade: "baixa",
    status: "concluida",
    prazo: dia(-8),
    estimativa_horas: 12,
    tempo_real_horas: 10,
    concluida_em: "2026-09-16T17:20:00.000Z",
    responsavel_id: ANA.id,
    cliente: BETA,
    responsavel: ANA,
    subtarefasTotal: 0,
    subtarefasConcluidas: 0,
  },
  {
    ...BASE,
    id: "55555555-5555-5555-5555-555555555555",
    client_id: null,
    titulo: "Revisar o manual de atendimento interno",
    prioridade: "baixa",
    status: "aberta",
    prazo: dia(14),
    estimativa_horas: 3,
    responsavel_id: CARLA.id,
    cliente: null,
    responsavel: CARLA,
    subtarefasTotal: 0,
    subtarefasConcluidas: 0,
  },
  {
    ...BASE,
    id: "66666666-6666-6666-6666-666666666666",
    client_id: ALFA.id,
    titulo: "Landing page da promoção",
    prioridade: "alta",
    status: "em_andamento",
    prazo: dia(6),
    estimativa_horas: 16,
    responsavel_id: DIEGO.id,
    cliente: ALFA,
    responsavel: DIEGO,
    subtarefasTotal: 0,
    subtarefasConcluidas: 0,
  },
];

const SUBTAREFAS = [
  {
    id: "s1",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Roteiro dos 5 cartões",
    prazo: dia(1),
    responsavel_id: CARLA.id,
    estimativa_horas: 2,
    tempo_real_horas: 2,
    concluida: true,
    concluida_em: "2026-09-20T11:00:00.000Z",
    ordem: 0,
    created_at: "2026-09-10T09:05:00.000Z",
    responsavel: CARLA,
  },
  {
    id: "s2",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Arte dos cartões",
    prazo: dia(2),
    responsavel_id: MARINA.id,
    estimativa_horas: 4,
    tempo_real_horas: null,
    concluida: false,
    concluida_em: null,
    ordem: 1,
    created_at: "2026-09-10T09:06:00.000Z",
    responsavel: MARINA,
  },
  {
    id: "s3",
    task_id: "11111111-1111-1111-1111-111111111111",
    titulo: "Revisão da legenda",
    prazo: dia(3),
    responsavel_id: ANA.id,
    estimativa_horas: 1,
    tempo_real_horas: null,
    concluida: false,
    concluida_em: null,
    ordem: 2,
    created_at: "2026-09-10T09:07:00.000Z",
    responsavel: ANA,
  },
];

export async function listarTasks(filtros: FiltrosDeTask = {}): Promise<TaskDaLista[]> {
  return TASKS.filter((task) => {
    if (filtros.cliente && task.client_id !== filtros.cliente) return false;
    if (filtros.responsavel && task.responsavel_id !== filtros.responsavel) return false;
    if (filtros.prioridade && task.prioridade !== filtros.prioridade) return false;
    if (filtros.status && task.status !== filtros.status) return false;
    if (filtros.soAtrasadas) {
      const viva = task.status !== "concluida" && task.status !== "cancelada";
      if (!viva || !task.prazo || task.prazo >= dia(0)) return false;
    }
    return true;
  });
}

export async function contadoresDeTasks() {
  return { abertas: 4, atrasadas: 1, concluidasNoMes: 1 };
}

export async function obterTask(id: string): Promise<TaskCompleta | null> {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return null;

  return {
    ...task,
    autor: ANA,
    subtarefas: SUBTAREFAS.filter((s) => s.task_id === id) as TaskCompleta["subtarefas"],
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
              autor_id: ANA.id,
              texto: "@Marina o cliente pediu para evitar fundo branco nos cartões.",
              resposta_a: null,
              created_at: "2026-09-18T14:10:00.000Z",
              autor: ANA,
            },
            {
              id: "c2",
              task_id: id,
              autor_id: MARINA.id,
              texto: "Anotado. Vou testar com o degradê da marca.",
              resposta_a: "c1",
              created_at: "2026-09-18T14:25:00.000Z",
              autor: MARINA,
            },
          ] as TaskCompleta["comentarios"])
        : [],
  };
}

export async function itensDoCalendario(filtros: FiltrosDeTask = {}): Promise<ItemDeCalendario[]> {
  const tasks = await listarTasks(filtros);
  const itens: ItemDeCalendario[] = [];

  for (const task of tasks) {
    if (!task.prazo) continue;
    itens.push({
      chave: `task-${task.id}`,
      tipo: "task",
      taskId: task.id,
      titulo: task.titulo,
      prazo: task.prazo,
      prioridade: task.prioridade,
      status: task.status,
      concluida: task.status === "concluida",
      responsavel: task.responsavel,
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
      prioridade: mae.prioridade,
      status: mae.status,
      concluida: sub.concluida,
      responsavel: sub.responsavel,
      cliente: mae.cliente?.nome_empresa ?? null,
    });
  }

  return itens.sort((a, b) => a.prazo.localeCompare(b.prazo));
}

export async function urlsDosArquivos(caminhos: string[]): Promise<Record<string, string>> {
  // Sem Storage no prototipo: a lista de referencias aparece, e as imagens
  // caem no icone de arquivo em vez da miniatura.
  void caminhos;
  return {};
}
