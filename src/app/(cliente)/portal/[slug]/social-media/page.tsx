import type { Metadata } from "next";

import { PlaceholderDoPortalDoCliente } from "@/components/portal/placeholder-do-portal";

export const metadata: Metadata = { title: "Social Media" };

export default function Pagina() {
  return <PlaceholderDoPortalDoCliente href="/portal/social-media" />;
}
