/**
 * Versao de prototipo de src/lib/dados/conteudo.ts.
 *
 * O que e comum a post e a entregavel de campanha: a conversa e a assinatura
 * dos arquivos. A arte sai de /exemplos/, que sao arquivos do proprio site --
 * `assinarArquivos` nao assina caminho que comeca com "/", entao eles chegam a
 * tela iguais aqui e no app de verdade.
 */
import type { Conteudo } from "../../src/lib/aprovacoes/conteudo";
import type { RodadaDoHistorico } from "../../src/lib/aprovacoes/conteudo";
import type {
  ComentarioDoConteudo,
  RodadaDoConteudo,
  VersaoDoConteudo,
} from "../../src/lib/dados/conteudo";

import { APROVADOR_DO_CLIENTE } from "./dados-exemplo";

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

/**
 * O HISTORICO DE APROVACOES, no prototipo (item 17).
 *
 * **Ele existe para a peca nova sair em imagem**, e a peca nova sao DUAS
 * ausencias e nao um desenho novo: o editor do post nao tinha historico nenhum
 * e a arvore da campanha mostrava so a rodada interna da versao corrente. Sem
 * este stub as duas telas sairiam com a secao escondida -- `historico.length >
 * 0` -- e a rodada terminaria dizendo "Pronto" com a entrega fora de toda
 * imagem. E a licao da duplicata do Cronograma e do carrossel combinado.
 *
 * **CADA PECA RECEBE O HISTORICO QUE O ESTADO DELA PERMITE, e isso nao e
 * zelo.** O historico e desenhado ao lado do status da peca, na mesma tela: uma
 * rodada `pendente` num post `em_producao` seria a imagem afirmando que a peca
 * esta com o cliente e com a producao ao mesmo tempo -- dois fatos que se
 * contradizem a poucos centimetros de distancia, que e o bug que a conferencia
 * por imagem existe para pegar. Entao:
 *
 *   | peca   | o estado dela              | o historico que casa com ele      |
 *   | ------ | -------------------------- | --------------------------------- |
 *   | `p6`   | `em_aprovacao`, ja enviado | a de cliente PENDENTE + a interna |
 *   | `p1`   | `em_producao`, v2          | a de cliente com AJUSTES + a interna |
 *   | `d-kv` | `aprovado`, decidido       | a de cliente APROVADA + a interna |
 *
 * **E SAO AS TRES QUE O ITEM PRECISA**, uma por linha da tela: a pendente e a
 * unica que desenha os dois botoes da 0129 (trocar quem aprova e reenviar o
 * aviso) e a linha de quem esta esperando; a de ajustes e a unica que desenha o
 * `comentario` da decisao, que e o que explica por que a peca voltou; e a
 * aprovada e o desfecho verde do mapa da 0127. Com as tres iguais, a imagem
 * provaria que a secao aparece e nao que ela DISTINGUE -- a razao pela qual o
 * exemplo do calendario tem um evento de cada par da legenda.
 *
 * **A INTERNA ENTRA EM TODAS**, porque e ela a metade do item 17 que nenhuma
 * tela mostrava: o aval da gestao e uma decisao com autor, data e comentario, e
 * a arvore da campanha desenhava so a pilula da versao corrente.
 *
 * ***E O APROVADOR E UM SO, com a razao dita:*** `quemPodeAprovar` devolve uma
 * pessoa de proposito -- e o comentario de la explica por que: com duas, o
 * campo do envio do mes abriria VAZIO e a imagem `57f` deixaria de mostrar o
 * nome na linha. A consequencia e que a linha de DOIS nomes da 0129, e o
 * seletor com dois chips, nao aparecem em imagem nenhuma. Fica dito em vez de
 * escondido.
 */
const DIA = 86_400e3;

function rodadaInterna(id: string, numero: number, dias: number) {
  return {
    id: `${id}-i${numero}`,
    numero_rodada: numero,
    escopo: "interna" as const,
    status: "aprovada" as const,
    solicitado_em: new Date(HOJE.getTime() - DIA * (dias + 1)).toISOString(),
    solicitante: "Bruno Lima",
    decidido_em: new Date(HOJE.getTime() - DIA * dias).toISOString(),
    decisor: "Diego Martins",
    comentario: null,
    mensagem: null,
    // A INTERNA NAO TEM APROVADOR, e a ausencia e a regra: ela e decidida por
    // `is_gestor()` e mais ninguem (0029), entao nao ha a quem nomear. A tela
    // nem desenha a linha de "quem recebeu" nela.
    aprovadores: [],
  };
}

// QUEM RECEBEU, e e a MESMA pessoa que `quemPodeAprovar` oferece: escrita
// duas vezes, a imagem de `50f-social-post-aprovacoes` passou a mostrar o
// painel de envio oferecendo uma e a rodada esperando outra -- um estado que
// o banco recusa (`aprovador_pertence_a_conta()`, 0129). O id importa tanto
// quanto o nome: e por ele que o seletor da troca abre com o chip ja marcado.
const QUEM_APROVA = [
  { id: APROVADOR_DO_CLIENTE.id, nome: APROVADOR_DO_CLIENTE.nome },
];

export async function historicoDeAprovacoes(
  _tipo: Conteudo["tipo"],
  ids: string[],
): Promise<Map<string, RodadaDoHistorico[]>> {
  const mapa = new Map<string, RodadaDoHistorico[]>();

  for (const id of ids) {
    if (id === "p6") {
      // A PECA QUE ESTA COM O CLIENTE: a rodada de cliente PENDENTE, que e a
      // unica que desenha os dois botoes.
      mapa.set(id, [
        {
          id: "p6-c1",
          numero_rodada: 1,
          escopo: "cliente",
          status: "pendente",
          solicitado_em: new Date(HOJE.getTime() - DIA * 2).toISOString(),
          solicitante: "Marina Costa",
          decidido_em: null,
          decisor: null,
          comentario: null,
          mensagem: "Esse é o post da semana que vem. Qualquer coisa me chama.",
          aprovadores: QUEM_APROVA,
        },
        rodadaInterna(id, 1, 3),
      ]);
      continue;
    }

    if (id === "p1") {
      // A PECA QUE VOLTOU: o `comentario` da decisao e o que explica por que
      // ela esta em producao de novo -- e ele casa com a conversa do card 3,
      // que o stub de `comentariosDe` ja desenha nesta mesma tela.
      mapa.set(id, [
        {
          id: "p1-c1",
          numero_rodada: 1,
          escopo: "cliente",
          status: "ajustes_solicitados",
          solicitado_em: new Date(HOJE.getTime() - DIA * 6).toISOString(),
          solicitante: "Marina Costa",
          decidido_em: new Date(HOJE.getTime() - DIA * 4).toISOString(),
          decisor: APROVADOR_DO_CLIENTE.nome,
          comentario:
            "No terceiro quadro o preço ficou por cima da folha. Dá para subir?",
          mensagem: null,
          aprovadores: QUEM_APROVA,
        },
        rodadaInterna(id, 1, 8),
      ]);
      continue;
    }

    if (id === "d-enx-3") {
      // A PECA RECUSADA, e ela existe por causa de UMA linha: ate aqui nenhum
      // exemplo tinha rodada `rejeitada`, entao o quarto valor do enum (0032)
      // nao saia em imagem nenhuma -- e era justamente ele que o ternario de
      // tres ramos desenhava como "Pendente", na tela em que alguem vai
      // procurar por que a peca voltou. Com so os tres estados de cima, a
      // imagem provaria que o rotulo aparece e nao que ele DISTINGUE.
      //
      // E ela e `d-enx-3` porque e a peca cujo estado a permite: o cartao
      // dela ja diz "Rejeitado". Os tres fatos abaixo sao os MESMOS que ele
      // mostra -- quem decidiu, quando, e o motivo --, senao a tela afirmaria
      // duas coisas diferentes a poucos centimetros de distancia.
      mapa.set(id, [
        {
          id: "d-enx-3-c1",
          numero_rodada: 1,
          escopo: "cliente",
          status: "rejeitada",
          solicitado_em: new Date(HOJE.getTime() - DIA * 8).toISOString(),
          solicitante: "Marina Costa",
          decidido_em: new Date(HOJE.getTime() - DIA * 7).toISOString(),
          decisor: APROVADOR_DO_CLIENTE.nome,
          comentario:
            "O logo ficou pequeno demais no rodapé. Não dá para usar assim.",
          mensagem: null,
          aprovadores: QUEM_APROVA,
        },
        rodadaInterna(id, 1, 9),
      ]);
      continue;
    }

    if (id === "d-kv") {
      // A PECA APROVADA: o desfecho verde, com quem decidiu e quando -- os
      // mesmos `decididoPor` e `decididoEm` que o cartao dela ja mostra.
      mapa.set(id, [
        {
          id: "d-kv-c2",
          numero_rodada: 2,
          escopo: "cliente",
          status: "aprovada",
          solicitado_em: new Date(HOJE.getTime() - DIA * 20).toISOString(),
          solicitante: "Marina Costa",
          decidido_em: new Date(HOJE.getTime() - DIA * 19).toISOString(),
          decisor: APROVADOR_DO_CLIENTE.nome,
          comentario: null,
          mensagem: "A chave visual com os ajustes do rodapé.",
          aprovadores: QUEM_APROVA,
        },
        rodadaInterna(id, 2, 21),
      ]);
    }
  }

  return mapa;
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
