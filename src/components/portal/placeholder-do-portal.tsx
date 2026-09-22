import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { acharItemDoPortal } from "@/lib/navegacao-do-portal";

/** Seção do portal que ainda não existe. */
export async function PlaceholderDoPortal({ href }: { href: string }) {
  await exigirCliente();
  const item = acharItemDoPortal(href);

  return (
    <div className="space-y-8">
      <PageHeader title={item?.label ?? "Seção"} description={item?.description} />
      <EmptyState
        icon={item?.icon ?? Hammer}
        title="Esta área será construída em breve"
        description="Seu acesso já está ativo. O conteúdo entra em um dos próximos sprints."
      />
    </div>
  );
}
