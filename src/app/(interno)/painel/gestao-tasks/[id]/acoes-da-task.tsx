"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { TaskCompleta } from "@/lib/dados/tasks";

import { descartarRascunho, excluirTask } from "../acoes";
import { salvarTaskComoTipo } from "../../workflows/acoes";

/**
 * O que se faz COM a demanda inteira — não com um campo dela.
 *
 * Saiu da coluna de propriedades quando ela virou grade. Salvar como workflow
 * e excluir não são propriedades da Task: são ações sobre ela, e no meio dos
 * campos ficavam parecendo mais dois campos. No fim da página, depois do
 * conteúdo, é onde se procura o que encerra alguma coisa — e é longe do
 * caminho de quem só veio ler o briefing.
 */
export function AcoesDaTask({
  task,
  podeExcluir,
}: {
  task: TaskCompleta;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [nomeDoFluxo, setNomeDoFluxo] = useState("");

  const ehRascunho = task.publicada_em === null;

  // Quem criou o rascunho descarta o próprio rascunho, mesmo sem ser gestão:
  // é dele, e ninguém mais o vê.
  if (!podeExcluir && !ehRascunho) return null;

  return (
    <section className="space-y-4 border-t pt-6">
      {/* O caminho de volta: uma demanda que deu certo vira modelo para as
          próximas. Cria um WORKFLOW, que é o que o formulário de nova task
          oferece — gravar só a cadeia de etapas, sem o modelo que a carrega,
          deixaria o resultado inalcançável. O prazo de cada etapa é convertido
          em dias a partir do início desta Task. */}
      {task.subtarefas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={nomeDoFluxo}
            onChange={(evento) => setNomeDoFluxo(evento.target.value)}
            placeholder="Nome do novo workflow"
            aria-label="Nome do workflow a criar a partir desta task"
            className="max-w-xs"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={salvando || nomeDoFluxo.trim().length < 2}
            onClick={() =>
              iniciar(async () => {
                const resultado = await chamarAcao(() =>
                  salvarTaskComoTipo(task.id, nomeDoFluxo, null),
                );
                if (!resultado.ok) toast.error(resultado.error);
                else {
                  toast.success(resultado.mensagem);
                  setNomeDoFluxo("");
                }
              })
            }
          >
            <Workflow aria-hidden />
            Salvar as subtarefas como workflow
          </Button>
        </div>
      ) : null}

      {/* NO RASCUNHO É "DESCARTAR", e a confirmação é simples.
          Não há o que preservar: nada foi publicado, ninguém foi avisado,
          nenhuma aprovação existiu. Uma confirmação dupla aqui trataria de
          igual para igual jogar fora um bloco de notas e apagar uma campanha
          com três meses de histórico. */}
      {ehRascunho ? (
        <ConfirmDialog
          title="Descartar este rascunho?"
          description="Ele some com o que você escreveu até agora. Ninguém chegou a vê-lo."
          confirmLabel="Descartar"
          destructive
          onConfirm={async () => {
            const resultado = await chamarAcao(() => descartarRascunho(task.id));
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success(resultado.mensagem);
              router.push("/painel/gestao-tasks");
            }
          }}
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive" disabled={salvando}>
              <Trash2 aria-hidden />
              Descartar rascunho
            </Button>
          }
        />
      ) : (
        <ConfirmDialog
          title="Excluir esta task?"
          description="A demanda, as subtarefas, as rodadas de aprovação e o histórico somem junto. Não dá para desfazer."
          confirmLabel="Excluir"
          destructive
          onConfirm={async () => {
            const resultado = await chamarAcao(() => excluirTask(task.id));
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success("Task excluída.");
              router.push("/painel/gestao-tasks");
            }
          }}
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive" disabled={salvando}>
              <Trash2 aria-hidden />
              Excluir task
            </Button>
          }
        />
      )}
    </section>
  );
}
