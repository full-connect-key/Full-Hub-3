import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { assinarArquivos } from "@/lib/dados/conteudo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import type {
  ApprovalRound,
  SubtaskEntrega,
  TipoAprovacao,
} from "@/lib/supabase/database.types";

import type { Pessoa } from "./tasks";

/** O mesmo bucket privado de `lib/dados/social-media.ts`. */
const BUCKET_DAS_ARTES = "posts-artes";

/**
 * A fila de aprovações internas.
 *
 * Duas listas, e a diferença entre elas é o ponto do fluxo:
 *
 *   **Esperando decisão** — alguém produziu e mandou validar.
 *   **Prontas para enviar ao cliente** — já passaram pelo aval interno, mas
 *     ninguém apertou o botão. Aprovar diz que o material está bom; enviar diz
 *     que é agora. São duas decisões, e juntá-las já mandou peça errada para
 *     cliente em muita agência.
 *
 * O RLS já limita o que cada perfil lê; aqui não repetimos a regra.
 *
 * ---------------------------------------------------------------------------
 * **O POST ENTRA NESTA FILA, e antes disso ele não saía de lugar nenhum.**
 *
 * `pedirAvalInterno()` abre a rodada interna do post desde a 0042 — e até
 * aqui **nada no produto conseguia decidi-la**: esta consulta filtrava
 * `content_type = 'subtask'`, e `aprovarInterna()` parava em
 * `aindaNaoTratado`. O post ficava em "Revisão" para sempre, e como
 * `podeEnviarAoCliente()` exige o aval, ele nunca chegava ao cliente.
 *
 * Não foi esquecimento de banco: `approval_rounds_decide` aceita post desde a
 * **0033**, por `pode_aprovar_post()`. A ponte estava construída e ninguém a
 * atravessava — a terceira do produto, junto com `deliverables.subtask_id`
 * antes da 0051 e `clients.drive_folder_id` antes da integração com o Drive.
 * O próprio `pedirAvalInterno` já chamava `revalidatePath` desta rota.
 *
 * Por isso não há migration aqui: o que faltava era a tela ler os dois tipos.
 * ---------------------------------------------------------------------------
 */

/**
 * Um anexo para olhar antes de decidir.
 *
 * A etapa traz `subtask_entregas`; o post traz a arte da versão corrente,
 * assinada. **Não é enfeite:** aprovar sem ver o material é exatamente o que
 * o Sprint 12 evitou ao pôr a arte antes dos botões no portal, e um botão
 * "Aprovar" numa linha sem nada para olhar convida ao mesmo erro do lado de
 * cá.
 */
export type AnexoDaFila = { id: string; nome: string; url: string };

export type ItemDaFila = {
  rodadaId: string | null;
  /**
   * O que está sendo decidido. A fila deixou de ser só de etapa: o post entra
   * por aqui desde que a tela passou a ler os dois tipos.
   */
  tipo: "subtask" | "post";
  contentId: string;
  numeroRodada: number;
  /** O nome do que se decide: o título da etapa, ou o tema do post. */
  titulo: string;
  /** Onde ele vive: a demanda, ou a linha do social. */
  contexto: string;
  /** Para onde o clique leva. */
  rota: string;
  cliente: string | null;
  responsavel: Pessoa | null;
  tipoAprovacao: TipoAprovacao;
  /** Desde quando espera. */
  desde: string;
  anexos: AnexoDaFila[];
};

export type FilaDeAprovacoes = {
  esperando: ItemDaFila[];
  prontasParaOCliente: ItemDaFila[];
};

export async function filaDeAprovacoes(): Promise<FilaDeAprovacoes> {
  const [deEtapas, dePosts] = await Promise.all([
    etapasNaFila(),
    postsNaFila(),
  ]);

  const esperando = [...deEtapas.esperando, ...dePosts.esperando];
  const prontasParaOCliente = [
    ...deEtapas.prontasParaOCliente,
    ...dePosts.prontasParaOCliente,
  ];

  // QUEM ESPERA HÁ MAIS TEMPO VEM PRIMEIRO, e a ordenação é feita depois de
  // juntar as duas origens — não dentro de cada uma. Ordenar separado e
  // concatenar daria uma fila em que todo post vem depois de toda etapa,
  // inclusive o post parado há uma semana atrás da etapa de hoje. A fila
  // justa é a que não deixa nada esquecido no fim da lista, e ela é uma só.
  const maisAntigoPrimeiro = (a: ItemDaFila, b: ItemDaFila) =>
    a.desde.localeCompare(b.desde);

  return {
    esperando: esperando.sort(maisAntigoPrimeiro),
    prontasParaOCliente: prontasParaOCliente.sort(maisAntigoPrimeiro),
  };
}

/** As rodadas internas de ETAPA de demanda. */
async function etapasNaFila(): Promise<FilaDeAprovacoes> {
  const supabase = await criarClienteServidor();

  // Trazer as decididas junto é o que permite descobrir quais já têm aval e
  // estão só esperando o envio.
  const rodadas = ouFalha(
    "a fila de aprovações internas",
    await supabase
      .from("approval_rounds")
      .select("*")
      .eq("content_type", "subtask")
      .order("numero_rodada", { ascending: false }),
  );

  const todas = (rodadas ?? []) as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], prontasParaOCliente: [] };

  const idsDeSubtarefas = [...new Set(todas.map((r) => r.content_id))];

  const [subtarefas, entregas] = await Promise.all([
    supabase
      .from("subtasks")
      .select(
        "id, task_id, titulo, responsavel_id, tipo_aprovacao, requer_aprovacao, status",
      )
      .in("id", idsDeSubtarefas)
      .then((r) => ouFalha("as etapas da fila", r)),
    supabase
      .from("subtask_entregas")
      .select("*")
      .in("subtask_id", idsDeSubtarefas)
      .then((r) => ouFalha("as entregas da fila", r)),
  ]);

  const idsDeTasks = [...new Set((subtarefas ?? []).map((s) => s.task_id))];

  const [tasks, pessoas] = await Promise.all([
    idsDeTasks.length === 0
      ? Promise.resolve(
          [] as { id: string; titulo: string; client_id: string; status: string }[],
        )
      : supabase
          .from("tasks")
          .select("id, titulo, client_id, status")
          .in("id", idsDeTasks)
          .not("publicada_em", "is", null)
          .then((r) => ouFalha("as demandas da fila", r)),
    supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", [
        ...new Set(
          (subtarefas ?? []).map((s) => s.responsavel_id).filter(Boolean),
        ),
      ] as string[])
      .then((r) => ouFalha("os nomes da fila", r)),
  ]);

  const idsDeClientes = [
    ...new Set((tasks ?? []).map((t) => t.client_id).filter(Boolean)),
  ] as string[];
  const clientes: { id: string; nome_empresa: string }[] =
    idsDeClientes.length === 0
      ? []
      : ouFalha(
          "os clientes da fila",
          await supabase.from("clients").select("id, nome_empresa").in("id", idsDeClientes),
        );

  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));
  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const esperando: ItemDaFila[] = [];
  const prontasParaOCliente: ItemDaFila[] = [];

  for (const sub of subtarefas ?? []) {
    const minhas = todas.filter((r) => r.content_id === sub.id);
    const situacao = situacaoDasRodadas(minhas, sub.tipo_aprovacao);
    const task = porTask.get(sub.task_id);
    if (!task) continue;

    const base = {
      tipo: "subtask" as const,
      contentId: sub.id,
      titulo: sub.titulo,
      contexto: `em ${task.titulo}`,
      rota: `/painel/gestao-tasks/${sub.task_id}`,
      cliente: task.client_id
        ? (porCliente.get(task.client_id)?.nome_empresa ?? null)
        : null,
      responsavel: sub.responsavel_id
        ? (porPessoa.get(sub.responsavel_id) ?? null)
        : null,
      tipoAprovacao: (sub.tipo_aprovacao ?? "interna") as TipoAprovacao,
      anexos: (entregas ?? [])
        .filter((e: SubtaskEntrega) => e.subtask_id === sub.id)
        .map((e: SubtaskEntrega) => ({
          id: e.id,
          nome: e.nome ?? "Entrega",
          url: e.url,
        })),
    };

    const pendenteInterna = minhas.find(
      (r) => r.status === "pendente" && r.escopo === "interna",
    );
    if (pendenteInterna) {
      esperando.push({
        ...base,
        rodadaId: pendenteInterna.id,
        numeroRodada: pendenteInterna.numero_rodada,
        desde: pendenteInterna.solicitado_em,
      });
      continue;
    }

    if (
      sub.tipo_aprovacao === "cliente" &&
      situacao.avalInterno &&
      !situacao.enviadaAoCliente &&
      sub.status !== "concluida"
    ) {
      const interna = minhas.find(
        (r) =>
          r.numero_rodada === situacao.rodadaAtual && r.escopo === "interna",
      );
      prontasParaOCliente.push({
        ...base,
        rodadaId: null,
        numeroRodada: situacao.rodadaAtual,
        desde:
          interna?.decidido_em ??
          interna?.solicitado_em ??
          new Date().toISOString(),
      });
    }
  }

  return { esperando, prontasParaOCliente };
}

/**
 * As rodadas internas de POST.
 *
 * **Uma função separada, e não um `if` no meio da de cima.** As duas leem
 * tabelas diferentes, com nomes diferentes para a mesma coisa — `titulo` na
 * etapa, `tema` no post — e chegam a telas diferentes. Misturadas, cada
 * `select` ganharia um `if tipo ===` no meio, que é a duplicação de volta com
 * outro nome. É a mesma decisão do detalhe do material no portal: o que se
 * compartilha é a casca, não a leitura.
 *
 * **O post é sempre de escopo cliente.** Não existe post que termine no aval
 * interno: a corrente da 0045 vai até Programar, e o Envio é o elo do meio.
 * Por isso ele nunca "conclui" ao ser aprovado — passa para a segunda lista.
 */
async function postsNaFila(): Promise<FilaDeAprovacoes> {
  const supabase = await criarClienteServidor();

  const rodadas = ouFalha(
    "a fila de aprovações de post",
    await supabase
      .from("approval_rounds")
      .select("*")
      .eq("content_type", "post")
      .order("numero_rodada", { ascending: false }),
  );

  const todas = (rodadas ?? []) as ApprovalRound[];
  if (todas.length === 0) return { esperando: [], prontasParaOCliente: [] };

  const idsDePosts = [...new Set(todas.map((r) => r.content_id))];

  const posts = ouFalha(
    "os posts da fila",
    await supabase
      .from("posts")
      .select(
        "id, client_id, tema, plataforma, data_publicacao, versao_atual, responsavel_id, enviado_em, arte_url, thumbnail_url",
      )
      .in("id", idsDePosts),
  );

  if (!posts || posts.length === 0) return { esperando: [], prontasParaOCliente: [] };

  const [clientes, pessoas, assinadas] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nome_empresa")
      .in("id", [...new Set(posts.map((p) => p.client_id))])
      .then((r) => ouFalha("os clientes da fila de post", r)),
    supabase
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", [
        ...new Set(posts.map((p) => p.responsavel_id).filter(Boolean)),
      ] as string[])
      .then((r) => ouFalha("os nomes da fila de post", r)),
    // A ARTE ASSINADA, para a gestão OLHAR antes de decidir. O bucket é
    // privado, e uma URL sem assinatura aqui seria um link quebrado no lugar
    // onde a pessoa precisa conferir o material.
    assinarArquivos(
      BUCKET_DAS_ARTES,
      posts.map((p) => p.thumbnail_url ?? p.arte_url),
    ),
  ]);

  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c.nome_empresa]));
  const porPessoa = new Map((pessoas ?? []).map((p) => [p.id, p]));

  const esperando: ItemDaFila[] = [];
  const prontasParaOCliente: ItemDaFila[] = [];

  for (const post of posts) {
    const minhas = todas.filter((r) => r.content_id === post.id);
    const caminho = post.thumbnail_url ?? post.arte_url;
    const assinada = caminho ? assinadas[caminho] : null;

    const base = {
      tipo: "post" as const,
      contentId: post.id,
      titulo: post.tema,
      contexto: post.data_publicacao
        ? `${post.plataforma} · ${post.data_publicacao.slice(8, 10)}/${post.data_publicacao.slice(5, 7)}`
        : `${post.plataforma} · sem data ainda`,
      rota: `/painel/social-media?post=${post.id}`,
      cliente: porCliente.get(post.client_id) ?? null,
      responsavel: post.responsavel_id
        ? (porPessoa.get(post.responsavel_id) ?? null)
        : null,
      // SEMPRE `cliente`, e não é atalho: a corrente do post termina no ar,
      // passando pelo cliente. Não existe post que pare no aval interno.
      tipoAprovacao: "cliente" as TipoAprovacao,
      anexos: assinada ? [{ id: post.id, nome: "Arte", url: assinada }] : [],
    };

    const pendente = minhas.find(
      (r) => r.status === "pendente" && r.escopo === "interna",
    );
    if (pendente) {
      esperando.push({
        ...base,
        rodadaId: pendente.id,
        numeroRodada: pendente.numero_rodada,
        desde: pendente.solicitado_em,
      });
      continue;
    }

    // A MESMA CONTA DO `avalInterno` DE `lib/dados/social-media.ts`, e o
    // `>= versao_atual` é o que importa: subir uma versão nova depois do aval
    // invalida o aval, porque o que a gestão aprovou não é mais o que iria.
    const temAval = minhas.some(
      (r) =>
        r.escopo === "interna" &&
        r.status === "aprovada" &&
        r.numero_rodada >= post.versao_atual,
    );

    if (temAval && !post.enviado_em) {
      const interna = minhas.find(
        (r) => r.escopo === "interna" && r.status === "aprovada",
      );
      prontasParaOCliente.push({
        ...base,
        rodadaId: null,
        numeroRodada: post.versao_atual,
        desde:
          interna?.decidido_em ??
          interna?.solicitado_em ??
          new Date().toISOString(),
      });
    }
  }

  return { esperando, prontasParaOCliente };
}
