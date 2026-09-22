import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import { listarEquipeAtiva } from "@/lib/dados/equipe";
import { listarTiposDeTarefa, listarWorkflows } from "@/lib/dados/workflows";

import { EditorDeWorkflows } from "./editor-de-workflows";
import { TiposDeTarefa } from "./tipos-de-tarefa";

export const metadata: Metadata = { title: "Workflows" };

async function Conteudo() {
  const [tipos, workflows, clientes, equipe] = await Promise.all([
    listarTiposDeTarefa(),
    listarWorkflows(),
    listarClientes(),
    listarEquipeAtiva(),
  ]);

  const ativos = clientes
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome_empresa: c.nome_empresa }));

  return (
    <Tabs defaultValue="tipos">
      <TabsList>
        <TabsTrigger value="tipos">Tipos de tarefa</TabsTrigger>
        <TabsTrigger value="fluxos">Workflows</TabsTrigger>
      </TabsList>

      <TabsContent value="tipos" className="pt-4">
        <TiposDeTarefa
          tipos={tipos}
          clientes={ativos}
          workflows={workflows.map((w) => ({
            id: w.id,
            nome: w.nome,
            client_id: w.client_id,
            ativo: w.ativo,
          }))}
        />
      </TabsContent>

      <TabsContent value="fluxos" className="pt-4">
        <EditorDeWorkflows
          workflows={workflows}
          clientes={ativos}
          equipe={equipe.map((p) => ({ id: p.id, nome: p.nome }))}
        />
      </TabsContent>
    </Tabs>
  );
}

export default async function PaginaDeWorkflows() {
  await exigirAcessoARota("/painel/workflows");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="O fluxo fixo de subtarefas de cada tipo de trabalho. Editar um fluxo não muda nenhuma Task já criada."
      />

      <Suspense fallback={<LoadingSkeleton variant="table" rows={6} />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
