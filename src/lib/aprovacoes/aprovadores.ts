import "server-only";

import type { criarClienteServidor } from "@/lib/supabase/server";

type ClienteSupabase = Awaited<ReturnType<typeof criarClienteServidor>>;

/**
 * GRAVAR OS APROVADORES DE UMA RODADA QUE ACABOU DE NASCER (migration 0129).
 *
 * ---------------------------------------------------------------------------
 * **SÃO DUAS ESCRITAS E NÃO UMA, e a ordem é forçada pelo banco.** O `insert`
 * em `approval_rounds` leva a PRIMEIRA pessoa em `aprovador_id` — é ela que a
 * trava da 0128 exige no envio, e é dela que
 * `approval_rounds_vincula_aprovador` monta a primeira linha de vínculo. As
 * outras só podem entrar depois: a tabela de vínculo tem chave estrangeira
 * para a rodada, então não há onde escrevê-las antes de a rodada existir. É a
 * forma da vertente na 0122 e das sete colunas de briefing na 0125 — segunda
 * escrita depois de a RPC devolver, porque a assinatura da primeira não muda.
 *
 * **E A SEGUNDA NÃO DERRUBA A PRIMEIRA**, que é a decisão da 0052 letra por
 * letra: a rodada já está gravada, o cliente já foi avisado e o material já
 * está no portal dele. Uma recusa aqui não desfaz nada, então o que ela pode
 * fazer é AVISAR — e o aviso nomeia a saída, que é trocar quem aprova no
 * histórico da rodada. Derrubar o envio inteiro por causa da terceira pessoa
 * da lista seria perder um envio que aconteceu.
 *
 * **E ELA NÃO ACONTECE QUANDO HÁ UMA PESSOA SÓ.** Com uma, `aprovador_id` e o
 * gatilho já disseram tudo o que havia a dizer, e a chamada seria um `insert …
 * on conflict do nothing` que não muda linha nenhuma — a economia da guarda do
 * cascade na 0114, e não uma trava.
 *
 * Devolve `null` quando não havia o que fazer ou deu certo, e a frase do aviso
 * quando a segunda escrita falhou.
 */
export async function gravarOsOutrosAprovadores(
  supabase: ClienteSupabase,
  roundId: string,
  aprovadorIds: string[],
): Promise<string | null> {
  if (aprovadorIds.length < 2) return null;

  const { error } = await supabase.rpc("definir_aprovadores_da_rodada", {
    p_round_id: roundId,
    p_aprovadores: aprovadorIds,
  });

  if (!error) return null;

  return `O material foi enviado, mas só a primeira pessoa ficou nomeada: ${error.message}`;
}

/**
 * O MESMO, PARA O MÊS INTEIRO (migration 0129).
 *
 * ---------------------------------------------------------------------------
 * **É UMA FUNÇÃO PRÓPRIA E NÃO UM LAÇO AQUI.** `enviar_mes_ao_cliente` abre
 * uma rodada por peça elegível, e com dezoito peças um laço do lado de cá
 * seriam dezoito idas ao PostgREST — e a décima falhando deixaria metade do mês
 * com um aprovador e metade com três, sem nada na tela dizendo qual é qual. É a
 * ordem de `abrir_mes_de_social`, que confere os cinco períodos antes de abrir
 * post nenhum.
 *
 * **E O AVISO SAI UMA VEZ POR PESSOA, nunca um por peça**, que é a frase que
 * criou o lote na 0090: dezoito sinos para um envio é o caminho mais curto para
 * o sino virar ruído. Quem silencia as rodadas e toca o sino no fim é
 * `definir_aprovadores_do_lote`, por um GUC de escopo local — a forma de
 * `full_hub.corrente` (0045), desligado antes de a função devolver.
 */
export async function gravarOsOutrosAprovadoresDoLote(
  supabase: ClienteSupabase,
  loteId: string,
  aprovadorIds: string[],
): Promise<string | null> {
  if (aprovadorIds.length < 2) return null;

  const { error } = await supabase.rpc("definir_aprovadores_do_lote", {
    p_lote_id: loteId,
    p_aprovadores: aprovadorIds,
  });

  if (!error) return null;

  return `O mês foi enviado, mas só a primeira pessoa ficou nomeada: ${error.message}`;
}
