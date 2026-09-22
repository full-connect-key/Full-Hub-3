import type { Metadata } from "next";

import { PlaceholderDoPortal } from "@/components/portal/placeholder-do-portal";

export const metadata: Metadata = { title: "Configurações" };

export default function Pagina() {
  return <PlaceholderDoPortal href="/portal/configuracoes" />;
}
