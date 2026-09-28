/**
 * O vocabulário da busca global.
 *
 * Módulo **sem diretiva nenhuma**, que é o caso que a convenção cobre: o tipo
 * atravessa a fronteira (a action devolve, a paleta desenha) e os rótulos são
 * lidos pelos dois lados. Valor exportado de arquivo `"use client"` não vale no
 * servidor, e `lib/dados/` é `server-only` — então isto mora aqui.
 */

/**
 * As nove entidades que a busca alcança, e é a **mesma lista** do `union all`
 * de `busca_global()` na 0073. Duas cópias divergiriam do jeito mais silencioso
 * que existe: o banco devolveria um tipo que a tela não sabe agrupar, e a linha
 * sumiria da paleta sem erro nenhum — é por isso que existe a checagem no fim
 * deste arquivo.
 */
export const TIPOS_DA_BUSCA = [
  "demanda",
  "etapa",
  "cliente",
  "pessoa",
  "campanha",
  "post",
  "equipamento",
  "pedido",
  "trilha",
] as const;

export type TipoDaBusca = (typeof TIPOS_DA_BUSCA)[number];

export type ResultadoDaBusca = {
  tipo: TipoDaBusca;
  id: string;
  titulo: string;
  /** A linhagem: o cliente da demanda, `Cliente · Demanda` da etapa, o cargo. */
  contexto: string | null;
  caminho: string;
  /** "Rascunho", "Desligada", "Desativado" — só a exceção carrega um. */
  selo: string | null;
  /** Onde o termo casou no nome. 1 é começo, e é o que ordena o grupo. */
  posicao: number;
  /** Quantos casaram no tipo, ANTES do corte. É o que diz o que sobrou. */
  total: number;
};

export type GrupoDaBusca = {
  tipo: TipoDaBusca;
  rotulo: string;
  itens: ResultadoDaBusca[];
  /** Quantos ficaram fora do corte. Zero quando o grupo está inteiro. */
  sobraram: number;
};

/**
 * O rótulo de cada tipo, no PLURAL, porque ele é cabeçalho de grupo.
 *
 * **Nenhum deles é jargão interno**: o produto chama a Task de "demanda" e a
 * subtarefa de "etapa" desde o Sprint 10, e "material" é a palavra do lado do
 * cliente. Aqui é o Painel, então "Demandas" e "Etapas" é o que a equipe lê em
 * toda outra tela.
 */
export const ROTULOS_DA_BUSCA: Record<TipoDaBusca, string> = {
  demanda: "Demandas",
  etapa: "Etapas",
  cliente: "Clientes",
  pessoa: "Equipe",
  campanha: "Campanhas",
  post: "Social Media",
  equipamento: "Equipamentos",
  pedido: "Pedidos do cliente",
  trilha: "Full Academy",
};

/**
 * A ORDEM DOS GRUPOS NA PALETA, e ela não é alfabética.
 *
 * É a ordem do dia da agência, a mesma lógica dos nove blocos da Home: o
 * trabalho primeiro (demanda, etapa), depois quem (cliente, pessoa), depois os
 * módulos onde o trabalho vira peça, e a Academy no fim — ela é a única aqui
 * que ninguém abre com pressa.
 *
 * Ela mora num lugar só porque a paleta e o `sr-only` que anuncia a contagem
 * leem a mesma sequência; duas cópias divergiriam na primeira vez que alguém
 * mexesse numa, e o leitor de tela passaria a anunciar uma ordem que os olhos
 * não veem. É a lição de `STATUS_EM_ORDEM` e de `ICONE_DA_AREA`.
 */
export const ORDEM_DOS_GRUPOS: readonly TipoDaBusca[] = [
  "demanda",
  "etapa",
  "cliente",
  "pessoa",
  "campanha",
  "post",
  "equipamento",
  "pedido",
  "trilha",
] as const;

/**
 * Duas letras no mínimo, e o número mora aqui porque **quem pergunta são
 * dois**: a paleta decide se chama a action, e `busca_global()` devolve vazio
 * abaixo disso. Divergindo os dois, a tela chamaria o banco por tecla para
 * receber nada — ou pior, mostraria "nenhum resultado" para um termo que ela
 * nunca mandou.
 */
export const MINIMO_PARA_BUSCAR = 2;

/** Quantos por grupo. O `total` da consulta é o que diz quantos sobraram. */
export const POR_GRUPO = 6;

/**
 * Junta as linhas soltas nos grupos, na ordem de cima, descartando o grupo
 * vazio — como a lista da Gestão de Tasks e os grupos de status de Minhas
 * Tasks: quem buscou "Mundo" não precisa ler que não há equipamento com esse
 * nome.
 *
 * `sobraram` sai do `total` que a consulta trouxe, e não de contar o que veio:
 * contar aqui daria sempre zero, porque o corte aconteceu no banco. É a mesma
 * razão pela qual o `count` de lá é janela e roda antes do `limit`.
 */
export function agruparBusca(linhas: ResultadoDaBusca[]): GrupoDaBusca[] {
  const porTipo = new Map<TipoDaBusca, ResultadoDaBusca[]>();
  for (const linha of linhas) {
    const atual = porTipo.get(linha.tipo) ?? [];
    atual.push(linha);
    porTipo.set(linha.tipo, atual);
  }

  const grupos: GrupoDaBusca[] = [];
  for (const tipo of ORDEM_DOS_GRUPOS) {
    const itens = porTipo.get(tipo);
    if (!itens || itens.length === 0) continue;
    grupos.push({
      tipo,
      rotulo: ROTULOS_DA_BUSCA[tipo],
      itens,
      sobraram: Math.max(0, (itens[0]?.total ?? 0) - itens.length),
    });
  }
  return grupos;
}

/** Quantas linhas a paleta vai desenhar, para o anúncio acessível. */
export function totalNaPaleta(grupos: GrupoDaBusca[]): number {
  return grupos.reduce((soma, grupo) => soma + grupo.itens.length, 0);
}

/**
 * UMA CHECAGEM NO CARREGAMENTO DO MÓDULO, como a do seletor de status.
 *
 * Sem ela, um tipo novo no `union all` da 0073 — ou um renomeado — sumiria da
 * paleta **sem erro e sem aviso**: `agruparBusca` percorre `ORDEM_DOS_GRUPOS`,
 * então o que não está ali é descartado em silêncio. O sintoma seria uma busca
 * que não acha uma coisa que existe, que é indistinguível de ela não existir.
 */
for (const tipo of TIPOS_DA_BUSCA) {
  if (!ORDEM_DOS_GRUPOS.includes(tipo)) {
    throw new Error(
      `O tipo de busca "${tipo}" ficou fora de ORDEM_DOS_GRUPOS — ele não apareceria na paleta.`,
    );
  }
  if (!ROTULOS_DA_BUSCA[tipo]) {
    throw new Error(`O tipo de busca "${tipo}" ficou sem rótulo.`);
  }
}
