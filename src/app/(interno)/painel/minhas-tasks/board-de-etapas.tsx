"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Link2, Lock } from "lucide-react";
import { toast } from "sonner";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { Cronometro } from "@/components/shared/cronometro";
import { DateBadge } from "@/components/shared/date-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { COR_DA_PRIORIDADE, situacaoDoPrazo } from "@/lib/dominio/tasks";
import type { Prazos } from "@/lib/dados/minhas-tasks";
import {
  ROTULO_DA_APROVACAO,
  ROTULOS_DE_SUBTAREFA,
  STATUS_DE_SUBTAREFA,
} from "@/lib/tasks/state-machine";
import type { SubtaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { moverSubtarefa } from "../gestao-tasks/acoes-de-itens";
import type { LinhaPessoal } from "./linhas";

/**
 * O board de Minhas Tasks — um card por ETAPA, e não por demanda.
 *
 * **Por que este board existe, em vez de reusar o da Gestão de Tasks.** Até
 * aqui as três visões de Minhas Tasks discordavam entre si: a Lista já
 * mostrava uma linha por etapa, e o board mostrava um card por demanda com um
 * selo dizendo "5 subtarefas suas". Cinco trabalhos, cinco prazos, cinco
 * andamentos — num card só, numa coluna só, com o status da DEMANDA decidindo
 * em que coluna ele cai. Quem tinha as cinco etapas espalhadas entre "em
 * andamento", "em ajustes" e "concluída" via um card, e ele não estava certo
 * para nenhuma das cinco.
 *
 * É a mesma regra que a Lista já seguia, aplicada ao board: **a unidade de
 * trabalho é a subtarefa.** O board da Gestão de Tasks continua sendo por
 * demanda, e isso está certo — lá a pergunta é "onde está cada demanda da
 * agência?". Aqui a pergunta é "o que eu faço agora?", e a resposta não é uma
 * demanda.
 *
 * **As colunas são os SEIS status da etapa**, não os sete da Task. São enums
 * diferentes no banco (`subtask_status` × `task_status`): a etapa tem
 * "Enviada para aprovação" e não tem "Entregue" nem "Concluído" separados.
 * Usar as colunas da Task obrigaria a inventar um de-para, e um de-para entre
 * dois enums é o lugar onde as duas verdades começam a divergir.
 *
 * **"Não iniciada", e não "Iniciar" como no board da demanda.** Lá o rótulo é
 * "Iniciar" porque o cabeçalho da coluna é a única coisa escrita ali. Aqui
 * cada card carrega o botão de ação da etapa, e o primeiro deles se chama
 * exatamente "Iniciar": os dois com a mesma palavra seriam duas vezes a mesma
 * coisa na mesma coluna.
 *
 * **E aqui O CARD ARRASTA**, ao contrário do board de demandas nesta mesma
 * tela. Não é inconsistência, é a mesma razão invertida: o status da Task é
 * calculado pelas subtarefas, então mover aquele card prometia uma mudança que
 * o recálculo desfazia em seguida. O status da ETAPA é escrito por quem a faz
 * — mover o card aqui é a própria ação, e ela vale.
 *
 * Quem recusa uma transição impossível é o banco, e a recusa dele diz o
 * caminho ("A rodada é criada pela ação Enviar para aprovação"). É a mesma
 * decisão do seletor de status: nada aparece desligado, e a pessoa descobre o
 * porquê onde ela tentou. O card volta para a coluna de origem sozinho.
 */

/** As colunas, na ordem em que a etapa anda. */
const COLUNAS: { status: SubtaskStatus; titulo: string }[] = [
  { status: "nao_iniciada", titulo: ROTULOS_DE_SUBTAREFA.nao_iniciada },
  { status: "em_andamento", titulo: ROTULOS_DE_SUBTAREFA.em_andamento },
  {
    status: "aguardando_informacoes",
    titulo: ROTULOS_DE_SUBTAREFA.aguardando_informacoes,
  },
  {
    status: "enviada_aprovacao",
    titulo: ROTULOS_DE_SUBTAREFA.enviada_aprovacao,
  },
  { status: "em_ajustes", titulo: ROTULOS_DE_SUBTAREFA.em_ajustes },
  { status: "concluida", titulo: ROTULOS_DE_SUBTAREFA.concluida },
];

// As colunas precisam cobrir o enum inteiro, como os grupos do seletor de
// status cobrem o dele. Um valor novo sem coluna some do board sem erro e sem
// aviso: a etapa simplesmente não aparece, e só se descobre no dia em que
// alguém for procurar por ela.
const SEM_COLUNA = STATUS_DE_SUBTAREFA.filter(
  (status) => !COLUNAS.some((coluna) => coluna.status === status),
);
if (SEM_COLUNA.length > 0) {
  throw new Error(
    `Status de subtarefa sem coluna no board de Minhas Tasks: ${SEM_COLUNA.join(", ")}. ` +
      "Toda etapa precisa cair em alguma coluna, senão ela some da tela sem avisar.",
  );
}

function Card({
  linha,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
  arrastando,
}: {
  linha: LinhaPessoal;
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir?: (taskId: string) => void;
  arrastando?: boolean;
}) {
  const sub = linha.subtarefa;
  const situacao = situacaoDoPrazo(
    sub.prazo,
    sub.status === "concluida",
    prazos.hoje,
    prazos.fimDaSemana,
  );

  return (
    <article
      className={cn(
        "bg-card relative overflow-hidden rounded-lg border p-3 shadow-xs",
        situacao === "atrasada" && "border-destructive/40",
        arrastando && "opacity-60",
      )}
    >
      {/* Faixa de prioridade, como no board da demanda: dá para varrer a
          coluna sem ler os selos. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          COR_DA_PRIORIDADE[sub.prioridade],
        )}
      />

      <div className="space-y-2 pl-2">
        {/* SÓ O TÍTULO é botão, e não o card inteiro: as ações da etapa moram
            aqui dentro, e botão dentro de botão é HTML inválido — o navegador
            desfaz o aninhamento e o clique passa a cair no lugar errado. */}
        {aoAbrir ? (
          <button
            type="button"
            onClick={() => aoAbrir(linha.taskId)}
            className="hover:text-accent-strong block max-w-full text-left text-sm leading-snug font-medium"
          >
            {sub.titulo}
          </button>
        ) : (
          <p className="text-sm leading-snug font-medium">{sub.titulo}</p>
        )}

        {/* A LINHAGEM: `Cliente · Demanda › Etapa de cima`. É o que responde
            "por que estou fazendo isto?" sem o card virar um card de demanda
            de novo.

            UMA LINHA SÓ, e truncada: deixando quebrar, o "·" ficava sozinho no
            fim da primeira linha e a demanda começava na segunda — separador
            pendurado, que é ruído. A linhagem é contexto; quem precisa dela
            inteira clica no título e abre a demanda. */}
        <p className="text-muted-foreground flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden text-xs whitespace-nowrap">
          {/* O CLIENTE TEM PRIORIDADE no corte, e é escolha: ele é o pedaço
              curto e o que identifica de relance. Deixando os dois truncarem
              igual, a primeira versão mostrava "Mundo Ve… · Revisar o manual
              de atendi…" — dois pedaços pela metade em vez de um inteiro e um
              cortado. O teto de 45% impede um nome comprido de empurrar a
              demanda inteira para fora. */}
          {linha.demanda.cliente ? (
            <>
              <span className="max-w-[45%] shrink-0 truncate">
                {linha.demanda.cliente}
              </span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="truncate">{linha.demanda.titulo}</span>
          {sub.etapaDeCima ? (
            <>
              <ChevronRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{sub.etapaDeCima}</span>
            </>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={sub.prioridade} />

          {/* DateBadge é para prazo a vencer; etapa concluída mostra a data
              crua, senão o passado apareceria em vermelho como atraso. */}
          {sub.prazo ? (
            sub.status === "concluida" ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {format(parseISO(sub.prazo), "dd/MM/yy", { locale: ptBR })}
              </span>
            ) : (
              <DateBadge date={sub.prazo} />
            )
          ) : (
            <span className="text-muted-foreground text-xs">Sem prazo</span>
          )}

          {sub.requer_aprovacao ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground inline-flex">
                  <Lock className="size-3.5" aria-label="Exige aprovação" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Exige aprovação{" "}
                {ROTULO_DA_APROVACAO[sub.tipo_aprovacao ?? "interna"]}
              </TooltipContent>
            </Tooltip>
          ) : null}

          {sub.dependenciasAbertas.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-warning inline-flex">
                  <Link2
                    className="size-3.5"
                    aria-label="Aguardando outra etapa"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Aguardando: {sub.dependenciasAbertas.join(", ")}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {/* O relógio e o botão ficam no card, como ficam na Lista: um board em
            que só dá para olhar obriga a trocar de visão para trabalhar.
            `onPointerDown` parado aqui é o que impede o arrasto de começar
            quando a pessoa queria só clicar em "Concluir". */}
        <div
          className="flex flex-wrap items-center justify-between gap-2"
          onPointerDown={(evento) => evento.stopPropagation()}
        >
          <Cronometro dados={sub} agoraDoServidor={prazos.agora} />
          <AcoesDaSubtarefa
            subtarefa={sub}
            usuarioId={usuarioId}
            souGestor={souGestor}
            rodadaPendenteId={
              sub.rodadas.find((r) => r.status === "pendente")?.id ?? null
            }
          />
        </div>
      </div>
    </article>
  );
}

function CardArrastavel(props: {
  linha: LinhaPessoal;
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir?: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.linha.subtarefa.id,
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-none">
      <Card {...props} arrastando={isDragging} />
    </div>
  );
}

function Coluna({
  titulo,
  status,
  linhas,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
}: {
  titulo: string;
  status: SubtaskStatus;
  linhas: LinhaPessoal[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir?: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-xl border transition-colors",
        isOver && "border-accent-strong bg-accent",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {linhas.length}
        </span>
      </header>

      <div className="flex max-h-[calc(100dvh-20rem)] flex-col gap-2 overflow-y-auto p-2">
        {linhas.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">
            Nada aqui.
          </p>
        ) : (
          linhas.map((linha) => (
            <CardArrastavel
              key={linha.chave}
              linha={linha}
              prazos={prazos}
              usuarioId={usuarioId}
              souGestor={souGestor}
              aoAbrir={aoAbrir}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function BoardDeEtapas({
  linhas,
  prazos,
  usuarioId,
  souGestor,
  aoAbrir,
}: {
  linhas: LinhaPessoal[];
  prazos: Prazos;
  usuarioId: string;
  souGestor: boolean;
  aoAbrir?: (taskId: string) => void;
}) {
  const router = useRouter();
  const [arrastando, setArrastando] = useState<string | null>(null);
  // Cópia local para a atualização otimista: o card muda de coluna na hora, e
  // volta sozinho se o banco recusar.
  const [otimistas, setOtimistas] = useState<Record<string, SubtaskStatus>>({});

  const sensores = useSensors(
    // Só começa a arrastar depois de 6px, senão um clique no título viraria um
    // arrasto acidental.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const comStatusAtual = useMemo(
    () =>
      linhas.map((linha) => {
        const otimista = otimistas[linha.subtarefa.id];
        if (!otimista) return linha;
        return {
          ...linha,
          subtarefa: { ...linha.subtarefa, status: otimista },
        };
      }),
    [linhas, otimistas],
  );

  const porColuna = useMemo(() => {
    const mapa = new Map<SubtaskStatus, LinhaPessoal[]>();
    for (const { status } of COLUNAS) {
      mapa.set(
        status,
        comStatusAtual.filter((linha) => linha.subtarefa.status === status),
      );
    }
    return mapa;
  }, [comStatusAtual]);

  const arrastada =
    comStatusAtual.find((l) => l.subtarefa.id === arrastando) ?? null;

  function aoComecar(evento: DragStartEvent) {
    setArrastando(String(evento.active.id));
  }

  async function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    const id = String(evento.active.id);
    const destino = evento.over
      ? (String(evento.over.id) as SubtaskStatus)
      : null;
    if (!destino) return;

    const original = linhas.find((l) => l.subtarefa.id === id);
    if (!original) return;

    const anterior = otimistas[id] ?? original.subtarefa.status;
    if (anterior === destino) return;

    setOtimistas((atual) => ({ ...atual, [id]: destino }));

    const resultado = await chamarAcao(() =>
      moverSubtarefa(id, original.taskId, destino),
    );

    if (!resultado.ok) {
      // Rollback, e a mensagem do banco inteira: é ela que diz o caminho
      // quando a transição não é possível a partir daqui.
      setOtimistas((atual) => ({ ...atual, [id]: anterior }));
      toast.error(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <DndContext sensors={sensores} onDragStart={aoComecar} onDragEnd={aoSoltar}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map(({ status, titulo }) => (
          <Coluna
            key={status}
            status={status}
            titulo={titulo}
            linhas={porColuna.get(status) ?? []}
            prazos={prazos}
            usuarioId={usuarioId}
            souGestor={souGestor}
            aoAbrir={aoAbrir}
          />
        ))}
      </div>

      <DragOverlay>
        {arrastada ? (
          <Card
            linha={arrastada}
            prazos={prazos}
            usuarioId={usuarioId}
            souGestor={souGestor}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
