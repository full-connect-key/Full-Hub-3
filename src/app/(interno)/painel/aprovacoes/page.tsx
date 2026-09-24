import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import {
  campanhasDoCliente,
  entregaveisDaCampanha,
} from "@/lib/dados/campanhas";
import {
  emArvore,
  folhas,
  periodoCurto,
  progresso,
  ROTULO_DA_CAMPANHA,
} from "@/lib/dominio/campanhas";

export const metadata: Metadata = { title: "Aprovações & Conteúdo" };

/**
 * A entrada das campanhas pelo lado da agência, na versão mínima.
 *
 * **Isto NÃO é o gerenciador**, que é de outro momento: não dá para editar a
 * estrutura, subir arquivo nem enviar entregável por aqui. O que existe é a
 * lista do que foi aberto e o caminho para abrir mais — o suficiente para uma
 * campanha nascer com a árvore certa e chegar ao Portal.
 *
 * A contagem é a MESMA do portal, pela mesma função: se a tela da agência
 * contasse por conta própria, as duas dariam números diferentes no dia em que
 * alguém mexesse numa delas.
 */
export default async function PaginaDeAprovacoes() {
  await exigirAcessoARota("/painel/aprovacoes");

  const campanhas = await campanhasDoCliente();
  const arvores = await Promise.all(
    campanhas.map((c) => entregaveisDaCampanha(c.id)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações & Conteúdo"
        actions={
          <Button asChild>
            <Link href="/painel/aprovacoes/campanhas/nova">
              <Plus aria-hidden className="size-4" />
              Nova campanha
            </Link>
          </Button>
        }
      />

      {campanhas.length === 0 ? (
        <EmptyState
          title="Nenhuma campanha aberta"
          description="Abra a primeira e a estrutura de entregáveis nasce junto, a partir de um modelo."
        />
      ) : (
        <ul className="space-y-2">
          {campanhas.map((campanha, i) => {
            const conta = progresso(folhas(emArvore(arvores[i])));

            return (
              <li
                key={campanha.id}
                className="bg-surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{campanha.nome}</p>
                  <p className="text-text-muted text-sm tabular-nums">
                    {campanha.cliente}
                    <span aria-hidden> · </span>
                    {periodoCurto(campanha.dataInicio, campanha.dataFim)}
                    <span aria-hidden> · </span>
                    <span>{ROTULO_DA_CAMPANHA[campanha.status]}</span>
                  </p>
                </div>

                <p className="text-text-muted text-sm tabular-nums">
                  {conta.aprovados} de {conta.total} aprovados
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
