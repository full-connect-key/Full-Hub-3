/**
 * Versao de prototipo de src/lib/reports/weekly.ts.
 *
 * As DATAS SAO RELATIVAS A SEMANA PEDIDA, e nao fixas: uma data fixa envelhece
 * e, semanas depois, o resumo mostra "esta semana" com um periodo de meses
 * atras. E o mesmo criterio do stub do Full Days.
 *
 * Os casos que a imagem precisa provar e que so aparecem se o stub os
 * produzir: uma etapa SEM RESPONSAVEL (a tela escreve "sem responsavel" em vez
 * de deixar branco), um material esperando o cliente ha mais de uma semana (a
 * tela pinta de atencao) e uma lista maior que o teto (a tela diz quantos
 * sobraram em vez de cortar calada).
 */
import type {
  EsperandoCliente,
  ItemDoResumo,
  ResumoDaAgencia,
} from "../../src/lib/reports/weekly";

export type { EsperandoCliente, ItemDoResumo, ResumoDaAgencia };

export function segundaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function somarDias(data: string, quantos: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + quantos);
  return d.toISOString().slice(0, 10);
}

export function lerSemana(valor: unknown, hoje: string): string {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return segundaDaSemana(valor);
  }
  return segundaDaSemana(hoje);
}

const DEMANDA = "/painel/gestao-tasks/11111111-1111-1111-1111-111111111111";

export async function resumoDaAgencia(semana: string, hoje: string): Promise<ResumoDaAgencia> {
  const de = segundaDaSemana(semana);
  const ate = somarDias(de, 6);

  const item = (
    n: number,
    titulo: string,
    contexto: string,
    pessoa: string | null,
    data: string,
  ): ItemDoResumo => ({
    id: `item-${n}`,
    titulo,
    contexto,
    pessoa,
    data,
    link: DEMANDA,
  });

  const esperando: EsperandoCliente[] = [
    { id: "r1", titulo: "KV da campanha de primavera", cliente: "Mundo Verde", desdeEmDias: 11, link: DEMANDA },
    { id: "r2", titulo: "Carrossel institucional", cliente: "Óptica Visão", desdeEmDias: 4, link: DEMANDA },
    { id: "r3", titulo: "Lâmina A5 — impressão", cliente: "Mundo Verde", desdeEmDias: 0, link: DEMANDA },
  ];

  return {
    de,
    ate,
    proximaDe: somarDias(de, 7),
    proximaAte: somarDias(de, 13),
    numeros: {
      criadas: 14,
      concluidas: 11,
      atrasadas: 4,
      no_prazo: 8,
      fora_do_prazo: 2,
      sem_prazo: 1,
      minutos_reais: 1145,
    },
    entregues: [
      item(1, "Roteiro do reels", "Óptica Visão · Reels institucional", "Marina Alves", somarDias(de, 4)),
      item(2, "Conceito da campanha", "Mundo Verde · Campanha de primavera", "Bruno Camargo", somarDias(de, 3)),
      item(3, "Revisão do texto do manual", "Mundo Verde · Manual de atendimento", "Carla Nunes", somarDias(de, 2)),
      item(4, "Layout do post de lançamento", "Óptica Visão · Lançamento da coleção", "Bruno Camargo", somarDias(de, 1)),
    ],
    atrasadas: [
      item(5, "Adaptações para stories", "Mundo Verde · Campanha de primavera", null, somarDias(hoje, -9)),
      item(6, "Subida de mídia", "Óptica Visão · Lançamento da coleção", "Diego Reis", somarDias(hoje, -3)),
    ],
    esperandoCliente: esperando,
    proximaSemana: [
      item(7, "KV final", "Mundo Verde · Campanha de primavera", "Bruno Camargo", somarDias(de, 8)),
      item(8, "Legenda dos 4 posts", "Óptica Visão · Social de outubro", "Carla Nunes", somarDias(de, 9)),
      item(9, "Programar publicações", "Óptica Visão · Social de outubro", "Marina Alves", somarDias(de, 11)),
    ],
    foraNaProxima: [
      { nome: "Marina Alves", dias: 5 },
      { nome: "Bruno Camargo", dias: 1 },
    ],
    // A LISTA CORTADA precisa aparecer na imagem: sem isso, a frase "e mais N"
    // nunca e desenhada e ninguem sabe se ela existe.
    //
    // E O TOTAL DO BLOCO TEM QUE BATER COM O CARTAO: 4 mostradas + 7 que
    // sobraram = as 11 de `numeros.concluidas`. A primeira versao deste stub
    // dizia 7 no bloco e 11 no cartao, e a imagem mostrou os dois numeros
    // lado a lado -- foi o que revelou que a consulta real contava
    // agrupadora e `producao_do_periodo` nao.
    sobraram: { entregues: 7, atrasadas: 0, proximaSemana: 0 },
  };
}
