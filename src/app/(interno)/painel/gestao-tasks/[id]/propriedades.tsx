"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  CalendarRange,
  CircleDot,
  Clock,
  Flag,
  FolderOpen,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatus } from "@/components/shared/seletor-de-status";
import { UserAvatarGroup } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { EXPLICACAO_DO_STATUS } from "@/lib/tasks/state-machine";
import type { TaskCompleta } from "@/lib/dados/tasks";

import { atualizarTask, voltarACalcularStatus } from "../acoes";

const SEM_VALOR = "__sem__";

/**
 * As propriedades da Task, numa GRADE logo abaixo do título.
 *
 * Eram uma coluna estreita à direita, e o preço disso aparecia nos dois
 * lados: os campos ficavam espremidos num terço da largura — o link de
 * entrega cortado no meio, as duas datas lado a lado sem caber — enquanto o
 * briefing e as subtarefas, que são o conteúdo, abriam mão de um terço da
 * tela para eles.
 *
 * Numa grade em cima, cada campo é uma linha rótulo → valor, e o que vem
 * depois usa a largura inteira.
 *
 * O QUE NÃO EXISTE AQUI, e é o modelo e não esquecimento:
 *
 *   **Responsável da Task.** A Task agrupa a demanda; quem tem dono é cada
 *   subtarefa. O que aparece no lugar é a EQUIPE — as pessoas que têm etapa
 *   dentro dela. Um responsável único não representa uma campanha com
 *   conceito, KV, adaptações e mídia, cada um com uma pessoa.
 *
 *   **Tempo próprio.** O que a Task mostra é a SOMA das subtarefas.
 *
 * O status também não se digita: ele é calculado pelas subtarefas e pelas
 * rodadas de aprovação. O seletor mostra os sete e desliga os cinco que o
 * recálculo controla.
 */
export function PropriedadesDaTask({
  task,
  clientes,
  tipos,
  podeEditar,
}: {
  task: TaskCompleta;
  clientes: { id: string; nome_empresa: string }[];
  tipos: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  function voltarAoCalculo() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => voltarACalcularStatus(task.id));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  function salvar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => atualizarTask(task.id, campos));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <section className="bg-surface-card rounded-card border p-4">
      <dl className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
        <Campo icone={CircleDot} rotulo="Status">
          <SeletorDeStatus
            status={task.status}
            podeEditar={podeEditar}
            aoMudar={(novo) => salvar({ status: novo })}
            calculado={!task.status_manual}
            aoCalcular={() => voltarAoCalculo()}
          />
          {/* A linha diz de ONDE veio o status que está ali. Sem ela, quem
              marcou à mão e quem viu o cálculo trabalhar olham para a mesma
              tela e não têm como distinguir — e a pergunta seguinte ("por que
              essa task está em Aguardando aprovação?") fica sem resposta. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-text-secondary mt-1 inline-flex cursor-help text-xs">
                {task.status_manual
                  ? "Marcado à mão — o cálculo não mexe mais nele."
                  : "Calculado pelo andamento das etapas."}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {EXPLICACAO_DO_STATUS[task.status]}
            </TooltipContent>
          </Tooltip>
        </Campo>

        <Campo icone={Flag} rotulo="Prioridade">
          {podeEditar ? (
            <Select
              value={task.prioridade}
              onValueChange={(valor) => salvar({ prioridade: valor })}
            >
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
        </Campo>

        <Campo icone={CalendarRange} rotulo="Período">
          <div className="grid grid-cols-2 gap-2">
            {podeEditar ? (
              <>
                <Input
                  type="date"
                  defaultValue={task.data_inicio}
                  aria-label="Data de início"
                  onBlur={(evento) => {
                    if (evento.target.value && evento.target.value !== task.data_inicio) {
                      salvar({ data_inicio: evento.target.value });
                    }
                  }}
                />
                <Input
                  type="date"
                  defaultValue={task.data_fim ?? ""}
                  aria-label="Data de encerramento"
                  onBlur={(evento) => {
                    if (evento.target.value !== (task.data_fim ?? "")) {
                      salvar({ data_fim: evento.target.value });
                    }
                  }}
                />
              </>
            ) : (
              <p className="col-span-2 text-sm">
                {format(parseISO(task.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                {task.data_fim
                  ? ` → ${format(parseISO(task.data_fim), "dd/MM/yyyy", { locale: ptBR })}`
                  : ""}
              </p>
            )}
          </div>
        </Campo>

        <Campo icone={Building2} rotulo="Cliente">
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
        </Campo>

        <Campo icone={Workflow} rotulo="Workflow">
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
                <SelectItem value={SEM_VALOR}>Sem workflow</SelectItem>
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
        </Campo>

        {/* Um só, e separado das referências: o que alguém procura semanas
            depois é a pasta do material final. */}
        <Campo icone={FolderOpen} rotulo="Pasta de entrega">
          {podeEditar ? (
            <Input
              defaultValue={task.link_entrega ?? ""}
              aria-label="Pasta de entrega"
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
        </Campo>

        <Campo icone={Users} rotulo="Equipe">
          {task.equipe.length === 0 ? (
            <p className="text-text-muted text-sm">Nenhuma etapa atribuída ainda.</p>
          ) : (
            <UserAvatarGroup
              users={task.equipe.map((p) => ({ name: p.nome, src: p.avatar_url }))}
              size="sm"
            />
          )}
        </Campo>

        <Campo icone={Clock} rotulo="Tempo">
          <p className="text-sm">
            {formatarMinutos(task.tempoRealMinutos)} realizado
            <span className="text-text-muted">
              {" "}
              de {formatarMinutos(task.estimativaMinutos)} estimado
            </span>
          </p>
          <p className="text-text-muted text-xs">
            Soma das subtarefas — a Task não tem tempo próprio.
          </p>
        </Campo>
      </dl>

      <p className="text-text-muted mt-4 border-t pt-3 text-xs">
        Criada por {task.autor?.nome ?? "—"}.
      </p>
    </section>
  );
}

/**
 * Uma linha da grade: rótulo à esquerda, valor à direita.
 *
 * O rótulo tem largura FIXA para as linhas alinharem entre si — sem isso,
 * "Status" e "Pasta de entrega" empurrariam o controle para posições
 * diferentes, e a grade deixaria de se ler como coluna.
 */
function Campo({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: typeof CircleDot;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-x-3">
      <dt className="flex items-center gap-1.5 pt-2">
        <Icone aria-hidden className="text-text-muted size-3.5 shrink-0" />
        <Label className="text-text-secondary text-xs font-normal">{rotulo}</Label>
      </dt>
      <dd className="min-w-0 space-y-1">{children}</dd>
    </div>
  );
}
