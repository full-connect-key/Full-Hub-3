import type { HrStatus, HrTipo, PresencaStatus } from "@/lib/supabase/database.types";

/**
 * O vocabulário do Full Days, e as contas que os dois lados fazem.
 *
 * Em `lib/dominio/` porque servidor e navegador precisam das mesmas respostas:
 * o calendário de seleção conta dias úteis enquanto a pessoa arrasta o mouse,
 * e a Server Action conta de novo antes de gravar. Se as duas contas saíssem
 * de lugares diferentes, a tela mostraria 5 e o banco gravaria 4.
 */

export const ROTULOS_DE_TIPO: Record<HrTipo, string> = {
  ferias: "Férias",
  licenca: "Licença",
  ausencia: "Ausência",
};

export const ROTULOS_DE_STATUS: Record<HrStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  cancelada: "Cancelada",
};

export const ROTULOS_DE_PRESENCA: Record<PresencaStatus, string> = {
  presente: "Presente",
  remoto: "Remoto",
  ferias: "Férias",
  licenca: "Licença",
  ausente: "Ausente",
  folga: "Folga",
  feriado: "Feriado",
};

/**
 * A cor de cada status na matriz.
 *
 * Cada uma é um token, nunca um hex — e `feriado` é listrado em vez de uma cor
 * sólida: são sete estados, e a sétima cor sólida já começaria a se confundir
 * com as outras seis. Padrão distingue melhor que matiz quando os quadrados
 * são pequenos.
 */
export const CORES_DE_PRESENCA: Record<PresencaStatus, string> = {
  presente: "bg-success",
  remoto: "bg-accent-strong",
  ferias: "bg-ferias",
  licenca: "bg-warning",
  ausente: "bg-danger",
  folga: "bg-neutral",
  feriado: "listrado",
};

export const PRESENCAS_EDITAVEIS: PresencaStatus[] = [
  "presente",
  "remoto",
  "folga",
  "ausente",
];

/** O tipo de pedido vira o status do dia na matriz. */
export function presencaDoTipo(tipo: HrTipo): PresencaStatus {
  if (tipo === "ferias") return "ferias";
  if (tipo === "licenca") return "licenca";
  return "ausente";
}

/**
 * Dias úteis entre duas datas ISO, inclusive as pontas.
 *
 * Espelha `public.dias_uteis()` do Postgres. As duas existem de propósito: esta
 * escreve o número que a pessoa vê enquanto seleciona, aquela é a que o banco
 * grava. Os feriados chegam como lista porque a função é pura — quem busca é a
 * camada de dados.
 */
export function contarDiasUteis(
  inicioISO: string,
  fimISO: string,
  feriados: Set<string>,
): number {
  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return 0;

  let total = 0;
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    if (ehDiaUtil(cursor, feriados)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export function ehDiaUtil(data: Date, feriados: Set<string>): boolean {
  const semana = data.getDay();
  if (semana === 0 || semana === 6) return false;
  return !feriados.has(paraISO(data));
}

/** Todos os dias entre duas datas, inclusive. */
export function diasEntre(inicioISO: string, fimISO: string): string[] {
  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return [];

  const dias: string[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    dias.push(paraISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

/**
 * Data ISO -> Date local, sem fuso.
 *
 * `new Date("2026-03-02")` é interpretado como UTC e, a oeste de Greenwich,
 * vira 1º de março às 21h. Um dia inteiro de diferença num módulo de férias é
 * a diferença entre o pedido certo e o errado.
 */
export function lerData(iso: string): Date | null {
  const partes = iso.split("-").map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [ano, mes, dia] = partes;
  const data = new Date(ano, mes - 1, dia);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function paraISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Ordena duas datas, para a seleção funcionar de trás para a frente também. */
export function ordenar(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
