import type { HrStatus, HrTipo, PresencaStatus } from "@/lib/supabase/database.types";

/**
 * O vocabulário do Full Days, e as contas que os dois lados fazem.
 *
 * Em `lib/dominio/` porque servidor e navegador precisam das mesmas respostas:
 * o calendário de seleção conta dias úteis enquanto a pessoa arrasta o mouse,
 * e a Server Action conta de novo antes de gravar. Se as duas contas saíssem
 * de lugares diferentes, a tela mostraria 5 e o banco gravaria 4.
 */

/**
 * O contrato padrão da casa: 15 dias por ano, em até duas parcelas.
 *
 * É só o PADRÃO — o número que vale é o de `team_members`, coluna por pessoa,
 * porque contrato muda por pessoa e mudar contrato não pode exigir deploy.
 * A constante existe para a tela e a camada de dados caírem no mesmo valor
 * quando a ficha ainda não tem um: dois "senão" com números diferentes foi
 * como a regra dos 15 dias quase não valeu.
 */
export const DIAS_DE_DESCANSO_PADRAO = 15;
export const PARCELAS_DE_DESCANSO_PADRAO = 2;

/**
 * Até onde o calendário vai, nas duas pontas.
 *
 * **BORDAS DE CALENDÁRIO, e não "tantos meses a partir de hoje".** Janeiro de
 * 2025 é o começo do histórico que a agência quer poder registrar para trás;
 * dezembro de 2030 é longe o bastante para ninguém esbarrar na ponta
 * combinando um período. Com um intervalo relativo a borda ANDAVA: em
 * setembro de 2026 a pessoa alcançava junho daquele ano, em outubro não
 * alcançava mais — o mesmo dia deixava de existir na tela de um mês para o
 * outro, sem nada avisando.
 *
 * **ELAS MORAM AQUI, e não no componente, porque QUEM PERGUNTA SÃO DOIS.** O
 * calendário monta os meses com elas; a página busca feriados e dias de
 * colega com elas. Se os dois números divergirem, a pessoa rola até 2025 e vê
 * um ano inteiro sem feriado e sem ninguém fora — e essa tela não parece
 * quebrada, parece um ano vazio.
 *
 * E não podiam morar no componente por uma razão de mecânica, não de gosto:
 * `calendario-rolavel.tsx` é `"use client"`, e valor exportado de arquivo
 * cliente não vale no servidor — a página o receberia como referência e a
 * conta estouraria pedindo a rota, não no build.
 */
export const PRIMEIRO_MES_DO_CALENDARIO = "2025-01";
export const ULTIMO_MES_DO_CALENDARIO = "2030-12";

/**
 * O VOCABULÁRIO, e por que ele é este.
 *
 * A equipe da Full Connect Key é toda PJ, e o produto não usa vocabulário de
 * direito trabalhista: num pedido de reconhecimento de vínculo, o sistema da
 * própria contratante falando a língua da CLT é o que se junta aos autos. A
 * regra inteira, com as palavras que saíram e por quê, está no CLAUDE.md e no
 * cabeçalho da migration 0016 — fora de `src/`, porque `npm run check:cores`
 * varre `src/` atrás delas e acusaria o texto que as proíbe.
 *
 * O produto fala de DISPONIBILIDADE, não de direito:
 *
 *   descanso         — o período longo previsto em contrato
 *   afastamento      — o período sem previsão de volta
 *   ausência pontual — um dia ou dois
 *
 * Estas palavras são a SEGUNDA rodada de vocabulário. A primeira, e por que
 * ela foi substituída, está no cabeçalho da migration 0018 — fora de `src/`,
 * pela mesma razão de sempre: `npm run check:cores` varre `src/` atrás das
 * palavras que saíram, e acusaria o texto que as proíbe.
 *
 * `feriado` fica, e a diferença importa: feriado é data do calendário
 * nacional, um fato sobre o dia. Não é direito concedido a ninguém.
 *
 * As chaves do enum no banco continuam como estão, por decisão do usuário:
 * renomear valor de enum em uso é migration arriscada, e ninguém que usa o
 * sistema vê esses nomes. É este mapa que a pessoa lê — e é por ele passar
 * TODO rótulo da tela que a troca cabe num lugar só.
 */
export const ROTULOS_DE_TIPO: Record<HrTipo, string> = {
  ferias: "Descanso",
  licenca: "Afastamento",
  ausencia: "Ausência pontual",
};

/**
 * O que aconteceu com o pedido.
 *
 * "Aprovada" e "reprovada" saíram pela mesma razão das outras palavras:
 * hierarquia de aprovação é um dos indícios de subordinação, e subordinação é
 * o coração do reconhecimento de vínculo. O que acontece aqui é um combinado
 * entre duas partes — quem presta serviço informa o período, a agência
 * confirma que consegue cobrir ou pede para remarcar.
 *
 * As chaves continuam `aprovada` / `reprovada` no banco, como o resto.
 */
export const ROTULOS_DE_STATUS: Record<HrStatus, string> = {
  pendente: "Aguardando retorno",
  aprovada: "De acordo",
  reprovada: "Remarcar",
  cancelada: "Cancelada",
};

export const ROTULOS_DE_PRESENCA: Record<PresencaStatus, string> = {
  presente: "Disponível",
  remoto: "Remoto",
  ferias: "Descanso",
  licenca: "Afastado",
  ausente: "Ausente",
  // "Folga" pressupõe jornada, e jornada pressupõe vínculo. O que este estado
  // diz de verdade é que ninguém contou com a pessoa naquele dia.
  folga: "Sem alocação",
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

/**
 * Quantos dias o pedido consome, por tipo.
 *
 * **O DESCANSO CONTA CORRIDO**: quinze dias são quinze dias de calendário —
 * sai numa segunda, volta na terceira segunda —, e não quinze dias úteis, que
 * na prática seriam três semanas inteiras.
 *
 * Os outros dois continuam em dias úteis, e não é inconsistência: eles não
 * descontam de saldo nenhum. O número deles diz quantos dias de TRABALHO a
 * pessoa ficou fora, e um sábado de ausência pontual não é um dia em que
 * alguém deixou de entregar.
 *
 * Espelha `public.dias_do_pedido()` do Postgres. As duas existem de propósito:
 * esta escreve o número que a pessoa vê enquanto seleciona, aquela é a que o
 * banco grava.
 */
export function contarDiasDoPedido(
  tipo: HrTipo,
  inicioISO: string,
  fimISO: string,
  feriados: Set<string>,
): number {
  if (tipo !== "ferias") return contarDiasUteis(inicioISO, fimISO, feriados);

  const inicio = lerData(inicioISO);
  const fim = lerData(fimISO);
  if (!inicio || !fim || fim < inicio) return 0;

  return diasEntre(inicioISO, fimISO).length;
}

/**
 * "4 dias corridos" ou "2 dias úteis", conforme o tipo.
 *
 * Existe porque a frase aparece na fila do sócio e na lista de pedidos da
 * própria pessoa, e as duas precisam dizer a mesma coisa. Escrever "dias
 * úteis" em cima de um número corrido é a tela desmentindo a conta — quem
 * pediu de sexta a segunda veria "4 dias úteis" e concluiria que o sistema
 * errou.
 */
export function rotuloDosDias(tipo: HrTipo, dias: number): string {
  const plural = dias === 1 ? "dia" : "dias";
  if (tipo === "ferias") return `${dias} ${plural} corrido${dias === 1 ? "" : "s"}`;
  return `${dias} ${plural} ${dias === 1 ? "útil" : "úteis"}`;
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
 * vira 1º de março às 21h. Um dia inteiro de diferença num módulo de descanso é
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

// ---------------------------------------------------------------------------
// O bloqueio por área
//
// Quem responde ao pedido precisa saber quem mais do mesmo time está fora:
// duas designers na mesma semana param a produção, dois nomes quaisquer não
// dizem nada. Por isso o calendário bloqueia os dias em que um colega da área
// já está fora.
//
// A PERGUNTA É SOBRE O INTERVALO, NUNCA SOBRE O DIA SOLTO. Antes a tela
// recusava dia a dia, e o resultado era que clicar no dia 8 não fazia nada,
// mas escolher de 5 a 20 — que passa por cima do 8 — era aceito. Duas
// respostas para a mesma situação, conforme o caminho do clique.
//
// Isto é guarda de TELA, e não vale como trava: quem chamar a API direto
// consegue gravar o pedido do mesmo jeito. O que impede a demanda de seguir é
// o sócio, que vê "quem mais da área está fora" na fila antes de responder.
// ---------------------------------------------------------------------------

export type BloqueioDeArea = { dia: string; nomes: string[] };

/** Os dias do intervalo em que alguém da área já está fora, na ordem. */
export function bloqueiosNoIntervalo(
  inicio: string,
  fim: string,
  bloqueados: Record<string, string[]>,
): BloqueioDeArea[] {
  const [de, ate] = ordenar(inicio, fim);
  const encontrados: BloqueioDeArea[] = [];
  for (const dia of diasEntre(de, ate)) {
    const nomes = bloqueados[dia];
    if (nomes && nomes.length > 0) encontrados.push({ dia, nomes });
  }
  return encontrados;
}

/**
 * A frase da recusa.
 *
 * NOMEIA QUEM ESTÁ FORA, sempre. "Indisponível" sem nome é uma recusa que a
 * pessoa não tem como contornar nem entender — com o nome, ela fala com o
 * colega e os dois se organizam, que é o resultado que interessa.
 *
 * E diz o DIA, porque num intervalo de duas semanas saber que "alguém está
 * fora" não ajuda a escolher outro período.
 */
export function motivoDoBloqueio(bloqueios: BloqueioDeArea[], area: string): string {
  if (bloqueios.length === 0) return "";

  const nomes = [...new Set(bloqueios.flatMap((b) => b.nomes))];
  const quem =
    nomes.length === 1
      ? `${nomes[0]} já está fora`
      : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)} já estão fora`;

  const dias = bloqueios.map((b) => formatarDiaMes(b.dia));
  const quando =
    dias.length === 1
      ? `em ${dias[0]}`
      : dias.length <= 3
        ? `em ${dias.slice(0, -1).join(", ")} e ${dias.at(-1)}`
        : `em ${dias.length} dias desse período, a partir de ${dias[0]}`;

  return `${quem} ${quando}. Você e ${nomes.length === 1 ? "essa pessoa" : "essas pessoas"} são do ${area} — escolha outro período ou combine com ${nomes.length === 1 ? "ela" : "elas"}.`;
}

/** "08/09". Sem date-fns para esta função continuar pura e sem locale. */
function formatarDiaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}
