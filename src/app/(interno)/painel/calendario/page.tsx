import type { Metadata } from "next";

import { PlaceholderDeModulo } from "@/components/shared/placeholder-de-modulo";

export const metadata: Metadata = { title: "Calendário" };

export default function Pagina() {
  return (
    <PlaceholderDeModulo
      href="/painel/calendario"
      frase="Em breve os eventos da agência e dos clientes — convenções, feiras, lançamentos e feriados — no mesmo lugar dos prazos."
    />
  );
}
