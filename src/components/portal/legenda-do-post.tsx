"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIMITE = 320;

/**
 * A legenda, inteira, com botão de copiar.
 *
 * **Copiar é a razão de a legenda estar aqui.** Quem aprova um post é quem
 * muitas vezes vai publicá-lo, e selecionar um parágrafo longo no celular sem
 * disparar o menu de seleção é uma luta. Um clique resolve.
 *
 * `navigator.clipboard` pode ser recusado (aba sem foco, permissão negada), e
 * por isso a recusa é tratada: dizer "copiado" sem ter copiado é pior que não
 * ter o botão.
 */
export function LegendaDoPost({ legenda }: { legenda: string | null }) {
  const [aberta, setAberta] = useState(false);
  const [copiou, setCopiou] = useState<boolean | null>(null);

  if (!legenda) {
    return (
      <p className="text-text-muted text-sm">
        Este material ainda não tem legenda.
      </p>
    );
  }

  const longa = legenda.length > LIMITE;
  const visivel = aberta || !longa ? legenda : `${legenda.slice(0, LIMITE)}…`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(legenda!);
      setCopiou(true);
    } catch {
      setCopiou(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm whitespace-pre-wrap">{visivel}</p>

      <div className="flex flex-wrap items-center gap-3">
        {longa ? (
          <button
            type="button"
            onClick={() => setAberta((a) => !a)}
            className="text-accent-strong text-sm hover:underline"
          >
            {aberta ? "Mostrar menos" : "Ler a legenda inteira"}
          </button>
        ) : null}

        <Button variant="ghost" size="sm" onClick={copiar}>
          {copiou ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
          {copiou ? "Copiado" : "Copiar legenda"}
        </Button>

        {copiou === false ? (
          <span className={cn("text-danger text-xs")}>
            O navegador não deixou copiar — selecione o texto acima.
          </span>
        ) : null}
      </div>
    </div>
  );
}
