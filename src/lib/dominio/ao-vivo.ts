/**
 * O vocabulário da atualização ao vivo.
 *
 * **Módulo sem diretiva nenhuma, e é obrigatório que seja.** `lib/acoes/
 * ao-vivo.ts` tem `import "server-only"` — é ele que envia, com a chave de
 * serviço — e `components/shared/atualizacao-ao-vivo.tsx` é `"use client"`. Os
 * dois precisam do MESMO nome de canal, e é justamente o caso que a convenção
 * do projeto cobre: valor que os dois lados usam mora num módulo que não é de
 * nenhum deles.
 *
 * Com a constante no arquivo de servidor, o componente de cliente não compila;
 * com ela no de cliente, o servidor a chamaria como referência e estouraria
 * pedindo a página — e nem o `npm run build` pega esse segundo caso. É o mesmo
 * lugar de onde saiu `financeiro/vocabulario.ts`, e o `ehAba` que derrubou a
 * Gestão de Pessoas inteira.
 *
 * E se os dois lados discordassem do nome do canal, nada quebraria: o servidor
 * publicaria num canal que ninguém ouve, a tela ouviria um canal onde nada é
 * publicado, e o sintoma seria "a atualização ao vivo não funciona" sem
 * nenhum erro em lugar nenhum.
 */

/**
 * O canal da equipe.
 *
 * UM canal para o Painel inteiro, e não um por tela. A alternativa — `board`,
 * `fila`, `task:{id}` — daria avisos mais precisos e uma lista de nomes para
 * manter em dois lugares, que é onde a próxima tela esquece de se inscrever.
 * Como o aviso só diz "peça a tela de novo", um a mais custa uma renderização
 * e nunca mostra coisa errada.
 *
 * O Portal do Cliente não entra neste canal, e quem garante é a policy da
 * migration 0057 — nunca o fato de o nome ser difícil de adivinhar. Ele é uma
 * palavra, e viaja no bundle que o navegador baixa.
 */
export const CANAL_DA_EQUIPE = "equipe";

/** Só para o log dizer de onde veio o aviso. A tela não lê isto. */
export type MotivoDoAviso =
  | "task"
  | "etapa"
  | "comentario"
  | "aprovacao"
  | "post"
  | "campanha";
