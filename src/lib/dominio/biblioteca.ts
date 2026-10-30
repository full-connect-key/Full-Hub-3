import { formatoDoArquivo } from "@/lib/dominio/arquivos";
import {
  ehFrenteDoCronograma,
  FRENTES_DO_CRONOGRAMA,
  type FrenteDoCronograma,
} from "@/lib/dominio/cronograma";

/**
 * A BIBLIOTECA — onde o cliente pega de volta o material pronto.
 *
 * ---------------------------------------------------------------------------
 * **O roteiro pede CINCO abas, e quatro delas não têm nada por trás.**
 * "Entregas finais", "Arquivos da marca", "Cronogramas", "Relatórios" e
 * "Histórico": das cinco, só a primeira existe no produto. As outras três
 * nomeadas pedem uma tabela, um bucket e uma tela do lado da agência para
 * alguém subir o arquivo — nada disso existe —, e "Histórico" não diz de quê.
 *
 * **Uma aba que nunca tem nada dentro é pior que uma aba a menos**, e é a
 * mesma decisão do "Site" no cronograma: a pessoa clica, não acha nada, e
 * passa a desconfiar das outras. Então a tela é UMA seção — e sem barra de
 * abas, que é a regra do produto para menos de duas.
 *
 * **O que falta é decisão de quem usa, não de quem escreve:** subir arquivo de
 * marca, cronograma em PDF e relatório é módulo novo na agência, com migration
 * própria. No dia em que existir, a aba entra aqui.
 *
 * ---------------------------------------------------------------------------
 * **A NAVEGAÇÃO POR VERTENTE é o que entrou no lugar** (item 29 do pedido, e a
 * migration 0119). Ela é a fileira de chips, gerada das vertentes CADASTRADAS
 * na conta — e não das que têm material: uma frente recém-criada aparece
 * vazia, que é a resposta, e um chip que só nasce quando há material esconde
 * justamente a frente que ninguém abasteceu.
 *
 * **E ela não é aba, pela mesma regra.** Uma aba troca de conteúdo; aqui o
 * conteúdo é o mesmo acervo recortado, e o chip "Todos os materiais" é a
 * primeira posição dela — a *"opção de visualizar todos"* que o pedido nomeia.
 * ---------------------------------------------------------------------------
 * **DOS CINCO FILTROS PEDIDOS, TRÊS SÃO DESENHADOS. O que fica de fora e por
 * quê:**
 *
 * | pedido | aqui | a razão |
 * | --- | --- | --- |
 * | vertente | chips | é o item |
 * | data | seletor de mês | `enviadoEm` existe em todo material |
 * | campanha | seletor de FRENTE | ver abaixo |
 * | status | **não** | a Biblioteca É o que foi aprovado |
 * | formato | **não** | vem com o upload (item 30) |
 *
 * **O STATUS seria um filtro de um valor só.** `arquivosDaBiblioteca` já
 * recorta em `aprovado`, porque é isso que a tela é: o que o cliente pode pegar
 * de volta. Um seletor com uma opção é o interruptor de luz das camadas do
 * Calendário Full.
 *
 * **A CAMPANHA é o `contexto`, e o seletor dela listaria três coisas
 * diferentes.** Aquele campo é a campanha na peça de campanha, as redes no
 * post e o título da demanda no material de demanda — uma lista com os três
 * misturados não é um recorte, é um despejo. Quem busca a campanha pelo nome
 * tem a busca, que já compara o contexto; quem quer o conjunto tem o seletor de
 * **frente**, que é a generalização honesta e já está escrita em cada cartão.
 *
 * **O FORMATO espera o item 30, e a ausência é medida.** Hoje o formato de um
 * material é a extensão do arquivo dele — e metade da grade não tem arquivo
 * nenhum: o post não tem por decisão escrita, e o material de demanda entregue
 * por link do Drive não tem extensão. Um seletor de "PDF / JPG / MP4" num
 * acervo em que a maioria cai fora de todas as opções é a aba "Site" do
 * cronograma outra vez. Com o upload declarando o tipo, o filtro passa a ter o
 * que filtrar.
 * ---------------------------------------------------------------------------
 */
export type ArquivoDaBiblioteca = {
  /** `tipo-conteudoId` — a MESMA chave que `vertenteDosMateriais()` devolve. */
  id: string;
  frente: FrenteDoCronograma;
  /**
   * A empresa do material.
   *
   * **Ela existe para decidir se a fileira de vertentes aparece.** Quem
   * responde por duas contas e não escolheu nenhuma no cabeçalho vê o acervo
   * das duas, e "Institucional" existe nas duas com ids diferentes: a fileira
   * listaria a mesma palavra duas vezes sem dizer de quem é qual. É a decisão
   * da grade do Feed, que é de uma rede só e nunca escolhida em silêncio.
   */
  clienteId: string;
  /**
   * A vertente, quando a demanda dele tem uma (migration 0119).
   *
   * **Nula quer dizer "sem vertente", e é um estado normal:** a reunião mensal
   * e o relatório da conta não pertencem a nenhuma frente, e a conta que não
   * cadastrou vertente nenhuma tem tudo assim. O chip "Sem vertente" só
   * aparece quando existe material nele.
   */
  vertenteId: string | null;
  titulo: string;
  /** A campanha, a demanda, as redes. */
  contexto: string | null;
  /** Quando a agência enviou. Não é a data da aprovação — ela não viaja. */
  enviadoEm: string | null;
  /** Já assinada, quando existe. */
  miniatura: string | null;
  /** Onde o material abre, quando ele tem tela própria. */
  caminho: string | null;
  /**
   * O ARQUIVO PARA BAIXAR, quando existe um.
   *
   * **O post não tem, e é decisão escrita do produto:** quem publica é a
   * agência, e o que o cliente leva é a peça no ar, não o arquivo. O que ele
   * ganha aqui é o link para a peça, onde a arte abre grande e o carrossel
   * inteiro está.
   */
  arquivo: { href: string; nome: string } | null;
};

/** O que a busca compara: título e contexto, sem acento e sem caixa. */
export function combinaComBusca(
  arquivo: ArquivoDaBiblioteca,
  termo: string,
): boolean {
  const limpo = semAcento(termo.trim());
  if (!limpo) return true;
  return semAcento(`${arquivo.titulo} ${arquivo.contexto ?? ""}`).includes(
    limpo,
  );
}

/**
 * Sem acento e em caixa baixa.
 *
 * **`normalize("NFD")` e não `toLowerCase()` sozinho**, pela razão que a busca
 * global já escreveu: digitar "midia" tem que achar "mídia", e quem procura o
 * material pela memória raramente lembra do acento. O `toLowerCase()` do
 * JavaScript dobra acento pelo Unicode em qualquer sistema — ao contrário do
 * `grep -i`, que depende do locale.
 */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** O chip de quem não tem vertente. Não é id de nada — ver `SEM_VERTENTE`. */
export const SEM_VERTENTE = "sem-vertente";

export type FiltrosDaBiblioteca = {
  busca: string;
  /** O id da vertente, `SEM_VERTENTE`, ou `null` para todos os materiais. */
  vertente: string | null;
  frente: FrenteDoCronograma | null;
  /** `YYYY-MM`, ou `null` para qualquer data. */
  mes: string | null;
  /**
   * O FORMATO DO ARQUIVO — "PDF", "JPG", "MP4" —, ou `null` para qualquer um.
   *
   * ------------------------------------------------------------------------
   * **ELE FICOU DE FORA DA 0119 COM A RAZÃO ESCRITA, e esta é a razão deixando
   * de valer.** Estava registrado que *"hoje o formato de um material é a
   * extensão do arquivo, e metade da grade não tem arquivo nenhum"* — o post
   * não tem download por decisão escrita, e o material entregue por link do
   * Drive não tem extensão. Um seletor de "PDF / JPG / MP4" num acervo em que
   * a maioria cai fora de todas as opções é a aba "Site" do cronograma outra
   * vez.
   *
   * **O que mudou foi o ACERVO e não a conta:** com o upload aceitando as nove
   * extensões nas três telas de entrega (item 30), o arquivo passou a ser a
   * regra e não a exceção. E o seletor continua mostrando **só os formatos que
   * o recorte TEM** — então no acervo que ainda não tem arquivo nenhum ele não
   * é desenhado, em vez de oferecer três opções vazias.
   *
   * **A pergunta é `formatoDoArquivo()`, do módulo das famílias**, e não uma
   * `split(".")` aqui: é a mesma função que decide o teto e o `accept` do
   * enviador, e duas respostas para "que formato é este arquivo" divergiriam
   * no dia em que alguém normalizasse `jpeg` num lado só.
   * ------------------------------------------------------------------------
   */
  formato: string | null;
};

/**
 * O recorte inteiro, num lugar só.
 *
 * **Os quatro juntos e não quatro `filter` em sequência**, pela razão do
 * contador: a tela conta o resultado DESTA função, e quatro passagens em
 * lugares diferentes seriam quatro lugares onde a contagem e a grade podem
 * discordar — o cartão de "11 entregues" com sete na lista embaixo.
 */
export function combinaComFiltros(
  arquivo: ArquivoDaBiblioteca,
  filtros: FiltrosDaBiblioteca,
): boolean {
  if (!combinaComBusca(arquivo, filtros.busca)) return false;

  if (filtros.vertente === SEM_VERTENTE) {
    if (arquivo.vertenteId !== null) return false;
  } else if (filtros.vertente && arquivo.vertenteId !== filtros.vertente) {
    return false;
  }

  if (filtros.frente && arquivo.frente !== filtros.frente) return false;

  // MATERIAL SEM DATA DE ENVIO SAI DE QUALQUER MÊS ESCOLHIDO, e é dito em vez
  // de escondido: não há de onde tirar o mês dele. Deixá-lo passar em todos
  // seria um recorte que deixa passar o que ele não sabe classificar — pior
  // que um recorte a menos, porque a pessoa confere a tela e não tem como
  // saber que aquela linha não foi filtrada.
  if (filtros.mes && mesDoArquivo(arquivo) !== filtros.mes) return false;

  // SEM ARQUIVO SAI DE QUALQUER FORMATO ESCOLHIDO, pela mesma razão do mês: o
  // post não tem download por decisão escrita, e um material sem arquivo não
  // tem formato que se possa afirmar. Deixá-lo passar em todos seria o recorte
  // que deixa passar o que não sabe classificar.
  if (filtros.formato && formatoDoMaterial(arquivo) !== filtros.formato) {
    return false;
  }

  return true;
}

/**
 * O FORMATO DO MATERIAL, ou `null` quando não há arquivo para responder.
 *
 * **A pergunta é o NOME do arquivo e não o caminho dele**, e a diferença
 * aparece na peça de campanha: o caminho no bucket é
 * `{cliente}/entregaveis/{id}-{carimbo}.pdf` — a extensão está lá —, mas o
 * nome que a pessoa vê é o que ela subiu. Os dois dariam `PDF` aqui; o nome é
 * o que continua certo no dia em que o caminho mudar de forma.
 */
export function formatoDoMaterial(
  arquivo: ArquivoDaBiblioteca,
): string | null {
  return arquivo.arquivo
    ? formatoDoArquivo(arquivo.arquivo.nome) ??
        formatoDoArquivo(arquivo.arquivo.href)
    : null;
}

/** `YYYY-MM` do envio, ou `null` quando ele não tem data. */
export function mesDoArquivo(arquivo: ArquivoDaBiblioteca): string | null {
  return arquivo.enviadoEm ? arquivo.enviadoEm.slice(0, 7) : null;
}

/**
 * AS OPÇÕES DE CADA CONTROLE, e quantos materiais cada uma leva.
 *
 * ---------------------------------------------------------------------------
 * **Cada dimensão se conta com as OUTRAS aplicadas, e nunca com ela mesma.**
 * Foi a imagem que mandou: com "setembro" escolhido, a fileira continuava
 * dizendo "E-commerce 2" sobre um acervo que mostrava um material — e clicar
 * naquele 2 esvaziava a grade, porque os dois de E-commerce são de outubro.
 * **Um número que o clique não cumpre é pior que número nenhum**, e é o
 * "filtro que só sabe esvaziar a tela" com outro nome.
 *
 * **E isso NÃO desfaz a regra das abas de Pedidos** — ela diz que escolher um
 * filtro não pode zerar os outros, e é por isso que cada dimensão é contada
 * com ela mesma de fora: escolher E-commerce não muda nenhum número da
 * fileira de vertentes, então o caminho de volta continua inteiro. O que ela
 * passa a respeitar é o mês e a frente, que são outra pergunta.
 *
 * **E o que está ESCOLHIDO nunca some da própria lista.** Escolhendo uma
 * vertente que o mês não tem, a opção do mês desapareceria da lista dele e o
 * seletor abriria em branco sobre um recorte ativo — a tela negando o que a
 * URL diz.
 * ---------------------------------------------------------------------------
 */
export function opcoesDaBiblioteca(
  arquivos: ArquivoDaBiblioteca[],
  filtros: FiltrosDaBiblioteca,
): {
  porVertente: Record<string, number>;
  frentes: FrenteDoCronograma[];
  meses: string[];
  formatos: string[];
} {
  const semA = (dimensao: keyof FiltrosDaBiblioteca) =>
    arquivos.filter((a) =>
      combinaComFiltros(a, { ...filtros, [dimensao]: null }),
    );

  const paraVertente = semA("vertente");
  const porVertente: Record<string, number> = {};
  for (const a of paraVertente) {
    const chave = a.vertenteId ?? SEM_VERTENTE;
    porVertente[chave] = (porVertente[chave] ?? 0) + 1;
  }

  const comFrente = new Set(semA("frente").map((a) => a.frente));
  if (filtros.frente) comFrente.add(filtros.frente);

  const comMes = new Set<string>();
  for (const a of semA("mes")) {
    const mes = mesDoArquivo(a);
    if (mes) comMes.add(mes);
  }
  if (filtros.mes) comMes.add(filtros.mes);

  const comFormato = new Set<string>();
  for (const a of semA("formato")) {
    const formato = formatoDoMaterial(a);
    if (formato) comFormato.add(formato);
  }
  if (filtros.formato) comFormato.add(filtros.formato);

  return {
    porVertente,
    frentes: FRENTES_DO_CRONOGRAMA.filter((f) => comFrente.has(f)),
    // Do mais novo para o mais antigo, e só os que TÊM material: um seletor
    // com onze meses vazios é a aba que nunca tem nada dentro.
    meses: [...comMes].sort().reverse(),
    // ALFABÉTICO, e só os que o recorte tem: num acervo sem arquivo nenhum a
    // lista sai vazia e o seletor não é desenhado — que é o que faz este
    // filtro poder existir sem a ressalva que o deixou de fora da 0119.
    formatos: [...comFormato].sort(),
  };
}

/**
 * A empresa do acervo, quando é UMA.
 *
 * `null` quando o acervo mistura duas contas — e aí a fileira de vertentes não
 * é desenhada, pela razão escrita em `ArquivoDaBiblioteca.clienteId`.
 */
export function empresaUnicaDoAcervo(
  arquivos: ArquivoDaBiblioteca[],
): string | null {
  const empresas = new Set(arquivos.map((a) => a.clienteId));
  return empresas.size === 1 ? [...empresas][0] : null;
}

/**
 * OS FILTROS A PARTIR DA URL, num lugar só.
 *
 * **As duas páginas chamam esta função**, e não cada uma lê os quatro
 * parâmetros por conta própria: são as duas entradas da MESMA tela — o portal
 * do cliente e a visualização administrativa —, e a que divergisse seria a da
 * equipe, que quase ninguém abre.
 *
 * **Valor torto vira nulo**, como `ehFaseDoMaterial` já faz com a fase e
 * `PLATAFORMAS` com a rede: um `?frente=site` de um link antigo abre a tela
 * inteira em vez de uma grade vazia explicando nada.
 */
export function lerFiltrosDaBiblioteca(params: {
  [chave: string]: string | string[] | undefined;
}): FiltrosDaBiblioteca {
  const texto = (chave: string): string | null => {
    const valor = params[chave];
    return typeof valor === "string" && valor.trim() ? valor : null;
  };

  const frente = texto("frente");
  const mes = texto("mes");

  const formato = texto("formato");

  return {
    busca: texto("busca") ?? "",
    vertente: texto("vertente"),
    // CAIXA ALTA, porque é a forma que `formatoDoArquivo()` devolve: um
    // `?formato=pdf` de um link escrito à mão casaria com nada, e a grade
    // sairia vazia sem a pessoa ter como explicar.
    formato: formato ? formato.toUpperCase() : null,
    frente: ehFrenteDoCronograma(frente) ? frente : null,
    // `YYYY-MM` e nada mais: sem a forma conferida, um `?mes=outubro` sai da
    // comparação como um mês que nenhum material tem — uma grade vazia que a
    // pessoa não tem como explicar.
    mes: mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : null,
  };
}
