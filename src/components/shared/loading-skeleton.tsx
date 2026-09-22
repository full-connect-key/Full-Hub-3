import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueleto de carregamento nos três formatos que o projeto usa.
 *
 * A regra: nenhuma tela mostra branco enquanto carrega. O esqueleto já dá a
 * forma do que vem, então a página não "pula" quando o conteúdo chega.
 *
 * Use dentro de <Suspense fallback={...}> ou num arquivo loading.tsx.
 */
export function LoadingSkeleton({
  variant = "list",
  rows = 5,
  className,
}: {
  variant?: "table" | "card" | "list";
  rows?: number;
  className?: string;
}) {
  if (variant === "table") {
    return (
      <div className={cn("rounded-xl border", className)} aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-4 border-b px-3 py-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, linha) => (
          <div key={linha} className="flex items-center gap-4 border-b px-3 py-3 last:border-0">
            {Array.from({ length: 4 }).map((_, coluna) => (
              <Skeleton
                key={coluna}
                className={cn("h-4 flex-1", coluna === 0 && "max-w-[40%]")}
              />
            ))}
          </div>
        ))}
        <span className="sr-only">Carregando…</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
        <span className="sr-only">Carregando…</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
