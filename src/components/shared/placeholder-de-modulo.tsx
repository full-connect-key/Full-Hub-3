import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { findMenuItem } from "@/lib/auth/permissions";

/**
 * Tela de um módulo que ainda não existe.
 *
 * Faz duas coisas: valida o perfil no servidor (quem não pode receber 403,
 * mesmo digitando a rota direto) e desenha o cabeçalho a partir do cadastro em
 * permissions.ts. Por isso cada rota placeholder tem uma linha só, e o título
 * nunca sai do mesmo lugar que alimenta o menu.
 */
export async function PlaceholderDeModulo({ href }: { href: string }) {
  await exigirAcessoARota(href);
  const item = findMenuItem(href);

  return (
    <div className="space-y-6">
      <PageHeader title={item?.label ?? "Módulo"} />
      <EmptyState
        icon={item?.icon ?? Hammer}
        title="Este módulo será construído em breve"
        description="A navegação e as permissões já estão funcionando. O conteúdo entra em um dos próximos sprints."
      />
    </div>
  );
}
