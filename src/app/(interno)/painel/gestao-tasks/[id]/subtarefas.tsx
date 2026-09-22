"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Link2, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { DateBadge } from "@/components/shared/date-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { Pessoa, SubtarefaDetalhada } from "@/lib/dados/tasks";

import { criarSubtarefa, removerSubtarefa } from "../acoes-de-itens";
import { PainelDaSubtarefa } from "./painel-da-subtarefa";

/**
 * A lista de subtarefas — o centro do detalhe da Task.
 *
 * Cada linha responde, de relance: quem faz, para quando, em que pé está, se
 * precisa passar por aprovação (o cadeado) e se está esperando outra etapa (o
 * elo). Clicar abre o painel lateral com o resto, sem trocar de página.
 *
 * Criar e apagar subtarefa é do Atendimento e da gestão. Trabalhar nela é de
 * quem é responsável — e é por isso que o botão de ação de cada linha é o
 * mesmo componente compartilhado: ele pergunta à máquina de estados, não ao
 * layout.
 */
export function Subtarefas({
  taskId,
  subtarefas,
  equipe,
  podeGerenciar,
  souGestor,
  usuarioId,
}: {
  taskId: string;
  subtarefas: SubtarefaDetalhada[];
  equipe: Pessoa[];
  /** Atendimento ou gestão: quem pode acrescentar e remover etapas. */
  podeGerenciar: boolean;
  souGestor: boolean;
  usuarioId: string;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [novo, setNovo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const concluidas = subtarefas.filter((s) => s.status === "concluida").length;
  const emAberto = subtarefas.find((s) => s.id === aberta) ?? null;

  function adicionar() {
    const titulo = novo.trim();
    if (titulo.length === 0) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() => criarSubtarefa(taskId, { titulo }));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        setNovo("");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Subtarefas</h2>
        <span className="text-muted-foreground text-xs">
          {subtarefas.length === 0
            ? "nenhuma etapa"
            : `${concluidas} de ${subtarefas.length} concluída${subtarefas.length > 1 ? "s" : ""}`}
        </span>
      </div>

      {subtarefas.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Esta demanda ainda não tem etapas. A subtarefa é a unidade de trabalho: é nela que entra
          o responsável, o prazo e a regra de aprovação.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {subtarefas.map((sub) => (
            <li key={sub.id} className="flex flex-wrap items-center gap-2 p-3">
              {podeGerenciar ? (
                <GripVertical className="text-muted-foreground/50 size-4 shrink-0" aria-hidden />
              ) : null}

              <button
                type="button"
                className="hover:text-brand min-w-0 flex-1 text-left text-sm font-medium"
                onClick={() => setAberta(sub.id)}
              >
                <span className="truncate">{sub.titulo}</span>
              </button>

              <div className="flex shrink-0 items-center gap-2">
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

                {sub.responsavel ? (
                  <UserAvatar
                    name={sub.responsavel.nome}
                    src={sub.responsavel.avatar_url}
                    size="sm"
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">sem responsável</span>
                )}

                <PriorityBadge priority={sub.prioridade} />

                {/* DateBadge é para prazo a vencer. Etapa concluída mostra a
                    data crua, senão o passado apareceria em vermelho como se
                    fosse atraso. */}
                {sub.prazo ? (
                  sub.status === "concluida" ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {sub.prazo.split("-").reverse().join("/")}
                    </span>
                  ) : (
                    <DateBadge date={sub.prazo} />
                  )
                ) : null}

                <StatusBadge status={sub.status} />

                <AcoesDaSubtarefa
                  subtarefa={sub}
                  usuarioId={usuarioId}
                  souGestor={souGestor}
                  rodadaPendenteId={sub.rodadas.find((r) => r.status === "pendente")?.id ?? null}
                />

                {podeGerenciar ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remover ${sub.titulo}`}
                    onClick={() =>
                      iniciar(async () => {
                        const resultado = await chamarAcao(() => removerSubtarefa(sub.id, taskId));
                        if (!resultado.ok) toast.error(resultado.error);
                        else router.refresh();
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {subtarefas.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Tempo somado: {formatarMinutos(somar(subtarefas, "tempo_real_minutos"))} realizado de{" "}
          {formatarMinutos(somar(subtarefas, "estimativa_minutos"))} estimado.
        </p>
      ) : null}

      {podeGerenciar ? (
        <form
          className="flex gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            adicionar();
          }}
        >
          <Input
            value={novo}
            onChange={(evento) => setNovo(evento.target.value)}
            placeholder="Nova subtarefa"
            aria-label="Título da nova subtarefa"
          />
          <Button type="submit" variant="outline" disabled={salvando || novo.trim() === ""}>
            {salvando ? <Loader2 className="animate-spin" /> : <Plus aria-hidden />}
            Adicionar
          </Button>
        </form>
      ) : null}

      {emAberto ? (
        <PainelDaSubtarefa
          subtarefa={emAberto}
          taskId={taskId}
          equipe={equipe}
          irmas={subtarefas}
          podeGerenciar={podeGerenciar}
          souGestor={souGestor}
          usuarioId={usuarioId}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </section>
  );
}

function somar(
  subtarefas: SubtarefaDetalhada[],
  campo: "tempo_real_minutos" | "estimativa_minutos",
): number | null {
  const valores = subtarefas.map((s) => s[campo]).filter((v): v is number => v !== null);
  return valores.length === 0 ? null : valores.reduce((total, v) => total + v, 0);
}
