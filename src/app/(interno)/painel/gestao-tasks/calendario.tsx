"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COR_DA_PRIORIDADE, estaVencida } from "@/lib/dominio/tasks";
import type { ItemDeCalendario } from "@/lib/dados/tasks";
import { cn } from "@/lib/utils";

const SEM_FILTRO = "__todos__";
const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * Calendário de prazos.
 *
 * Mostra dois níveis no mesmo dia: o prazo da task e o de cada subtarefa. A
 * subtarefa vem com borda tracejada e um ponto menor, para ninguém confundir
 * uma etapa interna com a entrega final.
 */
export function CalendarioDeTasks({
  itens,
  equipe,
}: {
  itens: ItemDeCalendario[];
  equipe: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [referencia, setReferencia] = useState(new Date());
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [responsavel, setResponsavel] = useState(SEM_FILTRO);

  const visiveis = useMemo(
    () =>
      responsavel === SEM_FILTRO
        ? itens
        : itens.filter((item) => item.responsavel?.id === responsavel),
    [itens, responsavel],
  );

  const dias = useMemo(() => {
    if (modo === "semana") {
      const inicio = startOfWeek(referencia, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: inicio, end: addDays(inicio, 6) });
    }
    // A grade do mês começa na segunda da primeira semana e termina no domingo
    // da última, para as colunas ficarem alinhadas.
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(referencia), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(referencia), { weekStartsOn: 1 }),
    });
  }, [modo, referencia]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, ItemDeCalendario[]>();
    for (const item of visiveis) {
      mapa.set(item.prazo, [...(mapa.get(item.prazo) ?? []), item]);
    }
    return mapa;
  }, [visiveis]);

  function navegar(passo: number) {
    setReferencia((atual) =>
      modo === "semana" ? addWeeks(atual, passo) : addMonths(atual, passo),
    );
  }

  const titulo =
    modo === "semana"
      ? `${format(startOfWeek(referencia, { weekStartsOn: 1 }), "d 'de' MMM", { locale: ptBR })} – ${format(endOfWeek(referencia, { weekStartsOn: 1 }), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
      : format(referencia, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navegar(-1)} aria-label="Anterior">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navegar(1)} aria-label="Próximo">
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReferencia(new Date())}>
            Hoje
          </Button>
        </div>

        {/* first-letter, e não capitalize: este maiúsculiza cada palavra e
            produziria "Setembro De 2026". */}
        <h2 className="text-sm font-medium first-letter:uppercase">{titulo}</h2>

        <div className="ml-auto flex items-center gap-2">
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger size="sm" className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FILTRO}>Pauta de toda a equipe</SelectItem>
              {equipe.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Pauta de {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modo} onValueChange={(v) => setModo(v as "mes" | "semana")}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-7 border-b text-xs">
          {DIAS_DA_SEMANA.map((dia) => (
            <div key={dia} className="px-2 py-1.5 text-center font-medium">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const chave = format(dia, "yyyy-MM-dd");
            const doDia = porDia.get(chave) ?? [];
            const foraDoMes = modo === "mes" && !isSameMonth(dia, referencia);

            return (
              <div
                key={chave}
                className={cn(
                  "min-h-28 border-r border-b p-1.5 last:border-r-0",
                  modo === "semana" && "min-h-64",
                  foraDoMes && "bg-muted/30",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                      foraDoMes && "text-muted-foreground/60",
                      isToday(dia) && "bg-brand text-brand-foreground font-medium",
                    )}
                  >
                    {format(dia, "d")}
                  </span>
                </div>

                <ul className="space-y-1">
                  {doDia.map((item) => {
                    const vencido = !item.concluida && estaVencida(item.prazo, item.status);
                    return (
                      <li key={item.chave}>
                        <button
                          type="button"
                          onClick={() => router.push(`/painel/gestao-tasks/${item.taskId}`)}
                          title={`${item.tipo === "subtarefa" ? "Subtarefa · " : ""}${item.titulo}${item.cliente ? ` · ${item.cliente}` : ""}`}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-xs transition-colors",
                            // Subtarefa: borda tracejada, para não se confundir
                            // com a entrega final.
                            item.tipo === "subtarefa"
                              ? "border-dashed bg-transparent"
                              : "bg-card border-transparent shadow-xs",
                            vencido && "border-destructive/50 text-destructive",
                            item.concluida && "opacity-55 line-through",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "shrink-0 rounded-full",
                              item.tipo === "subtarefa" ? "size-1.5" : "size-2",
                              vencido ? "bg-destructive" : COR_DA_PRIORIDADE[item.prioridade],
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-card size-2.5 rounded-full border shadow-xs" />
          Prazo da task
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border border-dashed" />
          Prazo de subtarefa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-destructive size-2.5 rounded-full" />
          Vencido
        </span>
      </div>
    </div>
  );
}
