import type { Metadata } from "next";
import { Suspense } from "react";
import { Inbox } from "lucide-react";

import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { FiltrosDoPortalCliente } from "@/components/portal/filtros-do-portal";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { exigirCliente } from "@/lib/auth/dal";
import { itensDoPortal, prazosDoPortal } from "@/lib/dados/portal";
import {
  combinaComFiltro,
  ordenarPorUrgencia,
  TIPOS_DE_ITEM,
  type FiltrosDoPortal,
  type FocoDePrazo,
  type TipoDeItem,
} from "@/lib/dominio/portal";
import { STATUS_DE_CONTEUDO } from "@/components/shared/status-badge";
import type { ContentStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Materiais" };

const PRAZOS: FocoDePrazo[] = ["urgente", "semana", "adiante"];

/**
 * Tudo que a Full já enviou, com busca e os mesmos filtros da tela inicial.
 *
 * Os filtros são LIDOS aqui e APLICADOS pela mesma função de domínio que o
 * contador usa. É o que impede o número do chip de discordar da quantidade de
 * cartões embaixo dele.
 */

function lerFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosDoPortal {
  const texto = (chave: string) =>
    typeof params[chave] === "string" ? params[chave] : "";

  const tipo = texto("tipo");
  const status = texto("status");
  const prazo = texto("prazo");

  return {
    tipo: (TIPOS_DE_ITEM as string[]).includes(tipo)
      ? (tipo as TipoDeItem)
      : null,
    status: (STATUS_DE_CONTEUDO as string[]).includes(status)
      ? (status as ContentStatus)
      : null,
    prazo: (PRAZOS as string[]).includes(prazo) ? (prazo as FocoDePrazo) : null,
    busca: texto("busca"),
  };
}

async function Conteudo({
  filtros,
  empresa,
}: {
  filtros: FiltrosDoPortal;
  empresa: string | null;
}) {
  const { hoje, fimDaSemana } = prazosDoPortal();
  const itens = await itensDoPortal(empresa ?? undefined);

  const encontrados = itens
    .filter((item) => combinaComFiltro(item, filtros, hoje, fimDaSemana))
    .sort(ordenarPorUrgencia);

  return (
    <div className="space-y-6">
      <FiltrosDoPortalCliente
        filtros={filtros}
        encontrados={encontrados.length}
        comBusca
      />

      {encontrados.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nada por aqui"
          description={
            itens.length === 0
              ? "Assim que a Full enviar um material para você, ele aparece nesta tela."
              : "Nenhum material com esses filtros. Limpe os filtros para ver o resto."
          }
        />
      ) : (
        <div className="space-y-3">
          {encontrados.map((item) => (
            <CartaoDeItem key={item.conteudoId} item={item} hoje={hoje} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PaginaDeItensDoPortal({
  searchParams,
}: PageProps<"/portal/itens">) {
  await exigirCliente();
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const empresa = typeof params.empresa === "string" ? params.empresa : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Materiais</h1>
        <p className="text-text-muted mt-1">
          Tudo que a Full enviou para você, do mais urgente ao que pode esperar.
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo filtros={filtros} empresa={empresa} />
      </Suspense>
    </div>
  );
}
