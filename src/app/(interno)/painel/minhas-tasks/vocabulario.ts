/**
 * AS DUAS SEÇÕES DE MINHAS TASKS (migration 0144, item 22), num módulo SEM
 * DIRETIVA NENHUMA.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"todos os colaboradores devem poder visualizar as
 * pautas de todos"*.
 *
 * **É UMA SEÇÃO E NÃO UMA QUARTA VISÃO, e a distinção é a que a
 * `BarraDeContexto` existe para fazer:** o seletor de visão troca o DESENHO do
 * mesmo conteúdo — as mesmas etapas em coluna, em linha ou em dia —, e a barra
 * navega entre ASSUNTOS, cada um com outra consulta e outro conteúdo. *O meu
 * dia* e *a semana da equipe* são dois assuntos, então "Da equipe" ao lado de
 * Board/Lista/Calendário leria como um quarto jeito de desenhar as minhas
 * etapas.
 *
 * **E NÃO É UMA ROTA PRÓPRIA**, que era a outra saída: um
 * `/painel/pauta-da-equipe` seria um item a mais na barra lateral — a direção
 * oposta à do sprint que tirou dois de lá.
 * ---------------------------------------------------------------------------
 *
 * **E ELE NÃO TEM DIRETIVA PELA RAZÃO QUE O `check:fronteira` MANDA COPIAR:**
 * `abas.tsx` é `"use client"`, e valor exportado de arquivo cliente não vale no
 * servidor — `lerSecao(...)` chamada de dentro da `page.tsx` estouraria com
 * *"Attempted to call lerSecao() from the server"*, que não aparece no build,
 * nem no lint, nem no `tsc`. É a mesma posição que derrubou a Gestão de
 * Pessoas.
 */

export type Secao = "minhas" | "equipe";

export function lerSecao(valor: string | undefined): Secao {
  return valor === "equipe" ? "equipe" : "minhas";
}
