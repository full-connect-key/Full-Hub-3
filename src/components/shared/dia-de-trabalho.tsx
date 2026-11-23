import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  rotuloDoMotivo,
  type DiaDeDisponibilidade,
} from "@/lib/dominio/disponibilidade";
import { formatarMinutosCurto } from "@/lib/dominio/tempo";

/**
 * O QUE OCUPA UM DIA DE ALGUÉM: a carga, a ausência, e as etapas item a item.
 *
 * ---------------------------------------------------------------------------
 * **ELE É COMPARTILHADO PORQUE SÃO DUAS TELAS**, e as duas chegam nele pela
 * mesma pergunta: *o que é esse número?* Na faixa de disponibilidade, quem
 * pergunta é quem vai datar a etapa — clica num dia e precisa saber o que já
 * está lá. Na pauta da equipe, quem pergunta é quem olhou a grade da semana —
 * decisão do usuário: *"eu não quero ver só, se a pessoa tem uma task, quero
 * poder ver, qual task aquela pessoa tem"*.
 *
 * Uma segunda cópia divergiria no lugar mais caro: a linha que diz *"e mais N
 * etapas"*. Sem ela, um dia com oito etapas parece ter cinco — e a decisão de
 * prazo sairia de um número incompleto. É a história das sete cópias de
 * `abas.tsx` em miniatura.
 * ---------------------------------------------------------------------------
 *
 * **ELE NÃO BUSCA NADA, e quem o desenha já tem o dia em mãos.** A faixa o
 * recebe da lista que ela já carregou para pintar a grade; a pauta da equipe,
 * de uma leitura do dia escolhido. É a decisão de `historicoDeAprovacoes()`
 * não ser chamada pelo painel da etapa — o que se centraliza é o desenho,
 * nunca a leitura.
 *
 * **E O DESENHO É O MESMO NAS DUAS**, inclusive o tamanho: ele é o detalhe do
 * que foi escolhido, e a escala pequena é o que o mantém como detalhe em vez
 * de competir com a grade que o abriu.
 */
export function DiaDeTrabalho({ dia }: { dia: DiaDeDisponibilidade }) {
  const motivo = rotuloDoMotivo(dia.indisponivelMotivo);
  const dataLegivel = format(parseISO(dia.data), "EEEE, d 'de' MMMM", {
    locale: ptBR,
  });

  return (
    <div className="bg-accent space-y-1.5 rounded-lg px-3 py-2">
      <p className="text-accent-strong text-xs font-semibold first-letter:uppercase">
        {dataLegivel}
        {dia.capacidadeMinutos > 0
          ? ` · ${formatarMinutosCurto(dia.cargaMinutos)} de ${formatarMinutosCurto(dia.capacidadeMinutos)}`
          : ""}
        {motivo && dia.capacidadeMinutos === 0 ? ` · ${motivo}` : ""}
        {dia.ocupacaoPct !== null && dia.capacidadeMinutos > 0
          ? ` · ${dia.ocupacaoPct}%`
          : ""}
      </p>

      {dia.itens.length > 0 ? (
        <ul className="space-y-0.5">
          {dia.itens.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 text-[11px]">
              <span className="min-w-[38px] font-semibold tabular-nums">
                {formatarMinutosCurto(item.minutos)}
              </span>
              <span className="min-w-0 grow truncate">{item.titulo}</span>
              {item.cliente ? (
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {item.cliente}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : dia.capacidadeMinutos > 0 ? (
        <p className="text-muted-foreground text-[11px]">
          Nenhuma etapa neste dia.
        </p>
      ) : null}

      {/* A FUNÇÃO DEVOLVE ATÉ CINCO, e o resto é contagem. Sem esta linha, um
          dia com oito etapas pareceria ter cinco — e a decisão de prazo seria
          tomada sobre um número incompleto. */}
      {dia.etapas > dia.itens.length ? (
        <p className="text-muted-foreground text-[10px]">
          e mais {dia.etapas - dia.itens.length}{" "}
          {dia.etapas - dia.itens.length === 1 ? "etapa" : "etapas"}
        </p>
      ) : null}
    </div>
  );
}
