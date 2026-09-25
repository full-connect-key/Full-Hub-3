import type { VisaoDoCalendario } from "@/lib/dominio/calendario";

/**
 * O período visível, e a janela que se busca do banco.
 *
 * **Sem diretiva nenhuma:** a página é Server Component e calcula a janela
 * para consultar; as visões são cliente e montam a grade com as mesmas
 * funções. Duas contas de "que dias este mês cobre" dariam uma grade
 * desenhando um dia que a consulta não trouxe.
 */

/** O mês corrente, em `AAAA-MM`. */
export function mesDeHoje(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * O mês pedido na URL, quando é um mês de verdade.
 *
 * `2026-13` e `banana` caem no mês corrente em vez de quebrar a tela: um
 * parâmetro de URL é digitado por gente e colado de lugares estranhos.
 */
export function lerMes(valor: unknown, hoje = new Date()): string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}$/.test(valor)) return mesDeHoje(hoje);
  const mes = Number(valor.slice(5, 7));
  if (mes < 1 || mes > 12) return mesDeHoje(hoje);
  return valor;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Meio-dia UTC, e não meia-noite: com meia-noite, um fuso a oeste volta ao dia anterior. */
function dia(ano: number, mes: number, diaDoMes: number): Date {
  return new Date(Date.UTC(ano, mes, diaDoMes, 12));
}

export function primeiroDiaDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return iso(dia(ano, m - 1, 1));
}

export function ultimoDiaDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return iso(dia(ano, m, 0));
}

export function somarMeses(mes: string, quantos: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = dia(ano, m - 1 + quantos, 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function somarDias(data: string, quantos: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + quantos);
  return iso(d);
}

/** Segunda-feira da semana de `data`. A semana da agência começa na segunda. */
export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  const desloca = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desloca);
  return iso(d);
}

export type Janela = { de: string; ate: string; inicio: string; fim: string };

/**
 * A janela que se busca, e o período que se desenha.
 *
 * `inicio`/`fim` é o que a tela mostra; `de`/`ate` é o que se pede ao banco —
 * **com uma semana de folga em cada ponta**. A grade do mês desenha os dias
 * vizinhos que completam a primeira e a última semana, e sem a folga eles
 * apareceriam vazios: não porque nada acontece, mas porque a consulta não os
 * trouxe. Um dia vazio por engano é pior que um dia cheio, porque ninguém
 * desconfia dele.
 */
export function janelaDoPeriodo(mes: string, visao: VisaoDoCalendario): Janela {
  if (visao === "semana") {
    const inicio = segundaDaSemana(primeiroDiaDoMes(mes));
    const fim = somarDias(inicio, 6);
    return { inicio, fim, de: somarDias(inicio, -7), ate: somarDias(fim, 7) };
  }

  const inicio = primeiroDiaDoMes(mes);
  const fim = ultimoDiaDoMes(mes);
  return { inicio, fim, de: somarDias(inicio, -7), ate: somarDias(fim, 7) };
}

/** Os dias do período, um a um. */
export function diasDoPeriodo(de: string, ate: string): string[] {
  const dias: string[] = [];
  let atual = de;
  while (atual <= ate) {
    dias.push(atual);
    atual = somarDias(atual, 1);
  }
  return dias;
}

/**
 * As seis semanas da grade do mês.
 *
 * **Sempre seis, e não "as que couberem":** um mês que cabe em cinco e outro
 * que precisa de seis fazem a grade mudar de altura ao trocar de mês, e a
 * página inteira pula. Seis linhas fixas é o que faz a navegação ficar
 * parada.
 */
export function semanasDoMes(mes: string): string[][] {
  const comeco = segundaDaSemana(primeiroDiaDoMes(mes));
  return Array.from({ length: 6 }, (_, semana) =>
    Array.from({ length: 7 }, (_, d) => somarDias(comeco, semana * 7 + d)),
  );
}

export function ehFimDeSemana(data: string): boolean {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

export function ehDoMes(data: string, mes: string): boolean {
  return data.slice(0, 7) === mes;
}
