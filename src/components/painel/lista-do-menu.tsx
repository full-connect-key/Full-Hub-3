"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECTION_LABELS, getMenuForRole, type MenuItem } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** /painel só fica ativo na própria Home; os demais valem para suas sub-rotas. */
function estaAtivo(pathname: string, item: MenuItem): boolean {
  if (item.href === "/painel") return pathname === "/painel";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ListaDoMenu({
  role,
  aoNavegar,
}: {
  role: UserRole;
  /** Usado na gaveta do celular, para fechar ao escolher um item. */
  aoNavegar?: () => void;
}) {
  const pathname = usePathname();
  const secoes = getMenuForRole(role);

  return (
    <nav className="flex flex-col gap-5" aria-label="Módulos do painel">
      {secoes.map(({ section, items }) => (
        <div key={section} className="flex flex-col gap-1">
          <p className="text-muted-foreground recolhido:lg:hidden px-3 text-[11px] font-medium tracking-wide uppercase">
            {SECTION_LABELS[section]}
          </p>

          {items.map((item) => {
            const ativo = estaAtivo(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={aoNavegar}
                title={item.label}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "recolhido:lg:justify-center recolhido:lg:px-0",
                  ativo
                    ? "bg-accent text-accent-strong font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  // Módulo opcional: presente, mas sem disputar atenção.
                  item.muted && !ativo && "text-muted-foreground/70",
                )}
              >
                <item.icon aria-hidden className="size-4 shrink-0" />
                <span className="recolhido:lg:hidden truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
