"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  decidirConteudo,
  type DecisaoDoCliente,
} from "@/app/(cliente)/portal/_actions/conteudo";
import { BotaoDeDecisao } from "@/components/shared/botao-de-decisao";
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
import type { Decisao } from "@/lib/aprovacoes/decisoes";
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
 * **AS TRÊS CORES VÊM DE `BotaoDeDecisao`, e nenhuma classe de cor é escrita
 * aqui.** Até aqui "Solicitar ajustes" e "Rejeitar" eram o MESMO botão
 * `outline`, a dois centímetros de distância: os dois desfechos negativos,
 * idênticos, com a palavra como única diferença. O argumento inteiro está em
 * `lib/aprovacoes/decisoes.ts`.
 */

/**
 * Os dois desfechos negativos passam por um diálogo, e **a DECISÃO de cada um
 * sai do mapa** — é ele que diz a palavra, o ícone e a cor. O que fica aqui é
 * o texto que só este diálogo tem: o título, a frase que explica a diferença
 * entre pedir ajuste e recusar, e o rótulo do campo.
 */
const DIALOGO: Record<
  Exclude<DecisaoDoCliente, "aprovada">,
  { decisao: Decisao; titulo: string; descricao: string; rotulo: string; acao: string }
> = {
  ajustes_solicitados: {
    decisao: "ajustar",
    titulo: "Solicitar ajustes",
    descricao:
      "Diga o que precisa mudar. A equipe recebe o aviso e devolve uma versão nova.",
    rotulo: "O que precisa ser ajustado",
    // O BOTÃO DO RODAPÉ DIZ O QUE O CLIQUE FAZ, e não repete o nome da
    // decisão que o título já carrega — "Solicitar ajustes" em cima de
    // "Solicitar ajustes" é a mesma palavra duas vezes na mesma caixa.
    acao: "Enviar pedido",
  },
  rejeitada: {
    decisao: "recusar",
    titulo: "Recusar material",
    descricao:
      "Recusar é diferente de pedir ajuste: o material não vai ao ar desta forma. Diga o motivo.",
    rotulo: "Por que o material foi recusado",
    acao: "Recusar o material",
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
        <BotaoDeDecisao
          decisao="aprovar"
          onClick={() => decidir("aprovada", "")}
          disabled={enviando || somenteLeitura}
        />

        <BotaoDeDecisao
          decisao="ajustar"
          onClick={() => setPedindo("ajustes_solicitados")}
          disabled={enviando || somenteLeitura}
        />

        <BotaoDeDecisao
          decisao="recusar"
          onClick={() => setPedindo("rejeitada")}
          disabled={enviando || somenteLeitura}
        />
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
                <BotaoDeDecisao
                  decisao={DIALOGO[pedindo].decisao}
                  rotulo={DIALOGO[pedindo].acao}
                  carregando={enviando}
                  disabled={motivo.trim().length === 0}
                  onClick={() => decidir(pedindo, motivo)}
                />
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
