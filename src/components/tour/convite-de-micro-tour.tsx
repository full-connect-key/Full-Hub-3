"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Compass, X } from "lucide-react";

import { useTour } from "@/components/tour/provedor-do-tour";
import { Button } from "@/components/ui/button";
import { chamarAcao } from "@/lib/acoes/cliente";
import { salvarOTour } from "@/lib/tour/acoes";
import { microTourDaRota } from "@/lib/tour/micro-tours";
import type { ProgressoDeTour } from "@/lib/tour/passos";

/**
 * "Primeira vez aqui. Quer uma volta rápida?"
 *
 * ---------------------------------------------------------------------------
 * **UM BALÃO DISCRETO NO CANTO, e não um diálogo** — é o pedido do sprint, e a
 * diferença importa: quem chega num módulo pela primeira vez chegou para
 * FAZER alguma coisa, não para aprender. O diálogo de boas-vindas bloqueia
 * porque ali a única pergunta da tela é "quer ou não quer"; aqui a tela tem um
 * trabalho atrás do balão, e interromper é cobrar atenção na hora errada.
 *
 * **ELE MORA NO LAYOUT, e o módulo é descoberto pela ROTA.** A alternativa é
 * montá-lo em nove páginas, e a décima — a que alguém criar depois — nasceria
 * sem micro-tour sem nada dizendo. `microTourDaRota()` resolve pelo prefixo
 * mais longo, a forma de `findMenuItem`.
 * ---------------------------------------------------------------------------
 *
 * **"Não, obrigado" É UMA ESCRITA, e é o que faz o balão não voltar.** Sem
 * ela, a cada visita ao módulo a oferta reapareceria — e uma oferta que
 * reaparece é a que a pessoa aprende a fechar sem ler.
 */
export function ConviteDeMicroTour({ tours }: { tours: ProgressoDeTour[] }) {
  const caminho = usePathname();
  const { comecar, andando } = useTour();

  // O QUE FOI DECIDIDO NESTA SESSÃO, e por que ele existe: o `tours` desce do
  // layout, e o layout do App Router NÃO é remontado ao navegar entre as telas
  // dele — então a lista chega com o estado de quando a aba abriu. Sem este
  // conjunto, aceitar ou recusar o micro-tour e voltar ao módulo mostraria a
  // oferta de novo, porque o servidor ainda não foi consultado.
  const [decididos, setDecididos] = useState<string[]>([]);

  const tour = microTourDaRota(caminho);
  if (!tour) return null;

  // Já há um tour correndo: dois balões na tela ao mesmo tempo é a oferta
  // competindo com o passo que a pessoa está lendo.
  if (andando) return null;

  if (decididos.includes(tour.id)) return null;
  // Qualquer linha já gravada — concluído, pulado ou no meio — quer dizer que
  // a oferta já foi feita uma vez. Ela não se repete: quem quiser refazer
  // encontra o tour no menu de ajuda.
  if (tours.some((t) => t.tourId === tour.id)) return null;

  function decidir(aceitar: boolean) {
    setDecididos((antes) => [...antes, tour!.id]);

    if (aceitar) {
      comecar(tour!);
      return;
    }

    void chamarAcao(() =>
      salvarOTour({
        tourId: tour!.id,
        versao: tour!.versao,
        status: "pulado",
        passoAtual: 0,
        pulados: [],
        semAncora: [],
      }),
    ).then((r) => {
      if (!r.ok) console.error("[tour] não deu para gravar a recusa:", r.error);
    });
  }

  return (
    /*
      FIXO NO CANTO DE BAIXO, à direita no desktop e ocupando a largura no
      celular: em 375px um cartão de 320px encostado numa borda deixa o outro
      lado com dez pixels de respiro, que lê como erro de alinhamento.

      `z-[60]` fica ABAIXO do recorte do tour (`z-[70]`): se a pessoa aceitar,
      o balão sai no mesmo quadro — mas o passo é desenhado por cima de
      qualquer forma, e a ordem escrita é o que impede o convite de cobrir o
      primeiro passo num quadro de transição.
    */
    <div
      role="region"
      aria-label="Convite para o tour desta tela"
      className="bg-card rounded-card shadow-cartao border-border fixed inset-x-4 bottom-4 z-[60] border p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80"
    >
      <div className="flex items-start gap-3">
        {/* O LADRILHO É A COR DE AÇÃO, nunca `--warning`: o convite não cobra
            nada nem avisa de problema — é um "olhe aqui", que é o que a cor de
            ação diz no resto do produto. */}
        <span className="bg-action-soft text-action-text flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Compass aria-hidden className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-semibold">
            Primeira vez aqui
          </p>
          <p className="text-text-secondary mt-0.5 text-sm">
            Quer uma volta rápida? Leva uns 20 segundos.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => decidir(true)}>
              Quero
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => decidir(false)}
            >
              Não, obrigado
            </Button>
          </div>
        </div>

        {/* O X FAZ A MESMA COISA QUE "Não, obrigado", e é de propósito: um
            fechar que não grava faria a oferta voltar na próxima visita, e a
            pessoa que fechou duas vezes concluiria que o botão não funciona.
            Ele existe porque fechar pelo canto é o gesto de quem não quer ler
            os dois botões. */}
        <button
          type="button"
          onClick={() => decidir(false)}
          aria-label="Fechar o convite"
          className="text-text-muted hover:text-text-primary -mt-1 -mr-1 shrink-0 rounded p-1 transition-colors"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
