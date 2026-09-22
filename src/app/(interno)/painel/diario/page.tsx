import type { Metadata } from "next";

import { PlaceholderDeModulo } from "@/components/shared/placeholder-de-modulo";

export const metadata: Metadata = { title: "Diário" };

export default function Pagina() {
  return <PlaceholderDeModulo href="/painel/diario" />;
}
