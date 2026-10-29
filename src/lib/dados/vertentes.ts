import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import type { Vertente } from "@/lib/dominio/vertentes";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * As vertentes de uma conta (migration 0118).
 *
 * **QUEM RECORTA É A POLICY, e esta consulta não repete a pergunta.**
 * `client_vertentes_select` é `is_staff() or client_id in my_client_ids()`,
 * então a mesma função serve a ficha do cliente, o seletor da task e a
 * Biblioteca do portal — e o cliente só alcança as da empresa dele sem uma
 * linha a respeito aqui. Repetir o filtro criaria o segundo lugar onde a
 * regra pode divergir.
 *
 * **A DESATIVADA VEM JUNTO**, nas duas leituras: a ficha do cliente é onde se
 * reativa uma, e no seletor da demanda ela precisa continuar nomeando a
 * frente de uma task que já aponta para ela. Quem decide o que o SELETOR
 * oferece é `vertentesParaEscolher()`, do lado do domínio.
 *
 * **A ORDEM É A DA COLUNA `ordem`, com o nome desempatando.** Sem o segundo
 * critério, duas linhas com a mesma posição saem numa sequência que o
 * Postgres não garante — e a lista trocaria de ordem sozinha entre duas
 * visitas, que é o tipo de defeito que ninguém consegue reproduzir.
 */
export async function vertentesDoCliente(clienteId: string | null): Promise<Vertente[]> {
  // O RASCUNHO NASCE SEM CLIENTE (0028), e aí não há conta de quem perguntar.
  // Sem esta linha a consulta sairia com `client_id = null`, que o PostgREST
  // manda como `is null` — e devolveria as vertentes de nenhuma conta, o que
  // é o resultado certo por acaso e uma ida ao banco por abertura de
  // rascunho.
  if (!clienteId) return [];

  const supabase = await criarClienteServidor();
  return ouFalha(
    "vertentes do cliente",
    await supabase
      .from("client_vertentes")
      .select("*")
      .eq("client_id", clienteId)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true }),
  );
}

/**
 * As vertentes de VÁRIAS contas de uma vez, para os filtros.
 *
 * O board, o calendário e a lista precisam do nome da vertente de cada
 * demanda da tela, que vem de contas diferentes. Uma consulta por conta seria
 * uma ida ao banco por cliente numa listagem que já carrega dez.
 *
 * **A DESATIVADA VEM JUNTO**, e é obrigatório: o filtro desenha o nome da
 * vertente de uma demanda que já aponta para ela, e sumir com a linha
 * deixaria a demanda classificada sem nome na tela. Quem decide o que o
 * SELETOR oferece é `vertentesParaEscolher()`, do lado do domínio.
 */
export async function vertentesDasContas(
  clienteIds: string[],
): Promise<Map<string, Vertente[]>> {
  const limpos = [...new Set(clienteIds.filter(Boolean))];
  if (limpos.length === 0) return new Map();

  const supabase = await criarClienteServidor();
  const data = ouFalha(
    "vertentes das contas",
    await supabase
      .from("client_vertentes")
      .select("*")
      .in("client_id", limpos)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true }),
  );

  const mapa = new Map<string, Vertente[]>();
  for (const v of data) {
    const lista = mapa.get(v.client_id) ?? [];
    lista.push(v);
    mapa.set(v.client_id, lista);
  }
  return mapa;
}
