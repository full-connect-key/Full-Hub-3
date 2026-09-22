/**
 * Versao de prototipo de src/lib/dados/skills.ts.
 *
 * Uma agencia pequena de mentira, com lacuna de proposito: ninguem senior em
 * SEO e ninguem em Dados. A tela de lacunas so se valida com lacuna, e um
 * exemplo onde todo mundo sabe tudo esconderia justamente o que ela serve para
 * mostrar.
 */
import type {
  Interesse,
  MinhaSkill,
  PanoramaDeSkills,
  PessoaComSkills,
  SkillDaAgencia,
  SkillDoCatalogo,
} from "../../src/lib/dados/skills";
import type { Skill, SkillAvaliacao, SkillNivel } from "../../src/lib/supabase/database.types";

export type {
  Interesse,
  MinhaSkill,
  PanoramaDeSkills,
  PessoaComSkills,
  SkillDaAgencia,
  SkillDoCatalogo,
};

const CATALOGO: { id: string; nome: string; categoria: string; descricao: string }[] = [
  { id: "sk1", nome: "Design Gráfico", categoria: "Design", descricao: "Peças gráficas e marca." },
  { id: "sk2", nome: "Motion", categoria: "Design", descricao: "Animação de peças." },
  { id: "sk3", nome: "Edição de Vídeo", categoria: "Audiovisual", descricao: "Corte e finalização." },
  { id: "sk4", nome: "Copywriting", categoria: "Conteúdo", descricao: "Texto que converte." },
  { id: "sk5", nome: "Social Media", categoria: "Conteúdo", descricao: "Planejamento para redes." },
  { id: "sk6", nome: "Tráfego Pago", categoria: "Mídia", descricao: "Compra e otimização." },
  { id: "sk7", nome: "SEO", categoria: "Mídia", descricao: "Busca orgânica." },
  { id: "sk8", nome: "Análise de Dados", categoria: "Dados", descricao: "Relatório e leitura." },
];

// "Analise de Dados" e uma SUGESTAO da equipe esperando decisao: nasce
// `ativa = false` com `sugerida_por` preenchido, que e o par que a tela usa
// para separar sugestao pendente de skill arquivada pela gestao. Sem uma
// sugestao no exemplo, o bloco que a gestao ve no topo do catalogo nunca
// aparece no prototipo -- e e justamente o que precisa ser validado.
const SUGERIDA = "sk8";

function skill(id: string): Skill {
  const base = CATALOGO.find((s) => s.id === id)!;
  const pendente = id === SUGERIDA;
  return {
    id: base.id,
    nome: base.nome,
    categoria: base.categoria,
    descricao: base.descricao,
    ativa: !pendente,
    sugerida_por: pendente ? "p4" : null,
    created_at: "2026-01-10T09:00:00Z",
  } as Skill;
}

const PESSOAS: { id: string; nome: string; area: string; cargo: string }[] = [
  { id: "p1", nome: "Marina Alves", area: "Criação", cargo: "Diretora de Arte" },
  { id: "p2", nome: "Bruno Costa", area: "Criação", cargo: "Designer" },
  { id: "p3", nome: "Ana Ribeiro", area: "Conteúdo", cargo: "Redatora" },
  { id: "p4", nome: "Carlos Dias", area: "Mídia", cargo: "Analista de Tráfego" },
];

const NIVEIS: Record<string, Record<string, SkillNivel>> = {
  p1: { sk1: "especialista", sk2: "avancado", sk3: "intermediario" },
  p2: { sk1: "avancado", sk2: "iniciante" },
  p3: { sk4: "especialista", sk5: "avancado" },
  p4: { sk6: "avancado", sk7: "iniciante", sk5: "intermediario" },
};

export async function listarCatalogo(): Promise<Skill[]> {
  return CATALOGO.map((s) => skill(s.id));
}

export async function listarCatalogoCompleto(): Promise<SkillDoCatalogo[]> {
  return CATALOGO.map((s) => ({
    ...skill(s.id),
    sugeridaPor: s.id === SUGERIDA ? { id: "p4", nome: "Carlos Dias" } : null,
    quantasPessoas: Object.values(NIVEIS).filter((mapa) => mapa[s.id]).length,
  }));
}

export async function skillsDaPessoa(usuarioId: string): Promise<MinhaSkill[]> {
  const mapa = NIVEIS[usuarioId] ?? NIVEIS.p1;
  return Object.entries(mapa).map(([skillId, nivel], indice) => {
    const base = CATALOGO.find((s) => s.id === skillId)!;
    return {
      id: `us-${skillId}`,
      skillId,
      nome: base.nome,
      categoria: base.categoria,
      descricao: base.descricao,
      nivel,
      querDesenvolver: indice === 1,
      anosExperiencia: indice + 2,
      observacao: indice === 0 ? "Principal ferramenta do meu dia a dia." : null,
    };
  });
}

export async function avaliacoesDaPessoa(
  usuarioId: string,
): Promise<(SkillAvaliacao & { autor: { id: string; nome: string } | null })[]> {
  void usuarioId;
  return [
    {
      id: "av1",
      user_id: "p1",
      autor_id: "p9",
      texto:
        "Evoluiu muito na direção de arte das campanhas deste semestre. Próximo passo é conduzir a apresentação ao cliente sozinha.",
      created_at: "2026-08-14T14:00:00Z",
      updated_at: "2026-08-14T14:00:00Z",
      autor: { id: "p9", nome: "Júlia Menezes" },
    } as SkillAvaliacao & { autor: { id: string; nome: string } | null },
  ];
}

export async function panoramaDeSkills(): Promise<PanoramaDeSkills> {
  const pessoas: PessoaComSkills[] = PESSOAS.map((p) => ({
    id: p.id,
    nome: p.nome,
    avatarUrl: null,
    area: p.area,
    cargo: p.cargo,
    niveis: new Map(Object.entries(NIVEIS[p.id] ?? {})),
  }));

  const skills: SkillDaAgencia[] = CATALOGO.map((s) => {
    const quem = PESSOAS.filter((p) => NIVEIS[p.id]?.[s.id]).map((p) => ({
      id: p.id,
      nome: p.nome,
      avatarUrl: null,
      nivel: NIVEIS[p.id][s.id],
    }));
    return {
      ...skill(s.id),
      categoria: s.categoria,
      pessoas: quem,
      quantosSeniores: quem.filter((q) => q.nivel === "avancado" || q.nivel === "especialista")
        .length,
    };
  });

  const interesses: Interesse[] = [
    {
      skillId: "sk2",
      nome: "Motion",
      categoria: "Design",
      pessoas: [{ id: "p2", nome: "Bruno Costa" }],
    },
    {
      skillId: "sk7",
      nome: "SEO",
      categoria: "Mídia",
      pessoas: [{ id: "p4", nome: "Carlos Dias" }],
    },
  ];

  return {
    pessoas,
    skills,
    interesses,
    categorias: [...new Set(CATALOGO.map((s) => s.categoria))],
    areas: [...new Set(PESSOAS.map((p) => p.area))],
  };
}
