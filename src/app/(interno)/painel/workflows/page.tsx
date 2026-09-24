import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import {
  buscarRecorrencia,
  feriadosParaAPrevia,
  listarRecorrencias,
  modeloDeUmaTask,
} from "@/lib/dados/recorrencias";
import { listarTiposComFluxo } from "@/lib/dados/workflows";

import { AbasDeWorkflows, type AbaDeWorkflows } from "./abas";
import { EditorDeRecorrencia } from "./recorrencias/editor";
import { ListaDeRecorrencias } from "./recorrencias/lista";
import { Workflows } from "./workflows";

export const metadata: Metadata = { title: "Workflows" };

async function clientesAtivos() {
  const clientes = await listarClientes();
  return clientes
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa, slug: c.slug }));
}

async function AbaDeFluxos() {
  const [tipos, clientes, equipe] = await Promise.all([
    listarTiposComFluxo(),
    clientesAtivos(),
    listarEquipeAtiva(),
  ]);

  return (
    <Workflows
      tipos={tipos}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
    />
  );
}

async function AbaDeRecorrencias({
  regra,
  deTask,
}: {
  regra: string | undefined;
  /** "Transformar em recorrente": o id da task que preenche o editor. */
  deTask: string | undefined;
}) {
  // O EDITOR E A LISTA NÃO SÃO DUAS ROTAS, e sim um parâmetro: `?regra=nova`
  // ou `?regra={id}`. É a mesma decisão do painel lateral de Minhas Tasks —
  // quem fecha o editor volta para a lista com os filtros que tinha, e não
  // para uma lista recarregada do zero.
  if (regra) {
    const [clientes, equipe, tipos, feriados, atual, daTask] = await Promise.all([
      clientesAtivos(),
      listarEquipeAtiva(),
      listarTiposComFluxo(),
      feriadosParaAPrevia(),
      regra === "nova" ? Promise.resolve(null) : buscarRecorrencia(regra),
      regra === "nova" && deTask ? modeloDeUmaTask(deTask) : Promise.resolve(null),
    ]);

    return (
      <EditorDeRecorrencia
        regra={atual}
        clientes={clientes}
        equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
        workflows={tipos.map((t) => ({
          id: t.id,
          nome: t.nome,
          etapas: t.etapas?.length ?? 0,
        }))}
        partirDe={daTask}
        feriados={feriados}
        hojeISO={new Date().toISOString().slice(0, 10)}
      />
    );
  }

  const [regras, clientes, atendimento] = await Promise.all([
    listarRecorrencias(),
    clientesAtivos(),
    souDoAtendimento(),
  ]);

  return (
    <ListaDeRecorrencias
      regras={regras}
      clientes={clientes.map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }))}
      podeConfigurar={atendimento}
    />
  );
}

export default async function PaginaDeWorkflows({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAcessoARota("/painel/workflows");

  const parametros = await searchParams;
  const aba: AbaDeWorkflows =
    parametros.aba === "recorrencias" ? "recorrencias" : "workflows";
  const regra = typeof parametros.regra === "string" ? parametros.regra : undefined;
  const deTask = typeof parametros.deTask === "string" ? parametros.deTask : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
      />

      <AbasDeWorkflows atual={aba} />

      <Suspense
        key={`${aba}:${regra ?? ""}:${deTask ?? ""}`}
        fallback={<LoadingSkeleton variant="table" rows={6} />}
      >
        {aba === "recorrencias" ? (
          <AbaDeRecorrencias regra={regra} deTask={deTask} />
        ) : (
          <AbaDeFluxos />
        )}
      </Suspense>
    </div>
  );
}
