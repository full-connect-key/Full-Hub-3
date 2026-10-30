/**
 * OS ARQUIVOS QUE O FULL HUB ACEITA, e quanto cada um pode pesar.
 *
 * ===========================================================================
 * **AS QUATRO FAMÍLIAS SÃO AS BARRAS DO PEDIDO**, e não um agrupamento meu.
 * A frase do usuário é *"PDF / PSD, AI / JPG, JPEG, PNG / MP4, MOV, WEBM"*, e
 * cada barra separa coisas que se comportam diferente: um PDF se lê, um PSD se
 * abre no Photoshop, um JPG se olha, um MP4 se assiste. **O que muda por
 * família é o TETO e a PRÉVIA** — e é por isso que a família é um conceito do
 * produto e não uma lista de extensões solta.
 *
 * **A PERGUNTA É A EXTENSÃO, NUNCA O `type` DO `File`.** É a decisão central
 * deste arquivo, e ela é medida e não estética:
 *
 * | o arquivo | o que o navegador diz |
 * | --- | --- |
 * | `.psd` | `image/vnd.adobe.photoshop` no Chrome, **`application/octet-stream`** em metade dos sistemas, string vazia no resto |
 * | `.ai`  | `application/postscript`, `application/pdf` (um `.ai` moderno **é** um PDF) ou vazio |
 * | `.mov` | `video/quicktime` — e `video/mp4` quando o arquivo veio de um iPhone |
 *
 * Perguntar o mime recusaria justamente os dois formatos que a agência mais
 * precisa — o arquivo aberto de criação —, e recusaria de um jeito que ninguém
 * depura: o mesmo `.psd` passa na máquina de quem escreveu e falha na de quem
 * usa. É a lição do `grep -i` que dobrava acento pelo locale: uma checagem cujo
 * trabalho é afirmar que um arquivo serve não pode depender do sistema de quem
 * está clicando.
 *
 * **O MIME AINDA IMPORTA, e ele mora no BANCO** — `storage.buckets.
 * allowed_mime_types`, migration 0120. São duas perguntas diferentes e não duas
 * cópias de uma lista: aqui a pergunta é *"este arquivo é de um tipo que a
 * agência entrega?"*, e lá é *"o Storage pode SERVIR este conteúdo?"*. A de lá
 * existe porque um `.html` servido pelo domínio do Storage, com URL assinada, é
 * script rodando num domínio que tem a sessão de quem abriu — e é a mesma razão
 * pela qual `EH_IMAGEM` exclui `svg` desde a 0053.
 *
 * **O TETO É CONFERIDO AQUI, ANTES DE UM BYTE SUBIR.** O Storage também recusa,
 * pelo `file_size_limit` do bucket, e recusar lá é recusar DEPOIS de a pessoa
 * esperar a barra de progresso atravessar um arquivo de 300 MB. As duas travas
 * ficam, como sempre nesta casa: esta escreve a frase, a do banco é a que vale.
 * ===========================================================================
 */

/**
 * O que separa uma família da outra é o teto e a prévia.
 *
 * ---------------------------------------------------------------------------
 * **SÃO QUATRO DO PEDIDO E UMA QUINTA, e a quinta nasceu de um comentário que
 * já estava no produto.** `arvore-de-producao.tsx` sobe arquivo de campanha
 * SEM `accept` desde o Sprint 13, e a razão está escrita ali: *"a entrega de
 * campanha é PDF, PSD, AI, ZIP, INDD — uma lista fechada erraria na primeira
 * extensão que a agência passasse a usar, e o erro seria o seletor recusando
 * um arquivo sem dizer por quê"*.
 *
 * **Aquele argumento continua inteiro**, e o item 30 não o desfaz: ele diz
 * *"aceitar PDF / PSD, AI / JPG, JPEG, PNG / MP4, MOV, WEBM"* — é um PISO e
 * não um teto. Ler "aceitar" como "aceitar só" recusaria o `.zip` de exemplos
 * que a agência entrega hoje, numa tela que ninguém pediu para apertar.
 *
 * Então `outro` é "um arquivo que a agência entrega e que não é nenhum dos
 * quatro": ele tem teto, não tem prévia, e **some do `accept`** — uma tela que
 * o aceita abre o seletor em "Todos os arquivos", que é o comportamento de
 * hoje. Quem NÃO o aceita é a arte do post, onde um `.zip` não é arte.
 * ---------------------------------------------------------------------------
 */
export type FamiliaDeArquivo =
  | "imagem"
  | "documento"
  | "criacao"
  | "video"
  | "outro";

export const FAMILIAS: readonly FamiliaDeArquivo[] = [
  "imagem",
  "documento",
  "criacao",
  "video",
  "outro",
] as const;

/**
 * As extensões de cada família, como o pedido as agrupou.
 *
 * `jpeg` e `jpg` são as duas formas do mesmo arquivo e as duas entram: o
 * `accept` do navegador casa por extensão literal, e quem exporta do Photoshop
 * recebe `.jpeg` com frequência.
 */
export const EXTENSOES_DA_FAMILIA: Record<
  FamiliaDeArquivo,
  readonly string[]
> = {
  imagem: ["jpg", "jpeg", "png"],
  documento: ["pdf"],
  criacao: ["psd", "ai"],
  video: ["mp4", "mov", "webm"],
  // VAZIO DE PROPÓSITO, e é o que faz `familiaDoArquivo` cair aqui por
  // exclusão: `outro` é o complemento dos quatro, não uma lista. Uma lista
  // aqui seria a enumeração que esta família existe para não precisar.
  outro: [],
};

/**
 * O TETO DE CADA FAMÍLIA, em bytes.
 *
 * ---------------------------------------------------------------------------
 * **OS NÚMEROS SÃO O QUE A AGÊNCIA ENTREGA, e cada um tem uma razão:**
 *
 * - **imagem, 15 MB** — é o teto que as referências da task já usavam desde o
 *   Sprint 3, e nenhuma arte de feed chega perto: um PNG de 1080×1350 a 24 bits
 *   tem 5,8 MB sem compressão nenhuma. Ele existe para pegar o TIFF de 400 MB
 *   que alguém renomeou, não para apertar o caso normal.
 * - **documento, 50 MB** — um PDF de impressão com imagem embutida em 300 dpi.
 * - **criação, 300 MB** — é o número que mais dói e é o mais honesto: um PSD de
 *   peça impressa com vinte camadas passa de 200 MB com facilidade, e um `.ai`
 *   com imagem embutida também. Um teto apertado aqui empurra a equipe de volta
 *   para o Drive, que é exactamente o que o item 30 existe para desfazer.
 * - **vídeo, 500 MB** — um Reels de 60 s em 1080p sai por volta de 60 MB, e um
 *   corte de 3 min em 4K passa de 400 MB.
 *
 * ***E O TETO DO BUCKET É O MAIOR DELES, não a soma e não cada um:***
 * `file_size_limit` é UM número por bucket, então o banco não sabe distinguir
 * um JPG de 100 MB (que esta tabela recusa) de um PSD de 100 MB (que ela
 * aceita). Quem separa as duas é esta tabela, e é por isso que ela não é
 * decoração da trava do banco: ela é a única que sabe a diferença.
 * ---------------------------------------------------------------------------
 */
export const TETO_DA_FAMILIA: Record<FamiliaDeArquivo, number> = {
  imagem: 15 * 1024 * 1024,
  documento: 50 * 1024 * 1024,
  criacao: 300 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  // O MESMO TETO DA CRIAÇÃO, porque é dela que `outro` é vizinho: o `.zip` de
  // exemplos e o `.indd` da revista são arquivo de trabalho, e o teto deles é
  // o do PSD. Dar-lhe o teto do vídeo abriria 500 MB para um tipo sobre o
  // qual o produto não sabe nada.
  outro: 300 * 1024 * 1024,
};

/** O maior teto de todas as famílias — é ele que o bucket carrega (0120). */
export const TETO_DO_BUCKET = Math.max(...Object.values(TETO_DA_FAMILIA));

const ROTULO: Record<FamiliaDeArquivo, string> = {
  imagem: "imagem",
  documento: "documento",
  criacao: "arquivo de criação",
  video: "vídeo",
  outro: "arquivo",
};

export function rotuloDaFamilia(familia: FamiliaDeArquivo): string {
  return ROTULO[familia];
}

/** A extensão, em minúscula e sem o ponto. Sem extensão, string vazia. */
export function extensaoDe(nome: string): string {
  const limpo = nome.split(/[?#]/)[0];
  const pedacos = limpo.split(".");
  if (pedacos.length < 2) return "";
  return (pedacos.pop() ?? "").toLowerCase();
}

/**
 * De que família é este arquivo? `null` quando de nenhuma.
 *
 * Recebe um NOME ou um CAMINHO: a Biblioteca pergunta sobre o caminho do
 * bucket (`cliente/entregaveis/abc-123.pdf`) e o enviador pergunta sobre o
 * `File.name`. A conta é a mesma, e dois leitores com duas funções seriam duas
 * verdades sobre o mesmo arquivo.
 */
export function familiaDoArquivo(
  nome: string | null | undefined,
): FamiliaDeArquivo | null {
  if (!nome) return null;
  const extensao = extensaoDe(nome);
  if (!extensao) return null;
  for (const familia of FAMILIAS) {
    if (EXTENSOES_DA_FAMILIA[familia].includes(extensao)) return familia;
  }
  // POR EXCLUSÃO, e é o que faz `outro` não precisar de lista. `null` aqui
  // ficou sendo só "sem extensão" — o único arquivo sobre o qual o produto
  // não tem o que dizer.
  return "outro";
}

/**
 * O FORMATO, para mostrar na tela: "PDF", "JPG", "MP4".
 *
 * É a extensão em caixa alta, e não um nome de produto ("Photoshop"): o que a
 * pessoa reconhece numa lista de arquivos é a extensão que ela mesma vê no
 * Finder. `jpeg` sai como `JPG` para as duas formas do mesmo arquivo não virarem
 * dois formatos num filtro.
 */
export function formatoDoArquivo(
  nome: string | null | undefined,
): string | null {
  const extensao = extensaoDe(nome ?? "");
  if (!extensao) return null;
  return (extensao === "jpeg" ? "jpg" : extensao).toUpperCase();
}

/**
 * O `accept=` do `<input type="file">`, para as famílias que a tela aceita.
 *
 * **SÃO AS EXTENSÕES E NÃO OS MIMES**, pela razão do cabeçalho: um
 * `accept="image/*"` esconde o `.psd` do seletor de arquivos em metade dos
 * sistemas, e o `.ai` em todos — o caminho fica o de "Todos os arquivos", que é
 * o mesmo que não ter `accept`.
 *
 * ***E ele é SUGESTÃO, nunca trava:*** todo seletor de arquivo do sistema
 * oferece "Todos os arquivos" ao lado, e arrastar um arquivo para a janela
 * ignora o atributo. Quem recusa é `conferirArquivo()` logo abaixo, e depois
 * dela o banco.
 */
export function atributoAccept(
  familias: readonly FamiliaDeArquivo[],
): string {
  // `outro` ZERA O ATRIBUTO, e é a razão de ele existir: com a lista dos nove
  // ali, o seletor do sistema ESCONDE o `.zip` que a tela aceita — e quem o
  // procura conclui que não pode subi-lo. Atributo vazio abre em "Todos os
  // arquivos", que é o comportamento de hoje nas duas telas que o aceitam.
  if (familias.includes("outro")) return "";
  return familias
    .flatMap((familia) => EXTENSOES_DA_FAMILIA[familia].map((e) => `.${e}`))
    .join(",");
}

/** "15 MB", "1,2 GB". */
export function pesoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(gb < 10 ? 1 : 0).replace(".", ",")} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1).replace(".", ",") : Math.round(mb)} MB`;
}

export type RecusaDeArquivo = { ok: false; motivo: string } | { ok: true };

/**
 * Este arquivo serve? E a frase quando não serve.
 *
 * ---------------------------------------------------------------------------
 * **A RECUSA DIZ O QUE FAZER, e é a decisão da 0023 aplicada a um upload.**
 * "Arquivo inválido" manda a pessoa tentar de novo com o mesmo arquivo; dizer
 * *"PSD não entra na arte do post — ele vai nos arquivos da entrega"* é a
 * diferença entre uma recusa e uma instrução.
 *
 * **E a de TAMANHO nomeia o teto DAQUELA família**, não um teto genérico: quem
 * tenta subir um JPG de 40 MB precisa saber que o limite da imagem é 15 e não
 * que "o limite é 500" — que é o do vídeo e não se aplica a ele.
 * ---------------------------------------------------------------------------
 */
export function conferirArquivo(
  arquivo: { name: string; size: number },
  familias: readonly FamiliaDeArquivo[],
): RecusaDeArquivo {
  const familia = familiaDoArquivo(arquivo.name);

  // SEM EXTENSÃO É O ÚNICO CASO SEM FAMÍLIA, depois de `outro` existir — e ele
  // é recusado em toda tela: é pela extensão que o produto sabe o que o
  // arquivo é, e um arquivo sem ela não tem teto, nem prévia, nem formato para
  // a Biblioteca filtrar.
  if (familia === null) {
    return {
      ok: false,
      motivo: `“${arquivo.name}” está sem extensão, e é por ela que o Full Hub sabe o que o arquivo é.`,
    };
  }

  if (!familias.includes(familia)) {
    const extensao = extensaoDe(arquivo.name);
    return {
      ok: false,
      motivo:
        familia === "outro"
          ? `Esta tela não aceita arquivo .${extensao}. Aqui entram ${listar(familias)}.`
          : `${rotuloDaFamilia(familia).replace(/^./, (c) => c.toUpperCase())} não entra aqui. Esta tela aceita ${listar(familias)}.`,
    };
  }

  if (arquivo.size > TETO_DA_FAMILIA[familia]) {
    return {
      ok: false,
      motivo: `“${arquivo.name}” tem ${pesoLegivel(arquivo.size)}, e o limite de ${rotuloDaFamilia(familia)} é ${pesoLegivel(TETO_DA_FAMILIA[familia])}.`,
    };
  }

  if (arquivo.size === 0) {
    return {
      ok: false,
      motivo: `“${arquivo.name}” está vazio — o arquivo não chegou inteiro do lugar de onde veio.`,
    };
  }

  return { ok: true };
}

/** "imagem, PDF ou vídeo" — a lista de famílias por extenso, para a frase. */
function listar(familias: readonly FamiliaDeArquivo[]): string {
  const nomes = familias.map((f) =>
    f === "documento"
      ? "PDF"
      : f === "criacao"
        ? "PSD e AI"
        : f === "imagem"
          ? "JPG e PNG"
          : f === "video"
            ? "MP4, MOV e WEBM"
            : "os arquivos de trabalho da entrega",
  );
  if (nomes.length <= 1) return nomes[0] ?? "nada";
  return `${nomes.slice(0, -1).join(", ")} ou ${nomes.at(-1)}`;
}

/**
 * UMA CHECAGEM NO CARREGAMENTO DO MÓDULO.
 *
 * Sem ela, uma família nova no tipo sem linha nas duas tabelas sairia do
 * `accept`, do teto e do `formatoDoArquivo()` **sem erro em lugar nenhum** — e
 * só apareceria no dia em que alguém tentasse subir um arquivo daquele tipo. É
 * a mesma checagem do seletor de status e de `STATUS_EM_ORDEM`.
 */
for (const familia of FAMILIAS) {
  // `outro` NÃO ENTRA NA PRIMEIRA PERGUNTA, e a exceção é a definição dela:
  // ela é o complemento dos quatro, então uma lista ali seria o contrário do
  // que ela faz.
  if (familia !== "outro" && !EXTENSOES_DA_FAMILIA[familia]?.length) {
    throw new Error(`[arquivos] a família ${familia} está sem extensão nenhuma`);
  }
  if (!TETO_DA_FAMILIA[familia]) {
    throw new Error(`[arquivos] a família ${familia} está sem teto`);
  }
}
