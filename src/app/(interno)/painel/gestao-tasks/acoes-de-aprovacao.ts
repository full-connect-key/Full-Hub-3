"use server";

import { revalidatePath } from "next/cache";

import { exigirEquipeNaAcao, exigirGestorNaAcao } from "@/lib/acoes/guardas";
import { executarAcao, falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { situacaoDasRodadas } from "@/lib/tasks/state-machine";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

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
 *   deixaria a agência parada quando o desenvolvedor está de folga. O que não
 *   muda em hipótese nenhuma: ninguém aprova a própria entrega.
 *   Para restringir só ao desenvolvedor, troque `exigirGestorNaAcao` por uma
 *   checagem de `role === "desenvolvedor"` aqui e `is_gestor()` por
 *   `auth_role() = 'desenvolvedor'` em `pode_aprovar_subtarefa()`, na 0007.
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
  rodadas: { id: string; numero_rodada: number; escopo: "interna" | "cliente"; status: Database["public"]["Enums"]["status_rodada"] }[];
};

async function lerSubtarefa(supabase: ClienteSupabase, id: string): Promise<Contexto | null> {
  const { data: subtarefa } = await supabase
    .from("subtasks")
    .select("id, task_id, titulo, responsavel_id, requer_aprovacao, tipo_aprovacao, status")
    .eq("id", id)
    .maybeSingle();
  if (!subtarefa) return null;

  const { data: rodadas } = await supabase
    .from("approval_rounds")
    .select("id, numero_rodada, escopo, status")
    .eq("subtask_id", id)
    .order("numero_rodada", { ascending: false });

  return { subtarefa, rodadas: rodadas ?? [] };
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
      return falha("Esta subtarefa não exige aprovação — ela se conclui direto.");
    }
    // O responsável envia a dele. A gestão também pode, para destravar quando
    // a pessoa está fora — é o que o trigger `validar_nova_rodada` já permite,
    // e a tela oferece o botão nos dois casos. Recusar aqui deixaria um botão
    // que só dá erro.
    const souOResponsavel = subtarefa.responsavel_id === sessao.usuarioId;
    const souGestor = sessao.profile.role === "desenvolvedor" || sessao.profile.role === "socio";
    if (!souOResponsavel && !souGestor) {
      return falha("Só o responsável pela subtarefa, ou a gestão, envia para aprovação.");
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
        subtask_id: subtaskId,
        numero_rodada: numero,
        escopo: "interna",
        // Quem consta como solicitante é sempre quem PRODUZIU: é dele a
        // entrega, e é a ele que a decisão volta. A gestão apertar o botão no
        // lugar dele não muda de quem é o trabalho.
        solicitado_por: subtarefa.responsavel_id ?? sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !rodada) return falha(error?.message ?? "Não foi possível abrir a rodada.");

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
      return falha(erroDoStatus?.message ?? "Não foi possível mover a subtarefa.");
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
export async function aprovarInterna(roundId: string, comentario?: string): Promise<Resultado> {
  return executarAcao("aprovarInterna", async () => {
    const sessao = await exigirGestorNaAcao();
    const supabase = await criarClienteServidor();

    const { data: rodada } = await supabase
      .from("approval_rounds")
      .select("id, subtask_id, numero_rodada, escopo, status")
      .eq("id", roundId)
      .maybeSingle();

    if (!rodada) return falha("Rodada não encontrada.");
    if (rodada.status !== "pendente") return falha("Esta rodada já foi decidida.");
    if (rodada.escopo !== "interna") return falha("Esta rodada é a do cliente, não a interna.");

    const ctx = await lerSubtarefa(supabase, rodada.subtask_id);
    if (!ctx) return falha("Subtarefa não encontrada.");

    if (ctx.subtarefa.responsavel_id === sessao.usuarioId) {
      return falha("Ninguém aprova a própria entrega — outra pessoa da gestão precisa decidir.");
    }

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
    if (!data) return falha("O banco recusou a aprovação. Só a gestão decide, e nunca a própria entrega.");

    // Tipo interna: acabou, a subtarefa conclui.
    // Tipo cliente: ela FICA esperando. O envio ao cliente é um ato
    // deliberado de quem gerencia, não uma consequência automática.
    let mensagem = "Aprovada internamente.";
    if (ctx.subtarefa.tipo_aprovacao === "interna") {
      const { error: erroDoStatus } = await supabase
        .from("subtasks")
        .update({ status: "concluida" })
        .eq("id", rodada.subtask_id)
        .select("id");
      if (erroDoStatus) return falha(erroDoStatus.message);
      mensagem = "Aprovada — subtarefa concluída.";
    } else {
      mensagem = 'Aprovada internamente. Agora dá para usar "Enviar para o cliente".';
    }

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: rodada.subtask_id,
      approval_round_id: roundId,
      acao: "aprovacao_interna",
      para_valor: `Rodada ${rodada.numero_rodada}`,
      autor_id: sessao.usuarioId,
    });

    if (comentario?.trim()) {
      await supabase.from("task_comentarios").insert({
        task_id: ctx.subtarefa.task_id,
        subtask_id: rodada.subtask_id,
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
      return falha("Diga o que precisa ser ajustado — pedido sem motivo não ajuda ninguém.");
    }

    const supabase = await criarClienteServidor();

    const { data: rodada } = await supabase
      .from("approval_rounds")
      .select("id, subtask_id, numero_rodada, escopo, status")
      .eq("id", roundId)
      .maybeSingle();

    if (!rodada) return falha("Rodada não encontrada.");
    if (rodada.status !== "pendente") return falha("Esta rodada já foi decidida.");

    const ctx = await lerSubtarefa(supabase, rodada.subtask_id);
    if (!ctx) return falha("Subtarefa não encontrada.");
    if (ctx.subtarefa.responsavel_id === sessao.usuarioId) {
      return falha("Ninguém decide a própria entrega.");
    }

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
    if (!data) return falha("O banco recusou a decisão. Só a gestão decide, e nunca a própria entrega.");

    const { error: erroDoStatus } = await supabase
      .from("subtasks")
      .update({ status: "em_ajustes" })
      .eq("id", rodada.subtask_id)
      .select("id");
    if (erroDoStatus) return falha(erroDoStatus.message);

    await supabase.from("task_comentarios").insert({
      task_id: ctx.subtarefa.task_id,
      subtask_id: rodada.subtask_id,
      approval_round_id: roundId,
      autor_id: sessao.usuarioId,
      texto: comentario.trim(),
      interno: true,
    });

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: rodada.subtask_id,
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
    if (ctx.subtarefa.responsavel_id === sessao.usuarioId) {
      return falha(
        "Ninguém envia ao cliente a própria entrega. Quem aprovou internamente é quem envia.",
      );
    }

    const situacao = situacaoDasRodadas(ctx.rodadas, ctx.subtarefa.tipo_aprovacao);
    if (!situacao.avalInterno) {
      return falha("Esta rodada ainda não passou pela aprovação interna.");
    }
    if (situacao.enviadaAoCliente) {
      return falha("Esta rodada já foi enviada ao cliente.");
    }

    const { data: rodada, error } = await supabase
      .from("approval_rounds")
      .insert({
        subtask_id: subtaskId,
        numero_rodada: situacao.rodadaAtual,
        escopo: "cliente",
        solicitado_por: sessao.usuarioId,
      })
      .select("id")
      .single();

    if (error || !rodada) return falha(error?.message ?? "Não foi possível enviar.");

    await registrar(supabase, {
      task_id: ctx.subtarefa.task_id,
      subtask_id: subtaskId,
      approval_round_id: rodada.id,
      acao: "enviada_ao_cliente",
      para_valor: `Rodada ${situacao.rodadaAtual}`,
      autor_id: sessao.usuarioId,
    });

    revalidar(ctx.subtarefa.task_id);
    return sucesso("Enviada ao cliente. Ela já aparece no Portal.");
  });
}
