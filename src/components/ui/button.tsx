import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // A PÍLULA PRETA DO DESENHO APROVADO, com o hover indo para o royal
        // de ação. Ela substitui o botão ciano de texto escuro — aquele
        // existia porque branco sobre --brand-blue dá 1,7:1, e a regra sai
        // junto com o botão. Este par é o mais folgado da casa (19,43:1), e
        // inverte sozinho no escuro porque --acao-fundo aponta para
        // --text-primary.
        default:
          "bg-acao-fundo text-acao-texto hover:bg-acao-fundo-hover hover:text-acao-texto-hover rounded-full",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",

        // ------------------------------------------------- AS TRÊS DECISÕES --
        // Aprovar, solicitar ajustes e recusar são UMA família com três cores,
        // e são variants e não classes escritas na tela pela razão de
        // `LinhaDeTrabalho`: **a sequência passa a ser o TIPO**, então a sétima
        // tela não tem como inventar uma quarta aparência. Até aqui eram quatro
        // aparências em seis telas — no portal "Solicitar ajustes" e "Rejeitar"
        // eram o MESMO `outline`, e na fila interna nenhum dos dois tinha cor.
        //
        // PAR NOMEADO, NUNCA OPACIDADE, que é a regra do selo de estado —
        // inclusive no hover, que é par nomeado também.
        //
        // **E OS TRÊS CHÃOS NÃO SÃO `--success`, `--warning` E `--danger`.**
        // A primeira versão foi exatamente isso, e a medição derrubou duas
        // vezes: aqueles são tokens de TEXTO, escurecidos até ler bem a 11px,
        // e âmbar escurecido é marrom — a ΔE 1,2 do vermelho da recusa em
        // deuteranopia, ou seja a MESMA COR nos dois desfechos negativos. No
        // tema escuro o verde e o vermelho colidem pelo motivo inverso. A
        // razão inteira, com os números, está no `globals.css`; quem reprova
        // de agora em diante é a seção de daltonismo do `check:cores`.
        //
        // E `recusar` NÃO é `destructive` com outro nome, embora hoje as duas
        // resolvam para o mesmo vermelho: `destructive` quer dizer "isto apaga
        // alguma coisa", e recusar um material não apaga nada. Escrever
        // `variant="destructive"` numa recusa manda quem vier depois procurar
        // um apagamento que não existe ali — é `pessoasDaLinhaDoTempo` de novo.
        aprovar:
          "bg-aprovar text-aprovar-foreground shadow-xs hover:bg-aprovar-hover focus-visible:ring-aprovar/40",
        ajustar:
          "bg-ajustar text-ajustar-foreground shadow-xs hover:bg-ajustar-hover focus-visible:ring-ajustar/40",
        recusar:
          "bg-recusar text-recusar-foreground shadow-xs hover:bg-recusar-hover focus-visible:ring-recusar/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
