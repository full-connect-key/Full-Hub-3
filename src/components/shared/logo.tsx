import { cn } from "@/lib/utils";

/**
 * Marca do Full Hub.
 *
 * Por enquanto e tipografica. Quando a arte final chegar, troque o bloco do
 * simbolo por um <Image src="/logo.svg" .../> e mantenha as mesmas medidas,
 * que o resto da interface nao precisa mudar.
 */
export function Logo({
  tamanho = "md",
  className,
}: {
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  const medidas = {
    sm: { caixa: "size-7 text-xs", texto: "text-sm" },
    md: { caixa: "size-9 text-sm", texto: "text-lg" },
    lg: { caixa: "size-14 text-lg", texto: "text-2xl" },
  }[tamanho];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "bg-primary text-primary-foreground flex items-center justify-center rounded-xl font-semibold tracking-tight",
          medidas.caixa,
        )}
      >
        FH
      </span>
      <span className={cn("font-semibold tracking-tight", medidas.texto)}>Full Hub</span>
    </div>
  );
}
