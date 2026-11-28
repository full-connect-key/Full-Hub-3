/**
 * PARA ONDE UM AVISO DO SINO LEVA, para quem está olhando.
 *
 * ---------------------------------------------------------------------------
 * O link de cada aviso é gravado pelo BANCO, dentro da linha, por gatilho — e
 * ele não sabe quem vai ler. `subtasks_avisa_responsavel` e
 * `task_comentarios_avisa` escrevem `/painel/gestao-tasks/{id}`, que é a tela
 * da demanda e é `GESTAO`: o colaborador que ganhou uma etapa clicava no aviso
 * e levava 403. Era a queixa em quantas palavras — *"quando clico, não me leva
 * a lugar nenhum"*.
 *
 * **A TRADUÇÃO MORA AQUI E NÃO NO BANCO** porque ela depende de quem LÊ, e o
 * mesmo aviso é lido por perfis diferentes. Reescrever os gatilhos para
 * escolher o link por destinatário espalharia a pergunta de perfil por sete
 * funções; aqui ela é uma, e alcança também as linhas que já estão gravadas.
 *
 * Para quem não é gestão, a demanda abre no painel lateral de Minhas Tasks —
 * que é onde ela a vê inteira desde o Sprint 4.
 * ---------------------------------------------------------------------------
 */
const TASK = /^\/painel\/gestao-tasks\/([0-9a-f-]{36})/;

export function destinoDoAviso(
  link: string | null,
  souGestor: boolean,
): string | null {
  if (!link || souGestor) return link;

  const task = TASK.exec(link);
  if (task) return `/painel/minhas-tasks?task=${task[1]}`;

  // A lista de demandas e a fila de aval são da gestão: sem id para abrir, o
  // lugar de quem executa é a própria pauta.
  if (link.startsWith("/painel/gestao-tasks")) return "/painel/minhas-tasks";

  return link;
}
