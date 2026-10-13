import "server-only";

import { obterSessao } from "@/lib/auth/dal";
import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { TourStatus, UserRole } from "@/lib/supabase/database.types";
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

/**
 * PESSOA × TOUR, para a gestão.
 *
 * ---------------------------------------------------------------------------
 * **A RECUSA CHEGA COMO ERRO E NÃO COMO LISTA VAZIA**, e é por isso que esta é
 * a única leitura do módulo com `ouFalha()`: a diferença entre "você não pode"
 * e "ninguém começou nenhum tour" é tudo numa tela de acompanhamento. Quem
 * recusa é `is_gestor()` na primeira linha de `tour_acompanhamento()`, e não
 * esta função.
 *
 * **E A LISTA INCLUI QUEM NUNCA COMEÇOU**, com `tourId` nulo — é justamente
 * essa pessoa que a tela procura, e um `select` em `tour_progresso` seria cego
 * para ela. A conta inteira está no cabeçalho da 0101.
 * ---------------------------------------------------------------------------
 */
export type LinhaDoAcompanhamentoDeTour = {
  userId: string;
  pessoa: string;
  role: UserRole;
  tourId: string | null;
  status: TourStatus | null;
  passoAtual: number | null;
  pulados: string[];
  semAncora: string[];
};

export async function acompanhamentoDosTours(): Promise<
  LinhaDoAcompanhamentoDeTour[]
> {
  const supabase = await criarClienteServidor();
  const linhas = ouFalha(
    "o acompanhamento dos tours",
    await supabase.rpc("tour_acompanhamento"),
  );

  return linhas.map((l) => ({
    userId: l.user_id,
    pessoa: l.pessoa,
    role: l.role,
    tourId: l.tour_id,
    status: l.status,
    passoAtual: l.passo_atual,
    pulados: l.passos_pulados ?? [],
    semAncora: l.passos_sem_ancora ?? [],
  }));
}
