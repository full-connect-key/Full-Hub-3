"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { parseISO } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deslocarCompetencia } from "@/lib/dominio/financeiro";
import { cn } from "@/lib/utils";

/**
 * Navegação por mês, na URL.
 *
 * O mês mora em `?mes=2026-09`, nunca em estado: o link tem que poder ser
 * colado, e um F5 no meio da conferência do fechamento não pode jogar a
 * pessoa de volta para o mês corrente.
 *
 * `first-letter:uppercase` e não `capitalize`: o date-fns em pt-BR devolve
 * "setembro de 2026", e `capitalize` produziria "Setembro De 2026" — com o
 * "De" no meio, que é o erro que já apareceu em três telas deste projeto.
 */
export function SeletorDeMes({
  competencia,
  /** A competência de hoje. Passar do mês corrente é permitido: previsão é trabalho. */
  maximo,
  className,
}: {
  competencia: string;
  maximo?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const parametros = useSearchParams();

  function href(destinoISO: string) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("mes", destinoISO.slice(0, 7));
    return `${pathname}?${destino.toString()}`;
  }

  const anterior = deslocarCompetencia(competencia, -1);
  const proximo = deslocarCompetencia(competencia, 1);
  const bloqueiaProximo = maximo !== undefined && proximo > maximo;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button variant="outline" size="icon" aria-label="Mês anterior" asChild>
        <Link href={href(anterior)}>
          <ChevronLeft aria-hidden />
        </Link>
      </Button>

      <p className="text-text-primary min-w-40 text-center text-sm font-semibold first-letter:uppercase">
        {format(parseISO(competencia), "MMMM 'de' yyyy", { locale: ptBR })}
      </p>

      {bloqueiaProximo ? (
        <Button variant="outline" size="icon" aria-label="Próximo mês" disabled>
          <ChevronRight aria-hidden />
        </Button>
      ) : (
        <Button variant="outline" size="icon" aria-label="Próximo mês" asChild>
          <Link href={href(proximo)}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}
