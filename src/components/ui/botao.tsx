import type { ComponentProps, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma";

const variantes: Record<Variante, string> = {
  primario:
    "bg-brand text-brand-contraste hover:bg-brand-forte disabled:bg-brand/60",
  secundario:
    "border border-borda bg-superficie text-texto hover:bg-superficie-suave disabled:opacity-60",
  fantasma: "text-texto-suave hover:bg-superficie-suave hover:text-texto disabled:opacity-60",
};

export function Botao({
  children,
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante; children: ReactNode }) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
