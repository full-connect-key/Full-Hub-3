import type { MaterialTipo } from "@/lib/supabase/database.types";

/**
 * O vocabulário da Full Academy, e as contas que os dois lados fazem.
 *
 * Em `lib/dominio/` porque servidor e navegador precisam das mesmas respostas:
 * a barra de progresso é calculada no servidor para a grade e de novo no
 * navegador quando alguém marca um material como concluído sem recarregar. Se
 * as duas contas saíssem de lugares diferentes, a barra pularia ao recarregar.
 *
 * O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: nota, pontuação, ranking. A Academy
 * organiza conteúdo; não avalia pessoas. O único número é quantos materiais
 * foram concluídos, e ele não é comparado com o de ninguém.
 */

export const TIPOS_DE_MATERIAL: MaterialTipo[] = [
  "video",
  "artigo",
  "pdf",
  "curso_externo",
  "template",
  "aula_interna",
];

export const ROTULOS_DE_MATERIAL: Record<MaterialTipo, string> = {
  video: "Vídeo",
  artigo: "Artigo",
  pdf: "PDF",
  curso_externo: "Curso externo",
  template: "Template",
  aula_interna: "Aula interna",
};

/**
 * COMO O MATERIAL ABRE, e não só que ícone ele tem.
 *
 * `embutido` — vídeo do YouTube ou Vimeo, que toca na própria tela.
 * `visualizador` — PDF do bucket privado, que abre no visualizador.
 * `fora`  — curso e artigo, que abrem em aba nova: são sites de terceiros, e
 *           prender num iframe quebra login, cookie e navegação de volta.
 */
export type ModoDeAbrir = "embutido" | "visualizador" | "fora";

export function modoDeAbrir(tipo: MaterialTipo, url: string | null): ModoDeAbrir {
  if (tipo === "pdf") return "visualizador";
  if (tipo === "video" && url && ehVideoEmbutivel(url)) return "embutido";
  if (tipo === "video" || tipo === "aula_interna") return "visualizador";
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

/**
 * A situação de uma trilha PARA UMA PESSOA.
 *
 * É derivada, nunca gravada: depende de quantos materiais a trilha tem hoje.
 * Uma coluna `situacao` mentiria no dia em que a gestão acrescentasse um
 * material — a trilha de quem já tinha terminado continuaria dizendo
 * "concluída" com um item novo por fazer.
 */
export type SituacaoDaTrilha = "nao_iniciada" | "em_andamento" | "concluida";

export function situacaoDaTrilha(concluidos: number, total: number): SituacaoDaTrilha {
  if (total > 0 && concluidos >= total) return "concluida";
  if (concluidos > 0) return "em_andamento";
  return "nao_iniciada";
}

export const ROTULOS_DE_SITUACAO: Record<SituacaoDaTrilha, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

/** Trilha vazia dá 0%, e não 100%. Dividir por zero daria `NaN`, que a barra
 *  renderizaria como largura inválida — e "100% de nada" também não é
 *  verdade. */
export function percentual(concluidos: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((concluidos / total) * 100);
}

/**
 * "3h 20min" a partir dos minutos somados dos materiais.
 *
 * Trilha sem duração em nenhum material devolve null, e a tela omite a linha
 * em vez de mostrar "0min": zero é uma afirmação sobre o tempo, e o que se
 * quer dizer é que ninguém informou.
 */
export function duracaoDaTrilha(minutos: (number | null)[]): number | null {
  const informados = minutos.filter((m): m is number => typeof m === "number" && m > 0);
  if (informados.length === 0) return null;
  return informados.reduce((total, m) => total + m, 0);
}

export const FILTROS_DE_TRILHA = [
  "todas",
  "obrigatorias",
  "em_andamento",
  "concluidas",
  "nao_iniciadas",
] as const;

export type FiltroDeTrilha = (typeof FILTROS_DE_TRILHA)[number];

export const ROTULOS_DE_FILTRO: Record<FiltroDeTrilha, string> = {
  todas: "Todas",
  obrigatorias: "Obrigatórias",
  em_andamento: "Em andamento",
  concluidas: "Concluídas",
  nao_iniciadas: "Não iniciadas",
};

export function lerFiltro(valor: string | string[] | undefined): FiltroDeTrilha {
  if (typeof valor === "string" && (FILTROS_DE_TRILHA as readonly string[]).includes(valor)) {
    return valor as FiltroDeTrilha;
  }
  return "todas";
}

export function combinaComFiltro(
  filtro: FiltroDeTrilha,
  obrigatoria: boolean,
  situacao: SituacaoDaTrilha,
): boolean {
  if (filtro === "todas") return true;
  if (filtro === "obrigatorias") return obrigatoria;
  if (filtro === "em_andamento") return situacao === "em_andamento";
  if (filtro === "concluidas") return situacao === "concluida";
  return situacao === "nao_iniciada";
}
