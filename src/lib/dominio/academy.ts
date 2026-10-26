import type {
  AcademyAulaTipo,
  AcademyTipo,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário do Full Academy, e as contas que os dois lados fazem.
 *
 * Em `lib/dominio/` porque servidor e navegador precisam das mesmas respostas:
 * a barra de progresso é calculada no servidor para o acervo e de novo no
 * navegador quando alguém marca uma aula como vista sem recarregar. Se as duas
 * contas saíssem de lugares diferentes, a barra pularia ao recarregar.
 *
 * O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: nota, pontuação, prova, certificado,
 * ranking. A Academy organiza conteúdo; não avalia pessoas. O único número é
 * quanto já foi visto, e ele não é comparado com o de ninguém — a mesma regra
 * que o módulo tem desde a 0017, e que a 0096 não mudou.
 */

// ---------------------------------------------------------------------------
// OS TRÊS FORMATOS
// ---------------------------------------------------------------------------

export const TIPOS_DO_ACERVO: AcademyTipo[] = ["playbook", "ebook", "curso"];

export const ROTULOS_DE_TIPO: Record<AcademyTipo, string> = {
  playbook: "Playbook",
  ebook: "E-book",
  curso: "Curso",
};

/**
 * O que cada formato É, numa linha.
 *
 * Ela aparece no cartão do acervo e no cabeçalho do item, e existe porque os
 * três nomes não se explicam sozinhos para quem chega: "playbook" e "e-book"
 * são a mesma coisa para quem nunca usou o módulo, e a diferença entre eles
 * — um é consultado o tempo todo e versionado, o outro se lê de ponta a ponta
 * — é justamente o que decide qual a pessoa abre.
 */
export const EXPLICACAO_DO_TIPO: Record<AcademyTipo, string> = {
  playbook: "O jeito Full de fazer. Versionado, para consultar sempre.",
  ebook: "Material da agência, para ler de ponta a ponta.",
  curso: "Formação em módulos e aulas, com o seu andamento.",
};

/**
 * O bucket do arquivo do e-book.
 *
 * **EM `lib/dominio/` E NÃO EM `lib/dados/`**, e isso é mecânica e não gosto:
 * quem sobe o arquivo é a tela de montar, que é `"use client"` — o navegador
 * fala com o Storage direto, porque um PDF de quatro megabytes atravessando
 * uma Server Action seria o arquivo inteiro no corpo de uma requisição. E
 * `lib/dados/` é `server-only`: o valor morando lá não chega ao navegador, e
 * o `npm run build` reprova com um erro sobre `next/headers`. É a lição do
 * bucket das Solicitações, letra por letra.
 *
 * Ele é PRIVADO, como todos: o acervo de formação é documentação interna, e um
 * bucket público poria o playbook de processo da agência num endereço que
 * qualquer pessoa abre. Quem lê é a equipe, quem escreve é a gestão, e quem
 * entrega o endereço é uma URL assinada que vale uma hora.
 */
export const BUCKET_DO_ACERVO = "academy-arquivos";

/**
 * DE QUE SERVIÇO É O LINK, para a linha do cartão dizer alguma coisa.
 *
 * O cartão do anexo escreve `paginas` e `tamanho_bytes` embaixo do nome, e um
 * link não tem nenhum dos dois: ficaria *"Material de apoio"* em toda linha,
 * que é o rótulo da seção repetido. O que ele pode dizer é o que a pessoa vai
 * encontrar do outro lado — *"Google Slides"* —, e isso está no endereço.
 *
 * **É DERIVADO E NÃO COLUNA**, pela razão de `maoDoPost()` e de
 * `faseDoPedido()`: uma coluna `servico` precisaria ser reescrita por todo
 * caminho que mexe no endereço para continuar verdadeira, e o endereço é o
 * único lugar onde o fato mora.
 *
 * **E O FALLBACK É O HOSTNAME, nunca a palavra "Link".** `notion.so` informa
 * mais que "Link", e o produto não tem como manter uma lista de todo serviço
 * que a agência vai usar — a lista fechada aqui seria a mesma armadilha de
 * `formato` ter sido enum em `posts.formato`, que a 0032 recusou porque
 * *"esses nomes mudam a cada temporada de produto das plataformas"*. O que
 * entra por nome é só o que a casa usa todo dia, e o resto se identifica
 * sozinho.
 *
 * Endereço torto devolve `null`, e aí a linha volta a dizer o genérico: um
 * `catch` em volta do `URL` porque este valor vem do banco, e um link gravado
 * antes de a tela conferir a forma derrubaria a página inteira num cartão.
 */
const SERVICOS_POR_HOST: { teste: RegExp; nome: string }[] = [
  { teste: /^docs\.google\.com\/document/, nome: "Google Docs" },
  { teste: /^docs\.google\.com\/spreadsheets/, nome: "Google Sheets" },
  { teste: /^docs\.google\.com\/presentation/, nome: "Google Slides" },
  { teste: /^docs\.google\.com\/forms/, nome: "Google Forms" },
  { teste: /^drive\.google\.com/, nome: "Google Drive" },
  { teste: /^(www\.)?figma\.com/, nome: "Figma" },
  { teste: /^(www\.)?canva\.com/, nome: "Canva" },
];

export function servicoDoLink(url: string): string | null {
  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(endereco.protocol)) return null;

  const alvo = `${endereco.hostname}${endereco.pathname}`;
  const conhecido = SERVICOS_POR_HOST.find((s) => s.teste.test(alvo));
  if (conhecido) return conhecido.nome;

  return endereco.hostname.replace(/^www\./, "") || null;
}

/** Dá para gravar isto em `academy_arquivos.url` como link? */
export function ehEnderecoDeFora(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export const TIPOS_DE_AULA: AcademyAulaTipo[] = [
  "video",
  "texto",
  "pdf",
  "link",
  "exercicio",
];

export const ROTULOS_DE_AULA: Record<AcademyAulaTipo, string> = {
  video: "Vídeo",
  texto: "Texto",
  pdf: "PDF",
  link: "Link",
  exercicio: "Exercício",
};

// ---------------------------------------------------------------------------
// COMO A AULA ABRE
// ---------------------------------------------------------------------------

/**
 * COMO A AULA ABRE, e não só que ícone ela tem.
 *
 * `embutido`     — vídeo do YouTube ou Vimeo, que toca na própria tela.
 * `visualizador` — PDF do bucket privado, que abre no visualizador.
 * `aqui`         — texto e exercício, que moram no próprio sistema.
 * `fora`         — link, que abre em aba nova: é site de terceiro, e prender
 *                  num iframe quebra login, cookie e navegação de volta.
 */
export type ModoDeAbrir = "embutido" | "visualizador" | "aqui" | "fora";

export function modoDeAbrir(
  tipo: AcademyAulaTipo,
  url: string | null,
): ModoDeAbrir {
  if (tipo === "texto" || tipo === "exercicio") return "aqui";
  if (tipo === "pdf") return "visualizador";
  if (tipo === "video")
    return url && ehVideoEmbutivel(url) ? "embutido" : "fora";
  return "fora";
}

/** Só YouTube e Vimeo: são os dois que a agência usa, e os dois com endereço
 *  de incorporação estável. Qualquer outro abre fora, que sempre funciona. */
export function ehVideoEmbutivel(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
}

/**
 * O endereço de incorporação.
 *
 * Devolve `null` quando não reconhece — e quem chama trata isso abrindo fora.
 * Montar um endereço torto daria um quadro preto sem explicação, que é pior
 * que um link honesto.
 */
export function enderecoDeIncorporacao(url: string): string | null {
  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}

// ---------------------------------------------------------------------------
// O ESTADO DE UMA PESSOA NUM ITEM
// ---------------------------------------------------------------------------

/**
 * Os quatro estados, e eles são os MESMOS que `academy_estado_do_item()`
 * devolve no Postgres.
 *
 * As duas implementações existem de propósito, como `situacaoDoLancamento()`
 * no Financeiro: o banco decide o que contar no acompanhamento e na
 * obrigatoriedade, a tela decide o que desenhar — e ela precisa da resposta
 * sem uma ida ao banco por cartão do acervo.
 *
 * `releitura` É O ESTADO QUE JUSTIFICA O MÓDULO: ele diz que a pessoa leu uma
 * versão anterior e que a corrente exige ser lida de novo. Sem ele, "concluído"
 * de um playbook querería dizer "li alguma versão, em algum momento" — que é
 * exatamente a confiança sem a checagem.
 */
export const ESTADOS_DO_ITEM = [
  "nao_iniciado",
  "em_andamento",
  "releitura",
  "concluido",
] as const;

export type EstadoDoItem = (typeof ESTADOS_DO_ITEM)[number];

export const ROTULOS_DE_ESTADO: Record<EstadoDoItem, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  releitura: "Mudou — releia",
  concluido: "Concluído",
};

/**
 * O tom de cada estado, e `releitura` é o único em `--warning`.
 *
 * Nunca `--danger`: um processo que mudou não é um erro, é trabalho a fazer —
 * a mesma regra do alerta de 7 dias do portal e dos quatro sinais de carga do
 * Feedback. Vermelho numa tela que a pessoa abre uma vez por semana treina o
 * hábito de ignorar vermelho.
 */
export const TOM_DO_ESTADO: Record<
  EstadoDoItem,
  "neutro" | "acao" | "atencao" | "sucesso"
> = {
  nao_iniciado: "neutro",
  em_andamento: "acao",
  releitura: "atencao",
  concluido: "sucesso",
};

/** Valor vindo do banco como `text`, estreitado para o tipo da tela. Um valor
 *  que a tela não conhece cai em `nao_iniciado` em vez de quebrar a página: é
 *  um cartão sem selo, não um 500. */
export function ehEstadoDoItem(valor: string | null | undefined): EstadoDoItem {
  return (ESTADOS_DO_ITEM as readonly string[]).includes(valor ?? "")
    ? (valor as EstadoDoItem)
    : "nao_iniciado";
}

/**
 * O estado de um PLAYBOOK, do lado da tela.
 *
 * É a mesma conta de `academy_estado_do_item()` para o ramo do playbook, e a
 * comparação é com a versão que EXIGE RELEITURA, nunca com a corrente: uma
 * publicação leve — corrigir um telefone, trocar uma palavra — não pode cobrar
 * de novo quem já leu. Comparando com a corrente, toda vírgula trocada
 * devolveria a pendência a quatorze pessoas, e na terceira vez ninguém mais
 * leria o aviso.
 */
export function estadoDoPlaybook(
  versaoConfirmada: number | null,
  versaoDeReleitura: number | null,
): EstadoDoItem {
  if (versaoConfirmada === null) return "nao_iniciado";
  if (versaoDeReleitura !== null && versaoConfirmada < versaoDeReleitura) {
    return "releitura";
  }
  return "concluido";
}

/** O estado de um CURSO: zero aulas não nasce concluído. Zero de zero é "todas
 *  vistas" em qualquer conta ingênua, e um curso recém-aberto apareceria como
 *  feito — é o `count(*) = 0` da campanha que se finaliza sozinha (0051). */
export function estadoDoCurso(vistas: number, total: number): EstadoDoItem {
  if (total <= 0) return "nao_iniciado";
  if (vistas >= total) return "concluido";
  if (vistas > 0) return "em_andamento";
  return "nao_iniciado";
}

/** Item sem aula dá 0%, e não 100%. Dividir por zero daria `NaN`, que a barra
 *  renderizaria como largura inválida — e "100% de nada" também não é
 *  verdade. */
export function percentual(vistas: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((vistas / total) * 100);
}

/**
 * "3h 20min" a partir dos minutos somados das aulas.
 *
 * Item sem duração em aula nenhuma devolve null, e a tela omite a linha em vez
 * de mostrar "0min": zero é uma afirmação sobre o tempo, e o que se quer dizer
 * é que ninguém informou.
 */
export function duracaoSomada(minutos: (number | null)[]): number | null {
  const informados = minutos.filter(
    (m): m is number => typeof m === "number" && m > 0,
  );
  if (informados.length === 0) return null;
  return informados.reduce((total, m) => total + m, 0);
}

// ---------------------------------------------------------------------------
// O SLUG
// ---------------------------------------------------------------------------

/**
 * O endereço de um item, e é ele que sobrevive a uma troca de título.
 *
 * Mora aqui e não na tela porque **quem pergunta são dois**: a action que
 * grava o item e a busca global, que monta `/painel/academy/{slug}`. Duas
 * implementações divergiriam no acento, e o link da busca levaria a 404.
 */
export function slugDoTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// OS FILTROS DO ACERVO
// ---------------------------------------------------------------------------

export const FILTROS_DO_ACERVO = [
  "tudo",
  "para_voce",
  "em_andamento",
  "concluidos",
  "playbook",
  "ebook",
  "curso",
] as const;

export type FiltroDoAcervo = (typeof FILTROS_DO_ACERVO)[number];

export const ROTULOS_DE_FILTRO: Record<FiltroDoAcervo, string> = {
  tudo: "Tudo",
  para_voce: "Para você",
  em_andamento: "Em andamento",
  concluidos: "Concluídos",
  playbook: "Playbooks",
  ebook: "E-books",
  curso: "Cursos",
};

export function lerFiltro(
  valor: string | string[] | undefined,
): FiltroDoAcervo {
  if (
    typeof valor === "string" &&
    (FILTROS_DO_ACERVO as readonly string[]).includes(valor)
  ) {
    return valor as FiltroDoAcervo;
  }
  return "tudo";
}

/**
 * "PARA VOCÊ" É O OBRIGATÓRIO MAIS O QUE COBRA RELEITURA, e não uma sugestão.
 *
 * O sprint pedia um bloco de recomendação lendo o que a pessoa marcou como
 * "quero desenvolver" — e aquela tabela saiu do produto na 0043, por decisão
 * do usuário. Sem fonte, a escolha foi NÃO inventar uma: uma recomendação
 * fabricada gasta a credibilidade da seção inteira, e a resposta honesta para
 * "o que é meu agora" já existe e é a obrigatoriedade.
 */
export function combinaComFiltro(
  filtro: FiltroDoAcervo,
  tipo: AcademyTipo,
  estado: EstadoDoItem,
  obrigatorio: boolean,
): boolean {
  if (filtro === "tudo") return true;
  if (filtro === "para_voce") return obrigatorio || estado === "releitura";
  if (filtro === "em_andamento")
    return estado === "em_andamento" || estado === "releitura";
  if (filtro === "concluidos") return estado === "concluido";
  return tipo === filtro;
}

// ---------------------------------------------------------------------------
// A BUSCA
// ---------------------------------------------------------------------------

/** Duas letras no mínimo, e o número mora aqui porque quem pergunta são dois:
 *  a tela decide se consulta, e a consulta devolve vazio abaixo disso. */
export const MINIMO_PARA_BUSCAR = 2;

/** Sem acento e sem caixa, do mesmo jeito dos dois lados. É `sem_acento()` do
 *  Postgres escrito em JavaScript — e aqui ele dobra pelo Unicode, que é o que
 *  o `grep -i` do `check:cores` não fazia e custou um CI vermelho. */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O TRECHO ONDE O TERMO CASOU, que é o que separa esta busca da paleta.
 *
 * A paleta da topbar busca só o NOME, porque uma linha que casou no corpo não
 * tem onde mostrar o porquê — o título na tela não contém o que foi digitado.
 * Aqui tem: a linha carrega o trecho, com o termo no meio, e aí casar no corpo
 * de um playbook passa a ser a coisa mais útil que o módulo faz.
 *
 * Devolve `null` quando o termo não está no texto — a tela então mostra o
 * resumo, que é o que ela mostraria de qualquer forma.
 */
export function trechoDoCasamento(
  texto: string | null,
  termo: string,
  tamanho = 160,
): string | null {
  if (!texto || termo.length < MINIMO_PARA_BUSCAR) return null;
  const onde = semAcento(texto).indexOf(semAcento(termo));
  if (onde < 0) return null;

  const margem = Math.floor((tamanho - termo.length) / 2);
  const comeco = Math.max(0, onde - margem);
  const fim = Math.min(texto.length, onde + termo.length + margem);

  return (
    (comeco > 0 ? "…" : "") +
    texto.slice(comeco, fim).trim() +
    (fim < texto.length ? "…" : "")
  );
}
