"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Images } from "lucide-react";
import { toast } from "sonner";

import { SeletorDeStatusDaSubtarefa } from "@/components/shared/seletor-de-status";
import { chamarAcao } from "@/lib/acoes/cliente";
import { rotuloDaData } from "@/lib/dominio/posts";
import { cn } from "@/lib/utils";
import type { EtapaDeSocialMinha } from "@/lib/dados/social-media";
import type { SubtaskStatus } from "@/lib/supabase/database.types";

import { moverEtapaDoPost } from "../social-media/acoes";

/**
 * As minhas etapas do Social, dentro de Minhas Tasks.
 *
 * **Bloco próprio e não itens misturados à lista de etapas de demanda**, e a
 * razão é o que cada uma carrega. A etapa de demanda é uma `SubtarefaDetalhada`
 * — rodada de aprovação, cronômetro, dependência cadastrada, a máquina de
 * estados que decide qual botão aparece. Uma etapa de post não tem nada disso,
 * e fabricar os campos para ela caber no mesmo molde faria a tela oferecer
 * "Enviar para aprovação" onde o banco responde outra coisa. O molde errado
 * mente com mais convicção que a ausência.
 *
 * **O QUE SE PERDE, e é consequência aceita:** a ordem não é global entre os
 * dois tipos — uma etapa de social que vence amanhã fica abaixo de uma etapa
 * de demanda que vence semana que vem. O que se ganha é que o redator abre UMA
 * tela para saber o que faz hoje, em vez de duas; duas caixas de entrada são
 * uma caixa que alguém deixa de olhar.
 *
 * A camada de dados já tirou daqui as que ainda não podem começar: uma etapa
 * de Layout cujo Conteúdo ninguém escreveu não é trabalho meu hoje, e o banco
 * recusaria o clique.
 */
export function EtapasDeSocial({ etapas }: { etapas: EtapaDeSocialMinha[] }) {
  const [, comecar] = useTransition();
  const [mexendo, setMexendo] = useState<string | null>(null);

  if (etapas.length === 0) return null;

  function mover(etapa: EtapaDeSocialMinha, status: SubtaskStatus) {
    setMexendo(etapa.id);
    comecar(async () => {
      const r = await chamarAcao(() => moverEtapaDoPost(etapa.id, { status }));
      setMexendo(null);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.error);
    });
  }

  return (
    <section className="space-y-2" aria-labelledby="social-titulo">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="social-titulo"
          className="text-text-primary flex items-center gap-2 text-sm font-semibold"
        >
          <Images aria-hidden className="text-text-muted size-4" />
          Social
        </h2>
        <Link
          href="/painel/social-media"
          className="text-accent-strong text-xs hover:underline"
        >
          Ver o calendário
        </Link>
      </div>

      <ul className="space-y-1.5">
        {etapas.map((etapa) => (
          <li
            key={etapa.id}
            className="border-border bg-surface-card flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2.5"
          >
            <span className="min-w-0 flex-1">
              <Link
                href={`/painel/social-media?post=${etapa.postId}`}
                className="text-text-primary block truncate text-sm font-medium hover:underline"
              >
                {etapa.nome}
              </Link>
              {/* A LINHAGEM, como na etapa de demanda: `Cliente · Post`. É o
                  que responde "por que estou fazendo isto?" sem gastar uma
                  linha inteira da lista. */}
              <span className="text-text-secondary block truncate text-xs">
                {etapa.cliente} · {etapa.tema}
              </span>
            </span>

            <span
              className={cn(
                "text-xs tabular-nums",
                etapa.dataPublicacao ? "text-text-secondary" : "text-text-muted",
              )}
            >
              {/* A DATA DO POST E NÃO UM PRAZO DA ETAPA: a etapa não tem prazo
                  próprio quando o mês abre em branco, e o que a pessoa precisa
                  saber é quando aquilo vai ao ar. "Sem data" é a instrução —
                  alguém ainda vai escolher o dia. */}
              {rotuloDaData(
                etapa.dataPublicacao
                  ? format(parseISO(etapa.dataPublicacao), "dd/MM")
                  : null,
              )}
            </span>

            <SeletorDeStatusDaSubtarefa
              status={etapa.status}
              podeEditar={mexendo !== etapa.id}
              aoMudar={(status) => mover(etapa, status)}
              compacto
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
