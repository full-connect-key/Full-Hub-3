"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Loader2, Paperclip, Send } from "lucide-react";
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
import { ROTULO_DA_APROVACAO } from "@/lib/tasks/state-machine";
import type { FilaDeAprovacoes, ItemDaFila } from "@/lib/dados/aprovacoes";

import {
  aprovarInterna,
  enviarParaCliente,
  solicitarAjustesInterna,
} from "../gestao-tasks/acoes-de-aprovacao";

/**
 * A fila do Desenvolvedor.
 *
 * Ordenada por tempo de espera, porque é a fila justa: o que está parado há
 * mais tempo aparece primeiro, e nada some no fim da lista.
 *
 * **Todo item aparece com os botões**, inclusive o da etapa que está no nome
 * de quem olha: a migration 0029 tirou a trava de autoaprovação, aqui e no
 * banco. Quem chega nesta fila é gestão, e gestão decide.
 */
export function Fila({ fila }: { fila: FilaDeAprovacoes }) {
  if (fila.esperando.length === 0 && fila.prontasParaOCliente.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Fila vazia"
        description="Nenhuma entrega esperando validação. Quando alguém enviar uma subtarefa para aprovação, ela aparece aqui."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Esperando decisão</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {fila.esperando.length}
          </span>
        </div>

        {fila.esperando.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            Nada esperando você agora.
          </p>
        ) : (
          <ul className="space-y-2">
            {fila.esperando.map((item) => (
              <ItemEsperando key={item.rodadaId} item={item} />
            ))}
          </ul>
        )}
      </section>

      {fila.prontasParaOCliente.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">
              Prontas para enviar ao cliente
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {fila.prontasParaOCliente.length}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Já passaram pelo aval interno. Aprovar diz que o material está bom;
            enviar diz que é agora — e é uma decisão sua.
          </p>
          <ul className="space-y-2">
            {fila.prontasParaOCliente.map((item) => (
              <ItemProntaParaOCliente key={item.subtaskId} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Cabecalho({ item }: { item: ItemDaFila }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {item.cliente ? <Badge variant="outline">{item.cliente}</Badge> : null}
        <Link
          href={`/painel/gestao-tasks/${item.taskId}`}
          className="hover:text-accent-strong text-sm font-medium"
        >
          {item.subtarefa}
        </Link>
        <Badge variant="secondary">Rodada {item.numeroRodada}</Badge>
        <Badge variant="secondary">
          {ROTULO_DA_APROVACAO[item.tipoAprovacao]}
        </Badge>
      </div>

      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span>em {item.task}</span>
        {item.responsavel ? (
          <span className="inline-flex items-center gap-1.5">
            <UserAvatar
              name={item.responsavel.nome}
              src={item.responsavel.avatar_url}
              size="sm"
            />
            {item.responsavel.nome}
          </span>
        ) : null}
        <span>
          espera há{" "}
          {formatDistanceToNowStrict(parseISO(item.desde), {
            locale: ptBR,
            addSuffix: false,
          })}
        </span>
      </p>

      {item.entregas.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {item.entregas.map((entrega) => (
            <li key={entrega.id}>
              <a
                href={entrega.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-accent-strong inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
              >
                <Paperclip className="size-3" aria-hidden />
                {entrega.nome ?? "Entrega"}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground pt-1 text-xs italic">
          Sem arquivo anexado.
        </p>
      )}
    </div>
  );
}

function ItemEsperando({ item }: { item: ItemDaFila }) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <Cabecalho item={item} />

      {/* Quem chega nesta fila é gestão, e desde a migration 0029 a gestão
          decide qualquer rodada — inclusive a da etapa que está no próprio
          nome. Não há mais motivo para desligar botão nenhum aqui. */}
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={executando}
          onClick={() => {
            setMotivo("");
            setPedindoMotivo(true);
          }}
        >
          Solicitar ajustes
        </Button>
        <Button
          size="sm"
          disabled={executando}
          onClick={() =>
            iniciar(async () => {
              if (!item.rodadaId) return;
              const resultado = await chamarAcao(() =>
                aprovarInterna(item.rodadaId!),
              );
              if (!resultado.ok) toast.error(resultado.error);
              else {
                toast.success(resultado.mensagem);
                router.refresh();
              }
            })
          }
        >
          {executando ? <Loader2 className="animate-spin" /> : null}
          Aprovar
        </Button>
      </div>

      <Dialog
        open={pedindoMotivo}
        onOpenChange={(aberto) => !aberto && setPedindoMotivo(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que precisa ser ajustado?</DialogTitle>
            <DialogDescription>
              Vai junto com a rodada, para quem produziu. É o que ele vai ler
              para saber o que refazer.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Trocar a cor do fundo para o azul da marca."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedindoMotivo(false)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length === 0 || executando}
              onClick={() =>
                iniciar(async () => {
                  if (!item.rodadaId) return;
                  const resultado = await chamarAcao(() =>
                    solicitarAjustesInterna(item.rodadaId!, motivo),
                  );
                  if (!resultado.ok) toast.error(resultado.error);
                  else {
                    toast.success(resultado.mensagem);
                    setPedindoMotivo(false);
                    router.refresh();
                  }
                })
              }
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              Solicitar ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function ItemProntaParaOCliente({ item }: { item: ItemDaFila }) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
      <Cabecalho item={item} />
      <Button
        size="sm"
        disabled={executando}
        onClick={() =>
          iniciar(async () => {
            const resultado = await chamarAcao(() =>
              enviarParaCliente(item.subtaskId),
            );
            if (!resultado.ok) toast.error(resultado.error);
            else {
              toast.success(resultado.mensagem);
              router.refresh();
            }
          })
        }
      >
        {executando ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Send aria-hidden />
        )}
        Enviar para o cliente
      </Button>
    </li>
  );
}
