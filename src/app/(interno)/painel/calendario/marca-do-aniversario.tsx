"use client";

import { Cake } from "lucide-react";

import {
  ROTULO_DO_ANIVERSARIO,
  ehAniversario,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";

/**
 * A marca que diz que o chip é um ANIVERSÁRIO, e não um evento.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"quero que mostre no calendário que é aniversário da
 * pessoa, não só o nome dela… pode ter um ícone só talvez, ou o texto, não
 * sei, vê como fica melhor"*.
 *
 * **O chip dizia só "Ana Lima"**, em rosa, e a palavra vivia no `title` — que
 * não existe para quem usa toque e que ninguém lê de relance. Na grade de um
 * mês cheio, um nome de pessoa num chip colorido não se distingue de um nome
 * de evento: "Ana Lima" e "Visita do fornecedor" são as duas um texto numa
 * pílula.
 *
 * **É O ÍCONE E NÃO A PALAVRA, e as duas razões são de medida.** A célula do
 * mês tem cerca de 96px nas sete colunas, e sobram uns 76px de texto depois do
 * respiro — "Aniversário" a 11px já ocupa uns 62px, então ela só cabe numa
 * SEGUNDA LINHA. E a segunda linha do chip é onde mora a empresa: um
 * aniversário não tem nenhuma, e é justamente por isso que ele é hoje o único
 * chip de uma linha só. Pondo a palavra ali, todo aniversário passa a ocupar
 * duas — e em janeiro, com três no mesmo dia, a célula enche para dizer três
 * vezes a mesma palavra. O ícone custa 16px na linha que já existe.
 *
 * **É a decisão do selo de "programado" no calendário do Social**, palavra por
 * palavra: *"a célula de um dia com três posts não tem onze pixels para a
 * palavra"* — lá o nome inteiro ficou no `title` e num `sr-only`, e aqui é o
 * mesmo.
 *
 * **E UM ÍCONE É FORMA, que é o que a cor não tem como ser.** A regra escrita
 * desta casa é *a cor nunca é o único sinal*, e até aqui quem a cumpria era o
 * `title` — ou seja, ninguém, para quem olha a grade sem passar o mouse. O
 * bolo sobrevive ao tema e ao daltonismo, que é a razão pela qual o rosa ficou
 * fora do grupo de daltonismo do `check:cores`: o chip carrega o nome, e agora
 * carrega a forma.
 *
 * **A LEGENDA NÃO GANHA O BOLO**, e a ausência é decisão. Ela responde *o que
 * esta cor quer dizer*, e as seis entradas respondem isso do mesmo jeito — um
 * ponto na classe do chip de verdade. A linha de lá já escreve a palavra
 * "Aniversário"; o ícone existe para o CHIP, que não a escreve. Pôr o bolo na
 * amostra seria a mesma coisa dita duas vezes na mesma linha, e deixaria uma
 * das seis amostras com outra forma que as cinco.
 * ---------------------------------------------------------------------------
 *
 * **ELA É UM COMPONENTE E NÃO UM `if` NAS DUAS VISÕES.** São duas telas que
 * desenham o mesmo chip — o mês e a semana —, e o que não pode divergir são
 * três coisas de uma vez: qual ícone quer dizer aniversário, de que tamanho, e
 * se existe o `sr-only` ao lado dele. É `ICONE_DA_AREA` em miniatura, que
 * tinha três cópias e duas já divergidas.
 *
 * **E ELA DEVOLVE `null` PARA O EVENTO**, em vez de a tela perguntar antes: a
 * pergunta é `ehAniversario()`, que mora no domínio ao lado de `abreDetalhe()`,
 * e assim a linha do título das duas visões é a mesma em qualquer item.
 *
 * O `sr-only` é o que carrega a palavra para quem não tem a cor nem a forma —
 * o ícone é `aria-hidden`, e o `title` de um `<div>` sem papel é descrição,
 * que muitos leitores de tela deixam de fora. Ele vem ANTES do nome, então a
 * leitura sai *"Aniversário de Ana Lima"*.
 */
export function MarcaDoAniversario({ item }: { item: ItemDoCalendario }) {
  if (!ehAniversario(item)) return null;

  return (
    // UM ELEMENTO SÓ, e não os dois soltos no `flex` de quem chama: o
    // `sr-only` é irmão de flex, então o `gap-1` do chip contava DUAS vezes e
    // o vão entre o bolo e o nome saía 9px onde o código dizia 4. Foi a
    // imagem ampliada que mostrou — e numa linha que tem uns 60px para o nome,
    // cinco deles são o que separa um nome inteiro de um truncado.
    <span className="inline-flex shrink-0 items-center">
      <Cake aria-hidden className="size-3" />
      <span className="sr-only">{ROTULO_DO_ANIVERSARIO} de </span>
    </span>
  );
}
