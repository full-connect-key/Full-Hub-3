import type {
  ContratoRecorrencia,
  FinStatus,
  FinTipo,
  PfTipo,
} from "@/lib/supabase/database.types";

/**
 * O vocabulário e as contas do financeiro.
 *
 * Função pura, sem `server-only`: a mesma regra vale no formulário, na Server
 * Action que valida de novo e no relatório. É a mesma divisão de
 * `lib/dominio/tempo.ts`.
 */

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

/**
 * Reais, com os centavos sempre visíveis.
 *
 * `numeric(12,2)` chega do PostgREST como número; a formatação é feita aqui e
 * em lugar nenhum mais, pela mesma razão que datas passam todas por date-fns:
 * `toLocaleString` espalhado pela tela produz "R$1.234,5" numa e
 * "R$ 1.234,50" noutra.
 */
export function formatarDinheiro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Sem centavos, para eixo de gráfico e cartão grande: "R$ 12,4 mil". */
export function formatarDinheiroCurto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  const sinal = valor < 0 ? "-" : "";
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) {
    return `${sinal}R$ ${(absoluto / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (absoluto >= 1000) {
    return `${sinal}R$ ${(absoluto / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `${sinal}R$ ${absoluto.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/**
 * Lê o que a pessoa digitou e devolve um número.
 *
 * Aceita `1234,56`, `1.234,56`, `R$ 1.234,56` e `1234.56`. O caso difícil é o
 * ponto: em `1.234` ele é separador de milhar e em `1234.56` é decimal. A
 * regra que resolve os dois é olhar o ÚLTIMO separador — se ele deixa
 * exatamente dois dígitos depois de si, é o decimal.
 *
 * Devolve `undefined` para texto que não dá para entender, e `null` para
 * campo vazio.
 */
export function lerDinheiro(texto: string): number | null | undefined {
  const limpo = texto.replace(/[R$\s ]/g, "").trim();
  if (limpo === "") return null;
  if (!/^-?[\d.,]+$/.test(limpo)) return undefined;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  const separador = Math.max(ultimaVirgula, ultimoPonto);

  let normalizado: string;
  if (separador < 0) {
    normalizado = limpo;
  } else {
    const decimais = limpo.length - separador - 1;
    // Dois dígitos depois do último separador: ele é a vírgula decimal.
    // Três (ou qualquer outro número) e ele é separador de milhar — "1.234"
    // são mil duzentos e trinta e quatro, não um e pouco.
    if (decimais === 1 || decimais === 2) {
      normalizado =
        limpo.slice(0, separador).replace(/[.,]/g, "") + "." + limpo.slice(separador + 1);
    } else {
      normalizado = limpo.replace(/[.,]/g, "");
    }
  }

  const numero = Number(normalizado);
  if (Number.isNaN(numero)) return undefined;
  // Centavos e nada mais: `numeric(12,2)` arredondaria em silêncio, e o total
  // da tela deixaria de bater com o do banco por alguns centavos.
  return Math.round(numero * 100) / 100;
}

// ---------------------------------------------------------------------------
// A situação do lançamento
// ---------------------------------------------------------------------------

/**
 * ATRASO NÃO É UM ESTADO GRAVADO.
 *
 * Esta função é a gêmea em TypeScript de `situacao_do_lancamento()` no
 * Postgres, e as duas existem de propósito — a mesma divisão da máquina de
 * estados da subtarefa: a do banco é a que vale para quem chamar a API
 * direto, esta é a que a tela usa sem uma ida ao servidor por linha.
 *
 * `hojeISO` vem do servidor, nunca de `new Date()` aqui dentro: um navegador
 * em outro fuso classificaria o mesmo título de outro jeito, e o contador do
 * cartão deixaria de bater com a lista — exatamente o erro que os contadores
 * de Minhas Tasks evitam pelo mesmo caminho.
 */
export function situacaoDoLancamento(
  lancamento: { status: FinStatus; vencimento: string | null; pagamento: string | null },
  hojeISO: string,
): FinStatus {
  if (lancamento.status === "pago" || lancamento.status === "cancelado") {
    return lancamento.status;
  }
  if (lancamento.pagamento) return "pago";
  if (lancamento.vencimento && lancamento.vencimento < hojeISO) return "atrasado";
  return lancamento.status;
}

/** Já contou como dinheiro que entrou ou saiu de verdade? */
export function foiRealizado(lancamento: { pagamento: string | null; status: FinStatus }): boolean {
  return lancamento.status !== "cancelado" && lancamento.pagamento !== null;
}

/** Entra nas contas? Cancelado não entra em nenhuma. */
export function contaNoTotal(lancamento: { status: FinStatus }): boolean {
  return lancamento.status !== "cancelado";
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------

export const ROTULOS_DE_TIPO: Record<FinTipo, string> = {
  receita: "Receita",
  despesa: "Despesa",
};

export const ROTULOS_DE_STATUS: Record<FinStatus, string> = {
  previsto: "Previsto",
  faturado: "Faturado",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

/**
 * O par nomeado de cada situação, nunca `bg-warning/10`.
 *
 * Opacidade sobre um fundo qualquer dá uma cor que ninguém mediu, e no tema
 * escuro dá outra. `npm run check:cores` mede estes pares.
 */
export const CORES_DE_STATUS: Record<FinStatus, string> = {
  previsto: "bg-neutral-soft text-neutral",
  // Faturado usa o azul da marca e não uma cor própria: são cinco estados, e
  // a quinta cor começaria a competir com "pago" no canto do olho. O azul já
  // quer dizer "em andamento" no resto do produto.
  faturado: "bg-blue-soft text-accent-strong",
  pago: "bg-success-soft text-success",
  atrasado: "bg-danger-soft text-danger",
  // Mesmo fundo de "previsto", texto apagado: cancelado não é um estado que
  // pede atenção, é um que pede para ser ignorado.
  cancelado: "bg-neutral-soft text-text-muted",
};

/** Os status que alguém escolhe à mão. `atrasado` não está aqui: é derivado. */
export const STATUS_ESCOLHIVEIS: FinStatus[] = [
  "previsto",
  "faturado",
  "pago",
  "cancelado",
];

export const ROTULOS_DE_RECORRENCIA: Record<ContratoRecorrencia, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  pontual: "Pontual",
};

/** Quantas vezes por ano o contrato cobra. Pontual não é receita recorrente. */
export const VEZES_POR_ANO: Record<ContratoRecorrencia, number> = {
  mensal: 12,
  trimestral: 4,
  anual: 1,
  pontual: 0,
};

export const ROTULOS_DE_PF_TIPO: Record<PfTipo, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

// ---------------------------------------------------------------------------
// Meses
// ---------------------------------------------------------------------------

/** O primeiro dia do mês de uma data ISO. A competência é sempre o dia 1. */
export function competenciaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** A competência de hoje, a partir do "hoje" que veio do servidor. */
export function competenciaDaChave(chave: string | undefined, hojeISO: string): string {
  if (chave && /^\d{4}-\d{2}(-\d{2})?$/.test(chave)) return competenciaDe(`${chave}-01`);
  return competenciaDe(hojeISO);
}

/** Anda `n` meses a partir de uma competência, sem depender de fuso. */
export function deslocarCompetencia(competencia: string, n: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + n;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-01`;
}

/** As últimas `n` competências terminando na informada, da mais antiga à atual. */
export function ultimasCompetencias(competencia: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => deslocarCompetencia(competencia, i - (n - 1)));
}

/**
 * O vencimento de um contrato numa competência.
 *
 * Dia 31 em fevereiro vira o último dia de fevereiro em vez de escorregar
 * para março — um contrato que vence "no último dia" não pode pular de mês.
 */
export function vencimentoNaCompetencia(
  competencia: string,
  diaVencimento: number | null,
): string | null {
  if (!diaVencimento) return null;
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(diaVencimento, ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * O contrato cobra nesta competência?
 *
 * Trimestral e anual contam a partir do mês de início, não do mês do
 * calendário: um contrato anual assinado em março cobra em março, não em
 * janeiro.
 */
export function contratoCobraEm(
  contrato: {
    recorrencia: ContratoRecorrencia;
    data_inicio: string;
    data_fim: string | null;
    ativo: boolean;
  },
  competencia: string,
): boolean {
  if (!contrato.ativo) return false;

  const inicio = competenciaDe(contrato.data_inicio);
  if (competencia < inicio) return false;
  if (contrato.data_fim && competencia > competenciaDe(contrato.data_fim)) return false;

  const mesesDesdeOInicio = mesesEntre(inicio, competencia);

  switch (contrato.recorrencia) {
    case "mensal":
      return true;
    case "trimestral":
      return mesesDesdeOInicio % 3 === 0;
    case "anual":
      return mesesDesdeOInicio % 12 === 0;
    case "pontual":
      // Cobra uma vez só, no mês em que começou.
      return mesesDesdeOInicio === 0;
  }
}

export function mesesEntre(de: string, ate: string): number {
  const [anoA, mesA] = de.split("-").map(Number);
  const [anoB, mesB] = ate.split("-").map(Number);
  return (anoB - anoA) * 12 + (mesB - mesA);
}
