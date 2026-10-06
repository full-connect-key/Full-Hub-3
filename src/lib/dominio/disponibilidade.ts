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
 *     A Linha do Tempo do Calendário Full pinta pelos mesmos quatro degraus, e
 *     duas escalas para a mesma pergunta seriam descobertas pela pessoa no dia
 *     em que uma tela mostrasse verde e a outra âmbar para o mesmo dia;
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
