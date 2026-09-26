"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ExternalLink, Link2, Loader2, Lock, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { chamarAcao } from "@/lib/acoes/cliente";
import { PRIORIDADES, ROTULOS_DE_PRIORIDADE } from "@/lib/dominio/tasks";
import { AJUDA_DE_TEMPO, formatarMinutos, tempoParaCampo } from "@/lib/dominio/tempo";
import { ROTULO_DA_APROVACAO, ROTULO_DO_ESCOPO } from "@/lib/tasks/state-machine";
import type { Pessoa, SubtarefaDetalhada } from "@/lib/dados/tasks";
import type { SubtaskStatus } from "@/lib/supabase/database.types";

import {
  anexarEntrega,
  atualizarSubtarefa,
  desvincularDependencia,
  moverSubtarefa,
  removerEntrega,
  vincularDependencia,
} from "../acoes-de-itens";

const SEM_VALOR = "__sem__";

/**
 * O painel da subtarefa.
 *
 * Abre por cima do detalhe da Task, sem trocar de página: quem está olhando a
 * demanda inteira não perde o contexto ao conferir uma etapa.
 *
 * Ver é aberto, agir é restrito — qualquer pessoa da equipe abre e lê; os
 * campos só ficam editáveis para quem gerencia a demanda ou é responsável por
 * esta etapa, e o botão de ação sai da máquina de estados.
 */
export function PainelDaSubtarefa({
  subtarefa,
  taskId,
  equipe,
  irmas,
  podeGerenciar,
  usuarioId,
  aoFechar,
}: {
  subtarefa: SubtarefaDetalhada;
  taskId: string;
  equipe: Pessoa[];
  /** As outras subtarefas da mesma Task, para montar dependência. */
  irmas: SubtarefaDetalhada[];
  podeGerenciar: boolean;
  usuarioId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [link, setLink] = useState("");

  const souOResponsavel = subtarefa.responsavel_id === usuarioId;
  const podeMexer = podeGerenciar || souOResponsavel;

  function trocarStatus(destino: SubtaskStatus) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => moverSubtarefa(subtarefa.id, taskId, destino));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  function salvar(campos: Record<string, unknown>) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => atualizarSubtarefa(subtarefa.id, taskId, campos));
      if (!resultado.ok) toast.error(resultado.error);
      else router.refresh();
    });
  }

  return (
    <Sheet open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-balance">{subtarefa.titulo}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {/* O SELO É O SELETOR, como na linha do detalhe da Task. Era um
                selo morto com um botão "Iniciar" logo abaixo dizendo a mesma
                coisa por outro caminho — dois controles para um andamento só,
                um deles ocupando uma linha inteira do painel. */}
            <SeletorDeStatusDaSubtarefa
              status={subtarefa.status}
              podeEditar={podeMexer}
              aoMudar={trocarStatus}
              compacto
            />
            {subtarefa.requer_aprovacao ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" aria-hidden />
                Requer aprovação: {ROTULO_DA_APROVACAO[subtarefa.tipo_aprovacao ?? "interna"]}
              </Badge>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {subtarefa.dependenciasAbertas.length > 0 ? (
            <p className="bg-warning-soft text-warning border-transparent rounded-md border px-3 py-2 text-sm">
              Aguardando: {subtarefa.dependenciasAbertas.join(", ")}. Enquanto isso, ela não inicia.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Responsável">
              {podeGerenciar ? (
                <Select
                  value={subtarefa.responsavel_id ?? SEM_VALOR}
                  onValueChange={(valor) =>
                    salvar({ responsavel_id: valor === SEM_VALOR ? null : valor })
                  }
                >
                  <SelectTrigger aria-label="Responsável" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_VALOR}>Sem responsável</SelectItem>
                    {equipe.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : subtarefa.responsavel ? (
                <span className="flex items-center gap-2 text-sm">
                  <UserAvatar
                    name={subtarefa.responsavel.nome}
                    src={subtarefa.responsavel.avatar_url}
                    size="sm"
                  />
                  {subtarefa.responsavel.nome}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">Sem responsável</span>
              )}
            </Campo>

            <Campo rotulo="Prioridade">
              {podeGerenciar ? (
                <Select
                  value={subtarefa.prioridade}
                  onValueChange={(valor) => salvar({ prioridade: valor })}
                >
                  <SelectTrigger aria-label="Prioridade" className="w-full">
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
                <span className="text-sm">{ROTULOS_DE_PRIORIDADE[subtarefa.prioridade]}</span>
              )}
            </Campo>

{/* O PERÍODO da etapa (migration 0027), e não só o prazo. Duas etapas
                com o mesmo prazo podem ser uma de três dias e uma de três
                horas — sem o início, quem monta a agenda da semana tem
                metade da informação.

                Os dois continuam opcionais: quem abre a demanda costuma
                saber a data de entrega e ainda não saber quando cada etapa
                começa, e exigir as duas faria a pessoa inventar uma. */}
            <Campo rotulo="Início">
              {podeGerenciar ? (
                <Input
                  type="date"
                  aria-label="Data de início da etapa"
                  defaultValue={subtarefa.data_inicio ?? ""}
                  onBlur={(evento) => {
                    if (evento.target.value !== (subtarefa.data_inicio ?? "")) {
                      salvar({ data_inicio: evento.target.value });
                    }
                  }}
                />
              ) : (
                <span className="text-sm">
                  {subtarefa.data_inicio
                    ? format(parseISO(subtarefa.data_inicio), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </span>
              )}
            </Campo>

            <Campo rotulo="Prazo">
              {podeGerenciar ? (
                <Input
                  type="date"
                  aria-label="Prazo da etapa"
                  defaultValue={subtarefa.prazo ?? ""}
                  onBlur={(evento) => {
                    if (evento.target.value !== (subtarefa.prazo ?? "")) {
                      salvar({ prazo: evento.target.value });
                    }
                  }}
                />
              ) : (
                <span className="text-sm">
                  {subtarefa.prazo
                    ? format(parseISO(subtarefa.prazo), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </span>
              )}
            </Campo>

            <Campo rotulo="Estimativa">
              {podeMexer ? (
                <Input
                  defaultValue={tempoParaCampo(subtarefa.estimativa_minutos)}
                  placeholder="2h30"
                  // O rotulo do Campo e texto solto, nao um <label for>: sem isto o
                  // unico nome do campo seria o title, que so existe para quem
                  // tem mouse e paira sobre ele.
                  aria-label="Estimativa"
                  title={AJUDA_DE_TEMPO}
                  onBlur={(evento) => {
                    const atual = tempoParaCampo(subtarefa.estimativa_minutos);
                    if (evento.target.value !== atual) salvar({ estimativa: evento.target.value });
                  }}
                />
              ) : (
                <span className="text-sm">{formatarMinutos(subtarefa.estimativa_minutos)}</span>
              )}
            </Campo>
          </div>

          {subtarefa.tempo_real_minutos !== null ? (
            <p className="text-muted-foreground text-xs">
              Tempo real registrado: {formatarMinutos(subtarefa.tempo_real_minutos)}.
            </p>
          ) : null}

          <Separator />

          {/* Dependências ---------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Depende de</h3>
            {subtarefa.dependeDe.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nada. Ela pode começar quando quiserem.
              </p>
            ) : (
              <ul className="space-y-1">
                {subtarefa.dependeDe.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-sm">
                    <Link2 className="text-muted-foreground size-3.5" aria-hidden />
                    <span className={dep.status === "concluida" ? "text-muted-foreground" : ""}>
                      {dep.titulo}
                    </span>
                    <StatusBadge status={dep.status} />
                    {podeGerenciar ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Desvincular ${dep.titulo}`}
                        onClick={() =>
                          iniciar(async () => {
                            const r = await chamarAcao(() =>
                              desvincularDependencia(taskId, subtarefa.id, dep.id),
                            );
                            if (!r.ok) toast.error(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {podeGerenciar ? (
              <Select
                value={SEM_VALOR}
                onValueChange={(valor) =>
                  iniciar(async () => {
                    const r = await chamarAcao(() =>
                      vincularDependencia(taskId, subtarefa.id, valor),
                    );
                    if (!r.ok) toast.error(r.error);
                    else router.refresh();
                  })
                }
              >
                <SelectTrigger className="w-full" aria-label="Adicionar dependência">
                  <SelectValue placeholder="Adicionar dependência…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_VALOR} disabled>
                    Adicionar dependência…
                  </SelectItem>
                  {irmas
                    .filter(
                      (i) =>
                        i.id !== subtarefa.id &&
                        !subtarefa.dependeDe.some((d) => d.id === i.id),
                    )
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.titulo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : null}
          </section>

          <Separator />

          {/* Entregas -------------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Entregas</h3>
            {subtarefa.entregas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nada anexado ainda. É o que quem aprova vai olhar.
              </p>
            ) : (
              <ul className="space-y-1">
                {subtarefa.entregas.map((entrega) => (
                  <li key={entrega.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <a
                      href={entrega.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent-strong min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                    >
                      {entrega.nome ?? entrega.url}
                    </a>
                    <ExternalLink className="text-muted-foreground size-3 shrink-0" aria-hidden />
                    {podeMexer ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Remover entrega"
                        onClick={() =>
                          iniciar(async () => {
                            const r = await chamarAcao(() => removerEntrega(entrega.id, taskId));
                            if (!r.ok) toast.error(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {podeMexer ? (
              <form
                className="flex gap-2"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  if (!link.trim()) return;
                  iniciar(async () => {
                    const r = await chamarAcao(() =>
                      anexarEntrega(taskId, subtarefa.id, { tipo: "link", url: link }),
                    );
                    if (!r.ok) toast.error(r.error);
                    else {
                      setLink("");
                      router.refresh();
                    }
                  });
                }}
              >
                <Input
                  value={link}
                  onChange={(evento) => setLink(evento.target.value)}
                  placeholder="https://…"
                  aria-label="Link da entrega"
                />
                <Button type="submit" variant="outline" disabled={salvando}>
                  {salvando ? <Loader2 className="animate-spin" /> : null}
                  Anexar
                </Button>
              </form>
            ) : null}
          </section>

          <Separator />

          {/* Rodadas de aprovação -------------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Rodadas de aprovação</h3>
            {subtarefa.rodadas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {subtarefa.requer_aprovacao
                  ? "Nenhuma rodada ainda."
                  : "Esta subtarefa não passa por aprovação."}
              </p>
            ) : (
              <Rodadas rodadas={subtarefa.rodadas} />
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{rotulo}</Label>
      {children}
    </div>
  );
}

/**
 * O acordeão cronológico das rodadas.
 *
 * A mais recente vem aberta; as anteriores ficam recolhidas, mas continuam ali
 * com o que foi pedido e decidido. Rodada nunca é sobrescrita nem apagada — é
 * essa pilha que permite responder "por que refizemos isso três vezes?" seis
 * meses depois.
 */
function Rodadas({ rodadas }: { rodadas: SubtarefaDetalhada["rodadas"] }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set([rodadas[0]?.id]));

  return (
    <ul className="space-y-2">
      {rodadas.map((rodada) => {
        const aberta = abertas.has(rodada.id);
        const quando = rodada.decidido_em ?? rodada.solicitado_em;
        return (
          <li key={rodada.id} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              onClick={() =>
                setAbertas((atual) => {
                  const proximo = new Set(atual);
                  if (proximo.has(rodada.id)) proximo.delete(rodada.id);
                  else proximo.add(rodada.id);
                  return proximo;
                })
              }
            >
              <ChevronRight
                className={`size-4 shrink-0 transition-transform ${aberta ? "rotate-90" : ""}`}
                aria-hidden
              />
              <span className="font-medium">Rodada {rodada.numero_rodada}</span>
              <span className="text-muted-foreground">{ROTULO_DO_ESCOPO[rodada.escopo]}</span>
              <ResultadoDaRodada status={rodada.status} />
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {format(parseISO(quando), "dd/MM", { locale: ptBR })}
              </span>
            </button>

            {aberta ? (
              <div className="space-y-1 border-t px-3 py-2 text-sm">
                <p className="text-muted-foreground text-xs">
                  Pedida por {rodada.solicitante?.nome ?? "—"} em{" "}
                  {format(parseISO(rodada.solicitado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {rodada.decidido_em
                    ? ` · decidida por ${rodada.decisor?.nome ?? "—"} em ${format(parseISO(rodada.decidido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    : " · esperando decisão"}
                </p>
                {rodada.comentario ? <p>{rodada.comentario}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ResultadoDaRodada({ status }: { status: SubtarefaDetalhada["rodadas"][number]["status"] }) {
  const texto =
    status === "aprovada"
      ? "Aprovada"
      : status === "ajustes_solicitados"
        ? "Ajustes solicitados"
        : "Pendente";
  const cor =
    status === "aprovada"
      ? "text-success"
      : status === "ajustes_solicitados"
        ? "text-warning"
        : "text-info";
  return <span className={`text-xs font-medium ${cor}`}>{texto}</span>;
}
