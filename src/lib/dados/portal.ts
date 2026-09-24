import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";
import { statusParaOCliente, type ItemDoPortal } from "@/lib/dominio/portal";
import { ROTULO_DA_PLATAFORMA } from "@/lib/dominio/posts";

/**
 * O que o cliente enxerga no Portal.
 *
 * **O ISOLAMENTO NÃO MORA AQUI, e isso é deliberado.** As policies
 * `tasks_select_cliente`, `subtasks_select_cliente` e
 * `approval_rounds_select_cliente` já recusam o que é de outra empresa — mesmo
 * que esta consulta esqueça o filtro, mesmo que alguém chame a API do Supabase
 * direto. Aqui só montamos o que passou.
 *
 * `clienteId` existe para a visualização administrativa em `/portal/{slug}`.
 * Para a pessoa cliente ele é dispensável; para quem é da equipe NÃO É:
 * `is_staff()` enxerga todos os clientes, e sem este filtro o portal da Mundo
 * Verde mostraria o material da Óptica Visão.
 */

export type Prazos = { hoje: string; fimDaSemana: string };

export function prazosDoPortal(): Prazos {
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);
  // Domingo fecha a semana, como no resto do produto.
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + ((7 - fim.getDay()) % 7));
  return { hoje, fimDaSemana: fim.toISOString().slice(0, 10) };
}

/**
 * Todo material que já foi enviado ao cliente, decidido ou não.
 *
 * Uma consulta só para a tela inteira: o cartão de pendências, a lista e os
 * contadores saem daqui e são filtrados pela mesma função de domínio. É o que
 * faz o número bater com a quantidade de cartões.
 */
export async function itensDoPortal(
  clienteId?: string,
): Promise<ItemDoPortal[]> {
  const supabase = await criarClienteServidor();

  // Só as de escopo cliente. A aprovação interna inteira — quem pediu, quem
  // validou, o que foi comentado — fica do lado de cá da parede.
  const { data: rodadas } = await supabase
    .from("approval_rounds")
    .select(
      "id, content_type, content_id, status, solicitado_em, numero_rodada",
    )
    .eq("escopo", "cliente")
    .eq("content_type", "subtask")
    .order("numero_rodada", { ascending: false });

  const todas = rodadas ?? [];
  if (todas.length === 0) return [];

  const idsDeConteudo = [...new Set(todas.map((r) => r.content_id))];

  const { data: subtarefas } = await supabase
    .from("subtasks")
    .select("id, task_id, titulo, prazo, status")
    .in("id", idsDeConteudo);

  const idsDeTasks = [...new Set((subtarefas ?? []).map((s) => s.task_id))];
  if (idsDeTasks.length === 0) return [];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, titulo, client_id")
    .in("id", idsDeTasks);

  const idsDeClientes = [
    ...new Set((tasks ?? []).map((t) => t.client_id).filter(Boolean)),
  ] as string[];

  const { data: clientes } = idsDeClientes.length
    ? await supabase
        .from("clients")
        .select("id, nome_empresa")
        .in("id", idsDeClientes)
    : { data: [] as { id: string; nome_empresa: string }[] };

  const { data: entregas } = await supabase
    .from("subtask_entregas")
    .select("subtask_id, tipo, url")
    .in("subtask_id", idsDeConteudo);

  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  const itens: ItemDoPortal[] = [];

  for (const sub of subtarefas ?? []) {
    const task = porTask.get(sub.task_id);
    if (!task || !task.client_id) continue;
    if (clienteId && task.client_id !== clienteId) continue;

    // A rodada que vale é a de maior número: as anteriores são o histórico de
    // um ciclo que já fechou.
    const minhas = todas.filter((r) => r.content_id === sub.id);
    const atual = minhas[0] ?? null;

    itens.push({
      rodadaId: atual?.status === "pendente" ? atual.id : null,
      tipo: "subtask",
      conteudoId: sub.id,
      titulo: sub.titulo,
      demanda: task.titulo,
      clienteId: task.client_id,
      cliente: porCliente.get(task.client_id)?.nome_empresa ?? "",
      status: statusParaOCliente({
        rodada: atual?.status ?? null,
        etapaConcluida: sub.status === "concluida",
        aguardandoInformacoes: sub.status === "aguardando_informacoes",
      }),
      prazo: sub.prazo,
      enviadoEm: atual?.solicitado_em ?? null,
      // A primeira entrega em imagem serve de miniatura. Link de Figma ou de
      // Drive não vira imagem, então a maioria fica sem — e o cartão sem
      // miniatura é o caso normal, não a exceção.
      miniatura:
        (entregas ?? []).find(
          (e) =>
            e.subtask_id === sub.id && /\.(png|jpe?g|webp|gif)$/i.test(e.url),
        )?.url ?? null,
    });
  }

  return [...itens, ...(await postsComoItens(clienteId))];
}

/**
 * Os posts, no mesmo formato dos outros materiais.
 *
 * **A tela inicial não sabe que existe um módulo de social**, e é esse o
 * ponto: "o que está esperando por mim" é uma pergunta só, e a resposta não
 * pode depender de o cliente lembrar de abrir duas telas. Aqui o post é
 * traduzido para `ItemDoPortal` e entra na mesma lista, no mesmo contador, com
 * a mesma ordenação por urgência.
 *
 * O status NÃO passa por `statusParaOCliente()`: `posts.status` já é
 * `content_status` — o post nasce no vocabulário do cliente, e a etapa de
 * demanda é que precisa de tradução. Traduzir de novo seria traduzir duas
 * vezes.
 */
async function postsComoItens(clienteId?: string): Promise<ItemDoPortal[]> {
  const supabase = await criarClienteServidor();

  // Sem filtro de `enviado_em`: `posts_select_cliente` já recusa o que não foi
  // enviado, e repetir a regra aqui criaria um segundo lugar onde ela pode
  // divergir. O `clienteId` é outra coisa — ele existe para a visualização
  // administrativa, onde quem pergunta é da equipe e enxerga todas as
  // empresas.
  let consulta = supabase
    .from("posts")
    .select(
      "id, client_id, tema, data_publicacao, prazo_aprovacao, status, thumbnail_url, arte_url, enviado_em, plataforma, subtask_id",
    )
    .order("data_publicacao");

  if (clienteId) consulta = consulta.eq("client_id", clienteId);

  const { data } = await consulta;
  const posts = data ?? [];
  if (posts.length === 0) return [];

  const { data: rodadas } = await supabase
    .from("approval_rounds")
    .select("id, content_id, status, numero_rodada")
    .eq("content_type", "post")
    .eq("escopo", "cliente")
    .in(
      "content_id",
      posts.map((p) => p.id),
    )
    .order("numero_rodada", { ascending: false });

  const pendentePorPost = new Map<string, string>();
  const vistos = new Set<string>();
  for (const r of rodadas ?? []) {
    if (vistos.has(r.content_id)) continue;
    vistos.add(r.content_id);
    if (r.status === "pendente") pendentePorPost.set(r.content_id, r.id);
  }

  const idsDeClientes = [...new Set(posts.map((p) => p.client_id))];
  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome_empresa")
    .in("id", idsDeClientes);
  const porCliente = new Map(
    (clientes ?? []).map((c) => [c.id, c.nome_empresa]),
  );

  return posts.map((post) => ({
    rodadaId: pendentePorPost.get(post.id) ?? null,
    tipo: "post" as const,
    conteudoId: post.id,
    titulo: post.tema,
    // A DEMANDA DE UM POST É A REDE EM QUE ELE VAI AO AR. Ele pode ter nascido
    // de uma etapa de campanha, mas o nome dela é vocabulário interno — e
    // muitos posts não têm etapa nenhuma, que é caso normal e não exceção.
    demanda: ROTULO_DA_PLATAFORMA[post.plataforma],
    clienteId: post.client_id,
    cliente: porCliente.get(post.client_id) ?? "",
    status: post.status,
    // O prazo que conta para o cliente é o de DECIDIR, e não o de publicação:
    // é o único dos dois que depende dele. Sem prazo de decisão, a data de
    // publicação serve de referência — depois dela não adianta mais aprovar.
    prazo: post.prazo_aprovacao ?? post.data_publicacao,
    enviadoEm: post.enviado_em,
    miniatura: post.thumbnail_url ?? post.arte_url,
  }));
}

/**
 * A atividade recente da conta.
 *
 * Sai de `task_history`, que a policy do cliente já filtra. O que ele vê é o
 * que aconteceu COM O MATERIAL DELE — envio, aprovação, pedido de ajuste —, e
 * não o andamento interno da produção.
 */
export type Atividade = {
  id: string;
  acao: string;
  quando: string;
  sobre: string;
};

const ACOES_VISIVEIS: Record<string, string> = {
  enviada_ao_cliente: "Enviado para a sua aprovação",
  cliente_aprovou: "Você aprovou",
  cliente_pediu_ajustes: "Você pediu ajustes",
};

/**
 * As mesmas ações, contadas para quem NÃO é o cliente.
 *
 * Na visualização administrativa "Você aprovou" seria falso — quem aprovou foi
 * o cliente, e quem está lendo é da agência. Duas listas e não uma frase
 * montada com `voce ? "Você" : "O cliente"`: o texto muda inteiro, não só o
 * sujeito.
 */
const ACOES_PARA_A_EQUIPE: Record<string, string> = {
  enviada_ao_cliente: "Enviado para a aprovação do cliente",
  cliente_aprovou: "O cliente aprovou",
  cliente_pediu_ajustes: "O cliente pediu ajustes",
};

export async function atividadeRecente(
  clienteId?: string,
  comoEquipe = false,
): Promise<Atividade[]> {
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("task_history")
    .select("id, task_id, subtask_id, acao, created_at")
    .in("acao", Object.keys(ACOES_VISIVEIS))
    .order("created_at", { ascending: false })
    .limit(30);

  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const idsDeTasks = [...new Set(linhas.map((l) => l.task_id))];
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, titulo, client_id")
    .in("id", idsDeTasks);

  const idsDeSubs = [
    ...new Set(linhas.map((l) => l.subtask_id).filter(Boolean)),
  ] as string[];
  const { data: subs } = idsDeSubs.length
    ? await supabase.from("subtasks").select("id, titulo").in("id", idsDeSubs)
    : { data: [] as { id: string; titulo: string }[] };

  const porTask = new Map((tasks ?? []).map((t) => [t.id, t]));
  const porSub = new Map((subs ?? []).map((s) => [s.id, s]));

  return linhas
    .filter((l) => {
      const task = porTask.get(l.task_id);
      if (!task) return false;
      return !clienteId || task.client_id === clienteId;
    })
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      acao:
        (comoEquipe ? ACOES_PARA_A_EQUIPE : ACOES_VISIVEIS)[l.acao] ?? l.acao,
      quando: l.created_at,
      sobre:
        (l.subtask_id ? porSub.get(l.subtask_id)?.titulo : null) ??
        porTask.get(l.task_id)?.titulo ??
        "",
    }));
}

/**
 * Registra o acesso.
 *
 * Falha em silêncio de propósito, e é a única escrita do produto que pode: se
 * o registro de auditoria cair, o cliente não pode ficar sem o portal por
 * causa disso. O erro vai para o log do servidor.
 */
export async function registrarAcesso(
  clienteId: string,
  acao: "login" | "visualizou_item" | "download",
  entidade?: { tipo: string; id: string },
): Promise<void> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const { error } = await supabase.from("client_access_log").insert({
    user_id: data.user.id,
    client_id: clienteId,
    acao,
    entity_type: entidade?.tipo ?? null,
    entity_id: entidade?.id ?? null,
  });

  if (error) {
    console.error("[registrarAcesso] não gravou o acesso do portal:", error);
  }
}

/** As pessoas com acesso às empresas de quem pergunta, e o último login. */
export type UsuarioDoCliente = {
  user_id: string;
  nome: string;
  email: string;
  ultimo_acesso: string | null;
};

export async function usuariosDoMeuCliente(): Promise<UsuarioDoCliente[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("usuarios_do_meu_cliente");
  return (data ?? []) as UsuarioDoCliente[];
}

export type PreferenciasDeAviso = {
  novo_conteudo: boolean;
  novo_comentario: boolean;
  lembrete_pendencias: boolean;
  frequencia: "imediato" | "diario" | "nunca";
};

const PADRAO: PreferenciasDeAviso = {
  novo_conteudo: true,
  novo_comentario: true,
  lembrete_pendencias: true,
  frequencia: "imediato",
};

/**
 * Quem nunca mexeu nas preferências não tem linha, e recebe o padrão.
 *
 * Criar a linha no primeiro acesso seria escrever no banco por causa de uma
 * leitura — e deixaria uma linha por pessoa que só abriu a tela.
 */
export async function minhasPreferencias(): Promise<PreferenciasDeAviso> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("client_notification_prefs")
    .select("novo_conteudo, novo_comentario, lembrete_pendencias, frequencia")
    .maybeSingle();

  return (data as PreferenciasDeAviso | null) ?? PADRAO;
}
