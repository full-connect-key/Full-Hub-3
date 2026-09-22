"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Columns3, List, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COLUNAS_POR_STATUS } from "@/lib/dominio/tasks";
import type { ItemDeCalendario, TaskDaLista } from "@/lib/dados/tasks";
import type { TeamFuncao } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { BoardDeTasks } from "./board";
import { CalendarioDeTasks } from "./calendario";
import { BarraDeFiltrosDeTask, useFiltros, type Visao } from "./filtros";
import { FormularioDeTask } from "./formulario-de-task";
import { ListaDeTasks } from "./lista";

const VISOES: { id: Visao; rotulo: string; Icone: typeof List }[] = [
  { id: "board", rotulo: "Board", Icone: Columns3 },
  { id: "lista", rotulo: "Lista", Icone: List },
  { id: "calendario", rotulo: "Calendário", Icone: CalendarDays },
];

/**
 * Container das três visualizações.
 *
 * A visualização escolhida também mora na URL, junto com os filtros — trocar
 * de Board para Lista não perde o que já estava filtrado, e o link continua
 * levando a outra pessoa exatamente para o que você está vendo.
 */
export function PainelDeTasks({
  tasks,
  itensDeCalendario,
  clientes,
  equipe,
  tipos,
  prazos,
}: {
  tasks: TaskDaLista[];
  itensDeCalendario: ItemDeCalendario[];
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string; avatar_url: string | null; funcao: TeamFuncao | null }[];
  tipos: { id: string; nome: string; client_id: string | null }[];
  prazos: { hoje: string; fimDaSemana: string };
}) {
  const { filtros, definir } = useFiltros();
  const [criando, setCriando] = useState(false);

  /**
   * Atalhos no estilo das ferramentas de produtividade: N abre nova task e /
   * foca a busca. Esc é o Radix que resolve, fechando o diálogo aberto.
   *
   * Os atalhos são ignorados enquanto se digita em qualquer campo — senão
   * escrever "não" num comentário abriria uma task nova no meio da frase.
   */
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      const alvo = evento.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.tagName === "SELECT" ||
        alvo?.isContentEditable;
      if (digitando) return;

      if (evento.key === "n" || evento.key === "N") {
        evento.preventDefault();
        setCriando(true);
        return;
      }

      if (evento.key === "/") {
        const busca = document.getElementById("busca-de-tasks");
        if (busca) {
          evento.preventDefault();
          (busca as HTMLInputElement).focus();
        }
      }
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/60 inline-flex rounded-lg border p-0.5">
          {VISOES.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => definir({ visao: id })}
              aria-pressed={filtros.visao === id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                filtros.visao === id
                  ? "bg-background text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone aria-hidden className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>

        <Button className="ml-auto" onClick={() => setCriando(true)}>
          <Plus aria-hidden />
          Nova task
          <kbd className="bg-primary-foreground/15 ml-1 hidden rounded px-1.5 py-0.5 text-[10px] sm:inline">
            N
          </kbd>
        </Button>
      </div>

      <BarraDeFiltrosDeTask clientes={clientes} equipe={equipe} />

      {filtros.visao === "board" ? (
        <BoardDeTasks tasks={tasks} colunas={COLUNAS_POR_STATUS} />
      ) : null}
      {filtros.visao === "lista" ? <ListaDeTasks tasks={tasks} /> : null}
      {filtros.visao === "calendario" ? (
        <CalendarioDeTasks itens={itensDeCalendario} equipe={equipe} prazos={prazos} />
      ) : null}

      <FormularioDeTask
        aberto={criando}
        aoFechar={() => setCriando(false)}
        clientes={clientes}
        equipe={equipe}
        tipos={tipos}
      />
    </div>
  );
}
