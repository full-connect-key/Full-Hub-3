"use client";

import { Search } from "lucide-react";
import { toast } from "sonner";

/**
 * Campo de busca global.
 *
 * Por ora é só a casca: um botão com cara de campo. Preferimos isso a um
 * input que aceita texto e não faz nada — digitar e não acontecer nada faz
 * a pessoa achar que o sistema está quebrado.
 */
export function BuscaGlobal() {
  return (
    <button
      type="button"
      onClick={() =>
        toast.info("A busca global entra em um sprint futuro.", {
          description: "Por enquanto, use o menu lateral para navegar.",
        })
      }
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground border-input focus-visible:ring-ring/50 hidden h-8 w-56 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:flex xl:w-72"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="truncate">Buscar na plataforma…</span>
    </button>
  );
}
