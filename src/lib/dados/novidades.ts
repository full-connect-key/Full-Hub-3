import "server-only";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O que chegou de novo para mim em Social Media e em Campanhas.
 *
 * Decisão do usuário: *"quero que passe Social Media e Campanhas para dentro
 * de Minhas Tasks, com um sinal de notificação, sempre que o colaborador for
 * responsável por algo novo nessas áreas"*.
 *
 * ---------------------------------------------------------------------------
 * **O SINAL É O SINO, LIDO DE OUTRO ÂNGULO — e não um estado novo.**
 *
 * "Algo novo é meu nessas áreas" já é um fato gravado: `posts_avisa_responsavel`
 * toca o sino quando a gestão libera um post, `post_etapas` avisa quem ganhou
 * uma etapa da corrente, e a decisão do cliente numa peça de campanha avisa
 * quem a produziu. O que faltava não era o fato — era ele aparecer na tela em
 * que a pessoa trabalha, em vez de só num sino que ela abre por hábito.
 *
 * A alternativa era uma coluna `visto_em` por pessoa e por área, e ela criaria
 * duas verdades sobre a mesma coisa: o sino diria "3 por ler" e a faixa diria
 * "2 novas", e ninguém saberia qual das duas está certa. Aqui marcar como
 * vista **é** marcar como lida, então as duas apagam juntas.
 * ---------------------------------------------------------------------------
 *
 * **A ÁREA SAI DO `link`, e não do `tipo`.** `notification_tipo` tem oito
 * valores e nenhum deles diz "social" ou "campanha" — `task` e `aprovacao`
 * cobrem os dois e mais quatro módulos. O endereço, esse, é exatamente o lugar
 * para onde o aviso leva, que é a pergunta que esta faixa responde.
 *
 * **E `notifications.origem_id` NÃO serve, porque ninguém a escreve.** A coluna
 * existe desde a 0011 e `notificar()` não tem parâmetro para ela — é mais uma
 * ponte construída e nunca atravessada, como `clients.drive_folder_id` até o
 * Sprint 16. Com ela preenchida, o sinal poderia ser por ITEM ("este post é
 * novo") em vez de por área; é o próximo passo barato, e ele custa um
 * parâmetro em `notificar()` mais os pontos de chamada que quiserem usá-lo.
 */
export type NovidadeDeArea = {
  area: "social" | "campanhas";
  /** Os avisos por ler daquela área — os ids existem para marcá-los vistos. */
  ids: string[];
};

/**
 * `/painel/aprovacoes-internas` COMEÇA com `/painel/aprovacoes`, e essa é a
 * pegadinha desta função.
 *
 * Um `startsWith("/painel/aprovacoes")` contaria como Campanhas todo aviso da
 * fila de aval interno — que desde a fusão das abas é outra tela, e para a
 * gestão é a mais movimentada das duas. O número ficaria plausível e errado,
 * que é o pior jeito de um número estar errado.
 */
function areaDoLink(link: string | null): NovidadeDeArea["area"] | null {
  if (!link) return null;
  if (link === "/painel/social-media" || link.startsWith("/painel/social-media?")
      || link.startsWith("/painel/social-media/")) {
    return "social";
  }
  if (link === "/painel/aprovacoes" || link.startsWith("/painel/aprovacoes?")
      || link.startsWith("/painel/aprovacoes/")) {
    return "campanhas";
  }
  return null;
}

export async function minhasNovidades(): Promise<NovidadeDeArea[]> {
  const supabase = await criarClienteServidor();

  // SEM `eq("user_id")`: a RLS de `notifications` fecha em `auth.uid()` desde
  // a 0011, e repetir o filtro aqui seria o segundo lugar onde a regra pode
  // divergir — a mesma decisão de `lib/dados/portal.ts`.
  const { data, error } = await supabase
    .from("notifications")
    .select("id, link")
    .is("lida_em", null)
    .order("created_at", { ascending: false });

  // A FAIXA NÃO DERRUBA A TELA, ao contrário de `ouFalha()` nas consultas que
  // SÃO a tela: Minhas Tasks funciona inteira sem ela, e trocar uma falha
  // parcial por uma total seria perder a lista de hoje por causa de um aviso.
  // É a decisão de `assinarNotas` e da faixa do pedido de nota fiscal.
  if (error) {
    console.error("[consulta:minhas novidades]", error);
    return [];
  }

  const porArea = new Map<NovidadeDeArea["area"], string[]>();
  for (const linha of data ?? []) {
    const area = areaDoLink(linha.link);
    if (!area) continue;
    const lista = porArea.get(area);
    if (lista) lista.push(linha.id);
    else porArea.set(area, [linha.id]);
  }

  // A ordem é fixa e não a da consulta: duas faixas que trocam de lugar
  // conforme quem avisou por último obrigam a reler a tela toda vez.
  return (["social", "campanhas"] as const)
    .filter((area) => porArea.has(area))
    .map((area) => ({ area, ids: porArea.get(area) ?? [] }));
}
