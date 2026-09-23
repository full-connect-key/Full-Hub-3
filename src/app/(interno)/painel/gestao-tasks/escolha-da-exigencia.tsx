"use client";

import { Check, ShieldCheck, Users, X } from "lucide-react";

import {
  EXIGENCIAS_DE_APROVACAO,
  EXPLICACAO_DA_EXIGENCIA,
  ROTULOS_DE_EXIGENCIA,
} from "@/lib/dominio/tasks";
import type { ExigenciaAprovacao } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const ICONE = { nenhuma: X, interna: ShieldCheck, cliente: Users } as const;

/**
 * O que a demanda inteira exige para ser dada por entregue.
 *
 * TRÊS OPÇÕES, E NÃO QUATRO. "Do cliente" já inclui a validação interna —
 * toda rodada de cliente nasce depois de uma interna aprovada, e é regra de
 * banco desde a 0007. Um quarto botão "dupla" teria exatamente o efeito do
 * terceiro, e dois caminhos para o mesmo lugar é como nascem duas verdades
 * sobre a mesma demanda.
 *
 * Botões lado a lado, e não um `<select>`: são três, a escolha é a mesma toda
 * vez, e as três precisam estar visíveis juntas para a pessoa ver que uma
 * contém a outra. Dentro de uma caixa fechada, "Do cliente" parece alternativa
 * a "Interna" quando na verdade é a interna mais uma etapa.
 *
 * A explicação embaixo é da opção ESCOLHIDA, não das três: o texto das três
 * juntas ocupa meia tela e ninguém lê. Escolher troca o texto, e é aí que a
 * pessoa confere se entendeu o que marcou.
 */
export function EscolhaDaExigencia({
  valor,
  aoMudar,
  id,
}: {
  valor: ExigenciaAprovacao;
  aoMudar: (novo: ExigenciaAprovacao) => void;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Exigência de aprovação da demanda"
        id={id}
        className="grid gap-2 sm:grid-cols-3"
      >
        {EXIGENCIAS_DE_APROVACAO.map((opcao) => {
          const Icone = ICONE[opcao];
          const marcada = valor === opcao;
          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={marcada}
              onClick={() => aoMudar(opcao)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                marcada
                  ? // Fundo claro da marca com o azul legível por cima. Texto
                    // branco sobre --brand-blue dá 1.7:1, que é o erro que a
                    // identidade deste produto existe para não repetir.
                    "border-accent-strong bg-blue-soft text-accent-strong font-medium"
                  : "text-text-secondary hover:bg-muted",
              )}
            >
              <Icone aria-hidden className="size-4 shrink-0" />
              {ROTULOS_DE_EXIGENCIA[opcao]}
            </button>
          );
        })}
      </div>

      <p className="text-text-muted flex items-start gap-1.5 text-xs leading-relaxed">
        <Check aria-hidden className="text-accent-strong mt-0.5 size-3.5 shrink-0" />
        <span>{EXPLICACAO_DA_EXIGENCIA[valor]}</span>
      </p>
    </div>
  );
}
