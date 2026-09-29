"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type {
  AlertaDeCarga,
} from "@/lib/dominio/feedback";
import {
  EXPLICACAO_DO_ALERTA,
  ROTULOS_DE_ALERTA_DE_CARGA,
} from "@/lib/dominio/feedback";

import { resolverAlertaDeCarga } from "./acoes";

/**
 * OS SINAIS QUE SÃO DA GESTÃO, e que a pessoa não vê.
 *
 * ---------------------------------------------------------------------------
 * É provavelmente o retorno mais valioso do módulo: **quando alguém entrega
 * menos, quase sempre o sistema sabe por quê — e a resposta costuma estar na
 * distribuição de trabalho, não na pessoa.**
 *
 * Um alerta de sobrecarga na tela dela viraria cobrança por uma decisão que não
 * foi dela. O que é dela chega pelo feedback, relativizado: o contexto entra no
 * prompt justamente para o texto não cobrar volume de quem recebeu 140% da
 * capacidade.
 * ---------------------------------------------------------------------------
 *
 * **A FRASE VEM COM O NOME DO TIPO**, e não só o rótulo: "Carga baixa" ao lado
 * do nome de alguém lê como cobrança, e o alerta existe para dizer o
 * contrário. A frase é o que separa um sinal de uma acusação.
 *
 * **`--warning` e nunca `--danger`.** Nenhum destes quatro é um erro: são
 * padrões de distribuição que alguém precisa olhar. Vermelho aqui treinaria o
 * hábito de ignorar vermelho — a mesma razão do alerta de 7 dias no Portal.
 *
 * **E não existe apagar**, só marcar resolvido: um alerta apagado é um padrão
 * que a agência deixou de ver sem decidir nada sobre ele.
 */
export function AlertasDeCarga({ alertas }: { alertas: AlertaDeCarga[] }) {
  if (alertas.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="alertas-de-carga-titulo">
      <h2
        id="alertas-de-carga-titulo"
        className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
      >
        <AlertTriangle className="size-4" aria-hidden />
        Sinais de distribuição de trabalho
      </h2>
      <p className="text-text-muted text-sm">
        Só a gestão vê isto. A pessoa não recebe nenhum destes como cobrança —
        o que é dela chega pelo feedback, junto do contexto que explica.
      </p>

      <ul className="space-y-2">
        {alertas.map((a) => (
          <li
            key={a.id}
            className="bg-warning-soft border-warning flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-warning text-sm font-semibold">
                {ROTULOS_DE_ALERTA_DE_CARGA[a.tipo] ?? a.tipo} ·{" "}
                {a.pessoa?.nome ?? "—"}
              </p>
              <p className="text-text-secondary mt-0.5 text-xs">
                {EXPLICACAO_DO_ALERTA[a.tipo] ?? ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void chamarEMostrar(() => resolverAlertaDeCarga({ id: a.id }))
              }
            >
              Marcar resolvido
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
