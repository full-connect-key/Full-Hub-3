"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ListChecks, Lock, Link2 } from "lucide-react";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { Cronometro } from "@/components/shared/cronometro";
import { DateBadge } from "@/components/shared/date-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { situacaoDoPrazo } from "@/lib/dominio/tasks";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import { cn } from "@/lib/utils";

import type { Prazos } from "@/lib/dados/minhas-tasks";

import type { LinhaPessoal } from "./linhas";

/**
 * Lista de Minhas Tasks — uma linha por ETAPA minha.
 *
 * "Conteúdo" e "Layout" da mesma demanda são dois itens, porque são dois
 * trabalhos com dois prazos que eu faço em dois momentos. A demanda vira a
 * linhagem embaixo do título, e clicar abre o painel com ela inteira: é lá
 * que se vê que as duas são da mesma mãe e o que as outras pessoas estão
 * fazendo nela.
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
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir: (taskId: string) => void;
}) {
  if (linhas.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nada por aqui"
        description="Nenhuma etapa sua com este filtro. Troque o foco no cabeçalho para ver o resto."
      />
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {linhas.map((linha) => {
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
              "flex flex-wrap items-center gap-2 p-3",
              situacao === "atrasada" && "bg-destructive/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="hover:text-accent-strong block max-w-full truncate text-left text-sm font-medium"
                onClick={() => aoAbrir(linha.taskId)}
              >
                {sub.titulo}
              </button>

              {/* A LINHAGEM, e não uma linha de cabeçalho por demanda: ela
                  responde "por que estou fazendo isto?" sem gastar uma linha
                  inteira da lista, e clicar abre a demanda completa, onde se
                  vê as etapas das outras pessoas. */}
              <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
                {linha.demanda.cliente ? (
                  <>
                    <span className="truncate">{linha.demanda.cliente}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span className="truncate">{linha.demanda.titulo}</span>
                {sub.etapaDeCima ? (
                  <>
                    <ChevronRight aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{sub.etapaDeCima}</span>
                  </>
                ) : null}
                {linha.demanda.minhas > 1 ? (
                  <span className="shrink-0">
                    {" "}
                    · {linha.demanda.minhas} etapas minhas aqui
                  </span>
                ) : null}
              </p>
            </div>

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

            {/* O relógio corre enquanto a etapa está em andamento. Fica à
                vista para a pessoa reparar que esqueceu a etapa aberta — é o
                que impede o número de chegar pronto e estranho no diálogo de
                conclusão. */}
            <Cronometro dados={sub} agoraDoServidor={prazos.agora} />

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
