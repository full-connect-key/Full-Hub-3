import { ROTULOS_DE_SUBTAREFA } from "@/lib/tasks/state-machine";
import type { SubtaskStatus } from "@/lib/supabase/database.types";

/**
 * O vocabulário e as contas das Métricas.
 *
 * **Sem diretiva nenhuma:** a página é Server Component e decide o período
 * para consultar; as abas são cliente e escrevem as mesmas frases sobre o
 * mesmo período. Duas leituras de "que dias este recorte cobre" dariam um
 * título dizendo um mês e uma tabela contando outro.
 */

// ---------------------------------------------------------------------------
// O PERÍODO
// ---------------------------------------------------------------------------

/**
 * Os recortes prontos, e o livre.
 *
 * **O padrão são os últimos 30 dias, e não "este mês".** No dia 2, "este mês"
 * mostra dois dias de dados e uma taxa de entrega no prazo calculada sobre
 * três etapas — um número que parece uma medição e é ruído. Uma janela
 * corrida tem sempre o mesmo tamanho.
 */
export const PERIODOS = ["30d", "90d", "mes", "trimestre", "ano", "livre"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const ROTULOS_DE_PERIODO: Record<Periodo, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  mes: "Este mês",
  trimestre: "Este trimestre",
  ano: "Este ano",
  livre: "Escolher as datas",
};

export function ehPeriodo(valor: unknown): valor is Periodo {
  return typeof valor === "string" && (PERIODOS as readonly string[]).includes(valor);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Meio-dia UTC: com meia-noite, um fuso a oeste volta ao dia anterior. */
function dia(ano: number, mes: number, diaDoMes: number): Date {
  return new Date(Date.UTC(ano, mes, diaDoMes, 12));
}

/**
 * As duas datas de um recorte.
 *
 * `hoje` entra por parâmetro e não é lido aqui dentro: o servidor calcula o
 * período e as abas recebem as datas prontas. Se cada tela lesse o próprio
 * relógio, o navegador num fuso à frente pediria um dia que o servidor não
 * pediu — e a tabela mostraria um total diferente do título.
 */
export function datasDoPeriodo(
  periodo: Periodo,
  hoje: Date,
  livre?: { de?: string; ate?: string },
): { de: string; ate: string } {
  const ate = iso(hoje);
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();

  if (periodo === "livre") {
    const de = ehData(livre?.de) ? livre!.de! : iso(somarDias(hoje, -30));
    const fim = ehData(livre?.ate) ? livre!.ate! : ate;
    // INVERTIDO VIRA TROCADO, e não recusado: os dois campos vêm da URL, e
    // uma tela em branco com "período inválido" manda a pessoa descobrir
    // sozinha qual dos dois está errado. Trocar entrega o recorte que ela
    // evidentemente quis.
    return de <= fim ? { de, ate: fim } : { de: fim, ate: de };
  }

  if (periodo === "mes") return { de: iso(dia(ano, mes, 1)), ate };
  if (periodo === "trimestre") return { de: iso(dia(ano, Math.floor(mes / 3) * 3, 1)), ate };
  if (periodo === "ano") return { de: iso(dia(ano, 0, 1)), ate };
  return { de: iso(somarDias(hoje, periodo === "90d" ? -90 : -30)), ate };
}

function somarDias(d: Date, quantos: number): Date {
  const copia = new Date(d);
  copia.setUTCDate(copia.getUTCDate() + quantos);
  return copia;
}

export function ehData(valor: unknown): boolean {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

// ---------------------------------------------------------------------------
// AS ABAS
// ---------------------------------------------------------------------------

export const ABAS_DE_METRICA = [
  "producao",
  "tempo",
  "equipe",
  "qualidade",
  "rentabilidade",
] as const;
export type AbaDeMetrica = (typeof ABAS_DE_METRICA)[number];

export const ROTULOS_DE_ABA: Record<AbaDeMetrica, string> = {
  producao: "Produção",
  tempo: "Onde o tempo vai",
  equipe: "Estimativa × real",
  qualidade: "Qualidade da entrega",
  rentabilidade: "Rentabilidade",
};

export function ehAbaDeMetrica(valor: unknown): valor is AbaDeMetrica {
  return typeof valor === "string" && (ABAS_DE_METRICA as readonly string[]).includes(valor);
}

// ---------------------------------------------------------------------------
// AS CONTAS QUE A TELA FAZ
// ---------------------------------------------------------------------------

/**
 * A taxa de entrega no prazo.
 *
 * **O denominador é `no_prazo + fora_do_prazo`, e NÃO inclui `sem_prazo`.** É
 * a mesma decisão que a 0035 tomou no `select`: uma etapa sem prazo não pode
 * estar no prazo nem fora dele. Somá-la como acerto inflaria a taxa
 * justamente onde ninguém combinou data — e o número subiria quanto mais
 * desorganizada a agência ficasse.
 *
 * Devolve `null` e não zero quando não houve nenhuma com prazo: zero é uma
 * afirmação sobre a conta, e o que se quer dizer é que não há o que medir.
 */
export function taxaNoPrazo(noPrazo: number, foraDoPrazo: number): number | null {
  const total = noPrazo + foraDoPrazo;
  if (total === 0) return null;
  return Math.round((noPrazo / total) * 100);
}

/** "2h 30min" a partir de minutos. Mesma forma de `lib/dominio/tempo.ts`. */
export function horasEMinutos(minutos: number): string {
  const inteiros = Math.max(0, Math.round(minutos));
  const h = Math.floor(inteiros / 60);
  const m = inteiros % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * O rótulo de um status de etapa vindo do histórico.
 *
 * **Passa pelo mapa da máquina de estados, sempre.** O que o banco grava em
 * `task_history.para_valor` é o valor de enum — `nao_iniciada`,
 * `enviada_aprovacao` —, e `check:cores` não pega um `{linha.status}` cru
 * porque o texto não está em `src/`: ele vem do banco. Quem pega é só quem
 * olhar a tela.
 *
 * Valor que o mapa não conhece volta como ele é, e não some: um status novo
 * no enum tem que aparecer torto, e não desaparecer da tabela.
 */
export function rotuloDeStatusDoHistorico(valor: string): string {
  return ROTULOS_DE_SUBTAREFA[valor as SubtaskStatus] ?? valor;
}
