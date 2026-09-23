import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { obterTask, urlsDosArquivos } from "@/lib/dados/tasks";
import { listarWorkflows } from "@/lib/dados/workflows";
import { EXPLICACAO_DO_STATUS } from "@/lib/tasks/state-machine";

import { Comentarios } from "./comentarios";
import { HistoricoDaTask } from "./historico";
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

  const [clientes, equipe, tipos, ehDoAtendimento] = await Promise.all([
    listarClientes(),
    listarEquipeAtiva(),
    listarWorkflows(task.client_id),
    souDoAtendimento(),
  ]);

  const urls = await urlsDosArquivos(
    task.referencias.filter((r) => r.tipo === "arquivo").map((r) => r.url),
  );

  const souGestor = ehGestor(sessao.profile.role);

  // Espelha a regra do RLS: mexer na Task é do Atendimento e da gestão.
  // Trabalhar nas subtarefas é de quem é responsável por elas — e isso o
  // componente de ações resolve linha a linha. Ver é aberto para toda a
  // equipe; o banco é quem barra de verdade.
  const podeGerenciar = ehDoAtendimento || souGestor;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/painel/gestao-tasks">
            <ArrowLeft aria-hidden />
            Gestão de Tasks
          </Link>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <StatusBadge status={task.status} />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{EXPLICACAO_DO_STATUS[task.status]}</TooltipContent>
        </Tooltip>

        <span className="text-muted-foreground text-sm">
          {task.cliente?.nome_empresa ?? "—"} ·{" "}
          {format(parseISO(task.data_inicio), "dd/MM/yy", { locale: ptBR })}
          {task.data_fim ? ` → ${format(parseISO(task.data_fim), "dd/MM/yy", { locale: ptBR })}` : ""}
          {" · "}
          {task.subtarefasConcluidas} de {task.subtarefasTotal} concluída
          {task.subtarefasTotal === 1 ? "" : "s"}
        </span>

        {!podeGerenciar ? (
          <span className="text-muted-foreground text-xs">
            Você vê a demanda inteira; edita as subtarefas que são suas.
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Tabs defaultValue="trabalho">
            <TabsList>
              <TabsTrigger value="trabalho">Trabalho</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="trabalho" className="space-y-8 pt-4">
              <PrincipalDaTask task={task} podeEditar={podeGerenciar} />

              <Subtarefas
                taskId={task.id}
                subtarefas={task.subtarefas}
                equipe={equipe.map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url }))}
                podeGerenciar={podeGerenciar}
                souGestor={souGestor}
                usuarioId={sessao.usuarioId}
              />

              <Referencias
                taskId={task.id}
                referencias={task.referencias}
                urls={urls}
                podeEditar={podeGerenciar}
              />

              <Comentarios
                taskId={task.id}
                comentarios={task.comentarios}
                usuarioId={sessao.usuarioId}
                podeModerar={souGestor}
              />
            </TabsContent>

            <TabsContent value="historico" className="pt-4">
              <HistoricoDaTask eventos={task.historico} />
            </TabsContent>
          </Tabs>
        </div>

        <LateralDaTask
          task={task}
          clientes={clientes
            .filter((c) => c.ativo)
            .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
          tipos={tipos.map((t) => ({ id: t.id, nome: t.nome }))}
          podeEditar={podeGerenciar}
          podeExcluir={souGestor}
        />
      </div>
    </div>
  );
}
