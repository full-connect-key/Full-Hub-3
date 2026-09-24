import { addDays, addMonths, format, lastDayOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import type {
  RecorrenciaFrequencia,
  RecorrenciaModo,
  TaskPrioridade,
} from "@/lib/supabase/database.types";

/**
 * As demandas recorrentes, do lado da tela.
 *
 * **ESTE ARQUIVO TEM UM PAR NO POSTGRES, e as duas metades existem de
 * propósito** — como `situacaoDoLancamento()` no Financeiro e
 * `minutosMedidos()` no cronômetro. `datas_da_recorrencia()` e
 * `resolver_variaveis()` são as que GRAVAM; estas são as que a pessoa lê antes
 * de salvar, na pré-visualização das próximas cinco ocorrências.
 *
 * Por que não perguntar ao banco: a prévia muda a cada tecla digitada no campo
 * do título e a cada clique num dia da semana. Uma chamada por tecla não é
 * pré-visualização, é latência — e a tela ficaria piscando enquanto a pessoa
 * decide justamente a coisa que a prévia existe para ela conferir.
 *
 * A consequência aceita: as duas contas podem divergir. É o mesmo risco que o
 * produto já corre em três outros lugares, e a bateria cobre o lado que vale —
 * o do banco.
 */

export const MODOS: RecorrenciaModo[] = ["mensal_agrupada", "task_por_ocorrencia"];

export const ROTULOS_DE_MODO: Record<RecorrenciaModo, string> = {
  mensal_agrupada: "Uma task por mês, com uma etapa por dia",
  task_por_ocorrencia: "Uma task inteira a cada repetição",
};

export const EXPLICACAO_DO_MODO: Record<RecorrenciaModo, string> = {
  mensal_agrupada:
    "Para trabalho diário. O board mostra uma linha por mês, não trinta — e o andamento da task é o andamento do mês.",
  task_por_ocorrencia:
    "Para quando cada repetição é um trabalho com etapas próprias: coletar, montar, revisar.",
};

export const FREQUENCIAS: RecorrenciaFrequencia[] = [
  "diaria",
  "semanal",
  "quinzenal",
  "mensal",
];

export const ROTULOS_DE_FREQUENCIA: Record<RecorrenciaFrequencia, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

/** 1 = segunda … 7 = domingo, como o ISO — e como a coluna `dias_semana`. */
export const DIAS_DA_SEMANA = [
  { valor: 1, curto: "Seg", longo: "segunda-feira" },
  { valor: 2, curto: "Ter", longo: "terça-feira" },
  { valor: 3, curto: "Qua", longo: "quarta-feira" },
  { valor: 4, curto: "Qui", longo: "quinta-feira" },
  { valor: 5, curto: "Sex", longo: "sexta-feira" },
  { valor: 6, curto: "Sáb", longo: "sábado" },
  { valor: 7, curto: "Dom", longo: "domingo" },
] as const;

/** O padrão de quem escolhe "diária": seg a sex, não os sete dias. */
export const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5];

export type VariavelDoTitulo = {
  chave: string;
  explicacao: string;
  exemplo: string;
};

/**
 * As variáveis que o título aceita.
 *
 * A LISTA FICA AO LADO DO CAMPO, e não num texto de ajuda: uma variável que a
 * pessoa não sabe que existe é uma variável que ninguém usa, e o título sai
 * "Stories" repetido em doze meses iguais no board.
 */
export const VARIAVEIS_DO_TITULO: VariavelDoTitulo[] = [
  { chave: "{CLIENTE}", explicacao: "Nome da empresa", exemplo: "Mundo Verde" },
  { chave: "{SIGLA}", explicacao: "Apelido curto do cliente", exemplo: "mundo-verde" },
  { chave: "{MES}", explicacao: "Mês por extenso", exemplo: "Outubro" },
  { chave: "{MES_NUM}", explicacao: "Mês com dois dígitos", exemplo: "10" },
  { chave: "{ANO}", explicacao: "Ano com quatro dígitos", exemplo: "2026" },
  { chave: "{DATA}", explicacao: "Dia e mês da ocorrência", exemplo: "05/10" },
  { chave: "{DIA_SEMANA}", explicacao: "Dia da semana", exemplo: "Segunda" },
  { chave: "{SEMANA}", explicacao: "Semana do ano", exemplo: "41" },
  { chave: "{SEQ}", explicacao: "Número da ocorrência", exemplo: "1" },
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const SEMANA = [
  "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo",
];

function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** 1 = segunda … 7 = domingo. `getDay()` devolve 0 para domingo. */
export function diaIso(data: Date): number {
  const d = data.getDay();
  return d === 0 ? 7 : d;
}

/**
 * Resolve as variáveis do título. Espelha `resolver_variaveis()` no Postgres.
 *
 * **Variável desconhecida fica visível**, e é escolha: apagar um `{FOO}`
 * digitado errado esconderia o erro, e o título sairia com um buraco que
 * ninguém liga ao que digitou.
 */
export function resolverVariaveis(
  texto: string,
  dados: { cliente: string; sigla: string; data: Date; sequencia?: number },
): string {
  const { cliente, sigla, data, sequencia = 1 } = dados;
  return (texto ?? "")
    .replaceAll("{CLIENTE}", cliente ?? "")
    .replaceAll("{SIGLA}", sigla ?? "")
    .replaceAll("{MES}", comInicialMaiuscula(MESES[data.getMonth()]))
    .replaceAll("{MES_NUM}", format(data, "MM"))
    .replaceAll("{ANO}", format(data, "yyyy"))
    .replaceAll("{DATA}", format(data, "dd/MM"))
    .replaceAll("{DIA_SEMANA}", comInicialMaiuscula(SEMANA[diaIso(data) - 1]))
    .replaceAll("{SEMANA}", format(data, "II"))
    .replaceAll("{SEQ}", String(sequencia));
}

export type RegraDeRecorrencia = {
  modo: RecorrenciaModo;
  frequencia: RecorrenciaFrequencia;
  diasSemana: number[] | null;
  diaMes: number | null;
  pularFeriados: boolean;
  dataInicio: string;
  dataFim: string | null;
};

function ehFeriado(data: Date, feriados: Set<string>): boolean {
  return feriados.has(format(data, "yyyy-MM-dd"));
}

/**
 * Os dias que a regra produz dentro de um intervalo.
 *
 * Espelha `datas_da_recorrencia()`. As três decisões que ela carrega:
 *
 * - **`quinzenal` conta da `dataInicio` da regra**, não do calendário: uma
 *   regra que começa numa terça cai de terça em terça sim, terça não. Com o
 *   calendário, "quinzenal" precisaria de um marco arbitrário — e o marco
 *   natural é o dia em que a pessoa disse que aquilo começa.
 * - **`mensal` com dia 31 cai no ÚLTIMO dia do mês curto**, nunca pula para o
 *   seguinte: um fechamento marcado "no fim do mês" acontece em fevereiro
 *   também.
 * - **`semanal` sem dias da semana escolhidos** conta de sete em sete a partir
 *   do início; com dias escolhidos, são esses dias toda semana.
 */
export function datasDaRecorrencia(
  regra: RegraDeRecorrencia,
  de: Date,
  ate: Date,
  feriados: Set<string>,
): Date[] {
  const inicio = parseISO(regra.dataInicio);
  const fim = regra.dataFim ? parseISO(regra.dataFim) : null;

  const comeco = de > inicio ? de : inicio;
  const limite = fim && fim < ate ? fim : ate;
  const saida: Date[] = [];

  if (regra.frequencia === "mensal") {
    let mes = new Date(comeco.getFullYear(), comeco.getMonth(), 1);
    while (mes <= limite) {
      const ultimo = lastDayOfMonth(mes).getDate();
      const dia = Math.min(regra.diaMes ?? 1, ultimo);
      const candidato = new Date(mes.getFullYear(), mes.getMonth(), dia);
      if (
        candidato >= comeco &&
        candidato <= limite &&
        (!regra.pularFeriados || !ehFeriado(candidato, feriados))
      ) {
        saida.push(candidato);
      }
      mes = addMonths(mes, 1);
    }
    return saida;
  }

  let cursor = comeco;
  // GUARDA DE SEGURANÇA: a prévia roda no navegador a cada tecla, e um
  // intervalo digitado errado (data de fim em 2099) travaria a aba. O banco
  // tem o limite por rodada; aqui o limite é o laço.
  let voltas = 0;
  while (cursor <= limite && voltas < 800) {
    voltas += 1;
    const dia = diaIso(cursor);
    const diasOk = regra.diasSemana === null || regra.diasSemana.includes(dia);
    const feriadoOk = !regra.pularFeriados || !ehFeriado(cursor, feriados);
    const distancia = Math.round(
      (cursor.getTime() - inicio.getTime()) / 86_400_000,
    );
    const quinzenalOk = regra.frequencia !== "quinzenal" || distancia % 14 === 0;
    const semanalOk =
      regra.frequencia !== "semanal" ||
      regra.diasSemana !== null ||
      distancia % 7 === 0;

    if (diasOk && feriadoOk && quinzenalOk && semanalOk) saida.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return saida;
}

export type OcorrenciaPrevista = {
  /** `2026-10` no modo mensal agrupada, `2026-10-05` no outro. */
  chave: string;
  /** Como a pessoa lê: "Outubro/2026", "semana de 05/10" ou "05/10". */
  rotulo: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  subtarefas: number;
  geradaEm: Date;
};

/**
 * As próximas N ocorrências, com o título já resolvido.
 *
 * **ESTA É A TELA QUE EVITA DESCOBRIR A CONFIGURAÇÃO ERRADA DEPOIS DE TRÊS
 * MESES DE TASKS TORTAS.** Uma regra de recorrência é a única coisa no produto
 * que cria trabalho sozinha, de madrugada — e quem a configura não tem outro
 * jeito de conferir o que escolheu antes de salvar. Sem a prévia, o primeiro
 * retorno chega no dia em que alguém abre o board e vê doze demandas com o
 * mesmo título.
 *
 * NUNCA RETROATIVO, como no banco: começa do período corrente para a frente.
 */
export function proximasOcorrencias(
  regra: RegraDeRecorrencia,
  dados: {
    cliente: string;
    sigla: string;
    titulo: string;
    antecedenciaDias: number;
    hoje: Date;
    feriados: Set<string>;
    /** Quantas etapas o modelo tem — só vale no modo task por ocorrência. */
    etapasDoModelo: number;
  },
  quantas = 5,
): OcorrenciaPrevista[] {
  const { cliente, sigla, titulo, antecedenciaDias, hoje, feriados } = dados;
  const saida: OcorrenciaPrevista[] = [];

  if (regra.modo === "mensal_agrupada") {
    const inicioRegra = parseISO(regra.dataInicio);
    let mes = new Date(
      Math.max(hoje.getFullYear(), inicioRegra.getFullYear()) === hoje.getFullYear() &&
      hoje > inicioRegra
        ? hoje.getFullYear()
        : inicioRegra.getFullYear(),
      hoje > inicioRegra ? hoje.getMonth() : inicioRegra.getMonth(),
      1,
    );

    for (let i = 0; i < 24 && saida.length < quantas; i += 1) {
      const fimDoMes = lastDayOfMonth(mes);
      const datas = datasDaRecorrencia(regra, mes, fimDoMes, feriados);
      if (datas.length > 0) {
        const primeira = datas[0];
        saida.push({
          chave: format(mes, "yyyy-MM"),
          rotulo: comInicialMaiuscula(format(mes, "MMMM'/'yyyy", { locale: ptBR })),
          titulo: resolverVariaveis(titulo, { cliente, sigla, data: primeira, sequencia: i + 1 }),
          inicio: primeira,
          fim: datas[datas.length - 1],
          subtarefas: datas.length,
          geradaEm: addDays(primeira, -antecedenciaDias),
        });
      }
      mes = addMonths(mes, 1);
    }
    return saida;
  }

  const datas = datasDaRecorrencia(
    regra,
    hoje,
    addMonths(hoje, 18),
    feriados,
  ).slice(0, quantas);

  return datas.map((data, i) => ({
    chave: format(data, "yyyy-MM-dd"),
    // "SEMANA DE" SÓ VALE PARA QUEM REPETE POR SEMANA. Numa regra mensal a
    // ocorrência é um dia, e chamá-la de semana descreve outra coisa — foi o
    // seed que mostrou, com um "Relatório de mídia" mensal saindo como
    // "semana de 05/10".
    rotulo:
      regra.frequencia === "semanal" || regra.frequencia === "quinzenal"
        ? `semana de ${format(data, "dd/MM")}`
        : format(data, "dd/MM/yyyy"),
    titulo: resolverVariaveis(titulo, { cliente, sigla, data, sequencia: i + 1 }),
    inicio: data,
    fim: data,
    subtarefas: Math.max(dados.etapasDoModelo, 1),
    geradaEm: addDays(data, -antecedenciaDias),
  }));
}

export type EtapaDoModelo = {
  titulo: string;
  responsavel_id: string | null;
  prazo_offset_dias: number;
  prioridade: TaskPrioridade;
  estimativa_minutos: number | null;
  requer_aprovacao: boolean;
  tipo_aprovacao: "interna" | "cliente" | null;
  /** 1-based, apontando para outra etapa da mesma lista. */
  depende_de_ordem: number | null;
};

export type ModeloDaRecorrencia = {
  titulo: string;
  /**
   * Quem fica com a etapa que não tem dono (migration 0041).
   *
   * **É fallback, nunca substituição.** Quem escreveu o nome na etapa mandou;
   * o padrão só entra onde não há ninguém. O contrário transformaria o campo
   * numa arma — preencher a regra apagaria a distribuição que alguém montou
   * etapa por etapa.
   *
   * Ele existe porque há dois caminhos em que ninguém preenche etapa por
   * etapa: a regra que parte de um workflow (cujos passos podem não ter
   * responsável padrão) e a regra montada às pressas. Nos dois, a rotina da
   * madrugada criava a demanda com as etapas órfãs — e etapa sem dono não
   * aparece no "Minhas Tasks" de ninguém.
   */
  responsavel_padrao: string | null;
  briefing_rico: unknown | null;
  prioridade: TaskPrioridade;
  pasta_entrega: string;
  subtarefa_diaria: Omit<EtapaDoModelo, "prazo_offset_dias" | "depende_de_ordem"> | null;
  subtarefas: EtapaDoModelo[];
  referencias: { tipo: "link"; url: string; titulo: string | null }[];
};

export function modeloVazio(): ModeloDaRecorrencia {
  return {
    titulo: "",
    responsavel_padrao: null,
    briefing_rico: null,
    prioridade: "normal",
    pasta_entrega: "",
    subtarefa_diaria: {
      titulo: "Entrega {DATA}",
      responsavel_id: null,
      prioridade: "normal",
      estimativa_minutos: null,
      requer_aprovacao: false,
      tipo_aprovacao: null,
    },
    subtarefas: [],
    referencias: [],
  };
}

/**
 * O que falta para a regra poder ser salva.
 *
 * A PASTA DE ENTREGA ENTRA AQUI porque ela é obrigatória na task desde a 0015,
 * e uma regra sem pasta gera erro toda madrugada — silenciosamente, num
 * histórico que ninguém abre. `gerar_ocorrencia()` recusa e grava o motivo;
 * esta função é o que evita chegar lá.
 */
export function faltaParaSalvar(
  regra: RegraDeRecorrencia & { nome: string; clienteId: string | null },
  modelo: ModeloDaRecorrencia,
): string[] {
  const faltam: string[] = [];
  if (!regra.nome.trim()) faltam.push("o nome da regra");
  if (!regra.clienteId) faltam.push("o cliente");
  if (!modelo.titulo.trim()) faltam.push("o título das demandas");
  if (!modelo.pasta_entrega.trim()) faltam.push("a pasta de entrega");
  else if (!/^https?:\/\//i.test(modelo.pasta_entrega.trim())) {
    faltam.push("uma pasta de entrega que comece com http:// ou https://");
  }
  if (regra.frequencia === "mensal" && !regra.diaMes) faltam.push("o dia do mês");
  if (
    regra.modo === "task_por_ocorrencia" &&
    modelo.subtarefas.length === 0
  ) {
    faltam.push("pelo menos uma etapa");
  }
  return faltam;
}
