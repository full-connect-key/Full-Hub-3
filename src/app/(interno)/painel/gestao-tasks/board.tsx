"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";

import { DateBadge } from "@/components/shared/date-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { COR_DA_PRIORIDADE, estaVencida, type ColunaDoBoard } from "@/lib/dominio/tasks";
import type { TaskDaLista } from "@/lib/dados/tasks";
import type { TaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { atualizarTask } from "./acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

/**
 * Board no estilo kanban.
 *
 * As colunas chegam por parâmetro, e não de uma lista fixa aqui dentro: neste
 * sprint elas são os status, e no Sprint 5 passam a ser as etapas do fluxo de
 * cada cliente. O componente não precisa saber a diferença.
 *
 * O mesmo vale para o que acontece ao clicar e ao arrastar: a Gestão de Tasks
 * abre a página do detalhe, Minhas Tasks abre o painel lateral, e lá um card
 * de task alheia não pode ser arrastado. Tudo por parâmetro — um board só.
 */

function Card({
  task,
  arrastando,
  marcador,
}: {
  task: TaskDaLista;
  arrastando?: boolean;
  marcador?: ReactNode;
}) {
  const vencida = estaVencida(task.prazo, task.status);
  const encerrada = task.status === "concluida" || task.status === "cancelada";

  return (
    <article
      className={cn(
        "bg-card relative overflow-hidden rounded-lg border p-3 shadow-xs",
        vencida && "border-destructive/40",
        arrastando && "opacity-60",
      )}
    >
      {/* Faixa de prioridade: dá para varrer a coluna sem ler os selos. */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", COR_DA_PRIORIDADE[task.prioridade])}
      />

      <div className="space-y-2 pl-2">
        <p className="text-sm leading-snug font-medium">{task.titulo}</p>

        {marcador}

        {task.cliente ? (
          <Badge variant="outline" className="max-w-full truncate">
            {task.cliente.nome_empresa}
          </Badge>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={task.prioridade} />
          {task.prazo ? (
            // DateBadge é para prazo a vencer. Numa task encerrada ele pintaria
            // de vermelho uma data que já foi cumprida, como se fosse atraso.
            encerrada ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {format(parseISO(task.prazo), "dd/MM/yy", { locale: ptBR })}
              </span>
            ) : (
              <DateBadge date={task.prazo} />
            )
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          {task.subtarefasTotal > 0 ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
              <ListChecks aria-hidden className="size-3.5" />
              {task.subtarefasConcluidas}/{task.subtarefasTotal}
            </span>
          ) : (
            <span />
          )}
          {task.responsavel ? (
            <UserAvatar
              name={task.responsavel.nome}
              src={task.responsavel.avatar_url}
              size="sm"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CardArrastavel({
  task,
  aoAbrir,
  arrastavel,
  marcador,
}: {
  task: TaskDaLista;
  aoAbrir?: (taskId: string) => void;
  arrastavel: boolean;
  marcador?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !arrastavel,
  });

  const conteudo = <Card task={task} arrastando={isDragging} marcador={marcador} />;

  return (
    <div
      ref={setNodeRef}
      {...(arrastavel ? attributes : {})}
      {...(arrastavel ? listeners : {})}
      className={cn("touch-none", !arrastavel && "cursor-default")}
    >
      {aoAbrir ? (
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            if (!isDragging) aoAbrir(task.id);
          }}
        >
          {conteudo}
        </button>
      ) : (
        <Link
          href={`/painel/gestao-tasks/${task.id}`}
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {conteudo}
        </Link>
      )}
    </div>
  );
}

function Coluna({
  coluna,
  tasks,
  aoAbrir,
  podeArrastar,
  marcador,
}: {
  coluna: ColunaDoBoard;
  tasks: TaskDaLista[];
  aoAbrir?: (taskId: string) => void;
  podeArrastar: (task: TaskDaLista) => boolean;
  marcador?: (task: TaskDaLista) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-xl border transition-colors",
        isOver && "border-brand bg-brand/5",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <h3 className="text-sm font-medium">{coluna.titulo}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{tasks.length}</span>
      </header>

      <div className="flex max-h-[calc(100dvh-20rem)] flex-col gap-2 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">Nada aqui.</p>
        ) : (
          tasks.map((task) => (
            <CardArrastavel
              key={task.id}
              task={task}
              aoAbrir={aoAbrir}
              arrastavel={podeArrastar(task)}
              marcador={marcador?.(task)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function BoardDeTasks({
  tasks,
  colunas,
  aoAbrir,
  podeArrastar = () => true,
  marcador,
}: {
  tasks: TaskDaLista[];
  colunas: ColunaDoBoard[];
  /** Quando existe, o card abre isto em vez de navegar para a página. */
  aoAbrir?: (taskId: string) => void;
  /** Card que não passa aqui fica parado — é o caso da task de outra pessoa. */
  podeArrastar?: (task: TaskDaLista) => boolean;
  marcador?: (task: TaskDaLista) => ReactNode;
}) {
  const router = useRouter();
  const [arrastando, setArrastando] = useState<string | null>(null);
  // Cópia local para a atualização otimista: o card muda de coluna na hora, e
  // volta sozinho se o banco recusar.
  const [otimistas, setOtimistas] = useState<Record<string, TaskStatus>>({});

  const sensores = useSensors(
    // Só começa a arrastar depois de 6px: sem isso, um clique para abrir a
    // task viraria um arrasto acidental.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const comStatusAtual = useMemo(
    () => tasks.map((task) => ({ ...task, status: otimistas[task.id] ?? task.status })),
    [otimistas, tasks],
  );

  const porColuna = useMemo(() => {
    const mapa = new Map<string, TaskDaLista[]>();
    for (const coluna of colunas) {
      mapa.set(
        coluna.id,
        comStatusAtual.filter((task) => task.status === coluna.status),
      );
    }
    return mapa;
  }, [colunas, comStatusAtual]);

  const taskArrastada = comStatusAtual.find((task) => task.id === arrastando) ?? null;

  function aoComecar(evento: DragStartEvent) {
    setArrastando(String(evento.active.id));
  }

  async function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    const id = String(evento.active.id);
    const colunaDestino = evento.over ? String(evento.over.id) : null;
    if (!colunaDestino) return;

    const coluna = colunas.find((c) => c.id === colunaDestino);
    const original = tasks.find((t) => t.id === id);
    if (!coluna || !original) return;

    const statusAnterior = otimistas[id] ?? original.status;
    if (statusAnterior === coluna.status) return;

    setOtimistas((atual) => ({ ...atual, [id]: coluna.status }));

    const resultado = await chamarAcao(() => atualizarTask(id, { status: coluna.status }));

    if (!resultado.ok) {
      // Rollback: devolve o card para onde estava e avisa.
      setOtimistas((atual) => ({ ...atual, [id]: statusAnterior }));
      toast.error(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <DndContext sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <Coluna
            key={coluna.id}
            coluna={coluna}
            tasks={porColuna.get(coluna.id) ?? []}
            aoAbrir={aoAbrir}
            podeArrastar={podeArrastar}
            marcador={marcador}
          />
        ))}
      </div>

      <DragOverlay>{taskArrastada ? <Card task={taskArrastada} /> : null}</DragOverlay>
    </DndContext>
  );
}
