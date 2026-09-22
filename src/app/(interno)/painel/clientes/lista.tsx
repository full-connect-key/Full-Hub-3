"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClienteComResumo } from "@/lib/dados/clientes";

import { alternarAtivoDoCliente } from "./acoes";
import { FormularioDeCliente } from "./formulario-de-cliente";

export function ListaDeClientes({
  clientes,
  equipe,
}: {
  clientes: ClienteComResumo[];
  equipe: { id: string; nome: string }[];
}) {
  const [status, setStatus] = useState("ativos");
  const [responsavel, setResponsavel] = useState(SEM_FILTRO);
  const [, iniciar] = useTransition();

  const filtrados = clientes.filter((cliente) => {
    if (status === "ativos" && !cliente.ativo) return false;
    if (status === "inativos" && cliente.ativo) return false;
    if (responsavel === "__sem__" && cliente.responsavel_atendimento_id) return false;
    if (
      responsavel !== SEM_FILTRO &&
      responsavel !== "__sem__" &&
      cliente.responsavel_atendimento_id !== responsavel
    ) {
      return false;
    }
    return true;
  });

  function alternar(cliente: ClienteComResumo) {
    iniciar(async () => {
      const resultado = await alternarAtivoDoCliente(cliente.id, !cliente.ativo);
      if (resultado.erro) toast.error(resultado.erro);
      else toast.success(resultado.ok ?? "Pronto.");
    });
  }

  const colunas: Column<ClienteComResumo>[] = [
    {
      id: "empresa",
      header: "Empresa",
      cell: (cliente) => (
        <Link href={`/painel/clientes/${cliente.id}`} className="font-medium hover:underline">
          {cliente.nome_empresa}
        </Link>
      ),
      sortValue: (cliente) => cliente.nome_empresa,
      searchValue: (cliente) => `${cliente.nome_empresa} ${cliente.segmento ?? ""}`,
    },
    {
      id: "contato",
      header: "Contato",
      cell: (cliente) => (
        <div className="min-w-0">
          <p className="truncate">{cliente.nome_contato ?? "—"}</p>
          {cliente.email_contato ? (
            <p className="text-muted-foreground truncate text-xs">{cliente.email_contato}</p>
          ) : null}
        </div>
      ),
      sortValue: (cliente) => cliente.nome_contato,
      searchValue: (cliente) => `${cliente.nome_contato ?? ""} ${cliente.email_contato ?? ""}`,
    },
    {
      id: "telefone",
      header: "Telefone",
      cell: (cliente) => cliente.telefone ?? "—",
      searchValue: (cliente) => cliente.telefone ?? "",
    },
    {
      id: "responsavel",
      header: "Responsável",
      cell: (cliente) =>
        cliente.responsavel ? (
          cliente.responsavel.nome
        ) : (
          <span className="text-muted-foreground">Sem responsável</span>
        ),
      sortValue: (cliente) => cliente.responsavel?.nome ?? null,
      searchValue: (cliente) => cliente.responsavel?.nome ?? "",
    },
    {
      id: "acessos",
      header: "Acessos",
      cell: (cliente) => (
        <span className="tabular-nums">{cliente.usuariosComAcesso}</span>
      ),
      sortValue: (cliente) => cliente.usuariosComAcesso,
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      cell: (cliente) => (
        <button
          type="button"
          onClick={() => alternar(cliente)}
          title={cliente.ativo ? "Desativar cliente" : "Reativar cliente"}
        >
          <Badge variant={cliente.ativo ? "success" : "secondary"}>
            {cliente.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </button>
      ),
      sortValue: (cliente) => (cliente.ativo ? 0 : 1),
    },
  ];

  return (
    <DataTable
      data={filtrados}
      columns={colunas}
      getRowId={(cliente) => cliente.id}
      pageSize={12}
      searchPlaceholder="Buscar por empresa, contato ou telefone…"
      emptyIcon={Building2}
      emptyTitle={
        clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente com esses filtros"
      }
      emptyDescription={
        clientes.length === 0
          ? "Cadastre a primeira empresa para começar a organizar o atendimento."
          : "Ajuste ou limpe os filtros para ver a lista completa."
      }
      emptyAction={
        clientes.length === 0 ? (
          <FormularioDeCliente
            equipe={equipe}
            trigger={
              <Button size="sm">
                <Plus aria-hidden />
                Cadastrar cliente
              </Button>
            }
          />
        ) : null
      }
      toolbar={
        <FilterBar
          selects={[
            {
              id: "status",
              label: "Status",
              value: status,
              allLabel: "Todos",
              onChange: setStatus,
              options: [
                { value: "ativos", label: "Somente ativos" },
                { value: "inativos", label: "Somente inativos" },
              ],
            },
            {
              id: "responsavel",
              label: "Responsável",
              value: responsavel,
              allLabel: "Todos os responsáveis",
              onChange: setResponsavel,
              options: [
                { value: "__sem__", label: "Sem responsável" },
                ...equipe.map((pessoa) => ({ value: pessoa.id, label: pessoa.nome })),
              ],
            },
          ]}
          onClear={() => {
            setStatus(SEM_FILTRO);
            setResponsavel(SEM_FILTRO);
          }}
        />
      }
    />
  );
}
