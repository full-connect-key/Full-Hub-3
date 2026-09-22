"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Controla o modo claro/escuro. O next-themes grava a preferencia e aplica a
 * classe .dark no <html> antes da primeira pintura, evitando o flash branco
 * de quem usa o tema escuro.
 */
export function ProvedorDeTema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
