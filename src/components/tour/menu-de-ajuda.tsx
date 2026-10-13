"use client";

import Link from "next/link";
import { BookOpen, CircleHelp, Compass } from "lucide-react";

import { useTour } from "@/components/tour/provedor-do-tour";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tour } from "@/lib/tour/passos";

/**
 * O `?` DA TOPBAR: o caminho de volta para o tour.
 *
 * ---------------------------------------------------------------------------
 * **ELE EXISTE PORQUE "Pular por agora" NÃO PODE SER DEFINITIVO.** Quem pulou
 * no primeiro acesso recebe um lembrete no dia seguinte e mais nenhum — e sem
 * este menu, a partir do terceiro dia o tutorial deixaria de existir para ela.
 * Um tutorial que só é oferecido uma vez é um tutorial que quase ninguém faz,
 * porque o primeiro minuto do produto é o pior momento para parar e aprender.
 * ---------------------------------------------------------------------------
 *
 * **ELE É O DISCO DA TOPBAR, como o sino e o avatar**, e fica ao lado deles:
 * `.disco-da-topbar` é o vidro do desenho aprovado, e um botão chapado entre
 * dois discos leria como coisa de outra tela.
 *
 * **"Falar com o suporte interno" NÃO ESTÁ AQUI, e a ausência é decisão.** O
 * sprint pede o item, e o produto não tem canal nenhum — não há fila de
 * suporte, não há endereço, não há tela. Um item que abre o cliente de e-mail
 * com um endereço inventado é pior que item nenhum: ele promete uma resposta
 * que não vai chegar. No dia em que houver o canal, é uma linha aqui.
 *
 * **"Refazer o tour desta tela" também não**, e por outro motivo: os
 * micro-tours por módulo são a parte seguinte deste sprint. O item entra com
 * eles, porque um "tour desta tela" que não existe em tela nenhuma é o mesmo
 * problema de cima.
 */
export function MenuDeAjuda({
  tour,
  rotuloDoTour,
  comecado,
  convidaARever,
  hrefDosPlaybooks,
}: {
  tour: Tour;
  /** "o tour do painel" / "o tour do portal" — a frase muda com a área. */
  rotuloDoTour: string;
  /** A pessoa parou no meio: o item diz "retomar" em vez de "fazer". */
  comecado: boolean;
  /** O tour mudou de verdade desde que ela o concluiu. */
  convidaARever: boolean;
  /** `null` no portal: o Full Academy é interno, e o cliente não o alcança. */
  hrefDosPlaybooks: string | null;
}) {
  const { comecar, andando } = useTour();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="disco-da-topbar rounded-full"
          aria-label="Ajuda"
        >
          <CircleHelp aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          {/*
            O CONVITE PARA REVER É UMA LINHA AQUI, e nunca um diálogo: é o
            "aviso leve, nunca forçado" do sprint. Quem já concluiu o tour
            aprendeu a interface, e pôr um diálogo na frente dela por causa de
            um passo novo é cobrar atenção por uma mudança que foi nossa.
          */}
          {convidaARever
            ? "O tour mudou desde a última vez que você o fez."
            : "Como o Full Hub funciona"}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          // DESLIGADO ENQUANTO UM TOUR CORRE, em vez de começar de novo: o
          // clique recomeçaria do passo zero e a pessoa perderia o lugar sem
          // ter pedido. Um item que faz a coisa errada é pior que um item
          // desligado.
          disabled={andando}
          onSelect={() => comecar(tour)}
        >
          <Compass aria-hidden />
          {comecado ? `Retomar ${rotuloDoTour}` : `Fazer ${rotuloDoTour}`}
        </DropdownMenuItem>

        {hrefDosPlaybooks ? (
          <DropdownMenuItem asChild>
            <Link href={hrefDosPlaybooks}>
              <BookOpen aria-hidden />
              Playbooks no Full Academy
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
