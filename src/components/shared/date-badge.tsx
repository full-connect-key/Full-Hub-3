import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Data com destaque automático pelo quanto falta:
 *
 *   vencida           vermelho
 *   hoje ou amanhã    âmbar
 *   depois disso      neutro
 *
 * Toda exibição de PRAZO no projeto passa por aqui. Assim "vence hoje" tem a
 * mesma cara na lista de tasks, no calendário e na aprovação de conteúdo.
 *
 * Não use para data que só registra quando algo aconteceu -- admissão,
 * cadastro, último acesso. Passado, nesses casos, é o normal, e o vermelho
 * diria que há algo errado onde não há. Para essas, formate com date-fns.
 */

export type ToneDeData = "vencida" | "proxima" | "neutra";

function paraData(valor: string | Date): Date | null {
  const data = typeof valor === "string" ? parseISO(valor) : valor;
  return isValid(data) ? data : null;
}

/** Exportada para as telas ordenarem ou filtrarem pelo mesmo critério visual. */
export function toneDaData(valor: string | Date, referencia = new Date()): ToneDeData {
  const data = paraData(valor);
  if (!data) return "neutra";
  const dias = differenceInCalendarDays(data, referencia);
  if (dias < 0) return "vencida";
  if (dias <= 1) return "proxima";
  return "neutra";
}

const TONS: Record<ToneDeData, string> = {
  vencida: "bg-danger-soft text-danger border-transparent",
  proxima: "bg-warning-soft text-warning border-transparent",
  neutra: "bg-transparent text-muted-foreground border-border",
};

function textoRelativo(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  return `em ${dias} dias`;
}

export function DateBadge({
  date,
  showIcon = false,
  className,
}: {
  date: string | Date;
  showIcon?: boolean;
  className?: string;
}) {
  const data = paraData(date);

  if (!data) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const dias = differenceInCalendarDays(data, new Date());
  const tone = toneDaData(data);
  const completa = format(data, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <span
      title={`${completa} (${textoRelativo(dias)})`}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
        TONS[tone],
        className,
      )}
    >
      {showIcon ? <CalendarClock aria-hidden className="size-3" /> : null}
      {format(data, "dd/MM/yy", { locale: ptBR })}
      {tone !== "neutra" ? (
        <span className="font-normal">· {textoRelativo(dias)}</span>
      ) : null}
    </span>
  );
}
