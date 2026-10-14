/**
 * A PONTE ENTRE O E-BOOK INTERATIVO E O FULL HUB (0102).
 *
 * O e-book é uma página autossuficiente: ela desenha os 23 capítulos, busca no
 * texto inteiro, filtra a matriz de responsabilidades e guarda o que já foi
 * lido. O que ela NÃO sabe fazer é lembrar disso de uma máquina para outra —
 * o estado dela mora no `localStorage`, que morre quando a pessoa troca de
 * computador, limpa o navegador ou abre pelo celular. E é invisível para a
 * gestão: um e-book obrigatório cuja leitura não se registra em lugar nenhum
 * é um e-book que ninguém acompanha.
 *
 * ---------------------------------------------------------------------------
 * **O IFRAME NÃO TEM `allow-same-origin`, E ISSO É O DESENHO INTEIRO.** Sem
 * ele a página roda em origem OPACA: não alcança a sessão do Full Hub, não lê
 * cookie, não escreve no `localStorage` do app. É o que permite hospedar
 * dentro do painel um arquivo HTML com script próprio sem lhe dar as chaves da
 * casa.
 *
 * O preço é que o `localStorage` dela também fica isolado — e é por isso que
 * esta ponte existe: quem carrega e salva o estado passa a ser o HOST, por
 * mensagem. A página degrada sozinha se nada responder, porque ela já trata
 * `localStorage` indisponível em `try/catch`.
 *
 * **E A IDENTIDADE VEM DO `source`, NUNCA DO `origin`.** Com o sandbox a
 * origem chega como a string `"null"` — comparar com ela aceitaria qualquer
 * outro quadro sandboxado da página. Quem compara é
 * `veioDoQuadro(event.source, iframe.contentWindow)`.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// O QUE A PÁGINA MANDA
// ---------------------------------------------------------------------------

export type MensagemDaPagina =
  | { tipo: "fullhub:pronto" }
  | { tipo: "fullhub:capitulo"; chave: string; lido: boolean }
  | { tipo: "fullhub:checklist"; chave: string; marcados: string[] }
  | { tipo: "fullhub:concluido" };

/** O que o host manda de volta, uma vez por carregamento. */
export type EstadoParaAPagina = {
  tipo: "fullhub:estado";
  lidos: string[];
  checks: Record<string, number>;
};

/**
 * SÓ OS QUATRO TIPOS PASSAM, e o resto é descartado sem log ruidoso.
 *
 * Esta função é a fronteira: tudo o que chega do iframe é dado de fora, e um
 * `switch` direto no `tipo` sem conferir a FORMA dos campos deixaria um
 * `{tipo:"fullhub:capitulo", chave:{}}` chegar ao banco. O `window` de uma
 * página é alcançável por qualquer extensão do navegador e por qualquer outro
 * quadro da aba.
 *
 * **O silêncio é decisão.** Um `console.warn` por mensagem desconhecida
 * encheria o console de quem tem uma extensão que conversa por `postMessage`
 * — e são muitas —, e aí o aviso que importa se perde no meio.
 */
export function lerMensagemDaPagina(dado: unknown): MensagemDaPagina | null {
  if (!dado || typeof dado !== "object") return null;
  const m = dado as Record<string, unknown>;

  switch (m.tipo) {
    case "fullhub:pronto":
    case "fullhub:concluido":
      return { tipo: m.tipo } as MensagemDaPagina;

    case "fullhub:capitulo":
      if (typeof m.chave !== "string" || !m.chave) return null;
      if (typeof m.lido !== "boolean") return null;
      return { tipo: "fullhub:capitulo", chave: m.chave, lido: m.lido };

    case "fullhub:checklist": {
      if (typeof m.chave !== "string" || !m.chave) return null;
      if (!Array.isArray(m.marcados)) return null;
      // Toda entrada precisa ser string: um array com um objeto dentro viraria
      // `[object Object]` dentro de um `text[]` do Postgres, e a marcação
      // voltaria errada na sessão seguinte em vez de não voltar.
      if (!m.marcados.every((x) => typeof x === "string")) return null;
      return { tipo: "fullhub:checklist", chave: m.chave, marcados: m.marcados };
    }

    default:
      return null;
  }
}

/**
 * A mensagem veio do quadro que esta tela desenhou?
 *
 * `MessageEvent.source` é a janela que postou. Com `allow-same-origin` fora, o
 * `origin` chega como `"null"` para TODO quadro sandboxado — então ele não
 * identifica nada, e o que identifica é a referência da janela.
 */
export function veioDoQuadro(fonte: unknown, quadro: Window | null): boolean {
  return Boolean(quadro) && fonte === quadro;
}

// ---------------------------------------------------------------------------
// A CONTA DO PROGRESSO
// ---------------------------------------------------------------------------

/**
 * Quantos capítulos a pessoa já leu, sobre o total.
 *
 * **O TOTAL É O DOS CAPÍTULOS CADASTRADOS, e não o que a página desenha.** São
 * o mesmo número quando tudo está em ordem, e divergem exatamente no caso que
 * importa: um capítulo renomeado no HTML deixa de casar com a chave do banco,
 * e a barra tem de mostrar a verdade do que foi REGISTRADO. Contar pela página
 * daria "23 de 23" com um capítulo que o Full Hub nunca viu.
 */
export function progressoDoEbook(
  lidos: string[],
  totalDeCapitulos: number,
): { lidos: number; total: number; percentual: number } {
  const quantos = Math.min(lidos.length, totalDeCapitulos);
  return {
    lidos: quantos,
    total: totalDeCapitulos,
    percentual: totalDeCapitulos > 0 ? Math.round((quantos / totalDeCapitulos) * 100) : 0,
  };
}

/**
 * A frase do aviso quando alguém confirma a leitura sem ter marcado tudo.
 *
 * Ela existe porque confirmar é possível a qualquer momento — e tem de ser:
 * quem já conhece o processo não vai clicar em vinte e três caixas para poder
 * dizer que está ciente. O que o produto faz é NOMEAR o que falta antes de
 * aceitar, que é a decisão da recusa que conta quantas etapas faltam em vez de
 * dizer "há etapa sem aprovação".
 */
export function avisoDeConfirmacaoIncompleta(lidos: number, total: number): string | null {
  if (lidos >= total) return null;
  return `Você marcou ${lidos} de ${total} capítulos. Confirmar mesmo assim?`;
}

/**
 * O e-book precisa de releitura?
 *
 * A mesma comparação do playbook: a versão confirmada é menor que a maior
 * versão que pede releitura. Quem nunca confirmou não está em releitura —
 * está em não iniciado, e o aviso dali seria sobre uma leitura que não houve.
 */
export function precisaReler(
  versaoConfirmada: number | null,
  versaoDeReleitura: number | null,
): boolean {
  if (versaoConfirmada === null || versaoDeReleitura === null) return false;
  return versaoConfirmada < versaoDeReleitura;
}

// ---------------------------------------------------------------------------
// O ARQUIVO
// ---------------------------------------------------------------------------

/**
 * O que o campo de upload aceita, por formato.
 *
 * O HTML interativo entra como `.html` e mais nada: um `.zip` com assets
 * soltos precisaria de alguém para descompactar e servir, e um `.htm` que o
 * navegador abre igual é a segunda extensão que ninguém lembra de conferir no
 * dia em que a lista crescer. O e-book da casa é um arquivo só, com o CSS e o
 * script embutidos — essa é a condição para ele poder morar num bucket.
 */
export const EXTENSOES_DO_FORMATO: Record<"pdf" | "html_interativo", string> = {
  pdf: "application/pdf,.pdf,.epub",
  html_interativo: "text/html,.html",
};

export const ROTULOS_DO_FORMATO: Record<"pdf" | "html_interativo", string> = {
  pdf: "PDF ou e-Pub",
  html_interativo: "Página interativa",
};

/** O formato que o nome do arquivo sugere. É sugestão, e a pessoa confirma. */
export function formatoPeloNome(nome: string): "pdf" | "html_interativo" {
  return /\.html?$/i.test(nome) ? "html_interativo" : "pdf";
}
