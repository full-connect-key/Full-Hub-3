"use server";

import { revalidatePath } from "next/cache";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import {
  aindaNaoTratado,
  colunasDoConteudo,
  daSubtarefa,
  type Conteudo,
} from "@/lib/aprovacoes/conteudo";
import {
  executarAcao,
  falha,
  sucesso,
  type Resultado,
} from "@/lib/acoes/resultado";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { anunciar } from "@/lib/acoes/ao-vivo";
import { clientesQueQueremReceber } from "@/lib/email/destinatarios";
import { despacharEmail } from "@/lib/email/enviar";
import { materialParaAprovar } from "@/lib/email/mensagens";

/**
 * O fluxo de aprovação.
 *
 * Quem executa produz e envia. Quem valida internamente é a gestão. Quem envia
 * ao cliente é a gestão. Quem aprova ou pede ajustes lá fora é o cliente.
 *
 * NOTA DE DECISÃO — o papel do Sócio
 *   A regra-mestra diz que aprovar e enviar ao cliente é do Desenvolvedor. O
 *   Sócio também aprova aqui (`exigirGestorNaAcao`, que é desenvolvedor ou
 *   sócio), porque ele tem acesso total ao painel e travá-lo fora da fila
 *   deixaria a agência parada quando o desenvolvedor está fora.
 *   Para restringir só ao desenvolvedor, troque `exigirGestorNaAcao` por uma
 *   checagem de `role === "desenvolvedor"` aqui e `is_gestor()` por
 *   `auth_role() = 'desenvolvedor'` em `pode_aprovar_subtarefa()`, na 0029.
 *
 * NOTA DE DECISÃO — a gestão aprova o próprio trabalho (migration 0029)
 *   Este arquivo recusava, em TypeScript, quem fosse o `responsavel_id` da
 *   etapa. Saiu por decisão do usuário, junto com o trigger
 *   `bloquear_autoaprovacao`; o cabeçalho da 0029 diz o que se ganha e o que
 *   se perde. **Aprovar e enviar são duas decisões, e só a primeira mudou:**
 *   `enviarParaOCliente` mais abaixo continua recusando quem produziu, como o
 *   `validar_nova_rodada` da 0007.
 *
 * Toda regra abaixo existe também no banco, em trigger. Não é redundância
 * inútil: aqui a recusa vira uma frase que a pessoa entende; lá ela vale
 * mesmo para um pedido montado à mão contra a API do Supabase.
 */

const ROTA = "/painel/gestao-tasks";
const FILA = "/painel/aprovacoes-internas";

type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;
type EventoDeHistorico = Database["public"]["Tables"]["task_history"]["Insert"];

function revalidar(taskId: string) {
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/${taskId}`);
  revalidatePath(FILA);
  revalidatePath("/painel/minhas-tasks");
  anunciar("aprovacao");
}

async function registrar(supabase: ClienteSupabase, evento: EventoDeHistorico) {
  await supabase.from("task_history").insert(evento);
}

type Contexto = {
  subtarefa: {
    id: string;
    task_id: string;
    titulo: string;
    responsavel_id: string | null;
    requer_aprovacao: boolean;
    tipo_aprovacao: "interna" | "cliente" | null;
    status: Database["public"]["Enums"]["subtask_status"];
  };
  rodadas: {
    id: string;
    numero_rodada: number;
    escopo: "interna" | "cliente";
    status: Database["public"]["Enums"]["status_rodada"];
  }[];
};

async function lerSubtarefa(
  supabase: ClienteSupabase,
  id: string,
): Promise<Contexto | null> {
  const { data: subtarefa } = await supabase
    .from("subtasks")
    .select(
      "id, task_id, titulo, responsavel_id, requer_aprovacao, tipo_aprovacao, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (!subtarefa) return null;

  return { subtarefa, rodadas: await rodadasDo(supabase, daSubtarefa(id)) };
}

/**
 * A etapa de uma rodada — ou null, quando a rodada é de outro tipo.
 *
 * O `null` não é um detalhe: depois da 0030 uma rodada pode ser de post ou de
 * entregável, e o resto desta ação lê `subtasks`. Seguir com o id de um post
 * procuraria em `subtasks` um id que não está lá, e a ação devolveria
 * "Subtarefa não encontrada" — uma mensagem verdadeira sobre a pergunta
 * errada. Quem chama recusa com `aindaNaoTratado`, que diz o que está
 * acontecendo.
 */
function etapaDaRodada(rodada: {
  content_type: string;
  content_id: string;
}): string | null {
  return rodada.content_type === "subtask" ? rodada.content_id : null;
}

/**
 * As rodadas de um conteúdo, da mais nova para a mais antiga.
 *
 * É o único lugar do motor que nomeia as colunas da 0030. Todas as cinco
 * ações passam por aqui, e é isso que faz post e entregável (Sprints 12 e 13)
 * entrarem sem um segundo fluxo ao lado deste.
 */
async function rodadasDo(supabase: ClienteSupabase, conteudo: Conteudo) {
  const { data } = await supabase
    .from("approval_rounds")
    .select("id, numero_rodada, escopo, status")
    .eq("content_type", conteudo.tipo)
    .eq("content_id", conteudo.id)
    .order("numero_rodada", { ascending: false });
  return data ?? [];
}

/**
 * O responsável manda a entrega para validação.
 *
 * A rodada é SEMPRE interna primeiro, mesmo quando o tipo é cliente: "tipo
 * cliente" diz para onde a aprovação vai no fim, não que ela pule a gestão.
 */
export async function enviarParaAprovacao(
  subtaskId: string,
  opcoes?: { semArquivo?: boolean },
): Promise<Resultado> {
  return executarAcao("enviarParaAprovacao", async () => {
    const sessao = await exigirEquipeNaAcao();
    const supabase = await criarClienteServidor();

    const ctx = await lerSubtarefa(supabase, subtaskId);
    if (!ctx) return falha("Subtarefa não encontrada.");

    const { subtarefa } = ctx;

    if (!subtarefa.requer_aprovacao) {
      return falha(
        "Esta subtarefa não exige aprovação — ela se conclui direto.",
      );
    }
    // O responsável envia a dele. A gestão também pode, para destravar quando
    // a pessoa está fora — é o que o trigger `validar_nova_rodada` já permite,
    // e a tela oferece o botão nos dois casos. Recusar aqui deixaria um botão
    // que só dá erro.
    const souOResponsavel = subtarefa.responsavel_id === sessao.usuarioId;
    const souGestor =
      sessao.profile.role === "desenvolvedor" ||
      sessao.profile.role === "socio";
    if (!souOResponsavel && !souGestor) {
      return falha(
        "Só o responsável pela subtarefa, ou a gestão, envia para aprovação.",
      );
    }

    const situacao = situacaoDasRodadas(ctx.rodadas, subtarefa.tipo_aprovacao);
    if (situacao.rodadaPendente) {
      return falha("Já existe uma rodada esperando decisão nesta subtarefa.");
    }

    // Entrega anexada, ou uma confirmação explícita de que não há arquivo.
    // Enviar em branco sem dizer nada deixa quem vai aprovar sem o que olhar.
    const { count } = await supabase
      .from("subtask_entregas")
      .select("id", { count: "exact", head: true })
      .eq("subtask_id", subtaskId);

    if ((count ?? 0) === 0 && !opcoes?.semArquivo) {
      return falha(
        "Anexe o arquivo ou o link da entrega — ou confirme que esta etapa não gera arquivo.",
      );
    }

    const numero = situacao.rodadaAtual + 1;

    const { data: rodada, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(daSubtarefa(subtaskId)),
        numero_rodada: numero,
        escopo: "interna",
        // Quem consta como solicitante é sempre quem PRODUZIU: é dele a
        // entrega, e é a ele que a decisão volta. A gestão apertar o botão no
        // lugar dele não muda de quem é o trabalho.
        solicitado_por: subtarefa.responsavel_id ?? sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !rodada)
      return falha(error?.message ?? "Não foi possível abrir a rodada.");

    // As entregas soltas passam a pertencer a esta rodada: é o que amarra o
    // arquivo ao ciclo em que ele foi avaliado.
    await supabase
      .from("subtask_entregas")
      .update({ approval_round_id: rodada.id })
      .eq("subtask_id", subtaskId)
      .is("approval_round_id", null);

    const { data: movida, error: erroDoStatus } = await supabase
      .from("subtasks")
      .update({ status: "enviada_aprovacao" })
      .eq("id", subtaskId)
      .select("id")
      .maybeSingle();

    if (erroDoStatus || !movida) {
      // A rodada sem a subtarefa correspondente deixaria a fila mostrando um
      // item que não existe. Desfaz.
      await supabase.from("approval_rounds").delete().eq("id", rodada.id);
      return falha(
        erroDoStatus?.message ?? "Não foi possível mover a subtarefa.",
      );
    }

    await registrar(supabase, {
      task_id: subtarefa.task_id,
      subtask_id: subtaskId,
      approval_round_id: rodada.id,
      acao: "enviada_para_aprovacao",
      para_valor: `Rodada ${numero}`,
      autor_id: sessao.usuarioId,
    });

    revalidar(subtarefa.task_id);
    return sucesso(`Enviada para aprovação — rodada ${numero}.`);
  });
}

/** A gestão aprova a rodada interna. */
export async function aprovarInterna(
  roundId: string,
  comentario?: string,
): Promise<Resultado> {
  return executarAcao("aprovarInterna", async () => {
    const sessao = await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data: rodada } = await supabase
      .from("approval_rounds")
      .select("id, content_type, content_id, numero_rodada, escopo, status")
      .eq("id", roundId)
      .maybeSingle();

    if (!rodada) return falha("Rodada não encontrada.");
    if (rodada.status !== "pendente")
      return falha("Esta rodada já foi decidida.");
    if (rodada.escopo !== "interna")
      return falha("Esta rodada é a do cliente, não a interna.");

    // O POST DECIDE POR AQUI TAMBÉM, e antes disto ele não decidia por lugar
    // nenhum: esta função parava em `aindaNaoTratado` e a tela de Social não
    // tinha botão de aprovar. O post ficava em "Revisão" para sempre e, como
    // `podeEnviarAoCliente()` exige o aval, nunca chegava ao cliente.
    if (rodada.content_type === "post") {
      return decidirRodadaDePost(supabase, sessao.usuarioId, rodada, "aprovada", comentario);
    }

    const alvo = etapaDaRodada(rodada);
    if (!alvo) {
      return falha(
        aindaNaoTratado({ tipo: rodada.content_type, id: rodada.content_id }),
      );
    }

    const ctx = await lerSubtarefa(supabase, alvo);
    if (!ctx) return falha("Subtarefa não encontrada.");

    // Aqui havia a trava de autoaprovação, e ela saiu na migration 0029 por
    // decisão do usuário: a gestão decide qualquer rodada interna, inclusive
    // a da etapa que está no próprio nome.
    const { data, error } = await supabase
      .from("approval_rounds")
      .update({
        status: "aprovada",
        decidido_por: sessao.usuarioId,
        decidido_em: new Date().toISOString(),
        comentario: comentario?.trim() || null,
      })
      .eq("id", roundId)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data)
      return falha(
        "O banco recusou a aprovação: só a gestão decide rodada interna.",
      );

    // Tipo interna: acabou, a subtarefa conclui.
    // Tipo cliente: ela FICA esperando. O envio ao cliente é um ato
    // deliberado de quem gerencia, não uma consequência automática.
    let mensagem = "Aprovada internamente.";
    if (ctx.subtarefa.tipo_aprovacao === "interna") {
      const { error: erroDoStatus } = await supabase
        .from("subtasks")
        .update({ status: "concluida" })
        .eq("id", alvo)
        .select("id");
      if (erroDoStatus) return falha(erroDoStatus.message);
      mensagem = "Aprovada — subtarefa concluída.";
    } else {
      mensagem =
        'Aprovada internamente. Agora dá para usar "Enviar para o cliente".';
    }

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: alvo,
      approval_round_id: roundId,
      acao: "aprovacao_interna",
      para_valor: `Rodada ${rodada.numero_rodada}`,
      autor_id: sessao.usuarioId,
    });

    if (comentario?.trim()) {
      await supabase.from("task_comentarios").insert({
        task_id: ctx.subtarefa.task_id,
        subtask_id: alvo,
        approval_round_id: roundId,
        autor_id: sessao.usuarioId,
        texto: comentario.trim(),
        interno: true,
      });
    }

    revalidar(ctx.subtarefa.task_id);
    return sucesso(mensagem);
  });
}

/** A gestão pede ajustes. Sem motivo escrito, a ação é recusada. */
export async function solicitarAjustesInterna(
  roundId: string,
  comentario: string,
): Promise<Resultado> {
  return executarAcao("solicitarAjustesInterna", async () => {
    const sessao = await exigirGestorNaAcao();

    if (!comentario?.trim()) {
      return falha(
        "Diga o que precisa ser ajustado — pedido sem motivo não ajuda ninguém.",
      );
    }

    const supabase = await criarClienteServidor();

    const { data: rodada } = await supabase
      .from("approval_rounds")
      .select("id, content_type, content_id, numero_rodada, escopo, status")
      .eq("id", roundId)
      .maybeSingle();

    if (!rodada) return falha("Rodada não encontrada.");
    if (rodada.status !== "pendente")
      return falha("Esta rodada já foi decidida.");

    if (rodada.content_type === "post") {
      return decidirRodadaDePost(
        supabase,
        sessao.usuarioId,
        rodada,
        "ajustes_solicitados",
        comentario,
      );
    }

    const alvo = etapaDaRodada(rodada);
    if (!alvo) {
      return falha(
        aindaNaoTratado({ tipo: rodada.content_type, id: rodada.content_id }),
      );
    }

    const ctx = await lerSubtarefa(supabase, alvo);
    if (!ctx) return falha("Subtarefa não encontrada.");
    const { data, error } = await supabase
      .from("approval_rounds")
      .update({
        status: "ajustes_solicitados",
        decidido_por: sessao.usuarioId,
        decidido_em: new Date().toISOString(),
        comentario: comentario.trim(),
      })
      .eq("id", roundId)
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);
    if (!data)
      return falha(
        "O banco recusou a decisão: só a gestão decide rodada interna.",
      );

    const { error: erroDoStatus } = await supabase
      .from("subtasks")
      .update({ status: "em_ajustes" })
      .eq("id", alvo)
      .select("id");
    if (erroDoStatus) return falha(erroDoStatus.message);

    await supabase.from("task_comentarios").insert({
      task_id: ctx.subtarefa.task_id,
      subtask_id: alvo,
      approval_round_id: roundId,
      autor_id: sessao.usuarioId,
      texto: comentario.trim(),
      interno: true,
    });

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: alvo,
      approval_round_id: roundId,
      acao: "ajustes_solicitados",
      para_valor: `Rodada ${rodada.numero_rodada}`,
      autor_id: sessao.usuarioId,
    });

    revalidar(ctx.subtarefa.task_id);
    return sucesso("Ajustes solicitados. O responsável foi avisado.");
  });
}

/**
 * A gestão envia ao cliente.
 *
 * Nunca automático: aprovar internamente diz que o material está bom, enviar
 * diz que é agora. As duas decisões são de pessoas diferentes em momentos
 * diferentes, e juntá-las já mandou peça errada para cliente em muita agência.
 */
export async function enviarParaCliente(subtaskId: string): Promise<Resultado> {
  return executarAcao("enviarParaCliente", async () => {
    const sessao = await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const ctx = await lerSubtarefa(supabase, subtaskId);
    if (!ctx) return falha("Subtarefa não encontrada.");

    if (ctx.subtarefa.tipo_aprovacao !== "cliente") {
      return falha("Esta subtarefa não é de aprovação do cliente.");
    }
    // A TRAVA DE "PRÓPRIA ENTREGA" SAIU NA 0060, aqui e no banco, no mesmo
    // commit — ver o comentário gêmeo em `social-media/acoes.ts`.

    const situacao = situacaoDasRodadas(
      ctx.rodadas,
      ctx.subtarefa.tipo_aprovacao,
    );
    if (!situacao.avalInterno) {
      return falha("Esta rodada ainda não passou pela aprovação interna.");
    }
    if (situacao.enviadaAoCliente) {
      return falha("Esta rodada já foi enviada ao cliente.");
    }

    const { data: rodada, error } = await supabase
      .from("approval_rounds")
      .insert({
        ...colunasDoConteudo(daSubtarefa(subtaskId)),
        numero_rodada: situacao.rodadaAtual,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !rodada)
      return falha(error?.message ?? "Não foi possível enviar.");

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: subtaskId,
      approval_round_id: rodada.id,
      acao: "enviada_ao_cliente",
      para_valor: `Rodada ${situacao.rodadaAtual}`,
      autor_id: sessao.usuarioId,
    });

    // O MESMO DISPARO DO POST, e de propósito a mesma mensagem: para quem
    // recebe, um post e uma etapa de demanda são a mesma coisa — material
    // esperando a decisão dele. Duas mensagens diferentes para o mesmo fato
    // seriam duas vozes da agência na caixa de entrada do cliente.
    //
    // `task_id` está em mãos e `client_id` não: `lerSubtarefa` lê a etapa, e
    // a empresa é da demanda. Uma consulta a mais aqui é mais barata que
    // engordar um `select` que outras quatro ações usam sem precisar dele.
    const { data: demanda } = await supabase
      .from("tasks")
      .select("client_id")
      .eq("id", ctx.subtarefa.task_id)
      .maybeSingle();

    if (demanda?.client_id) {
      despacharEmail(
        await clientesQueQueremReceber(demanda.client_id, "novo_conteudo"),
        materialParaAprovar({
          titulo: ctx.subtarefa.titulo,
          oQueE: "um material",
          rota: "/portal/aprovacoes",
        }),
      );
    }

    revalidar(ctx.subtarefa.task_id);
    return sucesso("Enviada ao cliente. Ela já aparece no Portal.");
  });
}

/**
 * A decisão da gestão sobre a rodada interna de um POST.
 *
 * ---------------------------------------------------------------------------
 * **O QUE ELA NÃO FAZ É O QUE MAIS IMPORTA: ela não mexe em `posts.status`.**
 *
 * A tentação, no pedido de ajustes, é marcar o post como `ajustes` — parece o
 * espelho do `em_ajustes` que a etapa recebe. Seria errado por um caminho que
 * ninguém veria no código desta função: `posts_corrente_do_cliente` (0045)
 * dispara nesse status e faz duas coisas que aqui são mentira — cria uma etapa
 * **"Ajustes"** na corrente e manda uma notificação dizendo *"o cliente pediu
 * ajustes"*. O cliente não pediu nada; ele nem viu o post ainda.
 *
 * O aval interno é um passo ANTES do cliente. A rodada recusada já devolve o
 * post para produção sozinha: `avalInterno` volta a ser falso, e
 * `maoDoPost()` responde "produção" de novo — a mão volta para quem fez, que
 * é exatamente o que se quer dizer.
 * ---------------------------------------------------------------------------
 *
 * **Quem produziu precisa SABER, e por isso o aviso é explícito.** A etapa de
 * demanda tem `task_comentarios` e o histórico da task; o post não tem nada
 * equivalente do lado interno — o comentário fica na rodada, e a rodada não
 * aparece na tela dele. Sem o sino, um pedido de ajustes escrito na sexta
 * espera a pessoa abrir o Social por acaso.
 *
 * `notificar()` nunca avisa quem causou o aviso, então a gestão que decide o
 * próprio post não recebe nada — e está certo.
 */
async function decidirRodadaDePost(
  supabase: ClienteSupabase,
  usuarioId: string,
  rodada: { id: string; content_id: string; numero_rodada: number },
  decisao: "aprovada" | "ajustes_solicitados",
  comentario?: string,
): Promise<Resultado> {
  const { data: post } = await supabase
    .from("posts")
    .select("id, tema, responsavel_id")
    .eq("id", rodada.content_id)
    .maybeSingle();

  if (!post) return falha("Post não encontrado.");

  const { data, error } = await supabase
    .from("approval_rounds")
    .update({
      status: decisao,
      decidido_por: usuarioId,
      decidido_em: new Date().toISOString(),
      comentario: comentario?.trim() || null,
    })
    .eq("id", rodada.id)
    .select("id")
    .maybeSingle();

  if (error) return falha(error.message);
  // `.select()` porque uma escrita barrada pelo RLS volta sem erro e sem
  // linha. Quem barraria aqui é `approval_rounds_decide`, que desde a 0033 já
  // aceita post — por `pode_aprovar_post()`, que é `is_gestor()`.
  if (!data) {
    return falha("O banco recusou a decisão: só a gestão decide rodada interna.");
  }

  if (post.responsavel_id) {
    await supabase.rpc("notificar", {
      p_user_id: post.responsavel_id,
      p_tipo: "aprovacao",
      p_titulo:
        decisao === "aprovada"
          ? `Aval interno aprovado: "${post.tema}"`
          : `Ajustes pedidos em "${post.tema}"`,
      p_corpo: comentario?.trim() || null,
      p_link: "/painel/social-media",
    });
  }

  revalidatePath("/painel/social-media");
  revalidatePath("/painel/aprovacoes-internas");
  anunciar("post");

  return sucesso(
    decisao === "aprovada"
      ? 'Aval interno dado. Agora dá para usar "Enviar ao cliente".'
      : "Ajustes pedidos. O post voltou para quem produziu.",
  );
}
