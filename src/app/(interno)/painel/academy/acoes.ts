"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import type { Resultado } from "@/lib/acoes/resultado";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações da Full Academy.
 *
 * QUEM MONTA E QUEM ESTUDA SÃO GUARDAS DIFERENTES: trilha e material passam
 * por `exigirGestorNaAcao`, progresso e anotação por `exigirEquipeNaAcao`. As
 * duas são a primeira linha, e a RLS é a que vale — a guarda aqui existe para
 * a mensagem ser legível, não para ser a proteção.
 */

const ROTA = "/painel/academy";

const RECUSA =
  "O banco recusou a operação. Se você não é da gestão, montar trilha não é seu — o conteúdo é.";

const esquemaDeTrilha = z.object({
  titulo: z.string().trim().min(2, "Dê um nome à trilha."),
  descricao: z.string().trim().optional().nullable(),
  area: z.string().trim().optional().nullable(),
  obrigatoria: z.boolean().default(false),
  publicada: z.boolean().default(false),
});

export async function salvarTrilha(id: string | null, dados: unknown): Promise<Resultado<string>> {
  return executarAcao("salvarTrilha", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeTrilha.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarTrilha", validacao.error, dados, "Confira os dados da trilha."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();

    const campos = {
      titulo: entrada.titulo,
      descricao: entrada.descricao?.trim() || null,
      area: entrada.area?.trim() || null,
      obrigatoria: entrada.obrigatoria,
      publicada: entrada.publicada,
    };

    // `.select()` no fim porque um write barrado pelo RLS volta sem erro e sem
    // linha: sem conferir, a tela diria "Salvo." sem nada ter mudado.
    const { data, error } = id
      ? await supabase.from("academy_tracks").update(campos).eq("id", id).select("id").maybeSingle()
      : await supabase
          .from("academy_tracks")
          .insert({ ...campos, criado_por: sessao.usuarioId })
          .select("id")
          .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/${data.id}`);
    return sucesso(id ? "Trilha salva." : "Trilha criada.", data.id);
  });
}

export async function publicarTrilha(id: string, publicada: boolean): Promise<Resultado> {
  return executarAcao("publicarTrilha", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_tracks")
      .update({ publicada })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    revalidatePath(`${ROTA}/${id}`);
    // "Despublicar" e "apagar" não são a mesma coisa, e a mensagem mantém a
    // diferença: a trilha some da equipe e continua inteira para a gestão.
    return sucesso(
      publicada ? "Trilha publicada — a equipe já vê." : "Trilha voltou a rascunho.",
    );
  });
}

export async function excluirTrilha(id: string): Promise<Resultado> {
  return executarAcao("excluirTrilha", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_tracks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(ROTA);
    return sucesso("Trilha excluída.");
  });
}

const esquemaDeMaterial = z.object({
  track_id: z.string().uuid(),
  titulo: z.string().trim().min(2, "Dê um nome ao material."),
  descricao: z.string().trim().optional().nullable(),
  tipo: z.enum(["video", "artigo", "pdf", "curso_externo", "template", "aula_interna"]),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), {
      message: "O link precisa começar com http:// ou https://.",
    })
    .optional()
    .nullable(),
  arquivo_url: z.string().trim().optional().nullable(),
  duracao_minutos: z.number().int().positive().optional().nullable(),
  skill_id: z.string().uuid().optional().nullable(),
});

export async function salvarMaterial(id: string | null, dados: unknown): Promise<Resultado> {
  return executarAcao("salvarMaterial", async () => {
    await exigirGestorNaAcao();

    const validacao = esquemaDeMaterial.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarMaterial", validacao.error, dados, "Confira os dados do material."));
    }
    const entrada = validacao.data;

    // Material sem endereço nenhum é um item de lista que não abre nada. O
    // `template` é a exceção: ele pode ser só a descrição de um padrão que a
    // pessoa reproduz, sem arquivo.
    if (
      entrada.tipo !== "template" &&
      !entrada.url?.trim() &&
      !entrada.arquivo_url?.trim()
    ) {
      return falha("Informe o link ou envie o arquivo — senão o material não abre nada.");
    }

    const supabase = await criarClienteServidor();

    const campos = {
      titulo: entrada.titulo,
      descricao: entrada.descricao?.trim() || null,
      tipo: entrada.tipo,
      url: entrada.url?.trim() || null,
      arquivo_url: entrada.arquivo_url?.trim() || null,
      duracao_minutos: entrada.duracao_minutos ?? null,
      skill_id: entrada.skill_id || null,
    };

    if (id) {
      const { data, error } = await supabase
        .from("academy_materials")
        .update(campos)
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) return falha(`Não foi possível salvar: ${error.message}`);
      if (!data) return falha(RECUSA);
    } else {
      // A ordem nasce no fim da lista. Ler o máximo e somar um evita que dois
      // materiais criados na sequência nasçam ambos com ordem 0 e a lista
      // fique dependendo do `created_at` para desempatar.
      const { data: ultimo } = await supabase
        .from("academy_materials")
        .select("ordem")
        .eq("track_id", entrada.track_id)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from("academy_materials")
        .insert({ ...campos, track_id: entrada.track_id, ordem: (ultimo?.ordem ?? 0) + 1 })
        .select("id")
        .maybeSingle();

      if (error) return falha(`Não foi possível criar: ${error.message}`);
      if (!data) return falha(RECUSA);
    }

    revalidatePath(`${ROTA}/${entrada.track_id}`);
    revalidatePath(ROTA);
    return sucesso(id ? "Material salvo." : "Material adicionado.");
  });
}

export async function excluirMaterial(id: string, trackId: string): Promise<Resultado> {
  return executarAcao("excluirMaterial", async () => {
    await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_materials")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(`${ROTA}/${trackId}`);
    return sucesso("Material removido.");
  });
}

/** Reordenar é uma lista de ids na ordem nova. Gravar um por um daria N idas
 *  ao banco e uma ordem meio aplicada se a quinta falhasse. */
export async function reordenarMateriais(
  trackId: string,
  ids: unknown,
): Promise<Resultado> {
  return executarAcao("reordenarMateriais", async () => {
    await exigirGestorNaAcao();

    const validacao = z.array(z.string().uuid()).min(1).safeParse(ids);
    if (!validacao.success) return falha("Ordem inválida.");

    const supabase = await criarClienteServidor();

    // RPC e nao dez updates: `academy_reordenar` faz tudo numa transacao so
    // (migration 0017). Pelo PostgREST seriam dez requisicoes, e a quinta
    // falhando deixaria a trilha numa ordem que nunca existiu na tela.
    //
    // A funcao NAO e security definer: quem nao e gestao esbarra na policy de
    // UPDATE, e o retorno vem zero — que e como a recusa chega aqui.
    const { data, error } = await supabase.rpc("academy_reordenar", {
      p_track_id: trackId,
      p_ids: validacao.data,
    });

    if (error) return falha(`Não foi possível reordenar: ${error.message}`);
    if (!data) return falha(RECUSA);

    revalidatePath(`${ROTA}/${trackId}`);
    return sucesso("Ordem salva.");
  });
}

/**
 * Marcar ou desmarcar um material.
 *
 * `upsert` e não insert: a pessoa pode marcar, desmarcar e marcar de novo, e
 * a linha de progresso é única por (user_id, material_id). O `concluido_em` é
 * carimbado pelo trigger da 0017, não por esta action — o relógio do navegador
 * não é prova de quando algo aconteceu.
 */
export async function marcarMaterial(
  materialId: string,
  concluido: boolean,
  trackId: string,
): Promise<Resultado> {
  return executarAcao("marcarMaterial", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_progress")
      .upsert(
        { user_id: sessao.usuarioId, material_id: materialId, concluido },
        { onConflict: "user_id,material_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. O progresso é seu, e só seu.");

    revalidatePath(`${ROTA}/${trackId}`);
    revalidatePath(ROTA);
    return sucesso(concluido ? "Marcado como concluído." : "Desmarcado.");
  });
}

/**
 * A anotação pessoal.
 *
 * Ela é privada, e a única porta de escrita é esta — com a guarda de equipe e
 * a RLS fechando em `auth.uid()`. A gestão lê o progresso pela view
 * `academy_progresso_da_equipe`, que não tem esta coluna.
 */
export async function salvarAnotacao(
  materialId: string,
  texto: unknown,
  trackId: string,
): Promise<Resultado> {
  return executarAcao("salvarAnotacao", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = z.string().max(5000, "A anotação ficou longa demais.").safeParse(texto);
    if (!validacao.success) {
      return falha(recusaDeValidacao("salvarAnotacao", validacao.error, texto, "Anotação inválida."));
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("academy_progress")
      .upsert(
        {
          user_id: sessao.usuarioId,
          material_id: materialId,
          anotacoes: validacao.data.trim() || null,
        },
        { onConflict: "user_id,material_id" },
      )
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("O banco recusou. A anotação é sua, e só sua.");

    revalidatePath(`${ROTA}/${trackId}`);
    return sucesso("Anotação salva.");
  });
}
