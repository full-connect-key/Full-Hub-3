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
 *
 * **E aqui moram os DIAS DA SEMANA** (migration 0152), que mudam duas coisas
 * sobre essas mesmas peças: a DATA de cada uma e o NOME dela. A quantidade
 * continua sendo quantas peças a etapa entrega — os dias só decidem em que
 * dias elas caem.
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

/**
 * Os sete dias da semana, uma vez.
 *
 * **O valor é o do Postgres e o do navegador ao mesmo tempo:** `date_part('dow')`
 * e `Date.prototype.getUTCDay()` contam os dois de domingo (0) a sábado (6).
 * Guardar outra convenção obrigaria um de-para em cada ponta, e o de-para é
 * onde as duas começam a divergir.
 *
 * **E ela é UMA porque são TRÊS leitores:** os chips do editor de workflow, o
 * rótulo do diálogo que confirma as peças, e o NOME de cada peça
 * (`nomeDoDisparo`). Três listas de "Seg, Ter, Qua" seriam três vocabulários,
 * e o que divergiria é o do nome — que é o que fica gravado na subtarefa.
 */
export const DIAS_DA_SEMANA = [
  { valor: 0, curto: "Dom", longo: "Domingo" },
  { valor: 1, curto: "Seg", longo: "Segunda" },
  { valor: 2, curto: "Ter", longo: "Terça" },
  { valor: 3, curto: "Qua", longo: "Quarta" },
  { valor: 4, curto: "Qui", longo: "Quinta" },
  { valor: 5, curto: "Sex", longo: "Sexta" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
] as const;

/** Os dias marcados, em ordem de semana e sem repetição. */
export function diasOrdenados(dias: readonly number[]): number[] {
  return [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
}

/** "Seg, Ter, Qui e Sex" — a lista por extenso, curta, para um rótulo. */
export function rotuloDosDias(dias: readonly number[]): string {
  const nomes = diasOrdenados(dias).map((d) => DIAS_DA_SEMANA[d].curto);
  if (nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * As datas em que as peças de uma etapa caem: a partir de `inicio`, o próximo
 * dia marcado, `quantos` vezes.
 *
 * **O laço anda dia a dia e não semana a semana**, e é o que faz o primeiro
 * disparo cair no primeiro dia marcado A PARTIR do início em vez de na
 * segunda-feira da semana dele: um mês que abre numa quarta começa na quarta,
 * que é o que a pessoa espera de "a partir do início da demanda".
 *
 * **O teto de passos é derivado e não um número mágico:** com pelo menos um dia
 * marcado, `quantos` peças cabem em `quantos` semanas, e `7 * quantos + 7`
 * cobre a semana parcial do começo. Ele existe porque um conjunto vazio de dias
 * faria o laço nunca chegar ao fim — e a lista vazia é o caso comum (toda etapa
 * que não é email marketing).
 *
 * A conta de data é a de `somarDias()`: meio-dia em UTC, para o horário de
 * verão e o fuso não empurrarem a data um dia para trás.
 */
export function diasDeDisparo(
  inicio: string,
  dias: readonly number[],
  quantos: number,
): string[] {
  const marcados = diasOrdenados(dias);
  if (marcados.length === 0 || quantos < 1) return [];

  const datas: string[] = [];
  const teto = 7 * quantos + 7;
  const d = new Date(`${inicio}T12:00:00Z`);

  for (let passo = 0; passo < teto && datas.length < quantos; passo += 1) {
    if (marcados.includes(d.getUTCDay())) datas.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return datas;
}

/**
 * O nome da peça que sai num dia: "Segunda, 01/12".
 *
 * É o pedido em quantas palavras — *"sempre que eu for abrir, as tasks já
 * tenham o nome como o dia que ela deve ser postada"*. O dia da semana é o que
 * a pessoa combina ("as segundas"), e a data é o que a tela precisa para a peça
 * de dezembro não ter o mesmo nome que a de janeiro.
 *
 * **O dia e o mês saem do `split` e não de `date-fns`**, que é a decisão de
 * `emDiaMes()` nas Solicitações: `parseISO` devolve a data à meia-noite LOCAL,
 * e num servidor em UTC o dia 1 de dezembro sai como 30 de novembro para quem
 * lê em São Paulo. O dia da SEMANA, esse precisa de aritmética, e ela é a de
 * meio-dia em UTC.
 */
export function nomeDoDisparo(data: string): string {
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay();
  return `${DIAS_DA_SEMANA[dia].longo}, ${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/**
 * A etapa como o modelo a descreve, mais quantas peças ela entrega e em que
 * dias da semana elas caem.
 *
 * `dias` vazio é o caso comum: a etapa entrega N peças numeradas, sem
 * calendário nenhum. Com dias marcados, as mesmas N peças ganham uma data cada
 * e o nome do dia.
 */
export type EtapaComQuantidade = EtapaAplicada & {
  quantidade: number;
  dias: number[];
};

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
export type EtapaQueMultiplica = {
  ordem: number;
  nome: string;
  quantidade: number;
  dias: number[];
};

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
 *
 * ## OS DIAS DA SEMANA TROCAM O NOME E A DATA DE CADA PEÇA (0152)
 *
 * Com dias marcados, a peça deixa de se chamar "Nome 1" e passa a se chamar
 * **pelo dia em que ela sai** — "Segunda, 01/12" —, com o `prazo` sendo aquele
 * dia. É o pedido letra por letra, e é por isso que ele não precisou de um
 * segundo campo: a quantidade continua sendo quantas peças, e os dias só
 * decidem onde elas caem.
 *
 * **A JANELA COMEÇA NO `prazo` DA ETAPA, ou no início da demanda.** O
 * `prazo_offset_dias` do modelo já quer dizer "esta frente começa N dias
 * depois que a demanda abre", então ele é a resposta natural para "a partir de
 * quando"; sem offset, a janela começa no primeiro dia da demanda. *O que isso
 * custa, e é dito em vez de escondido:* abrir no dia 25 a demanda do mês
 * seguinte, sem offset, põe o primeiro e-mail no dia 25 — quem quer o mês
 * inteiro datado para frente põe o offset ou a data de início da demanda no
 * mês que ela produz.
 *
 * **E a mãe NÃO recebe a data da última peça.** O prazo dela é o que o modelo
 * gravou, e a 0022 já diz o que acontece com ele: para de contar enquanto ela
 * tiver filha. Reescrevê-lo com o fim da série seria inventar um dado que
 * nenhuma tela lê e que o recálculo não refaz.
 */
export function expandirQuantidades(
  etapas: EtapaComQuantidade[],
  dataInicio: string,
): EtapaAplicada[] {
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
    const datas =
      etapa.dias.length > 0
        ? diasDeDisparo(etapa.prazo ?? dataInicio, etapa.dias, quantas)
        : [];

    return [
      {
        ...mae,
        // A APROVAÇÃO SAI DA MÃE porque ela viaja para as peças, e porque o
        // banco recusaria a filha de uma etapa que pede aval.
        requer_aprovacao: false,
        tipo_aprovacao: null,
      },
      ...Array.from({ length: quantas }, (_, i): EtapaAplicada => {
        // A DATA DESTA PEÇA, quando a etapa tem dias marcados. `datas` tem
        // exatamente `quantas` entradas quando há dia marcado, então o `??` só
        // alcança a etapa sem calendário — e ali o nome numerado é o certo.
        const data = datas[i] ?? null;
        return {
          ...etapa,
          titulo: data !== null ? nomeDoDisparo(data) : `${etapa.titulo} ${i + 1}`,
          prazo: data ?? etapa.prazo,
          parent_de: minhaPosicao,
          // A PEÇA NÃO HERDA A DEPENDÊNCIA, e não tem como herdar: a mãe não
          // entra em dependência nenhuma (0140 recusa no modelo), então aqui
          // ela já é nula. A linha fica escrita para quem vier depois não a
          // reintroduzir por simetria.
          depende_de: null,
        };
      }),
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

