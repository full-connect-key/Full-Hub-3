import { Node, mergeAttributes } from "@tiptap/core";

/** Os quatro tipos de caixa. O valor viaja no documento; a cor mora no CSS. */
export const TIPOS_DE_CAIXA = ["neutra", "info", "aviso", "perigo"] as const;
export type TipoDeCaixa = (typeof TIPOS_DE_CAIXA)[number];

export const ROTULO_DA_CAIXA: Record<TipoDeCaixa, string> = {
  neutra: "Caixa neutra",
  info: "Caixa de informação",
  aviso: "Caixa de atenção",
  perigo: "Caixa de alerta",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    caixaDoBriefing: {
      /** Põe a seleção dentro de uma caixa, ou troca o tipo da que já existe. */
      alternarCaixa: (tipo: TipoDeCaixa) => ReturnType;
    };
  }
}

/**
 * A CAIXA DO BRIEFING — um bloco que segura outros blocos.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário: *"mais opções de formatação, como box, tabela e mais
 * cores"*. Não existe "box" pronto no TipTap: `blockquote` é o que mais se
 * parece e quer dizer outra coisa — fio à esquerda e texto cinza dizem *"isto
 * foi dito por alguém"*, e o briefing precisa de *"leia isto"*.
 *
 * ---------------------------------------------------------------------------
 * **`content: "block+"` E NÃO `"inline*"`**, e é a decisão inteira: uma caixa
 * que só aceita texto corrido não serve a um briefing, onde o que se destaca é
 * quase sempre uma LISTA — as três coisas que não podem faltar, os dois
 * formatos pedidos. Com `block+` ela aceita parágrafo, lista e título dentro.
 *
 * **O TIPO É UM NOME e não uma cor**, e é o que faz esta ser a única
 * formatação de fundo do editor que troca com o tema: `data-caixa="aviso"`
 * viaja no documento, e o chão sai de `--warning-soft` no `globals.css`, que é
 * um par já medido. Um pastel gravado aqui dentro ficaria claro no escuro —
 * exatamente o que a paleta nomeada desta mesma entrega existe para desfazer.
 *
 * **E O VALOR DESCONHECIDO VIRA `neutra`**, em vez de sair sem chão nenhum: um
 * documento colado de fora, ou um tipo que alguém renomeie um dia, desenha uma
 * caixa cinza — que é uma caixa — no lugar de um bloco solto que não se
 * distingue do texto em volta.
 * ---------------------------------------------------------------------------
 */
export const CaixaDoBriefing = Node.create({
  name: "caixaDoBriefing",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tipo: {
        default: "neutra" as TipoDeCaixa,
        parseHTML: (elemento) => {
          const bruto = elemento.getAttribute("data-caixa");
          return (TIPOS_DE_CAIXA as readonly string[]).includes(bruto ?? "")
            ? bruto
            : "neutra";
        },
        renderHTML: (atributos) => ({ "data-caixa": atributos.tipo as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-caixa]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      alternarCaixa:
        (tipo: TipoDeCaixa) =>
        ({ editor, chain }) => {
          // JÁ ESTÁ NUMA CAIXA DESTE TIPO → tira. De outro tipo → troca, em vez
          // de aninhar uma caixa dentro da outra: dois chãos empilhados não
          // destacam nada, e desfazer o aninhamento depois é um `lift` que
          // ninguém descobre sozinho.
          if (editor.isActive(this.name, { tipo })) {
            return chain().focus().lift(this.name).run();
          }
          if (editor.isActive(this.name)) {
            return chain().focus().updateAttributes(this.name, { tipo }).run();
          }
          return chain().focus().wrapIn(this.name, { tipo }).run();
        },
    };
  },
});
