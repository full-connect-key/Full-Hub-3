import { LogOut } from "lucide-react";

import { MenuMobile } from "@/components/navegacao-lateral";
import { sair } from "@/lib/auth/acoes";

export function BarraSuperior({ nome, email }: { nome: string; email: string }) {
  const iniciais = nome.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-borda bg-superficie/90 px-4 backdrop-blur lg:px-6">
      <MenuMobile />

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-texto">{nome}</p>
          <p className="text-xs leading-tight text-texto-tenue">{email}</p>
        </div>
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-brand-suave text-xs font-semibold text-brand"
        >
          {iniciais}
        </span>

        <form action={sair}>
          <button
            type="submit"
            className="inline-flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-superficie-suave hover:text-texto"
            title="Sair"
          >
            <LogOut aria-hidden className="size-4" />
            <span className="sr-only">Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
