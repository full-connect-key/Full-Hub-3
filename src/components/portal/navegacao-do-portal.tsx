"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navegacaoComBase } from "@/lib/navegacao-do-portal";
import { cn } from "@/lib/utils";

/**
 * Navegação superior do portal.
 *
 * No celular vira uma faixa que rola na horizontal: são quatro itens, então
 * uma gaveta como a do painel seria peso sem necessidade.
 */
export function NavegacaoDoPortal({ base = "/portal" }: { base?: string }) {
  const pathname = usePathname();
  const itens = navegacaoComBase(base);

  return (
    <nav aria-label="Seções do portal" className="-mb-px overflow-x-auto">
      <ul className="flex min-w-max items-center gap-1">
        {itens.map((item) => {
          const ativo =
            item.href === base
              ? pathname === base
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors",
                  ativo
                    ? "border-accent-strong text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
