"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações de skills.
 *
 * `user_id` nunca vem do formulário — sai da sessão. Aceitá-lo de fora seria
 * oferecer a chance de escrever no perfil de outra pessoa; mesmo com o RLS
 * recusando, uma action que tenta já é erro de desenho.
 *
 * NÍVEL É AUTOAVALIAÇÃO: não existe aqui uma ação de "gestor define o nível de
 * alguém", e isso é deliberado. A opinião da gestão tem lugar próprio em
 * `registrarAvaliacao`.
 */

const ROTA = "/painel/meu-desenvolvimento";
const ROTA_DA_EQUIPE = "/painel/equipe";

const NIVEIS = ["iniciante", "intermediario", "avancado", "especialista"] as const;

const esquemaDaMinhaSkill = z.object({
  skill_id: z.string().uuid(),
  nivel: z.enum(NIVEIS),
  quer_desenvolver: z.boolean(),
  // Até 60 anos de experiência. O limite não é zelo: sem ele, um dedo escorregado
  // no teclado numérico põe "202" no relatório da agência.
  anos_experiencia: z.number().min(0).max(60).nullable().optional(),
  observacao: z.string().trim().max(500).nullable().optional(),
});

export async function salvarMinhaSkill(dados: unknown): Promise<Resultado> {
  return executarAcao("salvarMinhaSkill", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDaMinhaSkill.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarMinhaSkill", validacao.error, dados, "Confira os dados da skill."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("user_skills")
      .upsert(
        {
          user_id: sessao.usuarioId,
          skill_id: entrada.skill_id,
          nivel: entrada.nivel,
          quer_desenvolver: entrada.quer_desenvolver,
          anos_experiencia: entrada.anos_experiencia ?? null,
          observacao: entrada.observacao?.trim() || null,
        },
        { onConflict: "user_id,skill_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Cada um edita só as próprias skills.");

    revalidatePath(ROTA);
    return sucesso("Salvo.");
  });
}

export async function removerMinhaSkill(skillId: string): Promise<Resultado> {
  return executarAcao("removerMinhaSkill", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("user_skills")
      .delete()
      .eq("user_id", sessao.usuarioId)
      .eq("skill_id", skillId)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Cada um edita só as próprias skills.");

    revalidatePath(ROTA);
    return sucesso("Skill removida do seu perfil.");
  });
}

/**
 * Sugerir uma skill que falta no catálogo.
 *
 * Nasce inativa e assinada: a gestão aprova depois. Sem esse caminho, quem
 * descobre que falta algo teria que pedir por fora do sistema — e não pediria.
 */
export async function sugerirSkill(nome: string, categoria: string): Promise<Resultado<string>> {
  return executarAcao("sugerirSkill", async () => {
    const sessao = await exigirEquipeNaAcao();

    const limpo = nome.trim();
    if (limpo.length < 2) return falha("Dê um nome à skill.");

    const supabase = await criarClienteServidor();

    // O nome é único no catálogo. Conferir antes rende a frase certa: "essa já
    // existe, é só adicionar ao seu perfil" em vez do erro cru de unicidade.
    const { data: jaExiste } = await supabase
      .from("skills")
      .select("id, nome, ativa")
      .ilike("nome", limpo)
      .maybeSingle();

    if (jaExiste) {
      return falha(
        jaExiste.ativa
          ? `"${jaExiste.nome}" já está no catálogo — é só adicionar ao seu perfil.`
          : `"${jaExiste.nome}" já foi sugerida e espera aprovação da gestão.`,
      );
    }

    const { data, error } = await supabase
      .from("skills")
      .insert({
        nome: limpo,
        categoria: categoria.trim() || null,
        ativa: false,
        sugerida_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível sugerir: ${error?.message ?? "erro"}`);

    revalidatePath(ROTA);
    revalidatePath(ROTA_DA_EQUIPE);
    return sucesso(`"${limpo}" foi sugerida. A gestão aprova e ela entra no catálogo.`, data.id);
  });
}

// ---------------------------------------------------------------------------
// Gestão do catálogo e a observação de avaliação.
// ---------------------------------------------------------------------------

export async function aprovarSkill(id: string): Promise<Resultado> {
  return executarAcao("aprovarSkill", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("skills")
      .update({ ativa: true, sugerida_por: null })
      .eq("id", id)
      .select("nome")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Aprovar skill é da gestão.");

    revalidatePath(ROTA_DA_EQUIPE);
    revalidatePath(ROTA);
    return sucesso(`"${data.nome}" entrou no catálogo.`);
  });
}

const esquemaDoCatalogo = z.object({
  nome: z.string().trim().min(2, "Dê um nome à skill."),
  categoria: z.string().trim().max(60).nullable().optional(),
  descricao: z.string().trim().max(300).nullable().optional(),
});

export async function salvarSkillDoCatalogo(
  id: string | null,
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("salvarSkillDoCatalogo", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDoCatalogo.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarSkillDoCatalogo", validacao.error, dados, "Confira os dados da skill."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const campos = {
      nome: entrada.nome,
      categoria: entrada.categoria?.trim() || null,
      descricao: entrada.descricao?.trim() || null,
    };

    if (id) {
      const { data, error } = await supabase
        .from("skills")
        .update(campos)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) return falha(error.message);
      if (!data) return falha("O banco recusou. Editar o catálogo é da gestão.");
    } else {
      const { error } = await supabase
        .from("skills")
        .insert({ ...campos, ativa: true })
        .select("id")
        .single();
      if (error) return falha(error.message);
    }

    revalidatePath(ROTA_DA_EQUIPE);
    revalidatePath(ROTA);
    return sucesso("Catálogo atualizado.");
  });
}

/**
 * Arquivar em vez de apagar: a skill continua citada no perfil de quem a tem,
 * e o nome precisa continuar legível ali.
 */
export async function arquivarSkill(id: string, ativa: boolean): Promise<Resultado> {
  return executarAcao("arquivarSkill", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("skills")
      .update({ ativa })
      .eq("id", id)
      .select("nome")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Arquivar skill é da gestão.");

    revalidatePath(ROTA_DA_EQUIPE);
    revalidatePath(ROTA);
    return sucesso(ativa ? `"${data.nome}" reativada.` : `"${data.nome}" arquivada.`);
  });
}

/**
 * A observação da gestão sobre o desenvolvimento de alguém.
 *
 * O AVALIADO LÊ. A tela diz isso antes de a pessoa escrever, porque quem sabe
 * que vai ser lido escreve melhor — e porque avaliação que o avaliado não pode
 * ler é feedback pelas costas.
 */
export async function registrarAvaliacao(
  usuarioId: string,
  texto: string,
): Promise<Resultado> {
  return executarAcao("registrarAvaliacao", async () => {
    const sessao = await exigirGestorNaAcao();

    const limpo = texto.trim();
    if (limpo.length < 3) return falha("Escreva a observação.");

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("skill_avaliacoes")
      .insert({ user_id: usuarioId, autor_id: sessao.usuarioId, texto: limpo })
      .select("id")
      .single();

    if (error || !data) return falha(`Não foi possível registrar: ${error?.message ?? "erro"}`);

    revalidatePath(`${ROTA_DA_EQUIPE}/${usuarioId}`);
    return sucesso("Observação registrada. A pessoa também vê.");
  });
}
