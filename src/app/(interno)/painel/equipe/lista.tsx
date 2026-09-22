"use client";

import Link from "next/link";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserRound } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import { FUNCOES, ROTULOS_DE_FUNCAO, rotuloDaFuncao } from "@/lib/dominio/equipe";
import type { MembroDaEquipe } from "@/lib/dados/equipe";

export function ListaDaEquipe({ equipe }: { equipe: MembroDaEquipe[] }) {
  const [area, setArea] = useState(SEM_FILTRO);
  const [funcao, setFuncao] = useState(SEM_FILTRO);
  const [role, setRole] = useState(SEM_FILTRO);

  const areas = [...new Set(equipe.map((p) => p.membro?.area).filter(Boolean))] as string[];

  const filtrados = equipe.filter((pessoa) => {
    if (area !== SEM_FILTRO && pessoa.membro?.area !== area) return false;
    if (funcao !== SEM_FILTRO && pessoa.membro?.funcao !== funcao) return false;
    if (role !== SEM_FILTRO && pessoa.role !== role) return false;
    return true;
  });

  const colunas: Column<MembroDaEquipe>[] = [
    {
      id: "pessoa",
      header: "Pessoa",
      cell: (pessoa) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={pessoa.nome} src={pessoa.avatar_url} size="sm" />
          <div className="min-w-0">
            <Link href={`/painel/equipe/${pessoa.id}`} className="font-medium hover:underline">
              {pessoa.nome}
            </Link>
            <p className="text-muted-foreground truncate text-xs">{pessoa.email}</p>
          </div>
        </div>
      ),
      sortValue: (pessoa) => pessoa.nome,
      searchValue: (pessoa) => `${pessoa.nome} ${pessoa.email} ${pessoa.membro?.cargo ?? ""}`,
    },
    {
      id: "cargo",
      header: "Cargo",
      cell: (pessoa) => pessoa.membro?.cargo ?? "—",
      sortValue: (pessoa) => pessoa.membro?.cargo ?? null,
    },
    {
      id: "area",
      header: "Área",
      cell: (pessoa) => pessoa.membro?.area ?? "—",
      sortValue: (pessoa) => pessoa.membro?.area ?? null,
    },
    {
      id: "funcao",
      header: "Função",
      cell: (pessoa) => rotuloDaFuncao(pessoa.membro?.funcao ?? null),
      sortValue: (pessoa) => pessoa.membro?.funcao ?? null,
    },
    {
      id: "role",
      header: "Acesso",
      cell: (pessoa) => <Badge variant="secondary">{ROTULOS_DE_ROLE[pessoa.role]}</Badge>,
      sortValue: (pessoa) => pessoa.role,
    },
    {
      id: "admissao",
      header: "Admissão",
      // Data comum, não DateBadge: admissão no passado é o normal, e o
      // DateBadge pintaria de vermelho como se fosse prazo vencido.
      cell: (pessoa) =>
        pessoa.membro?.data_admissao ? (
          <span className="tabular-nums">
            {format(parseISO(pessoa.membro.data_admissao), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (pessoa) => pessoa.membro?.data_admissao ?? null,
    },
    {
      id: "status",
      header: "Status",
      cell: (pessoa) =>
        pessoa.ativo && pessoa.membro?.ativo !== false ? (
          <Badge variant="success">Ativo</Badge>
        ) : (
          <Badge variant="secondary">Desligado</Badge>
        ),
      sortValue: (pessoa) => (pessoa.ativo ? 0 : 1),
    },
  ];

  return (
    <DataTable
      data={filtrados}
      columns={colunas}
      getRowId={(pessoa) => pessoa.id}
      pageSize={12}
      searchPlaceholder="Buscar por nome, e-mail ou cargo…"
      emptyIcon={UserRound}
      emptyTitle={
        equipe.length === 0 ? "Ninguém cadastrado ainda" : "Ninguém com esses filtros"
      }
      emptyDescription={
        equipe.length === 0
          ? "Adicione a primeira pessoa da equipe para começar."
          : "Ajuste ou limpe os filtros para ver a equipe completa."
      }
      toolbar={
        <FilterBar
          selects={[
            {
              id: "area",
              label: "Área",
              value: area,
              allLabel: "Todas as áreas",
              onChange: setArea,
              options: areas.map((a) => ({ value: a, label: a })),
            },
            {
              id: "funcao",
              label: "Função",
              value: funcao,
              allLabel: "Todas as funções",
              onChange: setFuncao,
              options: FUNCOES.map((f) => ({ value: f, label: ROTULOS_DE_FUNCAO[f] })),
            },
            {
              id: "role",
              label: "Acesso",
              value: role,
              allLabel: "Todos os acessos",
              onChange: setRole,
              options: [
                { value: "colaborador", label: "Colaborador" },
                { value: "desenvolvedor", label: "Desenvolvedor" },
                { value: "socio", label: "Sócio" },
              ],
            },
          ]}
          onClear={() => {
            setArea(SEM_FILTRO);
            setFuncao(SEM_FILTRO);
            setRole(SEM_FILTRO);
          }}
        />
      }
    />
  );
}
