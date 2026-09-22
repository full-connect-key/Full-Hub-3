import { addDays, endOfWeek, format, isSameMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * A semana, como a agência conta.
 *
 * SEGUNDA A DOMINGO, e não domingo a sábado. O locale pt-BR do date-fns começa
 * no domingo, que é a convenção de calendário de parede; aqui a unidade é a
 * semana DE TRABALHO, e partir a semana no meio do fim de semana faria a
 * entrega de sexta e a de segunda caírem em semanas diferentes do jeito
 * errado. Por isso `weekStartsOn: 1` está escrito à mão em toda chamada.
 *
 * Funções puras, em lib/dominio/, porque servidor e navegador precisam das
 * duas e o resultado tem que ser o mesmo nos dois lados.
 */

const SEGUNDA = { weekStartsOn: 1 } as const;

/** A segunda-feira da semana de uma data. */
export function inicioDaSemana(data: Date): Date {
  return startOfWeek(data, SEGUNDA);
}

export function fimDaSemana(data: Date): Date {
  return endOfWeek(data, SEGUNDA);
}

/**
 * O identificador da semana na URL: a data da segunda-feira, em ISO.
 *
 * Na URL e não em estado, como todo filtro do projeto: o link precisa ser
 * compartilhável e sobreviver a um F5.
 */
export function chaveDaSemana(data: Date): string {
  return format(inicioDaSemana(data), "yyyy-MM-dd");
}

/** Lê a chave da URL. Valor ausente ou estragado devolve a semana de hoje. */
export function semanaDaChave(chave: string | undefined, hoje: Date): Date {
  if (!chave) return inicioDaSemana(hoje);
  const partes = chave.split("-").map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return inicioDaSemana(hoje);
  const [ano, mes, dia] = partes;
  const data = new Date(ano, mes - 1, dia);
  if (Number.isNaN(data.getTime())) return inicioDaSemana(hoje);
  return inicioDaSemana(data);
}

/**
 * "13 a 19 de outubro" quando a semana cabe num mês, "29 de setembro a 5 de
 * outubro" quando ela atravessa. Repetir o mês nos dois lados sempre deixaria
 * o rótulo mais longo sem dizer mais nada.
 */
export function rotuloDaSemana(inicio: Date): string {
  const fim = addDays(inicio, 6);
  const mesmoMes = isSameMonth(inicio, fim);

  if (mesmoMes) {
    return `${format(inicio, "d", { locale: ptBR })} a ${format(fim, "d 'de' MMMM", { locale: ptBR })}`;
  }
  return `${format(inicio, "d 'de' MMMM", { locale: ptBR })} a ${format(fim, "d 'de' MMMM", { locale: ptBR })}`;
}

/** "Esta semana", "Semana passada", ou o rótulo de datas. */
export function nomeDaSemana(inicio: Date, hoje: Date): string {
  const atual = inicioDaSemana(hoje);
  const diferenca = Math.round((atual.getTime() - inicio.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (diferenca === 0) return "Esta semana";
  if (diferenca === 1) return "Semana passada";
  if (diferenca === -1) return "Próxima semana";
  return rotuloDaSemana(inicio);
}

/** A semana de uma data já está no futuro? Serve para desabilitar o "próxima". */
export function ehFutura(inicio: Date, hoje: Date): boolean {
  return inicio.getTime() > inicioDaSemana(hoje).getTime();
}

export function deslocarSemana(inicio: Date, semanas: number): Date {
  return addDays(inicio, semanas * 7);
}
