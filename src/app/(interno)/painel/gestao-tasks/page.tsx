import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { contadoresDeTasks, itensDoCalendario, listarTasks, type FiltrosDeTask } from "@/lib/dados/tasks";
import type { TaskPrioridade, TaskStatus } from "@/lib/supabase/database.types";

import { PainelDeTasks } from "./painel-de-tasks";

export const metadata: Metadata = { title: "Gestão de Tasks" };

function Contador({ valor, rotulo, tom }: { valor: number; rotulo: string; tom?: "alerta" }) {
  return (
    <div className="rounded-lg border px-3.5 py-2">
      <p
        className={`text-xl font-semibold tabular-nums ${tom === "alerta" && valor > 0 ? "text-destructive" : ""}`}
      >
        {valor}
      </p>
      <p className="text-muted-foreground text-xs">{rotulo}</p>
    </div>
  );
}

/** Traduz os parâmetros da URL nos filtros que a consulta entende. */
function filtrosDaUrl(params: Record<string, string | string[] | undefined>): FiltrosDeTask {
  const texto = (chave: string) => {
    const valor = params[chave];
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
  };

  return {
    cliente: texto("cliente"),
    responsavel: texto("responsavel"),
    prioridade: texto("prioridade") as TaskPrioridade | undefined,
    status: texto("status") as TaskStatus | undefined,
    de: texto("de"),
    ate: texto("ate"),
    soAtrasadas: params.atrasadas === "1",
  };
}

async function Conteudo({ filtros }: { filtros: FiltrosDeTask }) {
  const [tasks, itens, clientes, equipe] = await Promise.all([
    listarTasks(filtros),
    itensDoCalendario(filtros),
    listarClientes(),
    listarEquipeAtiva(),
  ]);

  return (
    <PainelDeTasks
      tasks={tasks}
      itensDeCalendario={itens}
      clientes={clientes
        .filter((cliente) => cliente.ativo)
        .map((cliente) => ({ id: cliente.id, nome_empresa: cliente.nome_empresa }))}
      equipe={equipe}
    />
  );
}

export default async function PaginaDeGestaoDeTasks({
  searchParams,
}: PageProps<"/painel/gestao-tasks">) {
  await exigirAcessoARota("/painel/gestao-tasks");

  const params = await searchParams;
  const filtros = filtrosDaUrl(params);
  const contadores = await contadoresDeTasks();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Tasks"
        description="Todas as demandas da agência, em três formas de olhar."
        actions={
          <div className="flex gap-2">
            <Contador valor={contadores.abertas} rotulo="abertas" />
            <Contador valor={contadores.atrasadas} rotulo="atrasadas" tom="alerta" />
            <Contador valor={contadores.concluidasNoMes} rotulo="concluídas no mês" />
          </div>
        }
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo filtros={filtros} />
      </Suspense>
    </div>
  );
}
