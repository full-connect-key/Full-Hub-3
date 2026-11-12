"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CornerDownRight,
  GripVertical,
  Layers,
  Link2,
  Loader2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AcoesDaSubtarefa } from "@/components/shared/acoes-da-subtarefa";
import { Cronometro } from "@/components/shared/cronometro";
import { DateBadge } from "@/components/shared/date-badge";
import { LinhaDeTrabalho } from "@/components/shared/linha-de-trabalho";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { SeletorDeResponsavel } from "@/components/shared/seletor-de-responsavel";
import { UserAvatarGroup } from "@/components/shared/user-avatar";
import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { chamarAcao } from "@/lib/acoes/cliente";
import { emArvore, fazASubtarefa, folhas } from "@/lib/dominio/tasks";
import { formatarMinutos } from "@/lib/dominio/tempo";
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { Pessoa, SubtarefaDetalhada } from "@/lib/dados/tasks";
import type { SubtaskStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  atualizarSubtarefa,
  criarSubtarefa,
  moverSubtarefa,
  removerSubtarefa,
  reordenarSubtarefas,
} from "../acoes-de-itens";
import { PainelDaSubtarefa } from "./painel-da-subtarefa";

/**
 * A lista de etapas — o centro do detalhe da Task.
 *
 * Cada linha responde, de relance: quem faz, para quando, em que pé está, se
 * precisa passar por aprovação (o cadeado) e se está esperando outra etapa (o
 * elo). Clicar abre o painel lateral com o resto, sem trocar de página.
 *
 * SÃO TRÊS NÍVEIS: a demanda, a etapa e a sub-etapa (migration 0022). E o que
 * governa o desenho é uma regra só — **quem tem sub-etapa vira agrupadora**,
 * e agrupadora não é unidade de trabalho. A linha dela perde o responsável, o
 * prazo, o relógio e os botões de ação, e no lugar mostra a soma das filhas.
 * Não é omissão: esses campos passaram a ser das filhas, e desenhá-los na mãe
 * mostraria um dono e uma data que já não valem para nada.
 *
 * Criar e apagar etapa é do Atendimento e da gestão. Trabalhar nela é de quem
 * é responsável — e é por isso que o botão de ação de cada linha é o mesmo
 * componente compartilhado: ele pergunta à máquina de estados, não ao layout.
 */
export function Subtarefas({
  taskId,
  subtarefas,
  equipe,
  podeGerenciar,
  souGestor,
  usuarioId,
  agoraDoServidor,
}: {
  taskId: string;
  subtarefas: SubtarefaDetalhada[];
  equipe: Pessoa[];
  /** Atendimento ou gestão: quem pode acrescentar e remover etapas. */
  podeGerenciar: boolean;
  souGestor: boolean;
  usuarioId: string;
  /** O instante medido no servidor, para o cronômetro começar de lá. */
  agoraDoServidor: number;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [novo, setNovo] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  /** Em qual etapa o campo de nova sub-etapa está aberto. */
  const [aninhandoEm, setAninhandoEm] = useState<string | null>(null);
  const [novaFilha, setNovaFilha] = useState("");

  /**
   * A ORDEM OTIMISTA, e ela é o que o pedido chama de "já mudem de ordem".
   *
   * Decisão do usuário: *"quero poder mudar a ordem das subtarefas só clicando
   * e arrastando, para que elas já entrem automaticamente"* e, logo depois,
   * *"no caso, preciso que arrastando, elas já mudem de ordem de
   * visualização"*. Sem a cópia local a linha voltaria para o lugar antigo e
   * só pularia para o novo quando o `router.refresh()` terminasse — o arrasto
   * pareceria não ter funcionado, e a pessoa arrastaria de novo.
   *
   * É a forma do board de demandas, que já guarda uma cópia local do status
   * pela mesma razão. E ela é por NÍVEL: a chave é o id do pai, ou `"raiz"`.
   */
  const [ordemLocal, setOrdemLocal] = useState<Record<string, string[]>>({});

  const sensores = useSensors(
    // Os MESMOS 6px do board, e o número não é estilo: a linha também ABRE o
    // modal no clique, então sem a distância um clique viraria arrasto.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const arvore = useMemo(() => {
    const bruta = emArvore(subtarefas);

    /** Reordena uma lista pela cópia local, mantendo quem ela não conhece. */
    function aplicar<T>(
      itens: T[],
      chave: string,
      id: (item: T) => string,
    ): T[] {
      const ordem = ordemLocal[chave];
      if (!ordem) return itens;
      const indice = new Map(ordem.map((cada, i) => [cada, i]));
      // `?? itens.length` põe no FIM o que a cópia local não conhece: a etapa
      // criada depois do arrasto e antes do refresh. Sem isso ela iria para o
      // topo, que é onde ninguém a pôs.
      return [...itens].sort(
        (a, b) =>
          (indice.get(id(a)) ?? itens.length) -
          (indice.get(id(b)) ?? itens.length),
      );
    }

    const raizes = aplicar(bruta, "raiz", (r) => r.etapa.id);
    return raizes.map(({ etapa, filhas }) => ({
      etapa,
      filhas: aplicar(filhas, etapa.id, (f) => f.id),
    }));
  }, [subtarefas, ordemLocal]);
  // O CONTADOR É DE FOLHAS. Contar a agrupadora faria "3 de 4" ficar parado
  // para sempre: ela só conclui depois das filhas, então a conta nunca fecha.
  const asFolhas = folhas(subtarefas);
  const concluidas = asFolhas.filter((s) => s.status === "concluida").length;
  const emAberto = subtarefas.find((s) => s.id === aberta) ?? null;

  /**
   * QUEM FAZ ESTA ETAPA, gravado no clique.
   *
   * Aqui o clique É a escrita, porque uma linha de lista não tem botão de
   * salvar — é a assimetria que `SeletorDeResponsavel` existe para servir: no
   * modal ele só marca a escolha, e quem oficializa é o Salvar.
   */
  function trocarResponsavel(
    sub: SubtarefaDetalhada,
    responsavelId: string | null,
  ) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        atualizarSubtarefa(sub.id, taskId, { responsavel_id: responsavelId }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  /**
   * A ORDEM NOVA, gravada no soltar.
   *
   * **REORDENA DENTRO DO NÍVEL, nunca entre níveis.** Tirar uma sub-etapa de
   * dentro da mãe é mexer em `parent_id`, que é outra operação com outras
   * travas — `subtasks_agrupadora` recusa o neto, e a mãe que perde a última
   * filha volta a ser unidade de trabalho (0022). O que o arrasto faz é
   * exatamente o que o pedido diz: mudar a ordem.
   *
   * **E `ordem` só é comparada entre IRMÃOS**, o que é o que torna isto
   * barato: `emArvore()` ordena as raízes entre si e as filhas de cada mãe
   * entre si, então gravar `1..n` num nível não colide com nenhum outro.
   *
   * **A cópia local é escrita ANTES da ida ao banco** e desfeita na recusa: é
   * o board de demandas palavra por palavra.
   */
  function reordenar(chave: string, ids: string[], anterior: string[]) {
    setOrdemLocal((atual) => ({ ...atual, [chave]: ids }));
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        reordenarSubtarefas(taskId, ids),
      );
      if (!resultado.ok) {
        setOrdemLocal((atual) => ({ ...atual, [chave]: anterior }));
        toast.error(resultado.error);
      } else {
        router.refresh();
      }
    });
  }

  /**
   * DESCOBRE O NÍVEL pelo id de quem saiu, e só então reordena.
   *
   * Com um `DndContext` só, este é o lugar onde "arrastar entre níveis não faz
   * nada" acontece: se o destino não está na lista daquele nível,
   * `indexOf` devolve -1 e `aoSoltar` desiste.
   */
  function aoSoltarNoNivel(evento: DragEndEvent) {
    const quem = String(evento.active.id);

    const raizes = arvore.map(({ etapa }) => etapa.id);
    if (raizes.includes(quem)) {
      aoSoltar("raiz", raizes, evento);
      return;
    }

    const mae = arvore.find(({ filhas }) => filhas.some((f) => f.id === quem));
    if (mae) {
      aoSoltar(
        mae.etapa.id,
        mae.filhas.map((f) => f.id),
        evento,
      );
    }
  }

  /** Traduz o soltar do dnd-kit na lista de ids na ordem nova. */
  function aoSoltar(chave: string, atuais: string[], evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const de = atuais.indexOf(String(active.id));
    const para = atuais.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    const nova = [...atuais];
    nova.splice(para, 0, ...nova.splice(de, 1));
    reordenar(chave, nova, atuais);
  }

  function adicionar(titulo: string, parentId: string | null) {
    const limpo = titulo.trim();
    if (limpo.length === 0) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        criarSubtarefa(taskId, { titulo: limpo, parent_id: parentId }),
      );
      // A recusa vem do banco por extenso — "a etapa exige aprovação e por
      // isso não pode virar agrupadora", "já é uma sub-etapa". É ela que
      // ensina a regra, e por isso vai inteira para a tela.
      if (!resultado.ok) toast.error(resultado.error);
      else {
        setNovo("");
        setNovaFilha("");
        setAninhandoEm(null);
        router.refresh();
      }
    });
  }

  /**
   * Trocar o status da etapa pelo seletor.
   *
   * NADA É PRÉ-BLOQUEADO na lista de status: quem recusa é o banco, e a recusa
   * dele diz o caminho — "A rodada é criada pela ação Pedir aval interno",
   * "exige aprovação interna e não pode ser concluída direto". Um item cinza
   * não ensina nada; a frase ensina.
   */
  function trocarStatus(sub: SubtarefaDetalhada, destino: SubtaskStatus) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        moverSubtarefa(sub.id, taskId, destino),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  function remover(sub: SubtarefaDetalhada, quantasFilhas: number) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        removerSubtarefa(sub.id, taskId),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        if (quantasFilhas > 0) {
          toast.success(
            `"${sub.titulo}" saiu, e as ${quantasFilhas} sub-etapas dentro dela foram junto.`,
          );
        }
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Subtarefas</h2>

        {/* A BARRA, e não só o número. "8 de 24" é uma conta que a pessoa
            faz; a barra é uma resposta que ela lê. As duas juntas porque a
            barra sozinha não diz quantas faltam. */}
        {asFolhas.length > 0 ? (
          <>
            <span className="text-text-secondary text-xs tabular-nums">
              {concluidas} de {asFolhas.length} concluída
              {asFolhas.length === 1 ? "" : "s"}
            </span>
            <span
              aria-hidden
              className="bg-neutral-soft h-1.5 w-24 overflow-hidden rounded-full"
            >
              <span
                className="bg-success block h-full rounded-full"
                style={{
                  width: `${Math.round((concluidas / asFolhas.length) * 100)}%`,
                }}
              />
            </span>
          </>
        ) : (
          <span className="text-text-muted text-xs">nenhuma etapa</span>
        )}
      </div>

      {subtarefas.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Esta demanda ainda não tem etapas. A subtarefa é a unidade de
          trabalho: é nela que entra o responsável, o prazo e a regra de
          aprovação.
        </p>
      ) : (
        /* UM `DndContext` SÓ, com um `SortableContext` por NÍVEL.
           Aninhar contextos resolveria igual e custaria a propagação do evento
           entre eles; com um, o `onDragEnd` descobre o nível pelo id de quem
           saiu — e um arrasto que atravessa níveis não acha o destino na lista
           daquele nível e não faz nada, que é a recusa certa: mudar de mãe é
           mexer em `parent_id`, outra operação com outras travas. */
        <DndContext sensors={sensores} onDragEnd={aoSoltarNoNivel}>
          <SortableContext
            items={arvore.map(({ etapa }) => etapa.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y rounded-lg border">
              {arvore.map(({ etapa, filhas }) => (
                <ItemArrastavel
                  key={etapa.id}
                  id={etapa.id}
                  podeArrastar={podeGerenciar && arvore.length > 1}
                >
                  {(alca) => (
                    <>
                      <Linha
                        sub={etapa}
                        alca={alca}
                        equipe={equipe}
                        aoMudarResponsavel={(quem) =>
                          trocarResponsavel(etapa, quem)
                        }
                        filhas={filhas.length}
                        somaDasFilhas={
                          filhas.length > 0
                            ? {
                                real: somar(filhas, "tempo_real_minutos"),
                                estimado: somar(filhas, "estimativa_minutos"),
                                concluidas: filhas.filter(
                                  (f) => f.status === "concluida",
                                ).length,
                              }
                            : null
                        }
                        podeGerenciar={podeGerenciar}
                        souGestor={souGestor}
                        usuarioId={usuarioId}
                        agoraDoServidor={agoraDoServidor}
                        aoAbrir={() => setAberta(etapa.id)}
                        aoMudarStatus={(destino) =>
                          trocarStatus(etapa, destino)
                        }
                        aoAninhar={() => {
                          setAninhandoEm(
                            aninhandoEm === etapa.id ? null : etapa.id,
                          );
                          setNovaFilha("");
                        }}
                        aoRemover={() => remover(etapa, filhas.length)}
                      />

                      {filhas.length > 0 ? (
                        <SortableContext
                          items={filhas.map((f) => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="border-t">
                            {filhas.map((filha) => (
                              <ItemArrastavel
                                key={filha.id}
                                id={filha.id}
                                podeArrastar={
                                  podeGerenciar && filhas.length > 1
                                }
                                className="border-b last:border-b-0"
                              >
                                {(alcaDaFilha) => (
                                  <Linha
                                    sub={filha}
                                    alca={alcaDaFilha}
                                    equipe={equipe}
                                    aoMudarResponsavel={(quem) =>
                                      trocarResponsavel(filha, quem)
                                    }
                                    aninhada
                                    filhas={0}
                                    somaDasFilhas={null}
                                    podeGerenciar={podeGerenciar}
                                    souGestor={souGestor}
                                    usuarioId={usuarioId}
                                    agoraDoServidor={agoraDoServidor}
                                    aoAbrir={() => setAberta(filha.id)}
                                    aoMudarStatus={(destino) =>
                                      trocarStatus(filha, destino)
                                    }
                                    aoAninhar={null}
                                    aoRemover={() => remover(filha, 0)}
                                  />
                                )}
                              </ItemArrastavel>
                            ))}
                          </ul>
                        </SortableContext>
                      ) : null}

                      {aninhandoEm === etapa.id ? (
                        <form
                          className="bg-muted flex gap-2 border-t p-3 pl-10"
                          onSubmit={(evento) => {
                            evento.preventDefault();
                            adicionar(novaFilha, etapa.id);
                          }}
                        >
                          <Input
                            autoFocus
                            value={novaFilha}
                            onChange={(evento) =>
                              setNovaFilha(evento.target.value)
                            }
                            placeholder={`Sub-etapa dentro de "${etapa.titulo}"`}
                            aria-label={`Título da nova sub-etapa de ${etapa.titulo}`}
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            disabled={salvando || novaFilha.trim() === ""}
                          >
                            {salvando ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Plus aria-hidden />
                            )}
                            Adicionar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setAninhandoEm(null)}
                          >
                            Cancelar
                          </Button>
                        </form>
                      ) : null}
                    </>
                  )}
                </ItemArrastavel>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {asFolhas.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Tempo somado: {formatarMinutos(somar(asFolhas, "tempo_real_minutos"))}{" "}
          realizado de {formatarMinutos(somar(asFolhas, "estimativa_minutos"))}{" "}
          estimado.
        </p>
      ) : null}

      {podeGerenciar ? (
        <form
          className="flex gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            adicionar(novo, null);
          }}
        >
          <Input
            value={novo}
            onChange={(evento) => setNovo(evento.target.value)}
            placeholder="Nova subtarefa"
            aria-label="Título da nova subtarefa"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={salvando || novo.trim() === ""}
          >
            {salvando ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus aria-hidden />
            )}
            Adicionar
          </Button>
        </form>
      ) : null}

      {emAberto ? (
        <PainelDaSubtarefa
          subtarefa={emAberto}
          taskId={taskId}
          equipe={equipe}
          irmas={subtarefas}
          podeGerenciar={podeGerenciar}
          usuarioId={usuarioId}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * Uma linha que ARRASTA, e a alça é um botão de verdade.
 *
 * ---------------------------------------------------------------------------
 * **O `GripVertical` ERA `aria-hidden` E NÃO ARRASTAVA NADA** — uma alça que
 * não alça, desenhada em toda linha desde o Sprint 3. E `reordenarSubtarefas`
 * existe em `acoes-de-itens.ts` desde o mesmo sprint, na lista `ISENTAS` do
 * `check:acoes` como ação sem chamador: a ponte estava construída dos dois
 * lados e faltava o clique. Decisão do usuário: *"quero poder mudar a ordem
 * das subtarefas só clicando e arrastando"*.
 *
 * ---------------------------------------------------------------------------
 * **A ALÇA SEGURA O ARRASTO, e não a linha inteira.** A linha carrega seis
 * controles — o seletor de status, o título, o responsável, o relógio, o botão
 * de ação e o de apagar —, e espalhar os `listeners` do dnd-kit no contêiner
 * faria o `role="button"` dele embrulhar todos eles: `nested-interactive`,
 * crítico no axe, e na prática duas paradas de Tab para a mesma linha. **Este
 * produto já pagou isso duas vezes**, no card do board de demandas e no de
 * etapas, e as duas vezes a saída foi a mesma — os `attributes` vão num
 * elemento que já é focável por natureza.
 *
 * Aqui o elemento é a própria alça, que passou a ser um `<button>`: ela era o
 * único lugar da linha que não fazia nada, e é exatamente o lugar onde quem
 * quer arrastar põe o ponteiro.
 *
 * *O que isto custa, e é dito em vez de escondido:* o arrasto por TECLADO
 * depende do `KeyboardSensor`, que não está ligado aqui — a alça é focável e
 * anunciada, e pressionar espaço nela não move nada. O caminho de teclado para
 * reordenar continua não existindo, como no board de etapas, e ligá-lo é um
 * sensor a mais mais o `sortableKeyboardCoordinates`.
 * ---------------------------------------------------------------------------
 */
function ItemArrastavel({
  id,
  podeArrastar,
  className,
  children,
}: {
  id: string;
  podeArrastar: boolean;
  className?: string;
  /** Recebe a alça já pronta, para a linha desenhá-la no lugar dela. */
  children: (alca: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !podeArrastar });

  const alca = podeArrastar ? (
    <button
      type="button"
      // `cursor-grab` e não `cursor-move`: o primeiro diz "isto se pega", que é
      // o gesto; o segundo é o cursor de janela.
      className="text-muted-foreground/50 hover:text-text-secondary -ml-1 cursor-grab touch-none rounded p-0.5 focus-visible:ring-1 focus-visible:outline-none active:cursor-grabbing"
      aria-label="Arrastar para reordenar"
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  ) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // `relative z-10` só enquanto arrasta: sem isso a linha em movimento
      // passa POR BAIXO das vizinhas, porque todas são irmãs no fluxo e a
      // ordem de pintura é a do DOM.
      className={cn(
        className,
        isDragging && "bg-card relative z-10 shadow-cartao",
      )}
    >
      {children(alca)}
    </li>
  );
}

/**
 * Uma linha da lista, nos dois papéis que ela tem.
 *
 * **Agrupadora** (`somaDasFilhas` preenchido): sem responsável, sem prazo, sem
 * relógio e sem botão de ação — esses quatro passaram a ser das filhas no
 * instante em que a primeira nasceu. No lugar vai a soma delas, que é a única
 * coisa verdadeira que a mãe ainda tem a dizer sobre tempo.
 *
 * **Folha**: como sempre foi.
 */
function Linha({
  sub,
  alca,
  equipe,
  aoMudarResponsavel,
  aninhada = false,
  filhas,
  somaDasFilhas,
  podeGerenciar,
  souGestor,
  usuarioId,
  agoraDoServidor,
  aoAbrir,
  aoMudarStatus,
  aoAninhar,
  aoRemover,
}: {
  sub: SubtarefaDetalhada;
  /** A alça de arrastar, já pronta — null para quem não pode reordenar. */
  alca: React.ReactNode;
  equipe: Pessoa[];
  aoMudarResponsavel: (responsavelId: string | null) => void;
  aninhada?: boolean;
  filhas: number;
  somaDasFilhas: {
    real: number | null;
    estimado: number | null;
    concluidas: number;
  } | null;
  podeGerenciar: boolean;
  souGestor: boolean;
  usuarioId: string;
  agoraDoServidor: number;
  aoAbrir: () => void;
  aoMudarStatus: (destino: SubtaskStatus) => void;
  /** Null na sub-etapa: o terceiro nível é o último. */
  aoAninhar: (() => void) | null;
  aoRemover: () => void;
}) {
  const agrupadora = somaDasFilhas !== null;

  const seletorDeStatus =
    /* NA FOLHA, O SELO É O SELETOR. É o mesmo componente do status da
       demanda, com os status da etapa: quem executa muda o próprio andamento
       onde ele já estava olhando, sem abrir o modal. Na agrupadora continua
       selo, e é honesto — o status dela é calculado pelas filhas e o banco
       descarta o que vier escrito. */
    agrupadora ? (
      <StatusBadge status={sub.status} />
    ) : (
      <SeletorDeStatusDaSubtarefa
        status={sub.status}
        podeEditar={podeGerenciar || fazASubtarefa(sub, usuarioId)}
        aoMudar={aoMudarStatus}
        compacto
      />
    );

  return (
    <LinhaDeTrabalho
      className={cn("p-3", aninhada && "pl-10")}
      /* A ALÇA VEM PRIMEIRO, E O `GripVertical` DECORATIVO SAIU DAQUI.
         Ele era `aria-hidden` e não arrastava nada — a mesma forma, no mesmo
         lugar, sem o comportamento que ela anuncia. Quem o desenha agora é
         `ItemArrastavel`, como um `<button>` de verdade.

         NA SUB-ETAPA OS DOIS FICAM, e é informação e não enfeite: a seta diz
         que a linha é filha de alguém, a alça diz que ela se reordena. O
         recuo (`pl-10`) tem espaço para os dois, e sem a seta a sub-etapa com
         alça ficaria idêntica a uma etapa de topo recuada. */
      antes={
        <>
          {alca}
          {aninhada ? (
            <CornerDownRight
              className="text-muted-foreground/50 size-4 shrink-0"
              aria-hidden
            />
          ) : null}
        </>
      }
      status={seletorDeStatus}
      nome={
        /* O `truncate` vai no BOTÃO, não num `<span>` dentro dele: num
           elemento inline as três propriedades não recortam nada, então o
           título era cortado sem reticências. */
        <button
          type="button"
          className="hover:text-accent-strong block max-w-full truncate text-left text-sm font-medium"
          onClick={aoAbrir}
        >
          {sub.titulo}
        </button>
      }
      /* A AGRUPADORA NÃO TEM PRIORIDADE NEM PRAZO, e a ausência é a regra da
         0022: no instante em que ela ganha a primeira filha, o responsável, o
         prazo e o relógio passam a ser de cada uma delas. O que ela tem a
         dizer sobre tempo é a soma, e ela vai nos extras. */
      prioridade={
        agrupadora ? null : <PriorityBadge priority={sub.prioridade} />
      }
      vencimento={
        agrupadora ||
        !sub.prazo ? null /* DateBadge é para prazo a vencer. Etapa concluída
             mostra a data crua, senão o passado apareceria em vermelho como
             se fosse atraso. */ : sub.status === "concluida" ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {format(parseISO(sub.prazo), "dd/MM/yy", { locale: ptBR })}
          </span>
        ) : (
          <DateBadge date={sub.prazo} />
        )
      }
      extras={
        <>
          {agrupadora ? (
            <>
              {/* O que a agrupadora tem a dizer: quantas etapas ela junta, e a
                  soma do tempo delas. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-text-secondary inline-flex cursor-help items-center gap-1 text-xs">
                    <Layers className="size-3.5" aria-hidden />
                    <span className="tabular-nums">
                      {somaDasFilhas.concluidas}/{filhas}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Esta etapa agrupa {filhas} sub-etapa{filhas === 1 ? "" : "s"}{" "}
                  — o responsável, o prazo e o tempo são de cada uma delas. O
                  status daqui é calculado pelo andamento das filhas.
                </TooltipContent>
              </Tooltip>

              <span className="text-muted-foreground text-xs tabular-nums">
                {formatarMinutos(somaDasFilhas.real)} de{" "}
                {formatarMinutos(somaDasFilhas.estimado)}
              </span>
            </>
          ) : (
            <>
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

              {/* QUEM FAZ, ESCOLHIDO AQUI. Decisão do usuário: *"ela possa
                  selecionar o responsável, clicando na palavra responsável,
                  sem precisar abrir mais abas para editar"*.

                  **A palavra era literalmente esta:** `sem responsável`, em
                  cinza, do lado do relógio — uma frase que descreve uma falta,
                  parece o lugar de resolvê-la, e não respondia ao clique. Quem
                  queria distribuir trabalho abria o modal, achava o campo no
                  meio de doze e fechava.

                  **Quem pode é `podeGerenciar`**, a MESMA pergunta que o campo
                  do modal faz — e não uma parecida: distribuir trabalho é do
                  Atendimento e da gestão, e quem só executa continua mudando o
                  próprio andamento pelo seletor de status, duas posições à
                  esquerda. */}
              <SeletorDeResponsavel
                valor={sub.responsavel_id}
                /* A PESSOA COMO ESTA LINHA A CONHECE. `equipe` é quem está
                   ATIVO, e a imagem do protótipo mostrou o preço de depender
                   só dela: três etapas COM dono saíram marcadas "sem
                   responsável", porque a pessoa delas não estava na lista. A
                   linha sabe — ela desenhava o avatar dessa pessoa desde o
                   Sprint 3B. */
                atual={sub.responsavel}
                equipe={equipe}
                aoMudar={aoMudarResponsavel}
                podeEditar={podeGerenciar}
                compacto
              />

              {/* QUEM MAIS FAZ ESTA ETAPA, e ela vale para a sub-etapa também.
                  Decisão do usuário: *"quero que apareçam as fotos das pessoas
                  tbm na sub etapa"*.

                  **O seletor desenha UMA pessoa, que é a coluna** — e desde a
                  0114 a coluna é a PRIMEIRA, com `subtask_responsaveis`
                  mandando. A segunda via a etapa em Minhas Tasks, contava na
                  carga dela, e não aparecia na linha de quem a distribuiu: o
                  pior tipo de trabalho, o que existe e ninguém sabe de quem é.

                  **Ela fica ENCOSTADA no seletor e não numa coluna própria**,
                  porque é a mesma pergunta — quem faz isto —, e some quando
                  não há ninguém a mais: uma coluna vazia em nove de dez linhas
                  é a largura do nome gasta para dizer que não há o que dizer.
                  Quem põe e tira continua sendo o modal, onde a lista cabe. */}
              {sub.outrosResponsaveis.length > 0 ? (
                <UserAvatarGroup
                  users={sub.outrosResponsaveis.map((p) => ({
                    name: p.nome,
                    src: p.avatar_url,
                  }))}
                  max={2}
                  size="sm"
                />
              ) : null}

              {/* O relógio à vista. Um cronômetro que ninguém vê é um número
                  que aparece pronto no diálogo de conclusão, sem a pessoa ter
                  como saber de onde veio — e sem reparar que esqueceu a etapa
                  em andamento de um dia para o outro. */}
              <Cronometro dados={sub} agoraDoServidor={agoraDoServidor} />

              <AcoesDaSubtarefa
                subtarefa={sub}
                usuarioId={usuarioId}
                souGestor={souGestor}
                rodadaPendenteId={
                  sub.rodadas.find((r) => r.status === "pendente")?.id ?? null
                }
              />
            </>
          )}

          {podeGerenciar && aoAninhar ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Adicionar sub-etapa em ${sub.titulo}`}
                  onClick={aoAninhar}
                >
                  <CornerDownRight aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desdobrar em sub-etapas</TooltipContent>
            </Tooltip>
          ) : null}

          {podeGerenciar ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Remover ${sub.titulo}`}
              onClick={aoRemover}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </>
      }
    />
  );
}

function somar(
  subtarefas: SubtarefaDetalhada[],
  campo: "tempo_real_minutos" | "estimativa_minutos",
): number | null {
  const valores = subtarefas
    .map((s) => s[campo])
    .filter((v): v is number => v !== null);
  return valores.length === 0
    ? null
    : valores.reduce((total, v) => total + v, 0);
}
