import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão de toda página do painel: título e um espaço à direita
 * para as ações da tela (botões, filtros de alto nível).
 *
 * Usar sempre este componente é o que mantém o mesmo respiro e a mesma
 * hierarquia tipográfica de um módulo para o outro.
 *
 * **NÃO TEM `description`, e a ausência é deliberada.** A linha de subtítulo
 * abaixo do título saiu de todas as telas por decisão do produto. A prop foi
 * removida junto, e não só as chamadas: prop opcional que ninguém usa volta
 * na primeira tela nova que alguém escrever copiando outra.
 *
 * Isto NÃO vale para `ConfirmDialog` nem para `EmptyState`, que continuam
 * com `description`. Lá o texto não é legenda — é o que diz que a ação não
 * tem volta, ou o que fazer numa tela vazia.
 */
export function PageHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
