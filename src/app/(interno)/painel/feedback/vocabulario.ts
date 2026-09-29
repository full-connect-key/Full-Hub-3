import type { FeedbackPeriodicidade } from "@/lib/supabase/database.types";

/**
 * O vocabulário da tela de feedback.
 *
 * Módulo sem diretiva nenhuma: o `page.tsx` lê o período da URL no servidor e o
 * seletor o escreve no cliente. É a convenção do projeto para valor que
 * atravessa a fronteira — e ela nasceu de um bug de verdade, quando `ehAba`
 * morava num arquivo `"use client"` e a Gestão de Pessoas devolvia 500 nas duas
 * abas.
 */

/** "2027-04" na URL; o período é o mês inteiro. */
export function lerPeriodicidade(bruto: string | undefined): FeedbackPeriodicidade {
  return bruto === "trimestral" ? "trimestral" : "mensal";
}

/**
 * O período que a tela está olhando, a partir do que veio na URL.
 *
 * O parâmetro é o INÍCIO (`2027-04-01`), e não um mês solto, porque o
 * trimestral também começa num dia 1 e uma única forma serve aos dois. Valor
 * inválido cai no padrão em vez de derrubar a tela: a URL é digitável, e uma
 * tela de erro por causa de um caractere trocado manda a pessoa embora.
 */
export function lerPeriodo(
  bruto: string | undefined,
  padrao: { inicio: string; fim: string },
  periodicidade: FeedbackPeriodicidade,
): { inicio: string; fim: string } {
  if (!bruto || !/^\d{4}-\d{2}-01$/.test(bruto)) return padrao;

  const [ano, mes] = bruto.split("-").map(Number);
  const meses = periodicidade === "trimestral" ? 3 : 1;
  const fim = new Date(Date.UTC(ano, mes - 1 + meses, 0));
  const dois = (n: number) => String(n).padStart(2, "0");

  return {
    inicio: bruto,
    fim: `${fim.getUTCFullYear()}-${dois(fim.getUTCMonth() + 1)}-${dois(fim.getUTCDate())}`,
  };
}
