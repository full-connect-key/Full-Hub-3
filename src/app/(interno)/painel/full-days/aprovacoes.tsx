"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeCheck, CheckCheck, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { SolicitacaoNaTela } from "@/lib/dados/full-days";
import { ROTULOS_DE_TIPO } from "@/lib/dominio/full-days";
import type { HrStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import { aprovarEmLote, decidir } from "./acoes";

const FILTROS: { chave: HrStatus; label: string }[] = [
  { chave: "pendente", label: "Pendentes" },
  { chave: "aprovada", label: "Aprovadas" },
  { chave: "reprovada", label: "Reprovadas" },
];

/**
 * A fila do sócio.
 *
 * O que faz esta tela valer mais que uma lista: **cada cartão mostra quem mais
 * da mesma área já está fora naquele período.** Aprovar duas designers na
 * mesma semana é o erro que este módulo existe para evitar, e ninguém percebe
 * isso olhando um pedido de cada vez — o conflito só aparece quando os dois
 * períodos estão lado a lado.
 *
 * Reprovar pede o motivo. Ele não é obrigatório no banco, mas a caixa abre
 * assim mesmo e o texto do diálogo explica por quê: um "reprovado" sem
 * explicação volta como pergunta, e a conversa acontece de qualquer forma —
 * só que fora do sistema.
 */
export function Aprovacoes({
  fila,
  contagem,
  filaAtual,
}: {
  fila: SolicitacaoNaTela[];
  contagem: Record<HrStatus, number>;
  filaAtual: HrStatus;
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [executando, iniciar] = useTransition();

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [reprovando, setReprovando] = useState<SolicitacaoNaTela | null>(null);
  const [motivo, setMotivo] = useState("");

  function trocarFila(status: HrStatus) {
    const destino = new URLSearchParams(parametros.toString());
    destino.set("fila", status);
    setSelecionados([]);
    router.push(`?${destino.toString()}`);
  }

  function responder(resultado: { ok: boolean; mensagem?: string; error?: string }) {
    if (!resultado.ok) toast.error(resultado.error ?? "Não deu certo.");
    else {
      toast.success(resultado.mensagem ?? "Pronto.");
      setSelecionados([]);
      setReprovando(null);
      router.refresh();
    }
  }

  function aprovar(id: string) {
    iniciar(async () => responder(await chamarAcao(() => decidir(id, "aprovada", ""))));
  }

  function confirmarReprovacao() {
    const alvo = reprovando;
    if (!alvo) return;
    iniciar(async () => responder(await chamarAcao(() => decidir(alvo.id, "reprovada", motivo))));
  }

  function aprovarSelecionados() {
    iniciar(async () => responder(await chamarAcao(() => aprovarEmLote(selecionados))));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((filtro) => {
          const ativo = filtro.chave === filaAtual;
          return (
            <button
              key={filtro.chave}
              type="button"
              onClick={() => trocarFila(filtro.chave)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                ativo
                  ? "border-accent-strong bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {filtro.label}
              <span className="tabular-nums opacity-70">{contagem[filtro.chave]}</span>
            </button>
          );
        })}

        {filaAtual === "pendente" && selecionados.length > 0 ? (
          <Button size="sm" className="ml-auto" disabled={executando} onClick={aprovarSelecionados}>
            {executando ? <Loader2 className="animate-spin" /> : <CheckCheck aria-hidden />}
            Aprovar {selecionados.length} selecionado(s)
          </Button>
        ) : null}
      </div>

      {fila.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={filaAtual === "pendente" ? "Nada esperando você" : "Nenhuma nesta lista"}
          description={
            filaAtual === "pendente"
              ? "Quando alguém pedir férias, licença ou ausência, o pedido aparece aqui."
              : "Troque o filtro acima para ver as outras."
          }
        />
      ) : (
        <ul className="space-y-3">
          {fila.map((pedido) => (
            <li key={pedido.id} className="bg-surface-card rounded-card border p-4">
              <div className="flex flex-wrap items-start gap-3">
                {filaAtual === "pendente" ? (
                  <input
                    type="checkbox"
                    className="accent-brand mt-1.5 size-4"
                    checked={selecionados.includes(pedido.id)}
                    aria-label={`Selecionar o pedido de ${pedido.pessoa?.nome ?? "—"}`}
                    onChange={(evento) =>
                      setSelecionados((atual) =>
                        evento.target.checked
                          ? [...atual, pedido.id]
                          : atual.filter((i) => i !== pedido.id),
                      )
                    }
                  />
                ) : null}

                <UserAvatar
                  name={pedido.pessoa?.nome ?? "—"}
                  src={pedido.pessoa?.avatarUrl}
                  size="md"
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{pedido.pessoa?.nome ?? "—"}</span>
                    <Badge variant="secondary">{pedido.pessoa?.area ?? "Sem área"}</Badge>
                    <Badge variant="outline">{ROTULOS_DE_TIPO[pedido.tipo]}</Badge>
                  </div>

                  <p className="text-sm tabular-nums">
                    {format(parseISO(pedido.data_inicio), "dd/MM/yyyy")} a{" "}
                    {format(parseISO(pedido.data_fim), "dd/MM/yyyy")} ·{" "}
                    <strong>
                      {pedido.dias_uteis} dia{pedido.dias_uteis === 1 ? "" : "s"} útil
                      {pedido.dias_uteis === 1 ? "" : "eis"}
                    </strong>
                  </p>

                  {pedido.motivo ? (
                    <p className="text-text-secondary text-sm">“{pedido.motivo}”</p>
                  ) : null}

                  {pedido.colegasFora.length > 0 ? (
                    <p className="bg-warning-soft text-warning mt-2 flex items-start gap-2 rounded-md p-2 text-xs">
                      <Users aria-hidden className="mt-px size-3.5 shrink-0" />
                      <span>
                        Da mesma área, já {pedido.colegasFora.length === 1 ? "está" : "estão"} fora
                        neste período:{" "}
                        {pedido.colegasFora
                          .map(
                            (c) =>
                              `${c.nome} (${format(parseISO(c.inicio), "dd/MM")}–${format(
                                parseISO(c.fim),
                                "dd/MM",
                              )})`,
                          )
                          .join(", ")}
                        .
                      </span>
                    </p>
                  ) : null}

                  {pedido.status === "reprovada" && pedido.motivo_reprovacao ? (
                    <p className="text-text-secondary text-sm">
                      Reprovado: {pedido.motivo_reprovacao}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-text-muted text-xs tabular-nums">
                    pedido em {format(parseISO(pedido.created_at), "dd/MM/yy", { locale: ptBR })}
                  </span>

                  {pedido.status === "pendente" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={executando}
                        onClick={() => {
                          setMotivo("");
                          setReprovando(pedido);
                        }}
                      >
                        Reprovar
                      </Button>
                      <Button size="sm" disabled={executando} onClick={() => aprovar(pedido.id)}>
                        Aprovar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={reprovando !== null} onOpenChange={(aberto) => !aberto && setReprovando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar o pedido de {reprovando?.pessoa?.nome ?? "—"}?</DialogTitle>
            <DialogDescription>
              O motivo não é obrigatório, mas vale escrever: um &ldquo;reprovado&rdquo; sem
              explicação volta como pergunta, e a conversa acontece de qualquer forma — só que
              fora do sistema.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            autoFocus
            rows={3}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="A Marina já está fora nessa semana e ficaríamos sem design."
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setReprovando(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={executando} onClick={confirmarReprovacao}>
              {executando ? <Loader2 className="animate-spin" /> : null}
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
