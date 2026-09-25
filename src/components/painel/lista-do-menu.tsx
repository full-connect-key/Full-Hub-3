"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SECTION_LABELS,
  SECTION_PILLS,
  getMenuForRole,
  type MenuItem,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/** /painel só fica ativo na própria Início; os demais valem para suas sub-rotas. */
function estaAtivo(pathname: string, item: MenuItem): boolean {
  if (item.href === "/painel") return pathname === "/painel";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Os módulos, na barra escura.
 *
 * O item ativo é marcado de três jeitos ao mesmo tempo — fundo mais claro,
 * texto e ícone em azul da marca, e um risco de 3px na borda esquerda. Parece
 * redundante e não é: recolhido, o menu mostra só o ícone, e o risco é a única
 * marca que continua legível. Quem enxerga mal a diferença de tom também
 * continua enxergando o risco.
 *
 * Azul da marca sobre a barra escura dá 8.8:1. É o lugar onde essa cor
 * funciona como texto — sobre branco ela daria 1.7:1, e é por isso que no
 * conteúdo claro o azul é outro (--accent-strong).
 *
 * **Houve um peso visual reduzido, e ele saiu junto com o último módulo que o
 * usava.** Era ícone menor e texto mais apagado, para módulo opcional não
 * disputar atenção com o trabalho. Com o módulo fora do produto, a bandeira
 * virou um campo que nenhuma linha do `MENU` liga — e campo que não decide
 * mais nada é o pior tipo de campo. Se um dia voltar a existir módulo
 * opcional, ela volta com ele.
 */
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
    <nav className="flex flex-col gap-6" aria-label="Módulos do painel">
      {secoes.map(({ section, items }) => {
        const pill = SECTION_PILLS[section];
        return (
          <div key={section} className="flex flex-col gap-0.5">
            <div className="recolhido:lg:hidden flex items-center gap-2 px-3 pb-1">
              {/* Fundo escuro nos dois temas: o token é o `on-dark`. */}
              <p className="text-text-on-dark-muted text-[11px] font-semibold tracking-wider uppercase">
                {SECTION_LABELS[section]}
              </p>
              {pill ? (
                <span className="bg-brand-blue/15 text-brand-blue rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase">
                  {pill}
                </span>
              ) : null}
            </div>

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
                    "relative flex items-center gap-3 rounded-md py-2 pr-3 pl-3 text-sm transition-colors",
                    "recolhido:lg:justify-center recolhido:lg:px-0",
                    "focus-visible:ring-brand-blue/60 focus-visible:ring-2 focus-visible:outline-none",
                    ativo
                      ? "bg-surface-sidebar-2 text-brand-blue font-medium"
                      : "text-text-on-dark/70 hover:bg-surface-sidebar-2/60 hover:text-text-on-dark",
                  )}
                >
                  {ativo ? (
                    <span
                      aria-hidden
                      className="bg-brand-blue absolute top-1 bottom-1 left-0 w-[3px] rounded-r"
                    />
                  ) : null}
                  <item.icon aria-hidden className="size-4 shrink-0" />
                  {/* Quebra em duas linhas em vez de cortar. "Recomendações
                      da Semana" não cabe numa linha, e "Recomendações da
                      Sema…" obriga a pessoa a passar o mouse para saber onde
                      está clicando — num menu, isso é o oposto do que ele
                      serve. */}
                  <span className="recolhido:lg:hidden leading-tight text-balance">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
