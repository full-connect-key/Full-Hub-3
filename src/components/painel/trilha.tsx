"use client";

import { usePathname } from "next/navigation";

import { findMenuItem } from "@/lib/auth/permissions";

/**
 * Onde você está, em duas linhas.
 *
 * Em cima, pequena e em caixa alta, a trilha — FULL HUB — DASHBOARD FULL.
 * Embaixo, no tamanho do texto normal, o nome da página. A hierarquia inverte
 * a do pão de navegação comum de propósito: o que importa é a página atual, e
 * a trilha existe só para situar quem chegou por um link.
 *
 * Não tem link: quem navega é o menu lateral, que está sempre visível. Duas
 * formas de navegar para o mesmo lugar, uma delas escondida em letra miúda,
 * só dividiria a atenção.
 */
export function Trilha() {
  const pathname = usePathname();
  const item = findMenuItem(pathname);
  const naInicial = pathname === "/painel";

  return (
    <div className="min-w-0">
      <p className="text-text-muted text-[10px] font-semibold tracking-widest uppercase">
        Full Hub — Dashboard Full
      </p>
      <p className="text-text-primary truncate text-sm font-medium">
        {naInicial ? "Início" : (item?.label ?? "Painel")}
      </p>
    </div>
  );
}
