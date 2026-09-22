"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, CornerDownRight, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { DialogoDeTempo } from "@/components/shared/dialogo-de-tempo";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import { cn } from "@/lib/utils";

import { atualizarTask } from "../gestao-tasks/acoes";
import { atualizarSubtarefa } from "../gestao-tasks/acoes-de-itens";

/**
 * Meu dia.
 *
 * A primeira coisa que a pessoa lê ao abrir a tela, e a resposta para "o que
 * eu entrego hoje?". Só o que vence hoje e o que já passou do prazo — nada de
 * "esta semana" aqui, senão a lista cresce e deixa de ser uma decisão rápida.
 *
 * Fica num componente separado de propósito: a Home do Sprint 15 vai mostrar
 * o mesmo bloco, alimentado pela mesma função `meuDia()`.
 */
export function MeuDia({ itens, primeiroNome }: { itens: ItemDoDia[]; primeiroNome: string }) {
  const router = useRouter();
  const [concluindo, setConcluindo] = useState<ItemDoDia | null>(null);

  async function concluir(horas: number | null): Promise<boolean> {
    const item = concluindo;
    if (!item) return false;

    const campos: Record<string, unknown> =
      item.tipo === "task" ? { status: "concluida" } : { concluida: true };
    if (horas !== null) campos.tempo_real_horas = horas;

    const resultado = await chamarAcao(() =>
      item.tipo === "task"
        ? atualizarTask(item.id, campos)
        : atualizarSubtarefa(item.id, item.taskId, campos),
    );

    if (!resultado.ok) {
      toast.error(resultado.error);
      return false;
    }
    toast.success("Feito. Menos uma para hoje.");
    router.refresh();
    return true;
  }

  const atrasadas = itens.filter((item) => item.atrasada).length;

  return (
    <section className="rounded-xl border">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Meu dia</h2>
        {atrasadas > 0 ? (
          <Badge variant="destructive">
            {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
          </Badge>
        ) : null}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {itens.length} entrega{itens.length === 1 ? "" : "s"}
        </span>
      </header>

      {itens.length === 0 ? (
        <div className="p-2">
          <EmptyState
            icon={PartyPopper}
            title={`Dia limpo, ${primeiroNome}`}
            description="Nada vence hoje e nada está atrasado no seu nome. Bom momento para adiantar o que vem pela frente."
          />
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <li key={item.chave} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.atrasada ? "bg-destructive" : "bg-warning",
                )}
              />

              <div className="min-w-0 flex-1">
                {item.tituloDaMae ? (
                  <p className="text-muted-foreground truncate text-xs">{item.tituloDaMae}</p>
                ) : null}
                <p className="flex items-center gap-1.5 truncate text-sm">
                  {item.tipo === "subtarefa" ? (
                    <CornerDownRight
                      aria-hidden
                      className="text-muted-foreground size-3.5 shrink-0"
                    />
                  ) : null}
                  {item.titulo}
                </p>
              </div>

              {item.cliente ? (
                <Badge variant="outline" className="max-w-40 truncate">
                  {item.cliente}
                </Badge>
              ) : null}

              <span
                className={cn(
                  "text-xs tabular-nums",
                  item.atrasada ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {item.atrasada && item.prazo
                  ? `venceu ${format(parseISO(item.prazo), "dd/MM/yy", { locale: ptBR })}`
                  : "hoje"}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setConcluindo(item)}
                aria-label={`Concluir ${item.titulo}`}
              >
                <CheckCircle2 aria-hidden />
                Concluir
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DialogoDeTempo
        aberto={concluindo !== null}
        aoFechar={() => setConcluindo(null)}
        titulo={concluindo?.tipo === "task" ? "Concluir esta task" : "Concluir esta subtarefa"}
        sugestao={concluindo?.estimativa ?? null}
        origemDaSugestao={
          concluindo?.estimativa ? `A estimativa era de ${concluindo.estimativa}h.` : undefined
        }
        aoConcluir={concluir}
      />
    </section>
  );
}
