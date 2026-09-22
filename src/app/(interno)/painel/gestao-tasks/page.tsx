import type { Metadata } from "next";

import { PlaceholderDeModulo } from "@/components/shared/placeholder-de-modulo";

export const metadata: Metadata = { title: "Gestão de Tasks" };

export default function Pagina() {
  return <PlaceholderDeModulo href="/painel/gestao-tasks" />;
}
