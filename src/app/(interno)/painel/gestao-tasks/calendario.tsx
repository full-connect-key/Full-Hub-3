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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROTULOS_DE_PRIORIDADE,
  corDoPrazo,
  situacaoDoPrazo,
} from "@/lib/dominio/tasks";
import type { ItemDeCalendario } from "@/lib/dados/tasks";
import { cn } from "@/lib/utils";

const SEM_FILTRO = "__todos__";
const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * Calendário de prazos.
 *
 * Mostra dois níveis no mesmo dia: o fim do período da demanda e o prazo de
 * cada subtarefa. A
 * subtarefa vem com borda tracejada e o rótulo "Etapa", para ninguém confundir
 * um passo interno com a entrega final.
 *
 * A pergunta que ele tem de responder de relance é "o que entrega em que dia".
 * Por isso cada item traz três coisas fixas: a barra colorida pela SITUAÇÃO do
 * prazo (e não pela prioridade — o que aperta é a data), o rótulo Demanda ou
 * Etapa, e o chip do cliente. A legenda no rodapé fecha a leitura.
 */
export function CalendarioDeTasks({
  itens,
  equipe,
  prazos,
  aoAbrir,
}: {
  itens: ItemDeCalendario[];
  equipe: { id: string; nome: string }[];
  /** Régua de datas calculada no servidor, para não classificar por fuso. */
  prazos: { hoje: string; fimDaSemana: string };
  /** Quando existe, o item abre isto em vez de navegar para a página. */
  aoAbrir?: (taskId: string) => void;
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => navegar(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navegar(1)}
            aria-label="Próximo"
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReferencia(new Date())}
          >
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

          <Select
            value={modo}
            onValueChange={(v) => setModo(v as "mes" | "semana")}
          >
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
                  "min-h-32 border-r border-b p-1.5 last:border-r-0",
                  modo === "semana" && "min-h-64",
                  foraDoMes && "bg-muted/30",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                      foraDoMes && "text-muted-foreground/60",
                      isToday(dia) &&
                        "bg-brand text-brand-foreground font-medium",
                    )}
                  >
                    {format(dia, "d")}
                  </span>
                </div>

                <ul className="space-y-1">
                  {doDia.map((item) => {
                    const situacao = situacaoDoPrazo(
                      item.prazo,
                      item.concluida,
                      prazos.hoje,
                      prazos.fimDaSemana,
                    );
                    const cor = corDoPrazo(situacao, item.prioridade);
                    // A linha da Task marca o FIM DO PERÍODO da demanda; a da subtarefa,
                    // o prazo de uma etapa; a do post, o dia em que ele vai ao
                    // ar. São três coisas diferentes e o rótulo diz qual é.
                    const rotulo =
                      item.tipo === "task"
                        ? "Demanda"
                        : item.tipo === "post"
                          ? "Post"
                          : "Etapa";

                    return (
                      <li key={item.chave}>
                        <button
                          type="button"
                          onClick={() =>
                            // O post tem destino próprio e não abre o painel
                            // lateral de demanda: ele não é uma, e o painel
                            // mostraria campos que ele não tem.
                            item.href
                              ? router.push(item.href)
                              : aoAbrir
                                ? aoAbrir(item.taskId)
                                : router.push(
                                    `/painel/gestao-tasks/${item.taskId}`,
                                  )
                          }
                          title={`${rotulo}: ${item.titulo}${item.cliente ? ` · ${item.cliente}` : ""} · prioridade ${ROTULOS_DE_PRIORIDADE[item.prioridade].toLowerCase()}`}
                          className={cn(
                            "relative w-full overflow-hidden rounded border py-1 pr-1.5 pl-2.5 text-left text-xs transition-colors",
                            item.tipo === "subtarefa"
                              ? "border-dashed bg-transparent"
                              : "bg-card border-transparent shadow-xs",
                            item.tipo === "post" &&
                              "border-border border-dotted",
                            situacao === "atrasada" && "border-destructive/50",
                            item.concluida && "opacity-55",
                          )}
                        >
                          {/* A barra é o que se lê de longe: cor da situação. */}
                          <span
                            aria-hidden
                            className={cn("absolute inset-y-0 left-0 w-1", cor)}
                          />

                          <span className="flex items-baseline gap-1">
                            <span
                              className={cn(
                                "shrink-0 text-[10px] font-medium uppercase",
                                situacao === "atrasada"
                                  ? "text-destructive"
                                  : situacao === "hoje"
                                    ? "text-warning"
                                    : "text-muted-foreground",
                              )}
                            >
                              {rotulo}
                            </span>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate",
                                item.concluida && "line-through",
                              )}
                            >
                              {item.titulo}
                            </span>
                          </span>

                          {item.cliente ? (
                            <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
                              {item.cliente}
                            </span>
                          ) : null}
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

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs">
        <span className="font-medium">Legenda</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-destructive h-3 w-1 rounded-full" />
          Vencido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-warning h-3 w-1 rounded-full" />
          Vence hoje
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-info h-3 w-1 rounded-full" />
          Esta semana
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-muted-foreground/40 h-3 w-1 rounded-full"
          />
          Concluído
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="bg-card size-2.5 rounded border shadow-xs"
          />
          <span className="text-[10px] font-medium uppercase">Demanda</span> =
          fim do período da task
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded border border-dashed" />
          <span className="text-[10px] font-medium uppercase">Etapa</span> =
          prazo de subtarefa
        </span>
        <span className="opacity-80">
          Mais adiante no tempo, a barra usa a cor da prioridade.
        </span>
      </div>
    </div>
  );
}
