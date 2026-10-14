"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  corDoEvento,
  ocupaODia,
  rotuloDoEvento,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import { diasDoPeriodo, ehFimDeSemana, type Janela } from "./periodo";
import { hojeNaAgencia } from "@/lib/dominio/datas";

/**
 * A semana: sete colunas, e espaço para o texto caber.
 *
 * **Aqui não há "+ N mais".** É a diferença que justifica a visão existir: no
 * mês a célula corta em três porque trinta e um dias não cabem de outro jeito;
 * na semana a coluna é alta e o dia mostra tudo o que tem. Cortar aqui
 * também faria as duas visões dizerem a mesma coisa em tamanhos diferentes.
 */
export function VisaoDeSemana({
  janela,
  itens,
  aoAbrir,
}: {
  janela: Janela;
  itens: ItemDoCalendario[];
  aoAbrir: (item: ItemDoCalendario) => void;
}) {
  const dias = diasDoPeriodo(janela.inicio, janela.fim);
  const hoje = hojeNaAgencia();

  return (
    <div className="overflow-x-auto">
      <div className="bg-border grid min-w-[52rem] grid-cols-7 gap-px overflow-hidden rounded-lg border">
        {dias.map((dia) => {
          // A PILHA DE AVATARES DE QUEM ESTAVA FORA saiu com a camada de
          // ausência (0105), aqui e na grade do mês: ela vinha de
          // `item.pessoa`, que a view não escreve mais.
          const doDia = itens.filter((i) => ocupaODia(i, dia));

          return (
            <div
              key={dia}
              className={cn("min-h-64 p-2", ehFimDeSemana(dia) ? "bg-muted" : "bg-surface-card")}
            >
              <div className="flex items-center">
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    dia === hoje ? "text-accent-strong" : "text-text-secondary",
                  )}
                >
                  {format(parseISO(dia), "EEE dd", { locale: ptBR })}
                </span>
              </div>

              <ul className="mt-2 space-y-1">
                {doDia.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => aoAbrir(item)}
                      title={`${rotuloDoEvento(item)}: ${item.titulo}`}
                      className={cn(
                        "w-full rounded px-2 py-1 text-left text-xs",
                        corDoEvento(item),
                      )}
                    >
                      <span className="block truncate font-medium">{item.titulo}</span>
                      {item.cliente ? (
                        <span className="block truncate">{item.cliente}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
