import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { listarPortaisDeClientes } from "@/lib/dados/portais-de-clientes";

/**
 * O que a gestão vê ao abrir /portal.
 *
 * Quem é da agência não tem portal próprio — não há linha em `client_users`
 * para a equipe, e é assim de propósito. O que existe é o portal de cada
 * cliente, e é isto: a escolha de qual abrir.
 *
 * O destino é /portal/{slug}, a visualização administrativa. Lá a tela é a
 * mesma que o cliente vê, com a faixa de aviso no topo, nenhuma ação em nome
 * dele, e a visita registrada.
 */
export async function EscolhaDePortal() {
  const clientes = await listarPortaisDeClientes();

  if (clientes.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma empresa com portal"
        description="O portal abre para empresas ativas com endereço definido. Cadastre uma em Clientes."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {clientes.map((cliente) => (
        <li key={cliente.id}>
          <Link
            href={`/portal/${cliente.slug}`}
            className="bg-surface-card hover:border-accent-strong flex items-center gap-3 rounded-xl border p-4 transition-colors"
          >
            <Building2
              aria-hidden
              className="text-text-muted size-5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{cliente.nome_empresa}</p>
              <p className="text-text-muted truncate text-sm">
                /portal/{cliente.slug}
              </p>
            </div>
            <ArrowRight
              aria-hidden
              className="text-text-muted size-4 shrink-0"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
