"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Columns3, List, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COLUNAS_POR_STATUS, ROTULOS_DE_FOCO, type FocoDoDia } from "@/lib/dominio/tasks";
import type { ItemDeCalendario, TaskDaLista } from "@/lib/dados/tasks";
import type { ItemDoDia } from "@/lib/dados/minhas-tasks";
import { cn } from "@/lib/utils";

import { BoardDeTasks } from "../gestao-tasks/board";
import { CalendarioDeTasks } from "../gestao-tasks/calendario";
import { FormularioDeTask } from "../gestao-tasks/formulario-de-task";
import type { LinhaPessoal } from "./linhas";
import { MeuDia } from "./meu-dia";
import { MinhaLista } from "./minha-lista";
import { PainelLateralDaTask } from "./painel-lateral";

type Visao = "board" | "lista" | "calendario";

const VISOES: { id: Visao; rotulo: string; Icone: typeof List }[] = [
  { id: "board", rotulo: "Board", Icone: Columns3 },
  { id: "lista", rotulo: "Lista", Icone: List },
  { id: "calendario", rotulo: "Calendário", Icone: CalendarDays },
];

const FOCOS: FocoDoDia[] = ["atrasadas", "hoje", "semana"];

/**
 * Minhas Tasks.
 *
 * O board, o calendário e o formulário de nova task são os mesmos do Sprint 3,
 * recebendo parâmetros diferentes: aqui o clique abre o painel lateral em vez
 * de trocar de página, e um card de task que não é minha não pode ser
 * arrastado — a policy do banco recusaria a mudança de status de qualquer
 * forma, e um card que volta sozinho é pior que um card parado.
 *
 * Visualização e foco moram na URL. Além de o link ficar compartilhável, é o
 * que faz o contador clicável funcionar sem estado duplicado: clicar em
 * "Atrasadas" navega, e o servidor devolve a lista já filtrada pela mesma
 * função que produziu o número.
 */
export function PainelPessoal({
  tasks,
  linhas,
  itensDeCalendario,
  itensDoDia,
  contadores,
  clientes,
  equipe,
  prazos,
  usuarioId,
  primeiroNome,
  podeCriarTask,
  visao,
  foco,
}: {
  tasks: TaskDaLista[];
  linhas: LinhaPessoal[];
  itensDeCalendario: ItemDeCalendario[];
  itensDoDia: ItemDoDia[];
  contadores: Record<FocoDoDia, number>;
  clientes: { id: string; nome_empresa: string }[];
  equipe: { id: string; nome: string }[];
  prazos: { hoje: string; fimDaSemana: string };
  usuarioId: string;
  primeiroNome: string;
  podeCriarTask: boolean;
  visao: Visao;
  foco: FocoDoDia | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const [criando, setCriando] = useState(false);
  const [taskAberta, setTaskAberta] = useState<string | null>(null);

  function navegar(mudancas: Record<string, string | null>) {
    const proximos = new URLSearchParams(parametros.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) proximos.delete(chave);
      else proximos.set(chave, valor);
    }
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FOCOS.map((id) => {
          const ativo = foco === id;
          const valor = contadores[id];
          return (
            <button
              key={id}
              type="button"
              // Identifica o contador para o teste automatizado conferir que o
              // número bate com o que a lista e o calendário mostram.
              data-foco={id}
              aria-pressed={ativo}
              onClick={() => navegar({ foco: ativo ? null : id })}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-left transition-colors",
                ativo ? "border-brand bg-brand/5" : "hover:bg-accent",
              )}
            >
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  id === "atrasadas" && valor > 0 && "text-destructive",
                )}
              >
                {valor}
              </p>
              <p className="text-muted-foreground text-xs">{ROTULOS_DE_FOCO[id]}</p>
            </button>
          );
        })}

        {foco ? (
          <button
            type="button"
            onClick={() => navegar({ foco: null })}
            className="text-muted-foreground hover:text-foreground self-center text-xs underline underline-offset-4"
          >
            Limpar filtro
          </button>
        ) : null}
      </div>

      <MeuDia itens={itensDoDia} primeiroNome={primeiroNome} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/60 inline-flex rounded-lg border p-0.5">
          {VISOES.map(({ id, rotulo, Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => navegar({ visao: id })}
              aria-pressed={visao === id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                visao === id
                  ? "bg-background text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone aria-hidden className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>

        {foco ? (
          <Badge variant="secondary">Filtrando por {ROTULOS_DE_FOCO[foco].toLowerCase()}</Badge>
        ) : null}

        {/* Só aparece para quem faz Atendimento. A policy tasks_insert é quem
            recusa de verdade — isto evita oferecer um caminho sem saída. */}
        {podeCriarTask ? (
          <Button className="ml-auto" onClick={() => setCriando(true)}>
            <Plus aria-hidden />
            Nova task
          </Button>
        ) : null}
      </div>

      {visao === "board" ? (
        <BoardDeTasks
          tasks={tasks}
          colunas={COLUNAS_POR_STATUS}
          aoAbrir={setTaskAberta}
          podeArrastar={(task) => task.responsavel_id === usuarioId}
          marcador={(task) =>
            task.responsavel_id === usuarioId ? null : (
              <Badge variant="secondary" className="text-[10px]">
                Sua subtarefa · task de {task.responsavel?.nome ?? "outra pessoa"}
              </Badge>
            )
          }
        />
      ) : null}

      {visao === "lista" ? (
        <MinhaLista linhas={linhas} prazos={prazos} aoAbrir={setTaskAberta} />
      ) : null}

      {visao === "calendario" ? (
        <CalendarioDeTasks
          itens={itensDeCalendario}
          equipe={equipe}
          prazos={prazos}
          aoAbrir={setTaskAberta}
        />
      ) : null}

      <PainelLateralDaTask taskId={taskAberta} aoFechar={() => setTaskAberta(null)} />

      {podeCriarTask ? (
        <FormularioDeTask
          aberto={criando}
          aoFechar={() => setCriando(false)}
          clientes={clientes}
          equipe={equipe}
        />
      ) : null}
    </div>
  );
}
