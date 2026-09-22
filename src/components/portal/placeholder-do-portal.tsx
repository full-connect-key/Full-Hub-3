import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { exigirCliente } from "@/lib/auth/dal";
import { acharItemDoPortal } from "@/lib/navegacao-do-portal";

/**
 * Seção do portal que ainda não existe, vista pelo CLIENTE.
 *
 * Chama `exigirCliente()` de novo, embora o layout de (meu) já tenha chamado.
 * É de propósito: a guarda anda junto da tela, e não depende de alguém lembrar
 * de envolvê-la no layout certo. `obterSessao` é memoizada por requisição,
 * então a conferência repetida não custa uma ida a mais ao banco.
 */
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

/**
 * A mesma seção, vista pela EQUIPE em /portal/{slug}.
 *
 * Separada porque a guarda é outra — quem entra aqui é da gestão, e
 * `exigirCliente()` daria 403 nela — e porque a frase muda: "seu acesso já
 * está ativo" não faz sentido para quem está olhando o portal de outra pessoa.
 * A guarda desta fica no layout de /portal/[slug], que também registra a
 * visita; repeti-la aqui registraria a mesma visita duas vezes.
 */
export function PlaceholderDoPortalDoCliente({ href }: { href: string }) {
  const item = acharItemDoPortal(href);

  return (
    <div className="space-y-8">
      <PageHeader title={item?.label ?? "Seção"} description={item?.description} />
      <EmptyState
        icon={item?.icon ?? Hammer}
        title="Esta área do portal será construída em breve"
        description="A navegação e as permissões já funcionam. O conteúdo entra em um dos próximos sprints."
      />
    </div>
  );
}
