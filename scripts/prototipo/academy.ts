/**
 * Versao de prototipo de src/lib/dados/academy.ts.
 *
 * Tres trilhas, e as tres existem para mostrar coisa diferente:
 *
 *   "Onboarding da casa"  -- obrigatoria, comecada pela metade. E o estado em
 *                            que a barra de progresso significa alguma coisa.
 *   "Escrita para redes"  -- ligada a uma skill que a pessoa quer desenvolver,
 *                            entao ela aparece em "Recomendadas para voce".
 *   "Midia paga do zero"  -- RASCUNHO. So aparece porque o prototipo roda como
 *                            gestao; no app, a RLS a esconde da equipe.
 *
 * Uma grade onde tudo esta zerado ou tudo concluido nao valida nada: os dois
 * extremos escondem justamente o que a tela serve para mostrar.
 */
import type {
  LinhaDoAcompanhamento,
  MaterialComProgresso,
  TrilhaCompleta,
  TrilhaDaGrade,
} from "../../src/lib/dados/academy";

export type { LinhaDoAcompanhamento, MaterialComProgresso, TrilhaCompleta, TrilhaDaGrade };

const AGORA = "2026-09-20T10:00:00.000Z";

type SementeDeMaterial = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: MaterialComProgresso["tipo"];
  url: string | null;
  duracao: number | null;
  concluido: boolean;
  anotacoes?: string;
  skillNome?: string;
};

const MATERIAIS: Record<string, SementeDeMaterial[]> = {
  t1: [
    {
      id: "m1",
      titulo: "Boas-vindas da Ana",
      descricao: "O que a Full Connect Key faz e para quem.",
      tipo: "video",
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      duracao: 12,
      concluido: true,
      anotacoes: "Rever a parte de quem aprova o quê.",
    },
    {
      id: "m2",
      titulo: "O caminho de uma demanda",
      descricao: "Da abertura da task à entrega aprovada.",
      tipo: "artigo",
      url: "https://exemplo.invalid/fluxo-da-demanda",
      duracao: 20,
      concluido: false,
    },
    {
      id: "m3",
      titulo: "Modelo de briefing",
      descricao: "O que todo briefing precisa responder.",
      tipo: "template",
      url: null,
      duracao: null,
      concluido: false,
    },
  ],
  t2: [
    {
      id: "m4",
      titulo: "Copy que para o dedo",
      descricao: "Os três primeiros segundos de uma legenda.",
      tipo: "video",
      url: "https://vimeo.com/76979871",
      duracao: 18,
      concluido: false,
      skillNome: "Copywriting",
    },
    {
      id: "m5",
      titulo: "Guia de tom de voz",
      descricao: "Como cada cliente fala, e como não falar por ele.",
      tipo: "pdf",
      url: null,
      duracao: 25,
      concluido: false,
      skillNome: "Copywriting",
    },
  ],
  t3: [
    {
      id: "m6",
      titulo: "Estrutura de campanha",
      descricao: null,
      tipo: "artigo",
      url: "https://exemplo.invalid/midia",
      duracao: 30,
      concluido: false,
    },
  ],
};

type SementeDeTrilha = {
  id: string;
  titulo: string;
  descricao: string;
  area: string;
  obrigatoria: boolean;
  publicada: boolean;
};

const TRILHAS: SementeDeTrilha[] = [
  {
    id: "t1",
    titulo: "Onboarding da casa",
    descricao:
      "Como a agência trabalha: o fluxo de uma demanda, quem aprova o quê, e onde cada coisa mora.",
    area: "Processos",
    obrigatoria: true,
    publicada: true,
  },
  {
    id: "t2",
    titulo: "Escrita para redes",
    descricao: "Copy que funciona em feed, em story e em legenda.",
    area: "Conteúdo",
    obrigatoria: false,
    publicada: true,
  },
  {
    id: "t3",
    titulo: "Mídia paga do zero",
    descricao: "Em produção. Só a gestão vê esta enquanto não for publicada.",
    area: "Mídia",
    obrigatoria: false,
    publicada: false,
  },
];

function materiaisDe(trilhaId: string): MaterialComProgresso[] {
  return (MATERIAIS[trilhaId] ?? []).map((m, indice) => ({
    id: m.id,
    track_id: trilhaId,
    titulo: m.titulo,
    descricao: m.descricao,
    tipo: m.tipo,
    url: m.url,
    arquivo_url: null,
    duracao_minutos: m.duracao,
    ordem: indice + 1,
    skill_id: m.skillNome ? "sk4" : null,
    created_at: AGORA,
    concluido: m.concluido,
    concluidoEm: m.concluido ? AGORA : null,
    anotacoes: m.anotacoes ?? null,
    skillNome: m.skillNome ?? null,
  }));
}

function montar(semente: SementeDeTrilha): TrilhaDaGrade {
  const materiais = materiaisDe(semente.id);
  const concluidos = materiais.filter((m) => m.concluido).length;
  const duracoes = materiais
    .map((m) => m.duracao_minutos)
    .filter((d): d is number => typeof d === "number");

  return {
    id: semente.id,
    titulo: semente.titulo,
    descricao: semente.descricao,
    area: semente.area,
    capa_url: null,
    obrigatoria: semente.obrigatoria,
    publicada: semente.publicada,
    ordem: 0,
    criado_por: "a0000000-0000-0000-0000-000000000002",
    created_at: AGORA,
    quantosMateriais: materiais.length,
    quantosConcluidos: concluidos,
    duracaoMinutos: duracoes.length > 0 ? duracoes.reduce((t, d) => t + d, 0) : null,
    situacao:
      materiais.length > 0 && concluidos >= materiais.length
        ? "concluida"
        : concluidos > 0
          ? "em_andamento"
          : "nao_iniciada",
    percentual:
      materiais.length > 0 ? Math.round((concluidos / materiais.length) * 100) : 0,
  };
}

/**
 * O rascunho so volta para a gestao -- e AQUI isso e imitacao, nao regra.
 *
 * No app, `listarTrilhas` nao filtra por `publicada`: quem esconde a trilha
 * em rascunho e a policy `academy_tracks_select`, e e ela que vale. O
 * prototipo nao tem Supabase atras, entao sem esta linha o cartao "Midia
 * paga do zero" aparecia na captura do colaborador -- uma imagem afirmando
 * o contrario do produto.
 *
 * A recusa de verdade esta em supabase/testes/09_academy_e_recomendacoes.sql.
 */
const GESTAO = ["socio", "desenvolvedor"].includes(process.env.PROTOTIPO_ROLE ?? "socio");

const visiveis = () => TRILHAS.filter((t) => t.publicada || GESTAO);

// As assinaturas espelham as reais mesmo quando o argumento nao e usado: o
// `npm run build` do prototipo faz typecheck contra as telas de verdade, e foi
// ele que pegou esta divergencia.
export async function listarTrilhas(_usuarioId: string): Promise<TrilhaDaGrade[]> {
  return visiveis().map(montar);
}

export async function obterTrilha(
  id: string,
  _usuarioId: string,
): Promise<TrilhaCompleta | null> {
  const semente = visiveis().find((t) => t.id === id);
  if (!semente) return null;
  return { ...montar(semente), materiais: materiaisDe(semente.id) };
}

export async function acompanhamentoDaEquipe(): Promise<LinhaDoAcompanhamento[]> {
  // O Bruno terminou a obrigatoria e a Carla esta na metade: e o contraste que
  // faz a coluna de progresso dizer alguma coisa. Uma tabela onde todo mundo
  // esta em 0% nao mostra que a tela funciona.
  return [
    {
      usuarioId: "a0000000-0000-0000-0000-000000000004",
      nome: "Bruno Alves",
      trilhaId: "t1",
      trilha: "Onboarding da casa",
      obrigatoria: true,
      concluidos: 3,
      total: 3,
      percentual: 100,
      concluidaEm: "2026-09-12T14:00:00.000Z",
    },
    {
      usuarioId: "a0000000-0000-0000-0000-000000000003",
      nome: "Carla Reis",
      trilhaId: "t1",
      trilha: "Onboarding da casa",
      obrigatoria: true,
      concluidos: 1,
      total: 3,
      percentual: 33,
      concluidaEm: null,
    },
    {
      usuarioId: "a0000000-0000-0000-0000-000000000005",
      nome: "Marina Costa",
      trilhaId: "t1",
      trilha: "Onboarding da casa",
      obrigatoria: true,
      concluidos: 0,
      total: 3,
      percentual: 0,
      concluidaEm: null,
    },
    {
      usuarioId: "a0000000-0000-0000-0000-000000000005",
      nome: "Marina Costa",
      trilhaId: "t2",
      trilha: "Escrita para redes",
      obrigatoria: false,
      concluidos: 1,
      total: 2,
      percentual: 50,
      concluidaEm: null,
    },
  ];
}

export async function skillsParaVincular() {
  return [
    { id: "sk1", nome: "Design Gráfico" },
    { id: "sk4", nome: "Copywriting" },
    { id: "sk5", nome: "Social Media" },
  ];
}
