import "server-only";

import { randomInt } from "node:crypto";

/**
 * A senha provisoria de quem acabou de ser cadastrado.
 *
 * **Uma POR PESSOA, sorteada — nunca uma "senha padrão" fixa.** Uma string
 * única para todo mundo seria uma chave-mestra: quem a soubesse entraria em
 * qualquer conta recém-criada até a pessoa fazer o primeiro acesso, e numa
 * conta que ninguém usasse ela valeria para sempre. Sorteada, ela só serve
 * para aquela conta e só até a primeira troca.
 *
 * `randomInt` do `node:crypto`, e não `Math.random()`: o segundo é previsível
 * a partir de algumas saídas, e o que está em jogo aqui é o acesso a uma conta.
 *
 * O formato é feito para ser DITADO por telefone ou colado num chat, porque é
 * isso que a pessoa da agência vai fazer com ele:
 *
 *   - três blocos separados por hífen, que dão onde respirar ao ler em voz alta;
 *   - sem `0/O`, `1/l/I` e `5/S`, que é onde ditado vira erro de digitação;
 *   - sem letra maiúscula junto de minúscula pela mesma razão;
 *   - e um bloco de dígitos, para passar em qualquer regra de "precisa ter
 *     número" que o Supabase venha a ter ligada.
 *
 * Ela não é guardada em lugar nenhum: o Auth grava o hash, e o texto aparece
 * uma única vez na tela de quem cadastrou. Perdeu, gera outra.
 */
const LETRAS = "abcdefghjkmnpqrtuvwxyz";
const DIGITOS = "234679";

function sortear(alfabeto: string, quantos: number): string {
  let saida = "";
  for (let i = 0; i < quantos; i += 1) {
    saida += alfabeto[randomInt(alfabeto.length)];
  }
  return saida;
}

export function gerarSenhaProvisoria(): string {
  return [sortear(LETRAS, 4), sortear(LETRAS, 4), sortear(DIGITOS, 4)].join("-");
}
