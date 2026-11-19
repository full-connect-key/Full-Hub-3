import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * O chão é branco e não transparente, pela razão escrita em
 * `components/ui/input.tsx`: transparente, o controle tomava a cor da página
 * ou a do diálogo — cinza sobre cinza, com a borda a 3,43:1 sozinha.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex field-sizing-content min-h-16 w-full rounded-md border bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
