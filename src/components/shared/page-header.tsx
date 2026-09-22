import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão de toda página do painel: título, descrição opcional e um
 * espaço à direita para as ações da tela (botões, filtros de alto nível).
 *
 * Usar sempre este componente é o que mantém o mesmo respiro e a mesma
 * hierarquia tipográfica de um módulo para o outro.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
