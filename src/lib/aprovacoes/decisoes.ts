import { Check, MessageSquareWarning, X, type LucideIcon } from "lucide-react";

/**
 * AS TRÊS DECISÕES, com a palavra, o ícone e a cor de cada uma.
 *
 * Decisão do usuário: *"APROVAR verde, AJUSTAR amarelo, RECUSAR vermelho; em
 * todos os módulos; textos+ícones"*.
 *
 * **O QUE ESTAVA ERRADO NÃO ERA A FALTA DE COR, ERA A DIVERGÊNCIA.** As três
 * eram desenhadas em seis telas com quatro aparências, e duas delas se
 * contradiziam na mesma dobra:
 *
 * | Onde | Aprovar | Ajustes | Recusar |
 * | --- | --- | --- | --- |
 * | detalhe do material (portal) | pílula preta + `Check` | `outline` | `outline` + `X` |
 * | fila do cliente | pílula preta + `BadgeCheck` | `outline`, sem ícone | — |
 * | fila interna | pílula preta, sem ícone | `outline`, sem ícone | — |
 * | nota fiscal | pílula preta + `Check` | — | `outline` + `X` |
 *
 * **No portal, "Solicitar ajustes" e "Rejeitar" eram o MESMO botão** — mesmo
 * variant, mesmo tamanho, a dois centímetros de distância, e a única coisa que
 * os separava era a palavra. Pedir ajuste e recusar são os dois desfechos
 * negativos e querem dizer coisas opostas: *mude isto e volte* contra *não vai
 * ao ar desta forma*. Dois botões idênticos para duas decisões diferentes é o
 * jeito mais rápido de alguém clicar na errada.
 *
 * **É UM MAPA E NÃO UMA CONVENÇÃO ESCRITA**, que é a decisão de
 * `LinhaDeTrabalho` palavra por palavra: a sequência passa a ser o TIPO, então
 * a sétima tela não tem como inventar uma quinta aparência. Uma convenção
 * combinada em prosa é uma convenção que alguém quebra sem ninguém notar,
 * porque nada reprova — é a história das sete cópias de `abas.tsx` e das três
 * de `ICONE_DA_AREA`, duas delas já divergidas.
 *
 * **E A PALAVRA ENTRA NO MAPA, ao contrário do que a `BarraDeContexto`
 * centraliza.** Lá o que se compartilha é o desenho e o mecanismo, nunca a
 * lista, porque cada módulo sabe quais são as seções dele. Aqui a lista é a
 * mesma em todo módulo — são três decisões, e são sempre as mesmas três —, e
 * era justamente ela que estava divergindo: o botão dizia "Rejeitar", o título
 * do diálogo dizia "Recusar material" e o botão de confirmar dizia "Recusar",
 * os três na mesma tela. Fica **"Recusar"**, que é a palavra do pedido, a que
 * o diálogo já usava, e a que a nota fiscal e as solicitações já usavam;
 * "Rejeitar" era a exceção, num lugar só. `rejeitada` continua sendo o valor
 * do enum — é a camada em inglês, e ninguém que usa o sistema a vê.
 *
 * **Nenhuma varredura guarda a troca, e a ausência é decisão.** A palavra mora
 * em UM lugar agora, então ela não tem como voltar por cópia — e uma entrada
 * na lista de nomes mortos reprovaria este próprio parágrafo, que é a
 * armadilha que aquela lista já pagou sete vezes. **Quem protege é o mapa**, e
 * ele é conferido pelo compilador toda vez.
 *
 * **A COR NUNCA É O ÚNICO SINAL**, que é a regra do produto desde o chip do
 * calendário: cada decisão carrega a palavra E o ícone, e quem não distingue
 * verde de vermelho lê "Aprovar" com um visto ao lado. É também o que a
 * segunda metade do pedido — *"textos+ícones"* — está dizendo.
 *
 * Módulo sem diretiva: o mapa atravessa servidor e navegador, e a precedência
 * é `ICONE_DA_AREA`, que é um `LucideIcon` num módulo comum.
 */
export type Decisao = "aprovar" | "ajustar" | "recusar";

export const DECISOES: Record<
  Decisao,
  {
    rotulo: string;
    Icone: LucideIcon;
    /** O variant do `Button`, onde a cor está medida pelo `check:cores`. */
    variant: "aprovar" | "ajustar" | "recusar";
    /** A cor como TEXTO, para onde a decisão não cabe como botão cheio. */
    classeDeTexto: string;
  }
> = {
  aprovar: {
    rotulo: "Aprovar",
    Icone: Check,
    variant: "aprovar",
    classeDeTexto: "text-success",
  },
  ajustar: {
    rotulo: "Solicitar ajustes",
    Icone: MessageSquareWarning,
    variant: "ajustar",
    classeDeTexto: "text-warning",
  },
  recusar: {
    rotulo: "Recusar",
    Icone: X,
    variant: "recusar",
    classeDeTexto: "text-danger",
  },
};

/**
 * A decisão de cada ação da máquina de estados, e só delas.
 *
 * `acoesDaSubtarefa` devolve nove ações, e duas são decisões sobre uma rodada
 * — as outras sete são o trabalho andando (iniciar, concluir, enviar). Um
 * `Partial` é o que diz isso: quem não está aqui não é decisão, e cai na
 * pílula preta que toda ação principal do produto usa.
 *
 * **`enviar_cliente` NÃO é uma decisão**, e a ausência é deliberada: aprovar
 * diz que o material está bom, enviar diz que é agora. São duas, e juntá-las
 * já mandou peça errada para cliente em muita agência — pintá-lo de verde ao
 * lado de "Aprovar" seria a tela dizendo que são a mesma coisa.
 */
export const DECISAO_DA_ACAO: Partial<Record<string, Decisao>> = {
  aprovar: "aprovar",
  solicitar_ajustes: "ajustar",
};
