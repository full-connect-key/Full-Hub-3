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
 */

export type LinhaDaAuditoria = {
  id: string;
  tabela: string;
  registroId: string | null;
  operacao: Operacao;
  quando: string;
  /** Nulo quando a escrita veio do seed, de uma rotina ou da chave de serviço. */
  quem: { id: string; nome: string } | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

export type FiltrosDaAuditoria = {
  tabela?: string | null;
  quem?: string | null;
  de?: string | null;
  ate?: string | null;
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

  let consulta = supabase
    .from("audit_log")
    .select("*")
    .order("quando", { ascending: false })
    // UMA A MAIS DO QUE CABE. É como se sabe que há próxima página sem pedir
    // um `count` exato — que numa tabela que só cresce é uma varredura inteira
    // para escrever um número que ninguém lê.
    .limit(filtros.limite + 1);

  if (filtros.tabela) consulta = consulta.eq("tabela", filtros.tabela);
  if (filtros.quem) consulta = consulta.eq("quem", filtros.quem);
  if (filtros.de) consulta = consulta.gte("quando", filtros.de);
  // `ate` chega como data; o dia inteiro conta, então o corte é no fim dele.
  if (filtros.ate) consulta = consulta.lt("quando", `${filtros.ate}T23:59:59.999Z`);

  const linhas = ouFalha("a trilha de auditoria", await consulta);

  const temMais = linhas.length > filtros.limite;
  const visiveis = temMais ? linhas.slice(0, filtros.limite) : linhas;

  const ids = [...new Set(visiveis.map((l) => l.quem).filter(Boolean))] as string[];
  const pessoas = ids.length
    ? ouFalha(
        "os nomes da auditoria",
        await supabase.from("profiles").select("id, nome").in("id", ids),
      )
    : [];
  const porId = new Map(pessoas.map((p) => [p.id, p]));

  return {
    temMais,
    linhas: visiveis.map((l) => ({
      id: l.id,
      tabela: l.tabela,
      registroId: l.registro_id,
      operacao: l.operacao,
      quando: l.quando,
      // NOME QUE NÃO ESTÁ MAIS NO `profiles` NÃO VIRA LINHA EM BRANCO. Pessoa
      // desligada mantém o perfil (o produto nunca apaga quem tem histórico),
      // mas a coluna é `on delete set null` — se um dia a conta do Auth sair,
      // a auditoria continua dizendo que houve a mudança.
      quem: l.quem ? (porId.get(l.quem) ?? { id: l.quem, nome: "Conta removida" }) : null,
      antes: l.antes,
      depois: l.depois,
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
