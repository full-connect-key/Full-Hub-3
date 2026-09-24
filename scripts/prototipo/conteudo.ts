/**
 * Versao de prototipo de src/lib/dados/conteudo.ts.
 *
 * O que e comum a post e a entregavel de campanha: a conversa e a assinatura
 * dos arquivos. A arte sai de /exemplos/, que sao arquivos do proprio site --
 * `assinarArquivos` nao assina caminho que comeca com "/", entao eles chegam a
 * tela iguais aqui e no app de verdade.
 */
import type { Conteudo } from "../../src/lib/aprovacoes/conteudo";
import type {
  ComentarioDoConteudo,
  RodadaDoConteudo,
  VersaoDoConteudo,
} from "../../src/lib/dados/conteudo";

export type { ComentarioDoConteudo, RodadaDoConteudo, VersaoDoConteudo };

/**
 * A assinatura inteira, e nao so o que o prototipo usa.
 *
 * O modulo real continua no projeto e continua sendo checado: uma versao de
 * exemplo com menos exports quebra o `tsc` do proprio gerador de imagens --
 * que foi como este arquivo cresceu.
 */
export async function rodadasDo(
  _tipo: Conteudo["tipo"],
  _ids: string[],
): Promise<Map<string, RodadaDoConteudo>> {
  return new Map();
}

export async function nomesDe(
  _ids: (string | null)[],
): Promise<Map<string, string>> {
  return new Map();
}

const HOJE = new Date();

export async function comentariosDe(
  conteudo: Conteudo,
): Promise<ComentarioDoConteudo[]> {
  if (conteudo.id !== "p1" && conteudo.id !== "d-lamina") return [];

  return [
    {
      id: "c1",
      texto: "Dá para trocar a foto do fundo pela da loja nova?",
      quando: new Date(HOJE.getTime() - 3600e3 * 5).toISOString(),
      autorId: "cliente",
      autor: "Joana Prado",
      daAgencia: false,
      interno: false,
      respostaA: null,
    },
    {
      id: "c2",
      texto: "Dá sim. Já pedimos para o Bruno.",
      quando: new Date(HOJE.getTime() - 3600e3 * 3).toISOString(),
      autorId: "marina",
      autor: "Marina Costa",
      daAgencia: true,
      interno: false,
      respostaA: "c1",
    },
  ];
}

export async function assinarArquivos(
  _bucket: string,
  _caminhos: (string | null)[],
): Promise<Record<string, string>> {
  return {};
}

export function enderecoDaArte(
  caminho: string | null,
  assinadas: Record<string, string>,
): string | null {
  if (!caminho) return null;
  return assinadas[caminho] ?? caminho;
}
