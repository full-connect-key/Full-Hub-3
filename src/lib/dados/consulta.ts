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
 * **A MIGRAÇÃO ACABOU, e o que sobrou de `const { data } = await` em
 * `lib/dados/` não é leitura de tabela:** é `auth.admin.getUserById`, é
 * `storage.createSignedUrls`, e são as RPC que tratam o erro na mão de propósito
 * — `home_summary` (a Home não cai por causa do resumo), `is_atendimento` (falha
 * para o lado fechado), `descanso_do_ciclo`, e a faixa de pedidos de nota, que
 * devolve lista vazia porque Notas Fiscais funciona inteira sem ela.
 *
 * Ela foi feita por etapas e não de uma vez, e a ordem não era alfabética:
 * **primeiro o que o cliente lê** — o Portal é a área em que a equipe nunca
 * entra, e uma lista vazia lá pode durar meses sem ninguém desconfiar.
 *
 * **O QUE A CONVERSÃO ENSINOU, e vale para a próxima:**
 *
 * - **`ouFalha(... .maybeSingle())` COLAPSA PARA `never`.** A resposta de
 *   `maybeSingle()` é uma união de duas formas, o genérico resolve a união para
 *   `never`, e o erro não sai na linha da consulta — sai no `...linha` de um
 *   `return` setenta linhas abaixo, dizendo que não se espalha `never`. O
 *   caminho é `.limit(1)` e pegar o primeiro. Foram seis lugares.
 * - **`Promise.resolve({ data: [] })` dentro de um `Promise.all` faz a mesma
 *   coisa**, pelo mesmo motivo: o tipo passa a ser a união dos dois ramos. O
 *   ramo vazio sai de dentro do `Promise.all` — um ternário em volta, ou um
 *   `.then((r) => ouFalha(...))` na consulta e `Promise.resolve([])` no outro
 *   lado.
 * - **O `?? []` sai junto.** Ele afirma que a leitura pode devolver nulo, e
 *   depois de `ouFalha` ela não pode: é a mesma razão pela qual `atrasado` não é
 *   coluna no Financeiro — não se guarda uma segunda resposta para uma pergunta
 *   que já tem uma.
 * - **O rótulo diz QUAL consulta falhou**, e é a metade útil do log. Onde um
 *   `Promise.all` destruturava `{ data }` de três lados, cada resposta ganhou
 *   nome e cada uma foi para o seu `ouFalha`.
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
