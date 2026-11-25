import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import {
  montarLinhas,
  type ConsumoDoEscopo,
  type ItemDoEscopo,
  type LinhaDoEscopo,
} from "@/lib/dominio/escopo";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * O escopo do contrato mensal de uma conta (migration 0149).
 *
 * ---------------------------------------------------------------------------
 * **NÃO É `security definer`, e é a linha que mais importa.** As duas policies
 * de SELECT da 0149 são `is_staff() or <a conta é do cliente>`, então a RLS
 * **já permite** — e uma função de banco com `definer` aqui não destravaria
 * nada e entregaria o contrato de qualquer conta a quem tiver a chave anon. É
 * a forma de `busca_global()` (0073) e de `vertentesDoCliente()` (0118): a
 * policy vale dentro da consulta, e a mesma função serve a ficha do cliente e
 * o portal sem repetir a pergunta.
 *
 * ---------------------------------------------------------------------------
 * **SÃO DUAS IDAS E NÃO UM EMBUTIDO.** `client_scope_usage` aponta para o
 * item, e a tentação é `client_scope_items(…)` dentro do `select` do consumo —
 * o PostgREST recusa o `select` INTEIRO quando não acha a relação pelo nome
 * escrito, e foi assim que uma campanha recém-criada não apareceu em lugar
 * nenhum. Duas consultas custam menos que essa classe de bug.
 *
 * ---------------------------------------------------------------------------
 * **A COMPETÊNCIA É PEDIDA e nunca lida do relógio aqui.** Quem a decide é a
 * tela — o portal abre no mês corrente, a ficha abre no mês que a pessoa
 * escolheu —, e um `hojeNaAgencia()` dentro desta função faria o seletor da
 * ficha não mudar nada.
 */
export async function escopoDasContas(
  clienteIds: string[],
  competencia: string,
): Promise<Map<string, LinhaDoEscopo[]>> {
  const limpos = [...new Set(clienteIds.filter(Boolean))];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();

  // A ORDEM É `ordem` COM A DESCRIÇÃO DESEMPATANDO, pela razão das vertentes:
  // duas linhas com a mesma posição saem numa sequência que o Postgres não
  // garante, e a lista trocaria de ordem sozinha entre duas visitas.
  const itens: ItemDoEscopo[] = ouFalha(
    "o escopo das contas",
    await supabase
      .from("client_scope_items")
      .select("*")
      .in("client_id", limpos)
      .order("ordem", { ascending: true })
      .order("descricao", { ascending: true }),
  );

  if (itens.length === 0) return new Map();

  const consumo: ConsumoDoEscopo[] = ouFalha(
    "o consumo do escopo",
    await supabase
      .from("client_scope_usage")
      .select("*")
      .in(
        "item_id",
        itens.map((i) => i.id),
      )
      .eq("competencia", competencia),
  );

  const porConta = new Map<string, ItemDoEscopo[]>();
  for (const item of itens) {
    const lista = porConta.get(item.client_id) ?? [];
    lista.push(item);
    porConta.set(item.client_id, lista);
  }

  const mapa = new Map<string, LinhaDoEscopo[]>();
  for (const [conta, lista] of porConta) {
    mapa.set(conta, montarLinhas(lista, consumo));
  }
  return mapa;
}

/** O escopo de UMA conta, que é o caso da ficha do cliente. */
export async function escopoDaConta(
  clienteId: string,
  competencia: string,
): Promise<LinhaDoEscopo[]> {
  const mapa = await escopoDasContas([clienteId], competencia);
  return mapa.get(clienteId) ?? [];
}
