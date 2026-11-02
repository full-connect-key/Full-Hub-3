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
      cardIndice: null,
      cardVersao: null,
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
      cardIndice: null,
      cardVersao: null,
    },

    // A CONVERSA DE UM CARD, e de UM SÓ (0126).
    //
    // Ela é o que faz a peça nova sair em imagem: o marcador no terceiro
    // quadro da faixa, o seletor de escopo com os dois números, e a linha que
    // diz de qual versão era o pedido.
    //
    // **E um só de propósito.** Com marcador nos três, a imagem provaria que
    // o selo aparece e não que ele DISTINGUE — que é a razão pela qual o
    // exemplo do calendário tem um evento de cada par da legenda. Com o card
    // 3 marcado e os dois primeiros limpos, o "não misturar cards" do pedido
    // aparece desenhado.
    {
      id: "c3",
      texto: "No terceiro, o preço ficou por cima da folha. Dá para subir?",
      quando: new Date(HOJE.getTime() - 3600e3 * 2).toISOString(),
      autorId: "cliente",
      autor: "Joana Prado",
      daAgencia: false,
      interno: false,
      respostaA: null,
      cardIndice: 2,
      cardVersao: 2,
    },
    {
      id: "c4",
      texto: "Subi dois centímetros. Olha se ficou bom assim.",
      quando: new Date(HOJE.getTime() - 3600e3).toISOString(),
      autorId: "marina",
      autor: "Marina Costa",
      daAgencia: true,
      interno: false,
      respostaA: "c3",
      cardIndice: 2,
      cardVersao: 2,
    },
  ];
}

export async function assinarArquivos(
  _bucket: string,
  caminhos: (string | null)[],
): Promise<Record<string, string>> {
  // DEVOLVE O PROPRIO CAMINHO, como os stubs de posts e de campanhas: as
  // artes de exemplo moram em `public/`. O mapa vazio so funcionava para quem
  // caia num `?? url` depois -- quem NAO cai e a biblioteca, que procura o
  // endereco no mapa e deixaria a moldura vazia em toda peca.
  const mapa: Record<string, string> = {};
  for (const c of caminhos) if (c) mapa[c] = c;
  return mapa;
}

export function enderecoDaArte(
  caminho: string | null,
  assinadas: Record<string, string>,
): string | null {
  if (!caminho) return null;
  return assinadas[caminho] ?? caminho;
}
