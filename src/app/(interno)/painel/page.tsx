import type { Metadata } from "next";
import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota, primeiroNome } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Home" };

export default async function PaginaInicialDoPainel() {
  const { profile } = await exigirAcessoARota("/painel");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${primeiroNome(profile.nome)}`}
        description="A navegação do painel já está de pé. Os módulos entram a cada sprint."
      />
      <EmptyState
        icon={Hammer}
        title="Sua visão geral aparece aqui"
        description="Tarefas do dia, prazos próximos e o que precisa da sua atenção. Enquanto isso, use o menu ao lado para percorrer os módulos."
      />
    </div>
  );
}
