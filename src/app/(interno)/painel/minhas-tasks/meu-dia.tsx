"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CornerDownRight, Lock, PartyPopper } from "lucide-react";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import { cn } from "@/lib/utils";

/**
 * Meu dia.
 *
 * A primeira coisa que a pessoa lê ao abrir a tela, e a resposta para "o que
 * eu entrego hoje?". Só o que vence hoje e o que já passou do prazo — nada de
 * "esta semana" aqui, senão a lista cresce e deixa de ser uma decisão rápida.
 *
 * São subtarefas, sempre: é a unidade de trabalho, e é o que a pessoa
 * efetivamente entrega. O botão de cada linha vem da máquina de estados — o
 * que exige aprovação mostra "Enviar para aprovação", não "Concluir".
 *
 * Fica num componente separado de propósito: a Home do Sprint 15 vai mostrar
 * o mesmo bloco, alimentado pela mesma função `meuDia()`.
 */
export function MeuDia({
  itens,
  primeiroNome,
  usuarioId,
  souGestor,
}: {
  itens: ItemDoDia[];
  primeiroNome: string;
  usuarioId: string;
  souGestor: boolean;
}) {
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
                <p className="text-muted-foreground truncate text-xs">{item.tituloDaMae}</p>
                <p className="flex items-center gap-1.5 truncate text-sm">
                  <CornerDownRight aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                  {item.titulo}
                  {item.requerAprovacao ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground inline-flex">
                          <Lock className="size-3.5" aria-label="Exige aprovação" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Exige aprovação {ROTULO_DA_APROVACAO[item.tipoAprovacao ?? "interna"]}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
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

              <AcoesDaSubtarefa
                subtarefa={{
                  id: item.id,
                  task_id: item.taskId,
                  titulo: item.titulo,
                  status: item.status,
                  responsavel_id: usuarioId,
                  requer_aprovacao: item.requerAprovacao,
                  tipo_aprovacao: item.tipoAprovacao,
                  estimativa_minutos: item.estimativaMinutos,
                  dependenciasAbertas: item.dependenciasAbertas,
                  rodadaPendente: false,
                  avalInterno: false,
                  avalFinal: false,
                  enviadaAoCliente: false,
                }}
                usuarioId={usuarioId}
                souGestor={souGestor}
              />
            </li>
          ))}
        </ul>
      )}

    </section>
  );
}
