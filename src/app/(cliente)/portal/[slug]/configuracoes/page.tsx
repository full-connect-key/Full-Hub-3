import type { Metadata } from "next";

import { PlaceholderDoPortalDoCliente } from "@/components/portal/placeholder-do-portal";

export const metadata: Metadata = { title: "Configurações" };

export default function Pagina() {
  return <PlaceholderDoPortalDoCliente href="/portal/configuracoes" />;
}
