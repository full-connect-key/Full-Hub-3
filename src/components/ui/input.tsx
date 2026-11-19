import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * O CHÃO É BRANCO, e não transparente. Relato do usuário, com imagem:
 * *"aqui ainda está cinza sobre cinza"*.
 *
 * Transparente, o campo tomava a cor do que estivesse atrás — e isso é a
 * PÁGINA (`--surface-page`) na maioria das telas e o fundo do `DialogContent`
 * em todo diálogo: cinza sobre cinza, com a borda a 3,43:1 fazendo o trabalho
 * sozinha. É o mesmo achado do `variant="outline"` do botão, e o parágrafo que
 * o fechava deixava ISTO escrito como decisão em suspenso, com o número
 * medido: *"`Input`, `Textarea` e `SelectTrigger` continuam `bg-transparent`
 * (…) é decisão própria, e o número está medido aqui para quem a tomar"*.
 *
 * `--input` sobre `--surface-page` dá 3,43:1 e sobre `--card` dá 3,98:1, então
 * a borda passa nas duas superfícies — o que faltava era o controle ter chão
 * próprio em vez de herdar o de quem o abriga.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex h-9 w-full min-w-0 rounded-md border bg-card px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
