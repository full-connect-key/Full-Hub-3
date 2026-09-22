"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Alterna entre claro e escuro.
 *
 * Os dois icones sao sempre renderizados e o CSS esconde um deles conforme a
 * classe .dark no <html>. E de proposito: se o icone dependesse de estado do
 * React, o servidor renderizaria um e o navegador outro -- o famoso erro de
 * hidratacao -- e a solucao comum para isso (esperar montar) faz o botao
 * piscar na primeira pintura.
 */
export function AlternadorDeTema() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar entre tema claro e escuro"
    >
      <Moon aria-hidden className="block dark:hidden" />
      <Sun aria-hidden className="hidden dark:block" />
    </Button>
  );
}
