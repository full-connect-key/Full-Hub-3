"use client";

import { useState } from "react";

import { useTour } from "@/components/tour/provedor-do-tour";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chamarAcao } from "@/lib/acoes/cliente";
import { salvarOTour } from "@/lib/tour/acoes";
import { destaquesDoTour, type Convite } from "@/lib/tour/convite";
import type { Tour } from "@/lib/tour/passos";

/**
 * A PORTA DO TOUR: o diálogo de primeiro acesso.
 *
 * ---------------------------------------------------------------------------
 * **"Pular por agora" NÃO SOME PARA SEMPRE**, e o caminho de volta é o menu de
 * ajuda — mais um lembrete uma única vez no dia seguinte. Quem decide quando
 * ele aparece é `devoConvidar()`, e o "uma única vez" é derivado do trigger da
 * 0101: pular de novo não move `finalizado_em`, então o dia seguinte passa uma
 * vez só. A conta inteira está em `lib/tour/convite.ts`.
 * ---------------------------------------------------------------------------
 *
 * **ELE É CENTRADO E BLOQUEIA, ao contrário do tour.** O tour não bloqueia
 * nada de propósito — o passo interativo depende de o clique da página
 * chegar. Aqui é o contrário: a pergunta é "quer ou não quer", e as duas
 * respostas são botões deste diálogo. Um convite que a pessoa pode ignorar
 * clicando em volta é um convite que ela ignora sem decidir, e amanhã ele
 * volta.
 */
export function BoasVindas({
  convite,
  primeiroNome,
  tour,
}: {
  /** `null` quando não há convite nenhum — e aí nada é desenhado. */
  convite: Convite | null;
  primeiroNome: string;
  tour: Tour;
}) {
  const { comecar } = useTour();
  // ABERTO NO PRIMEIRO QUADRO, pelo inicializador do `useState` e não por um
  // efeito: `setState` no corpo de um efeito dispara renderização em cascata,
  // e o `lint` do projeto reprova — é a mesma armadilha do editor de post, que
  // virou `key` no Sprint 14, e do indicador de `AtualizacaoAoVivo`.
  const [aberto, setAberto] = useState(convite !== null);

  if (!convite) return null;

  const destaques = destaquesDoTour(tour);

  function pular() {
    setAberto(false);
    // O "não quero agora" É UMA ESCRITA, e falhar em silêncio aqui faria o
    // diálogo voltar na próxima visita sem nada explicando por quê. O toast
    // só aparece no erro: `chamarAcao` devolve o resultado e quem decide
    // mostrar é esta linha.
    void chamarAcao(() =>
      salvarOTour({
        tourId: tour.id,
        versao: tour.versao,
        status: "pulado",
        passoAtual: 0,
        pulados: [],
        semAncora: [],
      }),
    ).then((r) => {
      if (!r.ok) console.error("[tour] não deu para gravar o pulo:", r.error);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {convite === "lembrete"
              ? `Ainda dá tempo, ${primeiroNome}`
              : `Bem-vindo ao Full Hub, ${primeiroNome}`}
          </DialogTitle>
          <DialogDescription>
            {/*
              A FRASE DO SPRINT, palavra por palavra, e ela não cita task,
              subtarefa nem workflow: quem lê isto está no primeiro minuto do
              produto, e vocabulário interno no primeiro minuto é o que faz a
              pessoa achar que não vai entender.
            */}
            Aqui a agência organiza as demandas, acompanha prazos e aprova
            conteúdo com os clientes — tudo no mesmo lugar. Em 2 minutos eu te
            mostro o essencial.
          </DialogDescription>
        </DialogHeader>

        {/*
          OS TRÊS CARTÕES SAEM DOS PASSOS, por `destaquesDoTour()`: uma lista
          própria aqui seria a segunda verdade sobre o mesmo tour, e a que
          divergiria é esta — ninguém a relê ao acrescentar um passo.

          E eles são `--action-soft` com `--action-text`, o par do item ativo
          da barra lateral, que o `check:cores` já mede em 5,88:1.
        */}
        <ul className="grid gap-2 sm:grid-cols-3">
          {destaques.map((titulo) => (
            <li
              key={titulo}
              className="bg-action-soft text-action-text rounded-lg px-3 py-2 text-xs font-medium"
            >
              {titulo}
            </li>
          ))}
        </ul>

        <DialogFooter>
          {/* "Pular por agora" É `ghost` E FICA À ESQUERDA do primário, que é a
              ordem de todo diálogo do produto: o que encerra sem fazer vem
              antes do que faz. */}
          <Button type="button" variant="ghost" onClick={pular}>
            Pular por agora
          </Button>
          <Button
            type="button"
            onClick={() => {
              setAberto(false);
              comecar(tour);
            }}
          >
            Começar o tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
