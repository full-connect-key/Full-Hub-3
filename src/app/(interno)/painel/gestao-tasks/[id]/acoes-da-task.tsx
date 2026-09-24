"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Repeat, Trash2, Workflow } from "lucide-react";
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
  podeConfigurarRecorrencia,
}: {
  task: TaskCompleta;
  podeExcluir: boolean;
  /**
   * `is_atendimento()`, e não `is_gestor()`.
   *
   * Configurar recorrência é de quem ABRE demanda — e desde a 0006 isso
   * inclui o colaborador que está no Atendimento. Pendurá-la em `podeExcluir`
   * esconderia o botão exatamente de quem mais o usaria.
   */
  podeConfigurarRecorrencia: boolean;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [nomeDoFluxo, setNomeDoFluxo] = useState("");

  const ehRascunho = task.publicada_em === null;

  const mostraRecorrencia =
    podeConfigurarRecorrencia && !ehRascunho && task.recurrence_id === null;

  // Quem criou o rascunho descarta o próprio rascunho, mesmo sem ser gestão:
  // é dele, e ninguém mais o vê.
  if (!podeExcluir && !ehRascunho && !mostraRecorrencia) return null;

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

      {/* "TRANSFORMAR EM RECORRENTE" ABRE O EDITOR PRÉ-PREENCHIDO, e não
          grava nada. É obrigatório que seja assim: uma task não sabe a
          cadência dela. Ela tem um período, não uma frequência, e "toda
          segunda" ou "todo dia 5" é exatamente a informação que não está
          aqui — uma ação que salvasse direto teria que inventá-la, e a regra
          passaria a gerar sozinha, de madrugada, no ritmo que o sistema
          chutou.

          Some no rascunho: uma demanda que ainda não existe para a equipe não
          é candidata a virar a rotina de todo mês. */}
      {mostraRecorrencia ? (
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/painel/workflows?aba=recorrencias&regra=nova&deTask=${task.id}`}
            >
              <Repeat aria-hidden />
              Transformar em recorrente
            </Link>
          </Button>
          <p className="text-text-muted mt-1 text-xs">
            Abre a configuração com o título, o cliente, a pasta e as etapas
            desta demanda. Você escolhe a cadência antes de salvar — nada é
            gerado até lá.
          </p>
        </div>
      ) : null}

      {/* NO RASCUNHO É "DESCARTAR", e a confirmação é simples.
          Não há o que preservar: nada foi publicado, ninguém foi avisado,
          nenhuma aprovação existiu. Uma confirmação dupla aqui trataria de
          igual para igual jogar fora um bloco de notas e apagar uma campanha
          com três meses de histórico. */}
      {!podeExcluir && !ehRascunho ? null : ehRascunho ? (
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
