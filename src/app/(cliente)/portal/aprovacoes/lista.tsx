"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeCheck, ExternalLink, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
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
import type { AprovacaoDoCliente } from "@/lib/dados/portal-aprovacoes";

import { decisaoCliente } from "./acoes";

/**
 * As aprovações do cliente.
 *
 * Duas listas: o que espera a decisão dele e o que já foi decidido, com o que
 * ele escreveu da outra vez. Nada da aprovação interna aparece aqui — ele não
 * precisa (nem deve) saber quantas rodadas a equipe fez antes de mandar.
 *
 * Pedir ajustes exige escrever o motivo. Não é burocracia: sem o texto, a
 * equipe recomeça no escuro — e o banco recusa a rodada sem comentário de
 * qualquer forma.
 */
export function ListaDeAprovacoes({
  esperando,
  decididas,
}: {
  esperando: AprovacaoDoCliente[];
  decididas: AprovacaoDoCliente[];
}) {
  if (esperando.length === 0 && decididas.length === 0) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title="Nada esperando você"
        description="Quando a agência enviar um material para a sua aprovação, ele aparece aqui."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Esperando você</h2>
        {esperando.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            Nada pendente no momento.
          </p>
        ) : (
          <ul className="space-y-3">
            {esperando.map((item) => (
              <CartaoPendente key={item.rodadaId} item={item} />
            ))}
          </ul>
        )}
      </section>

      {decididas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Já decididas</h2>
          <ul className="space-y-2">
            {decididas.map((item) => (
              <li key={item.rodadaId} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.titulo}</span>
                  <Badge variant="secondary">Rodada {item.numeroRodada}</Badge>
                  <Badge variant={item.status === "aprovada" ? "default" : "outline"}>
                    {item.status === "aprovada" ? "Aprovado" : "Ajustes solicitados"}
                  </Badge>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {item.decididaEm
                      ? format(parseISO(item.decididaEm), "dd/MM/yy", { locale: ptBR })
                      : ""}
                  </span>
                </div>
                {item.comentario ? (
                  <p className="text-muted-foreground mt-1 text-sm">“{item.comentario}”</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CartaoPendente({ item }: { item: AprovacaoDoCliente }) {
  const router = useRouter();
  const [executando, iniciar] = useTransition();
  const [pedindoAjustes, setPedindoAjustes] = useState(false);
  const [motivo, setMotivo] = useState("");

  function decidir(decisao: "aprovada" | "ajustes_solicitados", texto: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() => decisaoCliente(item.rodadaId, decisao, texto));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setPedindoAjustes(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.titulo}</span>
        <Badge variant="secondary">Rodada {item.numeroRodada}</Badge>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          enviado em {format(parseISO(item.enviadaEm), "dd/MM/yy", { locale: ptBR })}
        </span>
      </div>

      {item.task ? <p className="text-muted-foreground text-xs">em {item.task}</p> : null}

      {item.entregas.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {item.entregas.map((entrega) => (
            <li key={entrega.id}>
              <a
                href={entrega.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent-strong inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
              >
                <Paperclip className="size-3.5" aria-hidden />
                {entrega.nome ?? "Abrir material"}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm italic">Sem arquivo anexado.</p>
      )}

      {item.conversa.length > 0 ? (
        <ul className="space-y-1 border-l-2 pl-3">
          {item.conversa.map((comentario) => (
            <li key={comentario.id} className="text-sm">
              <span className="text-muted-foreground text-xs">
                {comentario.meu ? "Você" : "Full Connect Key"} ·{" "}
                {format(parseISO(comentario.created_at), "dd/MM/yy", { locale: ptBR })}
              </span>
              <p>{comentario.texto}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={executando}
          onClick={() => {
            setMotivo("");
            setPedindoAjustes(true);
          }}
        >
          Solicitar ajustes
        </Button>
        <Button disabled={executando} onClick={() => decidir("aprovada", "")}>
          {executando ? <Loader2 className="animate-spin" /> : <BadgeCheck aria-hidden />}
          Aprovar
        </Button>
      </div>

      <Dialog open={pedindoAjustes} onOpenChange={(aberto) => !aberto && setPedindoAjustes(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O que precisa mudar?</DialogTitle>
            <DialogDescription>
              Quanto mais específico, menos idas e vindas. A equipe recebe o texto junto com o
              pedido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={4}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="A cor do fundo ficou diferente da nossa marca."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedindoAjustes(false)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length === 0 || executando}
              onClick={() => decidir("ajustes_solicitados", motivo)}
            >
              {executando ? <Loader2 className="animate-spin" /> : null}
              Enviar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
