"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { CheckCircle2, CornerDownRight, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { DateBadge } from "@/components/shared/date-badge";
import { DialogoDeTempo } from "@/components/shared/dialogo-de-tempo";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chamarAcao } from "@/lib/acoes/cliente";
import { situacaoDoPrazo } from "@/lib/dominio/tasks";
import { cn } from "@/lib/utils";

import { atualizarTask } from "../gestao-tasks/acoes";
import { atualizarSubtarefa } from "../gestao-tasks/acoes-de-itens";
import type { LinhaPessoal } from "./linhas";

/**
 * Lista de Minhas Tasks.
 *
 * Duas coisas a separam da lista da Gestão de Tasks, e é por isso que ela é um
 * componente próprio em vez de um parâmetro daquela: aqui cada linha pode ser
 * uma task OU uma subtarefa, e a única ação da linha é concluir. A lista
 * gerencial tem edição inline, seleção múltipla e agrupamento — coisas que
 * atrapalhariam quem só quer despachar o dia. Os selos, a tabela e o diálogo
 * de tempo são os mesmos componentes compartilhados.
 *
 * O recuo conta a história: subtarefa dentro de uma task que também é minha
 * aparece indentada logo abaixo dela; subtarefa dentro de task de outra
 * pessoa aparece como linha própria, com o título da task-mãe por cima em
 * letra menor — senão ela chegaria sem contexto nenhum.
 */
export function MinhaLista({
  linhas,
  prazos,
  aoAbrir,
}: {
  linhas: LinhaPessoal[];
  prazos: { hoje: string; fimDaSemana: string };
  aoAbrir: (taskId: string) => void;
}) {
  const router = useRouter();
  const [concluindo, setConcluindo] = useState<LinhaPessoal | null>(null);

  async function concluir(horas: number | null): Promise<boolean> {
    const linha = concluindo;
    if (!linha) return false;

    const campos: Record<string, unknown> =
      linha.tipo === "task" ? { status: "concluida" } : { concluida: true };
    if (horas !== null) campos.tempo_real_horas = horas;

    const resultado = await chamarAcao(() =>
      linha.tipo === "task"
        ? atualizarTask(linha.taskId, campos)
        : atualizarSubtarefa(linha.id, linha.taskId, campos),
    );

    if (!resultado.ok) {
      toast.error(resultado.error);
      return false;
    }
    toast.success(linha.tipo === "task" ? "Task concluída." : "Subtarefa concluída.");
    router.refresh();
    return true;
  }

  if (linhas.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nada nesta visão"
        description="Nenhuma task ou subtarefa sua combina com o filtro escolhido."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {linhas.map((linha) => {
              const situacao = situacaoDoPrazo(
                linha.prazo,
                linha.concluida,
                prazos.hoje,
                prazos.fimDaSemana,
              );

              return (
                <TableRow
                  key={linha.chave}
                  className={cn(
                    "cursor-pointer",
                    situacao === "atrasada" && "bg-destructive/5",
                    linha.concluida && "opacity-60",
                  )}
                  onClick={() => aoAbrir(linha.taskId)}
                >
                  <TableCell className={cn("max-w-sm", linha.recuada && "pl-8")}>
                    {/* Subtarefa de task alheia precisa do contexto da mãe. */}
                    {linha.tituloDaMae ? (
                      <p className="text-muted-foreground truncate text-xs">{linha.tituloDaMae}</p>
                    ) : null}

                    <span className="flex items-center gap-1.5">
                      {linha.tipo === "subtarefa" ? (
                        <CornerDownRight
                          aria-hidden
                          className="text-muted-foreground size-3.5 shrink-0"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-sm",
                          linha.tipo === "task" ? "font-medium" : "",
                          linha.concluida && "line-through",
                        )}
                      >
                        {linha.titulo}
                      </span>
                    </span>

                    {linha.tipo === "task" && linha.subtarefasTotal > 0 ? (
                      <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-xs tabular-nums">
                        <ListChecks aria-hidden className="size-3" />
                        {linha.subtarefasConcluidas}/{linha.subtarefasTotal}
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    {linha.cliente ? (
                      <Badge variant="outline" className="max-w-40 truncate">
                        {linha.cliente}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Interna</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {linha.prazo ? (
                      linha.concluida ? (
                        // Concluída não tem prazo "a vencer": o DateBadge
                        // pintaria de vermelho algo que já foi entregue.
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {format(parseISO(linha.prazo), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      ) : (
                        <DateBadge date={linha.prazo} />
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">Sem prazo</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {linha.tipo === "task" ? (
                      <StatusBadge status={linha.status} />
                    ) : (
                      <Badge variant={linha.concluida ? "success" : "secondary"}>
                        {linha.concluida ? "Concluída" : "Em aberto"}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <PriorityBadge priority={linha.prioridade} />
                  </TableCell>

                  <TableCell>
                    {linha.responsavel ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar
                          name={linha.responsavel.nome}
                          src={linha.responsavel.avatar_url}
                          size="sm"
                        />
                        <span className="truncate text-sm">{linha.responsavel.nome}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    {!linha.concluida && linha.podeConcluir ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Concluir ${linha.titulo}`}
                        title="Concluir"
                        onClick={(evento) => {
                          evento.stopPropagation();
                          setConcluindo(linha);
                        }}
                      >
                        <CheckCircle2 aria-hidden />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DialogoDeTempo
        aberto={concluindo !== null}
        aoFechar={() => setConcluindo(null)}
        titulo={concluindo?.tipo === "task" ? "Concluir esta task" : "Concluir esta subtarefa"}
        sugestao={concluindo?.sugestaoDeTempo ?? null}
        origemDaSugestao={concluindo?.origemDaSugestao}
        aoConcluir={concluir}
      />
    </>
  );
}
