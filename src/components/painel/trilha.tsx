"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { findMenuItem } from "@/lib/auth/permissions";

/**
 * Trilha da rota atual. Fica discreta: serve para situar, não para navegar
 * muito — quem navega é o menu lateral.
 */
export function Trilha() {
  const pathname = usePathname();
  const item = findMenuItem(pathname);
  const naHome = pathname === "/painel";

  return (
    <nav aria-label="Trilha de navegação" className="min-w-0 text-sm">
      <ol className="flex items-center gap-1.5">
        <li className="shrink-0">
          {naHome ? (
            <span className="font-medium">Painel</span>
          ) : (
            <Link href="/painel" className="text-muted-foreground hover:text-foreground transition-colors">
              Painel
            </Link>
          )}
        </li>

        {!naHome && item ? (
          <>
            <li aria-hidden className="text-muted-foreground/60 shrink-0">
              <ChevronRight className="size-3.5" />
            </li>
            <li className="truncate font-medium">{item.label}</li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
