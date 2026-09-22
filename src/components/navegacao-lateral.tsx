"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Layers, Menu, X } from "lucide-react";

import { MENU, itemAtivo } from "@/lib/navegacao";

/**
 * A navegacao aparece de duas formas, e cada uma tem o seu componente:
 *
 *   NavegacaoLateral -> coluna fixa, so no desktop, renderizada pelo layout
 *   MenuMobile       -> botao e gaveta, so no celular, dentro da barra superior
 *
 * Os dois precisam existir separados por causa de onde ficam na tela: a coluna
 * fica ao lado do conteudo, e o botao precisa ficar dentro da barra superior.
 * Um componente so, usado nos dois lugares, desenhava dois botoes no celular.
 */

function ListaDeLinks({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Seções do dashboard">
      {MENU.map(({ rotulo, href, Icone }) => {
        const ativo = itemAtivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            onClick={aoNavegar}
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
}

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-contraste">
        <Layers aria-hidden className="size-4" />
      </span>
      <span className="text-sm font-semibold tracking-tight">Full Hub</span>
    </div>
  );
}

export function NavegacaoLateral() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-borda bg-superficie lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-6 py-5">
        <Marca />
        <div className="px-3">
          <ListaDeLinks />
        </div>
      </div>
    </aside>
  );
}

export function MenuMobile() {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={aberto}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-borda text-texto-suave transition-colors hover:bg-superficie-suave"
      >
        <Menu aria-hidden className="size-4" />
      </button>

      {aberto ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={fechar}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-borda bg-superficie py-5">
            <div className="flex items-center justify-between pr-3">
              <Marca />
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar menu"
                className="inline-flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-suave"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className="px-3">
              {/* Fecha a gaveta ao navegar, senao ela cobriria a pagina nova. */}
              <ListaDeLinks aoNavegar={fechar} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
