"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FolderOpen, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ComoOStatusAnda, SeletorDeStatus } from "@/components/shared/seletor-de-status";
import { UserAvatarGroup } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  EXIGENCIAS_DE_APROVACAO,
  EXPLICACAO_DA_EXIGENCIA,
  PRIORIDADES,
  ROTULOS_DE_EXIGENCIA,
  ROTULOS_DE_PRIORIDADE,
} from "@/lib/dominio/tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { EXPLICACAO_DO_STATUS } from "@/lib/tasks/state-machine";
import type { TaskCompleta } from "@/lib/dados/tasks";

import { atualizarTask, excluirTask } from "../acoes";
import { salvarTaskComoTipo } from "../../workflows/acoes";

const SEM_VALOR = "__sem__";

/**
 * A coluna da direita do detalhe: o que a Task é.
 *
 * Não existe campo de "responsável da task", e isso é o ponto do modelo: a
 * Task agrupa a demanda, quem tem dono é cada subtarefa. O que aparece aqui no
 * lugar é a EQUIPE — as pessoas que têm etapa dentro dela.
 *
 * O status também não se edita livremente: ele é calculado pelas subtarefas e
 * pelas rodadas de aprovação. O seletor oferece apenas os estados que não têm
 * como ser derivados, e o tooltip explica por que a Task está onde está.
 */
export function LateralDaTask({
  task,
  clientes,
  tipos,
  podeEditar,
  podeExcluir,
}: {
  task: TaskCompleta;
  clientes: { id: string; nome_empresa: string }[];
  tipos: { id: string; nome: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [nomeDoFluxo, setNomeDoFluxo] = useState("");

  function salvar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => atualizarTask(task.id, campos));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <aside className="h-fit space-y-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Status</Label>

        {/* O seletor mostra OS SETE, com os calculados desligados e o motivo.
            Antes eram dois, atrás de um "Marcar à mão…", e quem abria a lista
            concluía que o produto tinha dois status. */}
        <SeletorDeStatus
          status={task.status}
          podeEditar={podeEditar}
          aoMudar={(novo) => salvar({ status: novo })}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-text-secondary inline-flex cursor-help text-xs">
              {task.status_manual ? "Marcado à mão." : "Calculado pelas subtarefas."}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{EXPLICACAO_DO_STATUS[task.status]}</TooltipContent>
        </Tooltip>

        <ComoOStatusAnda />
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Progresso</Label>
        <p className="text-sm">
          {task.subtarefasConcluidas} de {task.subtarefasTotal} subtarefa
          {task.subtarefasTotal === 1 ? "" : "s"} concluída
          {task.subtarefasTotal === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Equipe</Label>
        {task.equipe.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma etapa atribuída ainda.</p>
        ) : (
          <UserAvatarGroup
            users={task.equipe.map((p) => ({ name: p.nome, src: p.avatar_url }))}
            size="sm"
          />
        )}
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Cliente</Label>
        {podeEditar ? (
          <Select value={task.client_id} onValueChange={(valor) => salvar({ client_id: valor })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm">{task.cliente?.nome_empresa ?? "—"}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Workflow</Label>
        {podeEditar ? (
          <Select
            value={task.task_type_id ?? SEM_VALOR}
            onValueChange={(valor) =>
              salvar({ task_type_id: valor === SEM_VALOR ? null : valor })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem tipo</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm">{task.tipo?.nome ?? "—"}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="data-inicio" className="text-muted-foreground text-xs">
            Início
          </Label>
          {podeEditar ? (
            <Input
              id="data-inicio"
              type="date"
              defaultValue={task.data_inicio}
              onBlur={(evento) => {
                if (evento.target.value && evento.target.value !== task.data_inicio) {
                  salvar({ data_inicio: evento.target.value });
                }
              }}
            />
          ) : (
            <p className="text-sm">
              {format(parseISO(task.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data-fim" className="text-muted-foreground text-xs">
            Fim
          </Label>
          {podeEditar ? (
            <Input
              id="data-fim"
              type="date"
              defaultValue={task.data_fim ?? ""}
              onBlur={(evento) => {
                if (evento.target.value !== (task.data_fim ?? "")) {
                  salvar({ data_fim: evento.target.value });
                }
              }}
            />
          ) : (
            <p className="text-sm">
              {task.data_fim
                ? format(parseISO(task.data_fim), "dd/MM/yyyy", { locale: ptBR })
                : "—"}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Prioridade</Label>
        {podeEditar ? (
          <Select value={task.prioridade} onValueChange={(valor) => salvar({ prioridade: valor })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p} value={p}>
                  {ROTULOS_DE_PRIORIDADE[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm">{ROTULOS_DE_PRIORIDADE[task.prioridade]}</p>
        )}
      </div>

      <Separator />

      {/* O que a demanda exige para ser dada por entregue.
          Fica ao lado do status de propósito: é a regra que decide se o
          "entregue" vai ser aceito, e descobrir isso só na hora de encerrar é
          descobrir tarde. */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Exigência de aprovação</Label>
        {podeEditar ? (
          <Select
            value={task.exigencia_aprovacao}
            onValueChange={(valor) => salvar({ exigencia_aprovacao: valor })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXIGENCIAS_DE_APROVACAO.map((e) => (
                <SelectItem key={e} value={e}>
                  {ROTULOS_DE_EXIGENCIA[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm">{ROTULOS_DE_EXIGENCIA[task.exigencia_aprovacao]}</p>
        )}
        <p className="text-muted-foreground text-xs">
          {EXPLICACAO_DA_EXIGENCIA[task.exigencia_aprovacao]}
        </p>
      </div>

      {/* O link de entrega: um só, e separado das referências. O que alguém
          procura semanas depois é a pasta do material final. */}
      <div className="space-y-1.5">
        <Label htmlFor="link-entrega" className="text-muted-foreground text-xs">
          Link de entrega
        </Label>
        {podeEditar ? (
          <Input
            id="link-entrega"
            defaultValue={task.link_entrega ?? ""}
            placeholder="https://figma.com/… ou https://drive.google.com/…"
            onBlur={(evento) => {
              if (evento.target.value !== (task.link_entrega ?? "")) {
                salvar({ link_entrega: evento.target.value });
              }
            }}
          />
        ) : task.link_entrega ? (
          <a
            href={task.link_entrega}
            target="_blank"
            rel="noreferrer"
            className="text-accent-strong flex items-center gap-1.5 text-sm hover:underline"
          >
            <FolderOpen aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{task.link_entrega}</span>
          </a>
        ) : (
          <p className="text-sm">—</p>
        )}
      </div>

      <Separator />

      {/* A Task não tem tempo próprio: o que aparece é a soma das subtarefas. */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Tempo</Label>
        <p className="text-sm">
          {formatarMinutos(task.tempoRealMinutos)} realizado
          <span className="text-muted-foreground">
            {" "}
            de {formatarMinutos(task.estimativaMinutos)} estimado
          </span>
        </p>
        <p className="text-muted-foreground text-xs">Soma das subtarefas.</p>
      </div>

      <p className="text-muted-foreground text-xs">
        Criada por {task.autor?.nome ?? "—"}.
      </p>

      {/* O caminho de volta: uma demanda que deu certo vira modelo para as
          próximas. Cria um WORKFLOW, que é o que o formulário de nova task
          oferece — gravar só a cadeia de etapas, sem o modelo que a carrega,
          deixaria o resultado inalcançável. O prazo de cada etapa é convertido
          em dias a partir do início desta Task. */}
      {podeExcluir && task.subtarefas.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-2">
            <Input
              value={nomeDoFluxo}
              onChange={(evento) => setNomeDoFluxo(evento.target.value)}
              placeholder="Nome do novo workflow"
              aria-label="Nome do workflow a criar a partir desta task"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
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
        </>
      ) : null}

      {podeExcluir ? (
        <>
          <Separator />
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
        </>
      ) : null}
    </aside>
  );
}
