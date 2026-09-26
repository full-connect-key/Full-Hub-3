import "server-only";

import { criarClienteAdmin, servicoConfigurado } from "@/lib/supabase/admin";

/**
 * Quem é o dono, e de que empresa é, o material que a rodada decidiu ou o
 * comentário tocou (Sprint 16, Parte B).
 *
 * ---------------------------------------------------------------------------
 * **UM LUGAR SÓ NOMEIA AS COLUNAS DE CADA TIPO**, que é a mesma forma de
 * `lib/aprovacoes/conteudo.ts`. Os três tipos da 0030 guardam a mesma coisa
 * com nomes diferentes — `titulo` na etapa, `tema` no post, `nome` no
 * entregável — e chegam ao painel por caminhos diferentes. Espalhado, o
 * primeiro que esquecesse um tipo mandaria um e-mail com o título em branco.
 *
 * **É a chave de serviço porque quem pergunta é o cliente**, e ele não lê
 * `subtasks` que não sejam dele, nem `profiles` de gente da agência. Com o
 * cliente da sessão a busca volta vazia — e vazia quer dizer "não avisa
 * ninguém". O recorte que impede isto de virar porta dos fundos é o mesmo:
 * lê um id que a ação acabou de tocar, devolve título, dono e empresa, e não
 * chega a tela nenhuma.
 * ---------------------------------------------------------------------------
 */

/** Onde cada tipo de conteúdo abre no painel, e como se chama o que decidiu. */
const NO_PAINEL: Record<string, string> = {
  subtask: "/painel/gestao-tasks",
  post: "/painel/social-media",
  deliverable: "/painel/aprovacoes",
};


export type Titular = {
  titulo: string;
  responsavelId: string | null;
  /** Onde isto abre no Painel — para quem é da agência. */
  rota: string;
  /**
   * Onde isto abre no Portal — para o cliente.
   *
   * **São DUAS e não uma**, e a razão é um link quebrado: um aviso que manda
   * o cliente para `/painel/...` cai num 403, e ele conclui que o portal dele
   * parou de funcionar. A mesma mensagem serve os dois lados; o endereço,
   * não.
   */
  rotaNoPortal: string;
};

/**
 * O título e o dono do que foi decidido, por tipo.
 *
 * O `switch` existe porque as três tabelas têm nomes diferentes para a mesma
 * coisa — `titulo` na etapa e no post, `nome` no entregável — e caminhos
 * diferentes até o painel. É a mesma forma de `lib/aprovacoes/conteudo.ts`:
 * um lugar só nomeia as colunas de cada tipo.
 */
export async function titularDoConteudo(
  tipo: string,
  id: string,
): Promise<Titular | null> {
  if (!servicoConfigurado()) return null;
  const admin = criarClienteAdmin();
  const base = NO_PAINEL[tipo] ?? "/painel";

  if (tipo === "subtask") {
    const { data } = await admin
      .from("subtasks")
      .select("titulo, responsavel_id, task_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      titulo: data.titulo,
      responsavelId: data.responsavel_id,
      rota: `${base}/${data.task_id}`,
      rotaNoPortal: "/portal/aprovacoes",
    };
  }

  if (tipo === "post") {
    const { data } = await admin
      .from("posts")
      .select("tema, responsavel_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    // `tema` E O TITULO DO POST. A coluna nasceu com esse nome na 0032 e não
    // foi renomeada — renomear coluna em uso é migration arriscada sem nada
    // em troca, a mesma decisão de `subtasks.prazo` e de `dias_uteis`.
    return {
      titulo: data.tema,
      responsavelId: data.responsavel_id,
      rota: base,
      rotaNoPortal: `/portal/social-media/${id}`,
    };
  }

  if (tipo === "deliverable") {
    const { data } = await admin
      .from("deliverables")
      .select("nome, responsavel_id, campaign_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      titulo: data.nome,
      responsavelId: data.responsavel_id,
      rota: `${base}/campanhas/${data.campaign_id}`,
      rotaNoPortal: `/portal/campanhas/${data.campaign_id}/${id}`,
    };
  }

  return null;
}

/**
 * De que empresa é este material.
 *
 * **Sai do CONTEÚDO, e nunca de quem comentou.** O atalho seria perguntar em
 * `client_users` de quem escreveu — uma consulta a menos —, e ele tem um furo
 * que só aparece com quem responde por duas contas: a pessoa comenta num
 * material da empresa A e o aviso sai também para as pessoas da empresa B,
 * com o título do material de A no assunto. Uma empresa não pode saber da
 * outra, e o título é o suficiente para saber.
 */
export async function empresaDoConteudo(
  tipo: string,
  id: string,
): Promise<string | null> {
  if (!servicoConfigurado()) return null;
  const admin = criarClienteAdmin();

  if (tipo === "post") {
    const { data } = await admin
      .from("posts")
      .select("client_id")
      .eq("id", id)
      .maybeSingle();
    return data?.client_id ?? null;
  }

  if (tipo === "deliverable") {
    // O entregável não guarda a empresa: ela é da campanha. Um `client_id`
    // copiado aqui seria a segunda verdade sobre a mesma coisa, e trocar a
    // campanha de cliente deixaria as peças apontando para a antiga.
    const { data } = await admin
      .from("deliverables")
      .select("campaigns(client_id)")
      .eq("id", id)
      .maybeSingle<{ campaigns: { client_id: string } | null }>();
    return data?.campaigns?.client_id ?? null;
  }

  if (tipo === "subtask") {
    const { data } = await admin
      .from("subtasks")
      .select("tasks(client_id)")
      .eq("id", id)
      .maybeSingle<{ tasks: { client_id: string | null } | null }>();
    return data?.tasks?.client_id ?? null;
  }

  return null;
}
