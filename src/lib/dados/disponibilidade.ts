import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import type { DiaDeDisponibilidade, ItemDoDia } from "@/lib/dominio/disponibilidade";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Os dias de quem vai receber o trabalho (migration 0081).
 *
 * **A PONTE ESTAVA CONSTRUÍDA E NINGUÉM A ATRAVESSAVA.** `disponibilidade()`
 * está no banco desde a 0081 e nenhuma linha de `src/` a chamava — é a décima
 * segunda ponte do produto, junto com `clients.drive_folder_id` antes do
 * Sprint 16 e `posts.subtask_id` antes da 0061. Este arquivo é a travessia, e
 * por isso ele não tem migration nenhuma.
 *
 * `security definer` com `is_staff()` na porta: quem delega precisa ver o
 * calendário de OUTRA pessoa, e `subtasks_select` não devolve a etapa alheia
 * para um colaborador. O que sai é agregado — minutos por dia e até cinco
 * títulos.
 *
 * **`ouFalha()` e não `?? []`**, e aqui ele faz mais que de costume: a recusa
 * desta função chega como ERRO e não como lista vazia, então sem ele um
 * cliente logado veria uma grade de dias livres — que é a pior resposta
 * possível numa tela cujo trabalho é dizer onde não cabe mais nada.
 */
export async function disponibilidadeDe(
  userId: string,
  inicio: string,
  fim: string,
): Promise<DiaDeDisponibilidade[]> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "disponibilidade de alguém",
    await supabase.rpc("disponibilidade", {
      p_user_id: userId,
      p_inicio: inicio,
      p_fim: fim,
      // OS DOIS VÃO EXPLÍCITOS mesmo tendo default, porque quem lê a chamada
      // precisa ver o que ela pede. `distribuida` é a estimativa repartida
      // pela janela da etapa; o outro modo responde o que VENCE no dia, que é
      // a outra pergunta e tem outra tela.
      p_modo: "distribuida",
      p_incluir_concluidas: false,
      // A porta de delegar projeta sempre, e o terceiro parâmetro é ignorado
      // por ela — está aqui para o tipo bater com a assinatura do banco.
      p_daqui_pra_frente: true,
    }),
  );

  return (linhas ?? []).map((l) => ({
    data: l.data,
    diaUtil: l.dia_util,
    capacidadeMinutos: l.capacidade_minutos,
    indisponivelMotivo: l.indisponivel_motivo,
    cargaMinutos: l.carga_minutos,
    etapas: l.etapas_count,
    entregas: l.entregas_count,
    entregasMinutos: l.entregas_minutos,
    ocupacaoPct: l.ocupacao_pct,
    evento: l.evento,
    itens: itensDoDia(l.itens),
  }));
}

/**
 * O `jsonb` da função virando o tipo da tela.
 *
 * Ele é escrito por `jsonb_build_object` e tem forma conhecida — mas vem como
 * `Json`, e um `as` direto afirmaria o que ninguém conferiu. Linha torta é
 * descartada em vez de derrubar a leitura: a grade vale sem um dos cinco
 * títulos, e não vale sem os minutos do dia.
 */
function itensDoDia(bruto: unknown): ItemDoDia[] {
  if (!Array.isArray(bruto)) return [];

  const itens: ItemDoDia[] = [];
  for (const linha of bruto) {
    if (typeof linha !== "object" || linha === null) continue;
    const item = linha as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.titulo !== "string") continue;
    itens.push({
      id: item.id,
      titulo: item.titulo,
      cliente: typeof item.cliente === "string" ? item.cliente : null,
      minutos: typeof item.minutos === "number" ? item.minutos : 0,
      prazo: typeof item.prazo === "string" ? item.prazo : null,
    });
  }
  return itens;
}
