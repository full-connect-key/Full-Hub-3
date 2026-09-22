import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { obterTask, urlsDosArquivos } from "@/lib/dados/tasks";

import { Comentarios } from "./comentarios";
import { LateralDaTask } from "./lateral";
import { PrincipalDaTask } from "./principal";
import { Referencias } from "./referencias";
import { Subtarefas } from "./subtarefas";

export const metadata: Metadata = { title: "Task" };

export default async function PaginaDaTask({ params }: PageProps<"/painel/gestao-tasks/[id]">) {
  const sessao = await exigirAcessoARota("/painel/gestao-tasks");
  const { id } = await params;

  const task = await obterTask(id);
  if (!task) notFound();

  const [clientes, equipe] = await Promise.all([listarClientes(), listarEquipeAtiva()]);

  const urls = await urlsDosArquivos(
    task.referencias.filter((r) => r.tipo === "arquivo").map((r) => r.url),
  );

  // Espelha a regra do RLS: gestão e Atendimento mexem em qualquer task, quem
  // é responsável mexe na própria. O banco é quem barra de verdade; aqui só
  // evitamos mostrar controles que não vão funcionar.
  const podeEditar = ehGestor(sessao.profile.role) || task.responsavel_id === sessao.usuarioId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/painel/gestao-tasks">
            <ArrowLeft aria-hidden />
            Gestão de Tasks
          </Link>
        </Button>
        <StatusBadge status={task.status} />
        {!podeEditar ? (
          <span className="text-muted-foreground text-xs">
            Somente leitura: você não é responsável por esta task.
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-8">
          <PrincipalDaTask task={task} podeEditar={podeEditar} />

          <Subtarefas
            taskId={task.id}
            subtarefas={task.subtarefas}
            equipe={equipe}
            podeEditar={podeEditar}
            usuarioId={sessao.usuarioId}
          />

          <Referencias
            taskId={task.id}
            referencias={task.referencias}
            urls={urls}
            podeEditar={podeEditar}
          />

          <Comentarios
            taskId={task.id}
            comentarios={task.comentarios}
            usuarioId={sessao.usuarioId}
            podeModerar={ehGestor(sessao.profile.role)}
          />
        </div>

        <LateralDaTask
          task={task}
          equipe={equipe}
          clientes={clientes
            .filter((c) => c.ativo)
            .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
          podeEditar={podeEditar}
        />
      </div>
    </div>
  );
}
