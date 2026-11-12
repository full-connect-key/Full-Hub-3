"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  abreDetalhe,
  corDoEvento,
  ocupaODia,
  rotuloDoEvento,
  type ItemDoCalendario,
} from "@/lib/dominio/calendario";
import { cn } from "@/lib/utils";

import { MarcaDoAniversario } from "./marca-do-aniversario";
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
                {doDia.map((item) => {
                  const dentro = (
                    <>
                      <span className="flex min-w-0 items-center gap-1">
                        <MarcaDoAniversario item={item} />
                        {/* `min-w-0` nos dois: item de flex se recusa a ficar
                            menor que o conteúdo, e sem ele um nome longo
                            estoura o chip em vez de cortar. */}
                        <span className="min-w-0 truncate font-medium">{item.titulo}</span>
                      </span>
                      {item.cliente ? (
                        <span className="block truncate">{item.cliente}</span>
                      ) : null}
                    </>
                  );
                  const aparencia = cn(
                    "w-full rounded px-2 py-1 text-left text-xs",
                    corDoEvento(item),
                  );
                  const rotulo = `${rotuloDoEvento(item)}: ${item.titulo}`;

                  // O ANIVERSÁRIO NÃO É BOTÃO (0130): não há evento para
                  // abrir, e um botão que abre um painel vazio é um controle
                  // que não responde. Quem decide é `abreDetalhe()`, no
                  // domínio, porque a mesma pergunta é feita na visão de mês.
                  return (
                    <li key={item.id}>
                      {abreDetalhe(item) ? (
                        <button
                          type="button"
                          onClick={() => aoAbrir(item)}
                          title={rotulo}
                          className={aparencia}
                        >
                          {dentro}
                        </button>
                      ) : (
                        <div title={rotulo} className={aparencia}>
                          {dentro}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
