/**
 * O ACERVO DE MARCA — as pastas que a agência monta no portal de cada conta.
 *
 * ---------------------------------------------------------------------------
 * **Decisão do usuário, em duas frases:** *"a biblioteca do cliente, deve
 * permitir acessar logo, banners, e tudo mais que ele precisar, como um
 * [portal de marca] sabe?"* e *"quero que desenvolvedores e sócios, possam
 * mexer e criar pastas novas no portal do cliente / dentro da biblioteca / e
 * outras abas que sejam necessárias"*.
 *
 * **ISTO É A AUSÊNCIA QUE A BIBLIOTECA JÁ TINHA ESCRITA.**
 * `lib/dominio/biblioteca.ts` registra, desde a 0119, que a tela tem uma seção
 * e nenhuma aba porque *"das cinco abas do roteiro, quatro não têm tabela,
 * bucket nem tela de upload por trás"* — e fecha dizendo de quem era a
 * decisão: *"o que falta é decisão de quem usa, não de quem escreve"*. Ela foi
 * tomada, e a migration 0139 é ela.
 *
 * ---------------------------------------------------------------------------
 * **AS "OUTRAS ABAS" SÃO PASTAS, e é isso que faz um mecanismo cobrir três.**
 * A leitura literal de *"outras abas que sejam necessárias"* seria uma aba por
 * assunto — Arquivos da marca, Cronogramas, Relatórios —, cada uma com tabela,
 * bucket e tela de upload próprios. As três são a MESMA coisa: uma pasta que a
 * agência monta e o cliente baixa. Com pasta, a quarta nasce de um clique de
 * quem usa o produto e não de uma migration.
 *
 * E a regra da Biblioteca fica inteira — *uma aba que nunca tem nada dentro é
 * pior que uma aba a menos*: uma pasta vazia é a agência não ter montado
 * ainda, que é diferente de uma aba que o produto não sabe encher.
 * ---------------------------------------------------------------------------
 */

/**
 * Uma pasta, como ela vem do banco: PLANA, com o pai no campo.
 *
 * **A árvore é montada por `emArvore()` e não gravada**, que é a forma de
 * `lib/dominio/tasks.ts`: duas respostas para "quem é filha de quem"
 * divergiriam, e a que divergiria é a guardada.
 */
export type PastaDaMarca = {
  id: string;
  pastaPaiId: string | null;
  nome: string;
  ordem: number;
  arquivos: ArquivoDaMarca[];
};

export type ArquivoDaMarca = {
  id: string;
  nome: string;
  descricao: string | null;
  /** Nulo no link: um documento do Drive não tem tamanho a afirmar. */
  tamanho: number | null;
  /**
   * O que está GRAVADO — caminho no bucket ou endereço `https://`. É por ele
   * que `ehLinkDeFora()` decide se o botão diz "Baixar" ou "Abrir".
   */
  url: string;
  /**
   * O endereço final: a URL assinada quando é do bucket, a própria quando é
   * link. **Nulo quando a assinatura falhou** — e aí o cartão diz isso, em vez
   * de um botão que não leva a lugar nenhum.
   */
  href: string | null;
  criadoEm: string;
};

/** Uma pasta de topo com as filhas dela dentro. */
export type PastaComFilhas = PastaDaMarca & { filhas: PastaDaMarca[] };

/**
 * É LINK DE FORA, ou caminho no bucket?
 *
 * **A pergunta é a string e não uma coluna**, que é a regra desta casa: o que
 * dá para calcular não se guarda. É a MESMA forma de `assinarArquivos()`, que
 * deixa passar o que começa com `http` desde que nasceu — *"nem toda arte mora
 * no bucket; algumas são link de Drive ou de Figma"*.
 *
 * **E não é um enum como o `formato` da 0115**, e a diferença decide: lá o
 * valor escolhe QUAL TELA o item vira (o e-book interativo abre dentro do
 * painel, com progresso por capítulo); aqui ele decide só o rótulo de um
 * botão.
 */
export function ehLinkDeFora(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * AS PASTAS DE TOPO, cada uma com as filhas dela.
 *
 * **Dois níveis e nunca três** — `client_folders_dois_niveis` recusa o neto no
 * banco, então não há o que achatar aqui: uma filha nunca tem filha.
 *
 * **A ordem é `ordem` e depois o nome**, e não só a `ordem`: duas pastas com a
 * mesma ordem (o padrão é zero, e é o que uma inserção à mão deixa) sairiam em
 * ordem imprevisível a cada leitura — a lista se reorganizando sem ninguém ter
 * mexido nela.
 */
export function emArvore(pastas: PastaDaMarca[]): PastaComFilhas[] {
  const porOrdem = (a: PastaDaMarca, b: PastaDaMarca) =>
    a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");

  const filhasDe = new Map<string, PastaDaMarca[]>();
  for (const pasta of pastas) {
    if (!pasta.pastaPaiId) continue;
    const lista = filhasDe.get(pasta.pastaPaiId) ?? [];
    lista.push(pasta);
    filhasDe.set(pasta.pastaPaiId, lista);
  }

  return pastas
    .filter((p) => !p.pastaPaiId)
    .sort(porOrdem)
    .map((p) => ({
      ...p,
      filhas: (filhasDe.get(p.id) ?? []).sort(porOrdem),
    }));
}

/**
 * QUANTOS ARQUIVOS SAEM COM ESTA PASTA, ela e as filhas.
 *
 * **Ela existe para o diálogo de apagar CONTAR em vez de perguntar "tem
 * certeza?"**, que é a decisão do diálogo de apagar campanha: *"'Apagar esta
 * campanha?' não informa nada; a contagem é a única coisa que faz alguém
 * parar"*. O `cascade` de `pasta_pai_id` e de `folder_id` leva as duas coisas,
 * e é esse número que diz o tamanho do estrago.
 */
export function arquivosQueSaemCom(pasta: PastaComFilhas): number {
  return (
    pasta.arquivos.length +
    pasta.filhas.reduce((soma, f) => soma + f.arquivos.length, 0)
  );
}

/** Quantos arquivos o acervo inteiro tem — a contagem do cabeçalho da seção. */
export function totalDoAcervo(pastas: PastaDaMarca[]): number {
  return pastas.reduce((soma, p) => soma + p.arquivos.length, 0);
}

/**
 * AS DUAS SEÇÕES DA BIBLIOTECA, e a barra existe porque agora são duas.
 *
 * **A regra do produto é "menos de duas seções não vira barra"**, e era ela
 * que mantinha esta tela sem barra nenhuma. Com o acervo de marca, ela passa a
 * ter duas — e a barra nasce cumprindo a regra em vez de a contrariando.
 *
 * **"Materiais" é a primeira e o padrão**, porque é o que o cliente abre toda
 * semana: a peça que ele aprovou. O acervo de marca é o que ele busca de vez
 * em quando — o logo para o fornecedor, o banner para o evento.
 */
export const SECOES_DA_BIBLIOTECA = ["materiais", "marca"] as const;
export type SecaoDaBiblioteca = (typeof SECOES_DA_BIBLIOTECA)[number];

export const ROTULO_DA_SECAO: Record<SecaoDaBiblioteca, string> = {
  materiais: "Materiais aprovados",
  marca: "Arquivos da marca",
};

/**
 * A seção a partir da URL. **Valor torto vira a padrão**, como
 * `ehFrenteDoCronograma` e `lerFiltrosDaBiblioteca` já fazem: um
 * `?secao=arquivos` de um link antigo abre a tela em vez de uma grade vazia
 * explicando nada.
 */
export function lerSecaoDaBiblioteca(valor: unknown): SecaoDaBiblioteca {
  return typeof valor === "string" &&
    (SECOES_DA_BIBLIOTECA as readonly string[]).includes(valor)
    ? (valor as SecaoDaBiblioteca)
    : "materiais";
}

/**
 * A FRASE EMBAIXO DO TÍTULO, por seção e por lado.
 *
 * ---------------------------------------------------------------------------
 * **Ela TROCA com a seção, e foi a imagem que mostrou por quê:** o subtítulo
 * dizia *"tudo o que você já aprovou"* em cima dos **Arquivos da marca**, que
 * é justamente o acervo que o cliente **não** aprovou — a agência o monta, e
 * nenhuma decisão dele passa por ali. Uma frase fixa descreve a outra metade
 * da tela.
 *
 * **E SÃO DOIS MAPAS NUM, por lado**, que é a decisão de `SeloDaSolicitacao`:
 * a mesma seção quer dizer coisas diferentes de cada lado da porta — *"você
 * aprovou"* para quem decide, *"o cliente aprovou"* para quem produz —, e um
 * mapa só obrigaria a escolher entre falar com um e falar com o outro.
 * ---------------------------------------------------------------------------
 */
export function subtituloDaBiblioteca(
  secao: SecaoDaBiblioteca,
  comoEquipe: boolean,
): string {
  if (secao === "marca") {
    return comoEquipe
      ? "O logo, os banners e o que mais a conta precisar ter à mão."
      : "O logo, os banners e o que mais você precisar ter à mão.";
  }
  return comoEquipe
    ? "Tudo o que o cliente já aprovou, guardado para baixar depois."
    : "Tudo o que você já aprovou, guardado para baixar depois.";
}
