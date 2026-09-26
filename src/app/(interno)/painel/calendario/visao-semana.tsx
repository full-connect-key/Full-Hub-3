"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { UserAvatar } from "@/components/shared/user-avatar";
import {
  COR_DA_CAMADA,
  ROTULOS_DE_CAMADA,
  ocupaODia,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import { diasDoPeriodo, ehFimDeSemana, type Janela } from "./periodo";

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
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto">
      <div className="bg-border grid min-w-[52rem] grid-cols-7 gap-px overflow-hidden rounded-lg border">
        {dias.map((dia) => {
          const doDia = itens.filter((i) => ocupaODia(i, dia));
          const ausencias = doDia.filter((i) => i.tipo === "ausencia");
          const trabalho = doDia.filter((i) => i.tipo !== "ausencia");

          return (
            <div
              key={dia}
              className={cn("min-h-64 p-2", ehFimDeSemana(dia) ? "bg-muted" : "bg-surface-card")}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    dia === hoje ? "text-accent-strong" : "text-text-secondary",
                  )}
                >
                  {format(parseISO(dia), "EEE dd", { locale: ptBR })}
                </span>
                {ausencias.length > 0 ? (
                  <span
                    className="flex -space-x-1"
                    title={`Fora: ${ausencias.map((a) => a.pessoa?.nome ?? "—").join(", ")}`}
                  >
                    {ausencias.slice(0, 3).map((a) => (
                      <UserAvatar
                        key={a.id}
                        name={a.pessoa?.nome ?? "—"}
                        src={a.pessoa?.avatar_url ?? null}
                        size="sm"
                      />
                    ))}
                  </span>
                ) : null}
              </div>

              <ul className="mt-2 space-y-1">
                {trabalho.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => aoAbrir(item)}
                      title={`${ROTULOS_DE_CAMADA[item.tipo]}: ${item.titulo}`}
                      className={cn(
                        "w-full rounded px-2 py-1 text-left text-xs",
                        COR_DA_CAMADA[item.tipo],
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
