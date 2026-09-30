"use client";

import { ListFilter } from "lucide-react";

import { cn } from "@/lib/utils";

import { useFiltros } from "./filtros";

/**
 * Os três números da aba de Demandas — e o de atrasadas FILTRA.
 *
 * ---------------------------------------------------------------------------
 * **ELES SÃO UMA LINHA DE TEXTO, e não três cartões brancos.** Eram três
 * ladrilhos com número grande em cima do board, gastando noventa pixels da
 * primeira dobra da tela mais cheia do painel — e o board é a peça. É a
 * decisão do Início: a lista logo abaixo É esses números, então eles não
 * viram cartão; o número mora onde serve de link.
 *
 * **E a linha fica DENTRO da aba, e não no subtítulo do cabeçalho**, que era
 * onde a proposta a punha. O cabeçalho é das quatro seções e os números
 * nascem da mesma consulta que a lista — subi-los pediria uma segunda
 * chamada só para desenhar três números quarenta pixels acima, e dois lugares
 * contando a mesma coisa é exatamente o bug que este contador já teve duas
 * vezes, as duas encontradas pelo usuário.
 *
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
    <p className="text-text-secondary text-sm font-semibold">
      <span className="tabular-nums">{abertas}</span>{" "}
      {abertas === 1 ? "aberta" : "abertas"}
      {" · "}
      {atrasadas > 0 ? (
        <button
          type="button"
          aria-pressed={filtros.atrasadas}
          onClick={() => definir({ atrasadas: !filtros.atrasadas })}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm hover:underline",
            "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
            filtros.atrasadas ? "text-danger" : "text-accent-strong",
          )}
        >
          <ListFilter aria-hidden className="size-3.5 shrink-0" />
          <span className="tabular-nums">{atrasadas}</span>{" "}
          {atrasadas === 1 ? "atrasada" : "atrasadas"}
          {filtros.atrasadas ? " · filtrando" : " · ver quais"}
        </button>
      ) : (
        <span>0 atrasadas</span>
      )}
      {" · "}
      <span className="tabular-nums">{concluidasNoMes}</span>{" "}
      {concluidasNoMes === 1 ? "concluída no mês" : "concluídas no mês"}
    </p>
  );
}
