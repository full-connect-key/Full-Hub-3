import "server-only";

import { ouFalha } from "@/lib/dados/consulta";
import type { EtapaDoFluxo, FluxoDeSocial } from "@/lib/dominio/social-flows";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Os fluxos de social, com a corrente de cada um (migration 0087).
 *
 * **DUAS IDAS AO BANCO E NÃO UM EMBUTIDO**, e a razão é a que a campanha
 * recém-criada pagou: o PostgREST recusa o `select` INTEIRO quando não acha a
 * relação pelo nome escrito, e o erro de um embutido derruba a lista inteira.
 * Duas consultas custam menos que essa classe de bug.
 *
 * `ouFalha()` nas duas: a lista de fluxos É a tela do editor e é o seletor do
 * diálogo que abre o mês. Vazia por falha, ela diria "não há fluxo nenhum" —
 * e quem lesse isso montaria o sexto fluxo igual ao que já existe.
 */
export async function fluxosDeSocial(
  opcoes: { apenasAtivos?: boolean } = {},
): Promise<FluxoDeSocial[]> {
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("social_flows")
    .select("id, nome, descricao, ativo")
    .order("nome");

  if (opcoes.apenasAtivos) consulta = consulta.eq("ativo", true);

  const fluxos = ouFalha("fluxos de social", await consulta);
  if (fluxos.length === 0) return [];

  const elos = ouFalha(
    "elos dos fluxos de social",
    await supabase
      .from("social_flow_steps")
      .select(
        "flow_id, ordem, nome, funcao, papel, aprovacao_cliente, aprovacao_interna, campo",
      )
      .in(
        "flow_id",
        fluxos.map((f) => f.id),
      )
      .order("ordem"),
  );

  const porFluxo = new Map<string, EtapaDoFluxo[]>();
  for (const elo of elos) {
    const lista = porFluxo.get(elo.flow_id) ?? [];
    lista.push({
      ordem: elo.ordem,
      nome: elo.nome,
      funcao: elo.funcao,
      papel: elo.papel,
      aprovacao_cliente: elo.aprovacao_cliente,
      aprovacao_interna: elo.aprovacao_interna,
      campo: elo.campo,
    });
    porFluxo.set(elo.flow_id, lista);
  }

  return fluxos.map((f) => ({
    id: f.id,
    nome: f.nome,
    descricao: f.descricao,
    ativo: f.ativo,
    etapas: porFluxo.get(f.id) ?? [],
  }));
}
