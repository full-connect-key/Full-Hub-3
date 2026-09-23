/**
 * Qual versão está no ar.
 *
 * O valor é **congelado no build** por `next.config.ts`, que lê o git da
 * máquina que construiu. Não é uma consulta em tempo de execução, e não
 * poderia ser: o que está servindo é uma pasta `.next` já compilada, e o
 * `git` do servidor pode estar apontando para outro commit se alguém puxou
 * código sem reconstruir. O que o rodapé precisa dizer é de qual commit
 * SAIU ESTE BUILD — não em que commit a pasta está hoje.
 *
 * Este arquivo não tem diretiva nenhuma de propósito: ele é lido no servidor
 * (o rodapé do painel) e o valor viaja para o navegador embutido no bundle.
 */

/** O commit de que este build saiu, curto. `"local"` quando não deu para ler. */
export const COMMIT = process.env.NEXT_PUBLIC_COMMIT || "local";

/** ISO do commit, ou string vazia. Serve para a data legível no `title`. */
export const COMMIT_EM = process.env.NEXT_PUBLIC_COMMIT_EM || "";

/**
 * O texto do rodapé.
 *
 * `"local"` aparece em desenvolvimento e em qualquer build feito fora de um
 * clone git. Mostrar isso é melhor que esconder: quem vê "local" sabe na hora
 * que não está olhando uma versão publicada.
 */
export function rotuloDaVersao(): string {
  return COMMIT === "local" ? "versão local" : COMMIT;
}

/**
 * A data por extenso, para o `title` do rodapé.
 *
 * Formatada com `Intl` e não com date-fns porque isto roda dos dois lados da
 * fronteira e date-fns/locale é peso que o bundle não precisa carregar para
 * uma linha só. O fuso é fixado em São Paulo: sem isso o servidor (UTC) e o
 * navegador escreveriam horas diferentes, e a hidratação acusaria.
 */
export function quandoFoiPublicado(): string | undefined {
  if (!COMMIT_EM) return undefined;
  const data = new Date(COMMIT_EM);
  if (Number.isNaN(data.getTime())) return undefined;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}
