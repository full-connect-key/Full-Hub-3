import "server-only";

import { cache } from "react";

import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O resumo da tela inicial — um JSON, uma ida ao banco.
 *
 * **Uma chamada e não sete.** Os números da Home são contagens sobre cinco
 * tabelas, e sete `select` pelo PostgREST seriam sete idas à rede em série
 * para desenhar a primeira tela que todo mundo abre, todo dia. A conta inteira
 * mora em `home_summary()` (0049) e volta montada.
 *
 * **E NÃO EXISTE CACHE ENTRE REQUISIÇÕES, que é onde o sprint pedia
 * `unstable_cache` de 5 minutos.** O motivo é mecânico antes de ser de
 * produto: `home_summary()` não é `security definer` — ela pergunta
 * `auth.uid()` e o RLS decide o que cada `select` de dentro enxerga. Um cache
 * de servidor precisa de um cliente sem cookie para rodar dentro dele, e sem
 * cookie a função devolve `{}`; com o cookie, `cookies()` dentro de
 * `unstable_cache` estoura.
 *
 * Daria para contornar lendo o id da pessoa fora e usando a chave de serviço
 * dentro — e aí o cache passaria a guardar, sob uma chave montada à mão, um
 * resumo que depende de permissão. **Uma chave errada ali mostra os números da
 * agência inteira para um colaborador**, e o erro não aparece: os números
 * existem, só são de outra pessoa. Não vale os 5 minutos.
 *
 * O `cache()` do React fica: ele deduplica dentro da MESMA renderização, que é
 * o caso real de a Home pedir o resumo em dois blocos diferentes.
 */
export type ResumoDaHome = {
  meu_dia?: { atrasadas?: number; hoje?: number; semana?: number };
  precisa_de_mim?: {
    aprovacoes?: number;
    comentarios?: number;
    pedidos_rh?: number;
  };
  fora_hoje?: { nome: string; estado: string }[];
  /** Só para gestão — a função não devolve as duas para o resto. */
  pulso?: {
    etapas_abertas?: number;
    atrasadas?: number;
    concluidas_semana?: number;
    posts_com_cliente?: number;
    campanhas_ativas?: number;
  };
  clientes_em_atencao?: {
    cliente: string;
    cliente_id: string;
    paradas: number;
    dias: number;
  }[];
};

export const resumoDaHome = cache(async (): Promise<ResumoDaHome> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("home_summary");

  if (error) {
    // A HOME NÃO CAI POR CAUSA DO RESUMO, e é a única leitura do produto que
    // pode falhar assim. Ela é a primeira tela de todo mundo: perder os
    // números é ruim, perder o acesso ao menu é pior. O erro vai para o log
    // do servidor, e os blocos somem — nenhum deles mostra zero, que seria
    // uma afirmação sobre a agência.
    console.error("[home] home_summary falhou:", error);
    return {};
  }

  return (data ?? {}) as ResumoDaHome;
});
