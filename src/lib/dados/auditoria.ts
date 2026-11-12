import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Operacao } from "@/lib/dominio/auditoria";

/**
 * A leitura da trilha de auditoria.
 *
 * **A consulta não repete quem pode ler.** `audit_log_select` fecha em
 * `is_socio()` no banco (0058), e `QUEM_VE` na página devolve 403 antes.
 * Acrescentar aqui um terceiro filtro seria um terceiro lugar onde a regra
 * pode divergir — e o terceiro é sempre o que fica para trás.
 *
 * **`ouFalha()` em tudo, e aqui ele vale mais que de costume:** a recusa do
 * RLS chega como lista vazia, e nesta tela lista vazia tem um significado
 * legítimo — "ninguém mexeu em nada neste período". As duas coisas são
 * indistinguíveis, e a errada é a que diz que não houve mudança nenhuma numa
 * agência que trabalhou a semana inteira.
 *
 * ---------------------------------------------------------------------------
 * **QUEM LÊ É UMA RPC DESDE A 0135, e a razão é a BUSCA.** A tela traz as 80
 * mais recentes do recorte; filtrar aquelas 80 no navegador seria uma busca
 * que responde "não achei" sobre uma trilha onde a linha existe. E o predicado
 * não cabe no PostgREST: não há como escrever `antes::text ilike …` num
 * filtro, e o nome de quem mexeu mora em `profiles`.
 *
 * **A função NÃO é `security definer`** — é a forma de `busca_global()` (0073):
 * a policy vale dentro dela, então ela não é a porta dos fundos da trilha do
 * sócio. É também por isso que a consulta de nomes desapareceu daqui: o
 * `left join profiles` de dentro dela passa pela policy daquela tabela (0132),
 * e uma segunda ida ao banco para resolver os mesmos nomes seria uma segunda
 * resposta para a mesma pergunta.
 * ---------------------------------------------------------------------------
 */

export type LinhaDaAuditoria = {
  id: string;
  tabela: string;
  registroId: string | null;
  operacao: Operacao;
  quando: string;
  /** Nulo quando a escrita veio do seed, de uma rotina ou da chave de serviço. */
  quem: { id: string; nome: string } | null;
  /**
   * O CAMPO QUE A BUSCA ENCONTROU, e nulo quando não há termo.
   *
   * **Isto não é a coluna "O que mudou" de volta** — ela saiu da tabela em
   * todo estado, por decisão do usuário. Esta é uma linha só, e ela existe
   * para dizer POR QUE aquela linha está no resultado: um recorte que a pessoa
   * não tem como conferir é pior que um recorte a menos.
   */
  encontrado: { campo: string; valor: string } | null;
};

export type FiltrosDaAuditoria = {
  tabela?: string | null;
  quem?: string | null;
  de?: string | null;
  ate?: string | null;
  busca?: string | null;
  /** Quantas linhas trazer. A tela pede uma a mais para saber se há próxima. */
  limite: number;
};

export type PaginaDaAuditoria = {
  linhas: LinhaDaAuditoria[];
  /** Há mais além do limite? Vira "mostrar mais" em vez de um total falso. */
  temMais: boolean;
};

export async function trilhaDeAuditoria(
  filtros: FiltrosDaAuditoria,
): Promise<PaginaDaAuditoria> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "a trilha de auditoria",
    await supabase.rpc("trilha_de_auditoria", {
      p_tabela: filtros.tabela ?? null,
      p_quem: filtros.quem ?? null,
      p_de: filtros.de ?? null,
      // `ate` chega como data; o dia inteiro conta, então o corte é no fim dele.
      p_ate: filtros.ate ? `${filtros.ate}T23:59:59.999Z` : null,
      p_busca: filtros.busca ?? null,
      // UMA A MAIS DO QUE CABE. É como se sabe que há próxima página sem pedir
      // um `count` exato — que numa tabela que só cresce é uma varredura
      // inteira para escrever um número que ninguém lê.
      p_limite: filtros.limite + 1,
    }),
  );

  const temMais = linhas.length > filtros.limite;
  const visiveis = temMais ? linhas.slice(0, filtros.limite) : linhas;

  return {
    temMais,
    linhas: visiveis.map((l) => ({
      id: l.id,
      tabela: l.tabela,
      registroId: l.registro_id,
      operacao: l.operacao as Operacao,
      quando: l.quando,
      // NOME QUE NÃO ESTÁ MAIS NO `profiles` NÃO VIRA LINHA EM BRANCO. Pessoa
      // desligada mantém o perfil (o produto nunca apaga quem tem histórico),
      // mas a coluna é `on delete set null` — se um dia a conta do Auth sair,
      // a auditoria continua dizendo que houve a mudança.
      quem: l.quem ? { id: l.quem, nome: l.quem_nome ?? "Conta removida" } : null,
      encontrado:
        l.campo_encontrado !== null
          ? { campo: l.campo_encontrado, valor: l.valor_encontrado ?? "" }
          : null,
    })),
  };
}

/**
 * Quem aparece no filtro de pessoas.
 *
 * Sai da PRÓPRIA auditoria (`distinct quem`) e não de `profiles`: um filtro com
 * as nove pessoas da agência ofereceria oito que não têm linha nenhuma, e
 * escolher uma delas mostraria uma tela vazia que parece defeito.
 */
export async function quemApareceNaAuditoria(): Promise<{ id: string; nome: string }[]> {
  const supabase = await criarClienteServidor();

  const linhas = ouFalha(
    "quem aparece na auditoria",
    await supabase.from("audit_log").select("quem").not("quem", "is", null).limit(2000),
  );

  const ids = [...new Set(linhas.map((l) => l.quem))] as string[];
  if (ids.length === 0) return [];

  const pessoas = ouFalha(
    "os nomes do filtro da auditoria",
    await supabase.from("profiles").select("id, nome").in("id", ids),
  );

  return pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
