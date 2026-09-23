"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chamarAcao } from "@/lib/acoes/cliente";

import { Comentarios } from "../gestao-tasks/[id]/comentarios";
import { PropriedadesDaTask } from "../gestao-tasks/[id]/propriedades";
import { PrincipalDaTask, TituloDaTask } from "../gestao-tasks/[id]/principal";
import { Referencias } from "../gestao-tasks/[id]/referencias";
import { Subtarefas } from "../gestao-tasks/[id]/subtarefas";
import { carregarDetalheDaTask, type DetalheParaOPainel } from "./acoes";

/**
 * Detalhe da task por cima da tela, sem trocar de página.
 *
 * É o que diferencia a visão do dia a dia da visão gerencial: quem está
 * tocando cinco entregas não quer perder o lugar na lista a cada abertura.
 * Os blocos aqui dentro são exatamente os do Sprint 3 — briefing, subtarefas,
 * referências, comentários e a coluna de campos. Nada foi copiado; o que mudou
 * foi só quem manda em quê, pelas props de permissão.
 */
export function PainelLateralDaTask({
  taskId,
  aoFechar,
}: {
  taskId: string | null;
  aoFechar: () => void;
}) {
  // Guarda o detalhe junto do id de quem ele é: assim "está carregando" é
  // deduzido (o painel aponta para uma task cujo detalhe ainda não chegou), e
  // não precisa de um setState dentro do efeito só para ligar o spinner.
  const [carregado, setCarregado] = useState<{ id: string; dados: DetalheParaOPainel } | null>(
    null,
  );

  const detalhe = carregado && carregado.id === taskId ? carregado.dados : null;
  const carregando = taskId !== null && detalhe === null;

  /**
   * Busca o detalhe quando o painel passa a apontar para outra task.
   *
   * É efeito, e não ajuste durante o render, porque isto fala com um sistema
   * de fora — buscar no servidor em pleno render dispararia duas vezes em modo
   * concorrente. O `cancelado` descarta a resposta que chega tarde, para uma
   * task aberta e fechada rápido não sobrescrever a seguinte.
   */
  useEffect(() => {
    if (!taskId) return;

    let cancelado = false;
    void chamarAcao(() => carregarDetalheDaTask(taskId)).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        toast.error(resultado.error);
        aoFechar();
        return;
      }
      if (resultado.dados) setCarregado({ id: taskId, dados: resultado.dados });
    });

    return () => {
      cancelado = true;
    };
  }, [taskId, aoFechar]);

  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        aria-describedby={undefined}
      >
        {carregando || !detalhe ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 aria-hidden className="text-muted-foreground size-5 animate-spin" />
            <span className="sr-only">Carregando a task…</span>
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detalhe.task.status} />
                {!detalhe.podeGerenciar ? (
                  <span className="text-muted-foreground text-xs">
                    Você vê a demanda inteira; edita as subtarefas que são suas.
                  </span>
                ) : null}
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                  <Link href={`/painel/gestao-tasks/${detalhe.task.id}`}>
                    Abrir em página inteira
                    <ExternalLink aria-hidden />
                  </Link>
                </Button>
              </div>
              <SheetTitle className="sr-only">{detalhe.task.titulo}</SheetTitle>
              <SheetDescription className="sr-only">
                Detalhe da task, com briefing, subtarefas, referências e comentários.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-8 p-4 sm:p-6">
              <TituloDaTask task={detalhe.task} podeEditar={detalhe.podeGerenciar} />

              {/* Sem as ações da demanda inteira: excluir a task de dentro
                  de um painel que abriu por cima de uma lista deixa a pessoa
                  olhando para uma lista que ainda mostra o que acabou de
                  sumir. Quem quer excluir abre a página cheia — o link está
                  no cabeçalho deste painel. */}
              <PropriedadesDaTask
                task={detalhe.task}
                clientes={detalhe.clientes}
                tipos={detalhe.tipos}
                podeEditar={detalhe.podeGerenciar}
              />

              <PrincipalDaTask task={detalhe.task} podeEditar={detalhe.podeGerenciar} />

              <Subtarefas
                taskId={detalhe.task.id}
                subtarefas={detalhe.task.subtarefas}
                equipe={detalhe.equipe}
                podeGerenciar={detalhe.podeGerenciar}
                souGestor={detalhe.souGestor}
                usuarioId={detalhe.usuarioId}
                agoraDoServidor={detalhe.agora}
              />

              <Referencias
                taskId={detalhe.task.id}
                referencias={detalhe.task.referencias}
                urls={detalhe.urls}
                podeEditar={detalhe.podeGerenciar}
              />

              <Comentarios
                taskId={detalhe.task.id}
                comentarios={detalhe.task.comentarios}
                usuarioId={detalhe.usuarioId}
                podeModerar={detalhe.souGestor}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
