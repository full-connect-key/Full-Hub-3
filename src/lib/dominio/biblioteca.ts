import type { FrenteDoCronograma } from "@/lib/dominio/cronograma";

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
 * ---------------------------------------------------------------------------
 */
export type ArquivoDaBiblioteca = {
  id: string;
  frente: FrenteDoCronograma;
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
