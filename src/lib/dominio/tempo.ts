/**
 * Tempo, sempre em minutos.
 *
 * O banco guarda `estimativa_minutos` e `tempo_real_minutos` como inteiro. A
 * tela nunca mostra decimal e nunca obriga ninguém a converter de cabeça:
 * quem trabalhou duas horas e meia digita `2h30`, `2,5h` ou `150`, e os três
 * viram o mesmo número.
 *
 * Hora decimal parecia simpática e não é: `1,75h` é uma conta que a pessoa
 * faz antes de digitar, e arredondamento de `numeric(6,2)` ia transformar
 * "vinte minutos" em 0,33 e de volta em 19,8 minutos.
 *
 * Função pura, sem `server-only`: a mesma conta vale no formulário e na
 * Server Action que valida de novo.
 */

/** "2h 30min", "45min", "3h". Devolve travessão quando não há o que mostrar. */
export function formatarMinutos(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return "—";
  if (minutos <= 0) return "0min";

  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}min`;
}

/** Versão curta para caber em card e célula de tabela: "2h30", "45min". */
export function formatarMinutosCurto(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return "—";
  if (minutos <= 0) return "0min";

  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/**
 * Lê o que a pessoa digitou e devolve minutos.
 *
 * Aceita, em qualquer combinação de espaço e maiúscula:
 *   150        2h30      2h 30min     2,5h     2.5h     90min     1h
 *
 * Devolve `null` para campo vazio (que é diferente de zero — "não medi" não é
 * "levou nada") e `undefined` para texto que não dá para entender, para a
 * validação poder distinguir os dois casos.
 */
export function interpretarTempo(texto: string): number | null | undefined {
  const limpo = texto.trim().toLowerCase().replace(/\s+/g, "").replace(",", ".");
  if (limpo === "") return null;

  // 2h30, 2h30min, 2h
  const comHoraEMinuto = /^(\d+)h(\d+)?(?:min)?$/.exec(limpo);
  if (comHoraEMinuto) {
    const horas = Number(comHoraEMinuto[1]);
    const minutos = comHoraEMinuto[2] ? Number(comHoraEMinuto[2]) : 0;
    if (minutos > 59) return undefined;
    return horas * 60 + minutos;
  }

  // 2,5h / 2.5h
  const horaDecimal = /^(\d+\.\d+)h$/.exec(limpo);
  if (horaDecimal) return Math.round(Number(horaDecimal[1]) * 60);

  // 90min / 90m
  const soMinutos = /^(\d+)(?:min|m)$/.exec(limpo);
  if (soMinutos) return Number(soMinutos[1]);

  // 150 — número solto é minuto, que é a unidade da casa
  const solto = /^(\d+)$/.exec(limpo);
  if (solto) return Number(solto[1]);

  return undefined;
}

/** O que o campo mostra ao abrir, a partir do que está salvo. */
export function tempoParaCampo(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "";
  return formatarMinutosCurto(minutos);
}

/** A Task não tem tempo próprio: ela mostra a soma das subtarefas. */
export function somarMinutos(valores: (number | null | undefined)[]): number | null {
  const presentes = valores.filter((v): v is number => typeof v === "number");
  if (presentes.length === 0) return null;
  return presentes.reduce((total, v) => total + v, 0);
}

export const AJUDA_DE_TEMPO = "Aceita 2h30, 2,5h, 150 ou 90min.";
