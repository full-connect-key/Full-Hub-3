"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { Resultado } from "@/lib/acoes/tipos";

import { DataTable, type Column } from "@/components/shared/data-table";
import { DateBadge } from "@/components/shared/date-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskDaLista } from "@/lib/dados/tasks";
import {
  PESO_DA_PRIORIDADE,
  PRIORIDADES,
  ROTULOS_DE_PRIORIDADE,
  ROTULOS_DE_STATUS,
  STATUS_DE_TASK,
  estaVencida,
} from "@/lib/dominio/tasks";
import { cn } from "@/lib/utils";

import { atualizarTask, atualizarTasksEmMassa } from "./acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

const SEM_VALOR = "__nenhum__";

/**
 * Visão em lista.
 *
 * Três coisas a mais do que uma tabela comum, e é o que faz o dia a dia render:
 * edição inline de prioridade, responsável e prazo direto na linha; seleção
 * múltipla com ação em massa; e agrupamento opcional por cliente ou por
 * responsável.
 */

/** Indicador discreto de "salvo", igual ao das ferramentas de produtividade. */
function useSalvamento() {
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const router = useRouter();

  async function salvar(executar: () => Promise<Resultado>) {
    setEstado("salvando");
    const resultado = await chamarAcao(() => executar());
    if (!resultado.ok) {
      setEstado("parado");
      toast.error(resultado.error);
      return;
    }
    setEstado("salvo");
    router.refresh();
    window.setTimeout(() => setEstado("parado"), 1600);
  }

  return { estado, salvar };
}

function Indicador({ estado }: { estado: "parado" | "salvando" | "salvo" }) {
  if (estado === "parado") return null;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      {estado === "salvando" ? (
        <>
          <Loader2 aria-hidden className="size-3 animate-spin" /> salvando
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3" /> salvo
        </>
      )}
    </span>
  );
}

function PrioridadeInline({ task }: { task: TaskDaLista }) {
  const { estado, salvar } = useSalvamento();
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={task.prioridade}
        onValueChange={(valor) => salvar(() => atualizarTask(task.id, { prioridade: valor }))}
      >
        <SelectTrigger size="sm" className="h-7 border-none px-1 shadow-none">
          <PriorityBadge priority={task.prioridade} />
        </SelectTrigger>
        <SelectContent>
          {PRIORIDADES.map((p) => (
            <SelectItem key={p} value={p}>
              {ROTULOS_DE_PRIORIDADE[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Indicador estado={estado} />
    </div>
  );
}

function ResponsavelInline({
  task,
  equipe,
}: {
  task: TaskDaLista;
  equipe: { id: string; nome: string }[];
}) {
  const { estado, salvar } = useSalvamento();
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={task.responsavel_id ?? SEM_VALOR}
        onValueChange={(valor) =>
          salvar(() =>
            atualizarTask(task.id, { responsavel_id: valor === SEM_VALOR ? null : valor }),
          )
        }
      >
        <SelectTrigger size="sm" className="h-7 border-none px-1 shadow-none">
          {task.responsavel ? (
            <span className="flex items-center gap-2">
              <UserAvatar name={task.responsavel.nome} src={task.responsavel.avatar_url} size="sm" />
              <span className="truncate text-sm">{task.responsavel.nome}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Sem responsável</span>
          )}
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
      <Indicador estado={estado} />
    </div>
  );
}

function PrazoInline({ task }: { task: TaskDaLista }) {
  const { estado, salvar } = useSalvamento();
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <Input
        type="date"
        autoFocus
        defaultValue={task.prazo ?? ""}
        className="h-7 w-36"
        onBlur={(e) => {
          setEditando(false);
          if (e.target.value !== (task.prazo ?? "")) {
            void salvar(() => atualizarTask(task.id, { prazo: e.target.value || null }));
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="flex items-center gap-1.5"
      title="Clique para alterar o prazo"
    >
      {task.prazo ? (
        <DateBadge date={task.prazo} />
      ) : (
        <span className="text-muted-foreground text-sm">Sem prazo</span>
      )}
      <Indicador estado={estado} />
    </button>
  );
}

function BarraDeAcoesEmMassa({
  selecionadas,
  equipe,
  aoTerminar,
}: {
  selecionadas: string[];
  equipe: { id: string; nome: string }[];
  aoTerminar: () => void;
}) {
  const [aplicando, iniciar] = useTransition();
  const router = useRouter();

  function aplicar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => atualizarTasksEmMassa(selecionadas, campos));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        aoTerminar();
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-sm">
      <span className="px-1 text-sm font-medium tabular-nums">
        {selecionadas.length} selecionada(s)
      </span>

      <Select onValueChange={(v) => aplicar({ responsavel_id: v === SEM_VALOR ? null : v })}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Responsável" />
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

      <Select onValueChange={(v) => aplicar({ prioridade: v })}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          {PRIORIDADES.map((p) => (
            <SelectItem key={p} value={p}>
              {ROTULOS_DE_PRIORIDADE[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => aplicar({ status: v })}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_DE_TASK.map((s) => (
            <SelectItem key={s} value={s}>
              {ROTULOS_DE_STATUS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Label htmlFor="prazo-em-massa" className="text-muted-foreground text-xs">
          Prazo
        </Label>
        <Input
          id="prazo-em-massa"
          type="date"
          className="h-8 w-36"
          onChange={(e) => e.target.value && aplicar({ prazo: e.target.value })}
        />
      </div>

      {aplicando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}

      <Button variant="ghost" size="sm" onClick={aoTerminar} className="ml-auto">
        Cancelar seleção
      </Button>
    </div>
  );
}

export function ListaDeTasks({
  tasks,
  equipe,
}: {
  tasks: TaskDaLista[];
  equipe: { id: string; nome: string }[];
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [agrupamento, setAgrupamento] = useState<"nenhum" | "cliente" | "responsavel">("nenhum");

  function alternar(id: string) {
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  const colunas: Column<TaskDaLista>[] = [
    {
      id: "selecao",
      header: "",
      className: "w-9",
      cell: (task) => (
        <input
          type="checkbox"
          aria-label={`Selecionar ${task.titulo}`}
          checked={selecionadas.includes(task.id)}
          onChange={() => alternar(task.id)}
          className="accent-brand size-4"
        />
      ),
    },
    {
      id: "titulo",
      header: "Task",
      cell: (task) => (
        <Link
          href={`/painel/gestao-tasks/${task.id}`}
          className={cn(
            "font-medium hover:underline",
            estaVencida(task.prazo, task.status) && "text-destructive",
          )}
        >
          {task.titulo}
        </Link>
      ),
      sortValue: (task) => task.titulo,
      searchValue: (task) => `${task.titulo} ${task.briefing_texto ?? ""}`,
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: (task) =>
        task.cliente ? (
          <Badge variant="outline">{task.cliente.nome_empresa}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
      sortValue: (task) => task.cliente?.nome_empresa ?? null,
      searchValue: (task) => task.cliente?.nome_empresa ?? "",
    },
    {
      id: "responsavel",
      header: "Responsável",
      cell: (task) => <ResponsavelInline task={task} equipe={equipe} />,
      sortValue: (task) => task.responsavel?.nome ?? null,
      searchValue: (task) => task.responsavel?.nome ?? "",
    },
    {
      id: "prazo",
      header: "Prazo",
      cell: (task) => <PrazoInline task={task} />,
      sortValue: (task) => task.prazo,
    },
    {
      id: "prioridade",
      header: "Prioridade",
      cell: (task) => <PrioridadeInline task={task} />,
      sortValue: (task) => PESO_DA_PRIORIDADE[task.prioridade],
    },
    {
      id: "status",
      header: "Status",
      cell: (task) => <StatusBadge status={task.status} />,
      sortValue: (task) => task.status,
    },
    {
      id: "estimativa",
      header: "Estimativa",
      cell: (task) => (task.estimativa_horas ? `${task.estimativa_horas}h` : "—"),
      sortValue: (task) => task.estimativa_horas,
      align: "right",
    },
    {
      id: "real",
      header: "Tempo real",
      cell: (task) => {
        if (!task.tempo_real_horas) return "—";
        const estourou =
          task.estimativa_horas !== null && task.tempo_real_horas > task.estimativa_horas;
        return (
          <span className={cn("tabular-nums", estourou && "text-destructive font-medium")}>
            {task.tempo_real_horas}h
          </span>
        );
      },
      sortValue: (task) => task.tempo_real_horas,
      align: "right",
    },
    {
      id: "subtarefas",
      header: "Subtarefas",
      cell: (task) =>
        task.subtarefasTotal > 0 ? (
          <span className="tabular-nums">
            {task.subtarefasConcluidas}/{task.subtarefasTotal}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (task) => task.subtarefasTotal,
      align: "right",
    },
  ];

  const grupos = useMemo(() => {
    if (agrupamento === "nenhum") return [{ titulo: "", tasks }];

    const mapa = new Map<string, TaskDaLista[]>();
    for (const task of tasks) {
      const chave =
        agrupamento === "cliente"
          ? (task.cliente?.nome_empresa ?? "Sem cliente")
          : (task.responsavel?.nome ?? "Sem responsável");
      mapa.set(chave, [...(mapa.get(chave) ?? []), task]);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([titulo, itens]) => ({ titulo, tasks: itens }));
  }, [agrupamento, tasks]);

  const seletorDeAgrupamento = (
    <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as typeof agrupamento)}>
      <SelectTrigger size="sm" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="nenhum">Sem agrupamento</SelectItem>
        <SelectItem value="cliente">Agrupar por cliente</SelectItem>
        <SelectItem value="responsavel">Agrupar por responsável</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {selecionadas.length > 0 ? (
        <BarraDeAcoesEmMassa
          selecionadas={selecionadas}
          equipe={equipe}
          aoTerminar={() => setSelecionadas([])}
        />
      ) : null}

      {grupos.map((grupo, indice) => (
        <div key={grupo.titulo || "todas"} className="space-y-2">
          {grupo.titulo ? (
            <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
              {grupo.titulo} · {grupo.tasks.length}
            </h3>
          ) : null}

          <DataTable
            data={grupo.tasks}
            columns={colunas}
            getRowId={(task) => task.id}
            pageSize={agrupamento === "nenhum" ? 15 : 50}
            searchId={indice === 0 ? "busca-de-tasks" : undefined}
            searchPlaceholder="Buscar por título, briefing, cliente ou responsável…"
            emptyIcon={ClipboardList}
            emptyTitle="Nenhuma task com esses filtros"
            emptyDescription="Ajuste ou limpe os filtros, ou crie a primeira task com a tecla N."
            toolbar={indice === 0 ? seletorDeAgrupamento : undefined}
          />
        </div>
      ))}
    </div>
  );
}
