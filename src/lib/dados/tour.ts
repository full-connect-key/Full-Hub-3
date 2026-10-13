import "server-only";

import { obterSessao } from "@/lib/auth/dal";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ProgressoDeTour } from "@/lib/tour/passos";

/**
 * POR ONDE EU PASSEI EM CADA TOUR.
 *
 * ---------------------------------------------------------------------------
 * **FALHA PARA "NINGUÉM COMEÇOU NADA", e é de propósito.** Ela não usa
 * `ouFalha()`, que é a regra para toda leitura que É a tela — aqui a consulta
 * decide se um tour aparece por cima da página, e derrubar o painel inteiro
 * por causa de um tutorial seria trocar uma ausência por uma falha total. É a
 * decisão de `rotinasAgendadas()` e da faixa de novidades de Minhas Tasks.
 *
 * **E O LADO DO ERRO É O SEGURO, mas vale dizer qual é:** com a leitura
 * falhando, a pessoa recebe o diálogo de boas-vindas de novo. É chato uma vez;
 * o erro contrário — dar o tour por concluído — esconderia o tutorial de quem
 * acabou de entrar, que é a única pessoa para quem ele existe. O motivo vai
 * para o log, senão ninguém saberia por que o diálogo volta todo dia.
 * ---------------------------------------------------------------------------
 */

export async function meusTours(): Promise<ProgressoDeTour[]> {
  const sessao = await obterSessao();
  if (!sessao) return [];

  const supabase = await criarClienteServidor();
  // O RECORTE POR PESSOA É EXPLÍCITO, e aqui ele é obrigatório — ao contrário
  // de `lib/dados/portal.ts`, que não repete o filtro de empresa porque a
  // policy já responde. `tour_progresso_select` **abre** para a gestão
  // (`user_id = auth.uid() or is_gestor()`), porque é disso que o
  // acompanhamento vive: sem o `eq` o sócio leria a linha de outra pessoa, e o
  // diálogo de boas-vindas dele nunca apareceria. A policy é a trava; o filtro
  // é a pergunta certa.
  const { data, error } = await supabase
    .from("tour_progresso")
    .select("tour_id, versao, status, passo_atual, finalizado_em")
    .eq("user_id", sessao.usuarioId);

  if (error) {
    console.error("[consulta:meus tours]", error);
    return [];
  }

  return (data ?? []).map((linha) => ({
    tourId: linha.tour_id,
    versao: linha.versao,
    status: linha.status,
    passoAtual: linha.passo_atual,
    finalizadoEm: linha.finalizado_em,
  }));
}
