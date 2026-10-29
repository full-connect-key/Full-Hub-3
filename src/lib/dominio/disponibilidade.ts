/**
 * A disponibilidade de uma pessoa, dia a dia.
 *
 * A CONTA NÃO MORA AQUI, e isso é a regra deste arquivo. Quem soma minutos é
 * `disponibilidade_bruta()` no Postgres, desde a migration 0081 — e ela é a
 * única implementação do cálculo de carga do produto. Um gêmeo em TypeScript
 * daria dois números para a mesma pessoa no mesmo dia, que é exatamente o que
 * o comentário da 0035 existe para impedir.
 *
 * O que vive aqui é a leitura: o formato que a tela desenha, o rótulo de cada
 * motivo de ausência e a frase do aviso. Três coisas que ele NÃO traz, e as
 * três de propósito:
 *
 *   - o NÍVEL de carga sai de `nivelDaCarga()` em `lib/dominio/calendario.ts`.
 *     Ele era compartilhado com a Linha do Tempo do Calendário Full, que
 *     pintava pelos mesmos quatro degraus — duas escalas para a mesma
 *     pergunta seriam descobertas pela pessoa no dia em que uma tela mostrasse
 *     verde e a outra âmbar para o mesmo dia. Aquela visão saiu do produto, e
 *     a escala ficou onde estava: carga de um dia é vocabulário do
 *     calendário;
 *   - o rótulo do motivo sai de `ROTULOS_DE_PRESENCA` do Full Days;
 *   - as horas saem de `formatarMinutosCurto()` de `lib/dominio/tempo.ts`.
 */

import { ROTULOS_DE_PRESENCA } from "@/lib/dominio/full-days";
import { formatarMinutosCurto } from "@/lib/dominio/tempo";

/** Uma etapa que já ocupa aquele dia. A função devolve até cinco. */
export type ItemDoDia = {
  id: string;
  titulo: string;
  cliente: string | null;
  minutos: number;
  prazo: string | null;
};

export type DiaDeDisponibilidade = {
  data: string;
  diaUtil: boolean;
  capacidadeMinutos: number;
  /** `ferias`, `licenca`, `ausente`, `folga`, `feriado`, `fim_de_semana`, `evento`. */
  indisponivelMotivo: string | null;
  cargaMinutos: number;
  etapas: number;
  entregas: number;
  entregasMinutos: number;
  ocupacaoPct: number | null;
  evento: string | null;
  itens: ItemDoDia[];
};

/**
 * O que a tela escreve quando a pessoa não está disponível.
 *
 * **ELE PASSA PELO MAPA DO FULL DAYS, SEMPRE.** A função devolve a chave do
 * enum (`ferias`), e desenhar isso cru poria na tela a palavra que a 0016 e a
 * 0018 tiraram do produto de propósito — a equipe é toda PJ, e palavra da CLT
 * num sistema da própria contratante é prova documental. A varredura de
 * `check:cores` não pegaria: ela procura as formas acentuadas em `src/`, e
 * este texto vem do banco. É o mesmo descuido que a ausência do Calendário
 * Full já pagou uma vez.
 *
 * Os dois acrescentados aqui não existem em `team_presence`: eles são fatos
 * sobre o DIA e não sobre a pessoa, e a função os devolve por conta própria.
 */
const MOTIVOS_DO_DIA: Record<string, string> = {
  fim_de_semana: "Fim de semana",
  evento: "Em evento",
};

export function rotuloDoMotivo(motivo: string | null): string | null {
  if (!motivo) return null;
  return (
    MOTIVOS_DO_DIA[motivo] ??
    ROTULOS_DE_PRESENCA[motivo as keyof typeof ROTULOS_DE_PRESENCA] ??
    null
  );
}

/**
 * O dia do calendário sem capacidade nenhuma é o calendário, não um aviso.
 *
 * Fim de semana e feriado apagam a célula na grade, e avisar sobre eles seria
 * um aviso em metade dos cliques — a regra do alerta que acende no caso normal
 * e a pessoa aprende a ignorar.
 */
const DO_CALENDARIO = new Set(["fim_de_semana", "feriado"]);

/**
 * O AVISO É UM SÓ, e é decisão do usuário: *"deve aparecer apenas um aviso de
 * sobrecarga"*.
 *
 * Ele fala do dia ESCOLHIDO e de mais nenhum. Uma lista — "9, 16 e 26
 * estouraram" — é ler sobre dias que ninguém escolheu, e some no ruído
 * justamente quando há muitos.
 *
 * **E ELE NUNCA TRAVA.** Nenhuma trava deste produto olha carga, e a segunda
 * metade da frase dele — *"o atendimento, os sócios e desenvolvedores devem
 * poder registrar mesmo assim"* — não tem a quem recusar: quem distribui
 * trabalho é `is_atendimento()` desde a 0006, que é exatamente Atendimento
 * mais gestão. Por isso a frase diz o que ACONTECEU, no passado, em vez de
 * pedir uma confirmação que nada exige: o painel grava no clique, e o aviso é
 * a consequência, não o portão.
 */
export function avisoDoDiaEscolhido(
  dia: DiaDeDisponibilidade | undefined,
  nome: string,
  dataLegivel: string,
): string | null {
  if (!dia) return null;

  const motivo = rotuloDoMotivo(dia.indisponivelMotivo);
  if (
    motivo &&
    dia.capacidadeMinutos === 0 &&
    dia.indisponivelMotivo !== null &&
    !DO_CALENDARIO.has(dia.indisponivelMotivo)
  ) {
    return `${nome} está em ${motivo.toLowerCase()} em ${dataLegivel}. Ficou registrado assim mesmo.`;
  }

  if (dia.ocupacaoPct !== null && dia.ocupacaoPct > 100) {
    return (
      `${nome} fica com ${formatarMinutosCurto(dia.cargaMinutos)} em ${dataLegivel}, ` +
      `e o dia tem ${formatarMinutosCurto(dia.capacidadeMinutos)}. Ficou registrado assim mesmo.`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// O PERÍODO, e não mais o dia solto
//
// Decisão do usuário: *"permitir a seleção de um período diretamente no
// calendário (…) atualizar os indicadores de sobrecarga considerando o período
// completo"*.
//
// O que muda aqui é só a LEITURA, e a regra do arquivo continua inteira: quem
// soma minutos é `disponibilidade_bruta()` no Postgres, dia a dia. Estas duas
// funções percorrem os dias que a função devolveu e contam — elas não
// recalculam carga nenhuma, e é por isso que elas podem existir em TypeScript
// sem criar o gêmeo que a 0035 proíbe.
// ---------------------------------------------------------------------------

export type ResumoDoPeriodo = {
  /** Quantos dias o período cobre, de ponta a ponta. */
  dias: number;
  /** Quantos deles a pessoa de fato trabalha. */
  diasComCapacidade: number;
  cargaMinutos: number;
  capacidadeMinutos: number;
  /** Em quantos a carga passa da capacidade. */
  diasEstourados: number;
  /** Em quantos ela não está — day off, afastamento, ausência, evento. */
  diasIndisponiveis: number;
};

export function resumoDoPeriodo(dias: DiaDeDisponibilidade[]): ResumoDoPeriodo {
  let cargaMinutos = 0;
  let capacidadeMinutos = 0;
  let diasComCapacidade = 0;
  let diasEstourados = 0;
  let diasIndisponiveis = 0;

  for (const dia of dias) {
    cargaMinutos += dia.cargaMinutos;
    capacidadeMinutos += dia.capacidadeMinutos;
    if (dia.capacidadeMinutos > 0) diasComCapacidade += 1;
    if (dia.ocupacaoPct !== null && dia.ocupacaoPct > 100) diasEstourados += 1;
    // O DIA SEM CAPACIDADE SÓ CONTA COMO AUSÊNCIA QUANDO O MOTIVO É DA PESSOA:
    // fim de semana e feriado zeram a capacidade de todo mundo, e contá-los
    // faria um período de duas semanas acusar quatro ausências que não
    // existem. É o mesmo `DO_CALENDARIO` que o aviso de um dia já usa.
    if (
      dia.capacidadeMinutos === 0 &&
      dia.indisponivelMotivo !== null &&
      !DO_CALENDARIO.has(dia.indisponivelMotivo)
    ) {
      diasIndisponiveis += 1;
    }
  }

  return {
    dias: dias.length,
    diasComCapacidade,
    cargaMinutos,
    capacidadeMinutos,
    diasEstourados,
    diasIndisponiveis,
  };
}

/**
 * O AVISO CONTINUA SENDO UM SÓ, e a frase do usuário que o criou não mudou:
 * *"deve aparecer apenas um aviso de sobrecarga"* (0081).
 *
 * Com um dia escolhido ele é exatamente o de antes, palavra por palavra —
 * esta função delega. Com um período, ele passa a CONTAR em vez de nomear:
 * *"a Marina passa da capacidade em 3 dos 7 dias deste período"*. Listar os
 * três é a lista que a decisão de 0081 recusou, e nomear só o primeiro
 * esconderia os outros dois.
 *
 * **E ele continua dizendo o que ACONTECEU, no passado.** Nenhuma trava deste
 * produto olha carga: o painel da etapa grava no clique, e o aviso é a
 * consequência e não o portão.
 */
export function avisoDoPeriodoEscolhido(
  dias: DiaDeDisponibilidade[],
  nome: string,
  dataLegivelDoPrimeiro: string,
): string | null {
  if (dias.length === 0) return null;
  if (dias.length === 1) {
    return avisoDoDiaEscolhido(dias[0], nome, dataLegivelDoPrimeiro);
  }

  const resumo = resumoDoPeriodo(dias);

  // A AUSÊNCIA VEM ANTES DA SOBRECARGA, e a ordem é a mesma do aviso de um
  // dia: "ela não está" é um fato mais duro que "ela fica apertada", e os
  // dois na mesma frase viram um parágrafo onde a pessoa precisa de uma linha.
  if (resumo.diasIndisponiveis > 0) {
    const d = resumo.diasIndisponiveis;
    return (
      `${nome} está fora em ${d} ${d === 1 ? "dia" : "dias"} deste período. ` +
      `Ficou registrado assim mesmo.`
    );
  }

  if (resumo.diasEstourados > 0) {
    return (
      `${nome} passa da capacidade em ${resumo.diasEstourados} dos ` +
      `${resumo.diasComCapacidade} dias úteis deste período. ` +
      `Ficou registrado assim mesmo.`
    );
  }

  return null;
}
