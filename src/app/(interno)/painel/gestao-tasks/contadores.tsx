"use client";

import { ListFilter } from "lucide-react";

import { cn } from "@/lib/utils";

import { useFiltros } from "./filtros";

/**
 * Os três números da aba de Demandas — e o de atrasadas FILTRA.
 *
 * ---------------------------------------------------------------------------
 * **O NÚMERO ERA UM BECO SEM SAÍDA, e foi o usuário quem apontou:** *"quero
 * que ao clicar no botão de atrasadas, ele me mostre quais tasks estão
 * atrasadas"*. Ele estava certo — "2 atrasadas" era um `<div>`: a tela dizia
 * que havia duas e não tinha como mostrar quais. Quem via o número clicava,
 * nada acontecia, e o caminho de verdade era achar a pílula "Só atrasadas" na
 * barra de filtros, três blocos abaixo.
 *
 * **E ele NÃO é um segundo filtro ao lado daquela pílula.** Os dois passam por
 * `useFiltros()`, que é a mesma `?atrasadas=1` da URL: o contador mostra-se
 * ativo quando a pílula está ligada, e clicar num desliga o outro. Duas
 * controles para o mesmo estado só seriam duas verdades se cada um guardasse a
 * sua — é a razão pela qual filtro mora na URL neste produto, e não em estado
 * de componente.
 * ---------------------------------------------------------------------------
 *
 * **Os outros dois continuam sendo texto, e é decisão.** "Abertas" não tem
 * filtro que o represente — `status` escolhe UM status, e "aberta" é o conjunto
 * dos que não encerraram; e "concluídas no mês" pediria um recorte de mês que o
 * board não tem. Um botão que leva a um filtro parecido com o número é pior que
 * um número: ele muda a conta debaixo do rótulo que a pessoa acabou de ler.
 *
 * **Zero não vira botão.** Clicar em "0 atrasadas" levaria a um board vazio, e
 * um caminho que termina em lista vazia ensina a não clicar — a mesma razão
 * pela qual o selo de contagem da fila de aprovações não existe no zero.
 */
export function ContadoresDeDemandas({
  abertas,
  atrasadas,
  concluidasNoMes,
}: {
  abertas: number;
  atrasadas: number;
  concluidasNoMes: number;
}) {
  const { filtros, definir } = useFiltros();

  return (
    <div className="flex flex-wrap gap-2">
      <Numero valor={abertas} rotulo="abertas" />

      {atrasadas > 0 ? (
        <button
          type="button"
          aria-pressed={filtros.atrasadas}
          onClick={() => definir({ atrasadas: !filtros.atrasadas })}
          className={cn(
            "rounded-lg border px-3.5 py-2 text-left transition-colors",
            "hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
            filtros.atrasadas && "border-danger bg-danger-soft",
          )}
        >
          <p className="text-destructive text-xl font-semibold tabular-nums">{atrasadas}</p>
          {/* O ICONE E A UNICA COISA QUE DIZ QUE ISTO CLICA. Sem ele o cartao
              tem a mesma cara dos dois ao lado, que sao texto -- e um controle
              que nao parece controle ensina que ele nao existe, que e o estado
              em que este numero estava. */}
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              filtros.atrasadas ? "text-danger" : "text-accent-strong",
            )}
          >
            <ListFilter aria-hidden className="size-3 shrink-0" />
            {filtros.atrasadas ? "atrasadas · filtrando" : "atrasadas · ver quais"}
          </p>
        </button>
      ) : (
        <Numero valor={0} rotulo="atrasadas" />
      )}

      <Numero valor={concluidasNoMes} rotulo="concluídas no mês" />
    </div>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="rounded-lg border px-3.5 py-2">
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      <p className="text-muted-foreground text-xs">{rotulo}</p>
    </div>
  );
}
