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

// ---------------------------------------------------------------------------
// O cronômetro
//
// O relógio corre no banco (migration 0021): `andando_desde` diz quando a
// passagem em curso começou, `tempo_medido_segundos` guarda as anteriores.
// Estas funções são o gêmeo em TypeScript de `tempo_medido_da_subtarefa()`,
// pelo mesmo motivo de `situacaoDoLancamento()` no Financeiro: a tela precisa
// do número andando a cada segundo, e não dá para perguntar ao banco a cada
// segundo.
//
// O MEDIDO NÃO É O DECLARADO. O medido é um fato sobre o relógio; o declarado
// é `tempo_real_minutos`, que a pessoa confirma ou corrige ao concluir. São
// colunas diferentes no banco e conceitos diferentes na tela — gravar o
// medido por cima do declarado sem ninguém olhar seria registrar como medição
// a noite em que alguém esqueceu a aba aberta.
// ---------------------------------------------------------------------------

export type Cronometro = {
  /** O que já foi contado nas passagens fechadas. */
  tempo_medido_segundos: number;
  /** Quando a passagem em curso começou. Null = relógio parado. */
  andando_desde: string | null;
};

/** Está correndo agora? É só perguntar se há passagem aberta. */
export function estaCorrendo(crono: Cronometro | null | undefined): boolean {
  return !!crono?.andando_desde;
}

/**
 * Segundos medidos até `agora`, incluindo a passagem em curso.
 *
 * `agora` entra por parâmetro e não é lido aqui dentro: o servidor renderiza
 * o primeiro número e o navegador continua a contagem, e se cada um lesse o
 * próprio relógio os dois discordariam na hidratação. É a mesma razão do
 * `tempoRelativo()` nas Recomendações.
 */
export function segundosMedidos(
  crono: Cronometro | null | undefined,
  agora: Date | number,
): number {
  if (!crono) return 0;
  const fechados = Math.max(0, Math.trunc(crono.tempo_medido_segundos ?? 0));
  if (!crono.andando_desde) return fechados;

  const desde = new Date(crono.andando_desde).getTime();
  if (Number.isNaN(desde)) return fechados;

  const instante = typeof agora === "number" ? agora : agora.getTime();
  // Nunca negativo: o relógio do navegador pode estar atrasado em relação ao
  // do servidor, e um "-3s" na tela faria a pessoa desconfiar da medição
  // inteira por causa de três segundos.
  return fechados + Math.max(0, Math.floor((instante - desde) / 1000));
}

/** O mesmo número em minutos, que é a unidade que a tela e o banco usam. */
export function minutosMedidos(
  crono: Cronometro | null | undefined,
  agora: Date | number,
): number {
  return Math.round(segundosMedidos(crono, agora) / 60);
}

/** "1:04:07", "12:30". O formato do cronômetro correndo, não o de relatório. */
export function formatarCronometro(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  if (horas === 0) return `${doisDigitos(minutos)}:${doisDigitos(resto)}`;
  return `${horas}:${doisDigitos(minutos)}:${doisDigitos(resto)}`;
}

/**
 * Uma passagem longa demais para ser trabalho.
 *
 * O cronômetro não sabe a diferença entre oito horas de trabalho e a noite em
 * que alguém esqueceu a subtarefa em andamento. Acima deste limite a tela
 * avisa antes de a pessoa confirmar o número — pré-preenchido e grande é
 * exatamente o que se confirma por reflexo.
 *
 * Não é uma trava: o número medido continua sendo o medido, e quem decide o
 * que vale é quem trabalhou.
 */
export const HORAS_ATE_DESCONFIAR = 8;

export function medidaSuspeita(minutos: number | null | undefined): boolean {
  return typeof minutos === "number" && minutos > HORAS_ATE_DESCONFIAR * 60;
}
