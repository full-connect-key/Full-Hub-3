"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CornerDownRight, ListChecks, Lock, Link2 } from "lucide-react";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { DateBadge } from "@/components/shared/date-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { situacaoDoPrazo } from "@/lib/dominio/tasks";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import { cn } from "@/lib/utils";

import type { LinhaPessoal } from "./linhas";

/**
 * Lista de Minhas Tasks.
 *
 * Cada demanda aparece uma vez, como cabeçalho, e abaixo dela vêm as etapas: as
 * minhas em destaque, com o botão da vez, e as dos outros em cinza — ver que a
 * arte ainda não saiu é o que explica por que o agendamento está parado.
 *
 * O botão de cada etapa sai de `AcoesDaSubtarefa`, o mesmo componente do
 * detalhe da Task e da fila de aprovações. Por isso "Concluir" nunca aparece
 * numa etapa que exige aprovação, e "Enviar para o cliente" nunca aparece aqui
 * — esse botão é do Desenvolvedor, na fila dele.
 */
export function MinhaLista({
  linhas,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
}: {
  linhas: LinhaPessoal[];
  prazos: { hoje: string; fimDaSemana: string };
  usuarioId: string;
  souGestor: boolean;
  aoAbrir: (taskId: string) => void;
}) {
  if (linhas.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nada por aqui"
        description="Nenhuma subtarefa sua com este filtro. Troque o foco no cabeçalho para ver o resto."
      />
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {linhas.map((linha) => {
        if (linha.tipo === "task") {
          return (
            <div key={linha.chave} className="bg-muted/40 flex flex-wrap items-center gap-2 p-3">
              <button
                type="button"
                className="hover:text-accent-strong text-left text-sm font-semibold"
                onClick={() => aoAbrir(linha.taskId)}
              >
                {linha.titulo}
              </button>
              {linha.cliente ? <Badge variant="outline">{linha.cliente}</Badge> : null}
              <StatusBadge status={linha.status} />
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {format(parseISO(linha.dataInicio), "dd/MM", { locale: ptBR })}
                {linha.dataFim
                  ? ` → ${format(parseISO(linha.dataFim), "dd/MM", { locale: ptBR })}`
                  : ""}
                {" · "}
                {linha.subtarefasConcluidas} de {linha.subtarefasTotal} concluída
                {linha.subtarefasTotal === 1 ? "" : "s"}
                {" · "}
                {linha.minhasQuantas} minha{linha.minhasQuantas === 1 ? "" : "s"}
              </span>
            </div>
          );
        }

        if (linha.tipo === "outra") {
          return (
            <div
              key={linha.chave}
              className="text-muted-foreground flex items-center gap-2 py-2 pr-3 pl-10 text-sm"
            >
              <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{linha.titulo}</span>
              {linha.responsavel ? (
                <UserAvatar
                  name={linha.responsavel.nome}
                  src={linha.responsavel.avatar_url}
                  size="sm"
                />
              ) : null}
              <StatusBadge status={linha.status} />
            </div>
          );
        }

        const sub = linha.subtarefa;
        const situacao = situacaoDoPrazo(
          sub.prazo,
          sub.status === "concluida",
          prazos.hoje,
          prazos.fimDaSemana,
        );

        return (
          <div
            key={linha.chave}
            className={cn(
              "flex flex-wrap items-center gap-2 py-2.5 pr-3 pl-10",
              situacao === "atrasada" && "bg-destructive/5",
            )}
          >
            <CornerDownRight className="text-accent-strong size-3.5 shrink-0" aria-hidden />

            <button
              type="button"
              className="hover:text-accent-strong min-w-0 flex-1 truncate text-left text-sm font-medium"
              onClick={() => aoAbrir(linha.taskId)}
            >
              {sub.titulo}
            </button>

            {sub.requer_aprovacao ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex">
                    <Lock className="size-3.5" aria-label="Exige aprovação" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Exige aprovação {ROTULO_DA_APROVACAO[sub.tipo_aprovacao ?? "interna"]}
                </TooltipContent>
              </Tooltip>
            ) : null}

            {sub.dependenciasAbertas.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-warning inline-flex">
                    <Link2 className="size-3.5" aria-label="Aguardando outra etapa" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Aguardando: {sub.dependenciasAbertas.join(", ")}</TooltipContent>
              </Tooltip>
            ) : null}

            <PriorityBadge priority={sub.prioridade} />

            {/* DateBadge é para prazo a vencer; etapa concluída mostra a data
                crua, senão o passado apareceria em vermelho como atraso. */}
            {sub.prazo ? (
              sub.status === "concluida" ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {format(parseISO(sub.prazo), "dd/MM/yy", { locale: ptBR })}
                </span>
              ) : (
                <DateBadge date={sub.prazo} />
              )
            ) : (
              <span className="text-muted-foreground text-xs">Sem prazo</span>
            )}

            <StatusBadge status={sub.status} />

            <AcoesDaSubtarefa
              subtarefa={sub}
              usuarioId={usuarioId}
              souGestor={souGestor}
              rodadaPendenteId={sub.rodadas.find((r) => r.status === "pendente")?.id ?? null}
            />
          </div>
        );
      })}
    </div>
  );
}
