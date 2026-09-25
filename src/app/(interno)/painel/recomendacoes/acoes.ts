"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import type { Resultado } from "@/lib/acoes/resultado";
import { buscarMetadados, type PreviaDoLink } from "@/lib/link-preview";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As ações do feed de Recomendações.
 *
 * É o módulo mais leve do sistema, e as ações acompanham: postar precisa de
 * categoria e título, e mais nada.
 */

const ROTA = "/painel/recomendacoes";

const esquemaDoPost = z.object({
  categoria: z.enum([
    "filme",
    "serie",
    "livro",
    "curso",
    "ferramenta",
    "podcast",
    "referencia",
    "outro",
  ]),
  titulo: z.string().trim().min(2, "Dê um título à recomendação."),
  descricao: z.string().trim().max(2000).optional().nullable(),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), {
      message: "O link precisa começar com http:// ou https://.",
    })
    .optional()
    .nullable(),
  imagem_url: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(8, "No máximo 8 tags.").default([]),
});

export async function publicarRecomendacao(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("publicarRecomendacao", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDoPost.safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("publicarRecomendacao", validacao.error, dados, "Confira os dados."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        autor_id: sessao.usuarioId,
        categoria: entrada.categoria,
        titulo: entrada.titulo,
        descricao: entrada.descricao?.trim() || null,
        url: entrada.url?.trim() || null,
        imagem_url: entrada.imagem_url?.trim() || null,
        // As tags são normalizadas de novo pelo trigger da 0017. As duas
        // existem: esta escreve o que a pessoa vê, o trigger é o que vale.
        tags: entrada.tags.length > 0 ? entrada.tags : null,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível publicar: ${error.message}`);
    if (!data) return falha("O banco recusou. Só quem é da equipe posta no feed.");

    revalidatePath(ROTA);
    return sucesso("Publicado.", data.id);
  });
}

export async function editarRecomendacao(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarRecomendacao", async () => {
    await exigirEquipeNaAcao();

    const validacao = esquemaDoPost.partial().safeParse(dados);
    if (!validacao.success) {
      return falha(recusaDeValidacao("editarRecomendacao", validacao.error, dados, "Confira os dados."));
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("recommendations")
      .update({
        ...(entrada.categoria !== undefined ? { categoria: entrada.categoria } : {}),
        ...(entrada.titulo !== undefined ? { titulo: entrada.titulo } : {}),
        ...(entrada.descricao !== undefined
          ? { descricao: entrada.descricao?.trim() || null }
          : {}),
        ...(entrada.url !== undefined ? { url: entrada.url?.trim() || null } : {}),
        ...(entrada.tags !== undefined ? { tags: entrada.tags.length ? entrada.tags : null } : {}),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    // A RLS de UPDATE fecha no autor — nem a gestão edita. Gestor que
    // reescreve o texto de outra pessoa deixa no feed uma frase assinada por
    // quem não a escreveu; moderar é apagar.
    if (!data) return falha("Só quem escreveu edita. Para moderar, a gestão remove o post.");

    revalidatePath(ROTA);
    return sucesso("Salvo.");
  });
}

export async function excluirRecomendacao(id: string): Promise<Resultado> {
  return executarAcao("excluirRecomendacao", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("recommendations")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Apagar é do autor ou da gestão.");

    revalidatePath(ROTA);
    return sucesso("Removido.");
  });
}

/**
 * Remoção pela gestão, com motivo.
 *
 * O motivo NÃO vai para uma tabela de moderação — ela não existe, e inventar
 * uma neste sprint seria decidir sozinho que a agência quer um histórico de
 * moderação. Ele vai no aviso que o autor recebe, que é o mínimo que a pessoa
 * precisa: saber que o post saiu e por quê. Um post que some sem explicação é
 * o jeito mais rápido de a equipe parar de postar.
 */
export async function removerComoGestao(id: string, motivo: unknown): Promise<Resultado> {
  return executarAcao("removerComoGestao", async () => {
    await exigirGestorNaAcao();

    const validacao = z
      .string()
      .trim()
      .min(3, "Diga o motivo — o autor vai receber essa frase.")
      .safeParse(motivo);
    if (!validacao.success) {
      return falha(recusaDeValidacao("removerComoGestao", validacao.error, motivo, "Informe o motivo."));
    }

    const supabase = await criarClienteServidor();

    // Lê antes de apagar: depois do delete não há como saber de quem era nem
    // o que era, e o aviso precisa das duas coisas.
    const { data: post } = await supabase
      .from("recommendations")
      .select("autor_id, titulo")
      .eq("id", id)
      .maybeSingle();

    if (!post) return falha("Post não encontrado.");

    const { data, error } = await supabase
      .from("recommendations")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível remover: ${error.message}`);
    if (!data) return falha("O banco recusou a remoção.");

    await supabase.rpc("notificar", {
      p_user_id: post.autor_id,
      p_tipo: "recomendacao",
      p_titulo: "Sua recomendação foi removida",
      p_corpo: `“${post.titulo}” — ${validacao.data}`,
      p_link: ROTA,
    });

    revalidatePath(ROTA);
    return sucesso("Post removido e o autor avisado.");
  });
}

/**
 * Curtir e descurtir.
 *
 * Uma ação só, que alterna: duas ações separadas obrigariam a tela a saber o
 * estado antes de decidir qual chamar, e duas abas abertas discordariam.
 *
 * Curtir de novo depois de descurtir gera um aviso NOVO, e isso é aceito: a
 * alternativa seria guardar um histórico de quem já curtiu alguma vez, o que
 * é mais máquina do que o problema merece num feed de dez pessoas.
 */
export async function alternarCurtida(recomendacaoId: string): Promise<Resultado<boolean>> {
  return executarAcao("alternarCurtida", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data: jaCurti } = await supabase
      .from("recommendation_likes")
      .select("id")
      .eq("recommendation_id", recomendacaoId)
      .eq("user_id", sessao.usuarioId)
      .maybeSingle();

    if (jaCurti) {
      const { data, error } = await supabase
        .from("recommendation_likes")
        .delete()
        .eq("id", jaCurti.id)
        .select("id")
        .maybeSingle();

      if (error) return falha(`Não foi possível descurtir: ${error.message}`);
      if (!data) return falha("O banco recusou. Só dá para tirar a própria curtida.");

      revalidatePath(ROTA);
      return sucesso("Curtida removida.", false);
    }

    const { data, error } = await supabase
      .from("recommendation_likes")
      .insert({ recommendation_id: recomendacaoId, user_id: sessao.usuarioId })
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível curtir: ${error.message}`);
    if (!data) return falha("O banco recusou a curtida.");

    revalidatePath(ROTA);
    return sucesso("Curtido.", true);
  });
}

export async function comentar(
  recomendacaoId: string,
  texto: unknown,
  respostaA?: string | null,
): Promise<Resultado> {
  return executarAcao("comentar", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = z
      .string()
      .trim()
      .min(1, "Escreva alguma coisa.")
      .max(2000, "O comentário ficou longo demais.")
      .safeParse(texto);

    if (!validacao.success) {
      return falha(recusaDeValidacao("comentar", validacao.error, texto, "Comentário inválido."));
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("recommendation_comments")
      .insert({
        recommendation_id: recomendacaoId,
        autor_id: sessao.usuarioId,
        texto: validacao.data,
        resposta_a: respostaA ?? null,
      })
      .select("id")
      .maybeSingle();

    // A thread tem um nível só, e quem recusa é o trigger da 0017. A mensagem
    // dele já explica; concatená-la aqui evita um "não foi possível" mudo.
    if (error) return falha(`Não foi possível comentar: ${error.message}`);
    if (!data) return falha("O banco recusou o comentário.");

    revalidatePath(ROTA);
    return sucesso("Comentado.");
  });
}

export async function excluirComentario(id: string): Promise<Resultado> {
  return executarAcao("excluirComentario", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("recommendation_comments")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(`Não foi possível excluir: ${error.message}`);
    if (!data) return falha("O banco recusou. Apagar é do autor ou da gestão.");

    revalidatePath(ROTA);
    return sucesso("Comentário removido.");
  });
}

/**
 * Os metadados do link, para o formulário se preencher sozinho.
 *
 * **É a única ação do produto que faz o servidor buscar um endereço escolhido
 * por quem está usando.** As cinco travas moram em `lib/link-preview.ts`, e
 * `npm run check:preview` confere doze endereços internos a cada verificação
 * — inclusive o `169.254.169.254` dos metadados de nuvem.
 *
 * **Ela nunca falha o envio, e é o que o sprint pede:** um site sem Open Graph,
 * fora do ar, ou que o guarda recusou devolve `{ ok: false }` com a frase, e a
 * pessoa preenche à mão. O preview é atalho, não requisito — travar o post
 * porque um blog não tem metatag seria pôr uma porta onde havia um caminho.
 *
 * `exigirEquipeNaAcao()` e não só a sessão: quem não é da equipe não tem o que
 * fazer aqui, e sem a guarda a ação viraria um buscador de URLs aberto a
 * qualquer pessoa logada — inclusive cliente.
 */
export async function buscarPreviaDoLink(
  url: unknown,
): Promise<Resultado<PreviaDoLink>> {
  return executarAcao("buscarPreviaDoLink", async () => {
    await exigirEquipeNaAcao();

    const validado = z.string().trim().min(1).safeParse(url);
    if (!validado.success) return falha("Cole um endereço.");

    const r = await buscarMetadados(validado.data);
    if (!r.ok) return falha(r.motivo);

    return sucesso("Prévia carregada.", r.previa);
  });
}
