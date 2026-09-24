import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deslocarMes } from "@/lib/dominio/posts";
import { cn } from "@/lib/utils";

/**
 * Mês, "Hoje" e a alternância entre calendário e lista.
 *
 * Tudo por link, e não por botão com estado: o mês e a visão moram na URL,
 * então o navegador já sabe para onde ir e a seta funciona antes de qualquer
 * JavaScript carregar. É também o que faz esta barra ser componente de
 * servidor num módulo em que quase tudo é.
 *
 * `first-letter:uppercase` e não `capitalize`: o date-fns em pt-BR devolve
 * "outubro de 2026", e `capitalize` produziria "Outubro De 2026" — com o "De"
 * no meio, que é o erro que já apareceu em três telas deste projeto.
 */
export function NavegacaoDoMes({
  mes,
  mesDeHoje,
  visao,
  base,
}: {
  mes: string;
  mesDeHoje: string;
  visao: "calendario" | "lista";
  base: string;
}) {
  const href = (mudancas: Record<string, string | null>) => {
    const destino = new URLSearchParams({ mes, visao });
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) destino.delete(chave);
      else destino.set(chave, valor);
    }
    // O dia aberto não viaja: trocar de mês mantendo `?dia=` deixaria a gaveta
    // mostrando um dia que não está mais na tela.
    return `${base}/social-media?${destino.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mês anterior" asChild>
          <Link href={href({ mes: deslocarMes(mes, -1) })}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>

        <p className="text-text-primary min-w-40 text-center text-sm font-semibold first-letter:uppercase">
          {format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>

        <Button variant="outline" size="icon" aria-label="Próximo mês" asChild>
          <Link href={href({ mes: deslocarMes(mes, 1) })}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>

      {/* "Hoje" some quando já se está nele: um botão que não faz nada é um
          botão que ensina a desconfiar dos outros. */}
      {mes !== mesDeHoje ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={href({ mes: mesDeHoje })}>Hoje</Link>
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
        {(
          [
            ["calendario", "Calendário", CalendarDays],
            ["lista", "Lista", List],
          ] as const
        ).map(([chave, rotulo, Icone]) => (
          <Link
            key={chave}
            href={href({ visao: chave })}
            aria-current={visao === chave ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              visao === chave
                ? "bg-accent text-accent-foreground font-medium"
                : "text-text-muted hover:text-foreground",
            )}
          >
            <Icone aria-hidden className="size-4" />
            {rotulo}
          </Link>
        ))}
      </div>
    </div>
  );
}
