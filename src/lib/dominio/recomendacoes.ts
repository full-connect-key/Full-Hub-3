import type { RecCategoria } from "@/lib/supabase/database.types";

/**
 * O vocabulário do feed de Recomendações.
 *
 * É o módulo mais leve do sistema, e o desenho respeita isso: categoria,
 * título e link bastam para postar. Tudo o mais é opcional.
 */

export const CATEGORIAS: RecCategoria[] = [
  "filme",
  "serie",
  "livro",
  "curso",
  "ferramenta",
  "podcast",
  "referencia",
  "outro",
];

export const ROTULOS_DE_CATEGORIA: Record<RecCategoria, string> = {
  filme: "Filme",
  serie: "Série",
  livro: "Livro",
  curso: "Curso",
  ferramenta: "Ferramenta",
  podcast: "Podcast",
  referencia: "Referência",
  outro: "Outro",
};

/**
 * A cor do selo de categoria.
 *
 * PAR NOMEADO, nunca `bg-x/10`: opacidade sobre um fundo qualquer dá uma cor
 * que ninguém mediu, e no tema escuro dá outra. São oito categorias e cinco
 * pares — categorias próximas compartilham par de propósito, porque oito
 * cores distintas num feed viram confete e nenhuma delas significa nada.
 */
export const COR_DA_CATEGORIA: Record<RecCategoria, string> = {
  filme: "bg-ferias-soft text-ferias",
  serie: "bg-ferias-soft text-ferias",
  livro: "bg-info/10 text-info",
  curso: "bg-info/10 text-info",
  ferramenta: "bg-success-soft text-success",
  podcast: "bg-warning-soft text-warning",
  referencia: "bg-neutral-soft text-neutral",
  outro: "bg-neutral-soft text-neutral",
};

export const ORDENS = ["recentes", "curtidas"] as const;
export type OrdemDoFeed = (typeof ORDENS)[number];

export const ROTULOS_DE_ORDEM: Record<OrdemDoFeed, string> = {
  recentes: "Recentes",
  curtidas: "Mais curtidas",
};

export function lerOrdem(valor: string | string[] | undefined): OrdemDoFeed {
  return valor === "curtidas" ? "curtidas" : "recentes";
}

export function lerCategoria(valor: string | string[] | undefined): RecCategoria | null {
  if (typeof valor === "string" && (CATEGORIAS as string[]).includes(valor)) {
    return valor as RecCategoria;
  }
  return null;
}

/**
 * Normaliza a tag do mesmo jeito que o trigger do banco.
 *
 * As DUAS existem de propósito, como a máquina de estados da subtarefa: esta
 * escreve o que a pessoa vê enquanto digita, o trigger é o que vale para quem
 * chamar a API direto. Sem a daqui, o chip apareceria "Figma" e a nuvem
 * mostraria "figma" — a mesma tag parecendo duas.
 */
export function normalizarTag(bruta: string): string {
  return bruta.trim().toLowerCase();
}

export function lerTags(texto: string): string[] {
  const vistas = new Set<string>();
  for (const parte of texto.split(",")) {
    const tag = normalizarTag(parte);
    if (tag) vistas.add(tag);
  }
  return [...vistas];
}

/**
 * "há 2 horas".
 *
 * Escrito à mão em vez de `formatDistanceToNow`: o date-fns diz "cerca de 2
 * horas" e "menos de um minuto", e num feed isso ocupa espaço para dizer
 * menos. Acima de uma semana o relativo perde o sentido — a data seca informa
 * mais —, e por isso a função devolve null e a tela mostra a data.
 *
 * O AGORA VEM DE FORA, sempre. Se a função lesse o relógio, o servidor
 * renderizaria "há 2 horas" e o navegador, num fuso diferente, recalcularia
 * outra coisa na hidratação.
 */
export function tempoRelativo(iso: string, agoraISO: string): string | null {
  const minutos = Math.floor(
    (new Date(agoraISO).getTime() - new Date(iso).getTime()) / 60000,
  );

  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} ${horas === 1 ? "hora" : "horas"}`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;

  return null;
}

/**
 * A nuvem de tags, ordenada por uso.
 *
 * Corta em `limite` porque uma nuvem que mostra tudo deixa de ser nuvem: o
 * ponto dela é dizer o que a equipe anda indicando, e vinte chips do mesmo
 * tamanho não dizem isso.
 */
export function nuvemDeTags(
  posts: { tags: string[] | null }[],
  limite = 12,
): { tag: string; quantas: number }[] {
  const conta = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags ?? []) {
      conta.set(tag, (conta.get(tag) ?? 0) + 1);
    }
  }
  return [...conta.entries()]
    .map(([tag, quantas]) => ({ tag, quantas }))
    .sort((a, b) => b.quantas - a.quantas || a.tag.localeCompare(b.tag))
    .slice(0, limite);
}

/** O domínio do link, para o cartão dizer de onde é sem mostrar a URL
 *  inteira. Endereço inválido devolve null em vez de estourar: o campo é
 *  livre, e um feed não pode quebrar por causa de um link torto. */
export function dominioDoLink(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
