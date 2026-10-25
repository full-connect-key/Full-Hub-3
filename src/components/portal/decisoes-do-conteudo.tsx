"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { ANCORAS, ancora } from "@/lib/tour/ancoras";

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

  /**
   * ---------------------------------------------------------------------
   * **`chamarEMostrar` E NÃO `chamarAcao`, e a troca conserta o bug mais caro
   * que este produto teve.**
   *
   * Com `chamarAcao` sozinho, o `if (resultado.ok)` engolia toda recusa: o
   * cliente clicava em Aprovar, nada acontecia, e nada era dito. Foi assim
   * que a falha da 0062 — `notificar()` estourando o `not null` de
   * `notifications.user_id` quando a empresa não tem responsável de
   * atendimento — ficou invisível até alguém relatar "não consigo aprovar".
   *
   * A regra do produto é "nenhuma escrita pode falhar em silêncio", e ela
   * estava quebrada nos dois únicos componentes do Portal do Cliente que
   * escrevem. **O Portal é a área que a equipe nunca abre**, e é por isso
   * que justamente ali o silêncio durou.
   * ---------------------------------------------------------------------
   */
  function decidir(decisao: DecisaoDoCliente, comentario: string) {
    iniciar(async () => {
      const resultado = await chamarEMostrar(() =>
        decidirConteudo(rodadaPendenteId!, decisao, comentario),
      );
      if (resultado.ok) {
        setPedindo(null);
        setMotivo("");
        router.refresh();
      }
    });
  }

  // JÁ DECIDIDO: os botões somem, e mais nada aparece no lugar deles. Manter
  // um "Aprovar" desligado ao lado de "Aprovado por Joana" seria oferecer de
  // novo uma decisão que já foi tomada.
  //
  // **E QUEM GUARDA O REGISTRO É A ESCADA DE ANDAMENTO**, não este componente.
  // Ele desenhava aqui um parágrafo *"Aprovado por Joana em 12/03 às 10:40"* —
  // que, com a escada na coluna ao lado dizendo o mesmo no terceiro passo,
  // virou o mesmo fato escrito duas vezes na mesma tela. O que sobreviveu é a
  // escada, porque lá a decisão aparece no lugar dela, no fim do caminho que a
  // produziu; aqui ela era um bloco solto embaixo de botões que não existem
  // mais. **E o ramo saiu em vez de ficar atrás de uma bandeira**: código que
  // nenhuma tela desenha é o que alguém reaproveita três entregas depois
  // achando que ele ainda diz a verdade (decisão da 0023).
  if (!rodadaPendenteId) return null;

  return (
    <>
      {/*
        A ÂNCORA DO TOUR vai na FILEIRA DOS TRÊS BOTÕES, e não no fragmento —
        que não tem elemento onde pô-la. O passo diz "três respostas
        possíveis", e o recorte dele são exatamente os três.

        **E ela não existe no ramo de cima**, o do material já decidido: ali
        não há decisão a tomar, e o passo é `opcional` justamente por isso.
        Apontar para a frase "aprovado por Joana em 12/03" com o texto dos três
        botões seria a tela dizendo a coisa errada sobre o que a pessoa está
        lendo.
      */}
      <div className="flex flex-wrap gap-2" {...ancora(ANCORAS.portalDecisoes)}>
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
