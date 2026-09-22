"use client";

import { PanelLeftClose } from "lucide-react";

import { ListaDoMenu } from "@/components/painel/lista-do-menu";
import { CartaoDaPessoa } from "@/components/painel/cartao-da-pessoa";
import { Logo } from "@/components/shared/logo";
import type { UserRole } from "@/lib/supabase/database.types";

/**
 * Coluna fixa do painel, no desktop.
 *
 * A barra tem fundo próprio e escuro nos dois temas. Não é enfeite: ela separa
 * "onde eu navego" de "o que eu estou olhando", e deixa o conteúdo claro com a
 * tela inteira para respirar. Por ter fundo próprio, tudo aqui dentro usa os
 * tokens de texto sobre escuro em vez dos tokens de tema.
 *
 * O estado recolhido não vive em estado do React, e sim no atributo data-menu
 * do <html>, gravado pelo script do layout antes da hidratação. Por isso a
 * largura certa já aparece na primeira pintura, e recarregar a página não faz
 * o menu piscar aberto antes de recolher.
 */
export function MenuLateral({
  role,
  nome,
  cargo,
  avatarUrl,
}: {
  role: UserRole;
  nome: string;
  cargo: string | null;
  avatarUrl: string | null;
}) {
  function alternar() {
    const raiz = document.documentElement;
    const proximo = raiz.dataset.menu === "recolhido" ? "expandido" : "recolhido";
    raiz.dataset.menu = proximo;
    try {
      localStorage.setItem("full-hub:menu", proximo);
    } catch {
      // Navegador sem armazenamento (aba anônima, cookies bloqueados): o menu
      // funciona igual, só não lembra da escolha na próxima visita.
    }
  }

  return (
    <aside className="bg-surface-sidebar recolhido:lg:w-[4.5rem] hidden w-64 shrink-0 transition-[width] duration-200 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-6 py-4">
        <div className="recolhido:lg:justify-center flex items-center px-4">
          <Logo
            tamanho="sm"
            sobreEscuro
            className="recolhido:lg:[&>span:last-child]:hidden"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <ListaDoMenu role={role} />
        </div>

        <div className="space-y-2 px-3">
          <CartaoDaPessoa nome={nome} cargo={cargo} role={role} avatarUrl={avatarUrl} />

          <button
            type="button"
            onClick={alternar}
            className="text-text-on-dark/60 hover:bg-surface-sidebar-2 hover:text-text-on-dark focus-visible:ring-brand-blue/60 recolhido:lg:justify-center flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <PanelLeftClose
              aria-hidden
              className="recolhido:rotate-180 size-4 shrink-0 transition-transform"
            />
            <span className="recolhido:lg:hidden">Recolher menu</span>
            <span className="sr-only">Recolher ou expandir o menu</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
