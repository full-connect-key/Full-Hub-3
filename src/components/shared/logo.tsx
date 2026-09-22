import { cn } from "@/lib/utils";

/**
 * Marca do Full Hub.
 *
 * O símbolo é um círculo azul da marca com "FH" em texto escuro — a regra da
 * casa: azul claro pede texto escuro. O "FH" usa --brand-foreground, e não
 * --text-primary: o fundo é azul claro nos DOIS temas, então o texto em cima
 * tem que ser escuro nos dois. --text-primary clareia no tema escuro e daria
 * claro sobre claro, 1.7:1. Abaixo do nome vem a assinatura da
 * agência, menor e em caixa alta, porque o Full Hub é da Full Connect Key e
 * quem entra precisa reconhecer de quem é a casa.
 *
 * `sobreEscuro` é para a barra lateral, que tem fundo próprio e não acompanha
 * o tema claro/escuro da página. Sem ele, o nome sairia escuro sobre escuro.
 *
 * Por enquanto a marca é tipográfica. Quando a arte final chegar, troque o
 * bloco do símbolo por um <Image src="/logo.svg" .../> mantendo as medidas —
 * o resto da interface não precisa mudar.
 */
export function Logo({
  tamanho = "md",
  sobreEscuro = false,
  comAssinatura = true,
  className,
}: {
  tamanho?: "sm" | "md" | "lg";
  sobreEscuro?: boolean;
  comAssinatura?: boolean;
  className?: string;
}) {
  const medidas = {
    sm: { caixa: "size-8 text-xs", texto: "text-sm", assinatura: "text-[9px]" },
    md: { caixa: "size-10 text-sm", texto: "text-lg", assinatura: "text-[10px]" },
    lg: { caixa: "size-14 text-lg", texto: "text-2xl", assinatura: "text-[11px]" },
  }[tamanho];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "bg-brand-blue text-brand-foreground flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
          medidas.caixa,
        )}
      >
        FH
      </span>

      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "font-semibold tracking-tight",
            medidas.texto,
            sobreEscuro && "text-text-on-dark",
          )}
        >
          Full Hub
        </span>
        {comAssinatura ? (
          <span className={cn("text-text-muted font-medium tracking-widest uppercase", medidas.assinatura)}>
            Full Connect Key
          </span>
        ) : null}
      </span>
    </div>
  );
}
