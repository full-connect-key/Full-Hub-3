import { CalendarCheck2 } from "lucide-react";

/**
 * "Programado" — a peça já está agendada na rede.
 *
 * ---------------------------------------------------------------------------
 * **ELE SÓ APARECE QUANDO O FATO EXISTE, e não há par para o contrário**
 * (migration 0111).
 *
 * Um selo "A programar" em trinta linhas de um mês recém-aberto é trinta
 * selos que não informam nada — e seria pior que isso aqui, porque `false`
 * quer dizer três coisas ao mesmo tempo: ninguém agendou, a conta tem um
 * fluxo sem elo de pós-entrega, ou a leitura falhou. A ausência não afirma
 * nenhuma das três. É a decisão da matriz do Day Off, que pinta só a exceção.
 *
 * **PAR NOMEADO, nunca opacidade:** `bg-success-soft` com `text-success`, que
 * o `check:cores` mede como "selo de sucesso". `bg-success/10` daria uma cor
 * que ninguém mediu, e no tema escuro daria outra.
 *
 * **E A COR NÃO É O ÚNICO SINAL** — a palavra está escrita, e o ícone vem com
 * `aria-hidden` porque ele repete o que o texto já diz.
 * ---------------------------------------------------------------------------
 */
export function SeloDeProgramado() {
  return (
    <span className="bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
      <CalendarCheck2 aria-hidden className="size-3" />
      Programado
    </span>
  );
}
