import type {
  ContentStatus,
  PlataformaSocial,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário dos posts, nos dois lados da fronteira.
 *
 * Módulo sem diretiva: o servidor usa para filtrar e contar, o navegador usa
 * para desenhar. É a mesma regra de `lib/dominio/portal.ts` — função pura que
 * os dois lados precisam não mora em `lib/dados/`, que é `server-only`.
 */

export const PLATAFORMAS: PlataformaSocial[] = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "twitter",
  "pinterest",
];

export const ROTULO_DA_PLATAFORMA: Record<PlataformaSocial, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
  pinterest: "Pinterest",
};

/**
 * A rede aparece como SIGLA, e não como logo.
 *
 * O lucide-react tirou os ícones de marca da biblioteca, e as três saídas
 * restantes eram piores:
 *
 *   - um ícone genérico por rede (câmera, vídeo, maleta) não distingue
 *     Instagram de Facebook, que é justamente o que o selo precisa dizer;
 *   - desenhar os logos à mão traz marca registrada para dentro do
 *     repositório, e com ela a cor literal de cada uma — num projeto em que
 *     `globals.css` é o único arquivo com cor literal;
 *   - escrever o nome inteiro não cabe numa célula de calendário com sete
 *     colunas.
 *
 * Duas letras cabem, se leem de relance e não afirmam nada sobre marca
 * nenhuma. O nome por extenso viaja no rótulo acessível e no `title`.
 */
export const SIGLA_DA_PLATAFORMA: Record<PlataformaSocial, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "IN",
  tiktok: "TT",
  youtube: "YT",
  twitter: "X",
  pinterest: "PT",
};

/** Um post do jeito que o Portal lê. */
export type PostDoPortal = {
  id: string;
  clienteId: string;
  tema: string;
  legenda: string | null;
  dataPublicacao: string;
  horario: string | null;
  plataforma: PlataformaSocial;
  formato: string | null;
  status: ContentStatus;
  arteUrl: string | null;
  thumbnailUrl: string | null;
  versaoAtual: number;
  prazoAprovacao: string | null;
  /** A rodada de cliente aberta agora. Null quando não há decisão pendente. */
  rodadaPendenteId: string | null;
  /** Quem decidiu a última rodada fechada, e quando. */
  decididoPor: string | null;
  decididoEm: string | null;
};

export type FiltrosDePost = {
  plataforma: PlataformaSocial | null;
  status: ContentStatus | null;
};

export function combinaComFiltroDePost(
  post: PostDoPortal,
  filtros: FiltrosDePost,
): boolean {
  if (filtros.plataforma && post.plataforma !== filtros.plataforma)
    return false;
  if (filtros.status && post.status !== filtros.status) return false;
  return true;
}

/**
 * Os posts de um mês, indexados pelo dia.
 *
 * A chave é a data em ISO, e não um `Date`: a grade é montada no servidor e
 * lida no navegador, e dois fusos com o mesmo `Date` respondem dias
 * diferentes. Em texto, "2026-10-15" é "2026-10-15" em qualquer lugar.
 */
export function porDia(posts: PostDoPortal[]): Map<string, PostDoPortal[]> {
  const mapa = new Map<string, PostDoPortal[]>();

  for (const post of posts) {
    const dia = post.dataPublicacao;
    const lista = mapa.get(dia);
    if (lista) lista.push(post);
    else mapa.set(dia, [post]);
  }

  // Dentro do dia, a ordem é a do horário — é a ordem em que eles vão ao ar.
  // Post sem horário fica por último: ele ainda não tem hora marcada, e pôr
  // um "sem horário" antes de um das 8h diria uma coisa que não é verdade.
  for (const lista of mapa.values()) {
    lista.sort((a, b) =>
      (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99"),
    );
  }

  return mapa;
}

/**
 * O post está esperando uma decisão DESTE cliente?
 *
 * Duas condições, e as duas importam: o status diz que ele está em aprovação,
 * e existe uma rodada aberta para decidir. Sem a segunda, o botão apareceria
 * num post cuja rodada alguém já fechou por outro caminho, e o clique cairia
 * na recusa "esta rodada já foi decidida".
 */
export function esperaDecisao(post: PostDoPortal): boolean {
  return post.status === "em_aprovacao" && post.rodadaPendenteId !== null;
}

/** O mês de uma data ISO, em `AAAA-MM`. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * O mês vizinho, contado em texto.
 *
 * Sem `Date` de propósito: `new Date("2026-01-31")` mais um mês em JavaScript
 * devolve 2 ou 3 de março conforme o ano, e o seletor precisa só do rótulo do
 * mês. Aritmética de 12 em 12 não tem esse problema.
 */
export function deslocarMes(mes: string, meses: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + meses;
  const anoNovo = Math.floor(total / 12);
  const mesNovo = (total % 12) + 1;
  return `${String(anoNovo).padStart(4, "0")}-${String(mesNovo).padStart(2, "0")}`;
}

/**
 * Os dias da grade do mês, de segunda a domingo.
 *
 * Segunda a domingo como no resto da casa (`lib/dominio/semanas.ts`): o locale
 * pt-BR começa no domingo, que é a convenção do calendário de parede, e aqui
 * a unidade é a semana de trabalho da agência.
 *
 * Devolve datas ISO, incluindo as do mês vizinho que completam a primeira e a
 * última semana — a grade precisa delas para não quebrar a coluna.
 */
export function gradeDoMes(mes: string): string[] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const ultimo = new Date(Date.UTC(ano, m, 0));

  // getUTCDay(): 0 = domingo. Com a semana comecando na segunda, o domingo
  // fica a 6 dias do inicio, e nao a zero.
  const recuo = (primeiro.getUTCDay() + 6) % 7;
  const avanco = (7 - ((ultimo.getUTCDay() + 6) % 7) - 1) % 7;

  const dias: string[] = [];
  const cursor = new Date(primeiro);
  cursor.setUTCDate(cursor.getUTCDate() - recuo);

  const fim = new Date(ultimo);
  fim.setUTCDate(fim.getUTCDate() + avanco);

  while (cursor <= fim) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/* ===========================================================================
 * A CORRENTE DE MÃO EM MÃO (migration 0042)
 *
 * A gestão abre o briefing, libera para quem produz, revisa e envia. Este
 * bloco é o que os dois lados leem para saber em que mão o post está e qual é
 * o próximo passo — como `lib/tasks/state-machine.ts` faz com a subtarefa.
 *
 * **O BANCO É QUEM RECUSA, e isto aqui é quem escreve a frase.** As duas
 * existem de propósito, e é a mesma dupla do resto do produto: `validar_nova_
 * rodada` diz não a quem chamar a API direto; estas funções fazem o botão
 * aparecer desligado com a razão escrita, em vez de sumir.
 * ======================================================================== */

import type { PostMidia } from "@/lib/supabase/database.types";

export const MIDIAS: PostMidia[] = ["imagem", "carrossel", "video"];

export const ROTULO_DA_MIDIA: Record<PostMidia, string> = {
  imagem: "Imagem única",
  carrossel: "Carrossel",
  video: "Vídeo",
};

/**
 * O que cada mídia muda na tela.
 *
 * Fica ao lado da escolha, e não num texto de ajuda: a mídia decide qual
 * editor aparece, e quem escolhe errado só descobre depois de subir o arquivo.
 */
export const EXPLICACAO_DA_MIDIA: Record<PostMidia, string> = {
  imagem: "Uma arte só.",
  carrossel: "Várias artes em ordem — a primeira é a capa.",
  video: "Por link do Drive ou do YouTube; o cliente assiste fora do portal.",
};

/**
 * Os formatos sugeridos por rede.
 *
 * **É sugestão e não trava**, e a diferença importa: `formato` é texto
 * justamente porque nome comercial de plataforma muda a cada temporada (a
 * 0032 decidiu assim, e o Reels e o Shorts são dessa safra). Uma lista fechada
 * aqui obrigaria um deploy no dia em que a Meta inventar o próximo nome — o
 * campo aceita o que a pessoa digitar.
 */
export const FORMATOS_SUGERIDOS: Record<string, string[]> = {
  instagram: ["Feed", "Stories", "Reels", "Carrossel"],
  facebook: ["Feed", "Stories", "Reels"],
  linkedin: ["Feed", "Artigo", "Documento"],
  tiktok: ["Vídeo", "Stories"],
  youtube: ["Vídeo", "Shorts"],
  twitter: ["Post", "Thread"],
  pinterest: ["Pin", "Idea Pin"],
};

/** Em que mão o post está. */
export type MaoDoPost =
  | "briefing"
  | "producao"
  | "revisao"
  | "com_cliente"
  | "encerrado";

export const ROTULO_DA_MAO: Record<MaoDoPost, string> = {
  briefing: "Briefing",
  producao: "Produção",
  revisao: "Revisão",
  com_cliente: "Cliente",
  encerrado: "Encerrado",
};

export type EstadoDoPost = {
  responsavelId: string | null;
  enviadoEm: string | null;
  status: string;
  midia: PostMidia;
  videoUrl: string | null;
  arteUrl: string | null;
  /** Há rodada interna aprovada nesta versão? */
  avalInterno: boolean;
};

/**
 * Onde o post está na corrente.
 *
 * **Derivado, nunca gravado** — é a mesma razão pela qual bloqueio de
 * subtarefa não é status e atraso do Financeiro não é coluna: a mão depende do
 * responsável, do carimbo de envio e da rodada, e uma coluna precisaria ser
 * reescrita por três caminhos diferentes para continuar verdadeira.
 */
export function maoDoPost(post: EstadoDoPost): MaoDoPost {
  if (post.status === "aprovado" || post.status === "rejeitado") return "encerrado";
  if (post.enviadoEm) return "com_cliente";
  if (post.avalInterno) return "revisao";
  if (post.responsavelId) return "producao";
  return "briefing";
}

/**
 * O que falta para o post poder ir ao cliente.
 *
 * Devolve a lista vazia quando dá. **A tela mostra a frase no lugar de esconder
 * o botão:** um botão que some ensina que não existe; um botão desligado que
 * diz por quê ensina a regra — e a regra aqui é de banco, não de tela.
 */
export function faltaParaEnviar(post: EstadoDoPost): string[] {
  const faltam: string[] = [];

  if (post.midia === "video") {
    if (!post.videoUrl?.trim()) faltam.push("o link do vídeo");
  } else if (!post.arteUrl) {
    faltam.push("a arte");
  }

  if (!post.avalInterno) faltam.push("o aval interno");
  if (post.enviadoEm) faltam.push("nada — ele já está com o cliente");

  return faltam;
}

/**
 * Quem está lendo pode enviar este post ao cliente?
 *
 * **As duas perguntas juntas**, porque separá-las foi o furo que a 0042
 * fechou: é preciso ser gestão E não ter sido quem produziu. `validar_nova_
 * rodada` recusa as duas no banco; aqui a resposta serve para desligar o botão
 * com a frase certa.
 */
export function podeEnviarAoCliente(
  post: EstadoDoPost,
  quemLe: { id: string; ehGestor: boolean },
): { pode: boolean; porque: string | null } {
  if (!quemLe.ehGestor) {
    return { pode: false, porque: "Enviar ao cliente é do desenvolvedor ou do sócio." };
  }
  if (post.responsavelId === quemLe.id) {
    return { pode: false, porque: "Ninguém envia ao cliente a própria entrega." };
  }
  const faltam = faltaParaEnviar(post);
  if (faltam.length > 0) return { pode: false, porque: `Falta ${faltam.join(" e ")}.` };
  return { pode: true, porque: null };
}

/** Quem edita a arte e a legenda: a gestão, ou quem recebeu o post. */
export function podeProduzir(
  post: EstadoDoPost,
  quemLe: { id: string; ehGestor: boolean },
): boolean {
  return quemLe.ehGestor || post.responsavelId === quemLe.id;
}
