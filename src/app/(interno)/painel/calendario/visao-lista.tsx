"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { baixarCSV, montarCSV } from "@/lib/dominio/csv";
import {
  COR_DA_CAMADA,
  ROTULOS_DE_CAMADA,
  diaNaGrade,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import type { Janela } from "./periodo";

/**
 * A lista cronológica, agrupada por dia.
 *
 * **O agrupamento colapsa, como na Gestão de Tasks**, e o dia sem nada não
 * aparece: um mês com quatro entregas viraria trinta e uma linhas vazias e
 * quatro cheias, e a pessoa rolaria procurando as quatro.
 *
 * **O CSV sai do que está na tela.** Ele é a resposta de "manda isso para
 * mim" — e um arquivo com um recorte diferente do que a pessoa acabou de
 * filtrar é a pior forma de errar, porque ninguém confere linha a linha.
 */
export function VisaoDeLista({ janela, itens }: { janela: Janela; itens: ItemDoCalendario[] }) {
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const porDia = new Map<string, ItemDoCalendario[]>();
  for (const item of itens) {
    const { de } = diaNaGrade(item);
    // O item que começa antes da janela entra no primeiro dia dela: ele está
    // acontecendo, e deixá-lo de fora faria a lista contar menos do que a
    // grade do mesmo período mostra.
    const dia = de < janela.inicio ? janela.inicio : de;
    porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
  }

  const dias = [...porDia.keys()].sort();

  function alternar(dia: string) {
    const proximo = new Set(fechados);
    if (proximo.has(dia)) proximo.delete(dia);
    else proximo.add(dia);
    setFechados(proximo);
  }

  function exportarCsv() {
    const cabecalho = ["Data", "Tipo", "Título", "Cliente", "Responsável", "Status"];
    const linhas = itens.map((i) => [
      diaNaGrade(i).de,
      ROTULOS_DE_CAMADA[i.tipo],
      i.titulo,
      i.cliente ?? "",
      i.pessoa?.nome ?? "",
      i.status ?? "",
    ]);
    // `montarCSV` E NÃO O ARQUIVO MONTADO AQUI: era a sexta cópia da mesma
    // dezena de linhas no produto, e as cópias já divergiam — o BOM que o
    // Excel precisa para ler UTF-8 estava em quatro delas e faltava numa.
    baixarCSV(montarCSV(cabecalho, linhas), `calendario-${janela.inicio}.csv`);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarCsv}>
          <Download aria-hidden className="size-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="space-y-2">
        {dias.map((dia) => {
          const doDia = porDia.get(dia) ?? [];
          const fechado = fechados.has(dia);

          return (
            <section key={dia} className="rounded-card bg-surface-card border">
              <button
                type="button"
                onClick={() => alternar(dia)}
                aria-expanded={!fechado}
                className="flex w-full items-center gap-2 px-4 py-2 text-left"
              >
                {fechado ? (
                  <ChevronRight aria-hidden className="text-text-muted size-4" />
                ) : (
                  <ChevronDown aria-hidden className="text-text-muted size-4" />
                )}
                <span className="text-sm font-medium capitalize">
                  {format(parseISO(dia), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <span className="text-text-muted ml-auto text-xs tabular-nums">
                  {doDia.length}
                </span>
              </button>

              {fechado ? null : (
                <ul className="divide-border divide-y border-t">
                  {doDia.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.link}
                        className="hover:bg-muted flex items-center gap-3 px-4 py-2 text-sm"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded px-2 py-0.5 text-xs",
                            COR_DA_CAMADA[item.tipo],
                          )}
                        >
                          {ROTULOS_DE_CAMADA[item.tipo]}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
                        {item.cliente ? (
                          <span className="text-text-muted hidden truncate text-xs sm:block">
                            {item.cliente}
                          </span>
                        ) : null}
                        {item.pessoa ? (
                          <UserAvatar
                            name={item.pessoa.nome}
                            src={item.pessoa.avatar_url}
                            size="sm"
                          />
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
