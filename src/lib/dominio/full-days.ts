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
export const DIAS_DE_RECESSO_PADRAO = 15;
export const PARCELAS_DE_RECESSO_PADRAO = 2;

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
 *   recesso programado  — o período longo previsto em contrato
 *   indisponibilidade   — o afastamento sem previsão
 *   ausência pontual    — um dia ou dois
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
  ferias: "Recesso programado",
  licenca: "Indisponibilidade",
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
  ferias: "Recesso",
  licenca: "Indisponível",
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
 * vira 1º de março às 21h. Um dia inteiro de diferença num módulo de recesso é
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
