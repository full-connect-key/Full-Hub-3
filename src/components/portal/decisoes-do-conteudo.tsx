"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, MessageSquareWarning, X } from "lucide-react";

import {
  decidirConteudo,
  type DecisaoDoCliente,
} from "@/app/(cliente)/portal/_actions/conteudo";
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
import type { ContentStatus } from "@/lib/supabase/database.types";

/**
 * As três decisões do cliente, sobre qualquer material.
 *
 * **"Solicitar ajustes" fica à vista, e não escondido dentro de "Comentar".**
 * Na prática é a ação mais comum — aprovar de primeira é a exceção —, e uma
 * ação frequente escondida atrás de outra é o jeito mais rápido de a pessoa
 * comentar sem pedir ajuste e ninguém refazer nada.
 *
 * **Aprovar não pede diálogo; os outros dois pedem.** Aprovar é a decisão que
 * não precisa de explicação. Rejeitar e pedir ajuste sem dizer por quê mandam
 * a equipe adivinhar, e a próxima versão volta igual — por isso o motivo é
 * exigido aqui E no banco: aqui ele escreve a frase que a pessoa lê, lá ele é
 * o que vale.
 *
 * **O botão primário é `--brand-blue` com texto escuro.** Texto branco sobre o
 * azul claro da marca dá 1.7:1, e o `variant="default"` do projeto já resolve
 * isso — nenhuma classe de cor é escrita aqui.
 */

const DIALOGO: Record<
  Exclude<DecisaoDoCliente, "aprovada">,
  { titulo: string; descricao: string; rotulo: string; acao: string }
> = {
  ajustes_solicitados: {
    titulo: "Solicitar ajustes",
    descricao:
      "Diga o que precisa mudar. A equipe recebe o aviso e devolve uma versão nova.",
    rotulo: "O que precisa ser ajustado",
    acao: "Enviar pedido",
  },
  rejeitada: {
    titulo: "Recusar material",
    descricao:
      "Recusar é diferente de pedir ajuste: o material não vai ao ar desta forma. Diga o motivo.",
    rotulo: "Por que o material foi recusado",
    acao: "Recusar",
  },
};

export function DecisoesDoConteudo({
  rodadaPendenteId,
  status,
  decididoPor,
  decididoEm,
  somenteLeitura = false,
}: {
  /**
   * A rodada aberta agora, e só ela.
   *
   * **O tipo do material não entra aqui de propósito.** A decisão é a mesma
   * para post e para entregável — quem sabe de que tipo é a rodada é o banco,
   * por `content_type`, e é lá que a recusa acontece. Passar o tipo para cá
   * criaria um segundo lugar dizendo a mesma coisa, e um `if tipo ===` neste
   * componente é justamente a divergência que a tela única existe para evitar.
   */
  rodadaPendenteId: string | null;
  status: ContentStatus;
  decididoPor: string | null;
  decididoEm: string | null;
  /** Na visualização administrativa os botões existem, mas não decidem. */
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [pedindo, setPedindo] = useState<Exclude<
    DecisaoDoCliente,
    "aprovada"
  > | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, iniciar] = useTransition();

  function decidir(decisao: DecisaoDoCliente, comentario: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        decidirConteudo(rodadaPendenteId!, decisao, comentario),
      );
      if (resultado.ok) {
        setPedindo(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  // JÁ DECIDIDO: os botões somem e fica o registro. Manter um "Aprovar"
  // desligado ao lado de "Aprovado por Joana" seria oferecer de novo uma
  // decisão que já foi tomada.
  if (!rodadaPendenteId) {
    if (!decididoEm) return null;

    const verbo =
      status === "aprovado"
        ? "Aprovado"
        : status === "rejeitado"
          ? "Recusado"
          : "Ajustes pedidos";

    return (
      <p className="bg-surface-card text-text-muted rounded-xl border p-4 text-sm">
        {verbo}
        {decididoPor ? ` por ${decididoPor}` : ""} em{" "}
        {format(parseISO(decididoEm), "dd/MM/yyyy 'às' HH:mm", {
          locale: ptBR,
        })}
        .
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => decidir("aprovada", "")}
          disabled={enviando || somenteLeitura}
        >
          <Check aria-hidden className="size-4" />
          Aprovar
        </Button>

        <Button
          variant="outline"
          onClick={() => setPedindo("ajustes_solicitados")}
          disabled={enviando || somenteLeitura}
        >
          <MessageSquareWarning aria-hidden className="size-4" />
          Solicitar ajustes
        </Button>

        <Button
          variant="outline"
          onClick={() => setPedindo("rejeitada")}
          disabled={enviando || somenteLeitura}
        >
          <X aria-hidden className="size-4" />
          Rejeitar
        </Button>
      </div>

      {somenteLeitura ? (
        <p className="text-text-muted text-sm">
          A decisão é do cliente — e o banco recusa qualquer outra pessoa,
          inclusive por chamada direta.
        </p>
      ) : null}

      <Dialog
        open={pedindo !== null}
        onOpenChange={(aberto) => !aberto && setPedindo(null)}
      >
        <DialogContent>
          {pedindo ? (
            <>
              <DialogHeader>
                <DialogTitle>{DIALOGO[pedindo].titulo}</DialogTitle>
                <DialogDescription>
                  {DIALOGO[pedindo].descricao}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label htmlFor="motivo" className="text-sm font-medium">
                  {DIALOGO[pedindo].rotulo}
                </label>
                <Textarea
                  id="motivo"
                  value={motivo}
                  onChange={(evento) => setMotivo(evento.target.value)}
                  rows={4}
                  placeholder="Ex.: o logo ficou pequeno no terceiro card."
                />
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setPedindo(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => decidir(pedindo, motivo)}
                  disabled={enviando || motivo.trim().length === 0}
                >
                  {DIALOGO[pedindo].acao}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
