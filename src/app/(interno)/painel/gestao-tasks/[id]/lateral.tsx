"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { DateBadge } from "@/components/shared/date-badge";
import { DialogoDeTempo } from "@/components/shared/dialogo-de-tempo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskCompleta } from "@/lib/dados/tasks";
import {
  PRIORIDADES,
  ROTULOS_DE_PRIORIDADE,
  ROTULOS_DE_STATUS,
  STATUS_DE_TASK,
} from "@/lib/dominio/tasks";
import type { TaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { atualizarTask } from "../acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

const SEM_VALOR = "__nenhum__";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{rotulo}</Label>
      {children}
    </div>
  );
}

/**
 * Coluna lateral do detalhe.
 *
 * Ao mover para concluída, abre o diálogo pedindo o Tempo Real, já sugerindo a
 * soma das subtarefas. Dá para pular: travar a conclusão por causa de um
 * número faria a equipe deixar a task aberta, que é pior.
 */
export function LateralDaTask({
  task,
  equipe,
  clientes,
  podeEditar,
  podeGerenciar = podeEditar,
}: {
  task: TaskCompleta;
  equipe: { id: string; nome: string }[];
  clientes: { id: string; nome_empresa: string }[];
  /** Status, prioridade, estimativa e tempo real: quem é responsável. */
  podeEditar: boolean;
  /**
   * Cliente, responsável e prazo da task-mãe: só quem gerencia.
   *
   * Quem apenas executa toca no próprio andamento, não em quem entrega nem
   * em quando. Sem esta separação, o responsável poderia empurrar o próprio
   * prazo — e o combinado com o cliente deixaria de valer. Por padrão segue
   * `podeEditar`, que é o comportamento da Gestão de Tasks.
   */
  podeGerenciar?: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [perguntandoTempo, setPerguntandoTempo] = useState(false);

  const somaDasSubtarefas = task.subtarefas.reduce(
    (total, sub) => total + (sub.tempo_real_horas ?? sub.estimativa_horas ?? 0),
    0,
  );

  const estourou =
    task.estimativa_horas !== null &&
    task.tempo_real_horas !== null &&
    task.tempo_real_horas > task.estimativa_horas;

  function salvar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => atualizarTask(task.id, campos));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  const sugestaoDeTempo =
    task.tempo_real_horas ?? (somaDasSubtarefas > 0 ? somaDasSubtarefas : task.estimativa_horas);

  function mudarStatus(novo: TaskStatus) {
    if (novo === "concluida") {
      setPerguntandoTempo(true);
      return;
    }
    salvar({ status: novo });
  }

  async function concluir(horas: number | null): Promise<boolean> {
    const campos: Record<string, unknown> = { status: "concluida" };
    if (horas !== null) campos.tempo_real_horas = horas;

    const resultado = await chamarAcao(() => atualizarTask(task.id, campos));
    if (!resultado.ok) {
      toast.error(resultado.error);
      return false;
    }
    toast.success("Task concluída.");
    router.refresh();
    return true;
  }

  return (
    <>
      <aside className="space-y-4 rounded-xl border p-4">
        <Campo rotulo="Cliente">
          <Select
            value={task.client_id ?? SEM_VALOR}
            disabled={!podeGerenciar}
            onValueChange={(v) => salvar({ client_id: v === SEM_VALOR ? null : v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sem cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem cliente (interna)</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo rotulo="Responsável">
          <Select
            value={task.responsavel_id ?? SEM_VALOR}
            disabled={!podeGerenciar}
            onValueChange={(v) => salvar({ responsavel_id: v === SEM_VALOR ? null : v })}
          >
            <SelectTrigger className="w-full">
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
        </Campo>

        <Campo rotulo="Status">
          <Select
            value={task.status}
            disabled={!podeEditar}
            onValueChange={(v) => mudarStatus(v as TaskStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_DE_TASK.map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULOS_DE_STATUS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo rotulo="Prioridade">
          <Select
            value={task.prioridade}
            disabled={!podeEditar}
            onValueChange={(v) => salvar({ prioridade: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULOS_DE_PRIORIDADE[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>

        <Campo rotulo="Prazo">
          <div className="space-y-1.5">
            <Input
              type="date"
              disabled={!podeGerenciar}
              defaultValue={task.prazo ?? ""}
              onBlur={(e) => e.target.value !== (task.prazo ?? "") && salvar({ prazo: e.target.value || null })}
            />
            {task.prazo ? <DateBadge date={task.prazo} showIcon /> : null}
          </div>
        </Campo>

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <Campo rotulo="Estimativa">
            <Input
              type="number"
              min={0}
              step="0.5"
              disabled={!podeEditar}
              defaultValue={task.estimativa_horas ?? ""}
              placeholder="—"
              onBlur={(e) => {
                const valor = e.target.value === "" ? null : Number(e.target.value);
                if (valor !== task.estimativa_horas) salvar({ estimativa_horas: valor });
              }}
            />
          </Campo>

          <Campo rotulo="Tempo real">
            <Input
              type="number"
              min={0}
              step="0.5"
              disabled={!podeEditar}
              defaultValue={task.tempo_real_horas ?? ""}
              placeholder="—"
              className={cn(estourou && "border-destructive text-destructive font-medium")}
              onBlur={(e) => {
                const valor = e.target.value === "" ? null : Number(e.target.value);
                if (valor !== task.tempo_real_horas) salvar({ tempo_real_horas: valor });
              }}
            />
          </Campo>
        </div>

        {estourou ? (
          <p className="text-destructive flex items-center gap-1.5 text-xs">
            <AlertTriangle aria-hidden className="size-3.5" />
            Passou {(task.tempo_real_horas! - task.estimativa_horas!).toFixed(1)}h da estimativa.
          </p>
        ) : null}

        <dl className="text-muted-foreground space-y-1 border-t pt-4 text-xs">
          <div className="flex justify-between gap-2">
            <dt>Criada por</dt>
            <dd className="text-foreground">{task.autor?.nome ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Criada em</dt>
            <dd>{format(parseISO(task.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Atualizada</dt>
            <dd>{format(parseISO(task.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</dd>
          </div>
          {task.concluida_em ? (
            <div className="flex justify-between gap-2">
              <dt>Concluída em</dt>
              <dd>{format(parseISO(task.concluida_em), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</dd>
            </div>
          ) : null}
        </dl>
      </aside>

      <DialogoDeTempo
        aberto={perguntandoTempo}
        aoFechar={() => setPerguntandoTempo(false)}
        titulo="Concluir esta task"
        sugestao={sugestaoDeTempo}
        origemDaSugestao={
          somaDasSubtarefas > 0
            ? `As subtarefas somam ${somaDasSubtarefas}h — é o valor sugerido.`
            : task.estimativa_horas
              ? `A estimativa era de ${task.estimativa_horas}h.`
              : undefined
        }
        aoConcluir={concluir}
      />
    </>
  );
}
