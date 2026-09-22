"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Layers, Menu, X } from "lucide-react";

import { MENU, itemAtivo } from "@/lib/navegacao";

export function NavegacaoLateral() {
  const pathname = usePathname();
  const [abertoNoMobile, setAbertoNoMobile] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1" aria-label="Seções do dashboard">
      {MENU.map(({ rotulo, href, Icone }) => {
        const ativo = itemAtivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            // Fecha a gaveta ao navegar, senao ela cobriria a pagina nova.
            onClick={() => setAbertoNoMobile(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              ativo
                ? "bg-brand-suave font-medium text-brand"
                : "text-texto-suave hover:bg-superficie-suave hover:text-texto"
            }`}
          >
            <Icone aria-hidden className="size-4 shrink-0" />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );

  const marca = (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-contraste">
        <Layers aria-hidden className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">Full Hub</span>
    </div>
  );

  return (
    <>
      {/* Desktop: coluna fixa */}
      <aside className="hidden w-60 shrink-0 border-r border-borda bg-superficie lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 py-5">
          {marca}
          <div className="px-3">{links}</div>
        </div>
      </aside>

      {/* Mobile: botao + gaveta */}
      <button
        type="button"
        onClick={() => setAbertoNoMobile(true)}
        aria-label="Abrir menu"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-borda text-texto-suave transition-colors hover:bg-superficie-suave lg:hidden"
      >
        <Menu aria-hidden className="size-4" />
      </button>

      {abertoNoMobile ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAbertoNoMobile(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-borda bg-superficie py-5">
            <div className="flex items-center justify-between pr-3">
              {marca}
              <button
                type="button"
                onClick={() => setAbertoNoMobile(false)}
                aria-label="Fechar menu"
                className="inline-flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-suave"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className="px-3">{links}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
