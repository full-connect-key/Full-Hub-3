/**
 * Versao de prototipo de src/lib/dados/novidades.ts.
 *
 * AS DUAS AREAS APARECEM, e e o criterio: a faixa some quando nao ha nada, e
 * uma tela sem faixa nao prova que ela esta certa -- prova so que ela sabe
 * sumir.
 */
import type { NovidadeDeArea } from "../../src/lib/dados/novidades";

export type { NovidadeDeArea };

export async function minhasNovidades(): Promise<NovidadeDeArea[]> {
  return [
    { area: "social", ids: ["n1", "n2"] },
    { area: "campanhas", ids: ["n3"] },
  ];
}
