"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ArquivoDaVersao } from "@/lib/supabase/database.types";

/**
 * As ações do Social Media interno.
 *
 * **A CORRENTE É DE BANCO, e estas funções escrevem a frase que a pessoa lê.**
 * Nenhuma guarda daqui é a trava: `posts_insert` fecha em `is_gestor()`,
 * `posts_update` em gestão ou responsável, `posts_protege_colunas` recusa o
 * colaborador que tenta trocar cliente, responsável ou data, e
 * `validar_nova_rodada` recusa quem produziu enviar a própria entrega. As
 * guardas daqui existem para a recusa chegar em português e antes da viagem —
 * é a mesma dupla de `lib/tasks/state-machine.ts` com os triggers da 0007.
 */

const ROTA = "/painel/social-media";

const ROTULOS = {
  client_id: "cliente",
  tema: "tema",
  pauta: "pauta",
  url: "endereço da referência",
  data_publicacao: "data de publicação",
  plataforma: "rede",
  video_url: "link do vídeo",
} as const;

const esquemaDeAbertura = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  tema: z.string().trim().min(2, "Escreva o tema do post."),
  data_publicacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  horario: z.string().nullable().optional(),
  plataforma: z.enum([
    "instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter", "pinterest",
  ]),
  formato: z.string().trim().nullable().optional(),
  midia: z.enum(["imagem", "carrossel", "video"]),
  responsavel_id: z.string().uuid().nullable().optional(),
});

/**
 * Abrir o post. **É da gestão**, e a mudança foi decisão do usuário: até a
 * 0042 `posts_insert` era `is_staff()`, e um colaborador abrindo post próprio
 * furava a corrente no primeiro elo.
 */
export async function abrirPost(dados: unknown): Promise<Resultado<string>> {
  return executarAcao("abrirPost", async () => {
    const sessao = await exigirGestorNaAcao();

    const validacao = esquemaDeAbertura.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("abrirPost", validacao.error, dados, "Confira o post.", ROTULOS),
      );
    }
    const entrada = validacao.data;

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        client_id: entrada.client_id,
        tema: entrada.tema,
        data_publicacao: entrada.data_publicacao,
        horario: entrada.horario || null,
        plataforma: entrada.plataforma,
        formato: entrada.formato || null,
        midia: entrada.midia,
        responsavel_id: entrada.responsavel_id ?? null,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Abrir post é do desenvolvedor ou do sócio.");

    revalidatePath(ROTA);
    return sucesso(
      entrada.responsavel_id
        ? "Post aberto e liberado. A pessoa foi avisada."
        : "Post aberto. Libere para quem vai produzir.",
      data.id,
    );
  });
}

const esquemaDeEdicao = z.object({
  tema: z.string().trim().min(2).optional(),
  legenda: z.string().nullable().optional(),
  // A PAUTA ENTRA AQUI E NÃO NUMA ACTION PRÓPRIA (0046): ela é conteúdo do
  // card, como a legenda, e quem a escreve é quem pegou a primeira etapa. Uma
  // action só para ela daria dois caminhos de gravação para dois campos que
  // salvam do mesmo jeito, na mesma tela, com o mesmo `debounce`.
  pauta: z.string().nullable().optional(),
  formato: z.string().trim().nullable().optional(),
  midia: z.enum(["imagem", "carrossel", "video"]).optional(),
  video_url: z
    .string()
    .trim()
    .regex(/^https?:\/\//i, "O link do vídeo precisa começar com http:// ou https://.")
    .nullable()
    .optional(),
  plataforma: z
    .enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter", "pinterest"])
    .optional(),
  horario: z.string().nullable().optional(),
  // A DATA PASSA POR AQUI DESDE A 0044, e o comentário abaixo mudou junto: a
  // `posts_protege_colunas` deixou de recusá-la, porque quem produz é quem
  // decide quando o post vai ao ar. Cliente e responsável continuam de fora.
  data_publicacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida.")
    .nullable()
    .optional(),
  status: z
    .enum([
      "aguardando_informacoes", "em_producao", "em_aprovacao",
      "ajustes", "aprovado", "rejeitado", "stand_by",
    ])
    .optional(),
});

/**
 * Editar o conteúdo. **Vale para a gestão e para quem recebeu o post.**
 *
 * Cliente e responsável NÃO passam por aqui — têm ação própria, e o trigger
 * `posts_protege_colunas` recusa o colaborador que montar a requisição à mão.
 * Deixá-los neste esquema faria a action oferecer um caminho que o banco nega,
 * e a pessoa descobriria isso no toast.
 *
 * **A DATA passou a entrar** (0044, decisão do usuário): o mês de social abre
 * em branco e quem produz distribui os dias. O que continua travado é enviar
 * um post sem data ao cliente — e quem recusa isso é `validar_nova_rodada`.
 */
export async function editarPost(id: string, dados: unknown): Promise<Resultado> {
  return executarAcao("editarPost", async () => {
    await exigirEquipeNaAcao();

    const validacao = esquemaDeEdicao.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("editarPost", validacao.error, dados, "Confira os campos.", ROTULOS),
      );
    }

    const supabase = await criarClienteServidor();
    // `.select()` porque o RLS pode barrar: sem ele, um update recusado volta
    // sem erro e sem linha, e a tela diz "salvo" a toa.
    const { data, error } = await supabase
      .from("posts")
      .update(validacao.data)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) {
      return falha("O banco recusou. Este post está com outra pessoa — só quem recebeu edita.");
    }

    revalidatePath(ROTA);
    return sucesso("Salvo.");
  });
}

/**
 * Liberar para quem vai produzir. **É da gestão**, e o aviso é do banco: o
 * trigger `posts_avisa_responsavel` chama `notificar()`, que nunca avisa quem
 * causou o aviso — então a gestão que libera para si mesma não recebe nada.
 */
export async function liberarPost(
  id: string,
  responsavelId: string | null,
): Promise<Resultado> {
  return executarAcao("liberarPost", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("posts")
      .update({ responsavel_id: responsavelId })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Liberar post é do desenvolvedor ou do sócio.");

    revalidatePath(ROTA);
    return sucesso(
      responsavelId ? "Liberado. A pessoa foi avisada." : "O post voltou a não ter dono.",
    );
  });
}

const esquemaDeVersao = z.object({
  arquivos: z
    .array(
      z.object({
        url: z.string().min(1),
        thumbnail_url: z.string().nullable().optional(),
        nome: z.string().nullable().optional(),
      }),
    )
    .default([]),
  arte_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional(),
  legenda: z.string().nullable().optional(),
  notas_mudanca: z.string().trim().nullable().optional(),
});

/**
 * Gravar uma versão nova.
 *
 * **Versão fechada nunca é reescrita**, como a rodada de aprovação: cada
 * subida cria uma linha com número maior, e as anteriores continuam no banco
 * com o que foi entregue. Quem numera é o trigger `post_versions_numera`, para
 * duas abas salvando ao mesmo tempo não baterem no `unique`.
 *
 * A CAPA do post sai daqui por trigger — `post_versions_sincroniza` copia o
 * primeiro slide para `posts.arte_url`. Sem isso, subir cinco slides deixaria
 * o card e o calendário sem imagem nenhuma.
 */
export async function gravarVersao(postId: string, dados: unknown): Promise<Resultado> {
  return executarAcao("gravarVersao", async () => {
    const sessao = await exigirEquipeNaAcao();

    const validacao = esquemaDeVersao.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao("gravarVersao", validacao.error, dados, "Confira os arquivos.", ROTULOS),
      );
    }
    const entrada = validacao.data;

    if (
      entrada.arquivos.length === 0 &&
      !entrada.arte_url &&
      !entrada.video_url &&
      entrada.legenda === undefined
    ) {
      return falha("Não há nada de novo nesta versão.");
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("post_versions")
      .insert({
        post_id: postId,
        arquivos: entrada.arquivos as ArquivoDaVersao[],
        arte_url: entrada.arte_url ?? null,
        thumbnail_url: entrada.thumbnail_url ?? null,
        video_url: entrada.video_url ?? null,
        legenda: entrada.legenda ?? null,
        notas_mudanca: entrada.notas_mudanca || null,
        criado_por: sessao.usuarioId,
      })
      .select("numero_versao")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou a versão.");

    revalidatePath(ROTA);
    return sucesso(`Versão ${data.numero_versao} gravada.`);
  });
}

/**
 * Pedir o aval interno. **É de quem produziu**, e o banco confere: depois da
 * 0042 quem produziu é o `responsavel_id`, não quem abriu o briefing.
 */
export async function pedirAvalInterno(postId: string): Promise<Resultado> {
  return executarAcao("pedirAvalInterno", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data: post } = await supabase
      .from("posts")
      .select("versao_atual")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return falha("Post não encontrado.");

    const { error } = await supabase.from("approval_rounds").insert({
      content_type: "post",
      content_id: postId,
      numero_rodada: post.versao_atual,
      escopo: "interna",
      solicitado_por: sessao.usuarioId,
      status: "pendente",
    });

    if (error) return falha(error.message);

    revalidatePath(ROTA);
    revalidatePath("/painel/aprovacoes-internas");
    return sucesso("Enviado para o aval interno. A gestão decide e depois manda ao cliente.");
  });
}

/**
 * Enviar ao cliente. **ENVIAR É ABRIR A RODADA DE ESCOPO CLIENTE** — o carimbo
 * `posts.enviado_em` é consequência dela, pelo trigger
 * `approval_rounds_marca_post` da 0032, e não um segundo comando.
 *
 * Separados, daria para ter rodada de cliente num post que ele não enxerga — a
 * fila mostraria uma decisão impossível — e post carimbado sem rodada nenhuma,
 * com o cliente vendo material sem ter onde decidir.
 *
 * As três recusas que podem vir do banco: não ser gestão, ter sido quem
 * produziu, e vídeo sem link. A mensagem delas chega pronta e a tela mostra.
 */
export async function enviarAoCliente(postId: string): Promise<Resultado> {
  return executarAcao("enviarAoCliente", async () => {
    const sessao = await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data: post } = await supabase
      .from("posts")
      .select("versao_atual, responsavel_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return falha("Post não encontrado.");

    // A MESMA PERGUNTA QUE O BANCO FAZ, antes da viagem. Ela não substitui a
    // trava — `validar_nova_rodada` recusa de qualquer jeito —, mas a recusa
    // dele chega como exceção de constraint, e esta chega como frase.
    if (post.responsavel_id === sessao.usuarioId) {
      return falha(
        "Ninguém envia ao cliente a própria entrega. Peça a outra pessoa da gestão.",
      );
    }

    const { error } = await supabase.from("approval_rounds").insert({
      content_type: "post",
      content_id: postId,
      numero_rodada: post.versao_atual,
      escopo: "cliente",
      solicitado_por: sessao.usuarioId,
      status: "pendente",
    });

    if (error) return falha(error.message);

    revalidatePath(ROTA);
    return sucesso("Enviado. O cliente já vê o post no portal dele.");
  });
}

/** Excluir. **É da gestão** — `posts_delete` fecha em `is_gestor()` desde a 0032. */
export async function excluirPost(id: string): Promise<Resultado> {
  return executarAcao("excluirPost", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("posts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Excluir post é do desenvolvedor ou do sócio.");

    revalidatePath(ROTA);
    return sucesso("Post excluído.");
  });
}

/* ==========================================================================
 * A CORRENTE (0045)
 * ========================================================================== */

const esquemaDoMes = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês."),
  quantidades: z.record(z.string(), z.number().int().min(0).max(60)),
  responsaveis: z.record(z.string(), z.string().uuid().nullable()),
});

/**
 * Abrir o mês inteiro de um cliente.
 *
 * **Uma chamada só, e é `rpc` e não um laço de `insert` aqui.** Doze posts são
 * doze linhas, e se a décima falhar pelo PostgREST as nove primeiras ficam lá
 * — um mês aberto pela metade, que ninguém sabe se abriu. `abrir_mes_de_social`
 * é transacional: ou nascem todos ou não nasce nenhum.
 */
export async function abrirMesDeSocial(dados: unknown): Promise<Resultado<number>> {
  return executarAcao("abrirMesDeSocial", async () => {
    await exigirGestorNaAcao();

    const lido = esquemaDoMes.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("abrirMesDeSocial", lido.error, dados, "Confira o mês.", ROTULOS),
      );
    }

    const supabase = await criarClienteServidor();

    // Só as funções com nome escolhido viajam. Mandar `{"Design": null}` faria
    // o `coalesce` do banco gravar nulo por cima de nada — inofensivo, mas o
    // mapa passa a dizer que alguém escolheu "ninguém", que é outra coisa.
    const responsaveis: Record<string, string> = {};
    for (const [funcao, quem] of Object.entries(lido.data.responsaveis)) {
      if (quem) responsaveis[funcao] = quem;
    }

    const { data, error } = await supabase.rpc("abrir_mes_de_social", {
      p_client_id: lido.data.client_id,
      p_mes: lido.data.mes,
      p_quantidades: lido.data.quantidades,
      p_responsavel_id: null,
      p_responsaveis: responsaveis,
    });

    if (error) {
      // O `hint` do Postgres é metade da recusa: "o limite é 60" manda a pessoa
      // adivinhar, e "abra em duas vezes" é a instrução.
      return falha([error.message, error.hint].filter(Boolean).join(" "));
    }

    revalidatePath(ROTA);
    const quantos = Number(data ?? 0);
    return sucesso(
      quantos === 1 ? "1 post aberto, sem data." : `${quantos} posts abertos, sem data.`,
      quantos,
    );
  });
}

const esquemaDaEtapa = z.object({
  status: z.enum([
    "nao_iniciada",
    "em_andamento",
    "aguardando_informacoes",
    "enviada_aprovacao",
    "em_ajustes",
    "concluida",
  ]),
});

/**
 * Mover uma etapa da corrente.
 *
 * Termina com `.select()`: sem ele um `update` que a RLS barra volta sem erro e
 * sem linha, e a tela diz "salvo" à toa. Se não voltou linha, é recusa — e a
 * mensagem precisa dizer isso.
 */
export async function moverEtapaDoPost(
  etapaId: string,
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("moverEtapaDoPost", async () => {
    await exigirEquipeNaAcao();

    const lido = esquemaDaEtapa.safeParse(dados);
    if (!lido.success) {
      return falha(
        recusaDeValidacao("moverEtapaDoPost", lido.error, dados, "Confira o andamento.", {
          status: "andamento",
        }),
      );
    }

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("post_etapas")
      .update({ status: lido.data.status })
      .eq("id", etapaId)
      .select("id");

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));
    if (!data || data.length === 0) {
      return falha("Esta etapa não é sua, e mover a etapa de outra pessoa é da gestão.");
    }

    revalidatePath(ROTA);
    return sucesso("Andamento atualizado.");
  });
}

/** Passar uma etapa para alguém. Da gestão — a policy e o trigger recusam o resto. */
export async function definirDonoDaEtapa(
  etapaId: string,
  responsavelId: string | null,
): Promise<Resultado> {
  return executarAcao("definirDonoDaEtapa", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("post_etapas")
      .update({ responsavel_id: responsavelId })
      .eq("id", etapaId)
      .select("id");

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));
    if (!data || data.length === 0) return falha("Não foi possível alterar esta etapa.");

    revalidatePath(ROTA);
    return sucesso(responsavelId ? "Etapa passada adiante." : "Etapa sem dono.");
  });
}


const esquemaDaReferencia = z.object({
  url: z
    .string()
    .trim()
    .regex(/^https?:\/\//i, "O endereço precisa começar com http:// ou https://."),
  titulo: z.string().trim().nullable().optional(),
});

/**
 * Juntar uma referência de apoio ao card (0046).
 *
 * É de `is_staff()` e não da gestão, ao contrário de abrir o post: o ponto do
 * módulo é que quem pega a etapa preenche o card. Quem assina é o trigger —
 * policy não limita coluna, e sem ele um PATCH poria a referência no nome de
 * outra pessoa.
 */
export async function juntarReferencia(
  postId: string,
  dados: unknown,
): Promise<Resultado> {
  return executarAcao("juntarReferencia", async () => {
    await exigirEquipeNaAcao();

    const validacao = esquemaDaReferencia.safeParse(dados);
    if (!validacao.success) {
      return falha(
        recusaDeValidacao(
          "juntarReferencia",
          validacao.error,
          dados,
          "Confira o endereço.",
          ROTULOS,
        ),
      );
    }

    const supabase = await criarClienteServidor();
    const { error } = await supabase.from("post_referencias").insert({
      post_id: postId,
      url: validacao.data.url,
      titulo: validacao.data.titulo || null,
    });

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));

    revalidatePath(ROTA);
    return sucesso("Referência adicionada.");
  });
}

/**
 * Apagar uma referência. Quem pôs, ou a gestão.
 *
 * `.select()` porque o RLS pode barrar: sem ele um delete recusado volta sem
 * erro e sem linha, e a tela diz "apagada" à toa. Não existe editar — mudar o
 * endereço de uma referência que alguém já abriu é trocar o destino embaixo de
 * quem a leu, e por isso a tabela não tem policy de UPDATE.
 */
export async function apagarReferencia(id: string): Promise<Resultado> {
  return executarAcao("apagarReferencia", async () => {
    await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("post_referencias")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));
    if (!data || data.length === 0) {
      return falha("Esta referência é de outra pessoa, e só a gestão apaga a dos outros.");
    }

    revalidatePath(ROTA);
    return sucesso("Referência removida.");
  });
}
