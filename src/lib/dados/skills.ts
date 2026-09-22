import "server-only";

import { cache } from "react";

import { ehSenior } from "@/lib/dominio/skills";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Skill, SkillAvaliacao, SkillNivel } from "@/lib/supabase/database.types";

/**
 * As consultas de skills.
 *
 * A pergunta que o módulo existe para responder é **"quem sabe fazer X?"**, e
 * quase tudo aqui serve a ela: o catálogo compartilhado existe para o nome ser
 * o mesmo, a matriz é a resposta em grade, e as lacunas são a mesma pergunta
 * ao contrário — "o que ninguém sabe fazer?".
 *
 * A RLS já limita o que cada um lê: o colaborador só enxerga as próprias
 * linhas de `user_skills`. Esta camada não repete a regra.
 */

export type SkillDoCatalogo = Skill & {
  /** Quem sugeriu, quando é uma sugestão esperando aprovação. */
  sugeridaPor: { id: string; nome: string } | null;
  /** Quantas pessoas têm essa skill. Só faz sentido para quem lê todas. */
  quantasPessoas: number;
};

export type MinhaSkill = {
  id: string;
  skillId: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  nivel: SkillNivel;
  querDesenvolver: boolean;
  anosExperiencia: number | null;
  observacao: string | null;
};

const SEM_CATEGORIA = "Outras";

/** O catálogo ativo, para escolher uma skill nova. */
export const listarCatalogo = cache(async (): Promise<Skill[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("skills")
    .select("*")
    .eq("ativa", true)
    .order("categoria")
    .order("nome");
  return data ?? [];
});

/** O catálogo inteiro, com as sugestões pendentes. Tela de gestão. */
export const listarCatalogoCompleto = cache(async (): Promise<SkillDoCatalogo[]> => {
  const supabase = await criarClienteServidor();

  const [{ data: skills }, { data: usos }] = await Promise.all([
    supabase.from("skills").select("*").order("ativa", { ascending: false }).order("nome"),
    supabase.from("user_skills").select("skill_id"),
  ]);

  const lista = skills ?? [];
  const contagem = new Map<string, number>();
  for (const uso of usos ?? []) {
    contagem.set(uso.skill_id, (contagem.get(uso.skill_id) ?? 0) + 1);
  }

  const idsDeAutores = [...new Set(lista.map((s) => s.sugerida_por).filter(Boolean))] as string[];
  const { data: pessoas } = idsDeAutores.length
    ? await supabase.from("profiles").select("id, nome").in("id", idsDeAutores)
    : { data: [] as { id: string; nome: string }[] };

  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  return lista.map((skill) => ({
    ...skill,
    sugeridaPor: skill.sugerida_por ? (porPessoa.get(skill.sugerida_por) ?? null) : null,
    quantasPessoas: contagem.get(skill.id) ?? 0,
  }));
});

/** O perfil de uma pessoa. Sem `usuarioId`, o de quem está logado. */
export async function skillsDaPessoa(usuarioId: string): Promise<MinhaSkill[]> {
  const supabase = await criarClienteServidor();

  const { data: minhas } = await supabase
    .from("user_skills")
    .select("*")
    .eq("user_id", usuarioId);

  const lista = minhas ?? [];
  if (lista.length === 0) return [];

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .in(
      "id",
      lista.map((u) => u.skill_id),
    );

  const porSkill = new Map((skills ?? []).map((s) => [s.id, s]));

  return lista
    .map((minha) => {
      const skill = porSkill.get(minha.skill_id);
      if (!skill) return null;
      return {
        id: minha.id,
        skillId: skill.id,
        nome: skill.nome,
        categoria: skill.categoria?.trim() || SEM_CATEGORIA,
        descricao: skill.descricao,
        nivel: minha.nivel,
        querDesenvolver: minha.quer_desenvolver,
        anosExperiencia: minha.anos_experiencia,
        observacao: minha.observacao,
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      a!.categoria === b!.categoria
        ? a!.nome.localeCompare(b!.nome, "pt-BR")
        : a!.categoria.localeCompare(b!.categoria, "pt-BR"),
    ) as MinhaSkill[];
}

/** As observações da gestão sobre uma pessoa. O avaliado lê as dele. */
export async function avaliacoesDaPessoa(
  usuarioId: string,
): Promise<(SkillAvaliacao & { autor: { id: string; nome: string } | null })[]> {
  const supabase = await criarClienteServidor();

  const { data: linhas } = await supabase
    .from("skill_avaliacoes")
    .select("*")
    .eq("user_id", usuarioId)
    .order("created_at", { ascending: false });

  const lista = linhas ?? [];
  if (lista.length === 0) return [];

  const { data: autores } = await supabase
    .from("profiles")
    .select("id, nome")
    .in("id", [...new Set(lista.map((a) => a.autor_id))]);

  const porAutor = new Map((autores ?? []).map((p) => [p.id, p]));
  return lista.map((a) => ({ ...a, autor: porAutor.get(a.autor_id) ?? null }));
}

// ---------------------------------------------------------------------------
// A visão da agência. Só a gestão lê — é o que a RLS de `user_skills` permite.
// ---------------------------------------------------------------------------

export type PessoaComSkills = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  area: string;
  cargo: string | null;
  /** skillId -> nível. Map porque a matriz consulta célula a célula. */
  niveis: Map<string, SkillNivel>;
};

export type SkillDaAgencia = Skill & {
  categoria: string;
  /** Quem tem, do mais avançado para o menos. É a resposta de "quem sabe X?". */
  pessoas: { id: string; nome: string; avatarUrl: string | null; nivel: SkillNivel }[];
  quantosSeniores: number;
};

export type Interesse = {
  skillId: string;
  nome: string;
  categoria: string;
  pessoas: { id: string; nome: string }[];
};

export type PanoramaDeSkills = {
  pessoas: PessoaComSkills[];
  skills: SkillDaAgencia[];
  interesses: Interesse[];
  categorias: string[];
  areas: string[];
};

/**
 * Tudo o que a aba Skills da Equipe precisa, numa passada.
 *
 * Quatro telas diferentes — matriz, busca, lacunas e interesses — são quatro
 * arranjos dos mesmos dados. Buscar uma vez e arranjar quatro vezes é mais
 * barato e, mais importante, garante que as quatro concordem: com quatro
 * consultas, a matriz e as lacunas poderiam discordar sobre quem é avançado.
 */
export const panoramaDeSkills = cache(async (): Promise<PanoramaDeSkills> => {
  const supabase = await criarClienteServidor();

  const [{ data: perfis }, { data: catalogo }, { data: todas }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, avatar_url, ativo, role")
      .neq("role", "cliente")
      .eq("ativo", true)
      .order("nome"),
    supabase.from("skills").select("*").eq("ativa", true).order("nome"),
    supabase.from("user_skills").select("*"),
  ]);

  const gente = perfis ?? [];
  const { data: fichas } = gente.length
    ? await supabase
        .from("team_members")
        .select("user_id, area, cargo, ativo")
        .in(
          "user_id",
          gente.map((p) => p.id),
        )
    : { data: [] as { user_id: string; area: string | null; cargo: string | null; ativo: boolean }[] };

  const porUsuario = new Map((fichas ?? []).map((f) => [f.user_id, f]));

  const pessoas: PessoaComSkills[] = gente
    .filter((p) => porUsuario.get(p.id)?.ativo !== false)
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      avatarUrl: p.avatar_url,
      area: porUsuario.get(p.id)?.area?.trim() || "Sem área",
      cargo: porUsuario.get(p.id)?.cargo ?? null,
      niveis: new Map<string, SkillNivel>(),
    }));

  const porPessoa = new Map(pessoas.map((p) => [p.id, p]));
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.nome]));

  const porSkill = new Map<
    string,
    { id: string; nome: string; avatarUrl: string | null; nivel: SkillNivel }[]
  >();
  const interessadosPorSkill = new Map<string, { id: string; nome: string }[]>();

  for (const linha of todas ?? []) {
    const pessoa = porPessoa.get(linha.user_id);
    // Quem foi desligado sai do panorama: a matriz responde "quem a agência
    // tem hoje", e um nome que não está mais na casa é resposta errada.
    if (!pessoa) continue;

    pessoa.niveis.set(linha.skill_id, linha.nivel);

    const atual = porSkill.get(linha.skill_id) ?? [];
    atual.push({
      id: pessoa.id,
      nome: pessoa.nome,
      avatarUrl: pessoa.avatarUrl,
      nivel: linha.nivel,
    });
    porSkill.set(linha.skill_id, atual);

    if (linha.quer_desenvolver) {
      const querem = interessadosPorSkill.get(linha.skill_id) ?? [];
      querem.push({ id: pessoa.id, nome: nomeDe.get(pessoa.id) ?? "—" });
      interessadosPorSkill.set(linha.skill_id, querem);
    }
  }

  const skills: SkillDaAgencia[] = (catalogo ?? []).map((skill) => {
    const quem = (porSkill.get(skill.id) ?? []).sort((a, b) =>
      a.nivel === b.nivel
        ? a.nome.localeCompare(b.nome, "pt-BR")
        : ordemDoNivel(b.nivel) - ordemDoNivel(a.nivel),
    );
    return {
      ...skill,
      categoria: skill.categoria?.trim() || SEM_CATEGORIA,
      pessoas: quem,
      quantosSeniores: quem.filter((p) => ehSenior(p.nivel)).length,
    };
  });

  const interesses: Interesse[] = skills
    .filter((s) => (interessadosPorSkill.get(s.id) ?? []).length > 0)
    .map((s) => ({
      skillId: s.id,
      nome: s.nome,
      categoria: s.categoria,
      pessoas: interessadosPorSkill.get(s.id) ?? [],
    }))
    .sort((a, b) => b.pessoas.length - a.pessoas.length);

  return {
    pessoas,
    skills,
    interesses,
    categorias: [...new Set(skills.map((s) => s.categoria))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
    areas: [...new Set(pessoas.map((p) => p.area))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
});

function ordemDoNivel(nivel: SkillNivel): number {
  return { iniciante: 1, intermediario: 2, avancado: 3, especialista: 4 }[nivel];
}
