"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exigirAtendimentoNaAcao,
  exigirEquipeNaAcao,
  exigirGestorNaAcao,
} from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { recusaDeValidacao } from "@/lib/acoes/validacao";
import { nomeDaPastaDoMes } from "@/lib/dominio/posts";
import { pastaDaEntregaDaDemanda } from "@/lib/drive/pastas";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ArquivoDaVersao } from "@/lib/supabase/database.types";
import { anunciar } from "@/lib/acoes/ao-vivo";
import { clientesQueQueremReceber } from "@/lib/email/destinatarios";
import { despacharEmail } from "@/lib/email/enviar";
import { materialParaAprovar } from "@/lib/email/mensagens";

/**
 * As ações do Social Media interno.
 *
 * **A CORRENTE É DE BANCO, e estas funções escrevem a frase que a pessoa lê.**
 * Nenhuma guarda daqui é a trava: `posts_insert` fecha em `is_gestor()`,
 * `posts_update` em gestão ou responsável, `posts_protege_colunas` recusa o
 * colaborador que tenta trocar cliente, responsável ou data, e
 * `validar_nova_rodada` decide quem envia ao cliente. As
 * guardas daqui existem para a recusa chegar em português e antes da viagem —
 * é a mesma dupla de `lib/tasks/state-machine.ts` com os triggers da 0007.
 */

const ROTA = "/painel/social-media";

/**
 * Revalida a minha tela e avisa a dos outros.
 *
 * Aqui isto vale mais que nas demais: a corrente do post passa de mão em mão
 * — Pauta, Conteúdo, Layout, Envio, Programar —, e quem recebe a etapa
 * costuma estar com a tela aberta esperando. Sem o aviso, a pessoa fica
 * olhando um post que já é dela e não sabe.
 */
function revalidar() {
  revalidatePath(ROTA);
  anunciar("post");
}

const ROTULOS = {
  client_id: "cliente",
  tema: "tema",
  pauta: "pauta",
  url: "endereço da referência",
  data_publicacao: "data de publicação",
  plataformas: "redes",
  video_url: "link do vídeo",
  flow_id: "fluxo deste mês",
} as const;

const esquemaDeAbertura = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  tema: z.string().trim().min(2, "Escreva o tema do post."),
  data_publicacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  horario: z.string().nullable().optional(),
  // UMA LISTA, e com ao menos uma (0082). O `min(1)` repete o
  // `posts_plataformas_nao_vazia` do banco de propósito: quem escreve a
  // mensagem é a action, quem recusa é o `check` — as duas pontas da regra
  // que mora nos dois lados.
  plataformas: z
    .array(
      z.enum([
        "instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter", "pinterest",
      ]),
    )
    .min(1, "Escolha ao menos uma rede."),
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
        plataformas: entrada.plataformas,
        formato: entrada.formato || null,
        midia: entrada.midia,
        responsavel_id: entrada.responsavel_id ?? null,
        criado_por: sessao.usuarioId,
      })
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Abrir post é do desenvolvedor ou do sócio.");

    revalidar();
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
  plataformas: z
    .array(
      z.enum(["instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter", "pinterest"]),
    )
    .min(1, "Escolha ao menos uma rede.")
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

    revalidar();
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

    revalidar();
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

    revalidar();
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

    revalidar();
    revalidatePath("/painel/gestao-tasks");
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
      .select("versao_atual, responsavel_id, client_id, tema")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return falha("Post não encontrado.");

    // A TRAVA DE "PRÓPRIA ENTREGA" SAIU DAQUI NA 0060, e sair dos dois lados
    // no mesmo commit é o ponto: um `if` esquecido aqui continuaria recusando
    // com o banco já aceitando, que foi exatamente o que aconteceu na 0029 —
    // a bateria verde e o usuário clicando em Aprovar para descobrir.
    //
    // O que continua de pé é a guarda de perfil, logo acima: `enviarAoCliente`
    // é de `exigirGestorNaAcao`, e `validar_nova_rodada` faz a mesma pergunta
    // no banco.

    const { error } = await supabase.from("approval_rounds").insert({
      content_type: "post",
      content_id: postId,
      numero_rodada: post.versao_atual,
      escopo: "cliente",
      solicitado_por: sessao.usuarioId,
      status: "pendente",
    });

    if (error) return falha(error.message);

    // O E-MAIL SAI DAQUI, e não de um trigger, pela razão mecânica de sempre:
    // o Postgres não fala com o Resend. A consequência está dita no CLAUDE.md
    // — o sino nunca perde um aviso porque é do banco, e o e-mail perde tudo
    // o que não passar por uma action. Este caminho passa: enviar ao cliente
    // É abrir a rodada, e a rodada nasce aqui.
    despacharEmail(
      await clientesQueQueremReceber(post.client_id, "novo_conteudo"),
      materialParaAprovar({
        titulo: post.tema,
        oQueE: "um post",
        rota: `/portal/social-media/${postId}`,
      }),
    );

    revalidar();
    return sucesso("Enviado. O cliente já vê o post no portal dele.");
  });
}

/**
 * ENVIAR O MÊS AO CLIENTE, em lote.
 *
 * ---------------------------------------------------------------------------
 * **UMA CHAMADA SÓ, e é `rpc` porque é uma transação só.**
 * `enviar_mes_ao_cliente` grava o lote, abre uma rodada de cliente por peça e
 * toca um sino por pessoa da empresa — com dezoito peças isso seriam vinte
 * escritas pelo PostgREST, e a terceira falhando deixaria metade do mês fora
 * da agência com o lote dizendo que tudo saiu. É a decisão de
 * `abrir_campanha()` (0051) e de `solicitar_notas_do_mes()` (0066).
 *
 * **A GUARDA DAQUI É `exigirEquipeNaAcao`, e não a de gestão**, e a diferença
 * é a 0090: enviar ao cliente passou a ser de `is_gestor() or
 * is_atendimento()`, e `exigirGestorNaAcao` recusaria o Atendimento antes da
 * viagem — sobre uma ação que o banco aceita dele. É a lição da 0059 com
 * `abrirMesDeSocial`: quando a regra mora nos dois lados, o lado de cima
 * ficando mais apertado é a pessoa lendo "seu perfil não permite" numa ação
 * que é dela. Quem recusa de verdade é `validar_nova_rodada`.
 *
 * **E O AVISO AO CLIENTE É DO BANCO, nunca daqui.** `notificar()` nunca avisa
 * quem causou o aviso, nunca avisa quem saiu, e devolve `null` sem derrubar a
 * escrita quando não há a quem avisar — as três recusas da 0062, que uma
 * notificação escrita na camada de aplicação perderia de uma vez. O que sai
 * daqui é o e-mail, pela razão mecânica de sempre: o Postgres não fala com o
 * Resend.
 *
 * **É UM E-MAIL POR PESSOA E UM SINO POR PESSOA, nunca um por peça.** Dezoito
 * avisos para um envio é o caminho mais curto para o sino virar ruído, e a
 * caixa de entrada do cliente é pior ainda.
 * ---------------------------------------------------------------------------
 */
export async function enviarMesAoCliente(
  taskId: string,
  etapaId: string,
  recado?: string | null,
): Promise<Resultado<number>> {
  return executarAcao("enviarMesAoCliente", async () => {
    await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("enviar_mes_ao_cliente", {
      p_task_id: taskId,
      p_etapa_id: etapaId,
      p_recado: recado?.trim() || null,
    });

    if (error) {
      // O `hint` É METADE DA RECUSA, e aqui mais que em qualquer outro lugar
      // deste módulo: a recusa NOMEIA as peças que faltam, e a dica diz o que
      // fazer com elas. É a concatenação de `atualizarTask`, pela razão da
      // 0023 — dizer QUAIS é a diferença entre uma recusa e uma instrução.
      return falha([error.message, error.hint].filter(Boolean).join(" "));
    }

    const enviadas = data?.pecas ?? 0;

    // O E-MAIL FALA DO MÊS, e não de uma peça. Um por peça seria dezoito
    // mensagens sobre o mesmo envio, e a pessoa pararia de abrir a segunda.
    const { data: demanda } = await supabase
      .from("tasks")
      .select("client_id, social_do_mes")
      .eq("id", taskId)
      .maybeSingle();

    if (demanda?.client_id) {
      despacharEmail(
        await clientesQueQueremReceber(demanda.client_id, "novo_conteudo"),
        materialParaAprovar({
          titulo: `${enviadas} ${enviadas === 1 ? "material" : "materiais"} para a sua aprovação`,
          oQueE: "o social do mês",
          rota: demanda.social_do_mes
            ? `/portal/social-media?mes=${demanda.social_do_mes.slice(0, 7)}`
            : "/portal/social-media",
        }),
      );
    }

    revalidar();
    revalidatePath("/painel/gestao-tasks");
    return sucesso(
      enviadas === 1
        ? "Enviado. O cliente já vê o material no portal dele."
        : `Enviadas ${enviadas} peças. O cliente já vê o mês no portal dele.`,
      enviadas,
    );
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

    revalidar();
    return sucesso("Post excluído.");
  });
}

/* ==========================================================================
 * A CORRENTE (0045)
 * ========================================================================== */

const esquemaDoMes = z.object({
  client_id: z.string().uuid("Escolha o cliente."),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês."),
  // AS LINHAS DE COMBINAÇÃO (0082), e não mais um número por rede: um objeto
  // `{rede: n}` não sabe dizer "doze no Instagram JUNTO com o Facebook",
  // porque a chave é uma rede só. O `min(1)` em `redes` repete o
  // `posts_plataformas_nao_vazia` do banco — as duas pontas da regra.
  quantidades: z
    .array(
      z.object({
        redes: z
          .array(
            z.enum([
              "instagram", "facebook", "linkedin", "tiktok", "youtube", "twitter", "pinterest",
            ]),
          )
          .min(1, "Escolha ao menos uma rede em cada linha."),
        quantidade: z.number().int().min(0).max(60),
      }),
    )
    .min(1, "Escolha quantos posts abrir."),
  responsaveis: z.record(z.string(), z.string().uuid().nullable()),
  /**
   * O dia de cada etapa, em DIAS relativos à publicação (negativo = antes).
   *
   * A chave é o NOME da etapa e não a função, ao contrário de `responsaveis`:
   * Pauta e Programar são as duas de Social Media, e uma chave por função
   * daria às duas o mesmo dia — a pauta venceria junto com a programação,
   * que é o fim da corrente.
   *
   * O teto de 60 para cada lado é o mesmo do banco. Repetir o número aqui é
   * o que faz a recusa aparecer antes de a pessoa mandar; quem vale é o
   * `check` da 0059, e é ele que pega quem chamar a RPC direto.
   */
  // O PERÍODO DE CADA ETAPA (0084, decisão do usuário): a Pauta do mês inteiro
  // começa num dia e fecha noutro, e as duas pontas valem para todos os posts.
  //
  // As duas são OPCIONAIS dentro do par, pela decisão da 0027: quem abre o mês
  // costuma saber quando a etapa fecha e ainda não quando ela começa, e exigir
  // as duas faria a pessoa inventar uma.
  prazos: z
    .record(
      z.string(),
      z.object({
        inicio: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o início de cada etapa.")
          .or(z.literal(""))
          .optional(),
        fim: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o fim de cada etapa.")
          .or(z.literal(""))
          .optional(),
      }),
    )
    .optional(),
  /**
   * A pasta de entrega da DEMANDA do mês (0061).
   *
   * Ela é pedida aqui porque o mês de social deixou de ser N posts soltos e
   * passou a ser uma demanda com um post em cada etapa — e
   * `tasks_exige_pasta_de_entrega` (0015) recusa demanda nova sem pasta desde
   * o Sprint 9. Não há exceção a abrir: uma trava com exceção para o módulo
   * que abre sessenta demandas por mês é uma trava desligada.
   *
   * **Opcional aqui e obrigatória lá**, e não é descuido: abrir o mesmo mês em
   * duas vezes — doze no Instagram hoje, quatro no LinkedIn amanhã —
   * acrescenta etapas à demanda que já existe, e aí não há pasta a pedir. Quem
   * sabe se a demanda já existe é o banco; repetir essa pergunta aqui seria
   * criar o segundo lugar onde as duas respostas divergem.
   */
  link_entrega: z.string().trim().url("A pasta precisa ser um endereço.").optional(),
  /**
   * O FLUXO que este mês percorre (0087).
   *
   * Nulo é "o padrão desta conta, senão o da casa", e quem responde isso é
   * `fluxo_do_mes()` no banco — a tela não repete a ordem. E quem recusa um
   * uuid que não é fluxo nenhum é a chave estrangeira de `tasks.social_flow_id`,
   * não uma lista copiada aqui: foi assim que a lista de nomes de etapa da
   * 0076 deixou de precisar de um `z.enum` montado à mão.
   */
  flow_id: z.string().uuid().nullable().optional(),
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
    // `exigirAtendimentoNaAcao` E NÃO `exigirGestorNaAcao`, e a troca conserta
    // uma divergência: a 0046 abriu a função para `is_atendimento()` — "o
    // ATENDIMENTO abre o mês", decisão do usuário — e esta guarda continuou em
    // gestão. O banco aceitava e a tela recusava antes, então a pessoa do
    // Atendimento lia "seu perfil não permite esta ação" numa ação que o
    // produto diz que é dela.
    //
    // É a lição da 0029 de novo, virada: quando a regra mora nos dois lados,
    // mudar um não muda nada — e aqui o lado que ficou para trás era o de cima,
    // que é o que a pessoa encontra.
    await exigirAtendimentoNaAcao();

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

    // Mesma limpeza dos responsáveis, pelo mesmo motivo: etapa sem dia
    // escolhido não viaja. Mandar `{"Layout": null}` faria o banco gravar nulo
    // por cima de nada — inofensivo, e o mapa passaria a dizer que alguém
    // escolheu "sem dia", que é outra coisa.
    // A PONTA VAZIA VIRA AUSÊNCIA, e não string vazia: o banco faz
    // `nullif(btrim(...), '')`, então as duas formas gravam nulo — mas o mapa
    // que viaja é o que alguém vai ler num log, e `{"inicio": ""}` diz que
    // escolheram "sem dia", que é outra coisa de não ter escolhido.
    const prazos: Record<string, { inicio?: string; fim?: string }> = {};
    for (const [etapa, par] of Object.entries(lido.data.prazos ?? {})) {
      const inicio = (par?.inicio ?? "").trim();
      const fim = (par?.fim ?? "").trim();
      if (inicio.length === 0 && fim.length === 0) continue;
      prazos[etapa] = {
        ...(inicio.length > 0 ? { inicio } : {}),
        ...(fim.length > 0 ? { fim } : {}),
      };
    }

    const { data, error } = await supabase.rpc("abrir_mes_de_social", {
      p_client_id: lido.data.client_id,
      p_mes: lido.data.mes,
      p_quantidades: lido.data.quantidades,
      p_responsavel_id: null,
      p_responsaveis: responsaveis,
      p_prazos: prazos,
      p_link_entrega: lido.data.link_entrega ?? null,
      p_flow_id: lido.data.flow_id ?? null,
    });

    if (error) {
      // O `hint` do Postgres é metade da recusa: "o limite é 60" manda a pessoa
      // adivinhar, e "abra em duas vezes" é a instrução.
      return falha([error.message, error.hint].filter(Boolean).join(" "));
    }

    revalidar();
    const quantos = Number(data ?? 0);
    // A FRASE DIZ QUE NASCEU UMA DEMANDA, e não só quantos posts. Quem abre o
    // mês não está pensando em Gestão de Tasks, e vai encontrar a demanda lá
    // no dia seguinte sem saber de onde ela veio.
    return sucesso(
      quantos === 1
        ? "1 post aberto, sem data, na demanda do mês."
        : `${quantos} posts abertos, sem data, na demanda do mês.`,
      quantos,
    );
  });
}

/**
 * MARCAR O POST NESTA ETAPA DO MÊS (0088).
 *
 * -------------------------------------------------------------------------
 * **`moverEtapaDoPost` e `definirDonoDaEtapa` SAÍRAM, e não foram
 * aposentadas ao lado desta.**
 *
 * As duas escreviam em `post_etapas` — a corrente por post, que a 0088
 * apagou. O que elas faziam continua existindo e mudou de porta: a etapa do
 * mês é uma SUBTAREFA comum, então mover o andamento dela é o seletor de
 * status de sempre e passá-la adiante é o campo de responsável da etapa, em
 * Gestão de Tasks, com as travas da 0007 valendo e o cronômetro correndo.
 *
 * Mantê-las aqui apontando para as mesmas colunas de `subtasks` daria duas
 * portas para o mesmo fato, e a que divergisse seria esta — a que quase
 * ninguém exercita. É a decisão da 0023.
 * -------------------------------------------------------------------------
 *
 * O que não existia é isto: a etapa é do mês e o trabalho é por peça, então
 * a pessoa precisa dizer QUAIS posts ela já fez dentro da fase dela. É a
 * caixinha, e o "12 de 18" do cabeçalho é a soma delas.
 *
 * **Quem recusa é `post_etapa_progresso_regras`**, e as duas travas estão lá:
 * a caixinha da entrega não se marca à mão (ela é consequência da aprovação
 * daquele post) e nenhuma caixinha fecha com um portão anterior ainda não
 * aprovado pelo cliente. `bloqueioDaCaixinha()` faz a mesma pergunta na tela,
 * para a caixa aparecer desligada com a razão escrita em vez de recusar no
 * clique — a dupla de sempre, e a tela nunca é a trava.
 *
 * Termina com `.select()`: sem ele um `update` que a RLS barra volta sem erro
 * e sem linha, e a tela diz "salvo" à toa. Aqui ela barra de verdade — a
 * policy de UPDATE aceita a gestão ou quem é dono daquela etapa do mês.
 */
export async function marcarPostNaEtapa(
  postId: string,
  etapaId: string,
  concluido: boolean,
): Promise<Resultado> {
  return executarAcao("marcarPostNaEtapa", async () => {
    await exigirEquipeNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("post_etapa_progresso")
      .update({ concluido })
      .eq("post_id", postId)
      .eq("subtask_id", etapaId)
      .select("id");

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));
    if (!data || data.length === 0) {
      return falha(
        "Esta etapa não é sua, e marcar a etapa de outra pessoa é da gestão.",
      );
    }

    revalidar();
    return sucesso(concluido ? "Post marcado nesta etapa." : "Marca desfeita.");
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

    revalidar();
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

    revalidar();
    return sucesso("Referência removida.");
  });
}


/**
 * Apagar a arte, ou um slide do carrossel (0048).
 *
 * **GRAVA UMA VERSÃO NOVA, e não reescreve a atual.** "Sempre registrando no
 * histórico" foi o pedido, e é a regra do módulo desde a 0032: cada subida é
 * uma versão, e as anteriores continuam lá — é por isso que o portal não tem
 * botão de reverter. Remover é a mesma operação vista do avesso.
 *
 * **O arquivo continua no bucket.** A versão anterior aponta para ele, e o
 * histórico existe para ser aberto: apagar o objeto deixaria a v1 com uma
 * moldura cinza no lugar de uma arte, e ninguém saberia se ela nunca existiu
 * ou se alguém a removeu.
 */
export async function removerArquivoDaVersao(
  postId: string,
  /** O índice do slide, ou `null` para a arte única. */
  indice: number | null,
): Promise<Resultado> {
  return executarAcao("removerArquivoDaVersao", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const { data: post } = await supabase
      .from("posts")
      .select("versao_atual")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return falha("Post não encontrado.");

    const { data: versao } = await supabase
      .from("post_versions")
      .select("arquivos, arte_url, thumbnail_url")
      .eq("post_id", postId)
      .order("numero_versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const atuais = ((versao?.arquivos ?? []) as ArquivoDaVersao[]).slice();

    // A ARTE ÚNICA E O SLIDE SÃO O MESMO CAMINHO quando sobra zero: os dois
    // gravam uma versão que diz "não há mais material". O que muda é a frase
    // do histórico, porque é ela que alguém vai ler daqui a três semanas.
    let restantes: ArquivoDaVersao[] = [];
    let nota = "Arte removida";

    if (indice !== null) {
      if (indice < 0 || indice >= atuais.length) {
        return falha("Este slide não existe mais — recarregue a tela.");
      }
      nota = `Slide ${indice + 1} de ${atuais.length} removido`;
      restantes = atuais.filter((_, i) => i !== indice);
    }

    const { data, error } = await supabase
      .from("post_versions")
      .insert({
        post_id: postId,
        arquivos: restantes,
        // O SINAL SÓ VAI QUANDO NÃO SOBROU NADA. Removendo o slide 3 de 5, a
        // versão nova tem quatro arquivos e a capa sai do primeiro deles —
        // mandar o sinal aqui apagaria a capa de um carrossel que ainda tem
        // arte.
        removeu_arquivos: restantes.length === 0,
        notas_mudanca: nota,
        criado_por: sessao.usuarioId,
      })
      .select("numero_versao")
      .maybeSingle();

    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));
    if (!data) {
      return falha("Não foi possível gravar a remoção — este post não é seu.");
    }

    revalidar();
    return sucesso(`${nota}. Ficou na versão ${data.numero_versao}.`);
  });
}

/**
 * A pasta do mês no Drive, para o diálogo de abrir o mês (0061).
 *
 * **Irmã de `criarPastaDeEntrega` em Gestão de Tasks, e não a mesma função**,
 * porque a pergunta é outra: lá a demanda já existe e a pasta nasce com o
 * título dela; aqui a demanda ainda não existe — é justamente a pasta que
 * falta para ela poder nascer. Passar um id de task que não existe seria
 * inventar um parâmetro para reaproveitar quinze linhas.
 *
 * O que as duas compartilham é `pastaDaEntregaDaDemanda()`, que é onde mora a
 * decisão de verdade: achar ou criar a pasta do cliente, gravar o id dela na
 * ficha, e pendurar a do mês embaixo.
 *
 * **NÃO é `after()`**, ao contrário do e-mail: a pessoa está esperando o
 * endereço, que é o que ela veio buscar. O e-mail é aviso; isto é o trabalho.
 */
export async function criarPastaDoMesDeSocial(
  clienteId: string,
  mes: string,
): Promise<Resultado<string>> {
  return executarAcao("criarPastaDoMesDeSocial", async () => {
    // A MESMA GUARDA DE ABRIR O MÊS, e não `exigirGestorNaAcao`: quem abre o
    // mês é o Atendimento desde a 0046, e uma guarda mais apertada aqui faria
    // a pessoa do Atendimento levar "seu perfil não permite" no botão que
    // existe só para ela conseguir abrir o mês.
    await exigirAtendimentoNaAcao();

    if (!/^\d{4}-\d{2}$/.test(mes)) return falha("Escolha o mês antes.");
    if (!clienteId) return falha("Escolha o cliente antes — a pasta nasce dentro da dele.");

    const { url, clienteNasceuAgora } = await pastaDaEntregaDaDemanda(
      clienteId,
      nomeDaPastaDoMes(mes),
    );

    // NADA É GRAVADO AQUI. A demanda do mês ainda não existe, e quem grava o
    // endereço nela é `abrir_mes_de_social()`, na mesma transação em que ela
    // nasce. O que volta é o endereço, para o campo do diálogo.
    return sucesso(
      clienteNasceuAgora
        ? "Pasta do mês criada. O cliente também ganhou a dele, no Drive da agência."
        : "Pasta do mês criada dentro da pasta do cliente.",
      url,
    );
  });
}

/**
 * O que sai junto ao apagar um mês inteiro.
 *
 * O diálogo CONTA o que vai junto em vez de perguntar "tem certeza?" — a
 * decisão do diálogo de apagar campanha. E a contagem sai da MESMA ponte que
 * o apagamento usa, pela razão de `quem_deve_nota()` na 0066: duas contas
 * dariam um diálogo prometendo doze e um apagamento alcançando onze.
 *
 * **AS FASES E AS MARCAÇÕES SÃO DOIS NÚMEROS desde a 0088**, e juntá-los
 * daria "noventa etapas" num mês de cinco: a fase é do mês, a marcação é a
 * caixinha de uma peça dentro dela. O tipo deste arquivo tinha ficado na
 * forma de seis colunas da 0086 — `create or replace` não troca o tipo de
 * retorno de uma função `returns table`, então a 0088 fez `drop` antes, e a
 * coluna nova entrou no meio sem nada aqui reclamar.
 */
export async function oQueVaiComOMes(taskId: string): Promise<
  Resultado<{
    posts: number;
    enviados: number;
    aprovados: number;
    versoes: number;
    /** As fases do mês — cinco num fluxo padrão. */
    etapas: number;
    /** As caixinhas: uma por peça em cada fase. Dezoito posts × cinco = 90. */
    marcacoes: number;
    comentarios: number;
  }>
> {
  return executarAcao("oQueVaiComOMes", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("o_que_vai_com_o_mes", { p_task_id: taskId });
    if (error) return falha(error.message);

    const linha = data?.[0];
    if (!linha) return falha("Esta demanda não é um mês de social.");
    return sucesso("", linha);
  });
}

/**
 * Apaga o mês inteiro: os posts e a demanda, numa transação só.
 *
 * **O VÍNCULO É NOS DOIS SENTIDOS** (migration 0086, decisão do usuário): se
 * a demanda é apagada o social vai junto, e se o mês é apagado a demanda vai
 * junto. Quem garante isso é o trigger `tasks_apaga_o_social` e não esta
 * action — com a trava escrita só aqui, apagar a demanda no board de Gestão
 * de Tasks seria a porta dos fundos dela, e é a que não pergunta nada.
 *
 * A recusa do banco vem com `hint`, e ele diz as duas saídas — arquivar e
 * limpar os posts. Por isso a mensagem concatena os dois: uma trava que só diz
 * "não pode" devolve a pessoa ao apagar um por um, que é o que o pedido
 * existe para resolver.
 */
export async function apagarMesDeSocial(taskId: string): Promise<Resultado> {
  return executarAcao("apagarMesDeSocial", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("apagar_mes_de_social", { p_task_id: taskId });
    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));

    revalidatePath(ROTA);
    revalidatePath("/painel/gestao-tasks");
    await anunciar("task");
    return sucesso(`Mês apagado, com ${data ?? 0} post(s).`);
  });
}

/**
 * Apaga só os posts e deixa a demanda, as etapas e os prazos de pé.
 *
 * Para quem errou a grade mas acertou os responsáveis. A trava do post já
 * enviado vale aqui também: ela é sobre o MATERIAL que o cliente viu, não
 * sobre a casca.
 */
export async function limparPostsDoMes(taskId: string): Promise<Resultado> {
  return executarAcao("limparPostsDoMes", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase.rpc("limpar_posts_do_mes", { p_task_id: taskId });
    if (error) return falha([error.message, error.hint].filter(Boolean).join(" "));

    revalidatePath(ROTA);
    revalidatePath("/painel/gestao-tasks");
    await anunciar("task");
    return sucesso(`${data ?? 0} post(s) apagado(s). A demanda e as etapas ficaram.`);
  });
}

/**
 * Tira o mês da navegação padrão, ou devolve.
 *
 * É o que a recusa oferece no lugar quando o cliente já viu alguma coisa, e é
 * **reversível e não apaga nada** — por isso ele é um carimbo
 * (`tasks.arquivada_em`) e não um valor de enum: `task_status` tem sete e
 * nenhum deles é "arquivado", e no enum ele entraria no seletor dos sete e
 * viraria coluna no board. É a decisão de `publicada_em` (0028).
 *
 * Ela escreve por `update` e não por RPC: a policy de `tasks` já decide quem
 * mexe numa demanda, e uma função só para carimbar uma coluna seria uma
 * segunda porta para o que a policy já governa.
 */
export async function arquivarMesDeSocial(
  taskId: string,
  arquivar: boolean,
): Promise<Resultado> {
  return executarAcao("arquivarMesDeSocial", async () => {
    await exigirGestorNaAcao();

    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("tasks")
      .update({ arquivada_em: arquivar ? new Date().toISOString() : null })
      .eq("id", taskId)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data) return falha("O banco recusou. Arquivar um mês é do desenvolvedor ou do sócio.");

    revalidatePath(ROTA);
    revalidatePath("/painel/gestao-tasks");
    return sucesso(arquivar ? "Mês arquivado." : "Mês de volta à navegação.");
  });
}
