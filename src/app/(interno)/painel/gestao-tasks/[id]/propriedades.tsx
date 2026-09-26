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
  FolderPlus,
  Loader2,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatus } from "@/components/shared/seletor-de-status";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { EXPLICACAO_DO_STATUS } from "@/lib/tasks/state-machine";
import type { TaskCompleta } from "@/lib/dados/tasks";

import {
  aplicarWorkflowNaTask,
  atualizarTask,
  criarPastaDeEntrega,
  voltarACalcularStatus,
} from "../acoes";

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
 *   **Período.** Sai das etapas desde a migration 0028 — a primeira que
 *   começa e a última que termina. Eram dois campos de data editáveis, e
 *   isso criava duas verdades sobre a mesma demanda.
 *
 * Período, Equipe e Tempo são desenhados como DERIVADOS: sem borda de input,
 * com a explicação embaixo. Com cara de campo, a primeira reação é tentar
 * digitar neles.
 */
export function PropriedadesDaTask({
  task,
  clientes,
  tipos,
  podeEditar,
  driveLigado,
}: {
  task: TaskCompleta;
  clientes: { id: string; nome_empresa: string }[];
  tipos: { id: string; nome: string }[];
  podeEditar: boolean;
  /**
   * A integração com o Drive está configurada?
   *
   * **Vem de cima, respondida no servidor.** `lib/drive/config.ts` é
   * `server-only` — tem a chave privada da conta de serviço dentro —, e um
   * valor exportado de lá não vale aqui. É a mesma fronteira que derrubou a
   * Gestão de Pessoas, e a convenção é esta: o servidor pergunta, o cliente
   * recebe a resposta como prop.
   */
  driveLigado: boolean;
}) {
  const temEtapas = task.subtarefas.length > 0;
  const router = useRouter();
  const [, iniciar] = useTransition();

  function aplicarWorkflow(tipoId: string | null) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => aplicarWorkflowNaTask(task.id, tipoId));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function voltarAoCalculo() {
    iniciar(async () => {
      const resultado = await chamarAcao(() => voltarACalcularStatus(task.id));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  /**
   * Cria a pasta no Drive.
   *
   * Tem transição própria e não usa `iniciar`: esta é a única ação da tela
   * que fala com um sistema de fora, e pode levar dois segundos. Com a
   * transição compartilhada, o campo inteiro ficaria desabilitado enquanto o
   * Google responde — e quem está digitando o título perderia o que digitou.
   */
  const [criandoPasta, criarPasta] = useTransition();

  function pastaNoDrive() {
    criarPasta(async () => {
      const resultado = await chamarAcao(() => criarPastaDeEntrega(task.id));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
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
          {task.publicada_em === null ? (
            // NO RASCUNHO O STATUS NÃO SE ESCOLHE. Ele ainda não faz parte do
            // trabalho de ninguém, e oferecer os sete aqui seria oferecer uma
            // escolha sobre uma demanda que não existe para a equipe. Ela
            // nasce em "Iniciar" no instante em que for criada.
            <Derivado
              vazio={false}
              explicacao="Enquanto for rascunho não há status. Ao criar a task, ele passa a sair do andamento das etapas."
              quandoVazio=""
            >
              Rascunho
            </Derivado>
          ) : (
            <SeletorDeStatus
              status={task.status}
              podeEditar={podeEditar}
              aoMudar={(novo) => salvar({ status: novo })}
              calculado={!task.status_manual}
              aoCalcular={() => voltarAoCalculo()}
            />
          )}
          {/* A linha diz de ONDE veio o status que está ali. Sem ela, quem
              marcou à mão e quem viu o cálculo trabalhar olham para a mesma
              tela e não têm como distinguir — e a pergunta seguinte ("por que
              essa task está em Aguardando aprovação?") fica sem resposta. */}
          {task.publicada_em === null ? null : (
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
          )}
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

        {/* O PERÍODO É DERIVADO DAS ETAPAS (migration 0028), e por isso não
            é mais um par de campos de data. Eram dois inputs no topo, e isso
            criava duas verdades sobre a mesma demanda: a que a pessoa digitou
            e a que as etapas dizem. Quem escreve agora é o trigger.

            E campo derivado precisa PARECER derivado — sem borda de input,
            com a explicação embaixo. Com cara de campo, a primeira reação é
            tentar digitar nele. */}
        <Campo icone={CalendarRange} rotulo="Período">
          <Derivado
            vazio={task.data_fim === null}
            explicacao="Sai das datas das etapas — a primeira que começa e a última que termina."
            quandoVazio="Definido pelas subtarefas."
          >
            {format(parseISO(task.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
            {task.data_fim
              ? ` → ${format(parseISO(task.data_fim), "dd/MM/yyyy", { locale: ptBR })}`
              : ""}
          </Derivado>
        </Campo>

        <Campo icone={Building2} rotulo="Cliente">
          {podeEditar ? (
            <Select
              value={task.client_id ?? ""}
              onValueChange={(valor) => salvar({ client_id: valor })}
            >
              <SelectTrigger
                className="w-full"
                // O rascunho nasce sem cliente, e é o campo que a publicação
                // aponta primeiro. O anel marca onde olhar sem precisar de um
                // aviso em vermelho antes de a pessoa ter errado alguma coisa.
                data-falta={task.client_id === null ? "" : undefined}
              >
                <SelectValue placeholder="Escolha o cliente" />
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

        {/* ESCOLHER O WORKFLOW GERA AS ETAPAS AQUI MESMO. Antes isso só
            acontecia no diálogo de criação, e na tela de detalhe o campo era
            um rótulo que não fazia nada — quem quisesse a cadeia pronta tinha
            que abrir outra demanda.

            Com etapas já montadas, pergunta antes: trocar de workflow
            substitui o que está lá, e ninguém espera perder trabalho ao
            trocar um campo de um seletor. */}
        <Campo icone={Workflow} rotulo="Workflow">
          {podeEditar ? (
            <Select
              value={task.task_type_id ?? SEM_VALOR}
              onValueChange={(valor) => {
                const novo = valor === SEM_VALOR ? null : valor;
                if (
                  temEtapas &&
                  !window.confirm(
                    "Aplicar este workflow substitui as subtarefas que já estão nesta demanda. Continuar?",
                  )
                ) {
                  return;
                }
                aplicarWorkflow(novo);
              }}
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
            <div className="flex flex-wrap items-center gap-2">
              <Input
                key={task.link_entrega ?? ""}
                defaultValue={task.link_entrega ?? ""}
                aria-label="Pasta de entrega"
                placeholder="https://figma.com/… ou https://drive.google.com/…"
                className="min-w-48 flex-1"
                onBlur={(evento) => {
                  if (evento.target.value !== (task.link_entrega ?? "")) {
                    salvar({ link_entrega: evento.target.value });
                  }
                }}
              />
              {/*
                O BOTÃO SÓ APARECE QUANDO HÁ ONDE CRIAR, e some quando já há
                pasta. Um "Criar no Drive" ao lado de um endereço preenchido
                convida a criar a segunda pasta da mesma demanda — e o Drive
                aceita duas irmãs com o mesmo nome sem reclamar, o que espalha
                o material entre as duas. Trocar de pasta continua sendo
                possível pelo campo, que é o que a 0015 pede: pasta muda de
                lugar.

                Com o Drive desligado ele não aparece: um botão que responde
                "não configurado" ensina a não clicar nele.
              */}
              {driveLigado && !task.link_entrega ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={criandoPasta}
                  onClick={pastaNoDrive}
                >
                  {criandoPasta ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <FolderPlus aria-hidden className="size-4" />
                  )}
                  Criar no Drive
                </Button>
              ) : null}
            </div>
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
          <Derivado
            vazio={task.equipe.length === 0}
            explicacao="São as pessoas com etapa nesta demanda. Muda quando as etapas mudam."
            quandoVazio="Nenhuma etapa atribuída ainda."
          >
            <UserAvatarGroup
              users={task.equipe.map((p) => ({
                name: p.nome,
                src: p.avatar_url,
              }))}
              size="sm"
            />
          </Derivado>
        </Campo>

        <Campo icone={Clock} rotulo="Tempo">
          <Derivado
            vazio={false}
            explicacao="Soma das subtarefas — a Task não tem tempo próprio."
            quandoVazio=""
          >
            {formatarMinutos(task.tempoRealMinutos)} realizado
            <span className="text-text-muted">
              {" "}
              de {formatarMinutos(task.estimativaMinutos)} estimado
            </span>
          </Derivado>
        </Campo>
      </dl>

      <p className="text-text-muted mt-4 border-t pt-3 text-xs">
        Criada por {task.autor?.nome ?? "—"}.
      </p>
    </section>
  );
}

/**
 * Um valor que a demanda NÃO tem, e sim calcula.
 *
 * Período, Equipe e Tempo saem das etapas. Desenhá-los como input convida a
 * digitar, e digitar ali criaria a segunda verdade que os triggers existem
 * para impedir — então eles não têm borda, não têm fundo de campo, e trazem
 * embaixo a frase que diz de onde o número veio.
 *
 * Quando ainda não há de onde calcular, a frase ocupa o lugar do valor: "—"
 * diria que o valor é vazio, e o que se quer dizer é que ele ainda não tem
 * origem.
 */
function Derivado({
  vazio,
  explicacao,
  quandoVazio,
  children,
}: {
  vazio: boolean;
  explicacao: string;
  quandoVazio: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {vazio ? (
        <p className="text-text-muted py-2 text-sm italic">{quandoVazio}</p>
      ) : (
        <p className="py-2 text-sm">{children}</p>
      )}
      {explicacao ? (
        <p className="text-text-muted text-xs">{explicacao}</p>
      ) : null}
    </div>
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
        <Label className="text-text-secondary text-xs font-normal">
          {rotulo}
        </Label>
      </dt>
      <dd className="min-w-0 space-y-1">{children}</dd>
    </div>
  );
}
