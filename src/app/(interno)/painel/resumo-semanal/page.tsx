import type { Metadata } from "next";

import { PlaceholderDeModulo } from "@/components/shared/placeholder-de-modulo";

export const metadata: Metadata = { title: "Resumo Semanal" };

export default function Pagina() {
  return <PlaceholderDeModulo href="/painel/resumo-semanal" />;
}
