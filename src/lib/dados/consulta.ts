import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Uma leitura que falhou não pode virar uma lista vazia.
 *
 * **Isto nasceu de um bug de verdade**, e ele é o melhor argumento que existe
 * para a regra. A listagem de campanhas pedia uma coluna que não existe
 * (`clients(nome)`, quando a coluna é `nome_empresa`); o PostgREST recusava a
 * consulta inteira; `const { data } = await consulta` jogava o erro fora; e a
 * tela dizia **"Nenhuma campanha aberta"** para quem tinha acabado de criar
 * uma. O usuário abriu a campanha três vezes antes de relatar.
 *
 * O produto já tem a regra para o outro lado — *nenhuma escrita pode falhar em
 * silêncio* —, e a leitura é pior: a escrita que falha mostra um toast, e a
 * leitura que falha mostra uma tela vazia, que é **indistinguível da
 * verdade**. Ninguém desconfia de uma lista vazia.
 *
 * **Por que lança em vez de devolver `[]`:** o Next mostra a tela de erro, e
 * quem está usando descobre que algo quebrou em vez de concluir que não há
 * nada. O erro inteiro vai para o log do servidor, que é onde está o nome da
 * coluna errada.
 *
 * O restante de `lib/dados/` ainda descarta erro de leitura no mesmo formato —
 * são dezenas de `const { data } = await`. A troca é mecânica e não foi feita
 * de uma vez de propósito: cada módulo tem o seu jeito de lidar com o vazio
 * legítimo, e trocar tudo sem olhar transformaria "esta pessoa não tem task
 * nenhuma" em tela de erro.
 */
export function ouFalha<T>(
  ondeFoi: string,
  resposta: { data: T | null; error: PostgrestError | null },
): T {
  if (resposta.error) {
    console.error(`[consulta:${ondeFoi}]`, resposta.error);
    throw new Error(
      `A consulta de ${ondeFoi} falhou: ${resposta.error.message}`,
    );
  }
  // `data` nulo sem erro é resposta legítima de `maybeSingle()` — quem chama
  // decide o que fazer com isso. O que esta função garante é que o nulo não
  // está escondendo uma recusa.
  return resposta.data as T;
}
