"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DateBadge } from "@/components/shared/date-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pessoa } from "@/lib/dados/tasks";
import type { Subtask } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  atualizarSubtarefa,
  criarSubtarefa,
  removerSubtarefa,
  reordenarSubtarefas,
} from "../acoes-de-itens";

const SEM_VALOR = "__nenhum__";

type SubtarefaCompleta = Subtask & { responsavel: Pessoa | null };

function Linha({
  subtarefa,
  taskId,
  equipe,
  podeEditar,
}: {
  subtarefa: SubtarefaCompleta;
  taskId: string;
  equipe: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtarefa.id,
  });
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [titulo, setTitulo] = useState(subtarefa.titulo);
  const [editandoPrazo, setEditandoPrazo] = useState(false);

  function salvar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await atualizarSubtarefa(subtarefa.id, taskId, campos);
      if (resultado.erro) toast.error(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card flex flex-wrap items-center gap-2 border-b p-2 last:border-0",
        isDragging && "opacity-60",
      )}
    >
      {podeEditar ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reordenar subtarefa"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}

      <input
        type="checkbox"
        aria-label={`Concluir ${subtarefa.titulo}`}
        checked={subtarefa.concluida}
        disabled={!podeEditar}
        onChange={(e) => salvar({ concluida: e.target.checked })}
        className="accent-brand size-4"
      />

      <Input
        value={titulo}
        disabled={!podeEditar}
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== subtarefa.titulo && salvar({ titulo })}
        className={cn(
          "h-8 min-w-40 flex-1 border-transparent bg-transparent px-1.5 shadow-none",
          subtarefa.concluida && "text-muted-foreground line-through",
        )}
      />

      <Select
        value={subtarefa.responsavel_id ?? SEM_VALOR}
        disabled={!podeEditar}
        onValueChange={(v) => salvar({ responsavel_id: v === SEM_VALOR ? null : v })}
      >
        <SelectTrigger size="sm" className="w-40 border-transparent shadow-none">
          <SelectValue placeholder="Sem responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_VALOR}>Sem responsável</SelectItem>
          {equipe.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {editandoPrazo && podeEditar ? (
        <Input
          type="date"
          autoFocus
          defaultValue={subtarefa.prazo ?? ""}
          className="h-8 w-36"
          onBlur={(e) => {
            setEditandoPrazo(false);
            if (e.target.value !== (subtarefa.prazo ?? "")) salvar({ prazo: e.target.value || null });
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => podeEditar && setEditandoPrazo(true)}
          className="min-w-24"
          title="Prazo próprio da subtarefa"
        >
          {subtarefa.prazo ? (
            // Concluída não tem prazo "a vencer": o âmbar ali pediria atenção
            // para algo que já foi entregue.
            subtarefa.concluida ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {subtarefa.prazo.split("-").reverse().join("/")}
              </span>
            ) : (
              <DateBadge date={subtarefa.prazo} />
            )
          ) : (
            <span className="text-muted-foreground text-xs">Sem prazo</span>
          )}
        </button>
      )}

      <Input
        type="number"
        min={0}
        step="0.5"
        disabled={!podeEditar}
        defaultValue={subtarefa.estimativa_horas ?? ""}
        placeholder="h"
        className="h-8 w-16 border-transparent bg-transparent px-1.5 text-right shadow-none"
        onBlur={(e) => {
          const valor = e.target.value === "" ? null : Number(e.target.value);
          if (valor !== subtarefa.estimativa_horas) salvar({ estimativa_horas: valor });
        }}
      />

      {podeEditar ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Remover ${subtarefa.titulo}`}
          onClick={() =>
            iniciar(async () => {
              const resultado = await removerSubtarefa(subtarefa.id, taskId);
              if (resultado.erro) toast.error(resultado.erro);
              else router.refresh();
            })
          }
        >
          <Trash2 aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

export function Subtarefas({
  taskId,
  subtarefas,
  equipe,
  podeEditar,
}: {
  taskId: string;
  subtarefas: SubtarefaCompleta[];
  equipe: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [ordem, setOrdem] = useState(subtarefas.map((s) => s.id));
  const [novoTitulo, setNovoTitulo] = useState("");
  const [, iniciar] = useTransition();

  // A ordem vem do servidor; quando a lista muda (item criado ou removido), a
  // ordem local acompanha. O ajuste acontece durante a renderização, e não num
  // efeito: assim não há um quadro intermediário com a ordem antiga na tela.
  const assinatura = subtarefas.map((s) => s.id).join(",");
  const [assinaturaAnterior, setAssinaturaAnterior] = useState(assinatura);
  if (assinaturaAnterior !== assinatura) {
    setAssinaturaAnterior(assinatura);
    setOrdem(assinatura ? assinatura.split(",") : []);
  }

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const porId = new Map(subtarefas.map((s) => [s.id, s]));
  const emOrdem = ordem.map((id) => porId.get(id)).filter(Boolean) as SubtarefaCompleta[];

  const concluidas = subtarefas.filter((s) => s.concluida).length;

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const de = ordem.indexOf(String(active.id));
    const para = ordem.indexOf(String(over.id));
    const nova = [...ordem];
    nova.splice(para, 0, ...nova.splice(de, 1));
    setOrdem(nova);

    iniciar(async () => {
      const resultado = await reordenarSubtarefas(taskId, nova);
      if (resultado.erro) {
        setOrdem(ordem);
        toast.error(resultado.erro);
      }
    });
  }

  function adicionar() {
    if (novoTitulo.trim().length === 0) return;
    iniciar(async () => {
      const resultado = await criarSubtarefa(taskId, novoTitulo);
      if (resultado.erro) toast.error(resultado.erro);
      else {
        setNovoTitulo("");
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Subtarefas{" "}
          {subtarefas.length > 0 ? (
            <span className="text-muted-foreground font-normal tabular-nums">
              {concluidas}/{subtarefas.length}
            </span>
          ) : null}
        </h2>
      </div>

      {subtarefas.length > 0 ? (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
            <ul className="overflow-hidden rounded-lg border">
              {emOrdem.map((subtarefa) => (
                <Linha
                  key={subtarefa.id}
                  subtarefa={subtarefa}
                  taskId={taskId}
                  equipe={equipe}
                  podeEditar={podeEditar}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhuma subtarefa. Cada uma tem prazo próprio e aparece no calendário no dia dela.
        </p>
      )}

      {podeEditar ? (
        <div className="flex gap-2">
          <Input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder="Nova subtarefa e Enter"
            className="h-9"
          />
          <Button variant="outline" onClick={adicionar} disabled={novoTitulo.trim().length === 0}>
            <Plus aria-hidden />
            Adicionar
          </Button>
        </div>
      ) : null}
    </section>
  );
}
