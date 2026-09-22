import Link from "next/link";
import { parseISO } from "date-fns";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import type { AchadoDaBusca } from "@/lib/dados/resumo-semanal";
import { rotuloDaSemana } from "@/lib/dominio/semanas";

/**
 * O que a busca achou, agrupado por semana.
 *
 * Cada achado é um link para a semana dele: encontrar o texto sem conseguir
 * chegar ao contexto em que foi escrito resolveria metade do problema.
 */
export function ResultadosDaBusca({
  termo,
  achados,
}: {
  termo: string;
  achados: AchadoDaBusca[];
}) {
  if (achados.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={`Nada com “${termo}”`}
        description="A busca varre as suas entregas e o texto das suas semanas — e só os seus."
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-text-muted text-sm">
        {achados.length} resultado{achados.length > 1 ? "s" : ""} para “{termo}”.
      </p>

      <ul className="space-y-2">
        {achados.map((achado, indice) => (
          <li
            key={`${achado.semana}-${achado.origem}-${indice}`}
            className="bg-surface-card rounded-card border p-4"
          >
            <Link
              href={`/painel/resumo-semanal?semana=${achado.semana}`}
              className="text-accent-strong text-xs font-medium hover:underline"
            >
              {rotuloDaSemana(parseISO(achado.semana))}
            </Link>
            <p className="text-text-primary mt-1 text-sm">{achado.trecho}</p>
            <Badge variant="outline" className="mt-2">
              {achado.origem === "entrega" ? "Entrega" : "Como foi a semana"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
