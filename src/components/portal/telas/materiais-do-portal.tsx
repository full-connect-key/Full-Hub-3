import { Inbox } from "lucide-react";

import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { FiltrosDoPortalCliente } from "@/components/portal/filtros-do-portal";
import { EmptyState } from "@/components/shared/empty-state";
import { STATUS_DE_CONTEUDO } from "@/components/shared/status-badge";
import { itensDoPortal, prazosDoPortal } from "@/lib/dados/portal";
import {
  combinaComFiltro,
  ordenarPorUrgencia,
  TIPOS_DE_ITEM,
  type FiltrosDoPortal,
  type FocoDePrazo,
  type TipoDeItem,
} from "@/lib/dominio/portal";
import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * A lista de tudo que já foi enviado, num bloco só.
 *
 * Serve as duas entradas, como a tela inicial: o portal do cliente e a
 * visualização da equipe em /portal/{slug}. Os filtros são LIDOS aqui e
 * APLICADOS pela mesma função de domínio que o contador usa — é o que impede o
 * número do chip de discordar da quantidade de cartões embaixo dele.
 */

const PRAZOS: FocoDePrazo[] = ["urgente", "semana", "adiante"];

export function lerFiltrosDoPortal(
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

export async function MateriaisDoPortal({
  filtros,
  clienteId,
  comoEquipe,
  base,
}: {
  filtros: FiltrosDoPortal;
  clienteId: string | null;
  comoEquipe: boolean;
  /** Prefixo dos links, para o post abrir no portal certo. */
  base: string;
}) {
  const { hoje, fimDaSemana } = prazosDoPortal();
  const itens = await itensDoPortal(clienteId ?? undefined);

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
            itens.length > 0
              ? "Nenhum material com esses filtros. Limpe os filtros para ver o resto."
              : comoEquipe
                ? "Este cliente ainda não recebeu nenhum material."
                : "Assim que a Full enviar um material para você, ele aparece nesta tela."
          }
        />
      ) : (
        <div className="space-y-3">
          {encontrados.map((item) => (
            <CartaoDeItem
              key={item.conteudoId}
              item={item}
              hoje={hoje}
              href={
                item.tipo === "post"
                  ? `${base}/social-media/${item.conteudoId}`
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
