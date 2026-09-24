"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Tabela genérica: ordenação por coluna, busca, paginação e estado vazio.
 *
 * Usada por quase todo módulo, então ela não sabe nada sobre o domínio. Cada
 * tela descreve suas colunas e entrega os dados já prontos.
 *
 * A ordenação e a busca acontecem no navegador, sobre os dados recebidos. Isso
 * atende bem listas de algumas centenas de linhas, que é a escala da agência.
 * Quando um módulo passar disso, o caminho é paginar no Supabase e passar a
 * página já pronta para cá.
 */

export type Column<T> = {
  id: string;
  header: string;
  /** O que aparece na célula. */
  cell: (row: T) => ReactNode;
  /** Valor usado para ordenar. Sem isso, a coluna não é ordenável. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Texto considerado pela busca. Sem isso, a coluna não entra na busca. */
  searchValue?: (row: T) => string;
  align?: "left" | "right";
  className?: string;
};

type Ordenacao = { colunaId: string; direcao: "asc" | "desc" };

function comparar(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  // Vazio sempre por último, independentemente da direção: uma linha sem dado
  // no meio da lista ordenada só atrapalha a leitura.
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

/**
 * A linha casa com o termo?
 *
 * A mesma regra que a `DataTable` usa por dentro, exportada para quem
 * desliga a caixa dela e busca por fora. As duas pontas passam pelas mesmas
 * `columns`, entao acrescentar uma coluna pesquisavel vale nos dois lugares
 * de uma vez.
 */
export function casaComBusca<T>(
  linha: T,
  columns: { searchValue?: (linha: T) => string }[],
  termo: string,
): boolean {
  const limpo = termo.trim().toLowerCase();
  if (!limpo) return true;
  return columns.some((coluna) =>
    coluna.searchValue?.(linha).toLowerCase().includes(limpo),
  );
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Buscar…",
  /** Id do campo de busca, para atalhos de teclado conseguirem focá-lo. */
  searchId,
  pageSize = 10,
  initialSort,
  emptyIcon,
  emptyTitle = "Nada por aqui ainda",
  emptyDescription,
  emptyAction,
  toolbar,
  semBusca = false,
  onRowClick,
  className,
}: {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  searchId?: string;
  pageSize?: number;
  initialSort?: Ordenacao;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Espaço à direita da busca, para filtros da tela. */
  toolbar?: ReactNode;
  /** Desliga a caixa de busca desta tabela. Veja `casaComBusca`. */
  semBusca?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao | null>(initialSort ?? null);
  const [pagina, setPagina] = useState(0);

  // `semBusca` desliga a caixa desta tabela, e nao a busca do produto.
  //
  // Serve para a tela AGRUPADA: cada grupo e uma DataTable, e sem isto a
  // Gestao de Tasks desenhava uma caixa de busca por grupo -- quatro na mesma
  // tela, cada uma filtrando so o proprio bloco. Quem busca "Mundo Verde"
  // quer o termo na lista inteira, nao dentro de "Em andamento".
  //
  // Quem desliga a caixa assume a busca por fora, e usa `casaComBusca` com as
  // MESMAS colunas -- e por isso que ela e exportada em vez de ficar aqui
  // dentro: duas regras de "o que casa" divergiriam na primeira coluna nova.
  const temBusca = !semBusca && columns.some((coluna) => coluna.searchValue);

  const filtrados = useMemo(() => {
    if (semBusca) return data;
    return data.filter((linha) => casaComBusca(linha, columns, busca));
  }, [busca, columns, data, semBusca]);

  const ordenados = useMemo(() => {
    if (!ordenacao) return filtrados;
    const coluna = columns.find((c) => c.id === ordenacao.colunaId);
    if (!coluna?.sortValue) return filtrados;
    const copia = [...filtrados];
    copia.sort((a, b) => {
      const resultado = comparar(coluna.sortValue!(a), coluna.sortValue!(b));
      return ordenacao.direcao === "asc" ? resultado : -resultado;
    });
    return copia;
  }, [columns, filtrados, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / pageSize));
  // A página é limitada na renderização em vez de num efeito: filtrar pode
  // encolher a lista e deixar a página atual fora do intervalo.
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * pageSize;
  const visiveis = ordenados.slice(inicio, inicio + pageSize);

  function alternarOrdenacao(colunaId: string) {
    setOrdenacao((atual) => {
      if (atual?.colunaId !== colunaId) return { colunaId, direcao: "asc" };
      if (atual.direcao === "asc") return { colunaId, direcao: "desc" };
      return null;
    });
  }

  const cabecalho =
    temBusca || toolbar ? (
      <div className="flex flex-wrap items-center gap-2">
        {temBusca ? (
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <Input
              id={searchId}
              value={busca}
              onChange={(evento) => {
                setBusca(evento.target.value);
                setPagina(0);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-8 pl-8"
            />
          </div>
        ) : null}
        {toolbar}
      </div>
    ) : null;

  if (data.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        {cabecalho}
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {cabecalho}

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((coluna) => {
                const ordenavel = Boolean(coluna.sortValue);
                const ativa = ordenacao?.colunaId === coluna.id;
                const Seta = !ativa ? ChevronsUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;

                return (
                  <TableHead
                    key={coluna.id}
                    aria-sort={
                      ativa ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"
                    }
                    className={cn(coluna.align === "right" && "text-right", coluna.className)}
                  >
                    {ordenavel ? (
                      <button
                        type="button"
                        onClick={() => alternarOrdenacao(coluna.id)}
                        className={cn(
                          "hover:text-foreground -mx-1 inline-flex items-center gap-1.5 rounded px-1 transition-colors",
                          ativa && "text-foreground",
                        )}
                      >
                        {coluna.header}
                        <Seta aria-hidden className="size-3.5 opacity-60" />
                      </button>
                    ) : (
                      coluna.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum resultado para <span className="text-foreground font-medium">{busca}</span>.
                  </p>
                  <Button variant="link" size="sm" onClick={() => setBusca("")}>
                    Limpar a busca
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((linha) => (
                <TableRow
                  key={getRowId(linha)}
                  onClick={onRowClick ? () => onRowClick(linha) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((coluna) => (
                    <TableCell
                      key={coluna.id}
                      className={cn(coluna.align === "right" && "text-right", coluna.className)}
                    >
                      {coluna.cell(linha)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {ordenados.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs tabular-nums">
            {inicio + 1}–{Math.min(inicio + pageSize, ordenados.length)} de {ordenados.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina(paginaAtual - 1)}
              disabled={paginaAtual === 0}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {paginaAtual + 1} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagina(paginaAtual + 1)}
              disabled={paginaAtual >= totalPaginas - 1}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
