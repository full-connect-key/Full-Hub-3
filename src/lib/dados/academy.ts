import "server-only";

import { cache } from "react";

import { duracaoDaTrilha, percentual, situacaoDaTrilha } from "@/lib/dominio/academy";
import type { SituacaoDaTrilha } from "@/lib/dominio/academy";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { AcademyMaterial, AcademyTrack } from "@/lib/supabase/database.types";

/**
 * As consultas da Full Academy.
 *
 * A RLS já resolve o que cada um enxerga: trilha em rascunho não volta para
 * quem não é gestão, e o progresso de outra pessoa não volta para ninguém.
 * Esta camada NÃO repete essas regras — repetir seria criar um segundo lugar
 * onde a mesma verdade pode divergir.
 *
 * O que ela faz é o arranjo: juntar trilha, materiais e o progresso de quem
 * está logado numa coisa só, para a tela não fazer três consultas por cartão.
 */

export type TrilhaDaGrade = AcademyTrack & {
  quantosMateriais: number;
  quantosConcluidos: number;
  duracaoMinutos: number | null;
  situacao: SituacaoDaTrilha;
  percentual: number;
};

/*
 * **A TRILHA NÃO TEM MAIS VITRINE DE SUGESTÃO** (migration 0043).
 *
 * O sinal que a alimentava saiu do produto junto com o módulo que o coletava,
 * e sem origem não há o que sugerir: manter a seção lendo outra coisa seria
 * inventar uma preferência que a pessoa nunca declarou, e uma sugestão
 * inventada gasta a credibilidade da seção inteira. O porquê está no cabeçalho
 * da 0043 e no CLAUDE.md — não aqui, porque a varredura de nomes mortos
 * acusaria o próprio texto que a explica.
 *
 * `academy_materials.skill_id` CONTINUA, e é decisão do usuário: o catálogo
 * fica como vocabulário de etiquetas.
 */

/**
 * A grade de trilhas, já com o progresso de quem está pedindo.
 *
 * Três consultas e não uma por trilha: a lista de trilhas, todos os materiais
 * delas e o progresso da pessoa. Com trinta trilhas na tela, uma consulta por
 * cartão seriam noventa idas ao banco para montar uma grade.
 */
export const listarTrilhas = cache(async (usuarioId: string): Promise<TrilhaDaGrade[]> => {
  const supabase = await criarClienteServidor();

  const { data: trilhas } = await supabase
    .from("academy_tracks")
    .select("*")
    .order("ordem")
    .order("created_at");

  if (!trilhas || trilhas.length === 0) return [];

  const ids = trilhas.map((t) => t.id);

  const [{ data: materiais }, { data: progresso }] =
    await Promise.all([
      supabase
        .from("academy_materials")
        .select("id, track_id, duracao_minutos, skill_id")
        .in("track_id", ids),
      supabase
        .from("academy_progress")
        .select("material_id, concluido")
        .eq("user_id", usuarioId)
        .eq("concluido", true),
    ]);

  const concluidos = new Set((progresso ?? []).map((p) => p.material_id));

  return trilhas.map((trilha) => {
    const meus = (materiais ?? []).filter((m) => m.track_id === trilha.id);
    const quantosConcluidos = meus.filter((m) => concluidos.has(m.id)).length;
    const situacao = situacaoDaTrilha(quantosConcluidos, meus.length);

    return {
      ...trilha,
      quantosMateriais: meus.length,
      quantosConcluidos,
      duracaoMinutos: duracaoDaTrilha(meus.map((m) => m.duracao_minutos)),
      situacao,
      percentual: percentual(quantosConcluidos, meus.length),
    };
  });
});

export type MaterialComProgresso = AcademyMaterial & {
  concluido: boolean;
  concluidoEm: string | null;
  /** A anotação de QUEM ESTÁ PEDINDO, e de mais ninguém. A RLS garante isso;
   *  a tela nunca recebe a de outra pessoa. */
  anotacoes: string | null;
  skillNome: string | null;
};

export type TrilhaCompleta = TrilhaDaGrade & {
  materiais: MaterialComProgresso[];
};

export const obterTrilha = cache(
  async (id: string, usuarioId: string): Promise<TrilhaCompleta | null> => {
    const supabase = await criarClienteServidor();

    const { data: trilha } = await supabase
      .from("academy_tracks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    // Null aqui pode ser "não existe" ou "a RLS recusou" — e a tela trata os
    // dois como 404 de propósito. Dizer "existe, mas você não pode ver"
    // entrega que a trilha existe, que é justamente o que o rascunho não pode
    // contar.
    if (!trilha) return null;

    const { data: materiais } = await supabase
      .from("academy_materials")
      .select("*")
      .eq("track_id", id)
      .order("ordem")
      .order("created_at");

    const listaDeMateriais = materiais ?? [];
    const idsDeMaterial = listaDeMateriais.map((m) => m.id);
    const idsDeSkill = [
      ...new Set(listaDeMateriais.map((m) => m.skill_id).filter((s): s is string => !!s)),
    ];

    const [{ data: progresso }, { data: skills }] =
      await Promise.all([
        idsDeMaterial.length > 0
          ? supabase
              .from("academy_progress")
              .select("material_id, concluido, concluido_em, anotacoes")
              .eq("user_id", usuarioId)
              .in("material_id", idsDeMaterial)
          : Promise.resolve({ data: [] as never[] }),
        idsDeSkill.length > 0
          ? supabase.from("skills").select("id, nome").in("id", idsDeSkill)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      ]);

    const porMaterial = new Map((progresso ?? []).map((p) => [p.material_id, p]));
    const nomeDaSkill = new Map((skills ?? []).map((s) => [s.id, s.nome]));
  
    const comProgresso: MaterialComProgresso[] = listaDeMateriais.map((material) => {
      const meu = porMaterial.get(material.id);
      return {
        ...material,
        concluido: meu?.concluido ?? false,
        concluidoEm: meu?.concluido_em ?? null,
        anotacoes: meu?.anotacoes ?? null,
        skillNome: material.skill_id ? (nomeDaSkill.get(material.skill_id) ?? null) : null,
      };
    });

    const quantosConcluidos = comProgresso.filter((m) => m.concluido).length;
    const situacao = situacaoDaTrilha(quantosConcluidos, comProgresso.length);

    return {
      ...trilha,
      materiais: comProgresso,
      quantosMateriais: comProgresso.length,
      quantosConcluidos,
      duracaoMinutos: duracaoDaTrilha(comProgresso.map((m) => m.duracao_minutos)),
      situacao,
      percentual: percentual(quantosConcluidos, comProgresso.length),
    };
  },
);

export type LinhaDoAcompanhamento = {
  usuarioId: string;
  nome: string;
  trilhaId: string;
  trilha: string;
  obrigatoria: boolean;
  concluidos: number;
  total: number;
  percentual: number;
  /** A data em que o ÚLTIMO material foi concluído. Null enquanto falta
   *  algum: a trilha só tem data de conclusão quando está concluída. */
  concluidaEm: string | null;
};

/**
 * A aba Acompanhamento.
 *
 * LÊ PELA VIEW `academy_progresso_da_equipe`, e nunca por `academy_progress`.
 * A view não tem a coluna `anotacoes`, e é isso que mantém a anotação pessoal
 * privada — policy não limita coluna, então a separação é esta. Trocar a view
 * pela tabela aqui entregaria à gestão o que cada pessoa escreveu para si.
 *
 * Trilha obrigatória primeiro: é a única em que "quem não fez" é uma pergunta
 * que alguém precisa responder.
 */
export const acompanhamentoDaEquipe = cache(
  async (): Promise<LinhaDoAcompanhamento[]> => {
    const supabase = await criarClienteServidor();

    const [{ data: trilhas }, { data: pessoas }, { data: materiais }, { data: progresso }] =
      await Promise.all([
        supabase.from("academy_tracks").select("id, titulo, obrigatoria").eq("publicada", true),
        supabase.from("profiles").select("id, nome").eq("ativo", true).neq("role", "cliente"),
        supabase.from("academy_materials").select("id, track_id"),
        supabase.from("academy_progresso_da_equipe").select("*").eq("concluido", true),
      ]);

    if (!trilhas || !pessoas) return [];

    const linhas: LinhaDoAcompanhamento[] = [];

    for (const trilha of trilhas) {
      const total = (materiais ?? []).filter((m) => m.track_id === trilha.id).length;
      if (total === 0) continue;

      for (const pessoa of pessoas) {
        const meus = (progresso ?? []).filter(
          (p) => p.track_id === trilha.id && p.user_id === pessoa.id,
        );
        const concluidos = meus.length;

        const datas = meus
          .map((p) => p.concluido_em)
          .filter((d): d is string => !!d)
          .sort();

        linhas.push({
          usuarioId: pessoa.id,
          nome: pessoa.nome,
          trilhaId: trilha.id,
          trilha: trilha.titulo,
          obrigatoria: trilha.obrigatoria,
          concluidos,
          total,
          percentual: percentual(concluidos, total),
          concluidaEm: concluidos >= total ? (datas.at(-1) ?? null) : null,
        });
      }
    }

    return linhas.sort(
      (a, b) =>
        Number(b.obrigatoria) - Number(a.obrigatoria) ||
        a.trilha.localeCompare(b.trilha) ||
        a.percentual - b.percentual ||
        a.nome.localeCompare(b.nome),
    );
  },
);

/** O catálogo de skills, para vincular material a skill na tela de gestão. */
export const skillsParaVincular = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("skills")
    .select("id, nome")
    .eq("ativa", true)
    .order("nome");
  return data ?? [];
});
