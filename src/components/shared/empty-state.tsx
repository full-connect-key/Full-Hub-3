import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Estado vazio. Vale tanto para "ainda não existe nada" quanto para "a busca
 * não achou nada" — o texto é que muda.
 *
 * Um estado vazio sempre diz o que está acontecendo e, quando cabe, oferece a
 * saída. Uma área em branco não comunica nada.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        /* O VAZIO É UM CARTÃO BRANCO, como os outros da tela. Relato do usuário:
           "cinza no cinza" — a caixa tracejada sem chão, com o ícone num
           círculo cinza, sumia no fundo da página. */
        "bg-surface-card rounded-card shadow-cartao flex flex-col items-center justify-center border px-6 py-14 text-center",
        className,
      )}
    >
      <span className="bg-action-soft text-action mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="text-base font-bold text-balance">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
