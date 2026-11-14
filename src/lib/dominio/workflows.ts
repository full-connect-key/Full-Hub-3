import type { EtapaAplicada } from "@/lib/dados/workflows";

/**
 * O workflow, do lado do domínio.
 *
 * **Aqui mora a quantidade** (migration 0140): quantas peças iguais uma etapa
 * entrega, e o que acontece com ela na hora de aplicar. A conta é uma só e
 * mora neste arquivo porque quem a faz são DOIS lados — `lib/dados/workflows`
 * em produção e o stub do gerador de protótipo —, e duas cópias divergiriam na
 * primeira vez que alguém mexesse numa: é a decisão de `situacaoDoLancamento()`
 * no Financeiro e de `minutosMedidos()` no cronômetro.
 */

/**
 * O teto de peças de UMA etapa.
 *
 * `abrir_mes_de_social` recusa acima de 60 "porque o número é digitado, e um
 * zero a mais é erro de digitação", e aquele teto é de um mês de social. Aqui
 * 60 recusaria o caso que motivou o pedido — ele disse 80. 200 aceita os 80
 * com folga e continua pegando o zero a mais.
 *
 * **Não há teto para o total da demanda**, e a ausência é dita: três etapas de
 * 200 dão 600 subtarefas, e esse número é decisão de quem monta o mês. O teto
 * que vale é o do erro de digitação, e ele é por etapa.
 */
export const TETO_DE_PECAS = 200;

/** A etapa como o modelo a descreve, mais quantas peças ela entrega. */
export type EtapaComQuantidade = EtapaAplicada & { quantidade: number };

/**
 * Quantas peças uma etapa entrega, depois de quem aplica ter confirmado.
 *
 * A chave é a `ordem` da etapa no modelo, e não a posição na lista: é ela que
 * o editor grava e é ela que sobrevive a uma etapa acrescentada no meio — a
 * mesma razão pela qual `depende_de_ordem` é posição e não uuid.
 */
export type PecasPorEtapa = Record<number, number>;

/**
 * Uma etapa do modelo que entrega mais de uma peça, do jeito que a tela
 * precisa dela para PERGUNTAR o número antes de aplicar.
 *
 * Ela mora aqui e não ao lado do diálogo porque quem a produz é
 * `lib/dados/workflows.ts`, que é `server-only`, e quem a consome é um
 * componente de cliente: um tipo declarado num dos dois faria o outro
 * importar da camada errada — a fronteira que `check:fronteira` existe para
 * guardar.
 */
export type EtapaQueMultiplica = { ordem: number; nome: string; quantidade: number };

/**
 * Quantas peças esta etapa vai entregar de verdade: o que quem aplica
 * escolheu, ou o que o modelo sugere.
 *
 * **O modelo é a sugestão e não o contrato**, que é a decisão da 0122 palavra
 * por palavra — e aqui ela é o pedido inteiro: "em um mês podem ter 50
 * produtos e no outro 80". Editar o modelo a cada mês mudaria a cadeia para
 * toda conta que a usa, porque `regravarEtapas()` reescreve tudo a cada
 * salvamento.
 */
export function pecasDaEtapa(
  ordem: number,
  doModelo: number,
  escolhidas?: PecasPorEtapa | null,
): number {
  const escolhida = escolhidas?.[ordem];
  if (escolhida === undefined || !Number.isFinite(escolhida)) return doModelo;
  return Math.min(TETO_DE_PECAS, Math.max(1, Math.trunc(escolhida)));
}

/**
 * Expande as etapas que entregam mais de uma peça.
 *
 * Uma etapa com quantidade 1 passa como está — **quantidade 1 não vira
 * grupo**, que é a decisão da 0122: um grupo "Landing page" com um filho
 * "Landing page 1" é um nível de recuo que não diz nada e, pior, faz a etapa
 * virar agrupadora, cujo relógio não corre e cujo status é calculado por uma
 * filha só.
 *
 * Com 2 ou mais a etapa vira AGRUPADORA e as peças são as filhas, nomeadas
 * "Nome 1" … "Nome N". O nome é o que a pessoa escreveu, repetido com o número:
 * não há singular a derivar, que é a armadilha do "Carrossei 1" que
 * `SINGULAR_DO_TIPO` existe para evitar.
 *
 * ## O QUE A MÃE PERDE, e por que só isso
 *
 * `requer_aprovacao` e `tipo_aprovacao` **viajam para cada peça e saem da
 * mãe**, e isto não é estilo: `subtasks_agrupadora` (0022) RECUSA o `insert`
 * de uma filha sob uma etapa que pede aval. Sem esta linha, o workflow
 * materializaria a mãe e as filhas seriam recusadas uma por uma — com a
 * demanda já criada e as etapas antigas já apagadas.
 *
 * Responsável, prazo e prioridade ficam **nos dois**: é a 0022 letra por letra
 * — "o que estava gravado na mãe não é apagado, para de contar enquanto ela
 * tiver filha". A soma da Task conta só as folhas, então nada conta duas vezes.
 *
 * ## AS POSIÇÕES SÃO RENUMERADAS, e é a parte que não dá para pular
 *
 * `parent_de` e `depende_de` são POSIÇÕES nesta lista, não ids — nada foi
 * gravado ainda quando ela é montada. Inserir N filhas no meio empurra todo
 * mundo para baixo, então cada ponteiro é remapeado pela posição nova. Sem
 * isso, uma dependência passaria a apontar para a peça 12 de outra etapa.
 *
 * E a expansão **pode** ser local porque o banco garante que pode:
 * `conferir_etapas_do_workflow` (0140) recusa quantidade acima de 1 numa
 * sub-etapa, numa etapa que já tem sub-etapas, e numa etapa que entra em
 * dependência nos dois sentidos. O que chega aqui é sempre uma etapa de topo,
 * sem filha escrita à mão e fora de toda dependência.
 */
export function expandirQuantidades(etapas: EtapaComQuantidade[]): EtapaAplicada[] {
  const pecas = etapas.map((etapa) => (etapa.quantidade > 1 ? etapa.quantidade : 0));

  // A POSIÇÃO NOVA DE CADA ETAPA, antes de emitir qualquer linha: o ponteiro
  // de uma etapa pode apontar para outra que vem depois dela na lista — o pai
  // nunca, mas a dependência nem sempre —, então o mapa inteiro precisa estar
  // pronto antes do primeiro remapeamento.
  const novaPosicao = new Map<number, number>();
  let proxima = 1;
  etapas.forEach((_, indice) => {
    novaPosicao.set(indice + 1, proxima);
    proxima += 1 + pecas[indice];
  });

  const remapear = (posicao: number | null): number | null =>
    posicao === null ? null : (novaPosicao.get(posicao) ?? null);

  return etapas.flatMap((etapa, indice) => {
    const quantas = pecas[indice];
    const mae: EtapaAplicada = {
      ...etapa,
      parent_de: remapear(etapa.parent_de),
      depende_de: remapear(etapa.depende_de),
    };

    if (quantas === 0) return [mae];

    const minhaPosicao = novaPosicao.get(indice + 1) as number;
    return [
      {
        ...mae,
        // A APROVAÇÃO SAI DA MÃE porque ela viaja para as peças, e porque o
        // banco recusaria a filha de uma etapa que pede aval.
        requer_aprovacao: false,
        tipo_aprovacao: null,
      },
      ...Array.from({ length: quantas }, (_, i): EtapaAplicada => ({
        ...etapa,
        titulo: `${etapa.titulo} ${i + 1}`,
        parent_de: minhaPosicao,
        // A PEÇA NÃO HERDA A DEPENDÊNCIA, e não tem como herdar: a mãe não
        // entra em dependência nenhuma (0140 recusa no modelo), então aqui ela
        // já é nula. A linha fica escrita para quem vier depois não a
        // reintroduzir por simetria.
        depende_de: null,
      })),
    ];
  });
}

/**
 * As etapas que entregam mais de uma peça, para a tela perguntar o número
 * antes de aplicar.
 *
 * Ela existe porque a mesma pergunta é feita em dois lugares: aqui, para o
 * leitor montar o `multiplicam` de cada workflow, e dentro de
 * `expandirQuantidades()`, que é quem de fato multiplica. Um `> 1` escrito nos
 * dois é o lugar onde eles divergem no dia em que o piso mudar de lado.
 */
export function etapasQueMultiplicam<T extends { quantidade: number }>(
  etapas: T[],
): T[] {
  return etapas.filter((etapa) => etapa.quantidade > 1);
}

