"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { FilterBar, SEM_FILTRO } from "@/components/shared/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE, ROTULOS_DE_STATUS, STATUS_DE_TASK } from "@/lib/dominio/tasks";

export type Visao = "board" | "lista" | "calendario";

export type Filtros = {
  cliente: string;
  responsavel: string;
  prioridade: string;
  status: string;
  de: string;
  ate: string;
  atrasadas: boolean;
  visao: Visao;
};

export function lerFiltros(params: URLSearchParams): Filtros {
  const visao = params.get("visao");
  return {
    cliente: params.get("cliente") ?? SEM_FILTRO,
    responsavel: params.get("responsavel") ?? SEM_FILTRO,
    prioridade: params.get("prioridade") ?? SEM_FILTRO,
    status: params.get("status") ?? SEM_FILTRO,
    de: params.get("de") ?? "",
    ate: params.get("ate") ?? "",
    atrasadas: params.get("atrasadas") === "1",
    visao: visao === "lista" || visao === "calendario" ? visao : "board",
  };
}

/**
 * Filtros e visualização vivem na URL, não em estado do componente.
 *
 * Assim o link é compartilhável — "olha as urgentes atrasadas do Cliente Alfa"
 * vira um endereço que a pessoa cola no chat — e trocar de visualização
 * preserva o que já estava filtrado.
 */
export function useFiltros() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filtros = lerFiltros(new URLSearchParams(params.toString()));

  const definir = useCallback(
    (campos: Partial<Record<keyof Filtros, string | boolean>>) => {
      const proximos = new URLSearchParams(params.toString());

      for (const [chave, valor] of Object.entries(campos)) {
        const vazio =
          valor === SEM_FILTRO || valor === "" || valor === false || valor === undefined;
        if (vazio) proximos.delete(chave);
        else proximos.set(chave, valor === true ? "1" : String(valor));
      }

      // replace, e não push: filtrar não é navegar. Senão o botão voltar do
      // navegador desfaz filtro por filtro em vez de sair da tela.
      router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const limpar = useCallback(() => {
    const proximos = new URLSearchParams();
    if (filtros.visao !== "board") proximos.set("visao", filtros.visao);
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }, [filtros.visao, pathname, router]);

  return { filtros, definir, limpar };
}

export function BarraDeFiltrosDeTask({
  clientes,
  equipe,
}: {
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
}) {
  const { filtros, definir, limpar } = useFiltros();

  return (
    <FilterBar
      selects={[
        {
          id: "cliente",
          label: "Cliente",
          value: filtros.cliente,
          allLabel: "Todos os clientes",
          onChange: (v) => definir({ cliente: v }),
          options: clientes.map((c) => ({ value: c.id, label: c.nome_empresa })),
        },
        {
          id: "responsavel",
          label: "Responsável",
          value: filtros.responsavel,
          allLabel: "Todos os responsáveis",
          onChange: (v) => definir({ responsavel: v }),
          options: equipe.map((p) => ({ value: p.id, label: p.nome })),
        },
        {
          id: "prioridade",
          label: "Prioridade",
          value: filtros.prioridade,
          allLabel: "Todas as prioridades",
          onChange: (v) => definir({ prioridade: v }),
          options: PRIORIDADES.map((p) => ({ value: p, label: ROTULOS_DE_PRIORIDADE[p] })),
        },
        {
          id: "status",
          label: "Status",
          value: filtros.status,
          allLabel: "Todos os status",
          onChange: (v) => definir({ status: v }),
          options: STATUS_DE_TASK.map((s) => ({ value: s, label: ROTULOS_DE_STATUS[s] })),
        },
      ]}
      chips={[
        {
          id: "atrasadas",
          label: "Só atrasadas",
          active: filtros.atrasadas,
          onToggle: () => definir({ atrasadas: !filtros.atrasadas }),
        },
      ]}
      onClear={limpar}
    >
      <div className="flex items-center gap-1.5">
        <Label htmlFor="prazo-de" className="text-muted-foreground text-xs">
          Prazo de
        </Label>
        <Input
          id="prazo-de"
          type="date"
          className="h-8 w-36"
          value={filtros.de}
          onChange={(e) => definir({ de: e.target.value })}
        />
        <Label htmlFor="prazo-ate" className="text-muted-foreground text-xs">
          até
        </Label>
        <Input
          id="prazo-ate"
          type="date"
          className="h-8 w-36"
          value={filtros.ate}
          onChange={(e) => definir({ ate: e.target.value })}
        />
      </div>
    </FilterBar>
  );
}
