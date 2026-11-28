/**
 * Versao de prototipo de src/lib/dados/sugestoes.ts.
 *
 * Duas sugestoes, uma ja vista: o botao precisa mostrar o contador e a lista
 * precisa distinguir os dois estados.
 */
import type { SugestaoNaTela } from "../../src/lib/dados/sugestoes";

export type { SugestaoNaTela };

export async function sugestoesParaLer(): Promise<SugestaoNaTela[]> {
  return [
    {
      id: "5c000000-0000-0000-0000-000000000001",
      texto: "Poder filtrar o board por mais de um cliente ao mesmo tempo.",
      autor: "Marina Costa",
      criadaEm: new Date().toISOString(),
      vista: false,
    },
    {
      id: "5c000000-0000-0000-0000-000000000002",
      texto: "Um atalho para duplicar uma demanda.",
      autor: "Bruno Lima",
      criadaEm: new Date(Date.now() - 86400000 * 3).toISOString(),
      vista: true,
    },
  ];
}
